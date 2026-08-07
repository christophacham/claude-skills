# Handbook 02 — Capability plan

How to use **`capability-plan`**: turn a large product intent into a map operating-mode can eat **one task at a time**.

Series: [01 · product flow](01-handbook-product-flow.md) · **02 · capability-plan** · [03 · operating-mode](03-handbook-operating-mode.md)

Agent law: `skills/capability-plan/SKILL.md`. Agents: `scope-scout`, `scope-auditor`. Thin Beads: `beads-om` / full `beads` if needed.

---

## When to use

| Use | Skip |
|-----|------|
| Multi-kLOC or multi-capability idea | Single obvious unit (go straight to OM kickoff) |
| Need a backlog of **what** outcomes | You already want implementation design (that’s OM design×3) |
| Check progress on an epic/features | Mid-unit coding (stay in OM) |
| Reslice after you learned from PRs | Unattended “plan and build everything” |

Trigger examples: “Split 3MF load/view/store for OM,” “Verify this backlog is unit-sized,” “Progress on the 3MF epic?”

---

## Modes

| Mode | You say (roughly) | Main does |
|------|-------------------|-----------|
| **create** | “Plan this initiative” | Scout if needed → draft epic/features/first-wave tasks → verify → show you |
| **modify** | “Drop store for v1” / “Split load further” | Reshape map; re-verify if material |
| **verify** | “Is this OM-fit?” | `scope-auditor`: size, how-leakage, deps |
| **progress** | “Where are we?” | Open/closed vs features; next ready task |

Default for a vague “plan this”: **create → verify → you accept → Beads only if you authorize.**

---

## Hierarchy (what goes in the map)

```
epic     → whole initiative (why + done-when envelope)
feature  → capability: what the system/user can do + why
task     → one OM unit ≈ one PR (outcome AC only)
deps     → real blockers only (e.g. view needs minimal load)
```

Match `bd` types when writing Beads: `epic`, `feature`, `task`.

**Thin first wave.** Do not invent 40 tasks up front. Add waves after early PRs teach real seams.

---

## What / why vs how

| May be in plan & Beads | Must stay out of Beads |
|------------------------|-------------------------|
| Epic why, non-goals, done-when | File trees, module names, crate picks |
| Feature what/why + capability AC | “Use Three.js pattern X,” class diagrams |
| Task title + **unit outcome** AC | Design×3 picks, APIs, refactors |
| Dep edges | Feasibility essays, research dumps |

**How** is invented later in [03 · operating-mode](03-handbook-operating-mode.md).

---

## Agents

### `scope-scout` (research)

**When:** unfamiliar domain/repo, feasibility matters, format/API risk (3MF, GPU, …).

**Does:** read repo (and allowed sources); report feasible / risks / unknowns; optional **what-level** split hints.

**Does not:** write Beads; implement; put how into the plan body for the tracker.

### `scope-auditor` (verify / progress)

**When:** after draft or modify; or “are we done with Load?”

**Does:** flag multi-idea tasks, how leakage, bad deps, epic explosion; progress honesty; suggest next kickoff candidate.

**Does not:** mutate tracker; implement; architecture/PR review.

---

## Typical create session

```
YOU: We need 3MF load, view objects in Three.js, store back—multi-kLOC. Plan for OM. No Beads yet.

MAIN:
  1. Load capability-plan
  2. Dispatch scope-scout → risks/unknowns/split hints
  3. Draft:
       epic: 3MF round-trip
       features: Load | View | Store
       tasks (wave 1): open+fail clear · minimal IR · show one object
       deps: view’s first task → minimal IR
  4. Dispatch scope-auditor (verify)
  5. Show draft + research notes (research ≠ bead fields)

YOU: Accept / tweak
YOU (optional): Write this to Beads
MAIN: apply epic/features/tasks/deps (what/why only) via beads-om/bd
YOU: Kickoff task “open 3MF & fail clearly”  →  handbook 03
```

---

## Draft shape (what you should see)

```
Epic: <title>
Why: …
Non-goals: …
Done when: …

Features:
  - Load
    Why: …
    What: …
    AC: …            # capability outcomes
    Out of scope: …

Tasks (first wave):
  - <title>  parent: Load
    AC: …            # one PR outcome
    Deps: none | <task>

Research notes (NOT for Beads): …
Next kickoff candidate: <one task>
```

---

## Beads apply

- Needs initialized `.beads/` + `bd` on PATH.
- **No silent write** — only when you authorize apply.
- Fields: title, type, description (why/what), acceptance (outcomes), parent, deps.
- After apply: `bd ready` may list candidates; **you still kick off one task** into OM.
- Closing a **task** after merge ≠ closing the **feature** or **epic**.

Progress later: “capability-plan progress on epic X” → auditor + main summarize; optional more tasks via **modify**.

---

## Ban list

- Implementing code in the plan phase  
- Stuffing how into Beads  
- Full waterfall task explosion  
- Handing the whole epic to coder unattended  
- Treating scout output as acceptance criteria prose  

---

## Handoff

Accepted map + one chosen task → **[03 · Operating mode](03-handbook-operating-mode.md)**.

Re-enter this handbook when you need a new wave, a reslice, or a progress check—not mid-unit.
