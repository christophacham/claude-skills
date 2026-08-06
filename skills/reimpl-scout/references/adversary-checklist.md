# Adversary checklist

Run at end of **full**, **topic**, and **audit** modes. Write results to
`…_91_adversary_notes.md`. Re-score index from **files on disk**.

## Always

| Check | Pass criterion |
|-------|----------------|
| Pack prefix | All top-level scout md match required prefix |
| Listed docs exist | Index links resolve; non-empty |
| Analytical isolation | No foreign product comparison sections; no claim that isolation proves clean-room provenance |
| Path citations | Major claims have path:symbol (or explicit PARTIAL) |
| Scope reconciliation | Stable unit IDs map one-to-one to manifest units; exact missing/duplicate list |
| Scorecard honesty | Evidence state + found/expected counts + method + gaps; no “DONE wave ⇒ high score” |
| Review independence | Separate reviewer named, or `REVIEW_INDEPENDENCE=SELF_REVIEW` limitation recorded |

## Full library scout

| Check | Pass criterion |
|-------|----------------|
| Surface inventory | `_surface_list.txt` (or equiv) count == disk glob; 0 missing / 0 extra |
| Host imports/includes canonical | One machine file; HOST_SURFACE count matches |
| No dual stats | Delete or regen stale include/import stats JSON |
| by-header / deep decls | Every host-referenced manifest unit is deepened or named as a blocking gap before “freeze”; report found/expected counts |
| Mutation cards | All required core types that exist; list absences as FAIL |
| Pipeline owners | Primary pipeline steps have owners; spot-check 2–3 lines in tree |
| Use graph | Facades depth ≥1 or no-callers; note indirect dispatch |
| Contracts | load/config/primary-pipeline/export present; error/cancel taxonomy not hand-waved |
| Step enums | Flags that are not real barriers documented |
| by-module vs shards | Every shard key has a home page or explicit `other` TOC |
| Extraction method | regex vs AST/lang-tool labeled; zero-match units listed |

## Topic scout

| Check | Pass criterion |
|-------|----------------|
| Seeds visited | Each seed path justified found/missing |
| Config keys | Keys used in code appear in 30_ table |
| Runtime flow | End-to-end owners; no orphan steps |
| Persistence | Load/store matrix if topic touches files/project |
| Verdict files | Feature ABSENT/PARTIAL/IMPLEMENTED with search method |
| Backend matrix | Every host backend file registered or explained |

## Evidence-state guidance

Do not average weak evidence into a percentage. Assign the least-complete state
supported by artifacts and list the concrete gate:

| Symptom | Required judgment |
|---------|-------------------|
| Inventory exists, declarations shallow | A = `PARTIAL`; list undeepened unit IDs |
| Host list exists, host units not all deepened | A-host = `PARTIAL`; exact missing host units block freeze |
| Facade methods sampled rather than manifest-reconciled | C = `PARTIAL`; list unsampled facades/caller depths |
| Any required core mutation type lacks a card | D = `PARTIAL`; list missing cards; freeze blocked |
| Pipeline owners known, algorithm contracts only named | B/E = `PARTIAL`; list owner/contract evidence gaps |
| Deterministic manifest or independent judgment absent | Pack = `SCAFFOLD`; cannot claim freeze-ready |

## FIX list format

Ordered, actionable:

1. Canonicalize machine data X
2. Deepen host surface (domain rank)
3. Mutation cards for …
4. Contract row for …
5. Reimpl gate: do not complete milestone M until 1–3 closed

## Executive verdict template

```markdown
## Executive verdict
Pack is a **scaffold | freeze-ready | failed run**.
Critical gaps: N.
Replace prior percentages with re-proven states, exact counts, methods, and gaps.
```
