# Handbook 03 — Operating mode (one unit → PR)

How a **single unit** runs after the map exists (or when the unit is already obvious).

Series: [01 · product flow](01-handbook-product-flow.md) · [02 · capability-plan](02-handbook-capability-plan.md) · **03 · operating-mode**

Agent law: `skills/operating-mode/SKILL.md`. Optional queue: `skills/beads-om/SKILL.md`.  
Agents: `coder`, `reviewer`, panelists (`deep-module`, `minimal-diff`, `seam`).

---

## In one line

**You kick off one unit → main runs hands-off (panelists if needed → coder → reviewer → PR) → you understand and merge → repeat.**

If the work is still a multi-capability blob, go back to [02](02-handbook-capability-plan.md) first.

---

## Why this shape

Year-scale product work needs high understanding and high quality. The human rarely writes production code but **must understand every line that merges**. Agents get real autonomy **inside one small unit**; they do not get unattended multi-unit ownership.

| Keep | Avoid |
|------|--------|
| One idea · one PR · live gates | Oneshot multi-feature sessions |
| Design×3 then pick (main judges) | Mid-unit “does this look good?” spam |
| Free dispatch of coder / reviewer / panelists | Permission ping for tests or subagents |
| Human stops: kickoff, principle gap, PR review | Ticket pipeline as the product cadence |

Spine: Beck (small steps + feedback), Fowler (tidy/refactor), Ousterhout (deep modules), Hohpe (intent → working code).

---

## Who does what (unit phase)

| Role | Who | Job |
|------|-----|-----|
| **Human** | you | Kick off **one** unit · principles if missing · review/merge PR |
| **Main** | Claude session | Kernel: cadence, design×3 pick, dispatch, PR, optional `beads-om` |
| **`coder`** | subagent | Implement + live gates for **this unit only** |
| **`reviewer`** | subagent | Read-only audit (OM PR bar) |
| **Panelists ×3** | subagents | Design lenses; **main picks** |
| **`beads-om`** | skill on main | Claim / park / close **this** unit bead |

Main loads **`operating-mode`**. Subagents get a brief—they do not load OM.  
Preloads: `simple-design` + `refactoring` on coder/reviewer.  
**No tracker mutations** from coder, reviewer, or panelists.

Planning agents (`scope-scout`, `scope-auditor`) belong in [02](02-handbook-capability-plan.md), not mid-unit.

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
│                  │    yes → panelists ──► deep-module
│                  │                     ► minimal-diff
│                  │                     ► seam
│                  │    ◄── three reports
│                  ├─ MAIN picks (notes for PR)
│                  │
│                  ├─ (optional beads-om) claim unit bead
│                  │
│                  ├─ coder ───────────────────► implement + checks
│                  │    (re-dispatch if needed)
│                  │
│                  ├─ reviewer ────────────────► PASS | CHANGES | REPLAN
│                  │    CHANGES → coder again
│                  │    REPLAN  → redesign or ask you
│                  │
│                  ├─ open/update feature-branch PR
│◄─ PR ready ──────┤
├─ review / understand / merge
│                  ├─ (optional) close bead
│
next unit (new kickoff)  or  progress via handbook 02
```

---

## Phase by phase

### 0. Preconditions

- Principles in `CLAUDE.md` (or accept short defaults).
- CORE skills/agents installed (`operating-mode`, design preloads; optional `beads-om`).
- Unit is **one idea** (from you or from a capability-plan task).
- Optional: Beads initialized if claiming a task bead.

### 1. Kickoff (you)

| Good | Bad |
|------|-----|
| “Open 3MF and fail clearly with a trace.” | “Ship load + UI + export tonight.” |

Provide: goal, AC, non-goals, constraints.  
No mid-unit micromanagement. Multi-unit asks → refuse oneshot; split via [02](02-handbook-capability-plan.md) if needed.

### 2. Main starts (no ask)

Kickoff → run **to PR**:

1. Principles clear?  
2. Design contested? → panelists.  
3. Feature branch toward short PR.  
4. Spawn coder/reviewer without asking permission.

**Ask only on blockers:** multi-unit scope, irreversible unwritten choice, contradictions, gates can’t run.

### 3. Design ×3 (panelists)

**When:** ownership/interface non-obvious. **Skip:** mechanical path.

| Agent | Lens |
|-------|------|
| `deep-module` | owner, depth, small interface |
| `minimal-diff` | honest smallest touch set + tests |
| `seam` | coupling + smallest contract |

Each fit **one PR**. Main judges; you vote only if irreversible strategy outside written law.

### 4. Optional beads (`beads-om`)

| Moment | Action |
|--------|--------|
| After kickoff | Claim or create+claim **this** task |
| Discovery | Park new **task** (what only)—don’t implement it now |
| After merge | Close if you asked / policy |
| Never | Close on PR open; claim-next multi-unit; dolt push without ask |

### 5. Implement (`coder`)

Brief (tight):

```text
Unit / AC / non-goals / design pick
CLAUDE.md · live checks · branch
Commit only if authorized · no tracker · no push · no adjacent features
```

Coder: refactor-then-integrate → unit health (errors/traces/SoC/unknowns) → live gates → report **Ready for main PR?**

### 6. Review (`reviewer`)

Main supplies **diff + check logs** (reviewer has no shell).

| Verdict | Meaning |
|---------|---------|
| `PASS` | Ready for your PR read |
| `CHANGES_REQUESTED` | → coder, same unit |
| `REPLAN_RECOMMENDED` | Plan wrong → redesign or you |

Also: one unit? gates evidence? health? readable diff?

### 7. PR (main)

One unit; intent; how verified; non-goals; design pick; green gates; human-readable.  
**Agent done = PR ready**, not ticket closed.

### 8. You merge

Understand + green → merge. Optional bead close. Next kickoff or [02 progress](02-handbook-capability-plan.md).

---

## Dispatch cheat sheet (main)

| Situation | Action |
|-----------|--------|
| Implement unit | → `coder` |
| Pre-PR audit | → `reviewer` |
| Contested design | → 3 panelists; main picks |
| Module smells | `simple-design` / `refactoring` |
| Layers / multi-deployable | architecture skills on main (no arch agents yet) |
| Tracker | main + `beads-om` |
| Epic still fuzzy | → handbook 02, not more coder |

---

## Example (one unit after a plan)

**You:** Kickoff task “open 3MF & fail clearly” (from map).  

**Main:** principles OK → panelists if needed → claim bead → coder → reviewer → PR.  

**You:** merge.  

**You:** next kickoff “minimal IR for one drawable” — or “progress on Load feature” via [02](02-handbook-capability-plan.md).

---

## Allowed vs forbidden

| Allowed | Forbidden |
|---------|-----------|
| One unit to PR | Multi-unit unattended |
| Re-dispatch coder/reviewer in-unit | Oneshot the epic |
| Park discoveries as tasks | Coder implements parked work “while here” |
| Return to capability-plan between units | Mid-unit human spam |

---

## Related

| Need | Go to |
|------|--------|
| Combined map + unit story | [01](01-handbook-product-flow.md) |
| Epic / features / tasks | [02](02-handbook-capability-plan.md) |
| OM skill | `skills/operating-mode/SKILL.md` |
| Beads thin | `skills/beads-om/SKILL.md` |
| Agents | `agents/coder.md`, `reviewer.md`, `panelists/*` |
