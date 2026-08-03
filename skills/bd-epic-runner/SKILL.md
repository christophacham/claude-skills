---
name: bd-epic-runner
description: Work all ready children of a beads epic one unit at a time through the full loop cycle — claim → implement → review → gate → push → close — in bd ready order, with Beck pair affinity. Use when asked to "work epic <id>", "run the epic", or "process the epic's children" in any bd-tracked repo. Not for single-unit work (use work-loop), unit creation or hygiene, design/planning (use work-plan), or repos where beads is not initialized.
argument-hint: <epic-id>
arguments: [epic]
shell: bash
---

# bd-epic-runner — work an epic's children to done

Portable epic-iteration loop for any beads repo. The bd procedure below is
fixed; per-unit mechanics (implement/review/fix/cleanup, gate, push) come
from the loop skill: the repo's own `.claude/skills/*loop*` if one exists,
else the global `work-loop`. This skill supplies epic iteration and doctrine
enforcement only.

Args: an epic id (required). Anything else in the invocation is a
session-scoped override (e.g. "don't push") — overrides win over defaults
and conventions.

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

Load-time data covers the walk start. Every unit after the first needs fresh
reads (`bd show`, `bd ready`, `git status`) — a snapshot treated as live
mid-walk is a bug.

## 1. Setup (once, before the first unit)

1. Conventions (`CLAUDE.md`) are injected above. Extract and hold:
   - **Test gate command.** If no gate is stated anywhere, ask the user
     once, then proceed with their answer.
   - **Commit format** (default: `<type>: <summary> (<unit-id>)`).
   - **Push policy** (default: push after each finished unit, per work-loop
     Finalize).
   - **bd mutation rules** (default: dispatch `beads-creator` for writes;
     follow the repo's rule if it differs).
2. Load the loop skill: repo-local `.claude/skills/*loop*` if present, else
   the global `work-loop`. Its per-unit cycle (design gate → claim →
   Phase A → review → fix loop → Finalize → **seed Cleanup** → Cleanup
   sibling with triage: free-close / comment-nit / full Phase B) replaces any
   simplified inner loop — you supply only iteration order and epic doctrine.
   Do not invent a parallel Cleanup path; seeded nothingToTidy free-close is
   a successful pair finish.
3. The epic contract is injected above. Read the **design field in full**.
   It is the authoritative doctrine for this body of work: invariants,
   removal shapes, non-negotiables. Treat every constraint there as a hard
   rule for every child. If the design field is empty and the epic is
   non-trivial, STOP — route to `work-plan` Flow B (mandatory epic design
   check) before any child is claimed. Do not guess doctrine.
4. Tree must be clean of unrelated work before the first claim.

## 2. Fixed rules (never violated, never re-derived)

- **Order comes from `bd ready` + the dependency graph.** Never hand-list
  or hand-order units — the graph already encodes it, and a copied order
  goes stale. Leaves before parents: a child that is itself an epic gets
  recursed into first.
- **One unit at a time.** Claim → full loop cycle → pushed → closed before
  touching the next. Never batch multiple units into one commit.
- **Pair affinity.** After finalizing an implement unit, its `Cleanup:`
  sibling is next — it is guaranteed to exist (the loop's precondition files
  it), is seeded at Phase A finalize, and is now unblocked. Finish the pair
  before any new implement unit — including free-close when the seed is
  `nothingToTidy: true` (no coder/reviewer). Never claim `cleanup-unseeded`.
- **Read before claim:** `bd show <id>` in full before every claim.
- **Green gate before push.** Red means fix or stop — never push on a red
  gate.
- **Spec conflict protocol:** if a unit's spec turns out wrong (a file is
  load-bearing somewhere unexpected, the design contradicts reality), do NOT
  improvise. `bd update <id> --notes="<what you found>"` (via beads-creator
  when the repo delegates bd writes), leave the unit open, move to the next
  ready unit.
- **Doctrine outranks instructions.** If a unit's spec conflicts with the
  epic's design-field constraints, the design field wins — treat it as a
  spec conflict (notes, skip).
- Never `bd edit` (interactive, blocks agents). Use `bd update <id> --field`.
- Track work in beads only — no TodoWrite/TaskCreate/markdown TODOs.

## 3. The walk

```
loop:
  ready = children of <epic> shown by `bd ready`   # unblocked only
  if empty:
    if every child closed → beads-creator: bd close <epic>
                            --reason="all children shipped" (+ bd dolt push)
                            → report, stop
    else → report blocked/remaining, stop
  unit = first ready entry (recurse first if it is itself an epic)
  1. `bd show <unit>` — full read (fresh, not the load snapshot)
  2. run the loop skill's full per-unit cycle:
     design gate → claim → Phase A → review → fix loop → Finalize (push)
     → Cleanup sibling next (pair affinity)
  3. breaker/failure on any unit → stop the walk, report state
```

If a unit was skipped via the spec-conflict protocol, continue the walk —
later units are often unaffected. If the SAME conflict blocks a second unit,
stop the run and report; the epic design likely needs revision (route to
`work-plan` Flow B).

## 4. Final report

End with a compact per-unit table:

| unit | outcome | notes |
|------|---------|-------|
| … | closed / skipped / blocked | reason, gate status |

Plus a running scoreboard (done / remaining / blocked), any spec conflicts
flagged in notes, and confirmation that push + `bd dolt push` succeeded.
