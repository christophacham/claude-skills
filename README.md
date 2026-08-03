# claude-skills

The universal software engineering doctrine and skills suite for Claude Code: `work-loop` + `work-plan` + foundational architecture, testing, and refactoring skills, plus the subagent roster they dispatch.

---

## Quick Start & Installation

### Remote One-Liner Install (No clone needed)
Installs directly from GitHub into `~/.claude/`:

```sh
# macOS / Linux (POSIX)
curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/install.sh | sh

# Windows (PowerShell)
iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/install.ps1 | iex
```

### Local Repo Install
Run from inside a cloned copy of this repository:

```sh
# macOS / Linux (POSIX)
./install.sh             # Global (~/.claude/)
./install.sh --project   # Project-local (./.claude/)

# Windows (PowerShell)
.\install.ps1            # Global (~/.claude/)
.\install.ps1 -Project   # Project-local (./.claude/)
```

---

## Core Doctrine

- **Design before build** — No implementation without a plan-stamped design (3-panelist cross-model round; `work-plan` stamps provenance).
- **Beck pairs** — Every non-trivial unit is an implement unit (Phase A: make it work) + a Cleanup sibling (Phase B: make it right), worked back-to-back.
- **TDD + Tidy First** — Red→green TDD for behavior; structure and behavior never share a commit.
- **Independent cross-model review** — A different model tier audits the committed diff (PASS/FIX/ROLLBACK, mutation check) before anything pushes.
- **Drop-Tested refactors** — Refactor candidates use catalog Fowler smell + move (`refactoring` skill) and earn standalone status only if they would merge with the feature cancelled.
- **Committed-tree evidence** — Gates count on the committed tree; push only green.

Beads (`bd`) is the canonical work tracker, with fallback support for GitHub, Linear, or markdown tracking.

---

## Bundled Skills

### Work Loop & Planning Core
- **`work-loop`**: One unit cycle — design gate → claim → Phase A (TDD) → review → fix → Finalize → seed Cleanup → pair triage.
- **`work-plan`**: 3-panelist design rounds (`deep-module`, `minimal-diff`, `seam`), catalog Drop-Test refactors, and provenance stamping.
- **`bd-epic-runner`**: Walks all ready children of a beads epic to completion through `work-loop`.
- **`dynamic-context-injection`**: Auditor + guide for load-time shell state injection in skills.

### Tracker Integration
- **`beads`**: Issue creation, claiming, status updates, dependency graphing, and Dolt sync via `bd`.

### Software Engineering Disciplines
- **`architecture-design`**: Clean Architecture, tactical DDD, SOLID, and component cohesion/coupling principles.
- **`architectural-decomposition`**: Monolith decomposition patterns, coupling metrics, and component extraction.
- **`distributed-architecture`**: Trade-off-driven design for distributed architectures, sagas, service topology, and database splitting.
- **`refactoring`**: Identifying code smells, Fowler refactoring mechanics, and structural cleanups.
- **`simple-design`**: Ousterhout simple module design (deep modules, information hiding, small surface area).
- **`testing-tdd`**: Test-driven development cycles, test design, mocking strategies, and testability.
- **`third-party-integration`**: Adapter patterns for wrapping 3rd-party dependencies.
- **`mission-planning`**: OPORD artifacts, PACE fallbacks, and execution feedback loops for major initiatives.
- **`skill-creator`**: Creating, auditing, validating, and packaging Agent Skills.

---

## Model Pool (`pool.md`)

`pool.md` sets the model routing pool installed to `~/.claude/pool.md`. A project's `.claude/pool.md` overrides global settings at load time:

- **Cross-model rule**: Coder and reviewer should be different model tiers whenever possible (e.g. `coder: sonnet`, `reviewer: opus`).
- **Pins**: Optional `coder:` / `reviewer:` pins (must be pool members). Unpinned tiers resolve by unit class.
- **Fixed-tier mechanical roles** (skill doctrine, **always `haiku`**, pool-independent — not configured in `pool.md`): `map-drift` (map claim trust report before design panels), `beads-creator`, `beads-reviewer`.

---

## Extension & Customization

- **Repo Overlays**: If a repo has its own `.claude/skills/*loop*` or `*plan*` skill, it overrides `work-loop` or `work-plan`.
- **Agent Shadowing**: Placing a custom agent in `.claude/agents/coder.md` or `reviewer.md` extends the global role contract with stack-specific rules.
- **Project Bindings**: Test commands, commit formats, and non-negotiables are discovered from `CLAUDE.md`.
