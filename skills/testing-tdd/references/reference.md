# Testing & TDD — Full Reference

Merged pattern catalog from Kent Beck's "Test Driven Development: By Example" (2002), Freeman & Pryce's "Growing Object-Oriented Software, Guided by Tests" (GOOS, 2009), Vladimir Khorikov's "Unit Testing Principles, Practices, and Patterns" (2019), Gerard Meszaros's "xUnit Test Patterns" (2007), and Saleem Siddiqui's "Learning Test-Driven Development" (2021).

Load this file only when the SKILL.md summary is insufficient — for full pattern mechanics, worked examples, per-language idioms, or the complete smell catalog.

---

## Part I: The Cycle, Expanded

### Red / Green / Refactor in Detail (Siddiqui)

**RED:** Write the test as you expect the code to work, even if types/methods don't exist yet — compilation failure counts as red. The test expresses the desired API from the caller's perspective. Run the suite to confirm the failure.

**GREEN:** Write the smallest coherent production change that passes. A temporary constant is useful only when it exposes the next example that will force generalization; do not preserve knowingly false behavior or code for future features.

**REFACTOR:** Remove duplication that represents shared knowledge, improve naming and idiomatic structure, and keep behavior fixed. If a test breaks, restore green before proceeding. Never add features during refactor. Record a green checkpoint with the workflow's allowed mechanism; do not create a commit unless requested.

### Step Size

- Experienced TDDers tend toward smaller steps over time.
- Manual refactoring: many tiny steps to build confidence. After ~20 repetitions of a move, experiment with larger steps. Automated refactoring is an order of magnitude faster and enables bigger leaps.
- The control lever is pace: slow down when uncertain, speed up when confident.

### What to Test / What Not to Test

Test behavior and risk, not syntax categories by quota. Focus on code and contracts you own. For an external dependency, write learning/contract tests only for assumptions your adapter relies on—including a documented quirk you intentionally depend on—and run them against the real protocol/sandbox or a faithful server, not a mocked vendor object.

A test for an impossible condition adds no robustness, but verify the premise at the actual numeric/runtime boundary. Tests are a means to justified confidence, not an end; there is no universal count.

---

## Part II: Starting Patterns (Red Bar)

### Test List

Contents: known success examples, boundaries, caller-visible failures, open questions, and cleanup observations. Do not encode speculative abstractions as requirements. Work one behavior at a time, stay close to a meaningful green checkpoint, and add discoveries as they arise.

### Feature List (Siddiqui)

```
[x] 5 USD x 2 = 10 USD           (done)
[x] 5 USD + 10 USD = 15 USD      (done, added as simpler precursor)
[ ] 5 USD + 10 EUR = 17 USD      (current)
[ ] Remove redundant tests        (added during work)
```

Bold/mark the current item; cross off completed; insert simpler precursors when a feature needs too many new abstractions at once. Each step introduces exactly one new concept. The order of implementation shapes the final design — the same problem solved in a different order produces different code.

### Walking Skeleton (GOOS)

Resolves the first-feature paradox: you can't write a test without infrastructure, and you can't build infrastructure without knowing what to test.

1. Sketch the broad architecture — just enough to start, not BDUF.
2. Build the deployment pipeline: automated build, deploy to a production-like environment, run tests.
3. Implement the simplest possible end-to-end behavior (e.g., display one value from the database).
4. Write the first real acceptance test.

"End-to-end" includes the process: build from scratch, deploy, test through external interfaces. It takes longer than expected — that exposes risks early. Brownfield: automate build/deploy first, add end-to-end tests over existing paths, then TDD new work.

### Red Bar Pattern Catalog

- **One Step Test** — pick a test that teaches you something and you can implement confidently. Neither the most obvious nor the hardest. If nothing on the list is one step, add smaller tests. Programs grow from known to unknown — neither strictly top-down nor bottom-up.
- **Starter Test** — test a variant that does nothing (empty input, zero, identity). Solves "where does the operation belong?" without also solving input/output. Get the first green bar fast, then drill in.
- **Assert First** — start from the expected result and work backward:
  ```
  assertTrue(reader.isClosed());
  assertEquals("abc", reply.contents());   // where does reply come from?
  Buffer reply = reader.contents();        // where does reader come from?
  Socket reader = Socket("localhost", defaultPort());  // what must exist first?
  Server writer = Server(defaultPort(), "abc");
  ```
- **Explanation Test** — ask for and give explanations as tests: "If I have a Foo like this and a Bar like that, should the answer be 76?" Convert design discussions into executable cases.
- **Learning Test** — before first use of a third-party facility, write a test verifying the API works as you expect. On upgrades, run learning tests first; if they break, the application would too.
- **Another Test** — tangential idea? Add it to the list, return to the topic.
- **Regression Test** — a reported defect starts as the smallest failing test. Every regression test is a test you should have written; ask how you could have known. If you must refactor to isolate the defect, the design is telling you it isn't done.
- **Do Over** — lost and stuck? Throw the code away and start fresh rather than "untwisting it enough."
- **Broken Test** — an uncommitted local failing test can bookmark a solo session when no one else consumes the worktree. Prefer leaving a note plus a green checkpoint when automation or handoff will run.
- **Clean Check-in** — shared branches and CI stay green. Restore the last checkpoint when a change cannot be repaired locally; never comment out a test merely to pass.

---

## Part III: Green Bar Patterns

### Fake It ('Til You Make It)

Return a constant, then gradually transform it into an expression:

```python
return "1 run, 0 failed"
# becomes
return "%d run, 0 failed" % self.runCount
# becomes
return "%d run, %d failed" % (self.runCount, self.failureCount)
```

The duplicated literal between test and code is the signal to generalize; replacing it with the computation reveals the abstraction. Starting concrete prevents premature abstraction; green first gives you a known position to refactor from ("that works" first, "clean code" second).

### Triangulate

Abstract only with two or more examples:

```java
assertEquals(4, plus(3, 1));  // can fake with return 4
assertEquals(7, plus(3, 4));  // must implement return augend + addend
```

Most conservative strategy; use only when genuinely unsure of the abstraction, otherwise Fake It or Obvious Implementation.

### Obvious Implementation

Just type the real implementation. Track surprise red bars: repeated "type obvious → red → fix → red" cycles mean downshift to Fake It. Obvious Implementation is second gear; Fake It is first.

### One to Many

Operations on collections, single value first:

1. Implement for a single element: `sum(5)` returns `5`.
2. Add the collection parameter alongside: `sum(5, new int[]{5})`.
3. Switch the implementation to use the collection (still passes — one element).
4. Delete the single-value parameter.
5. Enrich the test: `assertEquals(12, sum(new int[]{5, 7}))`.

This is Isolate Change applied to parameters: change code without touching tests, then tests without touching code.

---

## Part IV: Writing Tests — Beck's xUnit Basics

- **Assertion** — boolean expressions that automate judgment. Be specific: `assertEquals(50, rectangle.area())`, not `assertTrue(area != 0)`. Test through public protocol only; wanting white-box access is a design problem — expose the information through the public API instead.
- **Fixture** — objects in an interesting state shared by several tests. Convert locals to fields initialized in setUp. Trade-off: DRY setup vs. having to remember what setUp does. Different fixture → different test class; no 1:1 rule between test classes and model classes.
- **External Fixture / teardown** — release external resources in tearDown; it runs regardless of test outcome (if setUp succeeded). Goal: leave the world exactly as before the test.
- **Test Method** — name tells a future reader why the test exists. Mostly straight-line code; long test methods mean the step was too big.
- **Exception Test** — catch the expected exception and fail only if it isn't thrown; catch only the specific expected exception.
- **All Tests** — aggregate suites per package into one suite for the whole application.

### Evident Data

Make the input→output relationship visible:

```java
bank.addRate("USD", "GBP", 2);
bank.commission(0.015);
Money result = bank.convert(new Note(100, "USD"), "GBP");
assertEquals(new Note(100 / 2 * (1 - 0.015), "GBP"), result);
```

Use realistic data only for real-time traces, parallel testing against a legacy system, or refactoring simulations needing exact floating-point matches.

### Isolated Test

Tests must not affect each other: independent, order-independent, no shared mutable state. One broken test = one problem; never let failures cascade. Isolation forces composition from cohesive, loosely-coupled objects.

---

## Part V: Test Data Builders (GOOS)

For objects with complex constructors or deep nesting.

```java
OrderBuilder builder = new OrderBuilder();  // safe defaults for everything
Order simple = builder.build();             // default order is one line

Order specific = anOrder()                  // static factory for readability
    .withCustomer(aCustomer()
        .withAddress(anAddress().withNoPostcode()))
    .build();
```

Benefits: tests mention only values relevant to the behavior; constructor changes touch only the builder; named methods prevent argument-order confusion.

**Similar objects** — share a builder, vary with `but()` (or copy constructors) to avoid accidental state accumulation:

```java
OrderBuilder hatAndCape = anOrder().withLine("Deerstalker Hat", 1).withLine("Tweed Cape", 1);
Order small = hatAndCape.but().withDiscount(0.10).build();
Order large = hatAndCape.but().withDiscount(0.25).build();
```

**Combining builders** — pass builders to builders, eliminating `.build()` noise:

```java
anOrder().from(aCustomer().with(anAddress().withNoPostcode())).build();
```

**Passing builders to helpers** — pass the builder, not its arguments, so helper signatures stay stable:

```java
void sendAndProcess(OrderBuilder orderDetails) {
    Order order = orderDetails.withDefaultCustomersReference(nextRef()).build();
    requestSender.send(order);
    progressMonitor.waitForCompletion(order);
}
```

**Raising the language** — rename helpers toward what, not how: `havingReceived(anOrder().withLine("Hat", 1))` instead of `sendAndProcess(...)`.

---

## Part VI: Test Doubles — Full Catalog (Meszaros)

### The Five Doubles

- **Dummy Object** — placeholder passed but never used; satisfies a required parameter. Often `null`/`None`, or an implementation that panics if called.
- **Test Stub** — injects controlled indirect inputs. Two flavors: **Responder** (valid values for happy paths) and **Saboteur** (exceptions/errors for error paths). **Entity Chain Snipping**: a stub returning stubs, avoiding construction of deep object graphs.

  ```rust
  // Saboteur: force the error path
  let stub = TimeProviderStub::returning_error(TimeError::Unavailable);
  let display = TimeDisplay::new(stub);
  assert_eq!(display.current_time_html(), "<span class=\"error\">Unavailable</span>");
  ```

- **Test Spy** — stub that records how the SUT called it; the test asserts on the recording afterward:

  ```rust
  let spy = AuditLogSpy::new();
  let facade = Facade::new(spy.clone());
  facade.remove_flight(flight_id);

  assert_eq!(spy.call_count(), 1);
  assert_eq!(spy.last_action(), Action::RemoveFlight);
  ```

  Use when you want "what happened" recording separated from "was it correct" verification.

- **Mock Object** — pre-loaded with expectations; self-verifies during execution, fails immediately on unexpected calls. **Strict mocks** fail on out-of-order calls; **lenient mocks** tolerate ordering differences. Overuse leads to overspecified, fragile tests.
- **Fake Object** — lightweight working implementation (in-memory hash map implementing the persistence interface; ≈50× faster than a real DB). Not controlled or verified — it just works.

### Double Construction

- **Configurable double** — accepts return values/expectations at runtime (what mocking frameworks generate). Configuration mode records, playback mode replays.
- **Hard-coded double** — behavior baked in: inner doubles (inline closure/anonymous class), Self Shunt (the test class implements the dependency interface itself), pseudo-objects (base class with "throw if called" defaults; override only what you need).
- **Test-Specific Subclass** — subclass the SUT/dependency to expose state, make protected methods public, or short-circuit behavior. Use sparingly; prefer DI. Useful as a legacy transition technique.

### Installing Doubles

- **Dependency Injection** — constructor (preferred: explicit, immutable), setter (late binding, optional deps), or parameter (single-method usage, loosest coupling).
- **Dependency Lookup** — object factory or service locator the test pre-configures.
- **Test-Specific Subclass** — override the dependency access method.

### Khorikov's Taxonomy

Khorikov groups all doubles as **mocks** (emulate and examine outgoing interactions) or **stubs** (supply incoming data); under that taxonomy spies are handwritten mocks and dummies/fakes fall on the stub side. Meszaros keeps five separate categories. State which vocabulary you are using. Command/query is a useful heuristic, not “every command gets a strict mock”: verify an outgoing message only when that message is observable behavior, and never assert a query-stub interaction merely to prove the implementation called it.

### Siddiqui's Guidance

Use real code when a double costs more than the real thing. Use doubles when the real dependency is slow, nondeterministic, or complex to set up. Risk: doubles mask non-obvious side effects or introduce effects the real code lacks. Mitigation: stateless code with well-defined interfaces — a method whose behavior depends only on its parameters is trivially replaceable.

---

## Part VII: Fixture Patterns (Meszaros)

### Strategies

- **Transient Fresh Fixture** — in-memory, garbage-collected. The default.
- **Persistent Fresh Fixture** — DB/filesystem; requires reliable isolation/teardown. Use a fake for fast application-policy tests; use the production engine or faithful emulator for tests claiming persistence fidelity.
- **Shared Fixture** — reused across tests; saves setup time but causes Interacting Tests, Test Run Wars, Erratic Tests. Variants: **Immutable Shared Fixture** (read-only shared part + per-test fresh mutable layer — much safer); **Prebuilt Fixture** (seeded outside the run; risk of Unrepeatable Tests).
- **Minimal Fixture** — only objects that directly affect the behavior under test. A large General Fixture obscures cause and effect.
- **Standard Fixture** — same fixture *design* (not instance) rebuilt fresh per test.

### Setup Patterns

- **In-line Setup** — everything in the test method; best for small unique fixtures.
- **Delegated Setup** — call Creation Methods from the test; the test retains control.
- **Implicit Setup** — setUp/beforeEach; pair with Testcase Class per Fixture.
- **Creation Method** variations: *Anonymous* (auto-generates unique IDs), *Parameterized* (accepts only test-relevant attributes, defaults the rest), *Named State Reaching* (puts SUT in a state, e.g. `activate_customer(c)`), *Attachment* (modifies an existing object, e.g. `add_line_item(order, product, qty)`).

  ```rust
  fn create_active_customer() -> Customer {
      Customer::new(next_id(), "Name", "Surname", CreditRating::Good, Status::Active)
  }
  ```

- **Prebuilt Fixture** — built before the run; use Finder Methods to locate objects. For large, expensive reference data.
- **Lazy Setup** — initialize on first access.
- **Suite Fixture Setup / Setup Decorator** — build shared fixture around the whole suite.
- **Chained Tests** — each test uses the previous test's end state. Fragile, cascading failures; if unavoidable, use Guard Assertions on preconditions.

### Teardown Patterns

- **Garbage-Collected Teardown** — default for transient fixtures.
- **Automated Teardown** — register cleanup closures during setup, run in reverse order:

  ```rust
  teardown_list.push(Box::new(move || db.delete(record_id)));
  while let Some(cleanup) = teardown_list.pop() { cleanup(); }
  ```

- **In-line Teardown** — cleanup at the end of the test with try/finally guard clauses.
- **Implicit Teardown** — tearDown/afterEach; pairs with Implicit Setup.
- **Transaction Rollback Teardown** — run the test in a transaction, roll back. Fastest persistent cleanup; the SUT must not commit (use a Humble Transaction Controller).
- **Table Truncation Teardown** — truncate affected tables; simpler than tracking records when tests have exclusive table access.

### Database Patterns

- **Database Sandbox** — separate DB per developer (or schema per test runner, or unique keys per test within a shared DB). Prevents Interacting Test Suites and Test Run Wars.
- **Stored Procedure Test** — test each stored procedure directly, verifying via SQL queries.

---

## Part VIII: Verification Patterns (Meszaros)

- **State Verification** (default) — inspect SUT state after exercise. *Procedural*: series of assertEquals on attributes. *Expected Object*: build the expected object, single equality assertion.
- **Behavior Verification** — verify calls to dependencies. *Procedural*: spy + assert afterward. *Expected Behavior Specification*: mock self-verifies. Couples tests to implementation — use only when no observable state exists.
- **Custom Assertion** — domain-specific comparison extracted when the same multi-field check repeats:

  ```rust
  fn assert_line_items_equal(msg: &str, expected: &LineItem, actual: &LineItem) {
      assert_eq!(format!("{msg}: product"), expected.product(), actual.product());
      assert_eq!(format!("{msg}: quantity"), expected.quantity(), actual.quantity());
  }
  ```

  Variations: custom equality assertion, domain assertion (`assert_flight_is_bookable(flight)`), diagnostic assertion (rich diff messages), verification method (retrieves outcome then compares). Write Custom Assertion Tests for complex assertion logic.
- **Delta Assertion** — assert on the *change*: `assert_eq!(count_before + 1, repo.count())`. Useful with shared fixtures.
- **Guard Assertion** — replace `if` in tests with fail-fast assertions: `assert!(customer.is_active(), "precondition: customer must be active")`.
- **Unfinished Test Assertion** — placeholder that guarantees failure: `todo!()` / `fail("not yet implemented")`.

---

## Part IX: Test Organization (Meszaros)

- **Testcase Class per Class** — one test class per production class. Simple starting point; outgrown when behaviors need different fixtures.
- **Testcase Class per Feature** — group by capability; use with Delegated Setup.
- **Testcase Class per Fixture** — group by shared precondition; class name describes the state, method names the behavior:

  ```
  WhenCartIsEmpty:: adding_item_creates_first_line_item, total_is_zero
  WhenCartHasOneItem:: adding_same_item_increases_quantity, removing_item_empties_cart
  ```

- **Naming** — encode SUT + action + scenario + expected outcome: `test_invoice_add_line_item_with_zero_quantity_returns_error`. With Testcase Class per Fixture, the class name carries the fixture context.
- **Named Test Suite** — AllTests, subset suites ("no database", smoke), single-test suites for debugging.
- **Test Utility Method** — reusable logic behind an intent-revealing name: Creation, Finder, Attachment, SUT Encapsulation, Custom Assertion, Verification, Parameterized Test, Cleanup methods. Placement: the testcase class if local, a testcase superclass if shared, a standalone Test Helper if crossing package boundaries.
- **Parameterized Test** — full lifecycle in one method, called with different data:

  ```rust
  fn verify_discount(original: f64, discount_pct: f64, expected: f64) {
      let product = create_product(original);
      let result = product.apply_discount(discount_pct);
      assert_eq!(expected, result.price());
  }

  #[test] fn discount_10_pct() { verify_discount(100.0, 0.10, 90.0); }
  #[test] fn discount_zero()   { verify_discount(100.0, 0.00, 100.0); }
  ```

  Variations: tabular test (data in arrays), data-driven test (external files).

---

## Part X: Value Patterns (Meszaros)

- **Literal Value** — hard-coded constants. *Symbolic Constant*: name the role (`const WIDGET_PRICE: f64 = 19.95;`). *Self-Describing Value*: `"Not an existing customer"` instead of `"Jane Doe"`. *Distinct Value*: different values per attribute so you can verify the SUT used the right one.
- **Derived Value** — compute the expectation from inputs to show the relationship: `let expected_total = item_price * quantity;`. *One Bad Attribute*: build an expected object identical to actual with one attribute modified, to verify rejection.
- **Generated Value** — runtime-generated unique values (counter/UUID) to prevent Unrepeatable Tests with persistent fixtures:

  ```rust
  fn next_unique_id() -> u64 {
      static COUNTER: AtomicU64 = AtomicU64::new(1);
      COUNTER.fetch_add(1, Ordering::Relaxed)
  }
  ```

---

## Part XI: Test Smell Catalog (Meszaros)

### Code Smells (visible in source)

| Smell | Signal | Resolution |
|-------|--------|------------|
| **Obscure Test** | Can't grasp at a glance | Creation Methods, Custom Assertions, intent-revealing names; remove irrelevant info |
| — Eager Test | One test verifies multiple unrelated behaviors | One condition per test |
| — Mystery Guest | Depends on external files/DB data not visible in the test | Make inputs visible in-line or via named Creation Methods |
| — General Fixture | setUp builds more than most tests use | Testcase Class per Fixture + Minimal Fixture |
| — Hard-Coded Test Data | Magic literals, unclear relationships | Derived Values, Generated Values, role-named constants |
| — Indirect Testing | Testing a class through another class | Test each class through its own interface |
| **Conditional Test Logic** | if/else/loops in tests | Separate tests per scenario; Guard Assertions; no production logic reimplemented in tests |
| **Test Code Duplication** | Same logic cloned across tests | Test Utility Methods, Creation Methods, Custom Assertions |
| **Test Logic in Production** | `if testing {...}` hooks; test-only methods; equality polluted for tests | Dependency Injection; Test-Specific Subclass; Custom Assertions with test-specific equality |

### Behavior Smells (visible at runtime)

| Smell | Signal | Resolution |
|-------|--------|------------|
| **Assertion Roulette** | Can't tell which assertion failed | Assertion messages; one condition per test |
| **Erratic Test** | Passes/fails nondeterministically | Fresh Fixture; eliminate shared state; inject deterministic stubs for clock/random/network |
| — Interacting Tests / Test Run War | Shared mutable fixture corrupts other tests | Fresh Fixture; Database Sandbox |
| — Lonely Test | Passes alone, fails in suite (or vice versa) | Fresh Fixture + independent tests |
| — Resource Leakage / Optimism | Connections/handles leak; test assumes a resource exists | Automated Teardown; create all resources in setup |
| — Unrepeatable Test | First run passes, second fails | Proper teardown or transient fixtures |
| **Fragile Test** | Breaks on SUT changes with correct behavior | Test via the front door; Minimal Fixture; state over behavior verification; minimize overlap |
| — Interface/Behavior/Data/Context Sensitivity | Coupled to signatures, one change breaks many tests, pre-existing data changes, environment dependence | SUT Encapsulation + Creation Methods; one test per behavior; Fresh + Minimal Fixture; inject context via stubs |
| **Slow Tests** | Suite too slow to run often | Fakes instead of DB/network; Minimal Fixture; reduce overlap; Humble Executable for async |
| **Frequent Debugging** | Need a debugger to localize failures | Smaller, single-condition tests |
| **Manual Intervention** | Human setup/verification needed | Automate all phases |

### Project Smells

- **Production Bugs** — Lost Tests (not in the suite), missing unit tests, Neverfail Tests (no real assertions).
- **Buggy Tests** — caused by obscure tests and hard-to-test code; keep tests simple; test complex Custom Assertions.
- **High Test Maintenance Cost** — fragile, obscure, duplicated tests; apply patterns systematically.
- **Developers Not Writing Tests** — address root causes (time pressure, hard-to-test code), don't mandate.

---

## Part XII: Diagnostics & Flexibility (GOOS)

The point of a test is not to pass but to **fail** — design failures to be informative.

- **Small focused tests** — the name localizes the fault.
- **Explanatory assertion messages** — `assertEquals("outstanding balance", 16301, customer.getOutstandingBalance())` — identifies which value failed.
- **Self-describing values** — `namedDate(1000, "startDate")` produces `Expected: <startDate> got: <endDate>`.
- **Obviously canned values** — improbable values that stand out from production data: negatives, max values, three-digit IDs when production uses five.
- **Tracer objects** — dummies that only describe their role in failure messages; for verifying pass-through.
- **Matchers that show detail** — prefer assertions that report what didn't match (e.g., listing each non-matching price), not just that something didn't.

Flexibility rules — specify precisely what should happen and no more:

- **Information, not representation** — `NO_CUSTOMER_FOUND = Maybe.nothing()` instead of `returnValue(null)`; representation changes touch one constant.
- **Precise assertions** — assert the one relevant field; use approximate bounds (`greaterThan(PREVIOUS_ID)`); for strings check key content, not exact format.
- **Allow queries; expect commands** — strict expectations only for side-effecting calls; queries get lenient stubs. Decouples tests from caching/algorithm changes.
- **Ignoring irrelevant collaborators** — exclude peers not relevant to this test, but make sure those features are tested elsewhere.
- **Ordering** — don't constrain invocation order by default; constrain only when order is part of the protocol (e.g., results before finished); use state-machine-style constraints for nuanced protocols ("any order, but all before finished"). Overconstrained order = brittle.
- **Guinea Pig objects** — when testing generic infrastructure (serializers, ORM), use dedicated test-only types with explicit features, not production domain types that may change silently.

---

## Part XIII: Listening to the Tests (GOOS detail)

### Singletons Are Dependencies

Needing bytecode manipulation or classloader tricks to substitute a collaborator means a hidden dependency. Replace implicit access (`new Date()` → `System.currentTimeMillis()`) with an injected collaborator (`clock.now()`). Push further: does the object need dates at all, or a `SameDayChecker`? Every refactoring moves knowledge to where it belongs. Hiding a dependency behind a global doesn't remove it; tools that bypass dependency management (mocking statics) waste design feedback. Use the same techniques to break dependencies in tests as in production.

### Logging

| Type | Audience | Test approach |
|------|----------|---------------|
| Support logging (error, info) | Operations/support | Test-driven; part of the user interface |
| Diagnostic logging (debug, trace) | Developers | Scaffolding; don't test |

Logging interleaved with domain logic → extract a notification interface:

```java
// BAD
for (Filter filter : filters) {
    filter.selectFor(location);
    if (logger.isInfoEnabled()) { logger.info("Filter " + filter.getName() + "..."); }
}
// GOOD
for (Filter filter : filters) {
    filter.selectFor(location);
    support.notifyFiltering(tracker, location, filter);
}
```

You own `support`, so you can mock it; you test objects, not formatted strings. "Logging all over my domain objects" means: some support logging is really diagnostic, you're logging too much, or you haven't found the choke points.

### Mocking Concrete Classes

Overriding methods on a concrete class can hide the role the collaborator plays. `CdPlayer` has 5 methods but `MusicCentre` uses 2 — when that narrower scheduling role is real production knowledge, an owned `ScheduledDevice` contract can make it explicit. Legacy or third-party code does not automatically justify a veneer: add one only when it owns translation, volatility, failure, policy, or a protocol the application genuinely needs to substitute.

### Mocking Values

Don't mock immutable data types — create instances (builder if complex). Heuristic: instances are immutable, or you can't think of a meaningful implementation name (`VideoImpl`?).

### Bloated Constructor — Worked Example

Diagnosis 1 (implicit structure), full progression:

```
// BEFORE: 6 constructor args
MessageProcessor(unpacker, auditor, counterpartyFinder,
                 locationFinder, domesticNotifier, importedNotifier)
// STEP 1: counterpartyFinder always used with unpacker -> push it in
// STEP 2: locationFinder + notifiers are a routing concept -> bundle up
MessageProcessor(unpacker, auditor, dispatcher)
// Now the code shows three stages: receive, process, forward
```

Diagnosis 2 (confused object): test suite splits into unrelated slices → one class per responsibility.

Diagnosis 3 (mixed peer types): only true dependencies in the constructor; adjustments default, notifications default to null objects:

```
// BEFORE: RacingCar(track, driver, tyres, suspension, frontWing, backWing, fuelLoad, listener)
// AFTER:  RacingCar(Track track)  // everything else defaults, settable later
```

### Too Many Expectations

When everything in a test looks equally significant, separate stubs from expectations: queries and data-providing calls are *allowances* (support the test getting to the interesting part); only the side-effecting command is an *expectation* (what the test actually asserts). If the setup requires navigating `getX().getY().doZ()`, Tell Don't Ask is violated — tell the nearest object to do the work.

### Summary Principles

- **Keep knowledge local** — knowledge leaking between components → explicit, passed-in dependencies.
- **If it's explicit, name it** — extracted interfaces name relationships.
- **More names = more domain information** — communication over classification produces domain-rich vocabulary.
- **Pass behavior, not data** — callbacks and listeners instead of pulling data up the stack.

---

## Part XIV: Khorikov Deep Dives

### The Goal of Unit Testing

Enable sustainable growth. A suite succeeds when it is integrated into the development cycle (only tests you run provide value), targets the most important code (domain model, algorithms), and maximizes value per unit of maintenance cost. Code is a liability, not an asset.

### Coverage Metrics

Code and branch coverage are gap signals, not goals — easily gamed (assertion-free tests), blind to external-library paths. Low coverage flags under-testing; high coverage proves nothing.

### Classical vs. London Schools

| Aspect | Classical | London |
|--------|-----------|--------|
| "Unit" | A unit of behavior (may span classes) | A single class |
| Isolation | Tests isolated from each other | SUT isolated from all collaborators |
| Doubles for | Shared dependencies only | All mutable dependencies |
| Style | State-based | Communication-based |

Use the classical/state-based style as the default when real in-process collaborators are fast and deterministic. Outside-in mockist tests can be useful for discovering roles at process/vendor boundaries, but indiscriminate collaborator mocking couples tests to intra-system communication and damages refactoring resistance. Keep the chosen style coherent within a slice.

### Four Pillars Detail

1. **Regression protection** — function of code executed × complexity × domain significance. Trivial code (one-line properties) is rarely worth testing.
2. **Refactoring resistance** — immunity to false positives (test fails, behavior correct). False positives destroy trust and halt refactoring. Root cause: coupling to implementation details. Binary: you have it or you don't — always maximize.
3. **Fast feedback** — faster tests run more often; bugs cost less.
4. **Maintainability** — understandability (small tests) + runnability (few out-of-process deps).

Value = product of the four. End-to-end tests maximize pillars 1–2 but are slow and costly; trivial tests are fast and stable but catch nothing; brittle tests catch bugs but cry wolf. Black-box vs. white-box: **write** tests black-box (better resistance); **analyze** coverage white-box to find untested branches, then write black-box tests for them.

### Intra- vs. Inter-System Communications

Intra-system calls (between your classes) are implementation details — mocking them creates brittle tests. Inter-system calls (to external systems) are observable behavior — mocking is appropriate because backward compatibility must be preserved. Exception: an out-of-process dependency only your app accesses (your database) is an implementation detail — use the real thing. Shared database tables: mock the tables other apps access, use real ones for private tables.

### Three Styles of Unit Testing

| | Output-based | State-based | Communication-based |
|---|---|---|---|
| Verifies | Return value | SUT state | Calls to collaborators |
| Refactoring resistance | High | Medium | Low |
| Maintainability | High | Medium | Low |

Prefer output-based verification when it fits the domain; it usually resists refactoring best. One way to gain more of it is to return decisions (for example a `FileUpdate`) from a pure core and apply them in a shell. Treat that as an architectural option revealed by test pressure, not a mandate for every object model; hand cross-module structure to `architecture-design`.

### Functional Core / Mutable Shell

Functional core: pure functions, all inputs/outputs explicit, no side effects. Mutable shell: gathers inputs from out-of-process deps, calls the core, applies its decisions. A stricter form of hexagonal architecture (hexagonal allows state mutation inside the domain). Core gets extensive output-based unit tests; shell gets a few integration tests.

### The Controller Trilemma

For operations needing mid-operation external reads/writes, pick two of: domain testability, controller simplicity, performance. Recommended: split decision-making into granular steps (sacrifice controller simplicity), mitigated by:

**CanExecute/Execute:**

```rust
// Domain
fn can_change_email(&self) -> Result<(), String> { ... }
fn change_email(&mut self, new_email: &str, company: &mut Company) {
    assert!(self.can_change_email().is_ok());
    // ...
}

// Controller
if let Err(e) = user.can_change_email() { return Err(e); }
user.change_email(new_email, &mut company);
```

**Domain events** — the core records what happened; the controller dispatches:

```rust
// Domain
self.events.push(EmailChangedEvent { user_id, new_email });
// Controller
for event in &user.events { message_bus.send(event.to_message()); }
```

Both keep decision-making out of the controller and make side-effect decisions unit-testable without mocks.

### Integration Testing Practices

- Focused tests cover dense policy and boundary cases; integration tests cover assumptions that only the real database/framework/protocol can establish. Select scenarios by risk rather than a mandatory “longest path.”
- Database: keep schema/migrations in source control; use the production engine or a faithful emulator for fidelity tests; isolate with transactions, schemas, containers, unique keys, or sequential execution according to actual commit/concurrency semantics. A SQLite/in-memory substitute is a fake for application tests, not evidence about Postgres behavior.
- Use factory/builders for arrange and domain assertions for readable verification; do not hide the behavior under excessive test DSL layers.
- Interfaces are earned by a client role, volatility boundary, or needed substitution—not by whether a dependency is called managed/unmanaged. Keep in-process domain types concrete unless polymorphism is real.
- Treat support-facing logging/audit output as a contract only when operations or compliance acts on it; diagnostic logging is usually observed via production telemetry rather than exact-string tests.
- Fail fast on broken internal preconditions, but a panic is not automatically sufficient protection for caller input. Test typed caller-visible failure when recovery is expected.

### Mocking Best Practices

1. Mock only an owned contract with an externally meaningful outgoing interaction.
2. Prefer the narrowest boundary that keeps intra-system implementation out of the assertion.
3. Spies often keep verification readable; framework mocks are acceptable when their failure diagnostics and protocol expectations are clearer.
4. Verify exact counts/order/no-other-calls only when duplicates or order are contractual.
5. Application tests and integration tests may both use owned doubles for different reasons; pure domain tests usually need none.
6. Do not mock third-party SDK objects to restate assumptions. Use `third-party-integration` to choose a real sandbox, emulator, protocol fake, or earned adapter.

No “one mock per test” rule, but many interaction expectations are a design/test-level warning—reassess whether the test observes behavior or scripts an implementation.

### Common Pitfalls

- **Private methods** — test indirectly through the public API. Too complex to test indirectly → extract a class; the complexity is a missing abstraction. Exception: private members that are observable behavior (e.g., ORM constructor) may be made public.
- **Exposing private state** — interact with the SUT as production code does; test the observable behavior that depends on the state (the discount amount, not the internal enum).
- **Leaking domain knowledge to tests** — hardcode expected values, pre-calculated independently (domain expert, legacy system). Reimplementing the algorithm in the test is a tautology.
- **Code pollution** — `if (isTestEnvironment)` in production adds maintenance cost and bug surface. Use an interface with a fake in the test project instead.
- **Mocking concrete classes** — needing to override one method is a design signal, not proof of an SRP violation. Prefer the real collaborator when practical; add an owned adapter/interface only when a production boundary or observable interaction contract earns it.
- **Working with time** — avoid ambient context (static clock: shared state, test concerns in production). Service injection is acceptable at controller level. Value injection (pass time as a parameter to domain logic) is preferred.

---

## Part XV: Error Handling in TDD (Siddiqui)

### Error Wish List

Before implementing failure handling, define the caller contract: classification, partial-result policy, retryability, and diagnostic detail. Never silently return a wrong success. Aggregate failures when users benefit from correcting them together (for example independent validation fields); fail fast when continuing is unsafe, expensive, or would produce misleading secondary failures. A partial result can be valid when explicitly modeled, not smuggled alongside an error.

### Language Idioms

**Go — `(value, error)` tuples:**

```go
func (p Portfolio) Evaluate(bank Bank, currency string) (*Money, error) {
    failedConversions := make([]string, 0)
    for _, m := range p {
        if convertedAmount, ok := bank.Convert(m, currency); ok {
            total += convertedAmount
        } else {
            failedConversions = append(failedConversions, m.currency+"->"+currency)
        }
    }
    if len(failedConversions) == 0 {
        return &Money{total, currency}, nil
    }
    return nil, errors.New("Missing exchange rate(s):" + formatFailures(failedConversions))
}
```

`nil` error = success; "comma, ok" for map lookups; `_` discards unwanted returns.

**JavaScript — exceptions, aggregate then throw:**

```javascript
evaluate(bank, currency) {
    let failures = [];
    let total = this.moneys.reduce((sum, money) => {
        try {
            return sum + bank.convert(money, currency).amount;
        } catch (error) {
            failures.push(error.message);
            return sum;
        }
    }, 0);
    if (failures.length === 0) return new Money(total, currency);
    throw new Error("Missing exchange rate(s):[" + failures.join() + "]");
}
```

**Python — exceptions, truthiness of empty collections:**

```python
def evaluate(self, bank, currency):
    total = 0
    failures = ""
    for m in self.moneys:
        try:
            total += bank.convert(m, currency).amount
        except Exception as ex:
            failures += ", " + str(ex) if failures else str(ex)
    if not failures:  # empty string is falsy
        return Money(total, currency)
    raise Exception("Missing exchange rate(s):[" + failures + "]")
```

**Rust — typed `Result<T, E>`; aggregate only when the contract calls for it:**

```rust
#[derive(Debug, PartialEq)]
enum EvaluationError {
    MissingRates(Vec<CurrencyPair>),
}

fn evaluate(&self, bank: &Bank, currency: Currency) -> Result<Money, EvaluationError> {
    let mut total = Decimal::ZERO;
    let mut missing = Vec::new();
    for money in &self.moneys {
        match bank.convert(money, currency) {
            Ok(converted) => total += converted.amount(),
            Err(ConvertError::MissingRate(pair)) => missing.push(pair),
        }
    }
    if missing.is_empty() {
        Ok(Money::new(total, currency))
    } else {
        Err(EvaluationError::MissingRates(missing))
    }
}
```

Test the enum variant and payload callers use. Preserve sources when infrastructure details matter to diagnostics. Do not panic for expected input/dependency failures; use `#[should_panic]` only when panic is the intentional contract.

### Rust test mechanics

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_a_missing_exchange_rate() -> Result<(), TestSetupError> {
        let portfolio = portfolio_with_missing_rate()?;
        let error = portfolio.evaluate(&bank(), Currency::EUR).unwrap_err();
        assert!(matches!(error, EvaluationError::MissingRates(_)));
        Ok(())
    }
}
```

- Use `snake_case`; colocate private unit tests, use `tests/` for the public crate API, and use doctests for compiling public examples.
- A test returning `Result` can use `?` for setup. `expect` should explain a fixture precondition; a bare `unwrap` often hides it.
- `#[should_panic(expected = ...)]` verifies an intentional panic contract only. For ordinary validation, assert the typed error.
- Control clocks, RNGs, IDs, and async scheduling. Seed property tests and retain the smallest counterexample. For concurrency, synchronize causally with barriers/channels or paused virtual time; sleeps are not proof.
- Deterministic snapshots/golden files require stable ordering and explicit normalization. Re-running should not change output unless variability is the behavior under test.

---

## Part XVI: TDD Refactoring Patterns (Beck)

In TDD, refactoring preserves semantics with respect to passing tests — the burden is on you to have enough tests.

- **Reconcile Differences** — make two similar pieces identical, then unify. All scales: loops, branches, methods, classes. Work backward from "how could the last step be trivial?"
- **Isolate Change** — extract the part that must change before changing it (Extract Method, Extract Object, Method Object). Sometimes inline it back afterward.
- **Migrate Data** — temporarily duplicate old and new formats. Internal-first: add new field, set it everywhere old is set, read it everywhere old is read, delete old, change interface. API-first: add new parameter, translate new→old internally, delete old parameter, migrate uses, delete old format.
- **Extract Method** — pull a meaningful chunk (loop body, branch) into a named method; parameterize outer temps used.
- **Inline Method** — paste the body at the call site when indirection has become twisted; re-extract with fresh eyes.
- **Extract Interface** — when a client has an earned role that needs substitution or dependency inversion, define the smallest interface beside that client. A second implementation is evidence, not a prerequisite; a mock alone is not sufficient evidence. Name implementations by what is specific (`DiskFile`, `InMemoryFile`).
- **Move Method** — signal: two or more messages to another object in one method:

  ```java
  // Before: three messages to bounds
  int width = bounds.right() - bounds.left();
  int height = bounds.bottom() - bounds.top();
  int area = width * height;
  // After: one message
  int area = bounds.area();
  ```

- **Method Object** — complex method resisting extraction (many temps/params) → make it a class: params become constructor args, temps become fields, body becomes `run()`.
- **Add Parameter** — add to the interface first, then the method; let compiler errors find call sites.
- **Method Parameter to Constructor Parameter** — same param passed to many methods → pass once at construction. Reverse when a field is used by only one method.

### Design Patterns That Recur in TDD

One-liners (use when the situation arises, not by phase):

- **Value Object** — immutable, operations return new instances, implement equality/hashing. Solves aliasing for widely-shared objects (money, dates, units).
- **Null Object** — special case as an object with the regular protocol as no-ops; eliminates scattered null checks.
- **Composite** — a collection implements the component interface; introduce when duplication appears between single-object and collection code.
- **Imposter** — new implementation of an existing protocol to introduce variation (Null Object and Composite are Imposters).
- **Pluggable Object** — the same conditional about the same distinction in multiple methods → polymorphic mode object.
- **Factory Method** — create via method (`Money.dollar(5)`) when you need construction flexibility; constructors are fine otherwise.
- **Command** — computation as an object with `run()`: logging, deferred execution, undo.
- **Template Method** — invariant sequence with overridable steps; found by making two similar subclass sequences identical, then pulling up.
- **Collecting Parameter** — pass an accumulator through a traversal spread over several objects.

---

## Part XVII: OO Design for Testability (GOOS detail)

### Values vs. Objects

Values have no identity and are usually immutable—create instances in tests. Objects have distinct identity and collaborate over time; verify their observable outcomes and mock a peer only when its outgoing protocol is the behavior. Create a domain value type when it protects units, validation, normalization, or meaningful operations; a behaviorless wrapper created only for style is ceremony. Discovery techniques: **breaking out**, **budding off** once a rule appears, and **bundling up** values that must remain consistent.

### Tell, Don't Ask

```java
// BAD: train wreck through internal structure
((EditSaveCustomizer) master.getModelisable()
    .getDockablePanel().getCustomizer())
    .getSaveItem().setEnabled(false);
// GOOD: tell in terms of the role
master.allowSavingOfCustomisations();
```

Queries are acceptable for values, collections, factory results — but describe intent, not implementation: `carriage.hasSeatsAvailableWithin(barrier)`, not `carriage.getSeats().getPercentReserved() < barrier`.

### Peer Stereotypes Detail

- **Dependencies** — required services; constructor; no safe default. Example: a graphics package needs a canvas.
- **Notifications** — fire-and-forget listeners; default to null object or empty collection; one-way: listeners may not return values, call back, or throw. Example: button click listeners.
- **Adjustments** — strategy parts; common defaults, swappable later. Example: a table cell renderer.

### Ports and Adapters

```
[External System] <-> [Adapter] <-> [Port (interface)] <-> [Domain Model]
```

Ports use the policy-side client's vocabulary; adapters translate boundary semantics. This structure is useful when inversion is earned by volatility, substitution, or ownership. A direct concrete dependency inside a cohesive module is simpler when no such seam exists. Layer placement and port ownership belong to `architecture-design`; vendor-boundary choices belong to `third-party-integration`.

### Context Independence

Whatever an object needs from its environment is passed in; relationships are defined separately from objects. A class using terms from multiple domains violates context independence unless it's a bridging layer. Test: describe what the object does without mentioning its system.

### Interface Design

- Narrow client-owned interfaces can clarify an earned role; fewer methods help only when the capability remains coherent.
- Do not create an interface merely to rename one concrete class. When an interface exists, name implementations by what is specific (`HttpBooking`, `InMemoryBooking`) rather than `BookingImpl`.
- Refactor contracts carefully: merge true duplicate concepts and split different roles, preserving downstream compatibility or treating the edit as an API change.

### Where Objects Come From

- **Breaking out** — object too complex → extract collaborators. "Break up an object if it becomes too large to test easily, or if its test failures become difficult to interpret." Consider rolling back and reimplementing cleanly.
- **Budding off** — need a service that doesn't exist → define the interface, mock it, implement later. "If this worked, who would know?" Follow the chain of discoveries until you connect to existing objects.
- **Bundling up** — cluster of objects always used together → package into a containing object; test the composite directly. "When the test is too complicated to set up, consider bundling up."
- **Composite simpler than the sum of its parts** — `moneyEditor.setValue(money)`, not per-field setters.

### Two-Layer Architecture

Implementation layer: the object graph that responds to events. Declarative layer: builds the implementation layer with small helpers and readable syntax — an embedded DSL. Different style rules per layer: strict OO below, chaining/static methods for readability above.

### Communication over Classification

Interfaces define roles, not classes; protocols (which messages, in what order) matter more than hierarchies; prefer delegation over inheritance. Mocks make communication protocols visible during development.

---

## Part XVIII: Process, Scaling, Metrics

### How TDD Leads to Frameworks

First feature: straightforward. Second (variation): common code in one place, differences in another. Third: common logic is reusable, unique logic has an obvious home. Open/Closed is satisfied for precisely the variations that occur in practice. "Code for tomorrow, design for today."

### Switching to TDD Midstream

Don't test everything and refactor everything at once. Limit scope; leave untouched parts alone. Break the chicken-and-egg deadlock with coarse feedback (system tests, pair programming, careful work) to enable refactoring toward testability. Over time, frequently-changed parts become test-driven.

### Tuning the Cycle

Reflect regularly: fiddly logic → more unit tests (or simplify the logic); unhandled exceptions → more integration tests; unexpected system failures → investigate, add tests at the appropriate level. The goal is justified confidence, not a universal unit/integration ratio.

### Retrospective Metrics (Siddiqui)

- **Cyclomatic complexity** — branches + loops + 1 per method; keep under 10. TDD naturally produces low complexity via small steps.
- **Coupling** — afferent (incoming) vs. efferent (outgoing) dependencies; instability = efferent / (efferent + afferent); lower is more stable. (Mnemonic: afferent = arriving, efferent = exiting.)
- **Succinctness** — compare test LOC to production LOC within the same language only.
- **Cohesion** — each module contributes to one well-defined task; avoid coincidental grouping.
- **Completeness** — check untested scenarios: overflow/underflow, division by zero, missing data, concurrent access, boundary values.
- **Least surprise** — use language idioms and community formatting; name entities after domain concepts.

### Separation of Concerns (Siddiqui)

Production behavior must not branch on a test mode. Place tests according to ecosystem conventions and the boundary they exercise: Rust commonly colocates private unit tests under `#[cfg(test)]` and uses `tests/` for public cross-crate integration; other languages use dedicated test source roots. File count and one-concept-per-file are design choices, not TDD rules.

### Deleting Tests

Keep for **confidence** or **communication**. Three checks before removing: coverage decrease? significant edge case? unique documentation value? All "no" → delete. Also: changing a test's *implementation* is fine during refactoring; changing its *purpose* needs justification. Write new tests for new behavior; refactor existing tests for changed signatures.
