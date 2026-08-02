# claude-skills

Generic `loop` + `plan` skills for Claude Code, plus the subagent roster they
dispatch. Beads (`bd`) is the canonical work tracker (with gh/Linear/no-tracker
fallbacks), reviews are cross-model whenever the pool permits, and live state
(pool, tree, bead) is injected at skill-load time via dynamic context
injection.

## Layout

```
skills/loop/     orchestrate one work unit: claim -> implement -> review -> fix -> push -> close
skills/plan/     decompose a feature via a 3-panelist design round (deep-module / minimal-diff / seam)
agents/          coder, reviewer, beads-creator, beads-reviewer, panelists/
```

## Install

```sh
./install.sh              # or: .\install.ps1
```

Installs `skills/*` into `~/.claude/skills/` and `agents/*` into
`~/.claude/agents/`, overwriting existing files (idempotent). Pass
`--project` / `-Project` to install into `./.claude/` of the current working
directory instead (repo-local install).

## The pool

`skills/loop/pool.md` holds the global default model pool; a repo's own
`.claude/skills/loop/pool.md` overrides it at load time. The pool pins which
models fill the coder / reviewer / beads roles. Rule in one sentence: the
reviewer must be a different model than the coder whenever the pool has two
or more entries (same-tier is a valid degraded run).

## Overlay rule

A repo's own `loop` / `plan` skill always wins over these generic ones — the
generic skills detect a repo-local version and defer to it. Note that per
Claude Code precedence, a personal install (`~/.claude/skills/loop`) overrides
a project skill of the same name — so a repo keeping its own loop skill
should keep it project-local under a distinct name, or accept the override.
