---
name: work-plan
description: Design and decompose work before it ships — 3-panelist cross-model design round (deep-module / minimal-diff / seam) judged into one plan, Drop-Tested refactor units with catalog-literal Fowler smell+move from the refactoring skill, design-provenance stamping (only this skill stamps), flows for new features / mandatory epic checks / mid-loop replans. Beads (bd) is the canonical tracker; output adapts to gh/Linear/markdown. Use before any non-trivial change ("plan X", "decompose this"), when a new epic is created (mandatory design check before children are filed or claimed), or when a unit's design is empty/stale (called from work-loop). Not for implementation (use work-loop), one-line fixes, or architecture Q&A (use architecture-design).
argument-hint: [feature-or-unit]
shell: bash
---

# work-plan — design before build

You are the planning orchestrator. Three independent read-only panelists
propose; you judge and synthesize ONE plan, write designs onto units, and
stamp provenance. Execution belongs to the `work-loop` skill — this skill
ends at an approved graph.

**Overlay rule:** if the repo ships its own plan skill (a
`.claude/skills/*plan*/SKILL.md` whose name is NOT `work-plan`), stop here —
load and follow that skill instead. Repo doctrine always wins over this core.

## State at load (injected)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — panel tiers fall back to inherit)"`

### Tree state
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

## Conventions discovery (every flow start)

Read the repo's conventions file (`AGENTS.md`, else `CLAUDE.md`). Extract:

- **Non-negotiables** — product rules every design must respect.
- **Map generator** (optional) — if the repo ships one (a script producing
  `module-index.md` / `hot-spots.md`-style pages), refresh the map FIRST.
  Commit the refresh as its own docs commit **if you own commits**
  (main-session orchestrator); invoked without commit authority (dry run,
  sub-orchestrator) → regenerate and report, the caller commits.
- **Design-provenance label** — default `designed`.
- **Tracker** — bd (canonical), gh, Linear, or markdown files.

## The panel

Three named read-only agents (installed beside this skill under
`agents/panelists/`; a repo's same-named project panelists shadow them; if
absent everywhere, `general-purpose` with the lens pasted in), one per lens,
dispatched in ONE parallel batch — pool members up to 3, distinct tiers:

- **deep-module** — one deep module with a clear owner; maximize information
  hiding; minimize surface area. Lens skills: `simple-design` (+ `refactoring`
  when proposing refactorCandidates).
- **minimal-diff** — fewest honest touch points; no incidental cleanup, no
  opportunistic refactors. Lens skill: `refactoring`.
- **seam** — a behavior-preserving indirection that makes the change live in
  one place without rippling. Lens skill: `refactoring` (+ `architecture-design`
  when crossing layers).

**There is no separate refactoring agent.** Live-tree scan for prep structure
is the panelists' job. You (the judge) never invent refactor candidates that
no panelist listed.

The tension is the point. Each PANEL_PACKET includes: exact feature/unit
scope + AC intent (verbatim) · implicated files/symbols (you infer; if
unsure, say so) · sibling-ownership map (never re-file another unit's scope)
· warning that hotspot churn is historical and deleted files may appear ·
lens skill names by name (frontmatter may not auto-load) · catalog rules
below · the scored question:

> What behavior-preserving preparatory structure work collapses Shotgun
> Surgery into one touch point before we switch hats to the feature?

**PANEL_PACKET must also say (verbatim intent):**

```text
Skills (load by name): refactoring (required for any refactorCandidates entry);
  simple-design (red flags §9; deep-module lens always).
Scan: you are the code scan — map first, then live files/symbols under where.
  No candidates from titles alone. The judge will not invent refactors.
Each refactorCandidates entry MUST use catalog-literal smell + move from the
  refactoring skill matrix; optional redFlag 1–14 from simple-design §9.
Comments smell → move only Extract Function | Rename Function | Rename Variable
  | Rename Field | Introduce Assertion.
Drop Test every candidate: pass = standalone Refactor unit AC (zero feature
  refs); fail = scaffolding or discard.
```

**Codebase map consumption** (when the repo has one): each panelist reads
the map pages first, deep-reads the modules implicated by the candidate
touch list, and spot-checks 2–5 map claims against the live tree (reported
as drift). Fall back to a full scan only when the map is missing or the
spot-checks show it misrepresents the implicated modules. Never a blind
full scan when a map exists.

**Panel size:**
- Panel of 1 (weakest sufficient tier) — trivial single-unit scope.
- Panel of 2 — the two lenses most orthogonal to an existing design, when
  units already carry substantive design FIELDS (rich descriptions do NOT
  count; the rule keys on the design field).
- **Program epics** (children are epics): full panel, unless every sub-epic
  has completed its own Flow B — then panel of 2.

## Judge (you)

1. **Convergence** — what did ≥2 lenses independently agree on? Strongest
   signal.
2. **Drop-Test discipline** — which proposal killed speculative work
   correctly?
3. **Fit** — which decomposition matches module boundaries, not symptom
   lines?
4. **Catalog filter** — drop free-text or non-catalog smell/move; require
   `where` grounded in a panelist scan. Prefer structural smells over
   Comments. You may map clear panelist intent to catalog names **once**;
   if still free-text, re-dispatch that lens — do not invent candidates.
5. **Tie-break** — prefer the smaller honest touch list unless a real
   ownership leak overrides (minimal-diff wins by default; seam only if it
   removes real coupling; deep-module only if ownership is currently
   leaked).

A failed lens arrives as null — judge with the other two; below 2 of 3,
re-dispatch the missing lens once.

## Drop Test (every refactor candidate)

Would we merge this refactor if the feature were cancelled tomorrow?

- **Pass** → its own unit: `Refactor: <standalone outcome>`, AC in
  standalone structural language ("X is the single writer of Y") with ZERO
  feature references, sequencing only via dependency edges. No Cleanup pair
  — a refactor unit IS the tidy hat. Design field must include the catalog
  block (smell + move + where).
- **Fail** → feature scaffolding: stays inside the implement unit as
  optional `scaffoldingMoves` (catalog form), or is discarded as speculative
  generality.

### Catalog refactoring (skill `refactoring` — required)

Same vocabulary as work-loop Cleanup seeds. Load skill **`refactoring`**
(matrix; deep lookup: its `references/reference.md`). Optional **`redFlag`**
from skill **`simple-design`** §9.

Every candidate that survives the judge:

```text
smell: Duplicated Code              # exact Fowler name — refactoring matrix
move: Extract Function              # exact catalog move — not "tidy"
where: src/.../File.cs:Symbol       # from panelist live read
after: <optional intended name>
redFlag: 7                          # optional 1–14 — simple-design §9
standaloneAC: <zero feature refs>
dropTest: pass|fail
size: S|M|L
```

**Rules (reject if any fail):**

1. `smell` — exact name from the `refactoring` skill matrix.
2. `move` — exact primary refactoring from that matrix / catalog.
3. `where` — path:line or symbol from a panelist scan (not titles alone).
4. Free-text moves (`tidy`, `align docs`, `thin headers`) → invalid; drop.
5. **Comments gate:** if `smell` is `Comments`, `move` MUST be one of
   `Extract Function`, `Rename Function`, `Rename Variable`, `Rename Field`,
   `Introduce Assertion`. Prefer Extract Function named after the comment.
6. Prefer structural smells (Duplicated Code, Shotgun Surgery, Long Function,
   Feature Envy, Speculative Generality, Lazy Element, …) over Comments.
7. S-size `Mysterious Name` + Rename may stay micro-tidy inside implement
   (judge note) instead of its own bead when Drop Test is borderline.

No dedicated refactoring agent — panelists scan; skill `refactoring` names
the moves; you Drop-Test and file.

## Decompose

Each unit gets: one-sentence title · testable AC (no vague words — "improve
X" is not AC) · file-scope hint (≤5 paths) · dependency edges (DAG) · phase
(A = TDD new behavior / B = refactor) · design field · size S/M/L.

**Design field:**

- **Implement units:** the one place + touch list + why; optional
  `scaffoldingMoves:` (catalog smell+move+where for dropTest-fail prep only).
  Do **not** pre-seed Beck Cleanup — that is work-loop Phase A residue.
- **`Refactor:` units:** catalog block (smell, move, where, redFlag,
  standalone AC) + touch list. Zero feature references in AC.

Order: leaves before parents, Phase A before Phase B in the same area;
Drop-Test-pass `Refactor:` leaves before the implement units they unblock.

## Provenance (only this skill stamps)

Every design you write or refresh gets BOTH the design field AND the
provenance label (bd: `bd label add <id> designed`). The label is the
loop's proof that the design came from a cross-model round — hand-written
designs do not pass work-loop's design gate. No timestamps-in-fields, no
hashes — tracker metadata only.

**Freshness rule (shared with work-loop):** a design is stale when the unit
lacks the label, OR a dependency closed after the design was written
(`bd history <id>` shows the design write), OR the design text names another
unit's scope (a stamping bug — rewrite the design, don't just re-stamp).
Stale → re-run the unit-scope round and re-stamp.

## Flow A — new feature ("plan X")

1. Design round at feature scope (panelist agents scan the code).
2. Synthesize: epic shape (if the work is epic-sized), implement units,
   catalog Drop-Test-pass refactor units.
3. **Present the proposed graph first** — units, deps, designs, Drop-Test
   verdicts with smell+move. Nothing filed yet.
4. **approve / edit / abort** (user gate). Edit → revise, re-present. Abort
   → file nothing; report the analysis for the record.
5. On approve, file via beads-creator: `bd create` with `--description`,
   `--acceptance`, `--design`, then dependency edges
   (`bd dep add <unit> <blocker>`), then provenance labels on everything you
   designed. Tracker adapters when bd is absent: gh issues (`phase:a`/
   `epic:` labels), Linear tickets, or a markdown `work-units/<feature>.md`.

## Flow B — epic design check (mandatory)

Runs whenever an epic exists that has not been through planning — INCLUDING
late/in-flight epics whose children were filed or even closed before this
discipline. Rules for the late case:

- **Closed units never get retroactive designs** — note the provenance gap
  in the presentation; do not repair history.
- **Open children get designs as usual**, whenever filed.
- **Recursion:** a child that is itself an epic gets its own Flow B first
  (leaves before parents); the parent's presentation sequences those runs.
- **Program epics** (children are epics): the check covers sub-epic
  boundaries, sequencing, and cross-program prerequisites — not every leaf.
  First read the sibling epics' scopes (`bd list --parent=<program>` + their
  design fields) and put the sibling-ownership map in every panelist
  prompt — panelists can't see the graph and will otherwise re-file another
  epic's scope as candidates.

Procedure:
1. Design round at epic scope (panelist agents scan).
2. Check: does the decomposition match module boundaries, or was it carved
   along symptom lines? Are catalog Drop-Test-pass refactor units missing?
3. Present findings + proposed children/designs → approve / edit / abort
   (same gate as Flow A). On approve, file children/designs/refactors.
4. Record the outcome on the epic: design field = decomposition rationale +
   provenance label. Children filed here each get design + label too.

**Cross-program shared prerequisites:** a prep unit stays with its filing
epic (parentage is single). The consuming program names it as an external
entry gate in its own epic design field and wires dep edges to it.

## Flow C — unit scope (called from work-loop, no approval gate)

The loop is mid-flight and found a unit with an empty/stale design — OR a
structural gap too big for micro-tidy surfaced mid-implementation:

1. Design round at unit scope (panelist agent(s) scan; for a discovered gap:
   scope is the gap).
2. Write the design field (the one place + touch list + why; catalog form
   for any Refactor units) AND stamp the provenance label.
3. File any Drop-Test-passing catalog refactor units + deps.
4. Return — the loop resumes. No approval pause (the epic-level gate already
   happened, or the user invoked the loop directly).

**Handshake:** the calling orchestrator re-reads the unit and proceeds only
when the design field is non-empty and the label is present. If your new
refactor units block the unit the loop had claimed, the orchestrator
unclaims, works the blockers first, then re-claims.

## Second pass

Fundamental disagreement on the SHAPE of the change (not tactics) →
re-dispatch the panel once with the disagreement as the question. Two rounds
max, then escalate to the user with the conflict laid out plainly.

## What you never do

- Never implement, never claim units, never push code, never close work
  units. Execution is `work-loop`.
- Never file a refactor unit that fails the Drop Test.
- Never file a refactor unit without catalog-literal smell + move + where.
- Never invent refactor candidates the panelists did not propose (catalog
  rename of clear intent once is OK; new structure is not).
- Never file before the approval gate (Flows A/B).
- Never skip the parallel panel and design it yourself — independence is the
  value (trivial panel-of-1 excepted). Panelists are the code scan.
- Never run a 4th panelist. Three forces disagreement resolution.

## Handoff to work-loop

State the synthesis and unit order (Refactor leaves first), each refactor
unit's **smell + move + where**, and that Cleanup siblings remain loop-owned
(Phase A seed — plan does not invent Phase B comment work). Suggest the
first unit (first leaf, smallest S). Proceed to `work-loop` only on an
explicit or implicit go-ahead — the plan is a contract the user signs by
not interrupting.
