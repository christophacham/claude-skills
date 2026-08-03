# Merged Anti-Patterns

The full anti-pattern list for mission planning, grouped by the framework each one corrupts. Individual sections of `SKILL.md` call out the highest-frequency ones inline; load this file when reviewing a finished OPORD, auditing a running initiative, or when a plan "feels off" and the inline lists didn't catch it.

## OPORD and intent

- **OPORD-as-Gantt** — §3 becomes a week-by-week task list; intent and decision rights belong in the OPORD, scheduling in beads.
- **OPORD-as-contract** — treating the document as immutable; plans modify on contact with reality — edit it, bump the date, note what changed.
- **Skipping the backbrief** — writing the OPORD alone and assuming agreement; misalignment caught in week 3 costs weeks.
- **Commander writing §3 / team writing §2** — the first kills the team's autonomy to adapt, the second lets the *why* drift from business reality.
- **Mission as todo list** — "build the cache, hook it up, ship" is an execution plan; push back to the *outcome*.
- **Unfalsifiable intent** — "delight users," "raise the bar"; the team can't trade off against aspirations an external observer couldn't verify.

## PACE and resilience

- **Predictive PACE** — tiers nobody thought through; "we'll figure it out if it happens" is a missing plan, not a Contingency.
- **Diagram theatre** — four boxes drawn, none drilled; the diagram lies, the drill tells the truth.
- **Failover that needs the thing that's down** — the Alternate must not share Primary's failing dependency; trace implicit dependencies.
- **Skipping verification because Primary is reliable** — you'll discover Alternate is broken at the worst possible time; drill on schedule regardless.

## Rhythm and cycles

- **Spike-becomes-feature** — recon drifting into building; declare maneuver instead of bending the cycle definition.
- **Permanent maneuver** — never recon ("we know what to build"), never sustain ("no time"); by month 6 velocity degrades through invisible unknowns and accumulated debt.
- **Sustainment as the rest cycle** — no named items, no restored capacity, just low energy.

## OODA and feedback

- **Loop on Decide** — the same decision rehashed in three meetings; pre-commit it via a trigger or accept that deliberation now costs more than a wrong answer.
- **Observe theatre** — wall-of-graphs dashboards nobody consults; if nobody looks, it isn't observation.
