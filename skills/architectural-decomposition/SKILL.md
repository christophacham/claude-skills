---
name: architectural-decomposition
description: "Monolith decomposition patterns from Ford, Richards, Sadalage & Dehghani's 'Software Architecture: The Hard Parts.' Use when breaking apart a monolithic application, planning a migration to microservices or service-based architecture, evaluating codebase health for decomposition, or choosing between component-based decomposition and tactical forking. Covers codebase analysis metrics (afferent/efferent coupling, abstractness, instability, distance from main sequence), the decomposition decision tree, 6 component-based decomposition patterns, and fitness functions for governance. Not for granularity decisions on existing services, database decomposition, or greenfield design — see the distributed-architecture skill."
---

# Architectural Decomposition

> "How do you eat an elephant? One bite at a time. But don't use the Elephant Migration Anti-Pattern — that leads to a distributed monolith."
> — Software Architecture: The Hard Parts, Chapter 4

Decomposition describes the **how** of breaking apart a monolith. The biggest mistake is ad-hoc extraction ("let's start with the easy stuff") — that's the Elephant Migration Anti-Pattern and leads to a big ball of distributed mud.

---

## Step 1: Is the Codebase Decomposable?

Before attempting decomposition, assess codebase health using these metrics:

### Afferent and Efferent Coupling

- **Afferent (Ca)** — incoming connections (how many things depend on this component)
- **Efferent (Ce)** — outgoing connections (how many things this component depends on)

High efferent coupling = high change risk. When this component's dependencies change, it breaks.

Derive Ca/Ce from the codebase's import/dependency graph via language-appropriate static analysis (no tool is bundled with this skill).

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
- **Zone of Uselessness** (upper-right) — too abstract, too stable, difficult to use
- **Zone of Pain** (lower-left) — too concrete, too unstable, brittle and hard to maintain

If many components fall into either zone, the codebase may not be worth decomposing — consider a rewrite.

---

## Step 2: Choose a Decomposition Approach

```
Is the codebase decomposable?
├── NO  → Consider rewrite or major refactoring first
└── YES → Is the source code structured with identifiable components?
          ├── NO  → Tactical Forking
          └── YES → Component-Based Decomposition
```

### Tactical Forking

For unstructured codebases (big ball of mud). Make replicas of the entire application and chip away the parts you don't need — like a sculptor working from a block of marble.

**Action:** Replicate the entire application, one replica per target service. In each replica, delete the parts not needed for that service's responsibility. Reconcile shared code and data ownership across replicas afterward.

### Component-Based Decomposition

For structured codebases with identifiable components (namespaces, directories). Apply the six patterns below in sequence.

---

## The 6 Component-Based Decomposition Patterns

Apply these in order during initial migration, then individually for maintenance:

### Pattern 1: Identify and Size Components

Catalog all architectural components and assess their size.

**What to measure:**
- Number of statements (not lines of code — statements are language-independent)
- Number of public interfaces/operations
- Relative size compared to other components

**Action:** Components too large → candidates for splitting. Components too small → candidates for merging. Large components are more coupled, harder to extract, and lead to less modular services.

### Pattern 2: Gather Common Domain Components

Find duplicated business domain logic across the application and consolidate it.

**Why:** Duplicate domain logic in a monolith becomes duplicate services in a distributed architecture. Consolidate *before* extracting to avoid redundant services.

**Action:** Search for functionally equivalent code across components. Merge into a single shared component.

### Pattern 3: Flatten Components

Ensure every source file lives within a well-defined component — no orphaned files floating between namespaces.

**Action:** Collapse or expand directory/namespace structures so all code files have a clear component home. Remove intermediate organizational layers that don't represent meaningful components.

### Pattern 4: Determine Component Dependencies

Map the dependency graph between components to understand coupling.

**This is where you decide feasibility:**
- High coupling between many components → migration is expensive
- Clusters of tightly coupled components → those must move together
- Clean boundaries with few dependencies → easier extraction

**Action:** Build a dependency matrix. Refactor to reduce cross-component dependencies where possible. Use this to estimate effort and prioritize extraction order.

### Pattern 5: Create Component Domains

Group related components into logical domains within the application.

**Action:** Refactor namespaces/directories to align with domains. A domain is a collection of components that will become a single service (or a small set of closely related services).

### Pattern 6: Create Domain Services

Physically extract domains into separately deployed services.

**Action:** Move component domains into their own deployment units. This is the final step — the physical separation. Each domain service owns its code, data, and deployment pipeline.

---

## Architecture Stories vs User Stories

Document decomposition work using **architecture stories**, not user stories:

> "As an architect, I need to decouple the payment service to support better extensibility and agility when adding additional payment types."

Architecture stories capture structural refactoring that satisfies a business driver. They are distinct from technical debt stories (which are developer-oriented cleanup).

---

## Fitness Functions for Governance

After applying each pattern, use automated fitness functions to prevent regression:

- **Cycle detection** — no circular dependencies between components
- **Component size monitoring** — alert when a component exceeds threshold
- **Dependency direction** — enforce that dependencies flow in the correct direction
- **Namespace conformance** — all files belong to their declared component

Fitness functions validate architecture characteristics (not domain logic). If the test requires domain knowledge, it's a unit test, not a fitness function.

---

## Quick Reference

```
Decomposition checklist:

☐ Assess codebase health (coupling, abstractness, instability, D)
☐ Determine if codebase is decomposable
☐ Choose approach: component-based or tactical forking
☐ If component-based, apply patterns in order:
    1. Identify and size components
    2. Gather common domain components
    3. Flatten components
    4. Determine component dependencies
    5. Create component domains
    6. Create domain services
☐ Document each step with architecture stories
☐ Implement fitness functions after each pattern
☐ Break apart data separately (see distributed-architecture skill)

Key principle: Build services from COMPONENTS, not individual classes
```
