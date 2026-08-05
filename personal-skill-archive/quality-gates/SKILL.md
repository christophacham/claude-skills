---
name: quality-gates
description: >
  Install or revive a two-tier quality gate system for the current repo —
  one fail-fast day-to-day gate (fixture/build/smoke/format/map-drift as
  applicable), optional nightly full suite, thin local hooks that do not
  double-run the full matrix, fail-closed honesty. Use when the user asks
  for fast-gate, local CI hooks, pre-commit matrix, smoke vs nightly split,
  quality gate scripts, or to port that pattern to a new stack. Not for
  implementing product features, security scanning tiers (use security-gates),
  or one-off test runs without a durable gate product.
argument-hint: "[target-or-stack-hint]"
arguments: [target]
shell: bash
---

# quality-gates — ship a usable gate

You are installing a **product the team can run**, not writing a CI essay.
End state: one day-to-day gate command, optional full/nightly twin, hooks that
stay cheap and honest, and docs that name the commands.

**Core idea:** a single fail-fast script is the source of truth for “can we
push.” Local hooks may run a **subset** for speed; they must not soft-pass real
failures. Full/slow work lives off the critical path (nightly/schedule).

If the repo already has this shape, **revive/extend** it — do not invent a
parallel gate.

## State at load (injected — read it; do not re-run for discovery)

### Tree + existing gate tooling
```!
git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"
git status --short --branch 2>/dev/null | head -40
echo "--- root gate-ish files ---"
ls -1 lefthook.yml .pre-commit-config.yaml .husky 2>/dev/null || echo "(no common hook configs at root)"
ls -1 Makefile Taskfile.yml justfile 2>/dev/null || true
echo "--- scripts (gate-ish names) ---"
if [ -d scripts ]; then ls -1 scripts | grep -iE 'gate|ci|smoke|test|format|lint|map|hook' || echo "(no gate-ish names under scripts/)"; else echo "(no scripts/ dir)"; fi
echo "--- CI workflows (names) ---"
if [ -d .github/workflows ]; then ls -1 .github/workflows; elif [ -d .forgejo/workflows ]; then ls -1 .forgejo/workflows; else echo "(no .github/.forgejo workflows dir)"; fi
```

### Stack + docs signals
```!
echo "--- language markers ---"
for f in Cargo.toml package.json pnpm-workspace.yaml go.mod pyproject.toml CMakeLists.txt Directory.Build.props build.zig flake.nix; do
  [ -e "$f" ] && echo "present: $f"
done 2>/dev/null
ls -1 *.sln 2>/dev/null | head -5 || true
echo "--- CLAUDE / README gate lines ---"
for f in CLAUDE.md README.md docs/ci/practice.md docs/ci/README.md; do
  if [ -f "$f" ]; then
    echo "## $f"
    grep -nEi 'fast-gate|nightly|lefthook|pre-commit|quality gate|smoke|map-drift' "$f" 2>/dev/null | head -25 || echo "(no gate keywords)"
  fi
done
```

### Optional target arg
!`if [ -n "$target" ]; then printf 'target arg: %s\n' "$target"; else echo "(no target arg — gate the whole product surface)"; fi`

Load-time data is a snapshot. Re-check with tools only after you change files.

## What you must create (the usable thing)

Minimum shippable set:

| Piece | Role |
|-------|------|
| **Day-to-day gate** | One command from repo root: fail-fast ordered steps, nonzero on any failure, prints timings when easy. |
| **Step set that fits THIS stack** | Only what the product needs (see Defaults). No cargo-cult of another repo’s steps. |
| **Fail-closed honesty** | No `\|\| true` on real checks; tool missing or crash fails the gate (or explicit documented offline escape — never silent green). |
| **How-to** | Short note: command name, when to run (before push / session close), what hooks do vs full gate. |

Strongly preferred when the repo has local commits:

| Piece | Role |
|-------|------|
| **Thin hooks** | Pre-commit (or equivalent) runs a **cheap subset** or skip-if-unchanged checks. |
| **No double matrix** | If hooks auto-push, do **not** re-run the full gate on pre-push. |
| **Nightly / full twin** | Same entry style as day-to-day, broader suite, off critical path. |
| **Shared helpers** | Constants + timed-step helpers if more than one gate script exists. |

Optional:

- Map-drift step if a mechanical map exists (or install via `codebase-map` skill first).
- Path-aware skip predicates (staged ∪ base…HEAD) for warm budgets.
- CI workflow that invokes the **same** day-to-day script (local twin rule).

## Workflow

1. **Discover** — From injection: stack, existing scripts/hooks/CI, docs.
   Prefer extending existing gate scripts over greenfield.

2. **Choose the gate product for THIS repo** (write it down before coding):
   - **Day-to-day steps** (ordered, fail-fast) and warm time budget if any.
   - **Full/nightly steps** (what is too slow or too deep for every push).
   - **Hook subset** vs full gate; push policy (human push vs auto-push).
   - **Twin rule:** agents and humans run the same script CI runs for the
     day-to-day path.

3. **Implement the day-to-day gate** — Single entrypoint (or OS twins that
   share one implementation / shared constants). Steps are real commands with
   real exit codes. Record per-step timing when cheap.

4. **Implement hooks (if used)** — Cheap, path-aware where possible. Fail
   closed. Document bypass (`--no-verify`) as unsafe, not as the design.

5. **Wire CI (if CI exists)** — Call the same script; do not re-express the
   matrix only in YAML.

6. **Document lightly** — Commands, budgets, flake policy pointer if the repo
   has one (no silent retries of red gates).

7. **Stop** — Deliver a runnable gate. No security scanner suite here
   (`security-gates` skill). No product feature work.

## Defaults

- **Two tiers:** day-to-day (critical path) + full/nightly (depth).
- **One source of truth:** scripts in-repo; CI is a thin caller.
- **Skip when inputs unchanged** for expensive steps locally; **CI forces**
  full checks when env says so (or always-on if simple).
- **Smoke ≠ full suite:** tag/filter/short path for day-to-day; full on nightly.
- **Format/lint on changed files** when full-tree is too slow.
- **Fixtures:** if the product has a golden input, the gate asserts it exists
  and smoke uses it — no placeholders.
- Match the repo’s script language (bash / pwsh / both) instead of introducing
  a third.

## Gotchas

- Soft-pass patterns (`\|\| true`, grepping empty output, unset env not
  exported into child processes) create **false greens** — treat as bugs.
- Auto-push + full pre-push matrix doubles cost and tempts skips; pick one
  enforcement point for the heavy matrix.
- Hooks that require Docker for everything usually blow local budgets — keep
  Docker for what truly needs it.
- Do not invent a product CLI wrapper for the gate unless the repo already
  has one; scripts are enough.
- User-level skill: never hardcode one product’s fixture name, filter, or
  module list — derive from **this** tree and docs.

## Validation (must pass before you claim done)

- [ ] Day-to-day gate fails on a deliberate broken check, then passes when fixed.
- [ ] Gate is invokable from repo root with a documented command.
- [ ] If hooks exist: a failing subset blocks commit (or the documented
      enforcement point); no silent success on tool failure.
- [ ] If CI exists: workflow calls the same script (or documents intentional
      divergence).
- [ ] Docs name day-to-day vs full/nightly commands.

## Output format

```markdown
## Gate product
- day-to-day steps / full steps / hooks / CI hook

## What landed
- scripts, hooks, workflow, docs

## How to use
- day-to-day command
- full/nightly command
- when (pre-push / session close / CI)

## Validation
- fail-closed proof: yes/no
- local twin of CI: yes/no
```

## Supporting files

Load only when needed:

- `references/design-contract.md` — abstract two-tier gate contract.
- `references/hook-patterns.md` — thin hooks, skip predicates, anti-patterns.
