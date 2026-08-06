---
name: architecture-design
description: "Application-level structure: Clean Architecture layering (domain/application/infrastructure, ports and adapters, use cases, composition root) and tactical DDD (value objects, entities, aggregates, domain events, invariants). Use when asking 'where does this code live?', 'which way should dependencies point?', 'how do I split this crate/package/module?', when business logic is tangled with I/O and hard to test, or when modeling domain invariants. Language-agnostic; worked examples in Rust. Not for module/API interface depth (see simple-design), service or monolith splitting (see distributed-architecture), or behavior-preserving refactor mechanics (see refactoring)."
---

# Architecture Design

One rule, one recipe, one model. Everything else escalates to the reference.

**The one rule: dependencies point toward stability; business rules depend on nothing.** Depend on abstractions, not concretions (DIP); depend in the direction of stability (SDP); no dependency cycles (ADP) — a cycle makes two packages one indivisible unit. Group what changes together; split what ships separately.

- **Interface depth** ("is this module well-shaped?") → `simple-design`
- **Cross-deployable decisions** ("split the monolith?", sagas) → `distributed-architecture`

**Hats:** never review/refactor for design quality and add features in the same step. Note violations while building; fix them separately.

## Clean Architecture

```
┌────────────────────────────────────────────────────────┐
│  Infrastructure       Frameworks, DB, HTTP, GUI        │ ← outer
├────────────────────────────────────────────────────────┤
│  Application          Use cases, port interfaces       │
├────────────────────────────────────────────────────────┤
│  Domain               Entities, value objects, events  │ ← inner
└────────────────────────────────────────────────────────┘
  Dependencies ALWAYS point inward →
```

### The Dependency Rule

Source-code dependencies point inward only; nothing inner knows about anything outer.

- `domain/` imports **nothing** from `application/` or `infrastructure/`
- `application/` depends on `domain/` types but **never** imports `infrastructure/`
- `application/` defines the port interfaces that `infrastructure/` implements
- `infrastructure/` depends on everything; nothing depends on it

### The recipe — start at the domain, work outward

Examples in Rust; the pattern is language-agnostic.

**Step 1: Domain.** Business logic and core types, zero outward imports.

```rust
pub struct Order {
    id: Uuid,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    pending_events: Vec<DomainEvent>,
}

impl Order {
    pub fn submit(&mut self) -> Result<(), OrderError> {
        if self.items.is_empty() { return Err(OrderError::EmptyOrder); } // invariant
        // transition state, record OrderPlaced event
    }
}
```

**Step 2: Application — ports, then use cases.** Ports are interfaces for what the application needs from infrastructure; one unit per use case, thin, orchestrating only.

```rust
pub trait OrderRepository: Send + Sync {
    fn save(&self, order: &Order) -> Result<(), RepositoryError>;
    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, RepositoryError>;
}

// SubmitOrderUseCase::execute:
//   1. fetch order          (port call)
//   2. order.submit()?      (domain validates)
//   3. take events          (collect from aggregate)
//   4. repository.save      (persist FIRST)
//   5. event_bus.publish    (side effects after)
//   6. return result
```

Execution order matters: fetch → domain call → take events → **persist before side effects** (a failed event bus must not lose state) → return.

**Step 3: Infrastructure.** Implement the ports (in-memory, Postgres, Kafka…). Swapping implementations never touches application or domain.

**Step 4: Composition root.** `main` (or a wiring module) is the **only** place that knows all concrete types — it constructs adapters and injects them into use cases.

**Step 5: Adapters.** Every entry point (HTTP, CLI, GUI, REST) is just an adapter calling the same use case. UI state (spinners, form fields) is **not** domain state — keep a separate UI-state struct in the adapter.

### Errors — each layer owns its vocabulary

Domain errors speak business language; application errors add orchestration concerns; infrastructure errors add I/O detail. Each layer defines its own error type; map upward (Rust: `#[from]`) instead of leaking inner types outward.

### Testing — the payoff

- **Domain tests are pure** — no mocks, no infrastructure, milliseconds.
- **Application tests mock the ports** — assert orchestration and side-effect order.
- **Integration tests** — few, slow, against real infrastructure.

## Tactical DDD — inside the domain layer

Four tools. Use only as much as the domain earns.

**Ubiquitous language.** Code names = business names: `order.submit()`, not `order.process()`. Warning signs: `process`, `handle`, `manage` — if you can't name it in business terms, the model may be wrong.

**Value objects — make invalid states unrepresentable.** Immutable, self-validating at construction, compared by value, no setters; operations return new instances (`Money::add` rejects currency mismatch). Create one whenever a bare `String`/`f64` carries business meaning *plus* a rule (`Email`, `Money`).

**Aggregates — the consistency boundary.** One root with identity; all mutations go through root methods that check invariants first, then mutate, then record an event. External code references only the root; children are reached through it. Reference other aggregates by ID (`customer_id`), not by embedding the object.

**Domain events — facts, past tense.** `OrderPlaced`, not `PlaceOrder` (that's a command). Collected on the aggregate (`take_events()`); the use case persists, then publishes. In Rust use an enum — Clone/Send/Sync and exhaustive matching for free (details in the reference).

**State machines.** Whitelist valid transitions (`can_transition_to`) so invalid ones are unrepresentable; exhaustive and compiler-checked where the language allows.

### Anti-patterns

- **Anemic domain model** — data bag + logic in an external "service". Put behavior on the entity: `order.submit()` enforces invariants.
- **Primitive obsession** — `create_order(email: String, amount: f64)`. Typed values make bad states unconstructable.
- **Bypassing the aggregate** — `repo.save_order_item(..)` skips invariants. Go through the root: `order.add_item(item)?; repo.save(&order)?;`
- **God aggregates** — embed `customer_id`, not `Customer`.
- **Logic-stuffed constructors** — a factory creates a valid Draft; commands operate after.

### Decision table

| Problem | Answer |
|---------|--------|
| "Where does this code go?" | Business rules → domain; orchestration → application; I/O → infrastructure |
| "Swap Postgres for SQLite?" | Implement the repository port twice |
| "Add a CLI/GUI?" | New adapter; use cases and domain unchanged |
| "Where does validation live?" | Value-object constructors + aggregate methods |
| "Where do error types go?" | Each layer its own; map upward |
| "Where does DI happen?" | Composition root only |
| "Entity or value object?" | Identity/lifecycle? → Entity. Compared by attributes, replaceable? → Value object |

## Do Not Reach For

- **No port for infrastructure with one implementation and no test-isolation need.** A concrete dependency you can extract later beats a permanent abstraction. Ports earn their place for: testing without I/O, a *real* second implementation, or a team seam.
- **No aggregates/DDD ceremony for CRUD data with no invariants.** "Nothing must always be true" means struct + functions is the honest model.
- **No layering for small tools and scripts.** The composition root of a 300-line CLI is `main()`.
- **Value objects only where a primitive carries business meaning plus validation** — not every String.
- **Directory discipline before crate-per-layer enforcement.** Reach for separate packages/crates (or workspace-enforced layers) only when violations keep recurring.
- **SOLID as a checklist, not a religion.** SRP/OCP/LSP/ISP are restatements of depth, information hiding, and substitutability — apply them through the `simple-design` red flags. DIP and SDP are the two that anchor the layering above; the rest need no separate ceremony here.

## Reference loading

Read `references/reference.md` only when you need depth beyond this summary:

- Full layer walkthrough — input/output port design, controllers, UI adapters with testable UI state, composition-root wiring
- Testing detail — domain/application/integration test examples and the testing pyramid
- DDD depth — strategic patterns (bounded contexts, anti-corruption layer), domain services, repositories, aggregate sizing
- Rust modeling patterns — newtype, builder, typestate, serde integration, private-field encapsulation
- Anti-pattern detail — fat controllers, infrastructure leaking into domain, event bus in the critical path, and fixes
- SOLID per-principle Rust patterns; component principles in depth (REP/CCP/CRP tension, ADP cycle-breaking, SDP/SAP); single-crate vs workspace layout with `Cargo.toml` enforcement; new-feature checklist

Do not load it for quick layer placement, the recipe, or the decision table above.
