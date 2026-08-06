---
name: operating-mode
description: "Suite operating mode for product work: human-gated tiny vertical units, deep modules, design×3, refactor-then-integrate, live Rust and/or Playwright gates, early errors/traces/SoC, review-heavy PRs, no oneshot loops. Use when planning or implementing a feature, opening a PR, choosing how to delegate to coder/reviewer/panelists, scoping work, or when the user asks how we work / operating mode / flow. Not for module interface depth details (simple-design), layer placement (architecture-design), or multi-deployable trade-offs (distributed-architecture)."
---

# Operating mode

Canonical product cadence for this suite. README **Operating mode** is the same doctrine for humans. Apply this when you are the **main** agent on product work.

## Three rules

1. **Human-gated tiny units.** One idea per unit (~200–300 LOC production guidance). Feature branch + short PR. Human does not write production code but **must understand** every line that merges; review may rewrite. No oneshot product, no unattended mega-loop.
2. **Design slow, verify always.** Deep modules. **Three ways → pick.** **Refactor existing shape, then integrate** the new bit. Prototype **between** units when the next step is unclear. Live gate: Rust watch/build/test and/or **Playwright as soon as UI exists**. Early SoC, typed/classified errors, traces/logging, explicit unknowns (e.g. unseen printers).
3. **Compose explicitly.** Main session is the kernel. Optional `coder` / `reviewer` / panelists only when dispatched. No grill→tickets pipeline. Quality over speed (year-scale).

Spine: Beck (small steps + feedback), Fowler (tidy/refactor), Ousterhout (deep modules), Hohpe (elevator between intent and working code).

## Unit cadence (only loop)

```
YOU pick ONE unit
  → design ×3 → pick
  → refactor existing if needed
  → implement under live gates (+ health for this unit)
  → PR on feature branch
  → review-heavy (human understands; may change code)
  → merge only if understood + green
  → optional prototype → next unit
```

Stop if scope creeps, live checks are not running, or the human cannot explain the change.

## Factors (CI/CD law — short)

1. One unit · one PR  
2. Live Rust feedback during the unit  
3. Playwright when UI is in the unit  
4. Strict Rust gates (fmt/clippy/tests as project sets)  
5. Traces/logs on new paths  
6. Errors at boundaries; unknowns explicit  
7. Deep modules (small surface)  
8. Design ×3 before locking an interface  
9. Refactor-before-extend  
10. Prototype when design is unclear  
11. Same checks via lefthook/mise (or project equivalent) locally + CI  
12. Human comprehension required to merge  

## Delegation (main agent only)

| Need | Dispatch |
|------|----------|
| Implement **this unit only** | `coder` with a tight brief; live checks; commit only if user authorized |
| Independent audit | `reviewer` with target + evidence → PASS / CHANGES_REQUESTED / REPLAN |
| Contested design | panelists `deep-module` + `minimal-diff` + `seam`, then **you** judge |
| Module depth / smells | load `simple-design` / `refactoring` |
| Layers / ports | `architecture-design` |
| Multi-deployable | `distributed-architecture` |

Do **not** oneshot multiple units in one coder turn. Do **not** invent adjacent features. Do **not** skip live gates to “finish faster.”

## Ban list

Oneshot slicer/product · mixed-feature PRs · “logging later” · UI without Playwright once UI exists · Rust without live feedback · feature over a bad module without refactor · merge without human understanding · automated multi-step loops as the plan.
