# Architecture Design — Deep Reference

Load conditions are listed in `SKILL.md`. Everything here expands a pattern the summary already names; the canonical example throughout is the Order example (`Email`, `Money`, `Sku`, `OrderLineItem`, `Order`).

## Table of Contents

1. [Layer Walkthrough](#layer-walkthrough) — ports, use cases, error mapping, stores, controllers, UI adapters, composition root
2. [Testing Strategy](#testing-strategy) — domain, application, integration, pyramid
3. [Rust Modeling Patterns](#rust-modeling-patterns) — newtype, builder, typestate, serde
4. [Anti-Patterns in Detail](#anti-patterns-in-detail)
5. [Project Layout](#project-layout) — single crate vs workspace, file map, new-feature checklist
6. [SOLID — Per-Principle Rust Patterns](#solid--per-principle-rust-patterns)
7. [Component Principles in Depth](#component-principles-in-depth)

---

## Layer Walkthrough

### Port interfaces

Ports invert a dependency when policy must call a detail without depending on it. The policy-side client owns the smallest capability it needs; the adapter depends inward and implements it. Most driven ports belong in `application/`, but a store-like collection that is genuinely part of the domain vocabulary may belong with the domain model. A trait beside its only adapter, created solely to satisfy a layer diagram, inverts nothing.

**Driven port — what this application policy needs:**

```rust
// application/order_store.rs
pub trait OrderStore {
    fn load(&self, id: OrderId) -> Result<Option<Order>, StoreFailure>;
    fn recorded_result(
        &self,
        command_id: CommandId,
    ) -> Result<Option<SubmitOrderResult>, StoreFailure>;
    fn save_submission(
        &self,
        command_id: CommandId,
        result: &SubmitOrderResult,
        order: &Order,
        events: &[OrderFact],
    ) -> Result<(), StoreFailure>;
}
```

`save_submission` represents the atomic capability the use case requires: commit
order state, durable outbox records, and the idempotent command result in one
transaction. It does not expose SQL, transactions, or a generic CRUD surface. A
dispatcher port may be useful for the outbox worker, but direct broker publication
is not part of the state transaction.

**Driving port — only when callers need a stable use-case contract:**

```rust
pub trait SubmitOrder {
    fn execute(&self, command: SubmitOrderCommand) -> Result<SubmitOrderResult, SubmitOrderError>;
}
```

A public method is often sufficient; do not create an input trait until multiple driving adapters, decoration, or a framework seam needs one.

**Port design guidelines:**

- Own the abstraction on the side whose policy it expresses, not beside the implementation
- Shape methods around client capabilities, not the vendor API or generic CRUD
- Add `Send`, `Sync`, `'static`, async, or object-safety constraints only when the chosen runtime and sharing model require them
- Return failures in a vocabulary the policy can classify; adapters retain the vendor cause for diagnostics
- Name after the capability (`OrderStore`), not the implementation (`PostgresOrderStore`)

### Use cases

Organize use cases around business actions when that makes the application contract clearer. They may contain **application policy**: authorization, idempotency, transaction selection, sequencing, coordination across separate domain objects / consistency units, and deciding which external effects to request. They must not duplicate invariants intrinsic to the domain type.

A durable submit flow is:

```rust
pub struct SubmitOrder<S> {
    store: S,
}

// execute(command):
// 1. return store.recorded_result(command.id) when it exists
// 2. load the order
// 3. call order.submit(command.occurred_at) so the order enforces invariants
// 4. inspect order.pending_events() without removing them
// 5. derive the result, then atomically call store.save_submission(
//        command.id, &result, &order, order.pending_events())
// 6. call order.mark_events_committed() only after the transaction succeeds
// 7. return the same recorded result on every retry
```

A separate worker claims outbox rows, maps internal facts to public integration messages, publishes them, and marks them delivered. Publication is normally **at least once**: a crash after publish but before acknowledgement can duplicate a message, so message identity and consumer idempotency are part of the contract. If a notification is explicitly best-effort, direct post-commit delivery can be simpler—name the accepted loss instead of implying the database makes it reliable.

### Error mapping

Translate failure semantics where a caller crosses a boundary; do not mechanically create one wrapper enum per folder.

- Domain failures describe violated business rules (`EmptyOrder`, `AlreadySubmitted`).
- The use-case contract exposes actionable outcomes (`NotFound`, `Conflict`, `Denied`, `TemporarilyUnavailable`) and can embed a domain failure when the caller understands that vocabulary.
- A driven adapter maps database, broker, SDK, and timeout failures to the classifications promised by its port while retaining the original source for logs/traces.
- An HTTP/CLI/UI adapter maps use-case outcomes to its transport contract.

Rust `#[from]` is appropriate only when the conversion is semantically lossless. A blanket `Repository(#[from] sqlx::Error)` in an application error leaks a vendor type and makes transient, conflict, and corruption failures indistinguishable. Prefer an explicit `map_err` at the adapter boundary when classification matters.

### Store implementations

```rust
// infrastructure/persistence.rs
pub struct InMemoryOrderRepository {
    orders: RwLock<HashMap<Uuid, Order>>,
}

impl OrderStore for InMemoryOrderRepository {
    fn save(&self, order: &Order) -> Result<(), StoreFailure> {
        let mut orders = self.orders.write()
            .map_err(|_| StoreFailure::DatabaseError("Lock poisoned".into()))?;
        orders.insert(order.id(), order.clone());
        Ok(())
    }

    fn find_by_id(&self, id: Uuid) -> Result<Option<Order>, StoreFailure> {
        let orders = self.orders.read()
            .map_err(|_| StoreFailure::DatabaseError("Lock poisoned".into()))?;
        Ok(orders.get(&id).cloned())
    }
}
```

Real infrastructure implements the same trait — `PostgresOrderStore { pool: PgPool }`, SQLite, DynamoDB — with zero application-layer change.

### API controllers

Thin translators: transport format → use-case input, use-case outcome → transport response. They own transport policy such as status-code mapping and redaction, but no domain invariants.

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
            Err(SubmitOrderError::NotFound) => ApiResponse::not_found(),
            Err(SubmitOrderError::Conflict(reason)) => ApiResponse::conflict(reason.public_message()),
            Err(SubmitOrderError::Denied) => ApiResponse::forbidden(),
            Err(SubmitOrderError::TemporarilyUnavailable) => ApiResponse::unavailable(),
            Err(SubmitOrderError::InvalidOrder(reason)) => ApiResponse::unprocessable(reason.public_message()),
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
let submit_use_case = Arc::new(SubmitOrderUseCase::new(Arc::clone(&store)));
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

The application bootstrap owns the top-level object graph and bindings across architectural boundaries:

```rust
// main.rs
let store = Arc::new(PostgresOrderStore::new(pool));
let create_order = CreateOrderUseCase::new(Arc::clone(&store));
let submit_order = SubmitOrderUseCase::new(Arc::clone(&store));
let outbox_worker = OutboxWorker::new(Arc::clone(&store), broker);

let controller = OrderController::new(OrderService { create_order, submit_order, .. });
let worker = WorkerProcess::new(outbox_worker);
```

Guidelines: keep the top-level root in `main.rs`, framework bootstrap, or a dedicated wiring module; allow cohesive modules and adapter factories to build local subgraphs; keep business branching and runtime work out of the root. Tests may assemble smaller roots with fakes at earned ports. Swapping a detail should change bindings, but a changed capability may legitimately change policy and its port.

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
    let mut order = test_order();
    assert_eq!(order.status(), OrderStatus::Draft);
    order.add_item(test_item(), test_time()).unwrap();
    order.submit(test_time()).unwrap();
    assert_eq!(order.status(), OrderStatus::Pending);
    order.cancel("changed mind", test_time()).unwrap();
    assert_eq!(order.status(), OrderStatus::Cancelled);
}

#[test]
fn test_cannot_submit_empty_order() {
    let mut order = test_order();
    assert!(matches!(order.submit(test_time()), Err(OrderError::EmptyOrder)));
}

#[test]
fn test_cannot_add_item_after_submit() {
    let mut order = test_order();
    order.add_item(test_item(), test_time()).unwrap();
    order.submit(test_time()).unwrap();
    assert!(order.add_item(test_item(), test_time()).is_err());
}

#[test]
fn test_submit_records_order_placed_event() {
    let mut order = test_order();
    order.add_item(test_item(), test_time()).unwrap();
    order.mark_events_committed();        // test setup: prior ItemAdded was persisted
    order.submit(test_time()).unwrap();
    let events = order.pending_events();
    assert_eq!(events.len(), 1);
    assert!(matches!(events[0], OrderFact::OrderPlaced(_)));
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

### Application tests — controlled substitutes at earned ports

Use a fake at the application-owned store capability and assert the durable
request, not an immediate broker call:

```rust
#[test]
fn submit_records_state_outbox_and_result_atomically() {
    let store = RecordingOrderStore::with_order(submittable_order());
    let uc = SubmitOrderUseCase::new(&store);
    let command = test_submit_command();

    let result = uc.execute(command.clone()).unwrap();
    let saved = store.only_submission();

    assert_eq!(saved.command_id, command.id);
    assert_eq!(saved.result, result);
    assert!(saved.events.iter().any(|event| matches!(event, OrderFact::OrderPlaced(_))));
    assert_eq!(store.recorded_result(command.id).unwrap(), Some(result));
}
```

A separate adapter/integration test runs the real transaction and proves order
state, outbox rows, and command result commit or roll back together. The outbox
worker's own tests cover at-least-once broker publication and idempotent delivery.

### Integration tests — real infrastructure

```rust
#[tokio::test]
async fn test_postgres_store_roundtrip() {
    let pool = test_pool().await;
    let store = PostgresOrderStore::new(pool);
    let order = test_order();
    store.save(&order).unwrap();
    assert!(store.find_by_id(order.id()).unwrap().is_some());
}
```

---

## Rust Modeling Patterns

These are Rust implementation options, not layer requirements. Add `Arc`, locks, `Send + Sync`, async traits, and `'static` only when the actual executor/threading model needs them. Prefer passing clocks, ID generators, and transaction boundaries explicitly when determinism or ownership matters; a single-threaded CLI should not inherit server-runtime constraints.

### Newtype for IDs — zero-cost type safety

```rust
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CustomerId(Uuid);

impl CustomerId {
    pub fn from_uuid(value: Uuid) -> Self { Self(value) }
    pub fn as_uuid(&self) -> Uuid { self.0 }
}
```

`CustomerId` and `OrderId` are both `Uuid` underneath but cannot be mixed up.
The application boundary chooses or generates the raw UUID and passes it into the
domain type; replayable domain logic does not call a global RNG implicitly.

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

Trade-off: compile-time guarantees, but stores must handle all states generically — runtime state machines are simpler to persist.

### Serde integration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    id: Uuid,
    customer_email: Email,
    status: OrderStatus,
    items: Vec<OrderLineItem>,
    #[serde(skip)]                 // fact buffer is not persisted
    pending_events: Vec<OrderFact>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

### Encapsulation via private fields

Private fields + read-only getters + `Result`-returning commands mean `order.status = Pending` from outside is impossible — every mutation passes an invariant check.

---

## Anti-Patterns in Detail

### 1. Data bag with logic outside

```rust
// WRONG: type is a data bag, logic lives in "services"
pub struct Order {
    pub id: Uuid,
    pub status: OrderStatus,  // publicly settable!
    pub items: Vec<OrderLineItem>,
}

// RIGHT: logic lives on the type that owns the data
impl Order {
    pub fn submit(&mut self, occurred_at: DateTime<Utc>) -> Result<(), OrderError> { .. }
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
    let mut order = self.store.find_by_id(order_id)?;
    if order.items().is_empty() { return Err(..); }   // domain logic!
    order.status = OrderStatus::Pending;              // bypasses invariants!
}

// RIGHT: domain enforces invariants
order.submit(now)?;
```

### 4. Fat controllers

```rust
// WRONG: controller orchestrates the business flow
fn handle_request(&self, req: Request) -> Response {
    let order = self.store.find(req.id);
    order.validate();
    self.event_bus.publish(..);
    self.email.send(..);
    self.store.save(order);
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
pub struct SubmitOrderUseCase<S: OrderStore> {
    store: Arc<S>,
}
```

### 6. Database-to-broker dual write

```rust
// WRONG: either order leaves a crash gap
order.submit(now)?;
store.save(&order)?;
event_bus.publish(events)?; // crash after save can lose the message

// RIGHT when delivery and idempotent retry are required: one local transaction
order.submit(now)?;
let result = SubmitOrderResult::from(&order);
unit_of_work.save_submission(command.id, &result, &order, order.pending_events())?;
order.mark_events_committed();
// A dispatcher later publishes claimed outbox rows at least once.
```

Direct post-commit publication is simpler only when message loss is explicitly acceptable. Otherwise persist fact identity/payload in the same transaction, retain/mark pending facts according to commit outcome, and make consumers idempotent. Name committed facts in past tense (`OrderPlaced`, not `PlaceOrder`); map them to versioned integration contracts before they leave the service/deployable boundary.

### 7. Logic-stuffed constructors

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
│   ├── order.rs                      # Order, OrderLineItem, OrderStatus, rules
│   ├── types.rs                      # Email, Money, Currency, Sku
│   └── facts.rs                      # OrderFact enum + fact payloads
├── application/
│   ├── mod.rs
│   ├── ports.rs                      # OrderStore and other earned application capabilities
│   └── use_cases.rs                  # one struct per business action
└── infrastructure/
    ├── mod.rs
    ├── persistence.rs                # store implementations
    ├── api.rs                        # HTTP controllers
    └── ui.rs                         # GUI/CLI adapters (+ UI tests)
tests/
├── domain_tests.rs                   # pure logic, zero infrastructure
├── application_tests.rs              # mocked ports
└── integration_tests.rs              # real infrastructure
```

### Adding a new feature — checklist

1. **Domain**: define/update domain types and rules
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
trait OrderStore {
    fn total_for_user(&self, user_id: u64) -> f64;
}
fn get_user_total(store: &dyn OrderStore, user_id: u64) -> f64 {
    store.total_for_user(user_id)
}

// In the postgres-adapter crate (depends on the core crate):
struct PgOrderStore { conn: PgConnection }
impl OrderStore for PgOrderStore {
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

A stable component that many others depend on needs deliberate extension seams where its policy varies; an unstable leaf usually needs concrete implementation, not abstract surface. The main-sequence metrics are diagnostic, not a target to game by adding traits. Stable + concrete (`A≈0, I≈0`) is the Zone of Pain; abstract + unstable (`A≈1, I≈1`) is the Zone of Uselessness. Formulas and interpretation for main-sequence distance, instability, and abstractness belong with deployable-boundary / quantum analysis (instability, abstractness, distance from the main sequence)—not application layer placement alone.

```rust
// VIOLATION: Zone of Pain — widely depended on, fully concrete
// crate core (20 dependents, I=0.05, A=0.0)
pub struct DataStore {
    db: PgConnection,  // concrete, no extension point
}

// FIX only if callers need storage policy to vary: the policy-side client owns
// the narrow capability and concrete adapters move to leaf crates.
pub trait DataStore {
    fn get(&self, key: &str) -> Option<Value>;
    fn put(&self, key: &str, value: Value);
}
// If no variation or policy/detail seam exists, keep the concrete module and
// reduce incoming coupling instead of manufacturing abstraction for the metric.
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
