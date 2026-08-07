---
name: capability-plan
description: "Plan, verify, modify, or check progress on a product initiative broken into epic → features (capabilities) → OM-sized tasks. What/why and outcome AC only in the plan and in Beads—never the how. Use when scoping large work for operating-mode, splitting a multi-kLOC idea, auditing a backlog against OM unit size, or reporting feature/epic progress. Dispatch scope-scout for research/feasibility and scope-auditor for plan/progress checks. Not for implementing units (operating-mode), full tracker ops (beads), or architecture how-to (architecture-design)."
---

# Capability plan (feed operating-mode)

Turn a large intent into a map OM can eat **one task at a time**. Golden circle: **why** and **what** in the plan and tracker; **how** only inside operating-mode (design×3 → coder → PR).

## Modes

| Mode | Do |
|------|-----|
| **create** | Propose epic + features + first-wave tasks (thin) |
| **modify** | Reshape map from new facts or user edits (still what/why) |
| **verify** | Check size, deps, over-definition, OM-fit |
| **progress** | What’s done / open / blocked vs features & epic |

Default after a vague “plan this”: **create** draft → **verify** → show human → write Beads only if authorized.

## Hierarchy

```
epic     → initiative (why + outcome envelope)
feature  → capability (what users/system can do + why)
task     → one OM unit ≈ one PR (outcome AC, not design)
deps     → real blockers only
```

Types match `bd` when Beads is used: `epic`, `feature`, `task` (default). Prefer folding health into unit AC over a fake “errors” epic arm.

## What may land in Beads vs not

| In plan / Beads | Never in Beads |
|-----------------|----------------|
| Epic why + non-goals | Module/file layout, crate picks |
| Feature what/why + capability AC | Class diagrams, “use Three.js pattern X” |
| Task title + unit outcome AC | Design×3 picks, refactors, APIs |
| Optional dep edges | Feasibility essays, research dumps |
| Progress = open/closed status | Mid-unit how notes |

Research and feasibility inform **whether** a capability is realistic and **how fine** to slice tasks—they stay in agent reports / chat, not issue design fields.

## Research (required when uncertain)

Dispatch **`scope-scout`** before locking a create/modify when:

- domain or repo is unfamiliar,
- “is this even feasible?” matters,
- external format/API risk is high (e.g. 3MF, GPU, network).

Scout returns risks, unknowns, suggested **what**-level splits—not an implementation plan. Main may re-scout after verify findings.

Do **not** skip research by inventing false certainty. If scout is unavailable, main does a short read-only repo pass and labels residual unknowns explicitly.

## Verify / progress agents

Dispatch **`scope-auditor`** for **verify** and **progress** (and after major **modify**):

- tasks too large / multi-idea,
- features that smuggle how,
- missing non-goals,
- deps that over-serialize,
- progress: which features have open tasks, what’s ready, epic still honest.

Auditor is read-only on product code and tracker; it does not mutate Beads.

## Draft shape (create / modify output)

```
Epic: <title>
Why: <1–3 sentences>
Non-goals: <bullets>
Done when: <capability-level outcomes>

Features:
  - <name>
    Why: …
    What: …          # capability
    AC: …            # observable outcomes
    Out of scope: …

Tasks (first wave only—do not water-fall the whole epic):
  - <title>  parent: <feature>
    AC: …            # unit outcome
    Deps: <ids or none>

Research notes (NOT for Beads): <feasibility / unknowns>
Next kickoff candidate: <one task>
```

Stop adding tasks when further split would require inventing **how**. Grow the backlog as units teach you.

## Beads write policy

- Requires initialized Beads + `bd` (see **`beads-om`** for thin OM surface; full **`beads`** if needed).
- **No implicit write.** Create/update epic/feature/task/deps only when the user authorizes applying the plan (or explicit “write this to beads”).
- Fields: title, type, description (why/what), acceptance (outcomes), parent, deps. No design/notes dumps of how.
- After apply: optional `bd ready`; human still **kickoffs one task** into **`operating-mode`**.
- Never authorize multi-unit OM from this skill.

## Handoff to operating-mode

1. Human accepts map (and Beads apply if wanted).
2. Human kickoffs **one** task (or accepts proposed next).
3. Main loads **`operating-mode`**: design×3 invents how → coder → reviewer → PR.
4. Close task post-merge if authorized; feature/epic stay open until capabilities truly done.
5. Re-enter this skill for **modify** / **progress** / more task waves—not mid-unit.

## Ban list

- Implementation inside this skill’s loop
- Stuffing how into Beads
- Full epic task explosion up front
- Unattended multi-unit execution
- Swarm/molecule/gate ceremony unless user already uses that stack
