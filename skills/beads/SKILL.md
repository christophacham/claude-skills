---
name: beads
description: Use when creating, claiming, updating, or closing issues, managing dependencies, or explicitly committing or syncing issue data with the bd (Beads) CLI in a project where Beads is initialized. Not for GitHub/Jira/Linear trackers, uninitialized projects, or as permission to publish unrelated source-code changes.
---

# Beads Issue Tracker

Use `bd` for requested issue-tracker work when the project is already initialized for Beads. Do not initialize Beads, replace another tracker, or impose a project workflow unless the user asks.

## Establish the live contract

Beads versions and project configuration differ. Before a mutation when the active workspace or syntax is uncertain:

```bash
bd where                 # Resolve the active Beads workspace, including redirects
bd help                  # List commands supported by the installed version
bd <command> --help      # Confirm flags before relying on them
```

A `.beads/` directory marks an initialized checkout, but `bd where` is authoritative about the active location. If no workspace is active, stop and ask whether to initialize; do not run `bd init` implicitly.

Current Beads uses Dolt as its supported storage backend. The live Dolt database is authoritative. `.beads/issues.jsonl`, when configured, is an optional export for viewers, interchange, or migration; it is not a no-database backend or the normal sync channel. Treat instructions that rely on legacy SQLite or `no-db` mode as stale and confirm migration steps with the installed `bd init --help` or `bd migrate --help`.

For storage, commit, and remote details, read [references/sync-concepts.md](references/sync-concepts.md).

## Mutation contract

A request to perform one tracker operation authorizes only that operation.

1. Inspect the target with `bd show <id> --json` when changing an existing issue.
2. Use the narrowest command that expresses the requested mutation.
3. Do not infer extra labels, fields, parents, dependencies, assignments, claims, status changes, closes, commits, or pushes.
4. Verify the affected issue or relation after the command and report the exact mutation.
5. If required content or the intended dependency direction is ambiguous, ask instead of guessing.

Closing, reopening, reparenting, removing dependencies, and resolving duplicates require explicit intent. Deletion, pruning, purging, destructive reinitialization, and force-push operations require separate, explicit authorization and a review of their effects.

## Core commands

### Find and inspect

```bash
bd ready
bd list --status=open
bd list --status=in_progress
bd show <id>
bd blocked
bd status
```

### Create

```bash
bd create --title="Summary" --description="Why and what" --type=task --priority=2
```

Built-in types and flags can change; use `bd create --help`. Priorities are **0–4**, where `0` is highest/critical and `4` is lowest/backlog. `2` is the CLI default. Accept `P0`–`P4` only if the installed help supports them. Do not invent acceptance criteria, design notes, labels, or custom fields that the request did not supply.

### Update and claim

```bash
bd update <id> --claim
bd update <id> --assignee=username
bd update <id> --priority=1
bd update <id> --title="..."
bd update <id> --description="..."
bd update <id> --acceptance="..."
bd update <id> --design="..."
bd update <id> --notes="..."
```

`--claim` atomically sets the current actor as assignee and moves the issue to `in_progress`; use it only when the request is to claim the issue. Do not use `bd edit` in an agent workflow because it opens an interactive editor.

### Close only when requested

```bash
bd close <id>
bd close <id> --reason="why"
```

A successful implementation, review, or repository policy does not itself authorize closing the issue. Close only when the governing user request explicitly authorizes it, then verify the resulting status.

### Dependencies and hierarchy

```bash
bd dep add <issue> <depends-on>   # issue depends on depends-on
bd dep list <issue>
bd children <parent-id>
bd create "..." --parent <parent-id>
```

Confirm direction before adding an edge. Use `bd dep --help` for relation and removal syntax. Never infer a parent or dependency from similar titles alone.

### Labels and queries

```bash
bd label add <id> <label>
bd label remove <id> <label>
bd list --label=<label>
bd list --label-any=a,b
bd list --label-pattern="domain:*"
bd query "label=<label> AND status=open"
```

Labels are project data, not generic Beads doctrine. Preserve the project's existing conventions and add, remove, or normalize labels only when requested or when a documented project rule supplies the exact value.

### Quality and search

```bash
bd search <query>
bd lint
bd stale
bd orphans
bd dep cycles
bd preflight
```

Treat lint, orphan, stale, and duplicate output as evidence for review, not permission to mutate issues.

## Dolt working state, commits, and remotes

Issue writes change the Dolt working set. Whether they immediately create Dolt commits depends on the effective `dolt.auto-commit` policy:

- `on`: each write commits automatically.
- `batch`: writes accumulate until `bd dolt commit` (and may be flushed by process shutdown handling).
- `off`: writes remain in the working set until explicitly committed. This is the CLI default unless project configuration overrides it.

Use the commands for their distinct purposes:

```bash
bd vc status              # Dolt branch and uncommitted issue-data changes
bd dolt status            # Dolt engine/server health, not pending changes
bd dolt commit -m "..."   # Commit pending issue-data changes
bd dolt remote list       # Inspect configured Dolt remotes
bd dolt pull              # Pull issue-data commits from a configured remote
bd dolt push              # Push issue-data commits to a configured remote
```

A request to create or update an issue does **not** authorize a Dolt commit, pull, or push. Run commit/pull/push only when the governing user request explicitly authorizes that operation; repository workflow may define the procedure but cannot create consent. An explicit request to publish/sync Beads authorizes the non-destructive Dolt commit needed to publish pending requested changes, followed by the requested push; inspect `bd vc status` first and report what will be included. Never infer permission for `--force`.

Dolt history and source Git history are separate. `bd dolt commit/push` does not commit or push source code, and `git commit/push` does not publish Dolt history. Do not perform source Git operations merely because Beads changed.

There is no unconditional end-of-session close, commit, pull, or push protocol. Follow the user's request and the repository's documented policy, and report any pending Dolt state left intentionally uncommitted or unpublished.
