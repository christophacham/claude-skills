# Mission-Planning Anti-Patterns

Load this when reviewing a completed mission artifact, auditing an initiative in flight, or checking whether the doctrine is improving decisions rather than adding ceremony. Apply each item in context; absence of a framework is not itself a defect.

## Mission artifact and intent

- **Plan-as-Gantt** — the artifact becomes a dated task list. Keep intent, assumptions, decision rights, and rationale in the artifact; keep live status in the selected execution tracker, if any.
- **Plan-as-contract** — the document is treated as immutable after evidence changes. Record material changes while preserving enough history to explain the decision.
- **Ceremonial backbrief** — everyone repeats the document but no interpretation, assumption, or authority is tested.
- **Unacknowledged handoff risk** — another team owns consequential execution, interpretations can diverge, and no backbrief or equivalent alignment evidence exists.
- **Rigid commander/team split** — role labels override real architecture, security, regulatory, or release governance. Map decision rights to the organization that exists.
- **Mission as todo list** — "build the cache, hook it up, ship" describes outputs without a verifiable external outcome.
- **Unfalsifiable intent** — "delight users" or "raise the bar" supplies no evidence or accountable judgment for trade-offs.
- **Path cargo cult** — a new `docs/opords/` hierarchy or fixed heading scheme is imposed despite an established RFC or planning convention.

## PACE and resilience

- **Four-tier theater** — four names are present, but retained options are unaffordable, share the same failure mode, or have no operational evidence.
- **Predictive PACE** — fallback detail is invented beyond what the system's risks justify; uncertainty is hidden instead of labeled.
- **Failover through the failed dependency** — an Alternate or Contingency relies on the same component, credentials, control plane, or people as Primary.
- **Unproven availability** — a tier is described as ready although it has never been exercised or its evidence expired.
- **Calendar cargo cult** — quarterly or annual drills are copied without considering consequence, system change rate, evidence decay, or validation cost.
- **Missing return path** — fallback is planned, but accumulated state, reconciliation, and return to Primary are not.

## Recon, execution, and sustainment

- **Research without a decision** — recon has no named uncertainty, decision, timebox, or stopping rule.
- **Certainty gate** — maneuver is blocked until every unknown is retired, including low-value or irreducible uncertainty.
- **Spike-becomes-feature** — prototype work enters production without an explicit change in scope, quality bar, or ownership.
- **Permanent maneuver** — delivery continues while material assumptions, feedback, reliability, or team capacity degrade; the issue is lack of reorientation, not failure to follow a fixed rotation.
- **Sustainment as unnamed rest** — the mode has no capacity or risk target. Rest may still be necessary, but should be named honestly rather than disguised as technical work.
- **Forced generalism** — specialists rotate through every mode for symmetry even when that increases handoffs and reduces quality.
- **Specialist silo** — recon or sustainment evidence stays with a specialist and never reaches the owners making execution decisions.
- **Cadence cargo cult** — fixed sprint lengths or recon/maneuver/sustainment ratios persist despite different feedback latency or operational load.

## OODA and feedback

- **Preset diagnosis** — the team assumes Observe or Orient is always slow and invests before locating the actual bottleneck.
- **Observe theater** — dashboards exist, but nobody uses them for a decision and no relevant change reaches an owner.
- **Orient monoculture** — every signal is interpreted through one stale model or one specialist with no challenge path.
- **Loop on Decide** — the same predictable decision is repeatedly debated because authority, required evidence, or a useful trigger is missing.
- **Trigger theater** — a condition has no authorized response, owner, evidence source, or expiry appropriate to the case.
- **Act without observation** — work ships without a practical way to learn whether the intended outcome changed.

## Tracker projection

- **Tracker capture** — the mission artifact is written around one tracker's fields and becomes unusable when the tracker changes.
- **Unrequested projection** — planning silently creates, relabels, closes, commits, or publishes tracker state.
- **Vocabulary imposition** — `pace:*`, `cycle:*`, or other military-derived labels are added without a query need or project agreement.
- **Dual status** — task state is maintained in both the mission artifact and tracker, then diverges.
- **Inferred graph** — dependencies or hierarchy are generated from prose or title similarity without an explicit execution mapping.
