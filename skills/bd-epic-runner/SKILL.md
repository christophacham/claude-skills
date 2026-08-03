---
name: bd-epic-runner
description: Work all ready children of a beads epic one unit at a time through the full loop cycle — claim → implement → review → gate → push → close — in bd ready order. Use when asked to "work epic <id>", "run the epic", or "process the epic's children" in any bd-tracked repo. Not for single-unit work (use work-loop), unit creation or hygiene, design/planning (use work-plan), or repos where beads is not initialized.
argument-hint: <epic-id>
arguments: [epic]
shell: bash
---

# bd-epic-runner — work an epic's children to done

Portable epic-iteration loop for any beads repo. The bd procedure below is
fixed; per-unit mechanics come from the loop skill: the repo's own
`.claude/skills/*loop*` if one exists, else the global `work-loop`. This skill
supplies epic iteration and doctrine enforcement only.

Args: an epic id (required). Other invocation text is session-scoped override
(e.g. "don't push") — overrides win.

## State at load (injected — read it, don't re-run it)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — default model tiers active)"`

### Epic contract
!`if [ -n "$epic" ] && out=$(bd show "$epic" --json 2>/dev/null); then printf '%s\n' "$out"; else echo "(no epic arg, no beads here, or epic not found)"; fi`

### Child graph
!`if [ -n "$epic" ]; then bd list --parent "$epic" --json 2>/dev/null || echo "(no child graph)"; else echo "(no epic arg)"; fi`

### Ready children
!`if [ -n "$epic" ]; then bd ready --parent "$epic" 2>/dev/null || bd ready 2>/dev/null || echo "(bd unavailable)"; else echo "(no epic arg)"; fi`

### Repo conventions (if present)
!`cat CLAUDE.md 2>/dev/null || echo "(no CLAUDE.md)"`

### Tree state
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

Load-time data covers walk start. Every unit after the first needs fresh
reads (`bd show`, `bd ready`, `git status`).

## 1. Setup (once)

1. From conventions: test gate, commit format, push policy, bd mutation rules
   (default: `beads-creator` for writes).
2. Load the loop skill (repo-local `*loop*` else global `work-loop`). Its
   per-unit cycle is: design gate → claim → implement → review → fix →
   Finalize (push/close) → **optional** structural tidy only when debt is
   real (no always-on Cleanup pair). Do not invent a parallel tidy path.
3. Read the epic **design field in full** — doctrine for every child. Empty
   and non-trivial → STOP; route to `work-plan` Flow B before any claim.
4. Tree clean of unrelated work before first claim.

## 2. Fixed rules

- **Order from `bd ready` + deps** — never hand-order. Child epics recurse first.
- **One unit at a time** — claim → full loop → pushed → closed before next.
- **Optional tidy next** — if the loop filed a structural tidy follow-up after
  an implement unit, that unit is next; finish it before a new implement.
  No tidy unit when debt was empty (success).
- **Read before claim:** `bd show <id>` in full every time.
- **Green gate before push.** Red → fix or stop.
- **Spec conflict:** do not improvise. Notes via beads-creator, leave open,
  move to next ready. Same conflict twice → stop; epic design may need
  `work-plan` Flow B.
- Doctrine (epic design field) outranks child instructions on conflict.
- Never `bd edit` (interactive). Use `bd update <id> --field`.
- Track in beads only — no TodoWrite/markdown TODOs.

## 3. The walk

```
loop:
  ready = children of <epic> from `bd ready`
  if empty:
    if every child closed → close epic, sync, report, stop
    else → report blocked/remaining, stop
  unit = first ready (recurse if epic)
  1. bd show <unit> (fresh)
  2. run loop skill full cycle for that unit
  3. breaker/failure → stop walk, report
```

## 4. Final report

| unit | outcome | notes |
|------|---------|-------|
| … | closed / skipped / blocked | reason, gate/proof status |

Plus scoreboard (done / remaining / blocked), spec conflicts, push +
`bd dolt push` confirmation.
