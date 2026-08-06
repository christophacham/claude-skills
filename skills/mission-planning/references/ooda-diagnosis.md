# Diagnosing a Slow OODA Loop

Any OODA phase can constrain feedback. Use symptoms as hypotheses, then verify with timestamps, handoffs, decision records, and delivery evidence before investing in a fix.

| Symptom | Candidate bottleneck | Evidence to check | Possible response |
|---------|----------------------|-------------------|-------------------|
| "We didn't know until a customer told us" | Observe | Detection timestamp vs first system signal; telemetry coverage | Add the missing signal, routing, or ownership |
| "We saw the alert but didn't know what it meant" | Orient | Time from alert to a plausible model; runbook and domain context | Improve causal views, operational context, exercises, or access to specialists |
| "We knew the options but couldn't choose" | Decide | Decision owner, required evidence, reversibility, meeting/queue time | Clarify rights, reduce evidence demands, or pre-authorize a suitable trigger |
| "We decided but could not execute" | Act | Approval, CI, deployment, staffing, and dependency lead times | Remove the verified execution bottleneck or choose a smaller reversible action |
| "We shipped but cannot tell whether it worked" | Observe on the next loop | Outcome instrumentation and evaluation window | Define or add a practical post-action signal |
| "We act immediately but incidents repeat" | Orient or Decide | Whether responses test the current cause or replay a stale runbook | Reassess the model and escalation boundary before automating more action |

## Diagnostic procedure

1. Pick one consequential episode; avoid diagnosing from general impressions.
2. Reconstruct when the relevant signal became available, was interpreted, produced a decision, and resulted in action.
3. Find the longest or most consequential delay, including rework caused by a wrong orientation.
4. Check whether shortening that step would improve the outcome or merely move the queue.
5. Choose one intervention and define the next observation that will show whether it helped.

Do not assume the most visible meeting or deployment delay is the controlling bottleneck. Do not optimize loop speed at the expense of necessary safety, accuracy, or inclusion; the goal is faster justified adaptation.
