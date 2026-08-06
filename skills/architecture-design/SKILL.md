---
name: architecture-design
description: "Application-level structure: Clean Architecture layering (domain/application/infrastructure, ports and adapters, use cases, composition root) and dependency direction toward business policy. Use when asking 'where does this code live?', 'which way should application-layer dependencies point?', 'how should I split application packages or crates by architectural responsibility?', when business logic is tangled with I/O and hard to test, or when placing invariants next to the data they protect. Language-agnostic; worked examples in Rust. Not for module/API interface depth (see simple-design), service or monolith splitting (see distributed-architecture), or behavior-preserving refactor mechanics (see refactoring)."
---

# Architecture Design

One rule, one recipe. Everything else escalates to the reference.

**The one rule: dependencies point toward policy and stability.** Core business policy does not depend on delivery, persistence, or framework details. When inversion is useful, the policy-side client owns the abstraction it needs; the adapter depends on and implements that contract. Depend in the direction of stability (SDP); no dependency cycles (ADP) — a cycle makes two packages one change unit. Group what changes together; split only when a boundary earns its cost.

- **Interface depth** ("is this module well-shaped?") → `simple-design`
- **Cross-deployable decisions** ("split the monolith?", sagas) → `distributed-architecture`

**Hats:** never review/refactor for design quality and add features in the same step. Note violations while building; fix them separately.

## Clean Architecture

```
┌────────────────────────────────────────────────────────┐
│  Infrastructure       Frameworks, DB, HTTP, GUI        │ ← outer
├────────────────────────────────────────────────────────┤
│  Application          Use cases, app policy, owned ports │
├────────────────────────────────────────────────────────┤
│  Domain               Business types, rules, pure policy │ ← inner
└────────────────────────────────────────────────────────┘
  Dependencies ALWAYS point inward →
```

### The Dependency Rule

Source-code dependencies point inward only; nothing inner knows about anything outer.

- `domain/` imports **nothing** from `application/` or `infrastructure/`
- `application/` depends on domain policy and types but **never** imports concrete infrastructure
- A port lives with the policy-side client that needs the capability: commonly application for gateways, sometimes domain for a genuinely domain-level collection or service. Do not put it beside the adapter merely because the adapter implements it
- Infrastructure depends inward to implement owned ports and translate at boundaries. Entry points and composition code may depend on concrete adapters to assemble the running system

### The recipe — start at the domain, work outward

Examples in Rust; the pattern is language-agnostic.

**Step 1: Domain.** Business logic and core types, zero outward imports. Name types and methods after business concepts (`order.submit()`, not `order.process()`). Put invariants on the types that own the data; use typed wrappers when a bare `String`/`f64` carries a rule (`Email`, `Money`). Whitelist valid state transitions when the lifecycle is small enough to enumerate.

```rust
pub struct Order {
    id: Uuid,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    pending_events: Vec<OrderFact>,
}

impl Order {
    pub fn submit(&mut self) -> Result<(), OrderError> {
        if self.items.is_empty() { return Err(OrderError::EmptyOrder); } // invariant
        // transition state; record OrderPlaced as a past-tense fact
    }
}
```

**Step 2: Application — use cases and earned ports.** A use case owns application policy: authorization, idempotency, transaction boundaries, sequencing, and coordination across domain objects. Put invariants intrinsic to a domain type in the domain; do not force application-specific workflow policy into it. Introduce a port when the policy needs an external capability and inversion pays for itself, not as one-interface-per-adapter ceremony.

```rust
pub trait OrderStore {
    fn load(&self, id: OrderId) -> Result<Option<Order>, StoreFailure>;
    fn save_with_events(
        &self,
        order: &Order,
        events: &[OrderFact],
    ) -> Result<(), StoreFailure>;
}

// SubmitOrder::execute:
//   1. reject/replay a duplicate command       (application policy)
//   2. load order                              (owned port)
//   3. order.submit()?                         (domain invariant)
//   4. save state + durable outbox records in one transaction
//   5. return the committed result
// A separate dispatcher publishes outbox records with retry + idempotency.
```

A database commit followed by direct publication has a crash gap: state can commit while the message is lost. For durable external effects, commit state and an outbox record atomically, then dispatch at least once; consumers must be idempotent. Direct post-commit publication is acceptable only when loss is explicitly tolerable or another recovery mechanism closes the gap.

**Step 3: Infrastructure.** Implement earned ports (in-memory, Postgres, Kafka…) and keep protocol, serialization, retry, and framework details in adapters. A new implementation should not change policy; a changed business capability may legitimately change its owned port.

**Step 4: Composition root.** `main`, a framework bootstrap, or a small wiring module owns construction of the object graph and cross-boundary bindings. It is not the only code allowed to name concrete types: adapters know their concrete dependencies and factories may compose local subgraphs. Keep business decisions and runtime work out of wiring code.

**Step 5: Adapters.** Every entry point (HTTP, CLI, GUI, REST) is just an adapter calling the same use case. UI state (spinners, form fields) is **not** domain state — keep a separate UI-state struct in the adapter.

### Modeling the inner layer (no ceremony)

Use only what the problem earns:

- **Business names** on types and methods; vague `process`/`handle`/`manage` often means the model is unclear.
- **Typed values** that refuse invalid construction when a primitive carries a rule.
- **One owner for a consistency cluster** — mutate related state through the type that enforces the invariants; application policy coordinates work across separate clusters by identity, not by reaching into children.
- **Past-tense facts** recorded with a state transition when something must leave the process later; they are not automatically public messages — map to versioned integration contracts at the deployable/service boundary and use an outbox when delivery must survive crashes.
- **State machines** — whitelist valid transitions so invalid ones are unrepresentable.

### Errors — translate at boundaries

Errors travel outward even though source dependencies point inward. Domain failures speak business language. Application contracts expose failures callers can act on (for example not found, conflict, denied, temporarily unavailable) and preserve useful causes for diagnostics. Adapters translate vendor/I/O failures into that contract, and driving adapters translate application failures into HTTP/CLI/UI responses. Do not create an error enum per directory or use automatic `#[from]` conversions when that leaks infrastructure vocabulary or collapses retryability.

### Testing — the payoff

- **Domain tests are pure** — no test doubles or infrastructure.
- **Application tests use simple fakes/stubs at earned ports** — verify policy and committed outcomes; assert call order only when order is part of the contract.
- **Adapter integration and contract tests** — exercise real protocol behavior and mapping at the boundary.

### Decision table

| Problem | Answer |
|---------|--------|
| "Where does this code go?" | Business rules → domain; orchestration → application; I/O → infrastructure |
| "Swap Postgres for SQLite?" | Implement the store port twice |
| "Add a CLI/GUI?" | New adapter; use cases and domain unchanged |
| "Where does validation live?" | Typed-value constructors + methods on the types that own the rule |
| "Where do errors change vocabulary?" | At a boundary; expose what the next caller can act on and preserve causes |
| "Where does DI happen?" | Object-graph assembly at composition roots; local construction may stay inside cohesive modules |

## Do Not Reach For

- **No port merely because a dependency is called infrastructure.** A concrete dependency behind a cohesive module is fine. A port is earned by a policy/detail boundary, volatile vendor semantics, a required substitute for fast deterministic tests, multiple real implementations, or an ownership/team seam. Put the port with its policy-side client and keep it as narrow as that client needs.
- **No modeling ceremony for CRUD data with no invariants.** "Nothing must always be true" means struct + functions is the honest model.
- **No layering for small tools and scripts.** The composition root of a 300-line CLI is `main()`.
- **Typed wrappers only where a primitive carries business meaning plus validation** — not every String.
- **Directory discipline before crate-per-layer enforcement.** Reach for separate packages/crates (or workspace-enforced layers) only when violations keep recurring.
- **SOLID as a checklist, not a religion.** SRP/OCP/LSP/ISP are restatements of depth, information hiding, and substitutability — apply them through the `simple-design` red flags. DIP and SDP are the two that anchor the layering above; the rest need no separate ceremony here.

## Reference loading

Read `references/reference.md` only when you need depth beyond this summary:

- Full layer walkthrough — input/output port design, controllers, UI adapters with testable UI state, composition-root wiring
- Testing detail — domain/application/integration test examples and the testing pyramid
- Rust modeling patterns — newtype, builder, typestate, serde integration, private-field encapsulation
- Anti-pattern detail — fat controllers, infrastructure leaking into domain, dual-write crash gaps, and fixes
- SOLID per-principle Rust patterns; component principles in depth (REP/CCP/CRP tension, ADP cycle-breaking, SDP/SAP); single-crate vs workspace layout with `Cargo.toml` enforcement; new-feature checklist

Do not load it for quick layer placement, the recipe, or the decision table above.
