# Handbook 01 — Product flow (plan + unit)

Short map of how **capability-plan** and **operating-mode** work **together**. Details: [02 · capability-plan](02-handbook-capability-plan.md), then [03 · operating-mode](03-handbook-operating-mode.md).

Agent law: `skills/capability-plan/SKILL.md`, `skills/operating-mode/SKILL.md`.

---

## In one line

**Plan the initiative as what/why (epic → features → OM-sized tasks) → kick off one task → ship one PR → merge when you understand → repeat. How is invented only inside the unit loop.**

---

## Two phases

| Phase | Skill | Job |
|-------|--------|-----|
| **1 · Map** | `capability-plan` | Split large intent into epic / features / tasks. Research if needed. Verify. Optional Beads write (what/why only). |
| **2 · Unit** | `operating-mode` | One task → design×3 → coder → reviewer → PR → you merge. |

Map feeds the unit loop. The unit loop does **not** re-plan the epic unattended. Mid-unit discoveries become **parked tasks**, not scope creep.

---

## Combined flow

```
YOU: big intent (e.g. 3MF load / view / store)
        │
        ▼
MAIN + capability-plan
  scope-scout   → feasibility / risks (NOT into Beads how-fields)
  draft map     → epic · features · first-wave tasks (what/why)
  scope-auditor → verify OM fit / no how leakage
        │
YOU: accept map · optional “write to Beads”
        │
YOU: kickoff ONE task
        │
        ▼
MAIN + operating-mode
  panelists? → pick how
  coder → live gates
  reviewer → PR bar
  open PR
        │
YOU: understand · merge
        │
optional: close task bead · capability-plan progress
        │
next kickoff (or re-enter plan to modify / add wave)
```

---

## Who does what (both phases)

| Role | Map phase | Unit phase |
|------|-----------|------------|
| **You** | Intent, accept/reject map, authorize Beads | Kickoff one unit, PR review/merge, principles |
| **Main** | Runs capability-plan, dispatches scout/auditor | Kernel: design pick, coder/reviewer, PR, beads-om |
| **`scope-scout`** | Research / feasibility | — |
| **`scope-auditor`** | Verify / progress | — |
| **Panelists ×3** | — | Design×3 (how), main judges |
| **`coder` / `reviewer`** | — | Implement / audit one unit |
| **`beads-om`** | Apply map only if you authorize (via main) | Claim / park / close **one** unit bead |

`coder`, `reviewer`, panelists, scout, auditor: **no** tracker mutations (except main applying an authorized plan or OM bead ops).

---

## Golden circle

| Layer | Where | Content |
|-------|--------|---------|
| **Why** | Plan + Beads epic/feature | Intent, non-goals |
| **What** | Plan + Beads feature/task AC | Capabilities & unit outcomes |
| **How** | Operating-mode only | Design×3, code, modules |

Research stays in scout reports / chat—not in bead design fields.

---

## Human hard stops

1. Accept (or reject) the **capability map**  
2. **Kickoff** each unit (or accept main’s proposed next task)  
3. **Principle gap** (define law, then continue)  
4. **PR review** — merge only when you understand and gates are green  

No unattended multi-unit or “finish the epic tonight” loops.

---

## Read next

1. **[02 · Capability plan](02-handbook-capability-plan.md)** — create / research / verify / Beads / progress  
2. **[03 · Operating mode](03-handbook-operating-mode.md)** — one unit to PR  

Installer: CORE includes both skills; roster installs with `operating-mode` or `capability-plan` (not with full `beads` alone).
