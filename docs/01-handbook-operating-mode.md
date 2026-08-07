# Handbook — operating mode (product cadence)

Human guide for **how a unit runs** with this suite: skill `operating-mode`, the OM agent roster, and optional thin Beads (`beads-om`).

Agent-facing law lives in `skills/operating-mode/SKILL.md`. README **Operating mode** is the short human summary. This handbook is the **when / how / what** walkthrough.

---

## In one line

**You name one unit → main runs hands-off (panelists if needed → coder → reviewer → PR) → you understand and merge → repeat.**

Agents are tools for **that** unit. Operating-mode is the control plane. Beads is optional sticky notes. Architecture agents are not in the roster yet.

---

## Why this shape

Year-scale product work needs high understanding and high quality. The human rarely writes production code but **must understand every line that merges**. Agents get real autonomy **inside one small unit**; they do not get unattended multi-unit product ownership.

| Keep | Avoid |
|------|--------|
| One idea · one PR · live gates | Oneshot multi-feature sessions |
| Design×3 then pick (main judges) | Mid-unit “does this look good?” spam |
| Free dispatch of coder / reviewer / panelists | Permission ping for tests or subagents |
| Human hard stops: kickoff, principle gap, PR review | Ticket pipeline as the product cadence |

Spine: Beck (small steps + feedback), Fowler (tidy/refactor), Ousterhout (deep modules), Hohpe (intent that reaches working code).

---

## Who does what

| Role | Who | Job |
|------|-----|-----|
| **Human** | you | Kick off **one** unit · define principles if missing · review/merge the PR |
| **Main** | Claude session (the chat) | Kernel: cadence, design×3, dispatch, PR, optional `beads-om` |
| **`coder`** | subagent | Implement + live gates for **this unit only** |
| **`reviewer`** | subagent | Read-only audit before/at PR |
| **Panelists ×3** | subagents | Design lenses; **main picks** |
| **`beads-om`** | skill on **main** (optional) | Claim / park / close beads — not a subagent |

Main loads **`operating-mode`**. Subagents do **not** load it; they get a brief from main.

Preloads on implementer/reviewer: `simple-design` + `refactoring`.  
Roster installs with **operating-mode** (or those design preloads) — not with full `beads`.  
`coder` / `reviewer` / panelists **never** mutate trackers.

---

## Timeline (one unit)

```
YOU                MAIN                         SUBAGENTS
│                  │
├─ kickoff unit ──►│
│                  ├─ principles OK?
│                  │    no → propose → you agree → write CLAUDE.md
│                  │
│                  ├─ design needed?
│                  │    yes → spawn panelists ──► deep-module
│                  │                           ► minimal-diff
│                  │                           ► seam
│                  │    ◄── three reports
│                  ├─ YOU don't pick design
│                  ├─ MAIN picks (notes for PR)
│                  │
│                  ├─ (optional beads-om) claim unit bead
│                  │
│                  ├─ dispatch coder ──────────► coder
│                  │    ◄── implement + checks
│                  │    (may re-dispatch coder if fixes needed)
│                  │
│                  ├─ dispatch reviewer ───────► reviewer
│                  │    ◄── PASS | CHANGES | REPLAN
│                  │    CHANGES → coder again, same unit
│                  │    REPLAN  → redesign or ask you if blocked
│                  │
│                  ├─ open/update feature-branch PR
│                  │
│◄─ PR ready ──────┤
├─ review / understand
├─ merge when green + understood
│                  ├─ (optional) close bead
│
next unit (new kickoff)
```

---

## Phase by phase

### 0. Preconditions

- Project has principles (or you accept main’s short defaults into `CLAUDE.md` / project docs).
- Suite: at least **CORE** (`operating-mode`, `simple-design`, `refactoring`; optional `beads-om`).
- OM **agents** installed when `operating-mode` (or design preloads) is applied.
- Optional: `bd` CLI + initialized `.beads/` if using `beads-om`.

### 1. Kickoff (you) — when

Name **one unit**, one idea, PR-sized (~200–300 LOC production guidance, not a hard ceiling).

| Good | Bad |
|------|-----|
| “Load 3MF with boundary errors and a trace on failure.” | “Ship load + UI + export tonight.” |

Provide: goal, acceptance, hard non-goals, irreversible constraints.  
Do not: mid-unit micromanagement, design votes unless strategy is irreversible and unwritten.

If the ask is multi-unit, main should refuse oneshot and split into units with PR review between them.

### 2. Main starts (no ask) — how

Kickoff authorizes main to run **to PR**:

1. Principles clear? If not → propose → agree → write down → continue.
2. Design contested? If yes → panelists.
3. Own the feature-branch story toward a short PR.
4. Never ask “should I spawn coder?” — spawn if it helps **this unit**.

**Ask you only on blockers:** multi-unit scope, irreversible choice not covered by written principles, contradictory requirements, or live checks that cannot run.

### 3. Design ×3 (panelists) — when / how / what

**When:** interface or ownership is non-obvious or contested.  
**Skip:** mechanical change with an obvious path.

**How:** main dispatches **in parallel** (read-only):

| Agent | Lens | Typical output |
|-------|------|----------------|
| `deep-module` | ownership, depth, small interface | keep owner / new module / no structure |
| `minimal-diff` | honest smallest file set + tests | touch list, deferrals |
| `seam` | coupling + smallest contract | existing seam / new seam / direct |

Each recommendation must fit **one PR-sized unit**.

**What main does:** judges, picks one approach (or hybrid), records the pick for the PR.  
**You do not** vote unless the pick is irreversible product strategy outside written principles.

### 4. Optional beads (`beads-om` on main) — when

| Moment | Action |
|--------|--------|
| After kickoff | Claim existing bead or create+claim for this unit |
| Mid-unit discovery | `create` parked task only — do **not** implement it in this unit |
| After you merge | `close` only if you asked or project post-merge policy says so |
| Never mid-unit | Close on PR open, claim-next multi-unit, publish Dolt without ask |

Thin surface: `where`, `ready`, `show`, `create`, `update --claim`, optional `note` / `dep add`, `close`; publish only when authorized. Full tracker doctrine is skill `beads` if needed — still **main**, not a beads subagent.

### 5. Implement (`coder`) — when / how / what

**When:** design pick is set (or path is trivial) and the unit is clear.

**How main briefs coder** (tight, not a novel):

```text
Unit: …
AC: …
Non-goals: …
Design pick: <from design×3 or “direct: …”>
Constraints: CLAUDE.md; live checks: <project commands>
Branch: …
Commit: only if user authorized (usually no)
Do not: tracker, push, adjacent features
```

**What coder does:**

1. Read brief + `CLAUDE.md` + code.
2. If shape is wrong → **refactor first** (behavior-preserving) under live checks.
3. Integrate new behavior.
4. Unit health: boundary errors, traces/logs, SoC, explicit unknowns as the project expects.
5. Run **project** live gates after meaningful steps (e.g. Rust watch/tests; Playwright when UI is in the unit).
6. Report: files, checks, health, blockers, **Ready for main PR?**

**What coder does not:** multi-unit scope, “does this look good?”, tracker mutations, push/amend, invent the next feature.

Main may re-dispatch coder for the **same** unit after review findings.

### 6. Review (`reviewer`) — when / how / what

**When:** unit looks green enough for an independent pass — typically before you see the PR, or when the diff is messy.

**How:** main supplies **diff + evidence** (reviewer has **no shell**):

```text
Target: branch feat/… vs main (diff / file list)
Unit AC: …
Design pick: …
Non-goals: …
Check output: <paste test/build/UI logs>
```

**Verdicts:**

| Verdict | Meaning |
|---------|---------|
| `PASS` | Ready for human PR review |
| `CHANGES_REQUESTED` | Fix list → main → coder (same unit) |
| `REPLAN_RECOMMENDED` | Plan is wrong → redesign or block to you |

Also scores the **OM PR bar:** one unit? gate evidence? unit health? human-readable diff?

**Never:** edit code, run tests, ship a “quick fix.”

### 7. PR (main) — what

Main opens/updates a **short** feature-branch PR when:

- One unit only  
- Description: intent, how verified, deliberate non-goals, design pick (of three when design ran)  
- Live gates green for surfaces touched  
- Health present as applicable  
- Diff readable without an agent narrating every line  

**Agent-side done = PR ready**, not “ticket closed.”

### 8. You review / merge — when

Hard stop. You must **understand** the diff. Merge only if understood and gates are green.

Then optional: bead close; prototype between units; **new** kickoff for the next unit.

---

## Dispatch cheat sheet (main)

| Situation | Action |
|-----------|--------|
| Implement this unit | → `coder` |
| Pre-PR / in-unit audit | → `reviewer` |
| Contested design | → 3 panelists; **main picks** |
| Module depth / smells alone | load `simple-design` / `refactoring` on main (or agent preloads) |
| Layers / multi-deployable | load architecture skills on main — **no** architecture agents yet |
| Tracker | main + `beads-om` only |
| “Should I ask the user?” | only blockers / missing law / multi-unit |

Do **not** ask “should I spawn coder?” — spawn if it helps **this unit**.

---

## Concrete example

**You:**  
“Kickoff: parse 3MF and return structured errors with a trace; no UI.”

**Main:**

1. Principles OK (error/trace conventions already in `CLAUDE.md`).
2. Design slightly contested → panelists → pick “parser module owns format; errors at boundary.”
3. Optional `beads-om`: claim unit bead.
4. Dispatch **coder** with AC + design pick + live `cargo test` (or project equivalent).
5. Coder refactors a shallow helper, implements parse, tests, traces.
6. Dispatch **reviewer** with diff + test log → `CHANGES_REQUESTED` (e.g. missing error on empty input).
7. Coder again → green.
8. Reviewer `PASS`.
9. Main opens PR: “feat: 3MF parse with boundary errors.”

**You:** read PR, merge.  
**Main:** close bead only if authorized.  
**You:** “Next unit: show parse errors in UI” → **new** kickoff (Playwright when UI lands).

---

## Allowed vs forbidden loops

| Allowed | Forbidden |
|---------|-----------|
| One unit: design → code → review → fix → **PR** | Multi-unit unattended runs |
| Re-dispatch coder/reviewer **inside** the unit | Oneshot the whole product |
| Panelists for **this** unit’s design | Grill → tickets as the product pipeline |
| Park discoveries in beads | Coder implements parked work “while here” |
| Ralf-style iteration until the unit PR is ready | Mid-unit human check-in spam |

---

## Related

| Need | Go to |
|------|--------|
| Agent-facing cadence law | `skills/operating-mode/SKILL.md` |
| Thin Beads companion | `skills/beads-om/SKILL.md` |
| Full tracker skill | `skills/beads/SKILL.md` |
| Short human summary | README **Operating mode** |
| Agent contracts | `agents/coder.md`, `reviewer.md`, `agents/panelists/*` |
| Installer / catalog | `README.md`, `lib/catalog.js` |
