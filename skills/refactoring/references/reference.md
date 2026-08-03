# Refactoring Catalog (Condensed)

Condensed from Fowler's *Refactoring* (2nd ed.), adapted for Rust. Load only for deep lookup as directed by `../SKILL.md`; the SKILL.md matrix covers quick diagnosis.

## Code smells (all 24)

Heuristics, not rules.

1. **Mysterious Name** — you must read the implementation to know what something does. → Rename Function/Variable/Field.
2. **Duplicated Code** — same structure in several places; every fix needs parallel edits. → Extract Function, Slide Statements, Pull Up Method.
3. **Long Function** — mixed abstraction levels, many locals, comments marking sections. → Extract Function, Replace Temp with Query, Decompose Conditional, Replace Loop with Pipeline.
4. **Long Parameter List** — >3–4 params, params that always travel together, behavior-switching flags. → Introduce Parameter Object, Preserve Whole Object, Replace Parameter with Query, Remove Flag Argument.
5. **Global Data** — mutable from anywhere (`static mut`, singletons). → Encapsulate Variable. Rust: pass config explicitly; `OnceCell`/`Lazy` only for truly global *immutable* data.
6. **Mutable Data** — shared state changed from many places. → Encapsulate Variable, Split Variable, Separate Query from Modifier, Replace Derived Variable with Query. Rust: ownership helps, but interior mutability (`RefCell`, `Mutex`) reopens the problem.
7. **Divergent Change** — one module changed for several unrelated reasons. → Split Phase, Move Function, Extract Class (Extract Module in Rust).
8. **Shotgun Surgery** — one change forces edits in many places; easy to miss one. → Move Function/Field, Combine Functions into Class, Inline then re-extract properly.
9. **Feature Envy** — a function uses another module's data more than its own. → Move Function (Extract Function first if only part envies).
10. **Data Clumps** — the same 3–4 fields always appear together; deleting one makes the rest meaningless. → Extract Class, Introduce Parameter Object, Preserve Whole Object.
11. **Primitive Obsession** — strings/numbers standing in for domain concepts (units, paths, money); range checks repeated everywhere. → Replace Primitive with Object (Rust newtype with a validating constructor), Replace Type Code with Subclasses.
12. **Repeated Switches** — the same match/switch on a type code in many places; adding a variant means edits everywhere. → Replace Conditional with Polymorphism.
13. **Loops** — imperative loops that filter/transform/accumulate where a pipeline reads better. → Replace Loop with Pipeline.
14. **Lazy Element** — a function/struct/module that doesn't earn its existence (pass-through fn, one-field struct). → Inline Function/Class, Collapse Hierarchy.
15. **Speculative Generality** — "might need it someday" abstractions: one-implementation hierarchies, unused params. → Collapse Hierarchy, Inline Function/Class, Remove Dead Code, remove unused params.
16. **Temporary Field** — fields set only in some circumstances; special "unset" values; methods that must be called in order. → Extract Class + Move Function, Introduce Special Case.
17. **Message Chains** — `a.b().c().d()` navigation couples callers to object structure. → Hide Delegate, Extract + Move Function.
18. **Middle Man** — a type that delegates almost everything. → Remove Middle Man, Inline Function.
19. **Insider Trading** — modules that know too much about each other's internals; bidirectional dependencies. → Move Function/Field, Hide Delegate.
20. **Large Class** — too many fields/methods; field subsets used separately; common prefixes hint at groupings. → Extract Class, Extract Superclass, Replace Type Code with Subclasses.
21. **Alternative Classes with Different Interfaces** — interchangeable classes whose method names don't match. → Change Function Declaration + Move Function until protocols match, Extract Superclass.
22. **Data Class** — fields and accessors, no behavior; all logic lives elsewhere (fine for DTOs). → Encapsulate Record, Remove Setting Method, Move Function to bring behavior home.
23. **Refused Bequest** — subclass ignores inherited behavior or overrides it to nothing. → Push Down Method/Field, Replace Subclass/Superclass with Delegate.
24. **Comments** — comments as deodorant explaining *what* bad code does. → Extract Function named after the comment, Rename, Introduce Assertion. Keep *why* comments: decisions, domain context, non-obvious consequences.

## Highest-frequency refactorings

### Extract Function (inverse: Inline Function)
**When:** a fragment belongs together — especially a block you'd comment. The driver is semantic distance between *what* and *how*, not length.
**Mechanics:** create a function named after intent; copy the code; pass needed locals as parameters; compile; replace the original with a call; test; reuse it for similar code.
**Rust:** watch ownership — pass references or clone; return `Result` if the fragment can fail.

### Inline Function
**When:** the body is as clear as the name, or you need to collapse a group of badly factored functions before re-extracting.
**Mechanics:** skip polymorphic methods; replace each call with the body, testing after each; delete the function.

### Extract Variable / Inline Variable
**When (extract):** a complex expression needs a name. Ensure no side effects; bind an immutable variable; replace occurrences; test.
**When (inline):** the name says no more than the expression, or the variable blocks another refactoring. Replace references one at a time, testing each.

### Change Function Declaration (rename, add/remove parameter)
**When:** the name fails to state intent, or parameters need adjusting.
**Mechanics (simple):** change the declaration, update all callers, test.
**Mechanics (migration, for widely-used functions):** extract the body into a new function with the desired signature under a temporary name; test; inline the old function into callers one at a time; rename.

### Rename Variable / Rename Field
**When:** the name doesn't communicate purpose. Encapsulate first if widely used; change every reference; test.

### Encapsulate Variable / Encapsulate Record
**When:** data is accessed from many places and you need to control access. Provide accessors; replace references one at a time, testing each; then restrict visibility.
**Rust:** module privacy does the restricting; collection getters return iterators or read-only views plus explicit add/remove methods, never a mutable handle.

### Introduce Parameter Object
**When:** a group of parameters travels together. Create a struct; add it as a parameter (Change Function Declaration); switch callers; delete old parameters one at a time, testing.

```rust
// Before
fn amount_invoiced(start: Date, end: Date) -> Money
// After
struct DateRange { start: Date, end: Date }
fn amount_invoiced(range: &DateRange) -> Money
```

### Extract Class / Inline Class (Extract Module in Rust)
**When:** a type carries two separable concepts (field subsets, prefix clusters). Create the new type; move fields and functions one at a time; test each move. Apply the inverse when a type no longer earns its existence.

### Move Function
**When:** a function belongs to a different context (Feature Envy, Divergent Change).
**Mechanics:** examine what it uses from its current context; copy to the target and adjust; turn the original into a delegating function; test; then inline the delegate.

### Move Field
**When:** a field is used more by another struct than by its own. Move it with its accessors; test.

### Split Phase
**When:** code does two different things (e.g. parse, then process). Extract the second phase; introduce an intermediate data structure between phases; move parameters onto it; extract the first phase returning it; test.

### Decompose Conditional
**When:** a complex condition or complex branches. Extract the condition and each branch into well-named functions.

### Consolidate Conditional Expression
**When:** several checks lead to the same result. Combine them with `&&`/`||` into one named predicate.

### Replace Nested Conditional with Guard Clauses
**When:** one branch is the normal case and the rest are exceptional.

```rust
// Before: nested if/else pyramid assigning to a result variable
// After
if employee.is_separated { return separated_amount(); }
if employee.is_retired { return retired_amount(); }
normal_pay_amount()
```

### Replace Conditional with Polymorphism
**When:** a switch/match on type — above all the *same* switch repeated in several places. Rust: one trait per behavior set, one impl per variant.

```rust
trait Bird { fn plumage(&self) -> &str; }

struct AfricanSwallow { coconuts: i32 }
impl Bird for AfricanSwallow {
    fn plumage(&self) -> &str { if self.coconuts > 2 { "tired" } else { "average" } }
}
```

### Replace Loop with Pipeline
**When:** a loop filters/transforms/accumulates.

```rust
let names: Vec<_> = people.iter()
    .filter(|p| p.department == "Engineering")
    .map(|p| &p.name)
    .collect();
```

### Remove Dead Code
**When:** code is never executed. Delete it — version control remembers it.

## Rust-specific patterns

### Ownership
- **Extract to Owned Type:** lifetime annotations multiply and fight you → make the struct own its data (`String` instead of `&str`, owned `Token` instead of `Token<'a>`).
- **Replace Clone with Reference:** excessive defensive cloning → borrow instead.
- **Introduce Arc/Rc:** genuine shared ownership is required and cloning is too expensive.
- Extracting code out of a method: pass `&`/`&mut` explicitly and let the borrow checker verify each step.

### Result-based error handling
- **Replace Panic with Result:** recoverable failures must be `Result`, never `unwrap`/panic.

```rust
fn parse(s: &str) -> Result<Config, ConfigError> {
    serde_json::from_str(s).map_err(ConfigError::Parse)
}
```

- **Consolidate Error Types:** unify scattered error types into one enum (`thiserror`, `#[from]` conversions).

```rust
#[derive(Debug, thiserror::Error)]
enum ProcessError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),
}
```

### Traits
- **Extract Trait:** you need polymorphism or decoupling → define a minimal trait; accept `&impl Trait` at call sites.

```rust
trait Meshable { fn triangles(&self) -> &[Triangle]; }
fn slice(mesh: &impl Meshable) -> Layers
```

- **Replace Dynamic with Static Dispatch:** `dyn Trait` overhead isn't needed → generic parameter or `impl Trait`.
- Rust's Replace Conditional with Polymorphism = trait + impls per variant (see above).

## Remaining catalog (lower frequency)

One-liners so every name stays searchable; apply the same small-steps mechanics.

- **Combine Functions into Class / into Transform** — functions operating on the same data → methods; repeated derivations → a transform producing an enriched copy.
- **Replace Primitive with Object** — a primitive carrying domain meaning → newtype with validation.
- **Replace Temp with Query** — temp holding an expression → a method computing it.
- **Replace Derived Variable with Query** — a stored value computable from other data → compute on demand.
- **Split Variable** — a variable assigned twice (not loop counters/accumulators) → two well-named immutables.
- **Separate Query from Modifier** — a function that returns a value *and* mutates → split it in two.
- **Remove Flag Argument** — a boolean param switching logic → two explicitly named functions.
- **Parameterize Function** — near-identical functions differing by one value → one function taking that value.
- **Preserve Whole Object** — passing several values pulled from one object → pass the object itself.
- **Replace Parameter with Query / Replace Query with Parameter** — derive inside vs inject; pick whichever reduces coupling.
- **Remove Setting Method** — a field set only at construction → delete the setter.
- **Replace Constructor with Factory Function** — need named construction variants → `Employee::create_engineer(name)`.
- **Replace Function with Command / inverse** — a complex function needing helper structure → struct with `execute()`; collapse back when it becomes trivial.
- **Hide Delegate / Remove Middle Man** — clients navigating through an object → add a delegating method; remove it when delegation becomes noise.
- **Move Statements into Function / to Callers** — statements always adjacent to a call → move inside; caller-specific behavior → move out.
- **Replace Inline Code with Function Call** — inline code duplicates an existing well-named function → call it.
- **Slide Statements** — related code should be adjacent; enables extraction.
- **Split Loop** — a loop doing two things → two loops (or two pipelines).
- **Introduce Special Case** — repeated identical checks for a special value → a special-case object (e.g. `Customer::unknown()`).
- **Introduce Assertion** — code assumes something about state → `assert!`/`debug_assert!`.
- **Change Reference to Value / Value to Reference** — small immutable object → value semantics; genuinely shared mutable state → reference (`Arc`).
- **Substitute Algorithm** — swap in a clearly better algorithm for the same job.
- **Inheritance moves** — Pull Up/Push Down Method/Field, Extract Superclass, Collapse Hierarchy, Replace Type Code with Subclasses, Remove Subclass, Replace Subclass/Superclass with Delegate. In Rust these map to trait + impl restructuring and composition over inheritance.
