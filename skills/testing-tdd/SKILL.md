---
name: testing-tdd
description: Test-driven development cycle, patterns, and test design guidance distilled from Beck (TDD by Example), Freeman & Pryce (GOOS), Khorikov, Meszaros (xUnit Test Patterns), and Siddiqui. Use when writing tests first, deciding what to test next, getting a failing test to pass, choosing test doubles or a mocking strategy, structuring fixtures and test data, diagnosing brittle/slow/flaky/hard-to-read tests, using test difficulty as design feedback, or designing objects for testability, or adding tests to existing untested/legacy code. Do not use for general production refactoring unrelated to tests, or for performance, load, or penetration testing.
---

# Testing & TDD

Two rules generate all of TDD:

1. Write new code only when an automated test has failed.
2. Eliminate duplication.

## 1. The Cycle

**Red → Green → Refactor**

- **Red** — Write a small test that fails. Compilation failures count as red. Start from the assertion and work backward to the setup.
- **Green** — Make it pass as fast as possible, committing whatever sins are necessary (hard-coding is fine). No code for future features.
- **Refactor** — Eliminate the duplication created getting to green, in both test and production code. Fix any test broken by refactoring before moving on. No new features.

**Commit at green.** A passing suite is always a safe commit point. Never be more than one change away from green; never commit failing unit tests.

**Step size (gears):** You should be able to take steps of any size. Surprised by red bars → downshift to smaller steps. Confident and flowing → shift up. Manual refactoring = many tiny steps; automated refactoring allows bigger leaps. When truly stuck: write a simpler test, or throw the code away and do over.

## 2. Starting

### Test / Feature List
Before coding, list every test you know you'll need: examples of each operation, null versions of operations that don't exist yet, refactorings you foresee. Keep it on paper or a checklist, not in code. Implement one at a time; add new items (edge cases, error cases, refactors) as they emerge; cross off completed ones. Simple features first — each builds on the previous, and the order shapes the design. If a feature requires several new abstractions at once, insert a simpler precursor first. Tangential idea mid-test → add it to the list, stay on track.

### Walking Skeleton
First build the thinnest end-to-end slice: automated build, deploy to a production-like environment, one trivial behavior through the whole stack. The functionality is deliberately uninteresting — the focus is infrastructure and deployment risk. Only then write the first real acceptance test. Brownfield: automate build/deploy first, wrap existing paths in end-to-end tests, then start TDD. Projects that defer end-to-end testing get discarded for undeployability; front-load the stress.

### The Double Feedback Loop

```
OUTER (acceptance test for a feature):
  Write failing acceptance test
    INNER (unit tests):
      Red → Green → Refactor
    Repeat until the acceptance test passes
  Move acceptance test to the regression suite
```

Outer loop = demonstrable progress; inner loop = developer support and design feedback. In-progress acceptance tests are excluded from the build until they pass. Write acceptance tests in domain terminology (no table names, no HTTP verbs) so they survive infrastructure changes.

### Per-Feature Sequence
1. **Simplest success case first** — not a degenerate/failure case; those don't validate the idea. Park failure cases on the list.
2. **Write the test you'd want to read** — ignore compile errors while drafting; build supporting code until the test fails the *expected* way with a clear message. Only then write production code.
3. **Watch it fail** — check the diagnostics before making it pass. An unexpected failure means you misunderstood something; fix that first. The full step is Fail → **Report** → Pass → Refactor.
4. **Develop from inputs to outputs** — start at the system boundary handling external events, work inward to the domain model, then outward to visible responses. Avoids integration surprises from building the domain model in isolation.

### Choosing the Next Test
- **One Step Test** — pick a test that teaches you something and you can confidently implement; grow from known to unknown.
- **Starter Test** — begin with a variant that does nothing (empty input, identity operation) to get the first green bar fast.
- **Assert First** — write the assertion, then work backward to the setup it needs.
- **Regression Test** — a bug report starts as the smallest failing test that reproduces it; then fix.
- **Learning Test** — before first use of a third-party API, test that it works as you expect. Re-run on upgrades.
- **Child Test** — test too big? Delete/x-out it, write a smaller test for the broken part, get it green, reintroduce the parent.
- **Broken Test / Clean Check-in** — end a solo session with one failing test as a bookmark, left uncommitted; end a team session all green. Never comment out tests to make the suite pass.

### Error Handling via Tests
Put error cases on the list like any feature. Before implementing, write the error wish list: signal failure explicitly (never silently produce wrong results); report **all** problems, not just the first; return no valid result alongside an error. Then test-drive the idiomatic mechanism for your language (Go `(value, error)` tuples, JS/Python exceptions, Rust `Result<T, E>`) — idioms in `references/reference.md`.

## 3. Getting to Green

| Strategy | When | How |
|----------|------|-----|
| **Fake It** | Default starting move; when unsure | Return a constant, then replace constants with variables. The duplication between test (`assert 10`) and code (`return 10`) is the signal to generalize: `10` is really `5 * 2`; name the parts; `return amount * multiplier`. Removing the duplication reveals the abstraction. |
| **Triangulate** | Really unsure of the correct abstraction | Abstract only with two or more concrete examples: `plus(3,1)==4` can be faked; `plus(3,4)==7` forces the real implementation. Most conservative strategy. |
| **Obvious Implementation** | You know exactly what to type | Just type it. Track surprise red bars — cycles of "type obvious → red → fix → red" mean downshift to Fake It. |
| **One to Many** | Operations on collections | Implement for a single value, add the collection parameter alongside, switch the implementation over, remove the single-value parameter, then enrich the test. |

## 4. Writing Tests

### Canonical Structure (AAA / Four-Phase)
Every test: **Arrange/Setup → Act/Exercise → Assert/Verify → Teardown** (usually implicit). One exercise phase, one verify phase — alternating sequences signal multiple tests crammed into one. For mock-based tests, expectations are declared before Act and verified after. Write tests backward: Name → Act → Assert → Arrange. Single-line Act sections signal good encapsulation; multi-line Act signals a leaking API.

### Naming
Name tests as behavior sentences with the target as implicit subject — no method names:

```
holdsItemsInTheOrderTheyWereAdded()
notifiesListenersThatServerIsUnavailableWhenCannotConnect()
```

Include **expected result + action + scenario**. (Underscore variant: `test_invoice_add_line_item_updates_total`.) `testBidAccepted()` tells you what it does, not what it's for — unit-test *behavior*, not methods.

### Test Data
- Use the simplest data that makes the test readable; never the same constant for two meanings (`plus(3, 4)` not `plus(2, 2)`).
- **Hardcode expected values**, pre-calculated independently. Recomputing the expected result with the production algorithm is a tautology test. Exception: make the input→output relationship visible inline when it documents the rule: `assertEquals(100 / 2 * (1 - 0.015), result)`.
- Name literals by role: `UNUSED_CHAT = null`, `INVALID_ID = 666`. Use obviously canned values (negative numbers, `MAX_VALUE`, self-describing strings) that stand out from production data.

### One Coherent Feature per Test
Not one *assertion* — one behavior. A handful of related assertions is fine; unrelated behaviors are not. Each condition covered by exactly one test.

### Helpers Reveal Intent
Extract common setup, assertions, and events into well-named helpers; when support code grows substantial, delegate to subordinate helper objects (an `ApplicationRunner`, a fake server) so tests read in domain terms. Rename helpers toward *what*, not *how*: `havingReceived(anOrder().withLine("Hat", 1))` beats `sendAndProcess(...)`.

### Let Exceptions Propagate
Don't catch exceptions you aren't asserting about — add `throws` to the signature and state what should happen. No conditional logic (if/loops) in tests; replace guards with assertions that fail fast.

### Boundaries
Test code depends on production code, never the reverse; keep them in separate files/modules once you have a couple of green tests. Production code must never behave differently under test — no `if testing` hooks; use injected doubles instead. Tests are isolated: no shared mutable state, order-independent; one broken test = one problem.

## 5. Test Doubles

| Double | Purpose | Returns values? | Verified? |
|--------|---------|-----------------|-----------|
| **Dummy** | Placeholder passed but never used | No | No |
| **Stub** | Injects indirect inputs (values, exceptions) into the SUT | Yes | No |
| **Spy** | Stub + records calls; test asserts afterward | Yes | Yes (after exercise) |
| **Mock** | Pre-loaded with expectations; self-verifies during exercise, fails on unexpected call | Yes | Yes (during exercise) |
| **Fake** | Lightweight working implementation (in-memory DB) | Yes | No |

**Decision flow:** Fill a parameter the SUT ignores → Dummy. Control what the SUT receives → Stub. Verify the SUT called a dependency, assertions in the test → Spy. Verify calls, double self-checks → Mock. Working alternative to a slow/unavailable resource → Fake. Use the real thing when a double is more effort than the real code; doubles can mask side effects.

### When to Mock

```
Is the dependency out-of-process?
  No  → use the real thing. No mock.
  Yes → managed (only your app accesses it, e.g. your database)?
          Yes → use a real instance. No mock.
          No  → unmanaged (message bus, SMTP, third-party API). Mock it.
```

Mocking rules:
1. **Mock at the system edge** — the last type before the message leaves your process. Maximizes code exercised and decouples from internals.
2. **Mock only types you own** — wrap third-party libraries behind your own adapter and mock that.
3. **Mocks are for integration tests** — domain-model tests use no mocks because domain classes have no out-of-process dependencies.
4. Verify **exact call count and no other calls**.
5. Prefer **spies** (handwritten) over framework mocks at the boundary — they keep assertion logic in the test and enable fluent assertions.

**Prefer state verification** (stub + assert on SUT state/output) over behavior verification (mocks). Output-based tests (pure return values) are best — most refactor-resistant; state-based is next; communication-based is last resort, for when the SUT has no observable output. Use mocks for **commands** (side effects); stubs for **queries** (data-returning calls) — assert against the final output, never against stub interactions.

## 6. Fixtures & Test Data

| Strategy | Setup | Speed | Independence |
|----------|-------|-------|--------------|
| **Transient Fresh** (default) | Each test builds its own in-memory fixture | Fast | Full |
| **Persistent Fresh** | Each test builds fixture in DB/filesystem; explicit teardown | Slower | Full |
| **Shared** | One fixture reused across tests | Fastest per-test | Risky |

Fresh Fixture is the default — in unit tests, replace slow dependencies with Fakes (in-memory hash map ≈ 50× faster than a real DB; integration tests use a real database instead — see the Integration Test Recipe). Shared Fixture is a last resort: it causes Interacting Tests, Test Run Wars, and Erratic Tests. If you must share, make it **immutable** and layer per-test fresh data on top. Keep fixtures **minimal** — only what the behavior under test needs.

### Creation Methods = Test Data Builders
One merged pattern for complex construction: factory methods/builders with safe defaults for everything, so a test mentions only values relevant to it. Constructor changes touch the builder, not every test. Share a builder and vary only the difference via a `but()`-style copy; full builder implementations and variants are in `references/reference.md` (Part V).

Pass builders (not built objects) to helper methods to keep signatures stable; pass builders into other builders to eliminate `.build()` noise. Setup styles: in-line for simple unique fixtures, delegated (creation methods) for shared ones, implicit (setUp/beforeEach) only when every test in the class shares the fixture — group those as Testcase Class per Fixture (class name describes the state, method names the behavior).

## 7. Diagnostics & Flexibility

**Tests exist to fail informatively.** If a failure message doesn't point at the problem, fix the test before writing production code.

- **Small focused tests** — the name alone localizes most failures.
- **Assertion messages** — `assertEquals("outstanding balance", 16301, actual)`; cures assertion roulette.
- **Self-describing values** — `namedDate(1000, "startDate")` fails with `Expected: <startDate> got: <endDate>`.
- **Tracer objects** — dummies whose only job is describing their role in failure messages.
- Prefer matchers/assertions that show *what didn't match*, not just that it didn't.

**Test observable behavior, not implementation details.** A method is observable behavior if it exposes an operation or state that helps the client achieve a goal; everything else is implementation detail. Rule of thumb: if the client needs more than one call to achieve a single goal, the API is leaking details. Test through the public protocol only — wanting white-box access is a design problem. Never assert on private state or restructure production code with test hooks.

**Specify precisely what should happen, and no more:**
- Test for **information, not representation** — `NO_CUSTOMER_FOUND = Maybe.nothing()` beats `returnValue(null)`; when the representation changes, one constant changes.
- **Precise assertions** — assert only what the scenario is about (one field, key substrings, approximate bounds), not whole-object equality or exact formats.
- **Don't constrain ordering** by default; constrain only when order is part of the protocol. Overconstrained order = brittle tests.
- **Allow queries; expect commands** — queries get lenient stubs, side-effecting commands get strict expectations. Decouples tests from caching and algorithm changes.

## 8. What Makes a Good Test

Every test scores on four pillars. Multiply them — a zero anywhere makes the test worthless.

| Pillar | Measures | Maximize by |
|--------|----------|-------------|
| **Regression protection** | Can it find bugs? | Exercise more code, especially complex/domain-significant code |
| **Refactoring resistance** | Stays green when behavior is preserved? | Verify observable behavior, not implementation details |
| **Fast feedback** | How quickly it runs | Minimize out-of-process dependencies |
| **Maintainability** | Easy to read and run | Keep tests short; reduce setup complexity |

Refactoring resistance is **binary and non-negotiable** — false positives destroy trust in the suite and halt refactoring. Pillars 1–3 can't all be maximized, so the real trade-off is regression protection vs. speed.

### Test Pyramid

| Layer | Count | Optimizes for | Mock strategy |
|-------|-------|---------------|---------------|
| Unit | Many | Fast feedback, edge cases in domain model | No mocks |
| Integration | Some | Regression protection; longest happy path per scenario + edge cases unit tests can't reach | Mock unmanaged deps only; real managed deps |
| End-to-end | Few | Full-system confidence | No mocks |

Simple CRUD apps flatten the pyramid to a rectangle: roughly equal unit and integration tests, few or no end-to-end. Tune by feedback: fiddly logic → more unit tests (or simplify it); unhandled exceptions → more integration tests.

### Test Suites

| Suite | Purpose | Speed | Must always pass? |
|-------|---------|-------|-------------------|
| Unit | Developer support, design feedback | Fast | Yes |
| Integration | Verify abstractions over third-party code | Medium | Yes |
| Regression acceptance | Catch regressions in finished features | Slow | Yes |
| In-progress acceptance | Track work toward a new feature | Slow | No — excluded from the build |

Keep slow suites out of the fast unit-test loop.

### Four Types of Code

Complexity/domain significance vs. number of collaborators:

- **Domain model & algorithms** (complex, few collaborators) — unit-test thoroughly.
- **Trivial code** (simple, few collaborators) — skip testing.
- **Controllers** (simple, many collaborators) — brief integration tests.
- **Overcomplicated** (complex, many collaborators) — split into domain + controller, then test.

The more important the code, the fewer collaborators it should have. Test conditionals, loops, operations, polymorphism — but only code you write.

### Integration Test Recipe
1. Pick the **longest happy path** — the one touching all out-of-process dependencies — per business scenario; add edge cases unit tests can't reach (skip ones covered by Fail Fast preconditions that crash immediately).
2. Use a **real database** (not an in-memory substitute — those mask behavior differences); insert data, run the operation, query and verify final state independently.
3. Mock only unmanaged dependencies, at the system edge; verify message content + call count + no other calls.
4. Clear data at the **start** of each test; run DB tests sequentially; each developer gets their own database instance.
5. Inject managed dependencies as concrete classes — interfaces exist only where mocking is needed (unmanaged deps).
6. Use factory helpers (`create_user(...)`) for arrange sections with sensible defaults.

## 9. Listening to the Tests

When code is hard to test, the design needs improving — the same structure that resists testing resists change. Don't ask "how do I test this?" Ask "**why** is this difficult to test?"

| Test signal | Design problem → fix |
|-------------|----------------------|
| Need magic (bytecode tricks, mocking statics) to replace an object | Hidden dependency → introduce an explicit injectable one. `new Date()` → `clock.now()`. Push further: maybe the object needs a `SameDayChecker`, not dates. Tools that bypass dependency management waste design feedback. |
| Logging mixed with domain logic | Two concerns interleaved → extract a notification interface you own (`support.notifyFiltering(...)`); mock the interface, test objects not formatted strings. Support logging (ops audience) is part of the UI — test-drive it; diagnostic logging (debug/trace) is scaffolding — don't test it. |
| Mocking a concrete class | Implicit role → extract an interface that names it. `CdPlayer` mocked for 2 of 5 methods is really a `ScheduledDevice`. Naming the relationship makes it findable and reusable. Exception: legacy/third-party — wrap in a veneer, override only visible methods. |
| Mocking a value object | Just create instances (builder if complex). Immutable, or you can't name an implementation (`VideoImpl`?) → it's a value. |
| Bloated constructor | Three diagnoses — see below. |
| Too many expectations | Can't tell what matters → separate stubs (queries, allowances) from expectations (commands, assertions on side effects). If the test navigates `getX().getY().doZ()`, Tell Don't Ask is violated — tell the nearest object to do the work. |
| Long setup code (100+ lines) | Objects too big → split them. |
| Setup duplication across tests | Too many tightly intertwined objects. |
| Long-running / fragile tests | Hidden coupling; can't test in isolation — a design problem, not a test problem. |

### Bloated Constructor: Three Diagnoses

1. **Implicit structure** — some arguments are always used together → package them.
2. **Confused object** — the test suite splits into unrelated slices sharing nothing → break the class into one object per responsibility.
3. **Not all args are dependencies** — only some fields are truly required → constructor takes only real dependencies; adjustments get defaults, notifications get null objects.

Worked examples are in `references/reference.md` (Bloated Constructor — Worked Example).

## 10. Design via Tests

### Values vs. Objects
| | Values | Objects |
|---|--------|---------|
| Identity | None — equal values interchangeable | Distinct even with same state |
| Mutability | Immutable; operations return new instances | Mutable state |
| Testing | **Create** instances, assert results | **Mock** peers, verify interactions |

Create domain value types even for simple wrappers — they give behavior a home and prevent unit confusion. Introduce them by **breaking out** (extract coherent behavior from a complex object), **budding off** (placeholder type wrapping one field, filled in as code grows), or **bundling up** (group values always used together).

### Tell, Don't Ask
Describe what you want in terms of the role the neighbor plays; let it decide how. `master.allowSavingOfCustomisations()` beats a train wreck through getters. Queries are fine for values and collections — but ask meaningful questions: `carriage.hasSeatsAvailableWithin(barrier)`, not `carriage.getSeats().getPercentReserved() < barrier`. If knowledge leaks between components, make the dependency explicit and passed in.

### Object Peer Stereotypes
Dependencies (required services) go through the constructor, notifications (fire-and-forget listeners) default to a null object, and adjustments (strategy parts) get sensible defaults — constructor rule: only true dependencies are required at construction (bloated-constructor diagnosis 3). Detail in `references/reference.md` (Part XVII).

### Context Independence
An object has no built-in knowledge of the system it runs in — everything it needs is passed in; you should be able to describe what it does without mentioning the system.

### One Architecture for Testability
Ports & adapters, Humble Object, and functional core/mutable shell are the same move: **extract logic from hard-to-test coupling into a testable core; leave a thin shell that glues the core to the world.**

```
[External system] ↔ [Adapter / shell] ↔ [Port interface] ↔ [Domain core]
```

- Ports are defined in domain vocabulary; adapters are thin translation only, no business logic.
- Functional core = pure functions returning decisions (e.g. a `FileUpdate`, domain events); the shell gathers inputs, calls the core, applies the decisions as side effects. This maximizes output-based tests.
- The shell/controller keeps no branching: use CanExecute/Execute (`can_do()` guard + `do()` precondition) and domain events (core records what happened; controller dispatches) to push decision-making into the core.
- The API of a composite is no more complicated than that of its components: `moneyEditor.setValue(money)`, not per-field setters.

### Interface Discovery
Pull interfaces into existence from client needs so they name narrow roles: in a test ask "if this worked, who would know?", and when the answer isn't the target object, introduce the collaborator, mock it, and follow the chain of discoveries. Detail in `references/reference.md` (Part XVII).

### Dependency Injection
Separate creation from use: constructor injection for required dependencies, setter for optional, method parameter for single-method use — pass dependencies in rather than `new`-ing them inside.

### Domain Discovery
When responsibilities accumulate in one entity (e.g. a method needs data that feels foreign to it), extract and name a new entity, and fix leaky abstractions by adding behavior to the entity that owns the data.

### Third-Party Integration
Keep a thin adapter layer between your domain and external APIs: unit tests mock the port interface you own, integration tests verify the adapter against the real library, and learning tests make upgrades announce breakage. Detail in `references/reference.md` (Part XVII).

### Deleting Tests
Keep a test if it provides **confidence** (reduces uncertainty) or **communication** (explains a scenario). Before deleting, three checks: Would coverage decrease? Does it verify a significant edge case? Does it provide unique documentation? Three "no"s → delete safely.

## Red Flags Checklist

- [ ] Test is longer than the production code it tests
- [ ] Test name doesn't describe a behavior (names a method instead)
- [ ] One test exercises multiple unrelated features
- [ ] Test fails for reasons unrelated to what it tests
- [ ] Constructor in test setup has more than 3–4 arguments
- [ ] More expectations than assertions in a mock-based test
- [ ] Need magic (bytecode tricks, static mocking) to substitute a dependency
- [ ] Logging code interleaved with domain logic
- [ ] Mocking a concrete class where an interface names the role
- [ ] Mocking a value object instead of creating it
- [ ] Literal `null`, `0`, or `""` used without naming the concept
- [ ] Conditional logic (`if`/loops) inside a test
- [ ] Expected value recomputed with the production algorithm

## Reference

Load `references/reference.md` when you need: the full pattern catalogs (red-bar/green-bar/testing patterns, xUnit smell catalog, fixture setup/teardown/database patterns, verification and organization patterns), per-language error-handling idioms (Go tuples, JS/Python exceptions, Rust `Result`), Khorikov pillar/mock/architecture deep-dives, TDD refactoring patterns, or test-suite metrics. Do not load it for quick mock-vs-stub, fixture, naming, or cycle questions — this file covers those.
