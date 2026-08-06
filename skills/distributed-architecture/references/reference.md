# Distributed Architecture — Deep Reference

Load conditions are listed in `SKILL.md`. Everything here expands a pattern the summary already names.

## Table of Contents

1. [Decision Machinery](#decision-machinery) — ADR template, fitness function taxonomy
2. [Codebase Health Metrics](#codebase-health-metrics) — Ca/Ce, abstractness, instability, main sequence
3. [Monolith Decomposition](#monolith-decomposition) — tactical forking, 6 component-based patterns, architecture stories, governance
4. [Saga Patterns in Full](#saga-patterns-in-full) — the 8 combinations, orchestration vs choreography, error handling
5. [Data in Depth](#data-in-depth) — should-we-decompose drivers, joint ownership, read patterns, five-step database decomposition
6. [Contracts](#contracts) — strict-to-loose spectrum, microservices contract pattern, consumer-driven contracts, stamp coupling, contract checklist
7. [Code Reuse Across Services](#code-reuse-across-services) — replication, shared library, shared service, sidecar/service mesh, the reuse trap, reuse checklist

---

## Decision Machinery

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

### Fitness Function Taxonomy

A **fitness function** is any mechanism that performs an objective integrity assessment of some architecture characteristic. Distinguish from unit tests with one question: **"Is domain knowledge required?"** No → fitness function (architecture). Yes → unit test (domain).

| Scope | Description | Example |
|-------|-------------|---------|
| Atomic | Single characteristic in isolation | Check for component cycles |
| Holistic | Combination of characteristics | Security + performance together |
| Continuous | Runs automatically (CI/CD, monitors) | Latency monitoring |
| Triggered | Runs on demand | Architecture review |

Useful fitness functions: no cyclic dependencies between components; component size limits; namespace conformance; consumer-driven contracts verifying loose contracts; connection quota monitoring per service; auto-trait regression (types maintain expected characteristics).

---

## Codebase Health Metrics

Derive Ca/Ce from the codebase's import/dependency graph via language-appropriate static analysis.

### Afferent and Efferent Coupling

- **Afferent (Ca)** — incoming connections (how many things depend on this component)
- **Efferent (Ce)** — outgoing connections (how many things this component depends on)

High efferent coupling = high change risk. When this component's dependencies change, it breaks.

### Abstractness (A)

```
A = abstract elements / (abstract + concrete elements)
```

Ratio of interfaces/abstract classes to concrete implementations. Too low = brittle and hard to understand. Too high = useless abstractions.

### Instability (I)

```
I = Ce / (Ce + Ca)
```

Ratio of outgoing to total coupling. I ≈ 1 = highly unstable (breaks easily). I ≈ 0 = stable or rigid.

### Distance from the Main Sequence (D)

```
D = |A + I - 1|
```

Measures the balance between abstractness and instability. Closer to 0 = healthier.

**Two danger zones:**
- **Zone of Uselessness** — too abstract, too stable, difficult to use
- **Zone of Pain** — too concrete, too unstable, brittle and hard to maintain

If many components fall into either zone, the codebase may not be worth decomposing — consider a rewrite or major refactoring first.

---

## Monolith Decomposition

> "How do you eat an elephant? One bite at a time. But don't use the Elephant Migration Anti-Pattern — that leads to a distributed monolith."

The biggest mistake is ad-hoc extraction ("let's start with the easy stuff") — that leads to a big ball of distributed mud.

### Tactical Forking

For unstructured codebases (big ball of mud). Make replicas of the entire application and chip away the parts you don't need — like a sculptor working from a block of marble.

**Action:** Replicate the entire application, one replica per target service. In each replica, delete the parts not needed for that service's responsibility. Reconcile shared code and data ownership across replicas afterward.

### The 6 Component-Based Decomposition Patterns

For structured codebases with identifiable components (namespaces, directories). Apply in order during initial migration, then individually for maintenance.

**1. Identify and size components.** Catalog all architectural components and assess size: number of statements (not lines of code — statements are language-independent), number of public interfaces/operations, relative size vs other components. Too large → candidates for splitting; too small → candidates for merging. Large components are more coupled, harder to extract, and lead to less modular services.

**2. Gather common domain components.** Find duplicated business domain logic and consolidate it. Duplicate domain logic in a monolith becomes duplicate services in a distributed architecture. Consolidate *before* extracting to avoid redundant services.

**3. Flatten components.** Ensure every source file lives within a well-defined component — no orphaned files floating between namespaces. Collapse or expand directory structures so all code has a clear component home. Remove intermediate organizational layers that don't represent meaningful components.

**4. Determine component dependencies.** Map the dependency graph. High coupling between many components → migration is expensive; clusters of tightly coupled components must move together; clean boundaries → easier extraction. Build a dependency matrix, refactor to reduce cross-component dependencies where possible, and use it to estimate effort and prioritize extraction order.

**5. Create component domains.** Group related components into logical domains; refactor namespaces to align. A domain is a collection of components that will become a single service (or a small set of closely related services).

**6. Create domain services.** Physically extract domains into separately deployed services. Each domain service owns its code, data, and deployment pipeline.

### Architecture Stories

Document decomposition work using **architecture stories**, not user stories:

> "As an architect, I need to decouple the payment service to support better extensibility and agility when adding additional payment types."

Architecture stories capture structural refactoring that satisfies a business driver — distinct from technical debt stories (developer-oriented cleanup). Keep them short; the pattern mechanics live here, not in the story.

### Governance During Decomposition

After applying each pattern, guard against regression with fitness functions:

- **Cycle detection** — no circular dependencies between components
- **Component size monitoring** — alert when a component exceeds threshold
- **Dependency direction** — enforce that dependencies flow in the correct direction
- **Namespace conformance** — all files belong to their declared component

---

## Saga Patterns in Full

The positional superscript gives (communication, consistency, coordination): s/a = sync/async, a/e = atomic/eventual, o/c = orchestrated/choreographed.

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

Notes the selection tree doesn't show:

- **Anthology (aec)** — services must carry workflow context via stamp coupling (see Contracts).
- **Horror Story (aac)** — usually arises when someone "improves performance" of an Epic Saga by adding async + choreography without considering the entangled dimensions. **Escape by dropping atomic consistency → Parallel Saga (aeo).**
- **Fairy Tale (seo)** — simplest good option when consistency can be eventual and scale is moderate.
- **Fantasy Fiction (aao)** — async + atomic = pain; avoid.

### Orchestration vs Choreography

| Factor | Favors orchestration | Favors choreography |
|--------|---------------------|---------------------|
| Workflow complexity | High (many paths, error conditions) | Low (linear, few errors) |
| Scale requirements | Moderate | High (no bottleneck) |
| Error handling | Complex (centralized control) | Simple (few conditions) |
| Service coupling | Acceptable (coupling to orchestrator) | Minimal desired |
| Debugging | Easier (single observation point) | Harder (distributed state) |

### Compensating Updates vs State Management

| | Compensating updates | State management |
|-|---------------------|------------------|
| Advantages | All data restored; allows retries and restart | Good responsiveness; less end-user impact |
| Disadvantages | No isolation; side effects; may fail; poor responsiveness | Data temporarily out of sync; convergence takes time |

State management gives the user an immediate response; the state machine documents all paths through the workflow.

---

## Data in Depth

### Should We Decompose the Database?

| Disintegrators | Integrators |
|----------------|-------------|
| Change control (how many services break per schema change?) | Data relationships (foreign keys, views, triggers) |
| Connection management (service instances × connections can exceed database capacity) | Database transactions (ACID required across tables?) |
| Scalability (can the DB scale with services?) | |
| Fault tolerance (does one DB crash take down all services?) | |
| Architectural quantum (shared DB forces a single quantum) | |
| Database type optimization (would some data benefit from non-relational storage?) | |

### Joint Ownership — Four Techniques

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

### How Non-Owners Read Data — Four Patterns

| Pattern | Pros | Cons | Use when |
|---------|------|------|----------|
| Interservice communication | Simple; no volume issues | ~100–1000ms end-to-end; throughput limits; availability dependency; needs contracts | Small volumes, infrequent access, reliable owner |
| Column schema replication | Good performance; no service dependency | Consistency issues; ownership governance; synchronization required | Reporting, aggregation, or when volume/throughput defeats other patterns |
| Replicated caching | Best performance (in-memory); fault tolerant; consistent; ownership preserved | Hard cloud/container config; bad for >500MB volumes or high update rates; startup dependency on owner | Relatively static data, manageable volume, need performance + fault tolerance. Products: Hazelcast, Apache Ignite, Oracle Coherence |
| Data domain (shared schema) | Good performance; consistent; foreign keys preserved | Broader bounded context; ownership governance; access security concerns | All other patterns fail and you accept the broader context |

### Five-Step Database Decomposition

1. Analyze the database and create data domains — group related tables (with their foreign keys, views, triggers).
2. Assign tables to data domains — separate schemas within the same database.
3. Separate database connections — each service connects only to its own schema.
4. Move schemas to separate databases.
5. Switch over to independent databases.

**Key rule: a service should NEVER connect to multiple databases or schemas.** If it needs data from another domain, use one of the four read-access patterns.

---

## Contracts

A contract is every technique used to wire parts of a system together — integration points, transitive dependencies, caches, any inter-part communication — not just an API format. Contracts cut across all three dynamic coupling dimensions.

### The Strict-to-Loose Spectrum

```
STRICT ←――――――――――――――――――――――→ LOOSE
RMI/RPC → gRPC → SOAP → REST → GraphQL → JSON name-value pairs
```

| | Strict | Loose |
|--|--------|-------|
| Properties | Enforces names, types, ordering; mimics internal method calls | Minimal metadata, often name-value pairs |
| Advantages | Guaranteed fidelity; versioned; build-time verification; better documentation | Highly decoupled; easier to evolve |
| Disadvantages | Tight coupling — changes ripple; versioning can become an integration nightmare | Harder contract management; needs fitness functions for verification |

**Strictness driver = semantic coupling × consumer count:**

| Situation | Recommendation |
|-----------|---------------|
| Semantically tightly coupled, changes together | Strict (gRPC, strict JSON schema) |
| Different domains, changes independently | Loose (JSON name-value pairs) |
| External consumers (mobile apps, third parties) | Loose (slow deployment cycles) |
| Internal, same-team services | Strict is fine |
| Many consumers, high stability needs | Loose + consumer-driven contracts |

Example: an orchestrator uses strict contracts with core domain services (ticket management, assignment — tightly semantically coupled) but loose contracts with notification/survey services (change slowly, gain nothing from brittle coupling).

### The Microservices Contract Pattern

1. Each service keeps its own **internal representation** of domain entities (its own `Customer`).
2. Integration uses **name-value pairs**.
3. Fidelity is verified via **consumer-driven contracts**.

This yields bounded contexts (each service evolves internally), implementation decoupling (tech stack can change without breaking integration), and platform independence.

### Consumer-Driven Contracts

1. The **consumer** writes a contract specifying the fields it needs from the provider.
2. The **provider** includes each consumer's contract as a test in its CI/CD pipeline and keeps it green.

Advantages: loose coupling, per-consumer variability in strictness, evolvable. Disadvantages: requires engineering maturity (disciplined CI, no skipping failed tests); two mechanisms (contract + test) instead of one.

### Stamp Coupling — Both Faces

Passing a large data structure where the consumer uses only a small part.

- **Anti-pattern:** over-specifying contracts with fields the consumer doesn't need. If an unused field changes format, the consumer breaks anyway — unnecessary brittleness, and at high scale a bandwidth problem. **Keep contracts at need-to-know level; don't over-specify for future-proofing.**
- **Legitimate pattern:** workflow management in choreographed architectures. The contract carries domain data **plus** workflow state (status, transaction state, error info); each service updates its portion and forwards it, and the final receiver can query the outcome. Trade: enables complex workflows without an orchestrator and improves throughput/scale, at the cost of higher coupling and potential bandwidth issues.

### Contract Checklist

```
☐ Semantic coupling — do these services change together?
    High → strict OK; Low → prefer loose
☐ Consumer count/diversity — many or external → loose + consumer-driven contracts
☐ Stamp coupling — any fields the consumer doesn't use? Trim to need-to-know
☐ Deployment constraints — slow consumer deploy cycle (app store, external)? → loose
☐ Verification — strict: schema validation at build time; loose: consumer-driven
    contracts as fitness functions
☐ Document contract decisions in ADRs
```

---

## Code Reuse Across Services

**Reuse is derived via abstraction but operationalized by slow rate of change.** Successful reuse (operating systems, frameworks) works because the shared code changes slowly; internal domain code changes fast, making it a terrible coupling target.

The central decision: **library, service, sidecar, or duplication?** Two questions drive it:

1. Is this **operational** (infrastructure: logging, auth, monitoring) or **domain** (business rules, validators, formatters) logic?
2. How frequently does it change?

```
                     Operational                        Domain
Rarely changes     → Sidecar / shared library        → Shared library (versioned)
Frequently changes → Sidecar                         → Shared service OR consolidate services
Static, one-off    → Code replication                → Code replication
```

### Pattern 1: Code Replication

Copy the code into each service's repository. Preserves bounded context with no sharing dependencies, but changes are hard to apply and there is no versioning — a bug in replicated code means time-consuming, error-prone updates across all services. Use for simple, static, one-off utilities (marker annotations), or during migration so each service can evolve its copy independently.

### Pattern 2: Shared Library

External artifact (JAR, DLL, GEM, npm package) bound at compile time: versioned changes, fewer runtime errors, good agility — but dependency management and version deprecation/communication are hard, and heterogeneous codebases duplicate it.

- **Granularity:** coarse-grained (one big library) is simple but ANY change eventually forces ALL services to update, widening testing scope; fine-grained impacts fewer services but complicates the dependency matrix. **Favor smaller, functionally partitioned libraries; carve off stable functionality (formatters, security) to reduce version churn.**
- **Always version.** Deprecation policy: custom per library (fast-changing libs keep more versions, stable libs fewer — best fit, harder to maintain) vs global (e.g., max 4 versions for all — simple, but churns fast-changing libraries).
- **Critical rules:** never use `LATEST` in service configs (unpredictable breaks during hotfixes); a defect or breaking change invalidates all deprecation — all services must adopt immediately; frequent changes to shared *domain* code → consider consolidating services instead.
- Use in homogeneous environments with low-to-moderate change, where compile-time safety beats runtime risk.

### Pattern 3: Shared Service

Shared functionality deployed as its own service, called at runtime. Good for high volatility and polyglot environments (no cross-platform duplication); preserves bounded context. But it adds network + security latency, fault-tolerance and scalability dependencies, and **runtime risk**: you can deploy a change without redeploying consumers — and break all of them simultaneously in production. API endpoint versioning (`/app/1.0/calc` vs `/app/1.1/calc`) only partially helps: consumers must update endpoint configs, versioning decisions are subjective, and it doesn't work cleanly across multiple protocols (REST + messaging + gRPC). Use in highly polyglot environments, or when change is frequent enough that redeploying consumers per change is impractical.

### Pattern 4: Sidecar and Service Mesh

Each service includes a sidecar component owned by a shared infrastructure team; when every service has one, the sidecars interconnect into a **service mesh** — a consistent operational layer. Based on Hexagonal Architecture (Ports and Adapters). Advantages: consistent operational coupling, centralized infrastructure coordination, flexible ownership (team, centralized, or hybrid). Disadvantages: one implementation per platform; the sidecar can grow large.

What goes in the sidecar:

- **YES (operational coupling):** monitoring, logging, service discovery, authN/authZ, circuit breakers, rate limiting.
- **NO (domain coupling):** shared domain classes (Address, Customer), business logic, domain validators.
- **Borderline (>50% test):** a utility like `JSONtoXML` — if more than half the teams use it, sidecar is reasonable; otherwise shared library.

### The Reuse Trap

Centralizing every instance of a domain concept (e.g., Customer) into a single shared service fails twice: the unified entity must be complex enough for every domain's needs (hard to use for simple cases), and a change for one domain potentially breaks all others. **Modern approach:** build platforms with well-defined APIs — the API provides the loose coupling that allows aggressive internal change without breaking consumers.

### Reuse Decision Checklist

```
☐ Operational or domain coupling?
☐ How frequently does this code change?
☐ How many services use it? Is the environment polyglot?
☐ Can we tolerate runtime risk (shared service) or do we prefer
    compile-time safety (shared library)?
☐ Is shared domain code >40% of the collective codebase? → consolidate
```
