# claude-skills

The universal work doctrine for Claude Code: `work-loop` + `work-plan` +
supporting skills, plus the subagent roster they dispatch. This is **how we
work in every repo**, not a per-project overlay:

- **Design before build** — no implementation without a plan-stamped design
  (cross-model 3-panelist round; only `work-plan` stamps provenance).
- **Beck pairs** — every non-trivial unit is an implement unit + a Cleanup
  sibling (make it work → make it right), worked back-to-back.
- **TDD + Tidy First** — red→green for behavior; structure and behavior never
  share a commit.
- **Independent cross-model review** — a different model tier audits the
  committed diff (PASS/FIX/ROLLBACK, mutation check) before anything pushes.
- **Drop-Tested refactors** — a refactor earns its own unit only if it would
  merge with the feature cancelled.
- **Committed-tree evidence** — gates count on the committed tree; push only
  green; close with the reason mapped to the AC.

Beads (`bd`) is the canonical work tracker (gh/Linear/no-tracker fallbacks).
Repo bindings — gate command, commit format, map generator, non-negotiables —
are discovered from `AGENTS.md`/`CLAUDE.md`, so the same doctrine runs in any
repo. Live state (pool, tree, unit) is injected at skill-load time via dynamic
context injection — the model reads state inline instead of burning tool
calls on it.

## Layout

```
skills/work-loop/                  one unit: design gate → claim → Phase A → review → fix → Finalize → Cleanup pair
skills/work-plan/                  design rounds, decomposition, Drop Test, provenance, flows A/B/C
skills/bd-epic-runner/             walk an epic's children to done through the loop (pair affinity, ready order)
skills/dynamic-context-injection/  auditor + teacher for load-time state injection in skills
agents/                            coder, reviewer, beads-creator, beads-reviewer, panelists/
install.sh                         POSIX installer (global or --project)
install.ps1                        PowerShell installer (global or -Project)
```

## Install

```sh
./install.sh              # or: .\install.ps1
./install.sh --project    # repo-local: ./.claude/ of the cwd
```

Global install copies `skills/*` → `~/.claude/skills/` and `agents/*` →
`~/.claude/agents/` (idempotent, overwrites). Claude Code only — no
`~/.agents` targets.

The names are deliberately NOT `loop`/`plan`: a personal skill would shadow
both project skills and Claude Code's bundled `/loop` interval skill.
`work-loop`/`work-plan` collide with nothing.

## The pool

`pool.md` (repo root) is the global default model pool, installed to
`~/.claude/pool.md`. A repo's own `.claude/pool.md` overrides it at load
time — pools are per-repo cost decisions that travel with the repo. The
skills inject the pool at load (repo first, then global, then loud failure)
— the model reads state, it doesn't fetch it. Pin `coder:` / `reviewer:` /
`beads:` or let class-based resolution pick. Rule in one sentence: coder and
reviewer must be different models whenever the pool allows (same-tier is a
valid degraded run, flagged `degradedRun: true`).

## Overlay + extension points

- A repo's own loop/plan skill always wins — `work-loop`/`work-plan` detect a
  repo-local `*loop*`/`*plan*` skill and defer. These are the doctrine for
  repos without their own, and the portable core for repos that adopt it.
- A repo extends the roster by shadowing: `.claude/agents/coder.md` /
  `reviewer.md` / `panelists/*` with the same names add stack-specific rules
  (review bars, fixtures, borders) on top of the global role contracts.
- Everything else repo-specific (gate commands, commit format, map script,
  tracker sync) belongs in `AGENTS.md`/`CLAUDE.md`, not in a skill fork.

## No delegation skill

Older versions of this doctrine shipped a `delegation` skill teaching
subagent mechanics. Claude Code now owns that layer (Agent tool guidance,
background-by-default, model/effort fields, concurrency caps), so it was
deleted — the durable rules (one writer, fresh context per iteration,
structured worker packets) live inside `work-loop` itself.
