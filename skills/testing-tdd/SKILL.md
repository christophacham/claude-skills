---
name: testing-tdd
description: Test-driven development cycle, patterns, and test design guidance distilled from Beck (TDD by Example), Freeman & Pryce (GOOS), Khorikov, Meszaros (xUnit Test Patterns), and Siddiqui. Use when writing tests first, deciding what to test next, getting a failing test to pass, choosing test doubles or a mocking strategy, structuring fixtures and test data, diagnosing brittle/slow/flaky/hard-to-read tests, using test difficulty as design feedback, or designing objects for testability, or adding tests to existing untested/legacy code. Do not use for general production refactoring unrelated to tests, or for performance, load, or penetration testing.
---

# Testing & TDD

TDD is a feedback discipline, not one universal test topology. Its shared invariant is: get a meaningful failing signal for one behavior, make it pass with the smallest coherent change, then improve structure while the relevant checks stay green.

## 1. Choose a Coherent Approach

- **Example-driven / inside-out:** drive a small domain behavior through its public API, usually with real in-process collaborators. Add examples to discover the rule. Best for algorithms, value objects, and domain policy.
- **Outside-in / GOOS:** start with a failing acceptance slice, then discover collaborating roles from the caller inward. Use owned doubles selectively at boundaries while a walking skeleton keeps deployment/integration real.
- **Characterization-first / brownfield:** capture current observable behavior around the change seam, then refactor toward a place where a new failing test can drive the change. Do not first rewrite untested legacy code into a preferred architecture.

Choose based on the work and state which loop you are running. Do not combine strict mockist isolation, classical state-based tests, and a functional-core architecture as if all were simultaneous mandates; use test difficulty as evidence and hand structural decisions to the appropriate design skill.

### Red → Green → Refactor

- **Red** — Write one test for a missing behavior and run it. It must fail for the expected reason with useful diagnostics. A compile failure can be an intermediate red while designing a typed API, but it is not evidence that runtime behavior is tested.
- **Green** — Make that behavior pass with the smallest coherent implementation. A temporary constant can be useful when it exposes the next example, but do not commit knowingly false behavior or code for future features.
- **Refactor** — Improve test and production structure without adding behavior. Run focused checks after each move and the broader relevant suite at green checkpoints.

**Checkpoint at green.** Keep a recoverable green state with the workflow's allowed mechanism; do not create commits unless asked. Main/shared CI stays green. A local failing test may be an uncommitted bookmark only when no one else consumes that worktree.

**Step size (gears):** Surprised by failures → downshift. Confident and flowing → shift up while each failure remains attributable. When stuck, write a smaller child test, return to the last green checkpoint, or discard the spike and start again.

## 2. Starting

### Test / Feature List
Before coding, list behaviors and examples you already know matter: simplest success, boundaries, failures, and open design questions. Keep the list outside production code. Implement one at a time; add discoveries as they emerge. Choose an order that introduces one concept at a time. Do not predeclare abstractions as test items—the tests may reveal a different design.

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

Outer loop = demonstrable progress; inner loop = fast design feedback. Keep the in-progress acceptance test runnable in the focused development loop, but do not merge a known failing test into shared CI. Write acceptance tests in user/domain terminology; infrastructure contract tests may appropriately mention HTTP or schema details because that is the boundary they verify.

### Per-Feature Sequence
1. **Simplest success case first** — not a degenerate/failure case; those don't validate the idea. Park failure cases on the list.
2. **Write the test you'd want to read** — ignore compile errors while drafting; build supporting code until the test fails the *expected* way with a clear message. Only then write production code.
3. **Watch it fail** — check the diagnostics before making it pass. An unexpected failure means you misunderstood something; fix that first. The full step is Fail → **Report** → Pass → Refactor.
4. **When working outside-in, develop from inputs to outputs** — start at the system boundary, discover the next owned role inward, and keep one real end-to-end slice. In example-driven domain work, start directly at the rule; do not manufacture an adapter path merely to follow the sequence.

### Choosing the Next Test
- **One Step Test** — pick a test that teaches you something and you can confidently implement; grow from known to unknown.
- **Starter Test** — begin with a variant that does nothing (empty input, identity operation) to get the first green bar fast.
- **Assert First** — write the assertion, then work backward to the setup it needs.
- **Regression Test** — a bug report starts as the smallest failing test that reproduces it; then fix.
- **Learning Test** — before first use of a third-party API, test that it works as you expect. Re-run on upgrades.
- **Child Test** — test too big? Delete/x-out it, write a smaller test for the broken part, get it green, reintroduce the parent.
- **Broken Test / Clean Handoff** — a failing local test can bookmark a solo, unshared worktree; prefer a note plus a green checkpoint when automation or another person will consume it. Shared CI stays green. Never comment out a test merely to pass.

### Error Handling via Tests
Put failure cases on the list when they are part of the contract. Test the caller-visible semantics: classification, message/details that are public, partial result, retryability, and which failure wins. Aggregate all validation problems only when the product contract needs batch feedback; fail fast when later work would be unsafe or misleading. Use the language's idiom (Go values plus `error`, JS/Python exceptions where appropriate, Rust `Result<T, E>`) without replacing typed domain failures with strings or panicking on expected input.

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
holds_items_in_the_order_they_were_added
notifies_listeners_when_the_server_cannot_connect
```

Include expected result/action/scenario in the vocabulary customary for the language. Rust test functions use `snake_case` and need not start with `test_`; JavaScript/JVM frameworks follow their own discovery conventions. `test_bid_accepted` is too vague if it does not say under what scenario and with what result—test behavior, not method existence.

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
Test support may depend on production code; production behavior must not branch on a test mode. Follow language conventions for placement: Rust unit tests commonly live in `#[cfg(test)] mod tests` beside private code, while integration tests live under `tests/`; other ecosystems often use separate source roots. Tests are isolated from shared mutable state and order unless order is explicitly the protocol under test.

## 5. Test Doubles

| Double | Purpose | Returns values? | Verified? |
|--------|---------|-----------------|-----------|
| **Dummy** | Placeholder passed but never used | No | No |
| **Stub** | Injects indirect inputs (values, exceptions) into the SUT | Yes | No |
| **Spy** | Stub + records calls; test asserts afterward | Yes | Yes (after exercise) |
| **Mock** | Pre-loaded with expectations; self-verifies during exercise, fails on unexpected call | Yes | Yes (during exercise) |
| **Fake** | Lightweight working implementation (in-memory DB) | Yes | No |

Authors and frameworks use these labels differently; always describe the double's role. Fill an unused parameter → dummy. Supply indirect input/failure → stub. Record an outgoing interaction for later assertion → spy. Predeclare an interaction protocol → mock. Provide a working but simplified implementation → fake.

### Choosing a real collaborator or double

Use real in-process values and collaborators by default. Introduce a double when the real dependency makes the test slow, nondeterministic, destructive, unavailable, or unable to produce a required failure—and place it at a narrow interface you own. A double that mirrors a vendor SDK or reimplements a database can drift more dangerously than the real dependency.

Test level matters:

- **Domain/example tests:** prefer plain values and real domain objects; pure output tests need no doubles.
- **Application-policy tests:** fakes/stubs at earned external capability seams can keep feedback fast; use spies only when the emitted command/message is itself the observable contract.
- **Adapter/contract tests:** exercise the real database, protocol, official emulator, sandbox, or fake server as appropriate; do not “verify” an adapter by mocking the vendor client to repeat your own assumptions.
- **End-to-end tests:** real deployed path, few scenarios, no internal mocks.

Prefer output/state verification over interaction verification. Exact call count/order and “no other calls” are assertions only when duplicates, ordering, billing, or the protocol make them behavior; otherwise they freeze implementation. Use stubs for queries without asserting the stub interaction. For side-effecting commands, verify the externally meaningful message/effect, often through a boundary spy or integration observation.

Mock only owned contracts. If the need is specifically a third-party boundary, hand contract discovery, sandbox testing, pagination/retry semantics, and adapter decisions to `third-party-integration`; do not require a wrapper solely to make mocking possible.

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
| Focused/unit | Many where logic is dense | Fast feedback on behavior and edge cases | Real in-process objects; owned fakes/stubs only at earned external seams |
| Integration/contract | Enough to cover boundaries | Database/protocol/framework fidelity and failure mapping | Real boundary, official emulator/sandbox, or protocol fake server; avoid mocked vendor objects |
| End-to-end | Few, high-value journeys | Deployed-system confidence | Real path; control only genuinely external systems at their owned test boundary |

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

### Integration/Contract Test Recipe
1. Name the boundary and the assumption at risk: schema mapping, transaction behavior, serialization, auth, timeout, retry, pagination, or error translation. Cover a representative success path plus high-risk failures—not one giant test merely to touch everything.
2. Use the production engine/protocol or a faithful official emulator/sandbox when implementation differences matter. A fake database is useful for application tests, not proof that Postgres/SQLite/vendor behavior matches production.
3. Create minimal data, exercise through the real adapter, and verify independently through public state or the boundary. Isolate tests with per-test transactions, unique schemas/databases, containers, or sequential execution according to the system's actual commit/concurrency behavior.
4. Control a truly external system at an owned boundary only when the real sandbox cannot be reliable in CI. Assert message semantics and duplicate/order behavior only as promised by the contract.
5. Keep factories/builders in test support and make cleanup reliable after failure. Run slower boundary suites at a cadence that still catches drift before release.

## 9. Listening to the Tests

When code is hard to test, the design needs improving — the same structure that resists testing resists change. Don't ask "how do I test this?" Ask "**why** is this difficult to test?"

| Test signal | Design problem → fix |
|-------------|----------------------|
| Need magic (bytecode tricks, mocking statics) to replace an object | Hidden dependency → introduce an explicit injectable one. `new Date()` → `clock.now()`. Push further: maybe the object needs a `SameDayChecker`, not dates. Tools that bypass dependency management waste design feedback. |
| Logging mixed with domain logic | Two concerns interleaved → extract a notification interface you own (`support.notifyFiltering(...)`); mock the interface, test objects not formatted strings. Support logging (ops audience) is part of the UI — test-drive it; diagnostic logging (debug/trace) is scaffolding — don't test it. |
| Mocking a concrete class | First ask why substitution is needed. If the client has a narrow stable role, an owned client-side interface may name it; if not, use the concrete collaborator or test at a different level. Legacy/vendor boundaries go to `third-party-integration`; do not add a veneer automatically. |
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
| Mutability | Usually immutable; operations return new instances | May be mutable or immutable; identity survives state changes |
| Testing | Create instances and assert results | Prefer real objects and observable state/output; substitute an owned peer only when its interaction protocol is behavior |

Create a domain value type when a primitive carries rules, units, normalization, or meaning that tests currently repeat; a wrapper with no behavior or safety benefit is ceremony. Candidate discovery techniques include **breaking out** coherent behavior, **budding off** a type once a real rule appears, and **bundling up** values that must remain consistent.

### Tell, Don't Ask
Describe what you want in terms of the role the neighbor plays; let it decide how. `master.allowSavingOfCustomisations()` beats a train wreck through getters. Queries are fine for values and collections — but ask meaningful questions: `carriage.hasSeatsAvailableWithin(barrier)`, not `carriage.getSeats().getPercentReserved() < barrier`. If knowledge leaks between components, make the dependency explicit and passed in.

### Object Peer Stereotypes
Dependencies (required services) go through the constructor, notifications (fire-and-forget listeners) default to a null object, and adjustments (strategy parts) get sensible defaults — constructor rule: only true dependencies are required at construction (bloated-constructor diagnosis 3). Detail in `references/reference.md` (Part XVII).

### Context Independence
An object has no built-in knowledge of the system it runs in — everything it needs is passed in; you should be able to describe what it does without mentioning the system.

### Architecture Feedback and Handoff

Hard tests are evidence, not an automatic architecture prescription. Hidden time/randomness/network access, branching controllers, and setup that crosses many concerns may suggest a purer decision core and a thinner effectful shell. Ports & adapters, Humble Object, and functional core/imperative shell are candidate structures—not the one architecture for testability.

Use the smallest local seam that restores useful feedback. If the decision changes application layers, port ownership, consistency/transaction boundaries, or composition roots, hand the evidence to `architecture-design`. If it changes module/API depth or knowledge ownership, use `simple-design`. Testing should describe the pressure (slow boundary, nondeterminism, awkward setup), not pre-decide a universal solution.

### Interface Discovery

In outside-in TDD, a test may reveal a narrow collaborator role: ask what outcome or message the client needs, and define an owned interface in that client's vocabulary only when substitution or inversion is earned. Do not extract an interface for every constructor argument or to mock an in-process domain object. Concrete types, closures/functions, enums, and parameter values are often simpler seams.

### Dependency Injection

Separate creation from use where control of a real dependency is necessary. Constructor injection suits required long-lived capabilities; method parameters suit per-operation values such as time or IDs; sensible defaults can serve optional policy. Avoid service locators and ambient mutable globals. The composition decision itself belongs to `architecture-design` when it crosses module boundaries.

### Domain Discovery

When test examples reveal a rule and vocabulary, move that rule to the object/value/module that owns the knowledge. Do not invent types solely because a test would be easier to mock; use `architecture-design` for layer placement and where rules live, and `simple-design` for module ownership.

### Third-Party Integration

Learning/contract tests should pin the vendor assumptions the application actually depends on. Whether to use the SDK directly, add a translator, expose an owned port, or run a protocol fake is decided by `third-party-integration`; a universal wrapper is not a TDD requirement.

### Deleting Tests
Keep a test if it provides **confidence** (reduces uncertainty) or **communication** (explains a scenario). Before deleting, three checks: Would coverage decrease? Does it verify a significant edge case? Does it provide unique documentation? Three "no"s → delete safely.

## 11. Rust Conventions

- Put private unit tests in `#[cfg(test)] mod tests` near the module; put public cross-crate scenarios in `tests/`; use doctests for public examples that should compile. Do not force one production concept per file.
- Name `#[test]` functions in `snake_case`. Use `#[tokio::test]` or another runtime macro only when the behavior is actually async; never add a runtime just for test style.
- A test may return `Result<(), E>` and use `?` for setup. `expect("why this fixture must be valid")` is fine for setup assumptions; avoid bare `unwrap()` when its panic obscures which precondition failed.
- Use `assert_eq!`/`assert_matches!`/domain assertions that show a useful diff. Use `#[should_panic(expected = ...)]` only when panic is the public contract; expected input failures normally assert a typed `Err`.
- Inject or parameterize clocks, randomness, IDs, and schedulers. Seed randomized/property tests and report the seed/counterexample. Never repair a flaky concurrency test with sleeps; use barriers/channels/paused time or assert eventual behavior with a bounded deadline.
- Test error variants and sources that callers act on, not only formatted strings. Keep snapshots/golden files deterministic: stable ordering, normalized platform-specific text only when the contract allows it, and reviewable diffs.

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
- [ ] Exact collaborator call count/order asserted without being part of the contract
- [ ] Vendor SDK object mocked instead of exercising an owned or protocol boundary
- [ ] Flaky time/concurrency test uses sleeps or retries without a bounded causal wait
- [ ] Rust test placement, names, runtime macro, or panic assertions ignore Rust conventions

## Reference

Load `references/reference.md` when you need: the full pattern catalogs (red-bar/green-bar/testing patterns, xUnit smell catalog, fixture setup/teardown/database patterns, verification and organization patterns), per-language error-handling idioms (Go tuples, JS/Python exceptions, Rust `Result`), Khorikov pillar/mock/architecture deep-dives, TDD refactoring patterns, or test-suite metrics. Do not load it for quick mock-vs-stub, fixture, naming, or cycle questions — this file covers those.
