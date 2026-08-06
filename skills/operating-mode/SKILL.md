---
name: operating-mode
description: "Suite operating mode for product work: human kickoff + PR review only; autonomous one-unit execution with design×3, refactor-then-integrate, live Rust/Playwright gates, early errors/traces/SoC; main may dispatch coder/reviewer/panelists without asking; ask only on blockers or missing principles. Use when planning or implementing a feature, opening a PR, delegating work, scoping a unit, or when the user asks how we work / operating mode / flow. Not for module interface depth (simple-design), layer placement (architecture-design), or multi-deployable trade-offs (distributed-architecture)."
---

# Operating mode

Canonical product cadence. README **Operating mode** matches this for humans. Apply when you are the **main** agent on product work.

## Intent

Ship **year-scale** work with high understanding and high quality. The human rarely writes production code but **must understand every line that merges**. Agents run **hands-off inside one small unit** until a feature-branch PR is ready; the human’s hard stops are **kickoff**, **PR review**, and **defining principles when they are missing**.

Spine: Beck (small steps + feedback), Fowler (tidy/refactor), Ousterhout (deep modules), Hohpe (elevator between intent and working code).

## Autonomy contract

### Human checkpoints (only these)

1. **Kickoff** — human names or accepts **one unit**.
2. **Principle gap** — if project law is missing or contradictory, propose a short definition, get agreement, write it into project docs/`CLAUDE.md`, then continue.
3. **PR review** — human understands, requests changes, or rejects. Merge only when they understand and gates are green.

### Inside the unit (do not wait for the human)

After kickoff, **run to PR without check-ins**:

- Assume operating-mode, project `CLAUDE.md`, and agreed repo principles.
- **Design ×3 → pick** (record the pick in the PR). Do not ask which design unless the choice is irreversible product strategy outside written principles.
- **Refactor existing shape, then integrate** the new bit.
- Implement under **live gates** every meaningful step: Rust watch/build/test; **Playwright as soon as UI exists**.
- Include **health for this unit only**: SoC/deep modules, boundary errors, traces/logs, explicit unknowns (e.g. unseen printers).
- **Dispatch freely** without asking: `coder`, `reviewer`, panelists (`deep-module` / `minimal-diff` / `seam`), and judgment skills (`simple-design`, `refactoring`, `architecture-design`, `distributed-architecture`) as needed.
- Open/update a **short PR** on a feature branch when the unit is green and reviewable.

### Questions

- **Ask only on blockers:** multi-unit scope, irreversible choice not covered by written principles, contradictory requirements, or missing project law (then define it).
- Prefer **one tight question batch**, not drip questions.
- Otherwise **assume and act** within general principles of the repo and this skill.

### Allowed loop vs forbidden loop

| Allowed | Forbidden |
|---------|-----------|
| One unit: design → implement → verify → fix → optional reviewer → **PR** | Multi-unit / whole-product unattended runs |
| Ralf-style iteration **inside** the unit until PR | Oneshot the product or “finish the slicer tonight” |
| Subagent fan-out for **this unit** | Inventing adjacent features to stay busy |

Guidance size: **~200–300 LOC production** per unit (not a hard ceiling). Larger only if still **one idea**.

## Unit cadence

```
YOU: kick off ONE unit (or accept a proposed unit)
        │
        ▼
MAIN (hands-off until PR)
  principles clear? ──no──► propose definitions → agree → write down → continue
        │ yes
        ▼
  design ×3 → pick (note in PR)
  refactor existing if needed
  implement under live gates
    (+ SoC · errors · traces · unknowns for this unit)
  may dispatch coder / reviewer / panelists without asking
  open/update feature-branch PR
        │
        ▼
YOU: review PR (understand / change / reject)
        │
        ▼
merge only if understood + green
  → optional prototype between units
  → next ONE unit
```

**Stop the unit** (and surface to the human) if: scope creeps past one idea, live checks cannot run, or a principle gap cannot be resolved without them.

## Factors (CI/CD law)

1. One unit · one PR  
2. Live Rust feedback during the unit  
3. Playwright when UI is in the unit  
4. Strict Rust gates (fmt/clippy/tests as the project sets)  
5. Traces/logs on new paths  
6. Errors at boundaries; unknowns explicit  
7. Deep modules (small surface)  
8. Design ×3 before locking an interface  
9. Refactor-before-extend  
10. Prototype between units when the next design is unclear  
11. Same checks via lefthook/mise (or project equivalent) locally + CI  
12. Human comprehension required to **merge** (not required mid-unit)

## Delegation (main decides; no permission ping)

| Need | Action |
|------|--------|
| Implement this unit | Dispatch `coder` with a tight brief and live checks; keep the unit on the feature branch toward PR (commits only under session/project authorization rules) |
| Independent audit before PR | Dispatch `reviewer` with target + evidence → PASS / CHANGES_REQUESTED / REPLAN; fix or replan within the unit |
| Contested design | Dispatch panelists in parallel; **main judges**; continue |
| Module depth / smells | Load `simple-design` / `refactoring` |
| Layers / ports | Load `architecture-design` |
| Multi-deployable | Load `distributed-architecture` |

Main remains the kernel. Subagents return to main; main continues to PR. Do **not** ask “should I spawn coder?” — spawn if it helps **this unit**.

## Missing principles

If the project has no clear rule for something that affects the unit (test runner, clippy level, Playwright layout, error/logging convention, module boundaries):

1. Propose a **short** default consistent with deep modules + this skill.  
2. Ask **once** if the human is available at kickoff or principle-gap; if the unit was already kicked off and the choice is reversible, pick the default, document it in the PR, and continue.  
3. Irreversible or cross-cutting law → **block** and ask.

Help **define** project law; do not freeze forever in ambiguity.

## Ban list

- Oneshot multi-feature / whole product  
- Mixed-feature PRs  
- Mid-unit “does this look good?” spam  
- Asking permission to run tests, open a branch, or dispatch subagents for the unit  
- “Logging/errors later”  
- UI without Playwright once UI exists  
- Rust without live build/test feedback  
- Feature over a bad module without refactor first  
- Merge without human understanding  
- Unattended multi-unit loops  

## PR bar (done for the unit)

PR is ready for the human when:

- One unit only; description states intent, how verified, deliberate non-goals, design pick (of three)  
- Live gates green for the surfaces touched  
- Health for the unit present (errors/traces/SoC/unknowns as applicable)  
- Human can read the diff without the agent narrating every line  
