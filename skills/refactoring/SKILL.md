---
name: refactoring
description: Use when changing code structure without changing behavior — identifying code smells, choosing Fowler refactorings, planning small safe steps with compile+test between them, extracting or moving functions, simplifying conditionals, removing duplication, improving names — or when refactoring for performance (measure first, design the ideal critical path, remove special cases from hot paths). Covers Rust ownership, traits, and Result-based error handling — not for general Rust debugging or borrow-checker troubleshooting. Do not use for adding features, greenfield design, or architecture decomposition unless refactoring mechanics are requested.
---

# Refactoring

Merges Fowler's *Refactoring* (2nd ed.) with Ousterhout's performance chapter. One discipline: small behavior-preserving steps; performance work adds a measurement stop-condition.

## Core discipline

**Refactoring changes internal structure without intentionally changing observable behavior.** Define that behavior before moving code: outputs and state, errors and panic behavior, ordering/serialization, timing or allocation guarantees that are contractual, and deterministic results. It is not bug-fixing and not feature work — it makes code easier to understand and cheaper to modify.

- **Two Hats:** never add functionality and refactor in the same step. Switch hats consciously.
- **Small reversible steps:** one structural move at a time. Run the cheapest relevant check after each risky step and the broader suite at planned green checkpoints. Record a rollback point with the mechanism the workflow permits (IDE/patch/VCS); do not create commits unless the user or repository workflow asks for them.
- **Rule of Three:** for repeated code that represents the same knowledge and should change together, the third occurrence is a useful prompt to consider refactoring—not an automatic threshold. Refactor earlier when a concrete correctness, safety, ownership, or change-coupling problem already exists; leave coincidentally similar code separate.
- **Name after intent:** functions named after what they do, not how. If a block needs a comment to say what it does, extract it into a function named after that comment.
- **When to refactor:** preparatory (before a feature, refactor to make the addition easy), comprehension (while reading code, to clarify it), litter-pickup (fix what you pass). Dedicated debt-paydown sessions are the last resort, not the default. Good internal design keeps feature velocity constant; without it each feature gets harder.

## Response structure

When advising on a refactoring:

1. **Smell** — what makes the code hard to change or understand.
2. **Target refactoring(s)** — named patterns from the matrix below.
3. **Behavior surface and checkpoints** — what must not change, which characterization/contract tests guard it, and which cheap check runs after each step.
4. **Safe sequence** — small reversible moves with explicit green checkpoints and a rollback route.
5. **Language constraints** — e.g. Rust ownership/borrowing, trait dispatch, `Result` and panic contracts that shape the mechanics.
6. **Stop condition** — evidence behavior stayed the same and the design or measured performance improved.

## Smell → refactoring matrix

Diagnose first, then pick moves. (Signs and mechanics for each smell: `references/reference.md`.)

| Smell | Primary refactorings |
|-------|---------------------|
| Mysterious Name | Rename Function/Variable/Field |
| Duplicated Code | Extract Function, Slide Statements, Pull Up Method |
| Long Function | Extract Function, Replace Temp with Query, Decompose Conditional, Replace Loop with Pipeline |
| Long Parameter List | Introduce Parameter Object, Preserve Whole Object, Remove Flag Argument |
| Global Data | Encapsulate Variable |
| Mutable Data | Encapsulate Variable, Split Variable, Separate Query from Modifier |
| Divergent Change | Split Phase, Move Function, Extract Class |
| Shotgun Surgery | Move Function/Field, Combine Functions into Class, Inline Function |
| Feature Envy | Move Function, Extract Function |
| Data Clumps | Extract Class, Introduce Parameter Object |
| Primitive Obsession | Replace Primitive with Object, Replace Type Code with Subclasses |
| Repeated Switches | Replace Conditional with Polymorphism |
| Loops | Replace Loop with Pipeline |
| Lazy Element | Inline Function/Class, Collapse Hierarchy |
| Speculative Generality | Collapse Hierarchy, Inline Function, Remove Dead Code |
| Temporary Field | Extract Class, Introduce Special Case |
| Message Chains | Hide Delegate, Extract Function, Move Function |
| Middle Man | Remove Middle Man, Inline Function |
| Insider Trading | Move Function/Field, Hide Delegate |
| Large Class | Extract Class, Extract Superclass, Replace Type Code with Subclasses |
| Alternative Classes, Different Interfaces | Change Function Declaration, Move Function, Extract Superclass |
| Data Class | Encapsulate Record, Move Function |
| Refused Bequest | Replace Subclass/Superclass with Delegate |
| Comments | Extract Function, Rename, Introduce Assertion |

## Safety checklist + stop conditions

- **Before:** establish a green baseline and name the observable contract. If coverage is weak, add characterization tests around current behavior—including current errors, ordering, and edge cases—without first “cleaning up” the code.
- **During:** keep one conceptual move in flight. Run formatting/type/compile checks when they catch the current failure cheaply; run focused tests at each step and broader tests at checkpoints. Do not blindly run an hour-long suite after every rename.
- **After (done when):** required checks pass, no intended behavior changed, deterministic outputs remain deterministic, and the named design problem is reduced. Then reassess whether another move pays for itself.
- **Back out:** if the step stops being locally understandable, restore the last green checkpoint and re-plan. Do not mix bug investigation or changed requirements into the refactoring hat.

## Refactoring for performance

Same small-steps discipline, plus one extra stop condition: **measurement**. Clean design and high performance are compatible — simpler code usually runs faster (fewer calls, fewer branches, less redundant work).

Both extremes fail: optimizing everything adds unproven complexity; ignoring known workload constraints can make the design expensive to repair. Choose naturally efficient structures when they are equally clear, but do not assume a hash table, fewer allocations, copying, batching, or sequential access is faster for the real data and platform. Ordering, locality, contention, allocator behavior, and input distribution decide.

Do not copy latency tables into a decision: hardware, runtime, topology, load, and percentiles move by orders of magnitude. Measure end-to-end user/workload outcomes first; use profiles, allocation/IO counters, and focused benchmarks to explain the result. A microbenchmark answers a narrow mechanism question and must not be summed into a system forecast without validation.

### Process

1. **Define the workload and guardrails.** Name representative inputs, concurrency, warm/cold state, target metric and percentile, resource budget, and correctness/error/determinism constraints.
2. **Measure the baseline.** Profile before changing structure. Repeat enough runs to see variance; control build mode, machine load, data set, cache/warmup state, and runtime configuration. Keep raw results.
3. **Design the critical path.** Use the profile to identify work that can be removed, moved, batched, cached, or represented differently. Sketch the minimum common path, but preserve the external contract and keep uncommon behavior correct.
4. **Separate measured slow paths when it helps.** A guard can route uncommon cases away from a hot path, but do not force every edge case through one check or assume branches are the bottleneck without evidence.

```rust
if available_append_bytes >= num_bytes {  // single check covers all special cases
    // critical path: fast allocation
    return result;
}
alloc_slow(num_bytes)  // all special cases handled here
```

5. **Remove overhead only where measured.** Inline/collapse a layer when profiling shows dispatch, allocation, copying, or indirection matters and the layer hides no valuable policy. Most pass-through call overhead is optimized away or irrelevant; deleting a useful boundary for speculative speed is not a performance refactoring.

### Complexity budget

- Faster design adds small complexity hidden behind interfaces → may be worthwhile.
- Faster design adds large implementation complexity or complicates interfaces → start simple, optimize later.
- Exception: with **clear evidence** performance matters in this spot, implement the faster design immediately.

### Performance stop condition

Re-run the same workload and correctness checks. Compare distributions/percentiles and resource use, not one lucky duration. Verify output ordering, numerical results, error behavior, cancellation, and determinism under concurrency. If the improvement is inside noise or misses the stated target, **back it out** unless the structural change is independently simpler.

## Error and determinism guardrails

A structural edit can silently change the API by replacing a typed error with a string, changing which error wins when several inputs are invalid, dropping a source chain, converting recoverable failure to panic, or changing retry/cancellation behavior. Characterize these before moving boundaries. Changing the error contract is a separate feature/API migration, not a refactoring step.

Determinism includes more than equal values: stable ordering, tie-breaking, serialization, generated IDs, seeded randomness, and reproducible parallel reductions may be observable. Replacing an ordered map with a hash map, a loop with unordered parallel work, or a stable sort with an unstable one requires explicit evidence that order is not part of the contract. If deterministic output is required, make the ordering/key/seed explicit and test repeated runs.

## Reference loading

Load `references/reference.md` for deep catalog lookup: the full 24-smell list with signs, When/mechanics-in-brief for the highest-frequency refactorings, and the Rust-specific section (ownership, `Result`-based error handling, traits). Do **not** load it for quick smell diagnosis (the matrix above suffices) or performance-only questions (the section above suffices).
