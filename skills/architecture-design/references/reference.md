# Architecture Design — Deep Reference

Load conditions are listed in `SKILL.md`. Everything here expands a pattern the summary already names; the canonical example throughout is the Order aggregate (`Email`, `Money`, `Sku`, `OrderLineItem`, `Order`).

## Table of Contents

1. [Layer Walkthrough](#layer-walkthrough) — ports, use cases, error mapping, repositories, controllers, UI adapters, composition root
2. [Testing Strategy](#testing-strategy) — domain, application, integration, pyramid
3. [Tactical DDD in Depth](#tactical-ddd-in-depth) — value objects, entities, aggregates, events, invariants, domain services, repositories
4. [Strategic DDD](#strategic-ddd) — bounded contexts, anti-corruption layer
5. [Rust Modeling Patterns](#rust-modeling-patterns) — newtype, builder, typestate, serde
6. [Modeling Decisions](#modeling-decisions)
7. [Anti-Patterns in Detail](#anti-patterns-in-detail)
8. [Project Layout](#project-layout) — single crate vs workspace, file map, new-feature checklist
9. [SOLID — Per-Principle Rust Patterns](#solid--per-principle-rust-patterns)
10. [Component Principles in Depth](#component-principles-in-depth)
11. [DDD vs Clean Architecture](#ddd-vs-clean-architecture)

---

## Layer Walkthrough

### Port interfaces

Ports are the contracts between application and outside world — traits defined in `application/`, implemented in `infrastructure/`.

**Output ports (driven) — what the application needs:**

```rust
// application/ports.rs
pub trait OrderRepository: Send + Sync {
    fn save(&self, order: &Order) -> Result<(), RepositoryError>;
    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, RepositoryError>;
    fn find_by_customer(&self, email: &Email) -> Result<Vec<Order>, RepositoryError>;
    fn find_by_status(&self, status: OrderStatus) -> Result<Vec<Order>, RepositoryError>;
}

pub trait EventBus: Send + Sync {
    fn publish(&self, events: Vec<DomainEvent>) -> Result<(), EventBusError>;
}

pub trait EmailService: Send + Sync {
    fn send_order_confirmation(&self, order: &Order) -> Result<(), EmailError>;
    fn send_order_cancellation(&self, order: &Order, reason: &str) -> Result<(), EmailError>;
}
```

**Input ports (driving) — how the outside calls in:**

```rust
pub trait SubmitOrder: Send + Sync {
    type Output;
    fn execute(&self, order_id: Uuid) -> Self::Output;
}
```

**Port design guidelines:**

- One trait per concern — never mix persistence and messaging in one port
- `Send + Sync` bounds — use cases are shared across threads
- Methods return `Result` with port-specific error types
- Name after the capability, not the implementation: `OrderRepository`, not `PostgresOrderStore`

### Use cases

One struct per business action, generic over port traits. Orchestrate; never contain business rules.

The struct and `execute` body match SKILL.md §2, extended with a third port for notifications — an extra generic parameter, field, and one best-effort step after publishing:

```rust
pub struct SubmitOrderUseCase<R: OrderRepository, E: EventBus, M: EmailService> {
    repository: Arc<R>,
    event_bus: Arc<E>,
    email_service: Arc<M>,
}

// inside execute(), after self.event_bus.publish(events.clone())?:
let _ = self.email_service.send_order_confirmation(&order); // 6. best-effort notify
```

**Execution order:** fetch → aggregate method → take events → **persist before side effects** → publish/notify → return. Persisting first means a down event bus loses nothing; the publish can be retried.

### Error mapping

Each layer defines its own error types; use cases map upward with `#[from]`:

The enum matches SKILL.md §2 (`OrderNotFound`, `Domain`, `Repository`), plus one more variant for the event bus:

```rust
#[error("Failed to publish events: {0}")]
EventBus(#[from] EventBusError),
```

Why per layer: domain errors speak business language (`EmptyOrder`), application errors add orchestration concerns (`OrderNotFound`), infrastructure errors add I/O detail (`ConnectionTimeout`) — and each layer can evolve independently.

### Repository implementations

```rust
// infrastructure/persistence.rs
pub struct InMemoryOrderRepository {
    orders: RwLock<HashMap<Uuid, Order>>,
}

impl OrderRepository for InMemoryOrderRepository {
    fn save(&self, order: &Order) -> Result<(), RepositoryError> {
        let mut orders = self.orders.write()
            .map_err(|_| RepositoryError::DatabaseError("Lock poisoned".into()))?;
        orders.insert(order.id(), order.clone());
        Ok(())
    }

    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, RepositoryError> {
        let orders = self.orders.read()
            .map_err(|_| RepositoryError::DatabaseError("Lock poisoned".into()))?;
        Ok(orders.get(&id).cloned())
    }
}
```

Real infrastructure implements the same trait — `PostgresOrderRepository { pool: PgPool }`, SQLite, DynamoDB — with zero application-layer change.

### API controllers

Thin translators: transport format → use case input, use case output → transport response. No business logic.

```rust
// infrastructure/api.rs
impl OrderController {
    pub fn submit_order(&self, req: SubmitOrderRequest) -> ApiResponse<SubmitOrderResponse> {
        match self.service.submit_order.execute(req.order_id) {
            Ok(result) => ApiResponse::success(SubmitOrderResponse {
                order_id: result.order.id().to_string(),
                status: format!("{:?}", result.order.status()),
                total: format!("{}", result.order.total().amount()),
                events_published: result.events.len(),
            }),
            Err(e) => ApiResponse::error(e.to_string()),
        }
    }
}
```

### UI adapters

A GUI is structurally identical to the HTTP controller — same use cases, different caller. **UI state ≠ domain state**: the domain `Order` knows nothing about loading spinners, error banners, or form fields.

```rust
// infrastructure/ui.rs
#[derive(Debug, Default)]
pub struct OrderFormState {
    pub customer_email: String,              // form input
    pub error_message: Option<String>,       // error banner
    pub success_message: Option<String>,     // toast
    pub pending_orders: Vec<UiOrderSummary>, // list view data
    pub is_loading: bool,                    // spinner
}

#[derive(Debug, Clone)]
pub struct UiOrderSummary {
    pub order_id: Uuid,
    pub total: String,      // pre-formatted for display
    pub item_count: usize,
    pub status: String,     // human-readable
}

pub struct OrderView {
    submit_order: Arc<SubmitOrderUseCase<..>>,
    cancel_order: Arc<CancelOrderUseCase<..>>,
}

impl OrderView {
    pub fn on_submit_clicked(&self, state: &mut OrderFormState, order_id: Uuid) {
        state.is_loading = true;
        state.error_message = None;
        match self.submit_order.execute(order_id) {   // same call as HTTP
            Ok(result) => state.success_message = Some(format!(
                "Order placed! Total: ${}", result.order.total().amount())),
            Err(e) => state.error_message = Some(e.to_string()),
        }
        state.is_loading = false;
    }
}
```

Wiring — same use case, two adapters:

```rust
let submit_use_case = Arc::new(SubmitOrderUseCase::new(Arc::clone(&repo), event_bus, email_service));
let api = OrderController::new(submit_use_case.clone());  // HTTP
let view = OrderView::new(submit_use_case);               // GUI
```

Testing UI logic without a window — drive the adapter, assert on UI state:

```rust
#[test]
fn test_ui_submit_empty_order_shows_error() {
    let (view, _repo) = build_ui();
    let mut state = OrderFormState::default();
    view.on_create_order_clicked(&mut state, "bob@test.com".into());
    let order_id = state.pending_orders[0].order_id;
    view.on_submit_clicked(&mut state, order_id);
    assert!(state.error_message.unwrap().contains("no items"));
}
```

What changes when adding a new adapter:

| Layer | Changed? | What |
|-------|----------|------|
| Domain | No | Business logic unchanged |
| Application | No | Use cases, ports unchanged |
| Infrastructure | New file | Adapter calling the use cases |
| Composition root | New wiring | Inject use cases into the new adapter |

### Composition root

The single place all dependencies are wired — the **only** code that knows concrete implementations:

```rust
// main.rs
let repository = Arc::new(InMemoryOrderRepository::new());
let event_bus = Arc::new(LoggingEventBus::new());
let email_service = Arc::new(LoggingEmailService::new());

let create_order = CreateOrderUseCase::new(Arc::clone(&repository));
let submit_order = SubmitOrderUseCase::new(Arc::clone(&repository), event_bus, email_service);

let controller = OrderController::new(OrderService { create_order, submit_order, .. });
```

Guidelines: lives in `main.rs` or a dedicated wiring module; swapping an implementation is a one-line change here; tests substitute mocks at this seam.

---

## Testing Strategy

```
      /  Integration  \     ← few, slow, real infrastructure
     /  Application    \    ← moderate, mocked ports
    /  Domain           \   ← many, fast, pure logic
```

### Domain tests — pure

No mocks, no setup, milliseconds:

```rust
#[test]
fn test_email_validation() {
    assert!(Email::new("valid@example.com").is_ok());
    assert!(Email::new("").is_err());
    assert!(Email::new("no-at-sign").is_err());
    assert!(Email::new("missing@").is_err());
}

#[test]
fn test_money_prevents_cross_currency() {
    let usd = Money::usd(Decimal::from(10));
    let eur = Money::new(Decimal::from(10), Currency::EUR);
    assert!(usd.add(&eur).is_err());
}

#[test]
fn test_order_lifecycle() {
    let mut order = Order::create(Email::new("t@t.com").unwrap());
    assert_eq!(order.status(), OrderStatus::Draft);
    order.add_item(test_item()).unwrap();
    order.submit().unwrap();
    assert_eq!(order.status(), OrderStatus::Pending);
    order.cancel("changed mind").unwrap();
    assert_eq!(order.status(), OrderStatus::Cancelled);
}

#[test]
fn test_cannot_submit_empty_order() {
    let mut order = Order::create(Email::new("t@t.com").unwrap());
    assert!(matches!(order.submit(), Err(OrderError::EmptyOrder)));
}

#[test]
fn test_cannot_add_item_after_submit() {
    let mut order = Order::create(Email::new("t@t.com").unwrap());
    order.add_item(test_item()).unwrap();
    order.submit().unwrap();
    assert!(order.add_item(test_item()).is_err());
}

#[test]
fn test_submit_records_order_placed_event() {
    let mut order = Order::create(Email::new("t@t.com").unwrap());
    order.add_item(test_item()).unwrap();
    let _ = order.take_events();          // clear ItemAdded
    order.submit().unwrap();
    let events = order.take_events();
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0], DomainEvent::OrderPlaced(_)));
}

#[test]
fn test_state_machine_transitions() {
    use OrderStatus::*;
    assert!(Draft.can_transition_to(Pending));
    assert!(Pending.can_transition_to(Confirmed));
    assert!(!Draft.can_transition_to(Shipped));
    assert!(!Cancelled.can_transition_to(Pending));
}
```

### Application tests — mocked ports

```rust
struct MockOrderRepository { orders: Mutex<Vec<Order>> }

impl OrderRepository for MockOrderRepository {
    fn save(&self, order: &Order) -> Result<(), RepositoryError> {
        self.orders.lock().unwrap().push(order.clone());
        Ok(())
    }
    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, RepositoryError> {
        Ok(self.orders.lock().unwrap().iter().find(|o| o.id() == id).cloned())
    }
}

struct MockEventBus { published: Mutex<Vec<DomainEvent>> }

impl EventBus for MockEventBus {
    fn publish(&self, events: Vec<DomainEvent>) -> Result<(), EventBusError> {
        self.published.lock().unwrap().extend(events);
        Ok(())
    }
}

#[test]
fn test_submit_order_publishes_events() {
    let repo = Arc::new(MockOrderRepository::new());
    let event_bus = Arc::new(MockEventBus::new());
    let mut order = Order::create(Email::new("t@t.com").unwrap());
    order.add_item(test_item()).unwrap();
    let order_id = order.id();
    repo.save(&order).unwrap();

    let uc = SubmitOrderUseCase::new(repo, event_bus.clone(), mock_email());
    let result = uc.execute(order_id).unwrap();

    assert!(result.events.iter().any(|e| e.event_type() == "OrderPlaced"));
    assert_eq!(event_bus.published.lock().unwrap().len(), 2); // ItemAdded + OrderPlaced
}
```

### Integration tests — real infrastructure

```rust
#[tokio::test]
async fn test_postgres_repository_roundtrip() {
    let pool = test_pool().await;
    let repo = PostgresOrderRepository::new(pool);
    let order = Order::create(Email::new("t@t.com").unwrap());
    repo.save(&order).unwrap();
    assert!(repo.find_by_id(order.id()).unwrap().is_some());
}
```

---

## Tactical DDD in Depth

### Value objects

Full versions of `Money` and `Sku`; `Email`'s compact form is in SKILL.md §3 — the production constructor adds these branches:

```rust
// domain/value_objects.rs

/// Email — beyond the SKILL.md compact version: reject empty input and missing domain
if email.is_empty() { return Err(EmailError::Empty); }
let parts: Vec<&str> = email.split('@').collect();
if parts.len() != 2 || parts[1].is_empty() {
    return Err(EmailError::MissingDomain);
}
// plus an accessor:
pub fn as_str(&self) -> &str { &self.0 }

/// Money — prevents cross-currency operations at the type level
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Money {
    amount: Decimal,
    currency: Currency,
}

impl Money {
    pub fn new(amount: Decimal, currency: Currency) -> Self { Self { amount, currency } }
    pub fn usd(amount: Decimal) -> Self { Self::new(amount, Currency::USD) }
    pub fn amount(&self) -> Decimal { self.amount }

    pub fn add(&self, other: &Money) -> Result<Money, MoneyError> {
        if self.currency != other.currency {
            return Err(MoneyError::CurrencyMismatch(self.currency, other.currency));
        }
        Ok(Money::new(self.amount + other.amount, self.currency))
    }

    pub fn multiply(&self, quantity: u32) -> Money {
        Money::new(self.amount * Decimal::from(quantity), self.currency)
    }
}

/// Sku — always uppercase, hashable
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Sku(String);

impl Sku {
    pub fn new(sku: impl Into<String>) -> Self { Self(sku.into().to_uppercase()) }
    pub fn as_str(&self) -> &str { &self.0 }
}
```

Common value objects:

| Type | Wraps | Validates |
|------|-------|-----------|
| Email | String | Format, normalization |
| Money | (Decimal, Currency) | Currency matching on operations |
| Sku | String | Normalization (uppercase) |
| PhoneNumber | String | Format, country code |
| Address | (street, city, …) | Required fields |
| DateRange | (start, end) | start < end |
| Percentage | f64 | 0.0..=100.0 |

### Entities

Child entity within the Order aggregate:

```rust
#[derive(Debug, Clone)]
pub struct OrderLineItem {
    pub sku: Sku,          // value object
    pub product_name: String,
    pub unit_price: Money, // value object
    pub quantity: u32,
}

impl OrderLineItem {
    pub fn subtotal(&self) -> Money { self.unit_price.multiply(self.quantity) }
}
```

Rules: unique identifier; equality is identity equality; mutable only within the aggregate root's control.

### Aggregate root — complete Order

```rust
pub struct Order {
    id: Uuid,
    customer_email: Email,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    pending_events: Vec<DomainEvent>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Order {
    /// Factory — the only way to create an Order; always starts Draft
    pub fn create(customer_email: Email) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            customer_email,
            status: OrderStatus::Draft,
            items: Vec::new(),
            pending_events: vec![],
            created_at: now,
            updated_at: now,
        }
    }

    // Getters — controlled read access; fields stay private
    pub fn id(&self) -> Uuid { self.id }
    pub fn status(&self) -> OrderStatus { self.status }
    pub fn items(&self) -> &[OrderLineItem] { &self.items }

    /// Command: add item — INVARIANT: only to Draft orders
    pub fn add_item(&mut self, item: OrderLineItem) -> Result<(), OrderError> {
        if self.status != OrderStatus::Draft {
            return Err(OrderError::InvalidStateTransition {
                from: self.status,
                action: "add_item".into(),
            });
        }
        let sku = item.sku.as_str().to_string();
        let quantity = item.quantity;
        self.items.push(item);            // mutate first
        self.updated_at = Utc::now();
        self.pending_events.push(DomainEvent::ItemAddedToOrder(ItemAddedToOrder {
            order_id: self.id,
            sku,
            quantity,
            occurred_at: Utc::now(),
        }));                              // then record the event
        Ok(())
    }

    /// Command: submit — INVARIANTS: not empty, valid transition
    pub fn submit(&mut self) -> Result<(), OrderError> {
        if self.items.is_empty() {
            return Err(OrderError::EmptyOrder);
        }
        if !self.status.can_transition_to(OrderStatus::Pending) {
            return Err(OrderError::InvalidStateTransition {
                from: self.status,
                action: "submit".into(),
            });
        }
        self.status = OrderStatus::Pending;
        self.updated_at = Utc::now();
        self.pending_events.push(DomainEvent::OrderPlaced(OrderPlaced {
            order_id: self.id,
            customer_email: self.customer_email.as_str().to_string(),
            total_amount: self.total().amount(),
            occurred_at: Utc::now(),
        }));
        Ok(())
    }

    /// Command: cancel — INVARIANT: only Draft or Pending
    pub fn cancel(&mut self, reason: impl Into<String>) -> Result<(), OrderError> {
        if !matches!(self.status, OrderStatus::Draft | OrderStatus::Pending) {
            return Err(OrderError::InvalidStateTransition {
                from: self.status,
                action: "cancel".into(),
            });
        }
        self.status = OrderStatus::Cancelled;
        self.updated_at = Utc::now();
        self.pending_events.push(DomainEvent::OrderCancelled(OrderCancelled {
            order_id: self.id,
            reason: reason.into(),
            occurred_at: Utc::now(),
        }));
        Ok(())
    }

    /// Query: total is computed, not stored — always consistent
    pub fn total(&self) -> Money {
        self.items.iter()
            .map(|i| i.subtotal())
            .fold(Money::usd(Decimal::ZERO), |acc, m| acc.add(&m).unwrap())
    }

    pub fn take_events(&mut self) -> Vec<DomainEvent> {
        std::mem::take(&mut self.pending_events)
    }
}
```

**Aggregate root rules:**

1. Only the root has global identity
2. External objects reference ONLY the root
3. The root enforces all invariants for the cluster
4. Children are accessed through root methods only
5. The root decides which events to publish
6. One transaction = one aggregate

**Sizing aggregates:** too large → performance problems and contention; too small → invariants can't be enforced. Right size: everything needed to enforce its invariants, nothing more.

### Domain events

```rust
// domain/events.rs
// The DomainEvent enum itself is in SKILL.md §3; here it additionally derives
// Serialize/Deserialize and gains two accessors:

impl DomainEvent {
    pub fn event_type(&self) -> &'static str {
        match self {
            DomainEvent::OrderPlaced(_) => "OrderPlaced",
            DomainEvent::OrderCancelled(_) => "OrderCancelled",
            DomainEvent::ItemAddedToOrder(_) => "ItemAddedToOrder",
        }
    }

    pub fn occurred_at(&self) -> DateTime<Utc> {
        match self {
            DomainEvent::OrderPlaced(e) => e.occurred_at,
            DomainEvent::OrderCancelled(e) => e.occurred_at,
            DomainEvent::ItemAddedToOrder(e) => e.occurred_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderPlaced {
    pub order_id: Uuid,
    pub customer_email: String,
    pub total_amount: Decimal,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderCancelled {
    pub order_id: Uuid,
    pub reason: String,
    pub occurred_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ItemAddedToOrder {
    pub order_id: Uuid,
    pub sku: String,
    pub quantity: u32,
    pub occurred_at: DateTime<Utc>,
}
```

Enum vs trait object:

| Concern | Enum | `Box<dyn …>` |
|---------|------|--------------|
| Serialize | Derive | Not object-safe |
| Send + Sync | Automatic | Must be proven |
| Clone | Derive | Can't derive |
| Exhaustive matching | Yes | No |
| Heap allocation | None | Box per event |
| New variant | Add variant + update matches | Implement trait |

Use trait objects only when events cross bounded-context boundaries and the set must stay open; within one context, enums win in Rust.

Naming: always past tense — `OrderPlaced`, not `PlaceOrder`. Events record what happened; commands request what should happen.

### Business invariants

| Invariant | Where enforced | How |
|-----------|---------------|-----|
| Cannot add items to non-Draft orders | `Order::add_item()` | Status check before mutation |
| Cannot submit empty orders | `Order::submit()` | Emptiness check |
| Cannot cancel shipped orders | `Order::cancel()` | State-machine check |
| Order total = sum of line items | `Order::total()` | Computed, not stored |
| Transitions follow rules | `OrderStatus::can_transition_to()` | Whitelist of valid transitions |
| No cross-currency arithmetic | `Money::add()` | Currency equality check |
| Valid email format | `Email::new()` | Validation at construction |

Enforcement pattern for every command: check preconditions → mutate state → record event → `Ok(())`.

### Domain services

For operations that don't naturally belong to one entity or value object. Use sparingly — most logic belongs on aggregates.

```rust
pub struct PricingService;

impl PricingService {
    pub fn calculate_discount(order: &Order, customer_tier: CustomerTier) -> Money {
        // cross-aggregate logic that doesn't belong on Order alone
    }
}
```

Use one when the operation spans multiple aggregates, belongs to no single entity, and expresses a domain (not infrastructure) concept. If it could be a method on an aggregate, put it there.

### Repositories as a domain concept

The repository interface is part of the model; the implementation is infrastructure.

Rules: one repository per aggregate root (not per entity); return whole aggregates, never fragments; the domain doesn't know how persistence works.

### State machines

Full transition set for the canonical example:

```rust
// The enum behind the SKILL.md §3 state machine:
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OrderStatus {
    Draft, Pending, Confirmed, Shipped, Delivered, Cancelled,
}
// can_transition_to is identical to SKILL.md §3.
```

```
Draft ──→ Pending ──→ Confirmed ──→ Shipped ──→ Delivered
  │          │
  └──────────┴──→ Cancelled
```

---

## Strategic DDD

### Bounded contexts

A boundary within which a model is defined and applicable. The same real-world concept has different representations per context:

```
┌─────────────────────┐    ┌─────────────────────┐
│  Order Context      │    │  Shipping Context   │
│  Customer:          │    │  Customer:          │
│  - email            │    │  - address          │
│  - payment_method   │    │  - delivery_prefs   │
│  Order:             │    │  Shipment:          │
│  - items            │    │  - tracking_number  │
│  - total            │    │  - carrier          │
└─────────────────────┘    └─────────────────────┘
```

In Rust, bounded contexts map to separate workspace crates or modules with hard boundaries — different types for the same real-world concept, no sharing between contexts.

### Anti-corruption layer

Translate at the boundary; never leak one context's internals into another:

```rust
// In the shipping context — take only what shipping needs
impl From<order_context::OrderPlaced> for ShipmentRequest {
    fn from(event: order_context::OrderPlaced) -> Self {
        ShipmentRequest { order_id: event.order_id, .. }
    }
}
```

---

## Rust Modeling Patterns

### Newtype for IDs — zero-cost type safety

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CustomerId(Uuid);

impl CustomerId {
    pub fn new() -> Self { Self(Uuid::new_v4()) }
    pub fn as_uuid(&self) -> Uuid { self.0 }
}
```

`CustomerId` and `OrderId` are both `Uuid` underneath but can't be mixed up.

### Builder for complex construction

```rust
pub struct OrderLineItemBuilder {
    sku: Option<Sku>,
    product_name: Option<String>,
    unit_price: Option<Money>,
    quantity: Option<u32>,
}

impl OrderLineItemBuilder {
    pub fn new() -> Self {
        Self { sku: None, product_name: None, unit_price: None, quantity: None }
    }
    pub fn sku(mut self, sku: Sku) -> Self { self.sku = Some(sku); self }
    pub fn product_name(mut self, name: impl Into<String>) -> Self {
        self.product_name = Some(name.into()); self
    }
    pub fn unit_price(mut self, price: Money) -> Self { self.unit_price = Some(price); self }
    pub fn quantity(mut self, qty: u32) -> Self { self.quantity = Some(qty); self }
    pub fn build(self) -> Result<OrderLineItem, BuildError> {
        Ok(OrderLineItem {
            sku: self.sku.ok_or(BuildError::MissingSku)?,
            product_name: self.product_name.ok_or(BuildError::MissingName)?,
            unit_price: self.unit_price.ok_or(BuildError::MissingPrice)?,
            quantity: self.quantity.ok_or(BuildError::MissingQuantity)?,
        })
    }
}
```

### Typestate — compile-time state enforcement (advanced)

```rust
pub struct Order<S: OrderState> {
    id: Uuid,
    items: Vec<OrderLineItem>,
    _state: PhantomData<S>,
}

pub struct Draft;
pub struct Pending;

impl Order<Draft> {
    pub fn add_item(&mut self, item: OrderLineItem) { .. }
    pub fn submit(self) -> Result<Order<Pending>, OrderError> { .. }
}

impl Order<Pending> {
    // add_item doesn't exist here — calling it is a compile error
    pub fn confirm(self) -> Order<Confirmed> { .. }
}
```

Trade-off: compile-time guarantees, but repositories must handle all states generically — runtime state machines are simpler to persist.

### Serde integration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    id: Uuid,
    customer_email: Email,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    #[serde(skip)]                 // event buffer is not persisted
    pending_events: Vec<DomainEvent>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### Encapsulation via private fields

Private fields + read-only getters + `Result`-returning commands mean `order.status = Pending` from outside is impossible — every mutation passes an invariant check.

---

## Modeling Decisions

### Entity vs value object

| Scenario | Choice | Why |
|----------|--------|-----|
| Customer email address | Value Object | No identity; compare by value |
| Customer account | Entity | Has identity; changes over time |
| Order line item | Entity (child) | Meaningful within the aggregate |
| Money amount | Value Object | $10 == $10 |
| Product SKU | Value Object | Identifier, but no lifecycle |
| Shipping address | Value Object | Replaced wholesale, never mutated |

Decision questions: Does it have a lifecycle? Is it identified by attributes? Can you replace it with an equal copy? Does it change over time?

### When to create a new aggregate

Create one when a cluster has its own invariants, is referenced independently, has its own lifecycle, and is loaded/saved as a unit. Don't when the entity is always reached through a parent, has no independent invariants, or needs no repository.

### Rich vs anemic model

| Aspect | Anemic | Rich |
|--------|--------|------|
| Entity has | Data only | Data + behavior |
| Logic lives in | External "services" | Entity methods |
| Invariants enforced by | Hope / external checks | The entity itself |
| Testing | Needs service + mocks | Pure, no dependencies |
| DDD alignment | Anti-pattern | Core pattern |

---

## Anti-Patterns in Detail

### 1. Anemic domain model

```rust
// WRONG: entity is a data bag, logic lives in "services"
pub struct Order {
    pub id: Uuid,
    pub status: OrderStatus,  // publicly settable!
    pub items: Vec<OrderLineItem>,
}

// RIGHT: logic lives on the entity
impl Order {
    pub fn submit(&mut self) -> Result<(), OrderError> { .. }
}
```

### 2. Infrastructure leaking into domain

```rust
// WRONG: database concern in the domain layer
use sqlx::FromRow;
#[derive(FromRow)]
pub struct Order { .. }

// RIGHT: domain is pure; persistence mapping lives in infrastructure
```

### 3. Use case doing domain logic

```rust
// WRONG: use case checks business rules and mutates directly
fn execute(&self, order_id: Uuid) -> Result<..> {
    let mut order = self.repo.find_by_id(order_id)?;
    if order.items().is_empty() { return Err(..); }   // domain logic!
    order.status = OrderStatus::Pending;              // bypasses invariants!
}

// RIGHT: domain enforces invariants
order.submit()?;
```

### 4. Fat controllers

```rust
// WRONG: controller orchestrates the business flow
fn handle_request(&self, req: Request) -> Response {
    let order = self.repo.find(req.id);
    order.validate();
    self.event_bus.publish(..);
    self.email.send(..);
    self.repo.save(order);
}

// RIGHT: controller delegates to the use case
fn handle_request(&self, req: Request) -> Response {
    match self.submit_order.execute(req.id) {
        Ok(result) => Response::ok(result),
        Err(e) => Response::error(e),
    }
}
```

### 5. Concrete infrastructure in the application layer

```rust
// WRONG: use case holds a database connection
pub struct SubmitOrderUseCase {
    db: PgPool,  // infrastructure type in the application layer!
}

// RIGHT: use case holds a port trait
pub struct SubmitOrderUseCase<R: OrderRepository> {
    repository: Arc<R>,
}
```

### 6. Event bus in the critical path

```rust
// WRONG: side effects before persistence
order.submit()?;
event_bus.publish(events)?;  // what if the bus is down?
repo.save(&order)?;          // order state is lost!

// RIGHT: persist first, publish after
order.submit()?;
repo.save(&order)?;
event_bus.publish(events)?;  // retryable if this fails
```

### 7. Bypassing aggregates

```rust
// WRONG: external code modifying children directly
let item = order.items_mut()[0];
item.quantity = 0;               // bypasses invariants!
repo.save_order_item(order_id, item);

// RIGHT: go through the aggregate root
order.update_item_quantity(sku, 0)?;
repo.save(&order)?;
```

### 8. God aggregate

```rust
// WRONG: one aggregate owns everything
pub struct Order {
    customer: Customer,       // should be a separate aggregate
    payment: PaymentDetails,  // should be a separate aggregate
    shipment: Shipment,       // should be a separate aggregate
}

// RIGHT: separate aggregates referenced by ID
pub struct Order {
    customer_id: CustomerId,  // reference, not ownership
}
```

### 9. Events named as commands

```rust
// WRONG: imperative names — these are commands
pub enum DomainEvent { PlaceOrder(..), CancelOrder(..) }

// RIGHT: past tense — records of what happened
pub enum DomainEvent { OrderPlaced(..), OrderCancelled(..) }
```

### 10. Logic-stuffed constructors

```rust
// WRONG: constructor validates, creates, submits, publishes
pub fn new(email: String, items: Vec<Item>) -> Result<Self, Error> { /* too much */ }

// RIGHT: factory creates a Draft; commands operate
pub fn create(email: Email) -> Self { /* just Draft */ }
pub fn add_item(&mut self, item: OrderLineItem) -> Result<(), Error> { .. }
pub fn submit(&mut self) -> Result<(), Error> { .. }
```

---

## Project Layout

### Single crate vs workspace

**Single crate** (modules): simpler for small projects; rely on discipline — a `use crate::infrastructure::…` in `domain/` breaks the rule silently.

**Workspace** (one crate per layer): `Cargo.toml` makes violations fail to compile. Worth it for larger projects.

```
my-app/
├── Cargo.toml          # [workspace]
├── domain/             # no internal deps
├── application/        # depends on domain
├── infrastructure/     # depends on domain + application
└── main/               # composition root; depends on everything
```

```toml
# domain/Cargo.toml — no internal dependencies
[dependencies]
uuid = "1"
chrono = "0.4"

# application/Cargo.toml
[dependencies]
domain = { path = "../domain" }

# infrastructure/Cargo.toml
[dependencies]
domain = { path = "../domain" }
application = { path = "../application" }
```

### Complete file map (single crate)

```
src/
├── lib.rs                            # module declarations
├── main.rs                           # composition root + entry point
├── domain/
│   ├── mod.rs
│   ├── entities.rs                   # Order (aggregate root), OrderLineItem, OrderStatus
│   ├── value_objects.rs              # Email, Money, Currency, Sku
│   └── events.rs                     # DomainEvent enum + event structs
├── application/
│   ├── mod.rs
│   ├── ports.rs                      # OrderRepository, EventBus, EmailService traits
│   └── use_cases.rs                  # one struct per business action
└── infrastructure/
    ├── mod.rs
    ├── persistence.rs                # repository implementations
    ├── api.rs                        # HTTP controllers
    └── ui.rs                         # GUI/CLI adapters (+ UI tests)
tests/
├── domain_tests.rs                   # pure logic, zero infrastructure
├── application_tests.rs              # mocked ports
└── integration_tests.rs              # real infrastructure
```

### Adding a new feature — checklist

1. **Domain**: define/update entities, value objects, events
2. **Application ports**: add trait methods if new infrastructure is needed
3. **Application use case**: one new struct
4. **Infrastructure**: implement any new port traits
5. **Adapter**: add controller/UI/CLI methods calling the use case
6. **Composition root**: wire the new use case
7. **Tests**: domain (pure), application (mocked), integration (real infra)

If you find yourself modifying the domain to accommodate an infrastructure concern, stop — the Dependency Rule is being violated.

---

## SOLID — Per-Principle Rust Patterns

### SRP — split by responsibility

```rust
// BEFORE: one type, two audiences
impl Report {
    fn calculate_stats(&self) -> Stats { .. }   // business logic
    fn render_html(&self) -> String { .. }      // presentation
    fn render_csv(&self) -> String { .. }       // presentation
}

// AFTER: each type has one reason to change
struct Report { data: Vec<f64> }
impl Report { fn calculate_stats(&self) -> Stats { .. } }

struct HtmlRenderer;
impl HtmlRenderer { fn render(report: &Report) -> String { .. } }

struct CsvRenderer;
impl CsvRenderer { fn render(report: &Report) -> String { .. } }
```

### OCP — trait-based extension

```rust
// BEFORE: closed — every new shape edits this file
enum Shape { Circle(f64), Rect(f64, f64) }
fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle(r) => PI * r * r,
        Shape::Rect(w, h) => w * h,
        // adding Triangle → edit here
    }
}

// AFTER: open — new shapes live in new files
trait Shape { fn area(&self) -> f64; }
struct Circle { radius: f64 }
impl Shape for Circle { fn area(&self) -> f64 { PI * self.radius * self.radius } }
struct Rect { width: f64, height: f64 }
impl Shape for Rect { fn area(&self) -> f64 { self.width * self.height } }
```

When NOT to apply: when the variant set is truly closed and exhaustive matching is the point (AST nodes, instructions). Rust's exhaustive `match` is a feature, not a violation.

### LSP — don't put what isn't common in the trait

```rust
// VIOLATION: Circle "has no dimensions", so set_dimensions panics for it
trait Drawable {
    fn set_dimensions(&mut self, w: f64, h: f64);
    fn draw(&self);
}

// FIX: split so implementors only carry what they support
trait Drawable { fn draw(&self); }
trait Resizable { fn set_dimensions(&mut self, w: f64, h: f64); }
// Circle implements Drawable only; Rect implements both
```

Key insight: the compiler enforces *type* substitutability (a `&dyn Trait` accepts any implementor), but LSP is about *behavioral* substitutability — preconditions, postconditions, invariants. It won't catch a trait method that panics for some implementors.

### ISP — segregate fat traits

```rust
// BEFORE: a reader shouldn't need to know about writing
trait Io {
    fn read(&mut self, buf: &mut [u8]) -> usize;
    fn write(&mut self, buf: &[u8]) -> usize;
    fn flush(&mut self);
    fn seek(&mut self, pos: u64);
}

// AFTER: segregated — std::io does exactly this
trait Read { fn read(&mut self, buf: &mut [u8]) -> usize; }
trait Write {
    fn write(&mut self, buf: &[u8]) -> usize;
    fn flush(&mut self);
}
trait Seek { fn seek(&mut self, pos: u64); }
```

### DIP — details depend on policy's abstraction

```rust
// BEFORE: business logic depends on the concrete database
fn get_user_total(db: &PgConnection, user_id: u64) -> f64 {
    let rows = db.query("SELECT SUM(amount) FROM orders WHERE user_id = $1", &[&user_id]);
    rows[0].get(0)
}

// AFTER: the database depends on business logic's abstraction
// In the core crate (knows nothing about postgres):
trait OrderRepository {
    fn total_for_user(&self, user_id: u64) -> f64;
}
fn get_user_total(repo: &dyn OrderRepository, user_id: u64) -> f64 {
    repo.total_for_user(user_id)
}

// In the postgres-adapter crate (depends on the core crate):
struct PgOrderRepo { conn: PgConnection }
impl OrderRepository for PgOrderRepo {
    fn total_for_user(&self, user_id: u64) -> f64 { /* postgres-specific query */ }
}
```

---

## Component Principles in Depth

### The cohesion tension triad

REP, CCP, and CRP form a triangle — you can't satisfy all three perfectly:

```
        REP (reuse)
        /\
       /  \
      /    \
CCP /______\ CRP
(change)    (usage)
```

- Too much REP focus: many tiny crates, high release overhead
- Too much CCP focus: monolithic crates — easy to change, hard to reuse
- Too much CRP focus: optimal for consumers, but one change ripples through many crates

Early in a project favor CCP; as the project matures and gains users, shift toward CRP and REP.

### REP — release what is reused together

```rust
// If these are always used and released together, they belong in one crate.
// crate: auth
pub struct User { .. }
pub struct Session { .. }
pub trait Authenticator { .. }

// Someone wanting User without Authenticator → REP violation → split.
```

### CCP — co-changing types ship together

```rust
// VIOLATION: when auth rules change, both crates are touched
// crate auth-models: User, Role, Permission
// crate auth-logic:  authenticate(), authorize()

// FIX: co-changing things live together
// crate auth:
//   mod models;   // User, Role, Permission
//   mod logic;    // authenticate(), authorize()
// But check CRP — this may force unused code on some consumers.
```

### CRP — split along consumer usage

```rust
// VIOLATION: GUI apps don't need CSV parsing, CLI tools don't need widgets
// crate reports:
//   CsvParser      ← used by CLI
//   WidgetRenderer ← used by GUI
//   Report         ← used by both

// FIX:
// crate reports-core: Report          ← shared
// crate reports-csv:  CsvParser       ← CLI only
// crate reports-gui:  WidgetRenderer  ← GUI only
```

### ADP — breaking dependency cycles

```rust
// CYCLE: auth → logging → auth
// crate auth:    uses logging::log_event
// crate logging: uses auth::current_user

// BREAK 1: extract the shared concept downward
// crate auth-core: UserId, Event — no deps
// crate auth:      depends on auth-core, logging
// crate logging:   depends on auth-core

// BREAK 2: dependency inversion — trait in the lower crate
// crate auth:   trait Logger { fn log_event(..); }
// crate logging: implements auth::Logger
```

### SDP — invert unstable dependencies through a trait

```rust
// VIOLATION: stable core depends on unstable feature
// crate core (20 dependents, I=0.05) → depends on →
// crate experimental-ml (1 dependent, I=0.9)

// FIX: invert through abstraction
// crate core:
trait MlPredictor { fn predict(&self, input: &[f64]) -> f64; }
// crate experimental-ml:
impl core::MlPredictor for ExperimentalModel { .. }
// now experimental depends on core — the correct direction
```

### SAP — the main sequence

```
A (abstractness)
1 |  ○ stable + abstract (correct)
  | /
  |/   main sequence
 /|
0 |______________○ unstable + concrete (correct)
  0     I (instability)     1

Zone of Pain (0,0):        stable + concrete → rigid, hard to change
Zone of Uselessness (1,1): unstable + abstract → abstraction no one needs
```

```rust
// VIOLATION: Zone of Pain — widely depended on, fully concrete
// crate core (20 dependents, I=0.05, A=0.0)
pub struct DataStore {
    db: PgConnection,  // concrete, no extension point
}

// FIX: make it as abstract as it is stable (A near 0.95)
// crate core:
pub trait DataStore {
    fn get(&self, key: &str) -> Option<Value>;
    fn put(&self, key: &str, value: Value);
}
// concrete implementations move to leaf crates
```

### Diagnostic commands

```bash
# ADP: find cycles
cargo tree --edges normal 2>&1 | grep -E "(cycle|depends on itself)"

# SDP/SAP: approximate metrics
# Ca = count of Cargo.toml files listing this crate as a dependency
# Ce = count of dependencies in this crate's Cargo.toml
# I = Ce / (Ca + Ce); A = abstract items / total items
cargo deps --include-orphans | dot -Tpng > deps.png
```

---

## DDD vs Clean Architecture

| Aspect | Clean Architecture | DDD |
|--------|-------------------|-----|
| Core concern | Dependency direction | Domain language & boundaries |
| Key concept | Layers + dependency inversion | Ubiquitous language + bounded contexts |
| What it answers | "Where does this code go?" | "What do we call this?" |
| Primary artifacts | Use cases, ports/adapters | Entities, aggregates, value objects |
| Structures by | Dependency level | Bounded context |
| Works best with | Rich domain models | Explicit layering rules |

They compose: Clean Architecture draws the layers; DDD models what lives in the innermost one.
