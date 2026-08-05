# Adversary checklist

Run at end of **full**, **topic**, and **audit** modes. Write results to
`…_91_adversary_notes.md`. Re-score index from **files on disk**.

## Always

| Check | Pass criterion |
|-------|----------------|
| Pack prefix | All top-level scout md match required prefix |
| Listed docs exist | Index links resolve; non-empty |
| Isolation | No foreign product comparison sections |
| Path citations | Major claims have path:symbol (or explicit PARTIAL) |
| Scorecard honesty | % tied to artifacts; no “DONE wave ⇒ high %” |

## Full library scout

| Check | Pass criterion |
|-------|----------------|
| Surface inventory | `_surface_list.txt` (or equiv) count == disk glob; 0 missing / 0 extra |
| Host imports/includes canonical | One machine file; HOST_SURFACE count matches |
| No dual stats | Delete or regen stale include/import stats JSON |
| by-header / deep decls | Prefer **100% of host-referenced** before “freeze”; report % |
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

## Score cut guidance (typical)

When evidence is weak, cut rather than average up:

| Symptom | Cut |
|---------|-----|
| Inventory only, shallow decls | A-decls ≤60–70% |
| Host list OK, &lt;25% host deep surface | A-host freeze-ready ≤75% list / low depth |
| Facade method sample 35–50% | C ≤50% |
| Missing half of core mutation types | D ≤65% |
| Pipeline owners good, algorithms named only | B ~75–85% overall |

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
Trust prior high % only if re-proven on disk.
```
