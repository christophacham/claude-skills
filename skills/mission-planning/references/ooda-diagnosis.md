# Diagnosing a Slow OODA Loop

Most slow loops are stuck in Observe or Orient, almost never in Act. Match the symptom to the bottleneck before investing in a fix:

| Symptom | Bottleneck | Fix |
|---------|-----------|-----|
| "We didn't know until a customer told us" | Observe | Invest in telemetry, alerting, error reporting; add the missing signal |
| "We saw the alert but didn't realize what it meant" | Orient | Better dashboards, threat models, runbooks; expose causal links between metrics |
| "We knew but couldn't agree what to do" | Decide | Pre-commit decision rights and triggers; shorten the meeting cycle |
| "We decided weeks ago and still haven't shipped" | Act | Cut deploy friction, CI bottlenecks, approval queues |
| "We ship but can't tell if it worked" | Observe (next loop) | Instrument the change *before* deploying; no feature without telemetry |
