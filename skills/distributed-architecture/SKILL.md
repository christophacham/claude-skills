---
name: distributed-architecture
description: "Trade-off-driven design for distributed architectures. Use when deciding whether to split or merge services, decomposing databases or assigning table ownership, choosing saga patterns (sync/async, atomic/eventual, orchestrated/choreographed), designing service contracts (strict vs loose, consumer-driven contracts, stamp coupling), or sharing code across services (library vs service vs sidecar vs duplication). Also for trade-off analysis, ADRs, and fitness functions. Not for general distributed-systems theory (CAP, consensus protocols), concrete framework tutorials, or DDD domain modeling."
---

# Distributed Architecture

Covers the five recurring hard decisions of distributed architectures — granularity, data, workflow, contracts, and code reuse — plus the shared machinery for making them: trade-off analysis, ADRs, and fitness functions.

## Core Mental Model

Everything is a trade-off. Don't try to find the best design; strive for the **least worst combination of trade-offs**. If you think you've found something that isn't a trade-off, you haven't found the trade-off yet. No best practices exist for most real architecture decisions — every problem is a snowflake.

**Static coupling** is how parts are *wired* together: deployment-time dependencies on the OS/container, frameworks and libraries, databases, integration points, and messaging infrastructure. It answers "what must be deployed together?"

**Dynamic coupling** is how parts *communicate* at runtime, along three entangled dimensions — changing one affects the trade-offs of the others:

| Dimension | Values | Answers |
|-----------|--------|---------|
| Communication | synchronous / asynchronous | Do callers wait for responses? |
| Consistency | atomic / eventual | Must data agree across services immediately? |
| Coordination | orchestrated / choreographed | Is there a central workflow owner? |

An **architecture quantum** is an independently deployable artifact with high functional cohesion, high static coupling, and synchronous dynamic coupling. It is the fundamental unit of coupling analysis. **A shared database makes everything a single quantum**, no matter how many services you deploy:

| Architecture | Quantum count |
|-------------|---------------|
| Monolith (any style) | Always 1 |
| Service-based with shared DB | 1 (the database couples everything) |
| Microservices with DB per service | Multiple (each service is a quantum) |

Two principles that constrain everything below:

- **Architects cannot reduce semantic coupling via implementation.** If two services share a concept, that coupling must go somewhere — you can only choose where.
- **Iterate.** No architect's first draft is perfect. Build matrices and sample topologies, then refine.

## Decision Machinery

### The Disintegrators-vs-Integrators Pattern

Every structural decision below uses the same shape: **disintegrators** (forces pulling apart) vs **integrators** (forces holding together). Most teams over-index on disintegrators and ignore integrators. Run through *both* lists, then form a trade-off statement.

### Trade-Off Analysis: Three Steps

1. **Find what's entangled.** Identify dimensions where changing one forces changes in others. Examine recurring coupling points across many examples in your domain; build static coupling diagrams showing deployment dependencies.
2. **Analyze how they're coupled.** Build a matrix of all dimension combinations; skip infeasible ones; for each feasible combination, rate the relevant trade-off concerns.
3. **Assess trade-offs.** Determine the impact of change on interdependent systems. Start **qualitative** (low/medium/high ratings); move to **quantitative** (latency ms, throughput req/s) only when you can measure. Both are valid.

When no existing framework fits a novel problem: identify your own dimensions (gather input from developers, architects, and operations), build the combination matrix, then **test with sample topologies** — toy workflows, not real implementations — and iterate on the matrix.

### Trade-Off Statements for the Business

Convert analysis into business-readable choices:

> "We can improve [X] by choosing [option A], but this will degrade [Y]. Which is more important for our business — [X value] or [Y value]?"

Pair disintegrators against integrators concretely, e.g.:

- "We want to break apart the service to isolate frequent code changes, but we won't be able to maintain a database transaction. Which matters more — faster time-to-market or stronger data consistency?"
- "We need to keep the service together for ACID transactions, but that means sensitive functionality will be less secure. Which matters more — data consistency or security?"
- "We want to break apart the payment service for better extensibility, but that increases workflow, impacting responsiveness when multiple payment types are used. Which matters more — extensibility or responsiveness?"

### ADR Template

Document every significant decision:

```
ADR: [Short noun phrase containing the decision]

Context:
  Short description of the problem.
  List of alternative solutions considered.

Decision:
  The architecture decision with detailed justification.
  Reference the specific trade-offs analyzed.

Consequences:
  What happens after the decision is applied.
  The trade-offs that were accepted.
```

ADR tips: keep to 1–2 pages; include the trade-off statement that drove the decision; reference which disintegrators/integrators were weighed; state which business stakeholder confirmed the trade-off priority.

### Fitness Functions

A **fitness function** is any mechanism that performs an objective integrity assessment of some architecture characteristic. Distinguish from unit tests with one question: **"Is domain knowledge required?"** No → fitness function (architecture). Yes → unit test (domain).

| Scope | Description | Example |
|-------|-------------|---------|
| Atomic | Single characteristic in isolation | Check for component cycles |
| Holistic | Combination of characteristics | Security + performance together |
| Continuous | Runs automatically (CI/CD, monitors) | Latency monitoring |
| Triggered | Runs on demand | Architecture review |

Useful fitness functions: no cyclic dependencies between components; component size limits; namespace conformance; consumer-driven contracts verifying loose contracts; connection quota monitoring per service; auto-trait regression (types maintain expected characteristics).

## Granularity: Should This Be One Service or Many?

Granularity is about what a service *does*, not lines of code or class count. Do NOT answer with "single-responsibility principle" — it is too subjective. Run the drivers, then form trade-off statements.

### Disintegrators (Reasons to Split)

| Driver | Question | Notes |
|--------|----------|-------|
| Service scope & function | Is the service doing unrelated things? | Assess cohesion. Strong cohesion (Notification: SMS+Email+Letter) → splitting on scope alone is NOT justified; weak cohesion (Customer: Profile+Preferences+Comments) → good candidate. |
| Code volatility | Do changes hit only one part? | Measure change frequency via version control history. Splitting isolates volatile code, shrinking testing scope and deployment risk. |
| Scalability & throughput | Do parts need to scale differently? | Extreme variation forces low-throughput functions to scale unnecessarily with high-throughput ones. |
| Fault tolerance | Can one function's failure take down unrelated ones? | Check that the "leftover" still has a meaningful name and cohesion — if the remainder is only nameable as "Non-Email Service," split into more pieces. |
| Security | Do some parts need higher security? | Separate services give finer-grained access control at the service level, not just the API level. |
| Extensibility | Is the service always adding new contexts? | Apply only when continued extensibility is confirmed or likely — don't speculate. |

**Cohesion warning:** "single purpose" is subjective. A Notification Service doing SMS, Email, and Postal is already cohesive — "notification" IS the single purpose. Don't split just because you can name sub-functions.

### Integrators (Reasons to Keep Together)

| Driver | Question | Notes |
|--------|----------|-------|
| Database transactions | Is an ACID transaction required across the data? | Separate services cannot share one transaction. All-or-nothing business requirements (e.g., registration: profile + password + billing) force consolidation. |
| Workflow & choreography | Do the services talk constantly? | Rule of thumb: if >50% of requests require interservice communication, consider consolidation — and check whether *critical* requests (strict response-time requirements) are in that group. Each hop adds ~100–300ms of network + security latency (per hop, before data transfer); transitive dependencies spread failures. |
| Shared code | Is shared domain logic significant? | If shared *domain* code is >40% of the collective codebase AND changes frequently, consolidate. Infrastructure code (logging, auth, monitoring) is NOT an integrator — handle it via libraries or sidecars. |
| Data relationships | Can the data actually be separated? | Map functions to tables; mutual per-operation dependence on each other's tables means consolidate. This integrator has the **fewest trade-offs** — data relationships are hard to refactor. |

### Granularity Checklist

```
☐ Run all 6 disintegrators — which apply?
☐ Run all 4 integrators — which apply?
☐ Quantify where possible (change frequency, throughput, latency)
☐ Form trade-off statements pairing disintegrators against integrators
☐ Discuss with business stakeholders; document in an ADR
☐ After splitting: does the "leftover" have a meaningful name and cohesion?
☐ After splitting: has interservice communication created worse problems
    than you solved?
```

## Data: Decomposition, Ownership, and Access

Breaking apart a database is much harder than breaking apart application functionality. Answer three questions in order: **Should** we decompose? **Who owns** each table? **How** do non-owners access data?

### Should We Decompose?

| Disintegrators | Integrators |
|----------------|-------------|
| Change control (how many services break per schema change?) | Data relationships (foreign keys, views, triggers) |
| Connection management (service instances × connections can exceed database capacity) | Database transactions (ACID required across tables?) |
| Scalability (can the DB scale with services?) | |
| Fault tolerance (does one DB crash take down all services?) | |
| Architectural quantum (shared DB forces a single quantum) | |
| Database type optimization (would some data benefit from non-relational storage?) | |

### Who Owns Each Table?

**General rule: the service that performs writes owns the table.** Three scenarios, in order of difficulty:

1. **Single ownership** — only one service writes. Assign to that service's bounded context. Resolve these first to clear the field.
2. **Common ownership** — most/all services write (e.g., an Audit table). Create a dedicated owner service; others send data to it — fire-and-forget via persistent queues if no response is needed, synchronous call if confirmation is required.
3. **Joint ownership** — two or three services in the same domain write to the same table. Four techniques:

| Technique | How | Trade-offs |
|-----------|-----|------------|
| Table split | Split the table so each service owns its portion | Preserves bounded context and single ownership; requires restructuring, loses ACID between updates, synchronization is difficult |
| Data domain (shared schema) | Put jointly-owned tables in a schema both services access | Good performance, no service dependency, consistent data; schema changes hit multiple services, needs write-governance, broadens the bounded context. **Always re-evaluate whether separate services are actually needed** |
| Delegate | Assign one service as sole owner; the other calls it for writes | Single ownership, good change control; high coupling, slow non-owner writes, no atomic transaction for them. Pick the delegate by **primary domain priority** (most CRUD operations) or **operational characteristics priority** (needs highest performance/throughput) |
| Service consolidation | Merge the services | Eliminates the problem; preserves ACID and performance; coarser scalability, less fault tolerance, more deployment risk |

Selection hints: Table Split = best bounded context; Data Domain = best performance but weaker context; Delegate = single owner but coupling; Consolidation = nuclear option.

Table-split mechanics:

```sql
-- Example: split inventory data out of the Product table
CREATE TABLE Inventory (product_id VARCHAR(10), inv_cnt INT);
INSERT INTO Inventory SELECT product_id, inv_cnt FROM Product;
ALTER TABLE Product DROP COLUMN inv_cnt;
```

### How Do Non-Owners Read Data?

Four patterns, simplest to most involved:

| Pattern | Pros | Cons | Use when |
|---------|------|------|----------|
| Interservice communication | Simple; no volume issues | ~100–1000ms end-to-end (per-hop network + security latency plus data transfer and possible multiple hops); throughput limits; availability dependency; needs contracts | Small volumes, infrequent access, reliable owner |
| Column schema replication | Good performance; no service dependency | Consistency issues; ownership governance; synchronization required | Reporting, aggregation, or when volume/throughput defeats other patterns |
| Replicated caching | Best performance (in-memory); fault tolerant; consistent; ownership preserved | Hard cloud/container config; bad for >500MB volumes or high update rates; startup dependency on owner | Relatively static data, manageable volume, need performance + fault tolerance. Products: Hazelcast, Apache Ignite, Oracle Coherence |
| Data domain (shared schema) | Good performance; consistent; foreign keys preserved | Broader bounded context; ownership governance; access security concerns | All other patterns fail and you accept the broader context |

### ACID → BASE

Distributed transactions are not just harder — they are fundamentally different. ACID gives atomicity (all-or-nothing), enforced constraints, isolation of uncommitted data, and full durability. BASE (Basic Availability, Soft State, Eventual Consistency) gives per-service commits, temporarily inconsistent data, immediately visible committed data, and per-service durability only. Much of the real world isn't transactional. Three eventual-consistency patterns:

1. **Background synchronization** — external process periodically syncs (slowest, simplest, breaks bounded contexts).
2. **Orchestrated request-based** — orchestrator coordinates during the request (better consistency, worse responsiveness, complex error handling).
3. **Event-based** — events trigger downstream updates (best decoupling, requires event infrastructure).

### Five-Step Database Decomposition

1. Analyze the database and create data domains — group related tables (with their foreign keys, views, triggers).
2. Assign tables to data domains — separate schemas within the same database.
3. Separate database connections — each service connects only to its own schema.
4. Move schemas to separate databases.
5. Switch over to independent databases.

**Key rule: a service should NEVER connect to multiple databases or schemas.** If it needs data from another domain, use one of the four read-access patterns.

## Workflow: Sagas and Coordination

Every combination of the three dynamic-coupling dimensions produces a named saga pattern:

| Dimension | Option A | Option B |
|-----------|----------|----------|
| Communication | **Sync**: caller waits; sequential; simpler (no race conditions); lower throughput | **Async**: fire-and-continue; parallel, possibly out-of-order; deadlocks/race conditions; higher throughput |
| Consistency | **Atomic**: all succeed or all fail across services; compensating updates; very high coupling | **Eventual**: converges over time; per-service transaction scope; state management + retries; low coupling |
| Coordination | **Orchestrated**: central mediator owns workflow logic; may bottleneck; centralized error handling | **Choreographed**: no owner; logic distributed; services more complex; each handles its own errors |

### The 8 Saga Patterns

The superscript is positional — three letters for (communication, consistency, coordination): s/a = sync/async, a/e = atomic/eventual, o/c = orchestrated/choreographed:

| Pattern | Comm | Consist | Coord | Coupling | Complexity | Responsiveness | Scale |
|---------|------|---------|-------|----------|------------|----------------|-------|
| Epic Saga (sao) | Sync | Atomic | Orch | Very high | Low | Low | Very low |
| Phone Tag (sac) | Sync | Atomic | Chor | High | High | Low | Low |
| Fairy Tale (seo) | Sync | Eventual | Orch | High | Very low | Medium | High |
| Time Travel (sec) | Sync | Eventual | Chor | Medium | Low | Medium | High |
| Fantasy Fiction (aao) | Async | Atomic | Orch | High | High | Low | Low |
| Horror Story (aac) | Async | Atomic | Chor | Medium | Very high | Low | Medium |
| Parallel Saga (aeo) | Async | Eventual | Orch | Low | Low | High | High |
| Anthology (aec) | Async | Eventual | Chor | Very low | High | High | Very high |

Details the selection tree below doesn't show:

- **Anthology (aec)** — services must carry workflow context via stamp coupling (see Contracts).
- **Horror Story (aac)** — usually arises when someone "improves performance" of an Epic Saga by adding async + choreography without considering the entangled dimensions. **Escape by dropping atomic consistency → Parallel Saga (aeo).**

### Selection Tree

```
Can you tolerate eventual consistency?
├── YES → Need complex workflow management?
│         ├── YES → High scale? → YES: Parallel Saga (aeo) ← RECOMMENDED
│         │                   └ NO:  Fairy Tale (seo)     ← simplest good option
│         └── NO  → High scale? → YES: Anthology (aec)    ← highest throughput
│                             └ NO:  Time Travel (sec)    ← simple pipelines
└── NO  → Atomic consistency required (harder road)
          ├── Simple workflow → Epic Saga (sao) — familiar but costly
          ├── Some scale      → Phone Tag (sac) — slightly better
          ├── AVOID           → Fantasy Fiction (aao) — async + atomic = pain
          └── NEVER           → Horror Story (aac) — worst combination
```

### Error Handling: Compensating Updates vs State Management

**Compensating updates** (atomic patterns): the orchestrator sends undo requests on failure.

**State management** (eventual patterns): track saga *state* and resolve errors asynchronously via retries or manual repair. The user gets an immediate response; the state machine documents all paths through the workflow.

| | Compensating updates | State management |
|-|---------------------|------------------|
| Advantages | All data restored; allows retries and restart | Good responsiveness; less end-user impact |
| Disadvantages | No isolation; side effects; may fail; poor responsiveness | Data temporarily out of sync; convergence takes time |

### Orchestration vs Choreography

| Factor | Favors orchestration | Favors choreography |
|--------|---------------------|---------------------|
| Workflow complexity | High (many paths, error conditions) | Low (linear, few errors) |
| Scale requirements | Moderate | High (no bottleneck) |
| Error handling | Complex (centralized control) | Simple (few conditions) |
| Service coupling | Acceptable (coupling to orchestrator) | Minimal desired |
| Debugging | Easier (single observation point) | Harder (distributed state) |

## Contracts

A contract is every technique used to wire parts of a system together — integration points, transitive dependencies, caches — not just an API format. **Core rule: strictness follows semantic coupling × consumer count.** Tightly coupled with few internal consumers → strict (gRPC, strict JSON schema); different domains or many/external consumers → loose (JSON name-value pairs) plus consumer-driven contracts. Keep contracts at need-to-know level — passing fields the consumer doesn't use is stamp coupling, an anti-pattern (except as the workflow-state carrier in choreographed sagas).

Load `references/reference.md` when designing or reviewing interservice contracts — it has the strict-to-loose spectrum, the microservices contract pattern, consumer-driven contract mechanics, stamp coupling's legitimate use, and the contract checklist.

## Code Reuse Across Services

**Reuse works only when the shared code changes slowly** — reuse is derived via abstraction but operationalized by slow rate of change. The decision — library, service, sidecar, or duplication — is driven by two questions: operational (infrastructure) or domain logic, and how frequently it changes. **Core rule:** operational → sidecar (or shared library if rarely changing); domain + rarely changing → versioned shared library; domain + frequently changing → shared service or consolidate the services; static one-off → replicate. Shared *domain* code that is >40% of the collective codebase AND changes frequently → consolidate.

Load `references/reference.md` when choosing how to share code across services — it has all four reuse patterns in depth, versioning/deprecation rules, sidecar contents, the reuse trap, and the reuse decision checklist.

## End-to-End Checklist

```
For any significant distributed-architecture decision:

1. UNTANGLE — identify the entangled dimensions
2. ANALYZE  — model combinations, rate trade-offs
3. ASSESS   — determine impact of change on interdependent systems
4. DISCUSS  — form trade-off statements for business stakeholders
5. DOCUMENT — write an ADR with explicit trade-off justification
6. GOVERN   — implement fitness functions to enforce the decision

Quantum check:
☐ What are the deployment boundaries? (static coupling)
☐ What are the communication dependencies? (dynamic coupling)
☐ Does a shared database collapse multiple services into one quantum?
☐ Can each quantum deploy independently?
```
