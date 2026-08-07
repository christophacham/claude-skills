---
name: defectdojo-fix
description: >-
  Pull active vulnerabilities from a self-hosted DefectDojo instance, decide
  which ones are fixable in the current repo (any severity), and remediate
  those that are. Use when the user asks to check DefectDojo, triage DD
  findings, fix DD vulns, remediate OSV/dependency findings from DefectDojo,
  or sync security findings from a local DD. Requires token + base URL via
  DEFECTDOJO_URL (or DEFECTDOJO_HOST + DEFECTDOJO_PORT) and
  DEFECTDOJO_API_TOKEN (env, settings.json, or ~/.defectdojo-credentials).
  Not for generic security audits without DefectDojo, mass false-positive
  bulk closes, or attacking systems.
argument-hint: '[product-or-repo] [--limit N] [--severity Critical,High,...]'
shell: bash
allowed-tools: >-
  Bash, Read, Edit, Write, Grep, Glob,
  Bash(${CLAUDE_SKILL_DIR}/scripts/list-findings.sh *),
  Bash(${CLAUDE_SKILL_DIR}/scripts/resolve-product.sh *)
---

# defectdojo-fix

Fetch **active** findings from self-hosted DefectDojo, map them to this repo,
and **fix every finding that is safely fixable here** — severity is a
priority signal only, **not** a gate. Leave unfixable items reported, not
silently closed.

## Live state (injected)

Load-time only: tool + credential **presence**, git identity, resolved URL
host (not the token). Never inject token values. Never call the network from
injection.

### readiness
```!
# tools
for t in curl jq; do
  if command -v "$t" >/dev/null 2>&1; then
    printf '%s=present\n' "$t"
  else
    printf '%s=MISSING\n' "$t"
  fi
done

# read first non-secret value for KEY_RE from credentials files (no positional $N)
_dd_file_val=''
_dd_read_key() {
  _dd_file_val=''
  _dd_key_re="$DD_KEY_RE"
  for f in "${HOME}/.defectdojo-credentials" /root/.defectdojo-credentials; do
    [ -r "$f" ] || continue
    line=$(grep -E "^${_dd_key_re}=" "$f" 2>/dev/null | head -1 || true)
    if [ -n "$line" ]; then
      _dd_file_val="${line#*=}"
      _dd_file_val="${_dd_file_val%\"}"
      _dd_file_val="${_dd_file_val#\"}"
      return 0
    fi
  done
  return 1
}

# settings.json env presence only (never print secret values)
settings_file="${HOME}/.claude/settings.json"
py=''
command -v python3 >/dev/null 2>&1 && py=python3
[ -z "$py" ] && command -v python >/dev/null 2>&1 && py=python
settings_url=0
settings_host=0
settings_token=0
if [ -n "$py" ] && [ -f "$settings_file" ]; then
  settings_url=$("$py" -c 'import json,sys; d=json.load(open(sys.argv[1])); e=d.get("env") or {}; print("1" if e.get("DEFECTDOJO_URL") else "0")' "$settings_file" 2>/dev/null || echo 0)
  settings_host=$("$py" -c 'import json,sys; d=json.load(open(sys.argv[1])); e=d.get("env") or {}; print("1" if e.get("DEFECTDOJO_HOST") else "0")' "$settings_file" 2>/dev/null || echo 0)
  settings_token=$("$py" -c 'import json,sys; d=json.load(open(sys.argv[1])); e=d.get("env") or {}; print("1" if (e.get("DEFECTDOJO_API_TOKEN") or e.get("API_TOKEN")) else "0")' "$settings_file" 2>/dev/null || echo 0)
fi

# base URL: DEFECTDOJO_URL | HOST+PORT | file | settings presence
url="${DEFECTDOJO_URL:-}"
url_src=''
if [ -n "$url" ]; then
  url_src=env:DEFECTDOJO_URL
elif [ -n "${DEFECTDOJO_HOST:-}" ]; then
  scheme="${DEFECTDOJO_SCHEME:-http}"
  port="${DEFECTDOJO_PORT:-8080}"
  host="$DEFECTDOJO_HOST"
  case "$host" in
    http://*|https://*) url="$host" ;;
    *:*) url="${scheme}://${host}" ;;
    *) url="${scheme}://${host}:${port}" ;;
  esac
  url_src=env:HOST+PORT
else
  DD_KEY_RE='DEFECTDOJO_URL|DD_URL'
  if _dd_read_key; then
    url="$_dd_file_val"
    url_src=file
  else
    DD_KEY_RE='DEFECTDOJO_HOST|DD_HOST'
    if _dd_read_key; then
      host="$_dd_file_val"
      DD_KEY_RE='DEFECTDOJO_SCHEME|DD_SCHEME'
      _dd_read_key || true
      scheme="${_dd_file_val:-http}"
      DD_KEY_RE='DEFECTDOJO_PORT|DD_PORT'
      _dd_read_key || true
      port="${_dd_file_val:-8080}"
      case "$host" in
        http://*|https://*) url="$host" ;;
        *:*) url="${scheme}://${host}" ;;
        *) url="${scheme}://${host}:${port}" ;;
      esac
      url_src=file:HOST+PORT
    elif [ "$settings_url" = "1" ] || [ "$settings_host" = "1" ]; then
      url_src=settings
      url='(from settings.json env — available at tool runtime)'
    fi
  fi
fi
if [ -n "$url" ]; then
  printf 'defectdojo_url=%s\n' "$url"
  printf 'defectdojo_url_source=%s\n' "${url_src:-unknown}"
else
  printf 'defectdojo_url=MISSING (set DEFECTDOJO_URL or DEFECTDOJO_HOST[+PORT])\n'
fi

# token presence only — never print the value
tok='MISSING'
if [ -n "${DEFECTDOJO_API_TOKEN:-}${API_TOKEN:-}" ]; then
  tok='env'
elif [ "$settings_token" = "1" ]; then
  tok='settings'
else
  for f in "${HOME}/.defectdojo-credentials" /root/.defectdojo-credentials; do
    if [ -r "$f" ] && grep -qE '^(DEFECTDOJO_API_TOKEN|API_TOKEN)=' "$f" 2>/dev/null; then
      tok="file:${f}"
      break
    fi
  done
fi
printf 'defectdojo_token=%s\n' "$tok"

# git identity for product matching (owner/repo)
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  printf 'git_root=%s\n' "$root"
  remote=$(git -C "$root" remote get-url origin 2>/dev/null || true)
  if [ -n "$remote" ]; then
    repo=$(printf '%s' "$remote" | sed -E 's#^git@[^:]+:##; s#^https?://[^/]+/##; s#\.git$##')
    printf 'git_remote_repo=%s\n' "$repo"
  else
    printf 'git_remote_repo=unavailable\n'
  fi
  printf 'git_branch=%s\n' "$(git -C "$root" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unavailable)"
else
  printf 'git=unavailable\n'
fi
```

## Decision rules

1. **Severity never blocks a fix.** Critical and Info are both candidates if
   the change is local, correct, and verifiable. Use severity only to **order**
   work (Critical → High → Medium → Low → Info).
2. **Fix only when the finding maps to this checkout.** Product name in DD is
   usually `owner/repo` (Mira OSV) or an app name. Prefer explicit user product
   arg → `git_remote_repo` → ask once if ambiguous.
3. **Fixable** means all of:
   - Evidence points at a path/component that exists here (manifest, lockfile,
     source file, config), **or** a dependency we control in this repo.
   - A concrete remediation is known (fixed version, patch, config flip).
   - Risk is bounded (no speculative rewrites, no production infra you cannot
     verify from this workspace).
4. **Not fixable here** (report, do not fake-close):
   - No matching product / wrong repo
   - Upstream-only (needs vendor release we cannot vendor-bump)
   - Needs human policy (accept risk, false positive judgment with weak evidence)
   - Requires runtime/infra outside the repo
   - Breaking major upgrade with no tests/gates to validate
5. **Do not** mark findings mitigated in DefectDojo unless the user asked **and**
   the fix is verified (tests/build green or lockfile clearly on fixed version).
   Default is code fix + report; DD status update is opt-in.
6. **Do not** bulk-set `false_p` / `active=false` without per-finding reasoning.

## Workflow

### 0. Preconditions

- If `curl=MISSING` or `jq=MISSING` → install or `STATUS: BLOCKED`.
- If `defectdojo_token=MISSING` or `defectdojo_url=MISSING` → `STATUS: BLOCKED`
  with setup hint (see Credentials).
- Resolve product:
  - User arg / `$ARGUMENTS` first
  - else `git_remote_repo` when it looks like `owner/repo` or a known product name
  - else list products and pick the matching one (script or API)

### 1. Pull findings (runtime tool calls — not injection)

Use the bundled script (handles auth resolution + pagination):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/list-findings.sh" --product "$PRODUCT" --active true
# optional filters
bash "${CLAUDE_SKILL_DIR}/scripts/list-findings.sh" --product "$PRODUCT" --severity Critical,High --limit 200
bash "${CLAUDE_SKILL_DIR}/scripts/resolve-product.sh" "$PRODUCT_OR_REPO"
```

Or raw curl (see [references/api-cheatsheet.md](references/api-cheatsheet.md)).

Compact fields to keep: `id`, `title`, `severity`, `file_path`, `line`,
`component_name`, `component_version`, `fix_available`, `fix_version`,
`description` (trim), `mitigation`, `references`, `tags`,
`unique_id_from_tool`, `is_mitigated`, `duplicate`, `false_p`.

**Filter gotcha:** plain `?product=<id>` is a no-op on some DefectDojo builds
(returns every finding). Scripts use `test__engagement__product=<id>`;
`product_name=<exact name>` also works.

### 2. Triage each finding

For every active, non-duplicate finding (any severity):

| Bucket | Criteria | Action |
|--------|----------|--------|
| **FIX** | Local path/dep + known safe remediation | Implement fix in this unit of work |
| **DEFER** | Fixable later but blocked (major bump, missing tests, multi-repo) | Note blocker + next step |
| **SKIP** | Wrong product, already mitigated, duplicate, or not our code | Reason only |
| **NEEDS-HUMAN** | False-positive suspicion, accept-risk, or product decision | Question or open item |

Prefer dependency upgrades to pinned **fixed** versions named in the finding
title/description (e.g. `Fix: 4.7.9`). Prefer smallest lockfile/manifest change.

### 3. Remediate FIX bucket

- One coherent change set per related component when possible.
- Match repo conventions (package manager, changelog, tests).
- Run the project’s normal gates for the files you touched (unit tests, `npm test`,
  `cargo test`, lockfile integrity, etc.). If no gate exists, at least verify the
  fixed version is what the lockfile/manifest resolves to.
- Do **not** expand into drive-by refactors.

### 4. Optional DefectDojo write-back (only if user asked)

After verified fix, PATCH finding (mitigated / notes). Never write tokens into
commit messages or skill output. See api-cheatsheet for endpoints.

### 5. Report

Use the Output contract below. Always list what remains open.

## Credentials

Scripts (`scripts/resolve-env.sh`) and this skill resolve config in this order.

### Token

1. Env: `DEFECTDOJO_API_TOKEN` or `API_TOKEN`
2. Claude Code `~/.claude/settings.json` → `env.DEFECTDOJO_API_TOKEN` (injected into process by the harness)
3. File: `~/.defectdojo-credentials` then `/root/.defectdojo-credentials`
   keys: `API_TOKEN=` / `DEFECTDOJO_API_TOKEN=`

### Base URL (host + port)

Prefer one full base URL, or host and port separately:

1. Env: `DEFECTDOJO_URL` (e.g. `http://192.168.50.179:8080`)
2. Env: `DEFECTDOJO_HOST` + optional `DEFECTDOJO_PORT` (default **8080**) + optional `DEFECTDOJO_SCHEME` (default **http**)
3. Same keys in credentials file or settings.json `env`

Examples:

```bash
# full URL (preferred)
export DEFECTDOJO_URL='http://192.168.50.179:8080'
export DEFECTDOJO_API_TOKEN='…'   # never commit / never print

# or split host + port
export DEFECTDOJO_HOST='192.168.50.179'
export DEFECTDOJO_PORT='8080'
export DEFECTDOJO_API_TOKEN='…'
```

Credentials file (mode `600`):

```bash
API_TOKEN=…
DEFECTDOJO_URL=http://192.168.50.179:8080
# or:
# DEFECTDOJO_HOST=192.168.50.179
# DEFECTDOJO_PORT=8080
```

Claude Code (survives restarts; never project tree):

```json
{
  "env": {
    "DEFECTDOJO_API_TOKEN": "…",
    "DEFECTDOJO_URL": "http://192.168.50.179:8080"
  }
}
```

Auth header: `Authorization: Token <token>`.

If injection shows `defectdojo_token=MISSING` or `defectdojo_url=MISSING` →
`STATUS: BLOCKED` with the setup hint above. Do not invent a host.

**Never** print the token. **Never** put the token in SKILL.md, commits, or PR text.

## Gotchas

- Injection must stay **read-only and offline**. Listing findings is always a
  normal Bash tool call after load.
- Product names often equal GitHub `owner/repo`. Listing all findings without a
  product filter floods context — **always** scope by product when possible.
- Prefer `fix_available` / `fix_version` when present; still verify the fixed
  version lands in *this* repo’s lockfile/manifest.
- OSV/Mira tags (`dependency`, `osv`, `mira`) usually mean lockfile/manifest work,
  not application source rewrites.
- `component_name` may be null; parse title (`handlebars@4.7.8`) and
  `file_path` (`dependencies/npm/handlebars`) instead.
- `active=true` still includes unverified items; `duplicate` / `false_p` /
  `is_mitigated` must be checked client-side.
- Self-hosted DD may be LAN-only (`192.168.x`); failure is often network/VPN, not
  auth — distinguish HTTP 401/403 from connection errors.

## Output

```text
STATUS: OK | PARTIAL | BLOCKED | ERROR
PRODUCT: <name> (id=<id>) | unresolved
DD: <url host only>
COUNTS: active=<n> fix=<n> deferred=<n> skipped=<n> needs_human=<n>

## Fixed
- [DD #<id>] <severity> <title> → <what changed> (verified: <how>)

## Deferred
- [DD #<id>] … → blocker: …

## Skipped
- [DD #<id>] … → reason: …

## Needs human
- [DD #<id>] … → question: …

## Notes
- <auth/product/gate issues; write-back done or not>
```

## Supporting files

- `scripts/list-findings.sh` — paginated active findings (JSON lines or JSON array)
- `scripts/resolve-product.sh` — name → product id
- `references/api-cheatsheet.md` — curl recipes, filters, optional PATCH notes

## Near misses (do not trigger)

- Generic “security review this PR” without DefectDojo → use security-review /
  code review skills
- Running scanners (OSV, Trivy, CodeQL) → not this skill’s job
- Operating DefectDojo admin UI / user management
