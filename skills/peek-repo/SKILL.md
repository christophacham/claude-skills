---
name: peek-repo
description: >-
  Get third-party GitHub source onto disk under %USERPROFILE%\code\tmp\<name>
  (or ~/code/tmp) so you can answer from real code. Use when the user (or you)
  need to inspect how an open-source tool, skill, library, or API implementation
  works: pasted github.com URLs, owner/repo slugs, "peek at" / "have a look at"
  / "clone for inspection", "how does X work in source", or when training-data
  guesses are not good enough and the canonical repo should be read locally.
  Not for adding package dependencies, permanent installs, forking, PRs, or
  cloning into the current workspace root.
argument-hint: "[owner/repo | github-url | product-hint]"
arguments: [repo]
shell: powershell
allowed-tools: PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1 *), Bash(pwsh -NoProfile -File ${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1 *)
---

# peek-repo — local source for "how does this work?"

Mission: put a **GitHub repo on disk under the fixed tmp root**, then **use that
tree** when the question is about how the project works. Do not pollute the
current workspace. Do not invent repo layout from memory when the clone is
available.

You may be invoked via slash command **or** by your own judgment mid-turn.
Self-trigger when accurate answers need upstream source.

## When to use (model + user)

- User pastes `https://github.com/…` or `owner/repo`
- "peek", "have a look at", "look at how X works", "clone X for inspection"
- "how does this OSS tool / skill / API client actually work?"
- You are about to explain or port behavior from a public project and a local
  read will beat guessing

**Out of scope:** `npm install` into the current app, vendoring as a dependency,
forks/PRs, cloning onto Desktop or into the project tree (unless the user
explicitly overrides the dest — default never does).

## Live state (injected — read it; do not re-run these checks)

### Resolved invocation
```!
$ErrorActionPreference = 'Continue'
function Get-TrimmedHere([string] $s) {
  if ($null -eq $s) { return '' }
  return ($s -replace "`r`n", "`n" -replace "`r", "`n").Trim()
}
function Find-GitHubSlug([string] $text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  # URL or git@ — allow /tree /blob /issues and .git / ? # suffixes
  if ($text -match '(?i)(?:https?://|git@)(?:www\.)?github\.com[:/]+([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)') {
    $n = $Matches[2] -replace '\.git$', ''
    return "$($Matches[1])/$n"
  }
  # first owner/repo token (not a URL)
  if ($text -match '(?i)(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:\.git)?(?![A-Za-z0-9_./-])') {
    $n = $Matches[2] -replace '\.git$', ''
    if ($Matches[1] -notmatch '^(?i)https?$' -and $n) {
      return "$($Matches[1])/$n"
    }
  }
  return $null
}
# Named arg and full arg string are preprocessor paste-text — only ever land
# inside here-strings (never bare after -ne / operators).
$repoPaste = Get-TrimmedHere @'
$repo
'@
$argsPaste = Get-TrimmedHere @'
$ARGUMENTS
'@
$slug = Find-GitHubSlug $repoPaste
$from = 'repo-arg'
if (-not $slug) {
  $slug = Find-GitHubSlug $argsPaste
  $from = 'arguments'
}
if ($slug) {
  "resolved=$slug"
  "parse_source=$from"
} else {
  'resolved=(none)'
  if ($repoPaste) { "repo_raw=$repoPaste" }
  elseif ($argsPaste) {
    $preview = $argsPaste
    if ($preview.Length -gt 240) { $preview = $preview.Substring(0, 240) + '…' }
    "args_raw=$preview"
  } else {
    'repo_raw=(empty)'
  }
  'hint=no owner/repo or github URL in args — extract from user message, search once, or ask once; never guess the org'
}
```

### Dest root
!`Join-Path $env:USERPROFILE 'code\tmp'`

### Existing tmp clones
```!
$ErrorActionPreference = 'Continue'
$root = Join-Path $env:USERPROFILE 'code\tmp'
if (-not (Test-Path -LiteralPath $root)) {
  '(tmp root missing — script will create it)'
  exit 0
}
$dirs = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)
if ($dirs.Count -eq 0) { '(empty)' } else { $dirs -join "`n" }
```

### Target path for resolved slug (exists? git?)
```!
$ErrorActionPreference = 'Continue'
function Get-TrimmedHere([string] $s) {
  if ($null -eq $s) { return '' }
  return ($s -replace "`r`n", "`n" -replace "`r", "`n").Trim()
}
function Find-GitHubSlug([string] $text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  if ($text -match '(?i)(?:https?://|git@)(?:www\.)?github\.com[:/]+([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)') {
    $n = $Matches[2] -replace '\.git$', ''
    return "$($Matches[1])/$n"
  }
  if ($text -match '(?i)(?<![A-Za-z0-9_.-])([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:\.git)?(?![A-Za-z0-9_./-])') {
    $n = $Matches[2] -replace '\.git$', ''
    if ($Matches[1] -notmatch '^(?i)https?$' -and $n) { return "$($Matches[1])/$n" }
  }
  return $null
}
$repoPaste = Get-TrimmedHere @'
$repo
'@
$argsPaste = Get-TrimmedHere @'
$ARGUMENTS
'@
$slug = Find-GitHubSlug $repoPaste
if (-not $slug) { $slug = Find-GitHubSlug $argsPaste }
if (-not $slug) {
  '(no resolved slug — skip target check)'
  exit 0
}
$name = ($slug -split '/')[-1]
$dest = Join-Path (Join-Path $env:USERPROFILE 'code\tmp') $name
if (-not (Test-Path -LiteralPath $dest)) {
  "TARGET=$dest"
  'STATE=missing'
  "SLUG=$slug"
  exit 0
}
if (Test-Path -LiteralPath (Join-Path $dest '.git')) {
  $url = ''
  try { $url = & git -C $dest remote get-url origin 2>$null } catch {}
  "TARGET=$dest"
  'STATE=git'
  "SLUG=$slug"
  "ORIGIN=$url"
} else {
  "TARGET=$dest"
  'STATE=non-git-path-present'
  "SLUG=$slug"
}
```

### gh auth (short)
```!
$ErrorActionPreference = 'Continue'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  'gh=MISSING'
  exit 0
}
try {
  & gh auth status 2>&1 | Select-Object -First 6 | Out-String
} catch {
  "gh=error: $($_.Exception.Message)"
}
```

## Resolve the repo (you own this)

Injection only pre-parses **args**. You still resolve when `resolved=(none)` or
the user spoke in prose without a clean arg.

**Acceptable identities (in order):**

1. **Injection `resolved=owner/repo`** — use it.
2. **User message** — extract first `https://github.com/owner/repo…` or `owner/repo`.
3. **Already in tmp** — if Existing tmp clones lists a clear match for the named
   product and the user meant that tree, reuse it (still run the script; it is
   idempotent and reports EXISTS).
4. **Product / vague hint only** (e.g. "serena", "that pi interpolation skill"):
   - One lookup: `gh search repos "<terms>" --limit 5` **or** a single web search
     skill if `gh` search is empty/unavailable.
   - Prefer official org + exact name match. If two plausible hits → ask once.
   - **Never invent `owner`.** Wrong org is worse than a clarifying question.
5. **Still unclear** → ask once for `owner/repo` or a GitHub URL. Do not clone.

Normalize to `owner/repo` before calling the script (URLs are OK too; the script
accepts both).

## Clone (exactly one script invocation)

```powershell
& "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1" -Repo "owner/repo"
```

- Default is shallow (`--depth 1`). Pass `-Full` only if the user asked for history.
- Idempotent: already cloned → `STATUS=EXISTS` (success).
- Dest is always `%USERPROFILE%\code\tmp\<repo-name>` (script-enforced).
- If `gh=MISSING` or auth failed → report `STATUS: ERROR` with install/login hint; do not fake a path.

## After the path exists — inspect when that was the point

| User intent | What you do |
|-------------|-------------|
| Clone / peek / "get it locally" only | Report status block; one short next-step line; **stop** |
| How it works / walkthrough / port / compare / "check the source" | Report status block, then **read the clone** (README, package manifests, entrypoints, skill files, docs). Answer from that tree. |
| Ambiguous | Clone, then ask whether they want a walkthrough |

Inspection rules:

- Work under `PATH` from the script output only.
- Prefer structure + key files over dumping the whole tree.
- Quote real paths under the tmp clone when explaining.
- Do not copy the project into the current workspace unless the user asks to
  make a local derivative (that is a separate task after peek).

## Report

```text
STATUS: CLONED | EXISTS | BLOCKED | ERROR | NEED_REPO
PATH:   C:\Users\…\code\tmp\<name>   (omit if NEED_REPO / ERROR with no path)
SLUG:   owner/repo
```

- `NEED_REPO` — could not resolve identity; question or search result listed.
- After a successful clone/exists, continue into inspection only when intent
  requires it (table above).

## Hard rules

1. **Never** put free-form invocation text into raw shell outside the bundled
   script — always `-Repo "…"`.
2. **Never** clone into the active project, Desktop, or a guessed custom path.
3. **Never** guess the GitHub org.
4. Load-time injection is a snapshot; if the user changes the target mid-turn,
   re-resolve and run the script again.
5. This skill's job is **local source availability + optional read**. Install,
   build, and "make a cleaner copy in our monorepo" are follow-ups the user
   must ask for (or you propose, not silently do).
