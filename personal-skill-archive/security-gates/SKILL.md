---
name: security-gates
description: >
  Install or revive self-hosted, deterministic security gates for the current
  repo — secrets, dependency audit, language-native SAST, supply-chain
  lockfile scan — wired into the existing quality gate with fail-closed
  honesty; agentic audit explicitly non-gating. Use when the user asks for
  security gates, secret scanning, vuln audit, SAST on the commit path,
  private-repo scanning without GHAS/CodeQL-as-service, or to port that
  pattern to a new stack. Not for one-off manual pentests, exploit writing,
  or treating LLM review as a merge gate.
argument-hint: "[target-or-stack-hint]"
arguments: [target]
shell: bash
---

# security-gates — ship usable security controls

You are installing **deterministic scanners the team can run**, not a paper
policy. End state: security steps on the quality path (and a cheap hook subset
where budget allows), fail-closed proofs, docs — and any agentic deep audit
**outside** the gate.

**Core idea:** private or sovereignty-minded repos cannot assume hosted GHAS /
CodeQL-as-a-service. Scanners install and run where the code builds.  
**Deterministic tools gate; agents do not.**

If the repo already has security steps on its day-to-day gate, **revive/extend**
them — do not invent a parallel “security CI” that diverges from the quality
gate.

Depends on a day-to-day gate entrypoint. If none exists, install or outline one
via the `quality-gates` skill first (or add a minimal gate script in this pass
if the user wants a single shot).

## State at load (injected — read it; do not re-run for discovery)

### Tree + quality gate presence
```!
git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"
git status --short --branch 2>/dev/null | head -40
echo "--- gate / hook entrypoints ---"
if [ -d scripts ]; then ls -1 scripts | grep -iE 'gate|ci|secur|gitleak|vuln|sast|osv|secret|audit' || echo "(no security/gate-ish script names)"; else echo "(no scripts/)"; fi
ls -1 lefthook.yml .pre-commit-config.yaml .gitleaks.toml gitleaks.toml .trivyignore 2>/dev/null || echo "(no common security config filenames at root)"
echo "--- CI workflow names ---"
if [ -d .github/workflows ]; then ls -1 .github/workflows; elif [ -d .forgejo/workflows ]; then ls -1 .forgejo/workflows; else echo "(no workflows dir)"; fi
```

### Stack + dependency surface
```!
echo "--- manifests / lockfiles ---"
for f in package.json package-lock.json pnpm-lock.yaml yarn.lock Cargo.toml Cargo.lock go.mod go.sum pyproject.toml poetry.lock requirements.txt Pipfile.lock Directory.Build.props nuget.config packages.lock.json vcpkg.json vcpkg-configuration.json; do
  [ -e "$f" ] && echo "present: $f"
done 2>/dev/null
ls -1 *.sln 2>/dev/null | head -5 || true
echo "--- scanner tools on PATH (names only) ---"
for t in gitleaks trufflehog osv-scanner trivy semgrep clang-tidy cppcheck cargo-audit govulncheck npm; do
  if command -v "$t" >/dev/null 2>&1; then echo "on PATH: $t"; fi
done
echo "--- docs security lines ---"
for f in CLAUDE.md README.md docs/ci/practice.md SECURITY.md; do
  if [ -f "$f" ]; then
    echo "## $f"
    grep -nEi 'security|gitleaks|vulnerab|secret.?scan|SAST|CodeQL|NuGetAudit|osv|supply.?chain' "$f" 2>/dev/null | head -20 || echo "(no security keywords)"
  fi
done
```

### Optional target arg
!`if [ -n "$target" ]; then printf 'target arg: %s\n' "$target"; else echo "(no target arg — secure the default product surface)"; fi`

Load-time data is a snapshot. Re-check with tools only after you change files.

## Tiering (do not collapse)

| Tier | What | Gates merge? |
|------|------|----------------|
| **T1 Deterministic** | Secrets, dependency vulns, SAST that is scriptable and stable | **Yes** — day-to-day and/or nightly as budget allows |
| **T2 Supply chain** | Lockfiles, SBOM/OSV-class scan, pin native deps | **Yes** when lockfiles exist |
| **T3 Aggregation** | Dashboards, ticket sync, verified-secret schedules | Optional infra; not required to start |
| **T4 Agentic deep audit** | LLM/multi-agent review, attack-surface studies | **Never a gate** — scheduled/on-demand, human-reviewed |

Vigolium-style lesson: non-deterministic agent output must not block merge.

## What you must create (minimum useful T1)

Pick controls that match **this** stack. Skip empty layers.

| Control class | Intent | Honesty rule |
|---------------|--------|--------------|
| **Secrets** | Block committed credentials | Offline scanner on staged/diff; CI enforces (hooks are bypassable) |
| **Dependency audit** | High/critical known vulns fail the build | Tools that exit 0 with findings must be **parsed**; scope workspace-wide |
| **SAST** | Code bugs scanners can see | Prefer **language-native** tools that understand this dialect; baseline then hard-fail |
| **Docs** | How to run, what fails closed, allowlists | Short section next to quality-gate docs |

Wire steps into the **existing day-to-day or nightly gate scripts** (timed
steps), not a one-off shell history. Pre-commit may run only the cheapest
secret protect; CI runs the real detect/audit.

## Workflow

1. **Discover** — Gate entrypoint, manifests, scanners already present, private
   vs public hosting assumptions.

2. **Choose the security product for THIS repo** (write before coding):
   - T1 tools per ecosystem (defaults in `references/control-catalog.md`).
   - Which steps are day-to-day vs nightly (budget).
   - Allowlist policy for test fixtures that look like secrets.
   - Where findings go (gate log now; aggregation later).

3. **Implement fail-closed scripts/steps**
   - Solution/workspace-wide dependency audit when the ecosystem supports it.
   - Secret scan: staged protect locally + diff or full detect in CI/gate.
   - SAST: reuse existing lint/analyzer jobs when present; do not pay for a
     second product that cannot see this language version.
   - No `\|\| true`. No “0 vulns” on empty tool output.

4. **Prove** — Plant a fake secret / known vulnerable pin in a throwaway way
   (or document a dry-run fixture) and show the gate goes red; clean tree green.

5. **Document** — Commands, severity policy (e.g. fail on high/critical),
   allowlist path, “agentic audit is non-gating.”

6. **Stop** — Do not stand up DefectDojo/Forgejo/Renovate unless the user
   asked for T3/T4 infra. Do not implement exploit PoCs.

## Defaults

- **Self-hosted / offline-capable scanners** over SaaS-only gates when the
  remote is “storage only” or the repo is private without paid GHAS.
- **CI is enforcement** for secrets; pre-commit is a seatbelt.
- **Two databases when cheap** (e.g. ecosystem audit + OSV-class) catch timing
  gaps — optional, not mandatory day one.
- **Detect → fix path:** note dependency update automation as follow-up; the
  gate only fails closed on known bad.
- **Rule of Three:** do not extract a mega `security-gate` module until a
  second caller needs shared code; per-tool steps in the quality gate are fine.
- Match OS twin scripts if the repo already dual-scripts quality gates.

## Gotchas

- `dotnet list package --vulnerable`, many audit CLIs, and some SCA tools
  **exit 0 with findings** — parse JSON/text and fail yourself.
- Per-package loops that swallow errors create false greens (historical footgun).
- Env vars for tools must be visible to child processes (export / env prefix).
- Semgrep-class pattern tools may be weak or version-capped on some languages —
  verify they parse **this** codebase before making them the primary SAST.
- Allowlists only for **fixtures**, not to silence production paths.
- Agentic / piolium-style audits are research; never `exit 1` the merge on
  model opinion alone.
- User-level skill: no hard-coded product paths, runner hostnames, or bead IDs.

## Validation (must pass before you claim done)

- [ ] At least one T1 control is on the gate path and fail-closed under tool failure.
- [ ] Planted or documented failure mode turns the gate red; clean tree green.
- [ ] Secret allowlist (if any) is path-scoped and reviewed.
- [ ] Docs state severity policy and that agentic audit does not gate.
- [ ] Steps live in the quality gate scripts (or a script the gate calls), not
      only in chat.

## Output format

```markdown
## Security product
- T1/T2 choices / day-to-day vs nightly / non-gating T4 note

## What landed
- configs, gate steps, hooks, docs

## How to use
- commands and what fails the build

## Validation
- fail-closed proof: yes/no
- planted finding proof: yes/no
```

## Supporting files

Load only when needed:

- `references/design-contract.md` — tiering, honesty, self-hosted rules.
- `references/control-catalog.md` — default tool *classes* per ecosystem
  (starting points, not mandates).
