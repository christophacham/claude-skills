---
name: mission-planning
description: "Plan complex, high-stakes software initiatives with adaptable military-derived lenses: mission and commander's intent, backbriefs, PACE fallback options, decision triggers, recon/maneuver/sustainment modes, and OODA feedback. Use for multi-week or multi-team migrations, launches, resilience planning, rollback criteria, or slow feedback loops. Produces a tracker-neutral mission artifact and projects work into an existing tracker only when requested. Not for single PRs, quick bugfixes, routine maintenance, or as a mandate for military terminology and ceremonies."
---

# Mission Planning

> "No plan survives contact with the enemy." — Helmuth von Moltke the Elder

This skill adapts mission-command ideas to software planning: make the outcome and decision rights durable, prepare for consequential failure, and update the plan when evidence changes. The doctrine is a set of lenses, not a mandatory process. Use the smallest subset that improves a real decision.

The plan artifact is tracker-neutral. It can stand alone or be projected into the repository's existing Beads, GitHub, Jira, Linear, or other tracker. Never initialize, replace, or relabel a tracker merely to fit this skill.

## Choose the planning depth

A full mission artifact is usually worthwhile when at least two of these apply:

- The initiative spans multiple weeks or independent workstreams.
- Several people or teams must act without continuous coordination.
- Failure could cause meaningful customer, data, security, regulatory, or operational harm.
- External dependencies or deadlines make adaptation likely.
- Intent and decision history must survive handoffs or long context gaps.

Treat that as a heuristic, not a gate. For a narrower need, use only the relevant lens: a mission sentence for an epic, PACE for one critical function, triggers for a rollout, or OODA to diagnose a feedback delay. Skip the apparatus for a single PR, routine maintenance, or a low-cost exploratory spike.

Before applying a practice, tailor it:

| Lens | Use when | Do not force |
|------|----------|--------------|
| Mission + intent | Executors need durable outcome, constraints, or decision rights | Military role titles; a separate document when an existing RFC can hold it |
| Backbrief | Handoff, ambiguity, stakes, or distributed ownership make divergent interpretations costly | A synchronous ceremony for a clear task owned by the author |
| PACE | A critical function needs planned degradation or recovery options | Four implemented systems when a tier's cost exceeds its risk reduction |
| Recon | Reducible uncertainty could change a consequential decision | Research for every unknown or certainty before action |
| Operational modes | Explicit mode changes would improve focus or capacity | Fixed sprint lengths, universal ratios, or whole-team lockstep |
| OODA | The team is learning or responding too slowly | Assuming the bottleneck phase before observing it |

## Mission and intent

Start with one sentence:

> **We will achieve X by Y so that Z.**

- **X — outcome:** Prefer an observable measure, query, test, or externally verifiable state. If a number would create false precision, name qualitative evidence and who judges it.
- **Y — broad means:** Constrain the approach enough to focus planning without freezing implementation details.
- **Z — reason:** Name the user, operational, or business effect that makes the trade-off worthwhile.

Below it, write **Commander's Intent** (or the organization's preferred term, such as initiative intent):

- What success looks like from outside.
- What failure looks like.
- The minimum acceptable outcome and non-negotiable constraints.
- Which trade-offs executors may make without escalation.

Example:

> **Mission:** We will cut p99 checkout latency below 800 ms by introducing a cache at the order-service boundary so that mobile checkout completion in high-latency markets approaches desktop performance.
>
> **Intent:** Success means sustained latency improvement without correctness regressions in unaffected regions. Failure means latency moves but completion does not, indicating the wrong bottleneck. A sustained p99 below 1000 ms for two representative business weeks is acceptable for launch; correctness and rollback readiness remain non-negotiable.

## Decision rights and backbrief

The useful principle is that the initiative owner sets outcome, constraints, and escalation boundaries while the executing team chooses implementation and sequencing inside them. Adapt this split to actual governance; architecture, security, regulatory, or incident-command roles may own specific decisions.

Record decision rights explicitly:

| Decision | Accountable role | Executor autonomy | Escalation condition |
|----------|------------------|-------------------|----------------------|
| Mission outcome and constraints | Initiative owner | Propose changes | Material change to intended outcome |
| Implementation and sequencing | Technical owner/team | Decide within constraints | Trigger, policy, or risk boundary crossed |
| Ship/rollback | Named release authority | Follow agreed trigger where applicable | Novel condition outside the trigger |

A **backbrief** is an alignment check, not a required meeting. Use it when another person or team will execute, interpretations could diverge, or the cost of rework is high. It may be synchronous, an async written reply, or a review in an existing design forum. Ask executors to:

1. Restate the mission and minimum acceptable outcome in their own words.
2. Summarize their approach and the assumptions that could change it.
3. Identify decisions they can make and conditions that require escalation.
4. Surface unresolved questions and residual risk.

Capture corrections in the mission artifact. Skip a separate backbrief when the task is low-ambiguity, low-consequence, and owned end-to-end by the same executor; still make decision rights legible if others depend on the result. Re-backbrief after a material intent, constraint, ownership, or risk-boundary change—not after every implementation adjustment.

## PACE fallback options

PACE names ways to preserve a **function** under failure:

| Tier | Meaning | Example for receipt delivery |
|------|---------|------------------------------|
| **Primary** | Preferred normal path | Transactional email provider |
| **Alternate** | Comparable function through an independent mechanism | Second provider behind a tested switch |
| **Contingency** | Deliberately degraded but useful service | Queue receipts for delayed delivery |
| **Emergency** | Last-resort survival or manual procedure | Reconcile and send a daily digest manually |

Use PACE only for functions whose interruption justifies advance options. The four tiers are prompts, not a requirement to purchase or build four systems. Omit, combine, or mark a tier unavailable when cost, correctness, or shared failure modes make it unsound; record the rationale and accepted consequence.

For each retained option, capture:

- Function preserved and user-visible degradation.
- Independent and shared dependencies.
- Transition condition and authorized action.
- Owner and operational instructions.
- Return-to-primary handling, including state accumulated while degraded.
- Evidence that the option works and when that evidence expires.

Validation cadence should follow consequence, change rate, prior failures, and validation cost. A frequently changing high-impact alternate may need release or monthly checks; a stable manual emergency procedure may use a tabletop after material change. Calendar examples are starting hypotheses, not universal quarterly/annual mandates. An unvalidated tier should be labeled unproven rather than treated as available.

## Decision triggers

A decision trigger is a conditional commitment for a predictable case. It reduces delay when the condition is objectively observable and the response is understood. Do not force a trigger onto a genuinely contextual decision; document the decision owner and deliberate deferral instead.

Capture the parts needed for the case:

1. **Condition:** signal, threshold or qualitative event, observation window, and source.
2. **Action:** specific response or fallback.
3. **Owner:** role accountable for acting.
4. **Authority/escalation:** whether the action is pre-authorized and where novel cases go.
5. **Review/expiry:** event or date after which the trigger must be revalidated.

Example:

```text
perf-breach: If checkout p99 exceeds 200 ms for 15 minutes according to alert
checkout-p99-breach, release on-call rolls back cache writes and notifies the
checkout owner. Pre-authorized during rollout; review after the rollout closes.
```

Select thresholds and review timing from the system's dynamics and decision cost. Fast incidents may need minute-scale windows; strategic adoption decisions may use weeks. An alert with no agreed action is not yet a trigger. A contextual action such as "assess blast radius, then choose" can still be valid when it names the decision owner and evidence required.

Look for candidate triggers around material assumptions, rollout/rollback boundaries, retained PACE transitions, external dependencies, and minimum success criteria. Do not mechanically turn every assumption into a standing tracker item.

## Recon, maneuver, and sustainment modes

These are planning modes, not mandatory sequential phases or sprint names:

| Mode | Purpose | Possible exit evidence |
|------|---------|------------------------|
| **Recon** | Reduce decision-relevant, reducible uncertainty through prototypes, measurements, threat models, or vendor evaluation | The new evidence supports a decision, changes the plan, or shows further research is not worth its cost |
| **Maneuver** | Deliver the intended outcome and observe its effects | Outcome reached, trigger fired, or evidence requires re-planning |
| **Sustainment** | Restore or protect execution capacity: reliability, tooling, observability, docs, security, knowledge, and recovery | Named capacity or risk measure improves enough for the next objective |

Use recon when additional information could change the chosen action and can be obtained at reasonable cost. Do not require every unknown to be retired. Classify residual uncertainty:

- **Reducible now:** investigate before an irreversible or high-cost commitment.
- **Reducible later:** keep the choice reversible and observe during delivery.
- **Irreducible/contextual:** bound exposure with staged rollout, PACE, or a trigger.
- **Low decision value:** record or ignore it rather than delaying action.

Proceed when evidence is sufficient for the decision's reversibility and consequence, not when certainty is complete. Recon can run before, inside, or parallel to maneuver. If a prototype becomes production work, make that scope change explicit rather than pretending it is still research.

Operational mode may be declared per initiative, team, workstream, or specialist depending on coordination needs. Specialists can own recon or sustainment work; do not rotate everyone through every mode merely for symmetry. Avoid hidden handoffs by naming ownership, interfaces, and how findings reach decision-makers.

Choose timeboxes and review cadence from uncertainty, feedback latency, and operational load. Short checkpoints are useful when evidence changes quickly; longer windows may fit migrations or vendor lead times. Fixed 3-day/2-week/quarterly defaults and fixed recon/maneuver/sustainment percentages are examples at most, never doctrine.

## OODA feedback

OODA is **Observe → Orient → Decide → Act → repeat**:

| Phase | Question | Common failure |
|-------|----------|----------------|
| Observe | What happened, and how trustworthy is the signal? | Missing, delayed, or misleading evidence |
| Orient | What model explains it in this context? | Stale assumptions or missing domain knowledge |
| Decide | What action is justified and who owns it? | Unclear rights, endless deliberation, or false certainty |
| Act | Can the decision be executed and measured? | Delivery friction or action with no next signal |

Any phase can be the bottleneck. Diagnose from evidence before prescribing telemetry, meetings, triggers, or delivery automation. Every consequential action should produce or schedule a useful next observation when feasible.

Read [references/ooda-diagnosis.md](references/ooda-diagnosis.md) when investigating a slow loop. Use its table as hypotheses to test, not a universal ranking of bottlenecks.

## Tracker-neutral mission artifact

For a full plan, keep one durable source of intent. Use the repository's existing RFC, epic, ADR, launch-plan, or planning convention when one exists. If there is no convention, propose `docs/opords/<slug>.md` as a default location; do not create a new path or insist on the term OPORD when the project prefers another artifact.

The following five sections are a stable default structure, not immutable heading names. Map them into an existing template when necessary and preserve any repository tooling contract.

```markdown
# Mission Plan: <Initiative Name>
**Slug:** `<kebab-case>`  **Status:** draft | active | sustaining | closed
**Owner:** <role/person>  **Last updated:** YYYY-MM-DD
**Execution tracker:** <none or tracker reference>

## 1. SITUATION
Constraints, dependencies, known evidence, material assumptions, and uncertainty.
For each important gap: investigate, defer with a reversible choice, accept, or guard with a trigger.

## 2. MISSION
"We will achieve X by Y so that Z." Intent, minimum acceptable outcome,
non-negotiable constraints, and evidence of success.

## 3. EXECUTION
Approach and workstreams; retained PACE options and return paths; selected
operational modes; backbrief/alignment record where useful.

## 4. SUSTAINMENT
Delivery and rollback readiness; observability; security/compliance; operational
and team capacity; knowledge concentration; external service dependencies.

## 5. COMMAND & SIGNAL
Decision-rights table; communication and review rhythm suited to the initiative;
decision-trigger matrix; artifact owner and change process.
```

Treat the 1/3–2/3 planning rule as a reminder to preserve executor preparation time, not a time-accounting formula. Time-box planning relative to stakes and reversibility. If the artifact grows without changing decisions, reduce it; if evidence is missing, run targeted recon rather than polishing prose.

The mission artifact is the source of intent, assumptions, decisions, and fallback rationale. A selected execution tracker, if any, is the source of task status. Do not duplicate changing status in the artifact. Link tracker items back to the motivating artifact section where practical.

When reality changes:

- Update status only in the tracker.
- Update the artifact when intent, assumptions, constraints, decision rights, fallback rationale, or the material approach changes.
- Record material changes and re-run alignment only for affected owners.
- Archive or mark the artifact closed when authorized; do not infer permission to close tracker items.

## Conditional tracker projection

Projection is optional. Determine the tracker from the user's request and repository conventions. If none is selected, stop at the artifact. If the request asks for a plan but not tracker mutations, propose the mapping without creating items.

For any selected tracker:

1. Preserve its native types, fields, states, and existing label conventions.
2. Create only the requested work items and relationships.
3. Link each item to the relevant mission section when useful.
4. Use labels only when they improve an actual query or review; do not require military vocabulary.
5. Keep narrative decisions in the artifact and live execution status in the tracker.

### Optional Beads projection

Use this only when Beads is already initialized, is the selected tracker, and tracker mutation is authorized. Load the `beads` skill and follow its request-scoped mutation and commit/sync rules. Do not run `bd init`, close issues, or commit/push Dolt history as an automatic consequence of mission planning.

Possible labels—not requirements—include:

- mission grouping: `mission:<slug>` or an existing project equivalent;
- retained fallback work: `pace:primary|alternate|contingency|emergency`;
- intentional mode work: `cycle:recon|maneuver|sustainment`;
- feedback-loop investments: `ooda:observe|orient|decide|act`.

Before using these, inspect existing labels and query needs. Do not add all labels to every issue, infer a special issue type, or create a dependency graph from the artifact without explicit mapping decisions.

Read [references/anti-patterns.md](references/anti-patterns.md) when reviewing a completed mission artifact or diagnosing a plan that is not improving decisions.
