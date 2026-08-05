# Quality gates — design contract

Language- and product-agnostic. Implementers choose tools; do not weaken these
properties.

## Two tiers

| Tier | Purpose | Budget |
|------|---------|--------|
| **Day-to-day** | Fail-fast confidence before push / on PR | Tight (seconds–low minutes warm) |
| **Full / nightly** | Depth: full suite, heavy static analysis, slow integration | Loose; schedule or manual |

Day-to-day is the **source of truth** for “green to integrate.” Nightly must
not be the only place correctness lives if day-to-day can hold a smoke.

## Single source of truth

- Gate logic lives in **repo scripts** (or one makefile target that is only a
  thin wrapper).
- CI invokes those scripts; YAML is not a second matrix.
- Agents and humans use the same day-to-day command (“local twin”).

## Fail-closed honesty

A check is honest only if:

1. Tool crash / nonzero exit fails the gate.
2. Tools that exit 0 with findings are **parsed** and turned into nonzero.
3. Missing tools fail (or require an explicit, documented offline procedure —
   never silent skip-as-pass).
4. Success messages are not printed before the check has real evidence.

## Ordered fail-fast steps

Typical shape (pick what applies; omit the rest):

1. Required fixtures / lockfiles / env preflight
2. Architecture or layer rules (if the repo has them)
3. Generated artifact drift (map, openapi, etc.)
4. Format / lint on relevant changes
5. Build (incremental when possible)
6. Smoke / filtered tests
7. Timings summary

Stop on first failure unless the repo has a deliberate “report all” mode
(unusual for day-to-day).

## Hooks vs gate

| Mechanism | Role |
|-----------|------|
| Pre-commit / pre-push hooks | Cheap subset, path-aware skips, developer seatbelt |
| Day-to-day gate | Full critical-path matrix; CI + session close |
| Nightly | Depth off critical path |

If post-commit (or equivalent) **auto-pushes**, do not re-run the full matrix
on pre-push — the pre-commit subset + CI gate is enough. Document that
`--no-verify` bypasses the seatbelt, not CI.

## Skip predicates

Local expensive steps may skip when map inputs / source trees are unchanged in
**staged ∪ base…HEAD**. CI should force those steps (env flag or always-on).

One shared “change universe” helper beats copy-pasted path globs per hook.

## Flakes

No silent re-run of red gates to laundry flakes. If the repo has a quarantine
or re-run policy, point to it; do not invent retries in the gate script.

## What this is not

- Not a security scanner suite (see `security-gates`)
- Not a substitute for product tests
- Not mandatory Docker-in-hooks
- Not multi-cloud CI theater — one runner class is enough to start
