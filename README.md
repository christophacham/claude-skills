# claude-skills

The universal work doctrine and engineering skills suite for Claude Code: `work-loop` + `work-plan` + foundational design, architecture, and testing skills, plus the subagent roster they dispatch. This is **how we work in every repo**, not a per-project overlay:

- **Design before build** — no implementation without a plan-stamped design (cross-model 3-panelist round; only `work-plan` stamps provenance).
- **Beck pairs** — every non-trivial unit is an implement unit + a Cleanup sibling (make it work → make it right), worked back-to-back. Cleanup is **seeded** from Phase A `cleanupCandidates` as catalog-literal Fowler **smell + move** (optional simple-design red-flag #); empty/invalid seed free-closes (`nothingToTidy`). `Comments` only with Extract Function / Rename / Introduce Assertion — no prose theater, no full loop for glyphs/headers.
- **TDD + Tidy First** — red→green for behavior; structure and behavior never share a commit.
- **Independent cross-model review** — a different model tier audits the committed diff (PASS/FIX/ROLLBACK, mutation check) before anything pushes.
- **Drop-Tested refactors** — a refactor earns its own unit only if it would merge with the feature cancelled.
- **Committed-tree evidence** — gates count on the committed tree; push only green; close with the reason mapped to the AC.

Beads (`bd`) is the canonical work tracker (gh/Linear/no-tracker fallbacks).
Repo bindings — gate command, commit format, map generator, non-negotiables — are discovered from `AGENTS.md`/`CLAUDE.md`, so the same doctrine runs in any repo. Live state (pool, tree, unit) is injected at skill-load time via dynamic context injection — the model reads state inline instead of burning tool calls on it.

## Skills Roster

### Work Loop & Planning Core
- **`skills/work-loop/`**: One unit cycle — design gate → claim → Phase A (TDD) → review → fix → Finalize → seed Cleanup → pair triage (free-close / comment-nit / full Phase B).
- **`skills/work-plan/`**: Design before build — 3-panelist design rounds, decomposition, Drop-Test refactors, provenance stamping, flows A/B/C.
- **`skills/bd-epic-runner/`**: Walk an epic's children to done through the loop (pair affinity, ready order).
- **`skills/dynamic-context-injection/`**: Auditor + teacher for load-time state injection in skills.

### Tracker Integration
- **`skills/beads/`**: Issue creation, claiming, updates, dependency graphing, and sync via the `bd` CLI.

### Engineering & Design Disciplines
- **`skills/architecture-design/`**: Clean Architecture layering, tactical DDD, SOLID, and component cohesion/coupling principles.
- **`skills/architectural-decomposition/`**: Monolith decomposition patterns, coupling metrics, and component extraction strategies.
- **`skills/distributed-architecture/`**: Trade-off-driven design for distributed architectures, service topology, sagas, and database splitting.
- **`skills/refactoring/`**: Identifying code smells, Fowler refactoring mechanics, and structural cleanups.
- **`skills/simple-design/`**: Ousterhout simple module design — deep modules, information hiding, and small surface area.
- **`skills/testing-tdd/`**: Test-driven development (TDD) cycles, test design, fixtures, mocking strategy, and testability.
- **`skills/third-party-integration/`**: Patterns for wrapping external dependencies and 3rd-party API adapters.
- **`skills/mission-planning/`**: Mission planning for major initiatives — OPORD artifacts, PACE fallbacks, and OODA feedback loops.
- **`skills/skill-creator/`**: Create, audit, validate, and package Agent Skills.

## Layout

```
skills/                            14 bundled skills (work-loop, work-plan, beads, tdd, refactoring, etc.)
agents/                            coder, reviewer, beads-creator, beads-reviewer, panelists/
install.sh                         POSIX installer (global or --project)
install.ps1                        PowerShell installer (global or -Project)
pool.md                            Default model routing pool configuration
```

## Install

```sh
./install.sh              # or: .\install.ps1
./install.sh --project    # repo-local: ./.claude/ of the cwd
```

Global install copies `skills/*` → `~/.claude/skills/` and `agents/*` → `~/.claude/agents/` (idempotent, overwrites). Claude Code only — no `~/.agents` targets.

The names are deliberately NOT `loop`/`plan`: a personal skill would shadow both project skills and Claude Code's bundled `/loop` interval skill. `work-loop`/`work-plan` collide with nothing.

## The pool

`pool.md` (repo root) is the global default model pool, installed to `~/.claude/pool.md`. A repo's own `.claude/pool.md` overrides it at load time — pools are per-repo cost decisions that travel with the repo. The skills inject the pool at load (repo first, then global, then loud failure) — the model reads state, it doesn't fetch it. Pin `coder:` / `reviewer:` / `beads:` or let class-based resolution pick. **Pins must name `pool:` members** (out-of-pool pins fail loudly). Include a weak tier (e.g. `haiku`) if you want cheap trivial / dead-code-only Cleanup coding without leaving the pool. Rule in one sentence: coder and reviewer must be different models whenever the pool allows (same-tier is a valid degraded run, flagged `degradedRun: true`); free-close Cleanup skips agents entirely.

## Overlay + extension points

- A repo's own loop/plan skill always wins — `work-loop`/`work-plan` detect a repo-local `*loop*`/`*plan*` skill and defer. These are the doctrine for repos without their own, and the portable core for repos that adopt it.
- A repo extends the roster by shadowing: `.claude/agents/coder.md` / `reviewer.md` / `panelists/*` with the same names add stack-specific rules (review bars, fixtures, borders) on top of the global role contracts.
- Everything else repo-specific (gate commands, commit format, map script, tracker sync) belongs in `AGENTS.md`/`CLAUDE.md`, not in a skill fork.

## No delegation skill

Older versions of this doctrine shipped a `delegation` skill teaching subagent mechanics. Claude Code now owns that layer (Agent tool guidance, background-by-default, model/effort fields, concurrency caps), so it was deleted — the durable rules (one writer, fresh context per iteration, structured worker packets) live inside `work-loop` itself.
