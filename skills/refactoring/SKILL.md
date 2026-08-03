---
name: refactoring
description: Use when changing code structure without changing behavior — identifying code smells, choosing Fowler refactorings, planning small safe steps with compile+test between them, extracting or moving functions, simplifying conditionals, removing duplication, improving names — or when refactoring for performance (measure first, design the ideal critical path, remove special cases from hot paths). Covers Rust ownership, traits, and Result-based error handling — not for general Rust debugging or borrow-checker troubleshooting. Do not use for adding features, greenfield design, or architecture decomposition unless refactoring mechanics are requested.
---

# Refactoring

Merges Fowler's *Refactoring* (2nd ed.) with Ousterhout's performance chapter. One discipline: small behavior-preserving steps; performance work adds a measurement stop-condition.

## Core discipline

**Refactoring changes internal structure without changing external behavior.** It is not bug-fixing and not feature work — it makes code easier to understand and cheaper to modify.

- **Two Hats:** never add functionality and refactor in the same step. Switch hats consciously.
- **Small steps:** one refactoring at a time; compile and test after every change; commit at each green state so any step can be reverted cheaply.
- **Rule of Three:** first time just do it; second time wince at the duplication but do it anyway; third time refactor.
- **Name after intent:** functions named after what they do, not how. If a block needs a comment to say what it does, extract it into a function named after that comment.
- **When to refactor:** preparatory (before a feature, refactor to make the addition easy), comprehension (while reading code, to clarify it), litter-pickup (fix what you pass). Dedicated debt-paydown sessions are the last resort, not the default. Good internal design keeps feature velocity constant; without it each feature gets harder.

## Response structure

When advising on a refactoring:

1. **Smell** — what makes the code hard to change or understand.
2. **Target refactoring(s)** — named patterns from the matrix below.
3. **Safe sequence** — small steps, compile+test between them.
4. **Language constraints** — e.g. Rust ownership/borrowing, traits, `Result` types that shape the mechanics.
5. **Stop condition** — how you know behavior stayed the same and the design improved.

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

- **Before:** tests pass; code compiles; you understand what the code does; you have a clear goal. Do not refactor code you cannot verify.
- **During:** small steps; compile after each change; test frequently; commit at every green state.
- **After (done when):** all tests still pass, no functionality changed, code is measurably clearer. Then reassess whether further refactoring is still pulling its weight.
- **Back out:** if a step breaks and isn't fixed within minutes, revert to the last green commit and re-plan — never debug in the middle of a refactoring.

## Refactoring for performance

Same small-steps discipline, plus one extra stop condition: **measurement**. Clean design and high performance are compatible — simpler code usually runs faster (fewer calls, fewer branches, less redundant work).

Both extremes fail: optimizing everything adds complexity that often doesn't help; ignoring performance entirely is death by a thousand cuts — a system 5–10x slower than needed and hard to fix later. The sweet spot: choose design alternatives that are naturally efficient yet clean.

**Cheap choices when equally simple:** hash table over ordered map for lookups; inline storage over pointer indirection (fewer allocations, better cache); avoid unnecessary memory copies; sequential access patterns.

**Know what's expensive:**

| Operation | Cost |
|-----------|------|
| Network roundtrip (datacenter / wide-area) | 10–50 µs / 10–100 ms |
| Disk I/O (HDD / SSD) | 5–10 ms / 10–100 µs |
| Memory allocation | malloc + GC overhead, significant |
| Cache miss | hundreds of instructions; often decides overall performance |

Use micro-benchmarks to measure operation costs in isolation and accumulate them over time.

### Process

1. **Measure — never guess.** Intuitions about performance are unreliable, even for experienced developers. Profile the existing behavior, establish a baseline, find where time is actually spent.
2. **Design the ideal critical path.** Identify the minimum code for the common case; ignore the existing structure entirely; imagine a single method using the most convenient data structures. That "ideal" will clash with the current structure — treat it as the target and redesign toward it while keeping the code clean.
3. **Remove special cases from the hot path.** One guard check at the start detects *all* special cases; special-case handling branches off the critical path, where simplicity matters more than speed.

```rust
if available_append_bytes >= num_bytes {  // single check covers all special cases
    // critical path: fast allocation
    return result;
}
alloc_slow(num_bytes)  // all special cases handled here
```

4. **Eliminate shallow layers.** Pass-through methods add call overhead on every operation — collapse them into one deep method.

### Complexity budget

- Faster design adds small complexity hidden behind interfaces → may be worthwhile.
- Faster design adds large implementation complexity or complicates interfaces → start simple, optimize later.
- Exception: with **clear evidence** performance matters in this spot, implement the faster design immediately.

### Performance stop condition

Re-measure after the change. If it doesn't measurably help, **back it out** — never keep complexity without proven benefit.

## Reference loading

Load `references/reference.md` for deep catalog lookup: the full 24-smell list with signs, When/mechanics-in-brief for the highest-frequency refactorings, and the Rust-specific section (ownership, `Result`-based error handling, traits). Do **not** load it for quick smell diagnosis (the matrix above suffices) or performance-only questions (the section above suffices).
