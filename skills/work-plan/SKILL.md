---
name: work-plan
description: Design and decompose work before it ships — sized cross-model design panel (deep-module / minimal-diff / seam), Drop-Test prep refactors, AC proof lines, design provenance. Beads (bd) is the canonical tracker; output adapts to gh/Linear/markdown. Use before any non-trivial change ("plan X", "decompose this"), when a new epic needs a design check, or when work-loop finds empty/stale design (Flow C). Not for implementation (use work-loop), one-line fixes, or architecture Q&A (use architecture-design).
argument-hint: [feature-or-unit]
shell: bash
---

# work-plan — design before build

You are the planning orchestrator. Independent read-only panelists propose;
you judge and synthesize ONE plan, write designs onto units, and stamp
provenance. Execution belongs to `work-loop` — this skill ends at an
approved graph (or Flow C design write).

**Overlay rule:** if the repo ships its own plan skill (a
`.claude/skills/*plan*/SKILL.md` whose name is NOT `work-plan`), stop here —
load and follow that skill instead.

## State at load (injected — read it, don't re-run it)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — panel tiers fall back to inherit)"`

### Tree state
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

### Map trust (mechanical spot-check — not an agent)
!`bash "${CLAUDE_PROJECT_DIR}/.claude/skills/work-plan/scripts/map-drift-check.sh" 2>/dev/null || bash ~/.claude/skills/work-plan/scripts/map-drift-check.sh 2>/dev/null || bash "$(dirname "$0")/scripts/map-drift-check.sh" 2>/dev/null || bash skills/work-plan/scripts/map-drift-check.sh 2>/dev/null || echo "MAP_TRUST
mapPresent: false
claimsChecked: []
verdict: full-scan
notes: map-drift script not found; panelists full-scan"`

Paste the full `MAP_TRUST` block into every PANEL_PACKET. Fail open:
uncertainty → `partial` or `full-scan`, never invent `trust-map`.

| MAP_TRUST verdict | Panelist scan |
|---|---|
| `trust-map` | Map first, then deep-read only candidate touch modules; no global re-spot-check |
| `partial` | Map + re-check implicated modules against the live tree |
| `full-scan` / map missing | Live tree is the source of truth |

## Conventions discovery (every flow start)

Read the repo's conventions file (`CLAUDE.md`). Extract:

- **Non-negotiables** — product rules every design must respect.
- **Map generator** (optional) — if present, refresh the map FIRST. Commit the
  refresh as its own docs commit when you own commits; otherwise regenerate
  and report for the caller to commit.
- **Design-provenance label** — default `designed`.
- **Tracker** — bd (canonical), gh, Linear, or markdown files.

## The panel

Named read-only agents (installed under `agents/panelists/`; repo shadows win;
if absent, `general-purpose` with the lens pasted in). Dispatch in ONE
parallel batch — pool members, distinct tiers when possible.

| Lens | Aim | Skills by name |
|---|---|---|
| **deep-module** | One deep module, clear owner, small surface | `simple-design` (+ `refactoring` if proposing prep) |
| **minimal-diff** | Fewest honest touch points; no opportunistic refactors | `refactoring` |
| **seam** | Behavior-preserving indirection so the change lives in one place | `refactoring` (+ `architecture-design` if crossing layers) |

**There is no separate refactoring agent.** Panelists scan the live tree;
you never invent prep candidates they did not propose.

### Panel size (default)

| Scope | Size |
|---|---|
| Flow C — unit mid-loop | **1** (strongest fit lens) |
| Flow A — new feature | **2** (minimal-diff + deep-module, or seam if coupling is the issue) |
| Flow B — epic / program | **3** (all lenses), unless every sub-epic already finished Flow B → then 2 |
| Trivial single-unit scope | **1** |

### PANEL_PACKET (every dispatch)

Include: exact feature/unit scope + AC intent (verbatim) · implicated
files/symbols (say when unsure) · sibling-ownership map · MAP_TRUST block ·
lens skill names · this scored question:

> What behavior-preserving preparatory structure collapses Shotgun Surgery
> into one touch point before we switch hats to the feature?

Also (verbatim intent):

```text
Skills (load by name): refactoring (for any prep debt); simple-design (deep-module).
Scan: MAP_TRUST + map first if present, then live files/symbols. No candidates
  from titles alone. Judge will not invent prep work.
Prep candidates: concrete where (path:symbol); structural change only
  (extract/move/inline/remove dead/…). Prose/glyph/docs are not prep work.
  Comments → only Extract or Rename that removes the comment's job.
Drop Test each candidate: pass = standalone Refactor unit AC (zero feature
  refs); fail = scaffolding inside implement, or discard.
```

## Judge (you)

1. **Convergence** — what did ≥2 lenses independently agree on? (panel of 1:
   take that lens; still apply Drop Test and fit.)
2. **Drop Test** — killed speculative work correctly?
3. **Fit** — module boundaries, not symptom lines.
4. **Tie-break** — prefer the smaller honest touch list unless ownership is
   leaked (minimal-diff default; seam only if it removes real coupling;
   deep-module only if ownership is currently leaked).

A failed lens arrives as null — re-dispatch once if below the intended panel
size.

## Drop Test (every prep candidate)

Would we merge this refactor if the feature were cancelled tomorrow?

- **Pass** → its own unit: `Refactor: <standalone outcome>`, AC in structural
  language with ZERO feature references. No Cleanup pair — a refactor unit
  IS the tidy hat. File only when size ≥ M; S-size may stay micro-tidy inside
  implement (judge note).
- **Fail** → optional scaffolding note on the implement unit, or discard.

### Prep debt form (keep light)

```text
where: src/.../File:Symbol
change: Extract Function | Move Function | …   # structural; not "tidy"
standaloneAC: <zero feature refs>              # only if dropTest: pass
dropTest: pass|fail
size: S|M|L
```

Point at skill `refactoring` for move names when useful. Do **not** require
full Fowler taxonomy blocks on every entry — `where` + structural `change`
is the bar. Free-text "tidy comments / align docs" → invalid; drop.

## Decompose

Each unit gets:

| Field | Required |
|---|---|
| One-sentence title | yes |
| Testable AC (no vague "improve X") | yes |
| **Proof** — how each AC is demonstrated (command, test id, or scenario) | yes |
| File-scope hint (≤5 paths) | yes |
| Dependency edges (DAG) | yes |
| Phase (A = TDD new behavior / B = refactor) | yes |
| Design field | yes |
| Size S/M/L | yes |

**Design field:**

- **Implement:** the one place + touch list + why; optional scaffolding notes
  for dropTest-fail prep. Do **not** pre-seed Cleanup — loop files tidy only
  when Phase A leaves real structural debt.
- **`Refactor:`:** where + change + standalone AC. Zero feature refs in AC.

**Proof field (per AC):** one observable line each, e.g.

```text
proof:
  - AC1: `dotnet test --filter QuotaPolicy` green on committed tree
  - AC2: `cli inspect --json` exits 0 and prints schemaVersion
```

Order: leaves before parents; Drop-Test-pass `Refactor:` (≥M) before the
implement units they unblock; Phase A before Phase B in the same area.

## Provenance

Every design you write or refresh gets the design field AND the provenance
label (bd: `bd label add <id> designed`). Only this skill stamps that label.

**Claimable design (shared with work-loop):** non-empty design with one place
+ touch list + proof, and scope that names this unit (not another). Missing
or wrong-scope → re-run unit-scope (Flow C) and rewrite. Label is audit
proof of a plan round; content is the claim gate.

## Flow A — new feature ("plan X")

1. Design round at feature scope (sized panel; agents scan).
2. Synthesize: epic shape if needed, implement units, Drop-Test-pass prep
   units (size ≥ M).
3. **Present the proposed graph first** — units, deps, designs, proofs,
   Drop-Test verdicts. Nothing filed yet.
4. **approve / edit / abort** (user gate).
5. On approve, file via beads-creator: create with description, acceptance,
   design (include proof), deps, then provenance labels.

## Flow B — epic design check (mandatory)

Runs when an epic has not been through planning — including late/in-flight
epics.

- **Closed units** — never retroactive designs; note the gap.
- **Open children** — designs as usual.
- **Child epics** — their own Flow B first (leaves before parents).
- **Program epics** — boundaries and sequencing, not every leaf; put sibling
  ownership in every panelist prompt.

Procedure: design round → check decomposition vs module boundaries → present
→ approve/edit/abort → file. Record synthesis + provenance on the epic.

## Flow C — unit scope (from work-loop, no approval gate)

Empty/stale design, or structural gap too big for micro-tidy:

1. Design round at unit scope (panel of 1 default).
2. Write design + proof + stamp provenance.
3. File any Drop-Test-pass prep units (≥M) + deps.
4. Return — loop resumes.

**Handshake:** caller re-reads the unit; proceeds when design + proof are
present. New blockers → unclaim, work blockers, re-claim.

## Second pass

Fundamental disagreement on the SHAPE of the change → re-dispatch once with
the disagreement as the question. Two rounds max, then escalate to the user.

## What you never do

- Never implement, claim, push, or close work units.
- Never file a prep unit that fails the Drop Test.
- Never invent prep candidates panelists did not propose (clear rename of
  intent once is OK).
- Never file before the approval gate (Flows A/B).
- Never skip the panel and design it yourself (panel-of-1 still dispatches
  that one lens).

## Handoff to work-loop

State the synthesis and unit order (Refactor leaves first), each prep unit's
where + change, each unit's proof lines, and that optional tidy after Phase A
is loop-owned (only when structural debt is real). Suggest the first leaf
(smallest S). Proceed to `work-loop` only on go-ahead.
