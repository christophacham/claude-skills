---
name: distributed-architecture
description: "Trade-off-driven design for decisions across deployable units. Use when deciding whether to split or merge services, breaking apart a monolith (assessing decomposability, tactical forking vs component-based decomposition), decomposing databases or assigning table ownership, choosing saga coordination (sync/async, compensated/forward-recovery, orchestrated/choreographed), designing service contracts (strict vs loose, consumer-driven contracts, stamp coupling), or sharing code across services (library vs service vs sidecar vs duplication). Also for trade-off statements, ADRs, and fitness functions. Not for single-application layering, module/interface design, or distributed-systems theory (CAP, consensus protocols)."
---

# Distributed Architecture

Covers the recurring hard decisions across deployables — granularity, monolith decomposition, data, workflow, contracts, and code reuse — plus the shared machinery: trade-off analysis, ADRs, and fitness functions.

**Out of scope here:** single-app layering / ports / composition root; module interface depth.

**Scope:** Prefer the contested deployable boundary or hot path under change. State the least-worst choice and the trade-off you accept before expanding tables.

## Core Mental Model

Everything is a trade-off. Don't look for the best design; look for the **least worst combination of trade-offs**. If you think you've found something that isn't a trade-off, you haven't found the trade-off yet. No best practices exist for most real architecture decisions.

**Static coupling** is how parts are *wired*: build/deployment dependencies on runtimes, frameworks, schemas, integration points, and shared artifacts. It answers "what must change or deploy together?"

**Dynamic coupling** is how parts interact at runtime. Analyze at least four dimensions; none is a synonym for another:

| Dimension | Values | Answers |
|-----------|--------|---------|
| Communication | request/response, one-way, stream | What information flows and is a reply required? |
| Temporal coupling | coupled / decoupled | Must both parties and the dependency chain be available at the same time? |
| Consistency | one local transaction / eventual convergence | Where can invariants be enforced atomically? |
| Coordination | orchestrated / choreographed | Who owns workflow state and recovery? |

A synchronous call is usually temporally coupled, but asynchronous transport does not guarantee decoupling: a sender that waits for broker acknowledgement or a consumer that immediately calls the producer can still be coupled in time. Likewise async does not imply parallelism, and sync does not imply one global transaction.

An **architecture quantum** is a useful unit of coupling analysis: a set of code and data that must be deployed or fail together to preserve its operational characteristics. Do not count quanta from boxes alone. Shared tables, cross-service transactions, coordinated migrations, or one shared failure domain can collapse nominal services into one quantum; merely using the same database server with separately owned schemas does not by itself prove one quantum.

| Architecture | Likely quantum count |
|-------------|----------------------|
| Monolith deployed as one artifact | 1 |
| Services sharing tables and transaction boundaries | Often 1 despite separate processes |
| Services with independent data ownership and deployment | Multiple, subject to runtime dependency analysis |

Two constraints on everything below:

- **Semantic coupling cannot be removed by implementation.** If two services share a concept, the coupling must live somewhere — you only choose where.
- **Iterate.** Build matrices and sample topologies, then refine; no first draft survives contact.

## Decision Machinery

### Disintegrators vs integrators

Every structural decision has the same shape: **disintegrators** (forces pulling apart) vs **integrators** (forces holding together). Most teams over-index on disintegrators and ignore integrators. Run *both* lists, then form a trade-off statement.

### Trade-off analysis: three steps

1. **Find what's entangled** — dimensions where changing one forces changes in others; build static coupling diagrams of deployment dependencies.
2. **Analyze the coupling** — matrix of dimension combinations; skip infeasible ones; rate trade-off concerns for the rest.
3. **Assess trade-offs** — impact of change on interdependent systems. Start **qualitative** (low/medium/high); go quantitative (latency ms, req/s) only when you can measure.

For novel problems with no framework: name your own dimensions (input from devs, architects, ops), build the matrix, test with sample topologies — toy workflows, not real implementations.

### Trade-off statements for the business

> "We can improve [X] by choosing [A], but this will degrade [Y]. Which matters more for our business — [X value] or [Y value]?"

Example: "We want to split the payment service for extensibility, but that adds workflow hops and hurts responsiveness when multiple payment types are used. Which matters more — extensibility or responsiveness?"

### ADRs and fitness functions — only when earned

- Write an **ADR** (context / decision / consequences, 1–2 pages) only for contested, hard-to-reverse decisions; include the trade-off statement and who confirmed the priority. Reversible or uncontested calls need only the normal change record used by the project (PR/change description, issue, or commit message when a commit is actually requested). Template: `references/reference.md`.
- A **fitness function** is any mechanism that objectively assesses an architecture characteristic. Distinguish from unit tests with one question: "Is domain knowledge required?" No → fitness function. Add one only *after* a decision, to prevent regression — not for decisions the compiler or linter already enforces. Taxonomy and examples: `references/reference.md`.

## Granularity: One Service or Many?

Granularity is about what a service *does*, not lines of code or class count. Do NOT answer with "single-responsibility principle" — too subjective. Run the drivers, then form trade-off statements.

### Disintegrators (reasons to split)

| Driver | Question | Notes |
|--------|----------|-------|
| Service scope & function | Doing unrelated things? | Weak cohesion (Profile+Preferences+Comments) → candidate. Strong cohesion (Notification: SMS+Email+Letter) → splitting on scope alone is NOT justified |
| Code volatility | Do changes hit only one part? | Measure via version-control history; splitting isolates volatile code, shrinking test scope and deploy risk |
| Scalability & throughput | Do parts scale differently? | Extreme variation forces low-throughput functions to scale with high-throughput ones |
| Fault tolerance | Can one failure take down unrelated functions? | Check the "leftover" still has a meaningful name and cohesion |
| Security | Do parts need higher security? | Separate services give service-level access control |
| Extensibility | Always adding new contexts? | Only when confirmed or likely — don't speculate |

**Cohesion warning:** a Notification Service doing SMS, Email, and Postal is already cohesive — "notification" IS the single purpose. Don't split just because you can name sub-functions.

### Integrators (reasons to keep together)

| Driver | Question | Notes |
|--------|----------|-------|
| Database transactions | ACID required across the data? | Separate services cannot share one transaction; all-or-nothing business requirements force consolidation |
| Workflow & temporal coupling | Do common requests traverse the boundary, and must both sides be live? | Measure hop count, tail latency, availability multiplication, and coordinated changes; frequent chatty calls favor consolidation |
| Shared code | Shared *domain* logic significant? | A large, fast-changing shared domain model favors consolidation; measure co-change rather than applying a universal percentage. Stable operational code may fit libraries/sidecars |
| Data relationships | Can the data actually be separated? | Mutual per-operation dependence on each other's tables → consolidate. Fewest trade-offs; data relationships are hardest to refactor |

### After the analysis

- Quantify where possible (change frequency, throughput, latency).
- Form trade-off statements; get a business stakeholder to confirm the priority.
- Sanity checks: does the "leftover" have a meaningful name and cohesion? Has the new interservice communication created worse problems than you solved?

## Decomposing a Monolith

The failure mode is ad-hoc extraction ("start with the easy stuff") — the Elephant Migration Anti-Pattern, which leads to a distributed monolith. Assess health, pick an approach, extract deliberately. Build services from **components**, not individual classes.

**Health check:** high efferent coupling raises change exposure. Main-sequence diagnostics use two opposite warning zones: stable + concrete is the **Zone of Pain** (rigid), while unstable + abstract is the **Zone of Uselessness** (abstraction with no stable dependents). Distance is a conversation starter, not a decomposition score; a component far from the line may be appropriate. Metrics (Ca/Ce, abstractness, instability, distance): `references/reference.md`.

```
Is the codebase decomposable?
├── NO  → Fix the code first (or rewrite); splitting mud makes distributed mud
└── YES → Identifiable components (namespaces, directories)?
          ├── NO  → Tactical forking
          └── YES → Component-based decomposition
```

- **Tactical forking** — replicate the whole application per target service; in each replica, delete what that service doesn't need; reconcile shared code and data ownership afterward. For big balls of mud.
- **Component-based decomposition** — six steps in order: (1) identify and size components, (2) gather duplicated domain logic into single shared components, (3) flatten so every file has a clear component home, (4) map the component dependency graph — this decides feasibility and extraction order, (5) group components into domains, (6) extract domains into separately deployed services. Detail: `references/reference.md`.

Plan code and data ownership together, then migrate in reversible slices. A common sequence establishes a code boundary first and moves data behind it, but foreign keys, reporting, or zero-downtime constraints may require staged schema work, backfills, dual reads/writes, or change-data capture in parallel. Document the cutover, rollback, and ownership transition; add fitness functions only for decisions worth continuously governing.

## Data: Ownership and Access

Breaking a database is much harder than breaking application functionality. Answer in order: **should** we decompose? **Who owns** each table? **How** do non-owners read?

**General rule: the service that writes owns the table.** Three scenarios, in order of difficulty:

1. **Single ownership** — only one service writes → assign it. Resolve these first to clear the field.
2. **Common ownership** — most/all services write (e.g., Audit) → dedicated owner service; others send data to it (persistent queue if fire-and-forget, synchronous call if confirmation is required).
3. **Joint ownership** — 2–3 services in one domain write the same table → table split, shared data domain, delegate to one owner, or consolidate the services. Trade-off table and selection hints: `references/reference.md`.

**Steady-state writes have one owner.** Prefer routing non-owner access through an owner API/event-fed read model rather than granting cross-schema writes. Temporary multi-database access can be legitimate in a migration, and dedicated reporting/administrative workloads may span owners read-only; make the exception explicit, time-bounded where possible, and keep domain write authority singular. Read-pattern trade-offs: `references/reference.md`.

**ACID → BASE.** Distributed transactions are fundamentally different: per-service commits, temporarily inconsistent data, per-service durability. Three eventual-consistency patterns: background synchronization (simplest, slowest), orchestrated request-based (better consistency, worse responsiveness), event-based (best decoupling, needs event infrastructure).

Migration is staged — data domains → separate schemas → separate connections → separate databases. The full five-step plan and the should-we-decompose drivers: `references/reference.md`.

## Workflow: Sagas

A saga coordinates **multiple local transactions**. It is never one ACID transaction: there is no isolation across steps, other actors can observe intermediate states, and compensation is a new business action—not database rollback.

| Dimension | Option A | Option B |
|-----------|----------|----------|
| Communication | **Request/response**: direct result, usually temporal coupling | **Message-driven**: queueing can decouple availability; does not imply parallel execution |
| Outcome | **Forward recovery**: retry/repair until the desired state is reached | **Compensation**: apply explicit semantic counter-actions where possible |
| Coordination | **Orchestrated**: one owner persists workflow state and next actions | **Choreographed**: participants react to events; ownership and observability are distributed |

### Selection tree

```
Can all required invariants fit in one local transaction/service?
├── YES → keep one transaction boundary; do not add a saga
└── NO  → Can the business tolerate visible intermediate states?
          ├── NO  → redesign/consolidate/reserve first; a saga cannot provide ACID
          └── YES → Is workflow/recovery complex or auditability important?
                    ├── YES → orchestrate and persist saga state
                    └── NO  → choreography may fit a short, stable event chain
```

Prefer forward recovery for irreversible effects. Define compensation per step before implementation, including what happens when compensation itself fails, times out, or is no longer legal. Persist workflow state, deadlines, attempts, and operator interventions. Every command/event handler needs an idempotency strategy because retries and duplicate delivery are normal.

The reference retains the 8-combination vocabulary as a comparison aid, but any “atomic” label means an **all-or-compensated business goal**, never isolation or guaranteed restoration.

## Contracts

A contract is every externally observable promise between deployables: schema, semantics, ordering, errors, timeouts, retry safety, and compatibility—not merely a payload format. **Core rule: strictness follows semantic coupling × consumer diversity.** Tightly coupled, co-released internal participants can use stricter schemas; independently released or external consumers need tolerant evolution and consumer verification.

- **Placement/ownership:** the provider owns the offered contract and compatibility policy; each consumer owns its expectations. Share neutral generated schema/client artifacts when useful, never a shared mutable domain model that forces lockstep releases.
- **Versioning:** prefer backward-compatible additive evolution and tolerant readers. Version only for a real semantic/shape break, run versions concurrently for a stated migration window, and measure consumer adoption before retirement.
- **Idempotency:** specify operation/message identity, deduplication scope and retention, retryable outcomes, and ordering assumptions. “At least once” without an inbox/idempotent handler is an incomplete contract.
- **Payload:** keep it need-to-know. Passing fields the consumer does not use is stamp coupling; carrying explicit workflow state in choreography can be a deliberate exception with acknowledged coupling.

Load `references/reference.md` for strict-to-loose trade-offs, HTTP/event contract placement, consumer-driven contracts, compatibility/versioning, and idempotent delivery.

## Code Reuse Across Services

**Reuse works only when the shared code changes slowly.** Two questions drive the decision — library, service, sidecar, or duplication: operational (infrastructure) or domain logic, and how frequently it changes.

- Operational → sidecar (or shared library if rarely changing)
- Domain + rarely changing → versioned shared library
- Domain + frequently changing → shared service, or consolidate the services
- Static one-off → replicate

Load `references/reference.md` when choosing — all four reuse patterns in depth, versioning/deprecation rules, sidecar contents, the reuse trap, reuse checklist.

## Do Not Reach For

- **No split on speculation.** Default to the monolith. Split on *measured* disintegrators (change frequency, scaling numbers, fault incidents) — "we might need to scale" is not a measurement.
- **No saga until one transaction or one service demonstrably can't do it.** First moves are consolidation or async reads, not orchestration infrastructure.
- **No ADR for reversible or uncontested decisions.** No fitness function for a decision not yet made, or one the compiler already enforces.
- **No irreversible database split before ownership and cutover are clear.** Establish the service boundary and data owner first; stage schema/data changes in the order required for a reversible migration.
- **No shared library for fast-changing cross-context domain policy; no service-per-noun.** Use co-change and release-coupling evidence rather than a universal percentage; heavy fast-changing sharing often means the boundary is wrong.
- **No distribution without operational maturity.** A team that can't deploy a monolith cleanly will deploy twelve broken monoliths.

## End-to-End Checklist

```
For any significant cross-deployable decision:

1. UNTANGLE — identify the entangled dimensions
2. ANALYZE  — model combinations, rate trade-offs
3. ASSESS   — determine impact of change on interdependent systems
4. DISCUSS  — form trade-off statements for business stakeholders
5. DOCUMENT — ADR if contested and hard to reverse
6. GOVERN   — fitness function if regression is likely

Quantum check:
☐ What are the deployment boundaries? (static coupling)
☐ What are the communication dependencies? (dynamic coupling)
☐ Does a shared database collapse multiple services into one quantum?
☐ Can each quantum deploy independently?
```
