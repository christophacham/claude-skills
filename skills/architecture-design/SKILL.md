---
name: architecture-design
description: "Use when designing or reviewing code structure in Rust codebases: Clean Architecture layering (domain/application/infrastructure, ports and adapters, use cases, composition root), tactical DDD (ubiquitous language, value objects, entities, aggregates, domain events, invariants), and SOLID plus component cohesion/coupling principles (REP/CCP/CRP, ADP/SDP/SAP) for modules, crates, and packages. Covers 'where does this code live?', 'which way should dependencies point?', 'how do I split this crate/module?', 'is this SOLID?', and testing business logic without infrastructure. Not for tech-stack selection, behavior-preserving refactors with no structural question, or system-level/service-topology architecture (see distributed-architecture)."
---

# Architecture Design

One toolkit, three scopes. Identify the scope first, then apply the matching section:

- **Type/trait level** → SOLID (§1)
- **Module/crate/package level** → Component principles (§1)
- **Application level** → Clean Architecture layering (§2) with tactical DDD modeling the innermost layer (§3)

**Hats:** never wear both at once. When reviewing/refactoring for design quality, don't add features; when adding features, note violations but fix them separately.

## 1. Design Principles

### SOLID — types and traits

| Principle | Rule | Apply when | Check |
|-----------|------|------------|-------|
| **SRP** | A type has exactly one reason to change | An `impl` block mixes unrelated concerns; one feature change keeps touching the same type | Count the audiences it serves; more than one → split |
| **OCP** | Open for extension, closed for modification | Adding a variant means editing match/if-else chains in several places | Can you add a variant in a new file only? Skip when the variant set is truly closed — exhaustive `match` is a feature, not a violation |
| **LSP** | Subtypes substitutable without altering correctness | A trait method panics for some implementors; callers check concrete types before calling | Can callers treat all implementors identically? The compiler enforces *type* substitutability; LSP is about *behavior* |
| **ISP** | No client forced to depend on methods it doesn't use | Fat trait (5+ methods) whose callers use disjoint subsets | Map callers per method; non-overlapping groups → split the trait |
| **DIP** | Depend on abstractions, not concretions; high-level policy never depends on low-level details | Business logic imports database/HTTP/filesystem types; testing logic needs a live DB | Does the core crate compile without the IO crates? |

**DIP and SDP are the anchors of the layering in §2** — the Dependency Rule is DIP applied to whole layers.

### Component principles — crates, packages, modules

Cohesion (what goes *in* a crate):

| Principle | Rule | Check |
|-----------|------|-------|
| **REP** | The granule of reuse is the granule of release | Would you version and release this code independently? Someone reusing part without wanting the rest → split |
| **CCP** | Types that change for the same reason ship together | Git history: files that co-change in commits belong together; a feature change consistently touching 3+ crates is a violation signal |
| **CRP** | Types used together ship together; types not used together don't | Do all consumers use roughly the same types? Disjoint consumer subsets → split (unused parts still cost transitive deps and re-versioning) |

REP/CCP/CRP are in tension — you can't satisfy all three. **Early in a project favor CCP** (ease of change); **as the project matures and gains users, shift toward CRP and REP**.

Coupling (what depends on what):

| Principle | Rule | Check |
|-----------|------|-------|
| **ADP** | No cycles in the dependency graph | A cycle makes the crates one indivisible unit — break by extracting the shared concept into a lower crate, or by inverting through a trait |
| **SDP** | Depend in the direction of stability | Instability `I = Ce / (Ca + Ce)` (Ca = dependents, Ce = dependencies). `I` should fall from leaf crates toward the core; a stable core depending on a volatile feature → invert through a trait |
| **SAP** | A crate should be as abstract as it is stable | Abstractness `A = Na / Nc`. Stable + concrete = Zone of Pain (rigid); unstable + abstract = Zone of Uselessness; aim near the main sequence |

## 2. Clean Architecture

```
┌────────────────────────────────────────────────────────┐
│  Infrastructure       Frameworks, DB, HTTP, GUI        │ ← outer
├────────────────────────────────────────────────────────┤
│  Application          Use cases, port traits           │
├────────────────────────────────────────────────────────┤
│  Domain               Entities, value objects, events  │ ← inner
└────────────────────────────────────────────────────────┘
  Dependencies ALWAYS point inward →
```

### The Dependency Rule

Source-code dependencies point inward only; nothing inner knows about anything outer.

- `domain/` imports **nothing** from `application/` or `infrastructure/`
- `application/` depends on `domain/` types but **never** imports `infrastructure/`
- `application/` defines traits (ports) that `infrastructure/` implements
- `infrastructure/` depends on everything; nothing depends on it

### The recipe — start at the domain, work outward

**Step 1: Domain.** Business logic and core types, zero outward imports.

```rust
// domain/entities.rs
pub struct Order {
    id: Uuid,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    pending_events: Vec<DomainEvent>,
}

impl Order {
    pub fn create(customer_email: Email) -> Self { .. }

    pub fn submit(&mut self) -> Result<(), OrderError> {
        if self.items.is_empty() { return Err(OrderError::EmptyOrder); } // invariant
        // transition state, record OrderPlaced event
    }
}
```

**Step 2: Application — ports, then use cases.** Ports are traits for what the application needs from infrastructure; one struct per use case, thin, orchestrating only.

```rust
// application/ports.rs
pub trait OrderRepository: Send + Sync {
    fn save(&self, order: &Order) -> Result<(), RepositoryError>;
    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, RepositoryError>;
}
pub trait EventBus: Send + Sync {
    fn publish(&self, events: Vec<DomainEvent>) -> Result<(), EventBusError>;
}

// application/use_cases.rs
impl<R: OrderRepository, E: EventBus> SubmitOrderUseCase<R, E> {
    pub fn execute(&self, order_id: Uuid) -> Result<SubmitOrderResult, SubmitOrderError> {
        let mut order = self.repository.find_by_id(order_id)?
            .ok_or(SubmitOrderError::OrderNotFound)?; // 1. fetch
        order.submit()?;                              // 2. domain validates
        let events = order.take_events();             // 3. collect events
        self.repository.save(&order)?;                // 4. persist FIRST
        self.event_bus.publish(events.clone())?;      // 5. side effects after
        Ok(SubmitOrderResult { order, events })       // 6. return
    }
}
```

Execution order matters: fetch → domain call → take events → **persist before side effects** (a failed event bus must not lose state) → return.

**Step 3: Infrastructure.** Implement the port traits (in-memory, Postgres, Kafka…). Swapping implementations never touches application or domain.

**Step 4: Composition root.** `main.rs` (or a wiring module) is the **only** place that knows all concrete types:

```rust
let repo = Arc::new(InMemoryOrderRepository::new());
let event_bus = Arc::new(KafkaEventBus::new());
let use_case = SubmitOrderUseCase::new(Arc::clone(&repo), event_bus);
let controller = OrderController::new(use_case);
```

**Step 5: Adapters.** Every entry point is just an adapter calling the same use case:

```
HTTP Controller ──┐
CLI Command     ──┼──→ SubmitOrderUseCase ──→ Domain (unchanged!)
GUI Button      ──┤
REST API        ──┘
```

UI state (loading spinners, error banners, form fields) is **not** domain state — keep a separate UI-state struct in the adapter.

### Errors — each layer owns its vocabulary

```rust
#[derive(Debug, thiserror::Error)]
pub enum SubmitOrderError {
    #[error("Order not found")]
    OrderNotFound,
    #[error("Invalid domain operation: {0}")]
    Domain(#[from] DomainOrderError),
    #[error("Repository error: {0}")]
    Repository(#[from] RepositoryError),
}
```

Domain errors speak business language; application errors add orchestration concerns; infrastructure errors add I/O detail. Map with `#[from]`.

### Testing — the payoff

- **Domain tests are pure** — no mocks, no infrastructure, milliseconds: `assert!(order.submit().is_err())`
- **Application tests mock the port traits** — assert on mock `EventBus` published counts
- **Integration tests** — few, slow, against real infrastructure (e.g. Postgres roundtrip)

### Decision table

| Problem | Solution |
|---------|----------|
| "Where does this code go?" | Business rules → `domain/`; orchestration → `application/`; I/O → `infrastructure/` |
| "Swap Postgres for SQLite?" | Implement the repository trait twice |
| "Add a GUI/CLI?" | New adapter in `infrastructure/` — use cases and domain unchanged |
| "Where does validation live?" | Value-object constructors + aggregate methods |
| "Where do error types go?" | Each layer defines its own; map upward with `#[from]` |
| "Where does DI happen?" | Composition root in `main.rs` only |
| "Entity or value object?" | Has identity/lifecycle? → Entity. Compared by attributes, replaceable? → Value Object |
| "Enum or `dyn` for events?" | **Enum** — Clone + Send + Sync + exhaustive matching for free |

### Rust implementation notes

| Concern | Pattern | Rationale |
|---------|---------|-----------|
| Port traits in use cases | `struct UseCase<R: OrderRepository>` generics | Zero-cost; no dyn dispatch |
| Shared dependencies | `Arc<R>` | Use cases shared across threads |
| Aggregate fields | Private + getter methods | Callers can't bypass invariant-enforcing methods |
| In-memory repos | `RwLock<HashMap<..>>` | Multi-reader, single-writer |
| Event buffer | `#[serde(skip)]` | Events aren't persisted with the aggregate |
| Dependency rule enforcement | Workspace: one crate per layer | `Cargo.toml` makes violations un-compilable; single crate relies on discipline |

### File layout (single crate)

```
src/
├── main.rs                   # Composition root
├── domain/        entities.rs · value_objects.rs · events.rs
├── application/   ports.rs · use_cases.rs
└── infrastructure/ persistence.rs · api.rs · ui.rs
tests/  domain_tests.rs · application_tests.rs
```

## 3. Tactical DDD — inside the domain layer

### Ubiquitous language

Code names = business names. If the business says "submit an order," the method is `order.submit()`, not `order.process()`. Applies to types (`Order`, `Money`), methods (`submit`, `cancel`), and errors (`EmptyOrder`). Warning signs: `process`, `handle`, `update`, `manage`, `set_status` — if you can't name it in business terms, the model may be wrong.

### Value objects — immutable, self-validating

```rust
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Email(String);

impl Email {
    pub fn new(email: impl Into<String>) -> Result<Self, EmailError> {
        let email = email.into();
        if !email.contains('@') { return Err(EmailError::MissingAtSign); }
        Ok(Self(email.to_lowercase()))  // validate + normalize at construction
    }
}
```

Rules: no setters; validate at construction so invalid state is unrepresentable; operations return new instances (`Money::add` rejects currency mismatch); derive `PartialEq`. Create one whenever a bare `String`/`f64` carries business meaning.

### Entities — identity over attributes

Defined by identity (`id: Uuid`), not attributes; equality is `id` equality; mutable only under the aggregate root's control. Child entities (e.g. `OrderLineItem`) are never referenced from outside the aggregate.

### Aggregate root — the consistency boundary

A cluster treated as a single unit. All mutations go through root methods that check invariants, mutate, then record an event:

```rust
pub fn add_item(&mut self, item: OrderLineItem) -> Result<(), OrderError> {
    if self.status != OrderStatus::Draft {
        return Err(OrderError::InvalidStateTransition(..)); // invariant first
    }
    self.items.push(item);                                       // then mutate
    self.pending_events.push(DomainEvent::ItemAddedToOrder(..)); // then record
    Ok(())
}
```

Rules: only the root has global identity; external code references only the root; the root enforces all invariants; children are accessed through root methods; the root decides which events to publish.

### Domain events — enum, not `dyn`

```rust
#[derive(Debug, Clone)]
pub enum DomainEvent {
    OrderPlaced(OrderPlaced),
    OrderCancelled(OrderCancelled),
    ItemAddedToOrder(ItemAddedToOrder),
}
```

Why enum in Rust: `dyn` + Serialize isn't object-safe; enums get Clone/Send/Sync for free; `match` is exhaustive; no `Box` allocation. Name events past tense (`OrderPlaced`, not `PlaceOrder` — that's a command). Collect with `take_events()` (`std::mem::take` of the buffer); the use case persists, then publishes.

### State machines — only valid transitions

```rust
impl OrderStatus {
    pub fn can_transition_to(&self, new: OrderStatus) -> bool {
        matches!((self, new),
            (Draft, Pending) | (Draft, Cancelled) |
            (Pending, Confirmed) | (Pending, Cancelled) |
            (Confirmed, Shipped) | (Shipped, Delivered))
    }
}
```

Enum + `matches!` gives an exhaustive, compiler-checked whitelist of transitions.

### Anti-patterns

```rust
// Anemic domain model — WRONG: data bag, logic in an external "OrderService"
pub struct Order { pub status: OrderStatus, pub items: Vec<OrderLineItem> }
// RIGHT: behavior on the entity — order.submit() enforces invariants

// Primitive obsession — WRONG: fn create_order(email: String, amount: f64)
// RIGHT: fn create_order(email: Email, price: Money) — invalid states unconstructable

// Bypassing the aggregate — WRONG: repo.save_order_item(order_id, item)
// RIGHT: order.add_item(item)?; repo.save(&order)?;
```

Also watch for: god aggregates (embed `customer_id`, not `Customer`), events named as commands, and logic-stuffed constructors (factory creates a Draft; commands operate).

## Reference loading

Read `references/reference.md` only when you need depth beyond this summary:

- Full layer walkthrough — input/output ports and port design guidelines, controllers, UI adapters with testable UI state, composition-root wiring
- Testing detail — full domain/application/integration test examples and the testing pyramid
- DDD depth — strategic patterns (bounded contexts, anti-corruption layer), domain services, repository rules, aggregate sizing, builder/typestate/newtype patterns, modeling decision tables
- Anti-pattern detail — fat controllers, infrastructure leaking into domain, event bus in the critical path, and fixes
- SOLID before/after code per principle; component-principle cycle-breaking patterns, the cohesion tension triad, SAP main sequence, and `cargo` diagnostic commands
- Single-crate vs workspace layout with `Cargo.toml` enforcement; new-feature checklist

Do not load it for quick layer placement, principle checks, or the decision tables above.
