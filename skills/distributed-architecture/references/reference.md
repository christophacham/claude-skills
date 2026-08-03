# Distributed Architecture — Deep Reference

Load conditions are listed in `SKILL.md`. Everything here expands a pattern the summary already names.

## Table of Contents

1. [Contracts](#contracts) — strict-to-loose spectrum, microservices contract pattern, consumer-driven contracts, stamp coupling, contract checklist
2. [Code Reuse Across Services](#code-reuse-across-services) — replication, shared library, shared service, sidecar/service mesh, the reuse trap, reuse checklist

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
