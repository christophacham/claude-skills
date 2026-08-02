# Dynamic context injection — worked examples

This file is read on demand, never preprocessed — so it can safely contain
literal injection syntax. Each example shows the pattern exactly as it would
appear in a real SKILL.md.

## Convert: static read → injection

Before (costs a tool call + result envelope every load):

```markdown
1. `bd show <epic>` — read the design field in full.
```

After (arg comes from the skill invocation, so `$0` works):

```markdown
## Epic doctrine (live at load)
!`bd show $0`

The design field above is authoritative doctrine — treat every constraint
as a hard rule.
```

When invoked as `/bd-epic-runner cpmb-x0v`, `$0` expands before the command
runs, and the model receives the bead's full details inline.

## Convert: environment snapshot → fenced block

Before:

```markdown
First check the tree is clean and what's ready: run `git status --short`
and `bd ready`.
```

After (multi-line commands in a fence opened with three backticks + `!`):

````markdown
## State at load
```!
git status --short
bd ready 2>/dev/null || echo "(no beads here)"
```
````

## Convert: version/tooling preamble

Before:

```markdown
Check the toolchain: run `node --version` and `npm --version`.
```

After:

````markdown
## Toolchain
```!
node --version
npm --version
```
````

## VIOLATION: mutation injected (never do this)

```markdown
!`bd update $0 --claim`
```

Injected commands run at load even if the model, after reading everything,
decides NOT to claim. Claiming is a decision; it must stay a tool call.
Injection is only for reads the model needs *before* deciding anything.

## VIOLATION: chained args (single pass)

```markdown
!`bd ready`
!`bd show $(bd ready --json | jq -r '.[0].id')`
```

Wrong twice over: substitution runs once (no re-scan, no dependency between
lines), and the bead id isn't known at invocation time. Keep the first line;
the second must be an instruction the model executes as a tool call after
reading the ready list.

## VIOLATION: `!` not at line start (silently literal)

```markdown
Run mode: KEY=!`cmd`
```

The `!` follows `=`, so nothing runs — the line stays literal text and the
model sees the placeholder verbatim. If you meant injection, the `!` must be
at line start or after whitespace.

## VIOLATION: unguarded command at user-level scope

A skill in `~/.claude/skills/` loads in repos without beads:

```markdown
!`bd ready`
```

In a non-beads repo this dumps an error (or aborts the load) into context —
the opposite of the goal. Guard it:

```markdown
!`bd ready 2>/dev/null || echo "(no beads initialized here — skill does not apply)"`
```

The guard turns a polluting failure into one informative line.

## Guarded optional reads (pattern library)

```markdown
!`git log -3 --oneline 2>/dev/null || echo "(not a git repo)"`
!`cat package.json 2>/dev/null | head -40 || echo "(no package.json)"`
```

Keep guards short — the fallback text also lands in context.

## What NEVER converts (stay tool calls)

- `bd update/close/dep add`, `git commit/push`, file writes — mutations.
- Commands whose args come from earlier output (see chained-args violation).
- Interactive commands (`bd edit` opens an editor; blocks agents).
- Slow or network-heavy commands a skill only sometimes needs — injection
  pays the cost on EVERY load, including accidental triggers.
- Commands the model must decide whether to run at all.
