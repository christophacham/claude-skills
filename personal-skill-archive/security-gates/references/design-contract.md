# Security gates — design contract

Product-agnostic. Tool names in the catalog are defaults; this contract is
binding.

## Sovereignty assumptions

When the git remote is private or treated as **code storage only**:

- Do not design gates that **require** hosted Advanced Security, cloud CodeQL
  service, or vendor secret-scanning as the only enforcement.
- Scanners must **install and run** on the builders you control (dev machine,
  self-hosted runner, on-prem box).
- API keys used by optional agentic tiers are env-injected, scoped, never
  committed; secret gates exist partly to protect those keys.

Public repos may *add* hosted scanners; they still should not be the only
layer if local twin matters.

## Tiering

```text
T1 deterministic scanners  →  GATE (day-to-day and/or nightly)
T2 lockfiles + SCA         →  GATE when data exists
T3 aggregation / schedule  →  infra optional
T4 agentic deep audit      →  NEVER a gate
```

Collapsing T4 into T1 is a design failure.

## Fail-closed honesty

Same bar as quality gates, plus:

1. **Parse exit-0 findings.** Many SCA CLIs report vulns and still exit 0.
2. **Workspace-wide scope.** Do not audit one package and claim the solution
   is clean.
3. **No soft-skip.** Missing scanner binary fails the step (or documented
   offline procedure that is loud and rare).
4. **Evidence before OK.** “0 vulnerabilities” only after a successful scan
   with nonempty tool cooperation.

Historical anti-pattern: loop packages with `\|\| true`, grep Severity on empty
stdout, print success in under a second.

## Where steps live

- Prefer **timed steps inside the existing day-to-day / nightly gate scripts**.
- Pre-commit: only cheap controls (e.g. secret protect on staged).
- CI: calls the same scripts; no GitHub-only Actions that cannot run on a
  forge mirror if sovereignty is a goal.
- Do not create a second matrix that drifts from the quality gate.

## Secrets policy

| Layer | Role |
|-------|------|
| Protect staged (local) | Fast seatbelt before commit |
| Detect in CI/gate | Enforcement (hooks are bypassable) |
| Verified / live-key check | Scheduled; may call provider APIs; not every commit |
| Allowlist | Test fixtures only; reviewed paths |

## Dependency policy

- Prefer always-on ecosystem audit at restore/build when available.
- Prefer committed lockfiles so SCA tools can resolve transitive graphs.
- Severity bar should be explicit (common default: fail on high/critical;
  medium may warn or fail per team).
- “Detect without fix” is incomplete product sense — note update automation
  as follow-up work; the gate still fails closed on known bad.

## SAST policy

- Prefer tools that **parse the language version you ship**.
- Baseline first if the tree is noisy; then hard-fail on new findings or on a
  cleaned baseline — document which.
- Deep interprocedural passes often belong on **nightly**, not every commit.
- Reject paywalled or version-capped tools as *primary* if they cannot see
  the real codebase (keep them optional if useful).

## Agentic audit (T4)

Allowed as:

- scheduled or on-demand research
- sandboxed where possible
- human-reviewed findings
- separate from merge required checks

Forbidden as:

- required status check based only on model judgment
- unsandboxed agent with broad secrets **as a gate**

## What this is not

- Not a full red-team engagement
- Not exploit or malware authoring
- Not a replacement for threat modeling of untrusted parsers / ABI surfaces
  (those need tests and design, not only SCA)
