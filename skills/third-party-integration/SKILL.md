---
name: third-party-integration
description: Patterns for integrating with third-party code in TDD from Freeman & Pryce's "Growing Object-Oriented Software, Guided by Tests." Use when wrapping external libraries, deciding whether to mock a dependency, writing integration tests, or when the user asks "should I mock this library" or "how do I test code that uses an external API." Covers the adapter layer pattern and the rule "only mock types that you own." Not for unit-testing code with no external dependencies or for choosing/evaluating libraries.
---

# Third-Party Integration

Specialist guidance for the **vendor contract boundary**: discover the assumptions your application relies on, decide whether translation is earned, and verify those assumptions against the real protocol. It does not require a wrapper around every dependency.

## Only Mock Types That You Own

### Why Not Mock Third-Party Types

1. **You don't fully understand them.** Even with source code, you rarely know all the quirks. Mocked behavior may not match reality.
2. **You can't respond to design feedback.** Mock-based tests signal design problems through awkwardness. If you can't change the API, you can't act on the signal.
3. **Tests become complex.** Getting external objects into the right state for testing produces messy tests. The mess is telling you the design is wrong, but you can't fix it.
4. **Stubbed behavior may drift.** Upgrades to the library can silently invalidate your mocked behavior.

### Decide Whether an Adapter Is Earned

Start with the vendor SDK/client directly inside a cohesive boundary module when it is already a good fit, its types do not leak into policy, and tests can exercise it cheaply. Add an owned port + adapter when one or more current pressures exist:

- vendor vocabulary/types would leak into domain or application policy
- the application needs different semantics (idempotency, batching, retries, pagination, error classification)
- several call sites would otherwise duplicate mapping or vendor quirks
- a volatile vendor/protocol must be isolated from stable policy
- a fast deterministic substitute is needed at a meaningful policy/detail seam
- multiple real providers implement the same application capability

```
[Policy-side client] -> [owned capability, if earned] -> [adapter] -> [vendor]
```

The policy-side client owns the smallest interface it needs; do not mirror the vendor's whole API. The adapter owns translation and boundary policy, but not domain decisions. If it merely forwards every call and type unchanged, remove it until it has knowledge to hide.

**Testing strategy:**
- Policy tests use real in-process code and simple fakes/stubs only at an earned owned capability
- Adapter contract tests exercise the real service sandbox, official emulator, or protocol-level fake server and verify translation
- A small live smoke suite catches credentials, quotas, and vendor drift that local tests cannot

```
Application policy tests:       Adapter contract tests:
+----------------------+        +------------------+
| Application service  |        | Adapter          |
| fake(OwnedPort)      |        | real(ThirdParty)  |
| verify outcome/state |        | verify mapping   |
+----------------------+        +------------------+
```

### Worked Example (Python)

```python
# Earned port: application policy needs report storage without S3 vocabulary
class ReportStore(Protocol):
    def save(self, report: Report) -> None: ...

# Application orchestration uses the port; domain Report remains provider-free.
class PublishReport:
    def __init__(self, store: ReportStore): self.store = store
    def execute(self, report: Report): self.store.save(report)

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

- **Vocabulary stays local.** S3 buckets/keys/errors do not become report policy.
- **Vendor change has one owner.** Upgrade changes are concentrated where translation and contract tests live.
- **Policy feedback stays fast.** A small owned fake can exercise report behavior without pretending to be boto3.
- **Replacement is possible when semantics really match.** Do not promise “swappable providers” unless the owned capability and error/idempotency guarantees are genuinely common.

## Adapter Callbacks (Event-Based Integration)

When external libraries call *back* into your code (events, callbacks):

```
[Third-Party Library] -> [Adapter Callback] -> translates -> [Application Callback]
```

1. Register the vendor callback/webhook in the boundary adapter
2. Verify signatures/authenticity, parse and validate the external payload, and deduplicate redelivery
3. Translate to an owned application command/event only when the application semantics differ
4. Acknowledge according to the vendor's retry contract; keep slow work off the callback thread/request when required

**Testing:** Drive the real callback mechanism, sandbox, captured fixture validated against schema, or a protocol fake server. Observe an owned application sink/handler. Do not mock the third-party callback type and call your own mock setup “integration.” Test duplicates, out-of-order delivery, invalid signatures, retries, and concurrent callbacks when the vendor permits them.

```
// Integration test for event adapter (illustrative pseudocode)
// Real: third-party library emits events naturally -- no expectations set on it
// Mocked: your application callback interface -- the only place expectations are set
adapter.register(thirdPartyLib);
thirdPartyLib.emit("external.event", externalPayload);   // drive the real library
oneOf(applicationListener).onDomainEvent(translatedEvent); // expect on the callback you own
```

## Simulating Difficult Vendor Behavior

Do not mock a vendor class merely because a failure is hard to trigger. Prefer, in order:

1. the vendor's sandbox/emulator/fault-injection controls
2. a local fake HTTP/MQ server that speaks the wire protocol
3. recorded fixtures replayed below your adapter, with a small live suite guarding drift
4. an owned transport seam that injects timeout/reset/rate-limit responses

A framework mock of the SDK can be a temporary characterization aid in legacy code, but it proves only how your stub was configured. Keep it out of contract claims and replace it as the boundary becomes testable.

## Value Types from External Libraries

The adapter pattern applies to services, not values. For value types:

- Fundamental types (strings, dates) can be used directly
- Domain-specific external values should often be translated to your own domain types
- Follow the same isolation principle, but no need for mocking

## Build the Vendor Contract Inventory

Record only assumptions the application depends on, with one test or operational check per risk:

- authentication scopes, tenant/account and endpoint selection
- request serialization, units, time zones, precision, size limits, and pagination
- success semantics, partial success, vendor error codes, and retryability
- timeouts/cancellation, rate limits, backoff hints, quotas, and circuit behavior
- idempotency keys, duplicate requests, webhook/message IDs, ordering, and replay windows
- concurrency/thread-safety and callback execution model
- API/schema version, deprecation signal, SDK version, and upgrade smoke test

Keep this inventory beside the adapter tests or runbook, not as a copy of all vendor documentation. Unknown assumptions become a learning test or explicit spike before production policy depends on them.

## Integration Testing Heuristics

| Question | Guidance |
|----------|----------|
| How many contract tests? | Enough to cover every material assumption and high-cost failure; count follows risk, not a fixed pyramid ratio. |
| What do they test? | Real boundary behavior and your translation: config/auth, mapping, errors, pagination, retry/idempotency, callbacks, and version drift. |
| Where do they run? | Fast protocol/emulator tests in CI; sandbox/live smoke tests at a reliable cadence with isolated tenant/data and bounded cost. |
| How do failures stay diagnosable? | Capture sanitized request IDs/status/headers, distinguish product failure from vendor outage, and never log secrets. |
| Where do threading issues appear? | Often in SDK callbacks/background workers; test synchronization and shutdown at the adapter boundary rather than sleeping. |

## Decision Checklist

When working with third-party code:

1. **List the vendor assumptions** the feature depends on and learn unknown behavior against the real contract.
2. **Choose the smallest boundary:** direct SDK use inside a cohesive module, a translation adapter, or an owned port + adapter when current pressures earn it.
3. **Keep vendor types and errors out of business policy** when their semantics do not belong there; map retryability, partial success, and idempotency explicitly.
4. **Test at two speeds:** fast policy tests using an owned substitute only when needed, plus adapter contract tests against the protocol/emulator/sandbox.
5. **Design operational behavior:** deadlines, cancellation, retries/backoff, rate limits, observability, credential redaction, and shutdown/threading.
6. **Guard upgrades:** pin versions as appropriate, run contract/smoke tests, read deprecations, and canary high-risk changes.
7. **Do not claim substitutability or universal wrappers:** a shallow pass-through adds maintenance without isolating meaning.

See `testing-tdd` for cycle/test-design mechanics and `architecture-design` for application-level port placement. This skill owns the vendor-contract decision and verification details.
