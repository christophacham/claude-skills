---
name: distributed-architecture
description: "Trade-off-driven design for decisions across deployable units. Use when deciding whether to split or merge services, breaking apart a monolith (assessing decomposability, tactical forking vs component-based decomposition), decomposing databases or assigning table ownership, choosing saga coordination (sync/async, atomic/eventual, orchestrated/choreographed), designing service contracts (strict vs loose, consumer-driven contracts, stamp coupling), or sharing code across services (library vs service vs sidecar vs duplication). Also for trade-off statements, ADRs, and fitness functions. Not for single-application layering (see architecture-design), module/interface design (see simple-design), or distributed-systems theory (CAP, consensus protocols)."
---

# Distributed Architecture

Covers the recurring hard decisions across deployables — granularity, monolith decomposition, data, workflow, contracts, and code reuse — plus the shared machinery: trade-off analysis, ADRs, and fitness functions.

## Core Mental Model

Everything is a trade-off. Don't look for the best design; look for the **least worst combination of trade-offs**. If you think you've found something that isn't a trade-off, you haven't found the trade-off yet. No best practices exist for most real architecture decisions.

**Static coupling** is how parts are *wired*: deployment-time dependencies on the OS/container, frameworks, databases, integration points, messaging. It answers "what must be deployed together?"

**Dynamic coupling** is how parts *communicate* at runtime, along three entangled dimensions — changing one affects the trade-offs of the others:

| Dimension | Values | Answers |
|-----------|--------|---------|
| Communication | synchronous / asynchronous | Do callers wait for responses? |
| Consistency | atomic / eventual | Must data agree across services immediately? |
| Coordination | orchestrated / choreographed | Is there a central workflow owner? |

An **architecture quantum** is an independently deployable artifact with high functional cohesion, high static coupling, and synchronous dynamic coupling. It is the unit of coupling analysis. **A shared database makes everything a single quantum**, no matter how many services you deploy:

| Architecture | Quantum count |
|-------------|---------------|
| Monolith (any style) | Always 1 |
| Service-based with shared DB | 1 (the database couples everything) |
| Microservices with DB per service | Multiple (each service is a quantum) |

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

- Write an **ADR** (context / decision / consequences, 1–2 pages) only for contested, hard-to-reverse decisions; include the trade-off statement and who confirmed the priority. Reversible or uncontested calls get code and a commit message. Template: `references/reference.md`.
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
| Workflow & choreography | Do the services talk constantly? | >50% of requests needing interservice calls → consider consolidation. Each hop adds ~100–300ms before data transfer |
| Shared code | Shared *domain* logic significant? | >40% of the collective codebase AND changing fast → consolidate. Infrastructure code (logging, auth) is NOT an integrator — use libraries/sidecars |
| Data relationships | Can the data actually be separated? | Mutual per-operation dependence on each other's tables → consolidate. Fewest trade-offs; data relationships are hardest to refactor |

### After the analysis

- Quantify where possible (change frequency, throughput, latency).
- Form trade-off statements; get a business stakeholder to confirm the priority.
- Sanity checks: does the "leftover" have a meaningful name and cohesion? Has the new interservice communication created worse problems than you solved?

## Decomposing a Monolith

The failure mode is ad-hoc extraction ("start with the easy stuff") — the Elephant Migration Anti-Pattern, which leads to a distributed monolith. Assess health, pick an approach, extract deliberately. Build services from **components**, not individual classes.

**Health check:** high efferent coupling = high change risk; components that are mostly concrete *and* unstable (Zone of Pain) may need a rewrite or major refactoring before splitting is worthwhile. Metrics (Ca/Ce, abstractness, instability, distance from main sequence): `references/reference.md`.

```
Is the codebase decomposable?
├── NO  → Fix the code first (or rewrite); splitting mud makes distributed mud
└── YES → Identifiable components (namespaces, directories)?
          ├── NO  → Tactical forking
          └── YES → Component-based decomposition
```

- **Tactical forking** — replicate the whole application per target service; in each replica, delete what that service doesn't need; reconcile shared code and data ownership afterward. For big balls of mud.
- **Component-based decomposition** — six steps in order: (1) identify and size components, (2) gather duplicated domain logic into single shared components, (3) flatten so every file has a clear component home, (4) map the component dependency graph — this decides feasibility and extraction order, (5) group components into domains, (6) extract domains into separately deployed services. Detail: `references/reference.md`.

Break apart the **data separately** (next section) — code first, data second. Document decomposition steps as architecture stories and guard each step with fitness functions (see reference).

## Data: Ownership and Access

Breaking a database is much harder than breaking application functionality. Answer in order: **should** we decompose? **Who owns** each table? **How** do non-owners read?

**General rule: the service that writes owns the table.** Three scenarios, in order of difficulty:

1. **Single ownership** — only one service writes → assign it. Resolve these first to clear the field.
2. **Common ownership** — most/all services write (e.g., Audit) → dedicated owner service; others send data to it (persistent queue if fire-and-forget, synchronous call if confirmation is required).
3. **Joint ownership** — 2–3 services in one domain write the same table → table split, shared data domain, delegate to one owner, or consolidate the services. Trade-off table and selection hints: `references/reference.md`.

**A service never connects to multiple databases or schemas.** Non-owners read via (simplest first) interservice call, column schema replication, replicated cache, or shared data domain. Pattern trade-offs: `references/reference.md`.

**ACID → BASE.** Distributed transactions are fundamentally different: per-service commits, temporarily inconsistent data, per-service durability. Three eventual-consistency patterns: background synchronization (simplest, slowest), orchestrated request-based (better consistency, worse responsiveness), event-based (best decoupling, needs event infrastructure).

Migration is staged — data domains → separate schemas → separate connections → separate databases. The full five-step plan and the should-we-decompose drivers: `references/reference.md`.

## Workflow: Sagas

Every cross-service workflow picks one value per dynamic-coupling dimension:

| Dimension | Option A | Option B |
|-----------|----------|----------|
| Communication | **Sync**: caller waits; sequential; simpler; lower throughput | **Async**: parallel; higher throughput; races/deadlocks possible |
| Consistency | **Atomic**: all-or-nothing; compensating updates; very high coupling | **Eventual**: converges; per-service scope; needs state management; low coupling |
| Coordination | **Orchestrated**: central owner; centralized errors; may bottleneck | **Choreographed**: no owner; scales; distributed state; harder debugging |

### Selection tree

```
Can you tolerate eventual consistency?
├── YES → Need complex workflow management?
│         ├── YES → Parallel Saga (async, eventual, orchestrated) ← usual default
│         └── NO  → Anthology (choreographed) at highest scale;
│                   Time Travel (sync, choreographed) for simple pipelines
└── NO  → Atomic required (harder road)
          └── Epic Saga (sync, atomic, orchestrated) for simple workflows
```

Two warnings: **never** combine async + atomic + choreography (Horror Story — worst combination; escape by dropping atomic → Parallel Saga). Choreographed workflows carry state via stamp coupling — the one legitimate stamp-coupling use.

The full 8-pattern matrix with per-pattern detail and the orchestration-vs-choreography trade-off table: `references/reference.md`.

**Error handling:** atomic sagas use **compensating updates** (orchestrator sends undos — all data restored, but no isolation and undos may fail); eventual sagas use **state management** (track saga state, resolve asynchronously — good responsiveness, temporary inconsistency).

## Contracts

A contract is every technique used to wire parts of a system together — integration points, transitive dependencies, caches — not just an API format. **Core rule: strictness follows semantic coupling × consumer count.** Tightly coupled with few internal consumers → strict (gRPC, strict JSON schema); different domains or many/external consumers → loose (JSON name-value pairs) plus consumer-driven contracts. Keep contracts at need-to-know level — passing fields the consumer doesn't use is stamp coupling, an anti-pattern (except as the workflow-state carrier in choreographed sagas).

Load `references/reference.md` when designing or reviewing interservice contracts — strict-to-loose spectrum, microservices contract pattern, consumer-driven contract mechanics, contract checklist.

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
- **Never split the database before the code.** Data relationships are the strongest integrator; get the services right first.
- **No shared library for domain code that changes monthly; no service-per-noun.** >40% shared domain code changing fast → consolidate instead.
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
