---
name: third-party-integration
description: Patterns for integrating with third-party code in TDD from Freeman & Pryce's "Growing Object-Oriented Software, Guided by Tests." Use when wrapping external libraries, deciding whether to mock a dependency, writing integration tests, or when the user asks "should I mock this library" or "how do I test code that uses an external API." Covers the adapter layer pattern and the rule "only mock types that you own." Not for unit-testing code with no external dependencies or for choosing/evaluating libraries.
---

# Third-Party Integration

How to integrate external libraries and APIs while maintaining testability and clean design.

## Only Mock Types That You Own

### Why Not Mock Third-Party Types

1. **You don't fully understand them.** Even with source code, you rarely know all the quirks. Mocked behavior may not match reality.
2. **You can't respond to design feedback.** Mock-based tests signal design problems through awkwardness. If you can't change the API, you can't act on the signal.
3. **Tests become complex.** Getting external objects into the right state for testing produces messy tests. The mess is telling you the design is wrong, but you can't fix it.
4. **Stubbed behavior may drift.** Upgrades to the library can silently invalidate your mocked behavior.

### The Adapter Layer Pattern

Write a thin layer of adapter objects that bridge between your domain and the external API:

```
[Your Domain Code] -> [Port Interface (your terms)] -> [Adapter] -> [Third-Party API]
```

**Port interface:** Defined in your domain's vocabulary. Discovered through TDD of your domain code.

**Adapter:** Implements the port interface. Maps between your domain objects and the external API's types. Keep as thin as possible.

**Testing strategy:**
- **Unit tests** for domain code mock the port interface (which you own)
- **Integration tests** for adapters verify your understanding of the third-party API
- Integration tests are fewer than unit tests and may be slower -- that's fine

```
Domain Code Tests:              Integration Tests:
+------------------+            +------------------+
| Domain Object    |            | Adapter          |
| mock(Port)       |            | real(ThirdParty)  |
| verify behavior  |            | verify mapping   |
+------------------+            +------------------+
```

### Worked Example (Python)

```python
# Port: defined in your domain's vocabulary, discovered through TDD
class ReportStore(Protocol):
    def save(self, report: Report) -> None: ...

# Domain code talks only to the port -- unit tests mock ReportStore
class ReportService:
    def __init__(self, store: ReportStore): self.store = store
    def publish(self, report: Report): self.store.save(report)

# Adapter: thin translation to the third-party API, nothing more
class S3ReportStore:  # adapts boto3
    def __init__(self, s3_client, bucket: str):
        self.s3, self.bucket = s3_client, bucket
    def save(self, report: Report) -> None:
        self.s3.put_object(Bucket=self.bucket,
                           Key=f"{report.id}.json",
                           Body=report.to_json())
```

### Benefits

- **Domain vocabulary stays clean.** Technical concepts don't leak into your domain model.
- **Adapters are swappable.** Change from FTP to HTTP? Replace the adapter, domain code unchanged.
- **Tests run fast.** Domain tests use mocks; only adapter tests need real external resources.
- **Upgrade safety.** When the library changes, you update the adapter and its integration tests. Domain tests are unaffected.

## Adapter Callbacks (Event-Based Integration)

When external libraries call *back* into your code (events, callbacks):

```
[Third-Party Library] -> [Adapter Callback] -> translates -> [Application Callback]
```

1. Your application defines its own callback interface in domain terms
2. The adapter creates a callback object for the external library
3. The adapter callback receives external events and translates them for the application callback

**Testing:** In integration tests, mock the **application callback** (which you own) to verify the adapter translates events correctly. Do NOT mock the third-party callback interface.

```
// Integration test for event adapter (illustrative pseudocode)
// Real: third-party library emits events naturally -- no expectations set on it
// Mocked: your application callback interface -- the only place expectations are set
adapter.register(thirdPartyLib);
thirdPartyLib.emit("external.event", externalPayload);   // drive the real library
oneOf(applicationListener).onDomainEvent(translatedEvent); // expect on the callback you own
```

## When Mocking Third-Party Types Is Acceptable

There are narrow exceptions:

- **Simulating hard-to-trigger behavior:** e.g., exceptions that are difficult to cause naturally
- **Testing call sequences:** e.g., verifying a transaction is rolled back on failure
- These should be **rare** in the test suite

## Value Types from External Libraries

The adapter pattern applies to services, not values. For value types:

- Fundamental types (strings, dates) can be used directly
- Domain-specific external values should often be translated to your own domain types
- Follow the same isolation principle, but no need for mocking

## Integration Testing Heuristics

| Question | Guidance |
|----------|----------|
| How many integration tests? | Far fewer than unit tests. Cover key behaviors and edge cases of the external API. |
| What do they test? | Your understanding of how the API works. Configuration. Error handling. |
| How fast should they be? | Slower is acceptable. Don't let them block the fast feedback loop of unit tests. |
| Where do threading issues appear? | Often at the adapter layer. Third-party libraries may use background threads. Design synchronization into adapter layer explicitly. |

## Decision Checklist

When working with third-party code:

1. **Define the interface you wish you had** in your domain's terms (the port)
2. **Write domain code** against that interface using mocks
3. **Implement the adapter** to bridge to the real API
4. **Write integration tests** to verify the adapter works with the real library
5. **Keep the adapter thin** -- no business logic, just translation
6. **Don't mock the third-party API** in domain tests -- mock the port instead
7. **Handle threading and async** explicitly in the adapter layer

See also: the `testing-tdd` skill for the TDD workflow used to discover the port interface and drive the domain code.
