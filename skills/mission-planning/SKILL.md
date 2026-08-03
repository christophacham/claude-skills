---
name: mission-planning
description: "Plan complex software initiatives with military-derived doctrine: the OPORD artifact, commander's intent, backbriefs, PACE fallback tiers, decision triggers, recon/maneuver/sustainment cycles, and OODA feedback loops. Use when kicking off a multi-week or multi-team initiative (migration, launch, incident-prone work), writing the mission for an epic/RFC, running a backbrief, designing fallback layers for a critical path (payments, auth, comms, ingest, deploys), defining kill/rollback/SLO-breach criteria, fixing uneven sprint rhythm or starving tech debt, or diagnosing slow incident feedback. Produces one markdown OPORD as the source of intent plus labeled beads issues as the source of status. Not for single PRs, quick bugfixes, exploratory spikes, or routine maintenance."
---

# Mission Planning

> "No plan survives contact with the enemy." — Helmuth von Moltke the Elder

Military operations resolve a paradox — **ruthlessly detailed planning** combined with **extreme adaptability when plans fail** — by separating *intent* from *execution*, pre-committing decisions before crises, and naming fallback layers so degradation is planned rather than accidental. This skill applies that doctrine to software: one durable artifact (the OPORD) plus the frameworks that fill it.

The frameworks stand alone: PACE for one subsystem's resilience, triggers for one rollout's kill criteria, a mission statement for one epic — none require a full OPORD. Together they populate a single document that survives context breaks, handoffs, and surprises.

## When to use / when to skip

Use the full apparatus when **at least two** of these hold:

- The initiative spans more than ~2 weeks of work
- Multiple people or teams execute parts without continuous coordination
- Failure of a critical path is costly (data loss, customer-visible outage, missed regulatory deadline)
- The plan crosses a contested environment (unreliable dependency, vendor migration, regulatory pressure, security incident)
- The work must survive context breaks — future-you must reconstruct intent from the artifact alone

Do **not** use it for a single PR, a quick bugfix, exploratory spikes, or routine maintenance. The overhead only pays off when intent must outlive the session.

## Intent: the mission sentence

> **One sentence: "We will achieve X by Y so that Z."**

| Part | Guards against |
|------|----------------|
| **X** — outcome, measurable (*cut p99 checkout latency below 800ms*) | Vague success criteria; arguing in retrospect about whether we succeeded |
| **Y** — means, broad (*by introducing a write-through cache layer in the order service*) | Skipping execution planning; pretending the *how* will sort itself |
| **Z** — the business/user reason (*so that mobile checkout abandonment in high-latency markets drops to parity with desktop*) | Building the wrong thing right; losing the plot when scope shifts |

Writing rules:

- **Start from the outside.** What changes in the world if this works — not what you'll build. If you can't articulate the change, you don't know what success is.
- **Make X measurable.** *"Improve checkout experience"* is not a mission; you must be able to point at a number, query, or test and say hit/missed.
- **Constrain Y just enough.** *"By caching"* is too loose; naming the Redis client, cache pattern, and exact call sites is an implementation, not a mission. Name the change; leave the team the technology choices.
- **Make Z concrete.** Not "to improve UX" — *which user does what differently, or which business metric moves?* Without a concrete why, every trade-off becomes a meeting.

Below the sentence, add **Commander's Intent**: 2–4 sentences answering three questions — what does success look like from outside (what would a user, on-call, or exec notice)? What does failure look like (often more clarifying than the success picture)? Where is the line between "good enough to ship" and "keep working"?

> **Mission:** We will cut p99 checkout latency below 800ms by introducing a write-through cache layer in the order service so that mobile checkout abandonment in high-latency markets drops to parity with desktop.
>
> **Intent:** Success looks like LATAM/APAC mobile users completing checkout at desktop rates, with no measurable impact on EMEA/NA. Failure looks like checkout rate unchanged because the real bottleneck was payment-processor round-trips, not the order service. Good enough to ship is p99 sustainably below 1000ms across two business weeks; below 800ms is ideal but not a launch blocker.

The intent is what lets the team make calls without you: at p99 = 950ms after two weeks, they read it and ship instead of coming back to ask.

## Authority split + Backbrief

Under mission command, **the commander owns the why, the team owns the how**:

| Decision | Owner |
|----------|-------|
| What success looks like; the mission and intent | Commander (initiative owner) |
| Measurable success criteria | Commander, with team input |
| Ship at "good enough" vs push for "ideal" | Team, guided by intent |
| Implementation architecture, sequencing, milestones | Team |
| Revising the approach mid-execution | Team |
| Changing the *intent* | Escalation back to commander — then re-backbrief |

The split prevents **micromanagement** (commander dictates implementation; deliverable arrives misaligned with reality) and **drift** (team improvises without intent; deliverable arrives misaligned with the business reason). In the OPORD: the commander writes §2 MISSION, the team writes §3 EXECUTION after the backbrief. §3 must never contradict the intent; if it starts reading like the *what* instead of the *how*, the lines have crossed.

**The backbrief.** Before execution starts, the executing team plays their interpretation back to the commander — the cheapest alignment check available (20 minutes now vs 3 weeks of misdirected work):

1. **Restate mission and intent** in their own words. Parroting the doc verbatim means it isn't internalized — push for paraphrase.
2. **State what they think success looks like.** Mismatches here are the highest-leverage catch.
3. **Walk the approach** — briefly; this is not a design review, just proof they're aimed at the right outcome.
4. **Surface questions and assumptions** they want confirmed.
5. **Name their decision triggers** — when they would come back to the commander (scope change, sustainment gate failure, kill criterion fired).

The commander confirms or corrects (4) and ratifies (5). After the backbrief, the team has explicit authority to execute §3 the way they described. Skip the backbrief only for unambiguous tasks under ~1 week; for anything spanning weeks, always do it. "We already discussed it" is not a substitute — discussion is not commitment.

## Resilience: PACE

> "Two is one and one is none."

Every critical path gets four named, **verified** fallback tiers. Apply to paths where failure is costly — payments, auth, customer comms, data ingest, deploy pipeline, region failover, external AI/LLM dependency. Do not apply where failure is cheap (analytics writes, non-blocking enrichment).

| Tier | What it is | Example (receipt delivery) |
|------|-----------|---------------------------|
| **Primary** | The default, optimal path | SendGrid templated transactional |
| **Alternate** | Same function, different mechanism/vendor/location; near-transparent to users | SES via flag `comms.email.backend=ses` |
| **Contingency** | Degraded but functional; users notice | Queued delivery with stale templates |
| **Emergency** | Manual, out-of-band, humans in the loop; survivability, not efficiency | Manual CSV reconciliation, next-day digest |

Design rules:

1. **Plan against functions, not technologies.** "Send the customer their receipt" is a function; "use SendGrid" is a technology. Tiers are different ways to satisfy the same function.
2. **Name each tier concretely.** *"Failover to backup"* is not a plan. *"SES (us-west-2) via Terraform-managed flag `comms.email.backend=ses`; latency parity +200ms; footer renders without tracking pixels"* is.
3. **Pre-commit the trip-wire for every transition** (see Decision triggers): Primary→Alternate *"3 consecutive minutes of >2% 5xx"*; Alternate→Contingency *"Alternate unavailable >5min OR p99 > 30s"*; Contingency→Emergency *"backlog not draining within 1 hour"*. A PACE plan with no triggers is one nobody executes under pressure.
4. **Drill every tier.** Primary is verified by daily use; the rest only exist if tested — Alternate: quarterly failover drill (cut Primary, measure parity); Contingency: run a "degraded day"; Emergency: walk the manual procedure end-to-end with the on-call rotation at least annually. **Tiers you don't drill don't exist.** Alternate is the most expensive tier (must keep parity with Primary); skipping it is sometimes right — make it explicit.
5. **Document the un-fallback.** How do you return to Primary once healthy? Fallbacks break in reverse: you fell to Contingency, accumulated state there, and now Primary's data is stale. Plan the reverse transition too.

Contingency is where feature flags earn their keep: identify which features can degrade and ship the kill-switch *before* you need it. Make degraded mode visibly degraded — if Contingency looks identical to Primary, users and support can't tell, and the team doesn't know to fall back further. Emergency procedures must be findable cold by whoever is on-call; link them from the OPORD.

Skipping a tier is allowed if explicit: no Alternate when a duplicate vendor costs more than the expected loss (if Contingency is robust and tested); no Contingency for hard-correctness systems where degraded is worse than outage (then plan Emergency thoroughly); no Emergency — almost never acceptable. *"We have no Alternate because <cost analysis>; we accept up to 4h degraded"* is defensible; *"we didn't think of it"* is not.

## Decision triggers

A decision trigger is an if-then statement, agreed in advance, that fires automatically when its condition is met — so the team doesn't re-decide under pressure. Use for kill criteria, rollback conditions, SLO breach responses, PACE tier transitions, go/no-go gates. Push back on *"we'll decide that when we get there"* — decide now, conditionally. Do **not** force triggers onto genuinely contextual decisions; that gives false rigor — flag those as deliberate deferrals instead.

**Anatomy — five parts; missing any means it won't fire:**

1. **Condition** — metric, threshold, time window, and monitoring source, all named. Bad: *"if latency is bad."* Good: *"if checkout p99, per `grafana://d/checkout-latency`, exceeds 200ms for any 1-week rolling window."*
2. **Action** — concrete enough that whoever sees it fire knows exactly what to do. Bad: *"reconsider caching."* Good: *"flip flag `checkout.cache.backend=redis-write-through`, notify #checkout, page on-call."* If the action is "convene a meeting," the trigger is just an alert.
3. **Owner** — a named person or role accountable for executing the action, not just noticing it.
4. **Monitoring source** — the alert rule, dashboard, or runbook check that *generates* the event. Best: automated alert naming the trigger; worst: "we'll notice."
5. **Review cadence** — triggers go stale; set a review date, even just "OPORD close."

**Good/bad pair:**

| | Trigger |
|---|---|
| Bad | "If p99 > 200ms, monitor the situation." |
| Good | `perf-breach`: if checkout p99 > 200ms for 1 week (Grafana alert `checkout-p99-breach`), then switch to PACE Alternate caching — owner @alice, review at OPORD close. |

**Escalation trees.** One condition can have tiered responses — p99 > 200ms sustained 5min → page on-call; 1h → war room; 1d → flip to PACE Alternate; 1w → re-architecture decision. Each tier is its own trigger; the point is escalation happens on schedule, not when someone gets frustrated.

**Decision rights vs triggers.** Rights say *who* decides novel cases ("Alice owns scope changes"); triggers say *what was already decided* for predictable ones. Both belong in OPORD §5.

**Finding missing triggers** — run this checklist against any plan; each gap is a trigger:

1. Every assumption in SITUATION: if it's wrong, what do we do?
2. Every PACE tier transition: what makes us fall back?
3. Every success criterion in MISSION: what if we miss it? (often a kill criterion)
4. Every external dependency in SUSTAINMENT: what's the response if it fails?
5. Every "we'll decide later": can we decide now, conditionally?

Also write triggers for *good* outcomes ("if adoption is 3x model, accelerate hiring") — good news without a trigger leaves opportunity on the table. Keep triggers visible to anyone touching the system, especially during incidents — not buried in an on-call runbook.

**Anti-patterns:** trigger theater (no monitoring source or owner — half-built triggers are worse than none); alert masquerading as a trigger (action is "monitor" or "re-decide later"); forever triggers (no review date → the matrix accumulates dead rows nobody trusts).

## Rhythm: operational cycles

Replace generic one-size sprints with three named modes; each cycle ends when its job is done, not when the calendar says so.

| Cycle | Goal | Exit criterion | Success metric | Typical length |
|-------|------|----------------|----------------|----------------|
| **Recon** | Reduce uncertainty: spikes, load tests, threat models, vendor evals, "could we actually…?" probes | The unknowns named at cycle start are resolved (even with "no") | Number of unknowns retired — zero features shipped can be a successful cycle | 3 days–2 weeks; longer means it's maneuver in disguise |
| **Maneuver** | Deliver outcomes against the committed plan | The pre-defined measurable outcome is delivered, or the time-box expires and you re-plan | Outcome delivered, or learning produced (missed, but we know why); "we worked hard" is neither | 2–4 weeks; longer needs splitting into sub-maneuvers |
| **Sustainment** | Restore capacity ("refit and rearm"): debt, tooling, CI flakiness, docs, observability, launch recovery | Chosen debt items addressed *and* team energy measurably recovered (calmer on-call, fewer blockers) | Capacity restored — measured by how the next maneuver cycle starts | 1–2 weeks; dragging means bigger-than-expected debt (a finding) or escape from harder work |

Rules:

- **Maneuver requires unknowns retired first.** Committing to outcomes while SITUATION assumptions are unresolved is how scope and time blow up — a recon cycle now is cheaper than scope creep later.
- **Recon output is a decision, not a deployment.** If the spike produces shippable code, ship it intentionally and declare maneuver — don't let spikes drift into MVPs into production.
- **Sustainment is restoration, not rest.** Name the specific items and the capacity being restored; it's an "off cycle" only if you're doing it wrong.
- **Cycle types are per-team, not per-person.** "Alice does recon, Bob does maneuver" means nothing rotates — everyone participates in each mode.
- **Name the dominant mode each week** and write its exit criterion. That declaration, plus a mode-specific retro (recon: what did we learn? maneuver: did we ship to plan? sustainment: is the team measurably restored?), is most of the discipline. Renaming sprints without changing the contents is cargo-culting.

Calibrate the mix to the phase (illustrative, not prescriptive):

| Phase | Recon | Maneuver | Sustainment |
|-------|-------|----------|-------------|
| Early — high uncertainty | 60% | 30% | 10% |
| Build — known scope | 10% | 80% | 10% |
| Late — launch and post-launch | 10% | 50% | 40% |
| Steady-state product | 20% | 60% | 20% |

## Feedback: OODA

> "He who can handle the quickest rate of change is the one who survives." — John Boyd

The loop is **Observe → Orient → Decide → Act → repeat**. In a contested environment the faster *correctly-oriented* loop wins — not by being smarter but by being less wrong for less time.

| Phase | Question | Trap | Fast looks like |
|-------|----------|------|-----------------|
| **Observe** | What's actually happening? | Measuring what's convenient, not what matters | Signals reach a human in minutes; important changes notify, not just update a dashboard |
| **Orient** | What does it mean? | Orienting from a stale model (same symptom ≠ same cause) | Shared mental models; short frequent retros keep the model fresh — no meeting needed to interpret |
| **Decide** | What will we do? | Infinite deliberation — if you can't say what data would change the decision, you have enough data | Decision rights are explicit; triggers pre-commit the obvious cases so only novel ones get deliberated |
| **Act** | Make it real | Acting without instrumenting the result | **Every Act produces a measurable signal for the next Observe** — "did it move the metric," not "did we ship it" |

Diagnosing a slow loop — **most slow loops are stuck in Observe or Orient, almost never in Act.** For the symptom → bottleneck → fix table, load `references/ooda-diagnosis.md` when a team's feedback loop feels slow and you need to locate the stuck phase before prescribing a fix.

**The commitment duality.** Pre-commitment and late commitment are both agility: triggers pre-decide the common cases so the team skips deliberation and goes Observe → Orient → Act; at the same time, defer *architectural* commitment to the last responsible moment — keep reversible choices reversible until real load patterns exist, feature-flag new work so Decide and Act can separate, and hold scope open until SITUATION is understood. The heuristic: **decide when the cost of waiting starts to exceed the value of new information.** And never tighten Act while Observe is broken — speed without data just makes you wrong faster. Beware the Orient bypass ("alert fires → restart service"): fine for known-good runbook responses, catastrophic when the alert means something new.

The cycle rotation above is a long-period OODA loop — Recon is extended Observe/Orient, Maneuver is Decide/Act, Sustainment improves the loop itself — while the short-period loop runs inside every standup, alert, and demo. A team running only maneuver cycles has collapsed OODA to "Act, Act, Act": fine for a sprint, broken over months.

## Artifacts: the OPORD (once)

One markdown file per initiative at `docs/opords/<slug>.md`. Five stable top-level headings — **do not rename them**; tooling and future agents depend on the structure.

```markdown
# OPORD: <Initiative Name>
**Slug:** `<kebab-case>`   **Beads epic:** `bd-XXX`   **Status:** draft | active | sustaining | closed   **Last updated:** YYYY-MM-DD

## 1. SITUATION
Operating environment; known constraints (deadlines, compliance gates, frozen contracts, capacity);
intelligence gaps (each gap → a recon task); assumptions (each assumption → a candidate trigger).

## 2. MISSION
"We will achieve X by Y so that Z." Commander's Intent (2–4 sentences: success / failure /
good-enough line). Success criteria — measurable, each with a named measurement source.

## 3. EXECUTION
Approach (one paragraph — if a teammate reads only this, do they know what we're building?);
PACE plan table per critical path (tier / path / trip-wire / drill cadence / beads ID) plus the
un-fallback procedure; cycle rhythm (recon → maneuver → sustainment with exit criteria);
backbrief commitment.

## 4. SUSTAINMENT
CI/CD readiness; observability (named dashboards, alerts, queries — the OODA loop's Observe);
security posture and response; team readiness (skill gaps, on-call, knowledge concentration);
platform dependencies. If sustainment isn't ready, the rest of the plan is fiction — fix gaps
before declaring the OPORD active.

## 5. COMMAND & SIGNAL
Decision rights table (decision / owner / escalation); communication rhythm (standup format:
last 24h actions, next 24h plan, blockers, intel; async updates; escalation channel);
Decision Support Matrix (trigger / condition / action / owner / source / review) — one row per
§1 assumption that, if wrong, would force a re-plan.
```

**The 1/3–2/3 rule:** the commander gets 1/3 of available time to plan; the team gets 2/3 to prepare and execute. For a 3-week initiative, time-box OPORD writing to 2–3 days; still revising past that means you're planning for hypotheticals (cut scope) or missing intelligence (run the recon first). Do war-gaming (premortem, threat modeling, scenario probes) and the sustainment check *before* committing to execution — that's the point of the section order.

**Sync discipline: the OPORD is the source of intent; beads is the source of status.** Never duplicate narrative or status between them.

- Derive beads issues from the OPORD; each issue body starts with a back-link to the OPORD section that motivates it (`SOURCE: docs/opords/<slug>.md §3`).
- When reality diverges: edit the OPORD **first** (bump Last updated, add a change-log line), then update beads to match. Never let beads diverge silently — work that traces to no OPORD section means either a stale OPORD or out-of-scope work.
- When intent itself changes mid-flight, write it down and re-backbrief.
- Triggers are standing `decision` issues, not tasks: when one fires, comment with timestamp and observed value, execute the action, and leave the trigger open with a `fired` label while the post-trigger state holds. Retire triggers with a note ("condition no longer relevant because …"), not a silent close — even after OPORD close if the condition is still live.
- At close: set Status `closed` with a note on what shipped, what didn't, which triggers fired, what you'd do differently — the durable post-mortem — then close the epic.

**Beads labels** (conventions; see the beads skill for the tracker itself):

- Epic: `opord`, `opord:<slug>` — description carries the mission sentence + intent + OPORD path
- PACE tiers: `pace:primary|alternate|contingency|emergency` (query each tier — `bd query "label=pace:contingency AND label=opord:<slug>"` — to audit resilience coverage)
- Triggers: `trigger:<name>`, type `decision`; add `fired` when fired
- Work items: `cycle:recon|maneuver|sustainment` (if closed sustainment work is always zero, the team is starving the cycle that restores capacity)
- OODA investments: `ooda:observe|orient|decide|act` — only for work that improves the loop, not routine work inside it

Three-line recipe:

```bash
bd create "OPORD: <name>" --type epic -l "opord,opord:<slug>"   # then children with pace:*, cycle:*, trigger:* labels, --parent <epic>
bd create "TRIGGER: <name>" --parent <epic> --type decision -d "IF <condition>. THEN <action>. OWNER: @who. REVIEW: <when>. SOURCE: docs/opords/<slug>.md §5" -l "opord:<slug>,trigger:<name>"
bd query "label=opord:<slug>"   # everything; refine with AND label=pace:alternate / type=decision / label=cycle:recon AND status=open
```

**Merged anti-patterns:** load `references/anti-patterns.md` when reviewing a finished OPORD, auditing a running initiative, or when a plan feels off and the inline anti-patterns above didn't catch it — the full list, grouped by framework (OPORD/intent, PACE, cycles, OODA).
