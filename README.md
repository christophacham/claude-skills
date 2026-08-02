# claude-skills

Generic `work-loop` + `work-plan` skills for Claude Code, plus the subagent
roster they dispatch. Beads (`bd`) is the canonical work tracker (gh/Linear/
no-tracker fallbacks), reviews are cross-model whenever the pool permits, and
live state (pool, tree, unit) is injected at skill-load time via dynamic
context injection — the model reads state inline instead of burning tool
calls on it.

## Layout

```
skills/work-loop/   one unit: claim -> implement -> review -> fix -> gate -> push -> close
skills/work-plan/   decompose a feature via a 3-panelist design round (deep-module / minimal-diff / seam)
agents/             coder, reviewer, beads-creator, beads-reviewer, panelists/
install.sh          POSIX installer (global or --project)
install.ps1         PowerShell installer (global or -Project)
```

## Install

```sh
./install.sh              # or: .\install.ps1
./install.sh --project    # repo-local: ./.claude/ of the cwd
```

Global install copies `skills/*` → `~/.claude/skills/` and `agents/*` →
`~/.claude/agents/` (idempotent, overwrites). Claude Code only — no
`~/.agents` targets.

The names are deliberately NOT `loop`/`plan`: a personal skill shadows both
project skills and Claude Code's bundled `/loop` interval skill. `work-loop`
/`work-plan` collide with nothing.

## The pool

`skills/work-loop/pool.md` is the global default model pool. A repo's own
`.claude/skills/work-loop/pool.md` (or legacy `.claude/skills/loop/pool.md`)
overrides it at load time — pools are per-repo cost decisions. Pin
`coder:` / `reviewer:` / `beads:` or let class-based resolution pick. Rule
in one sentence: coder and reviewer must be different models whenever the
pool allows (same-tier is a valid degraded run, flagged `degradedRun: true`).

## Overlay rule

A repo's own loop/plan skill (e.g. `nps-loop`, `nps-plan`) always wins —
`work-loop` / `work-plan` detect a repo-local `*loop*` / `*plan*` skill and
defer to it. These two are the portable fallback for repos without their
own doctrine, not a replacement for repo doctrine.

## No delegation skill

Older versions of this doctrine shipped a `delegation` skill teaching
subagent mechanics. Claude Code now owns that layer (Agent tool guidance,
background-by-default, model/effort fields, concurrency caps), so it was
deleted — the durable rules (one writer, fresh context per iteration,
structured worker packets) live inside `work-loop` itself.
