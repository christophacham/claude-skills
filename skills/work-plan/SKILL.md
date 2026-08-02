---
name: work-plan
description: Decompose a feature into atomic, testable work units via a 3-panelist design round (deep-module / minimal-diff / seam), judged and synthesized into an ordered DAG. Beads (bd) is the canonical tracker; output adapts to gh/Linear/markdown. Use before any non-trivial change ("plan X", "decompose this"), when a work unit's design is empty or stale (called from work-loop). Not for implementation (use work-loop), one-line fixes, or architecture Q&A (use architecture-design).
argument-hint: [feature-or-unit]
shell: bash
---

# work-plan — design before build

You are the planning orchestrator. Three independent read-only panelists
propose; you judge and synthesize ONE plan. Execution belongs to the
`work-loop` skill — this skill ends at an approved unit list.

**Overlay rule:** if the repo ships its own plan skill (a
`.claude/skills/*plan*/SKILL.md` whose name is NOT `work-plan`, e.g.
`nps-plan`), stop here — load and follow that skill instead. Repo doctrine
always wins over this generic core.

## State at load (injected)

### Pool (panel composition source; repo pool wins)
!`cat "${CLAUDE_PROJECT_DIR}/.claude/skills/work-loop/pool.md" 2>/dev/null || cat "${CLAUDE_PROJECT_DIR}/.claude/skills/loop/pool.md" 2>/dev/null || cat ~/.claude/skills/work-loop/pool.md 2>/dev/null || echo "(no pool.md found — panel tiers fall back to inherit)"`

### Tree state
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

## Preconditions

1. Read the repo's conventions file (`AGENTS.md`, else `CLAUDE.md`) for
   non-negotiables.
2. If the project provides a generated code map (some repos ship a map
   generator producing `module-index.md` / `hot-spots.md`), refresh it
   first. Otherwise skip — panelists do their own recon.
3. Confirm the user wants planning, not implementation. "Just do it" → at
   most a single-panelist scout, then straight to `work-loop`.

## The panel

Three named read-only agents (installed beside this skill under
`agents/panelists/`; if absent, use `general-purpose` with the lens pasted
in), one per lens, dispatched in ONE parallel batch — pool members up to 3,
distinct tiers:

- **deep-module** — one deep module with a clear owner; maximize information
  hiding; minimize surface area. Lens skill: simple-design.
- **minimal-diff** — fewest honest touch points; no incidental cleanup, no
  opportunistic refactors. Lens skill: refactoring.
- **seam** — a behavior-preserving indirection that makes the change live in
  one place without rippling. Lens skill: refactoring (+ architecture-design
  when crossing layers).

The tension is the point. Each packet includes: exact feature scope + AC
intent (verbatim) · implicated files/symbols (you infer; if unsure, say so)
· sibling-ownership map (never re-file another unit's scope) · lens skill
names (frontmatter may not auto-load) · the scored question:

> What behavior-preserving preparatory structure work collapses Shotgun
> Surgery into one touch point before we switch hats to the feature?

Panel of 1 (weakest sufficient tier) for trivial single-unit scope. Panel of
2 — the two lenses most orthogonal to an existing design — when units
already carry substantive designs.

## Judge (you)

1. **Convergence** — what did ≥2 lenses independently agree on? Strongest
   signal.
2. **Drop-Test discipline** — which proposal killed speculative work
   correctly?
3. **Fit** — which decomposition matches module boundaries, not symptom
   lines?
4. **Tie-break** — prefer the smaller honest touch list unless a real
   ownership leak overrides (minimal-diff wins by default; seam only if it
   removes real coupling; deep-module only if ownership is currently
   leaked).

A failed lens arrives as null — judge with the other two; below 2 of 3,
re-dispatch the missing lens once.

## Drop Test (every refactor candidate)

Would we merge this refactor if the feature were cancelled tomorrow?

- **Pass** → its own unit: `Refactor: <standalone outcome>`, AC in
  standalone structural language with zero feature references, sequencing
  only via dependency edges. No cleanup pair.
- **Fail** → it is feature scaffolding: stays inside the implement unit, or
  is discarded.

## Decompose

Each unit gets: one-sentence title · testable AC (no vague words — "improve
X" is not AC) · file-scope hint (≤5 paths) · dependency edges (DAG) · phase
(A = TDD new behavior / B = refactor) · size S/M/L.

Order: leaves before parents, Phase A before Phase B in the same area.

## Present → gate → file

1. Present the proposed graph — units, deps, designs, Drop-Test verdicts.
   Nothing filed yet.
2. **approve / edit / abort** (user gate). Edit → revise, re-present. Abort
   → file nothing.
3. On approve, file via beads-creator: `bd create` with `--description`,
   `--acceptance`, `--design`, then dependency edges
   (`bd dep add <unit> <blocker>`). Tracker adapters when bd is absent:
   gh issues (`phase:a`/`epic:` labels), Linear tickets, or a markdown
   `work-units/<feature>.md`.

## Second pass

Fundamental disagreement on the SHAPE of the change (not tactics) →
re-dispatch the panel once with the disagreement as the question. Two rounds
max, then escalate to the user with the conflict laid out.

## What you never do

- Never implement, never claim units, never push. Execution is `work-loop`.
- Never file a refactor unit that fails the Drop Test.
- Never file before the approval gate.
- Never skip the parallel panel and design it yourself — independence is
  the value (trivial panel-of-1 excepted).
- Never run a 4th panelist. Three forces disagreement resolution.

## Handoff to work-loop

State the synthesis and unit order, suggest the first unit (first leaf,
smallest S). Proceed to `work-loop` only on an explicit or implicit go-ahead
— the plan is a contract the user signs by not interrupting.
