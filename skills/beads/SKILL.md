---
name: beads
description: Use when creating, claiming, updating, or closing issues, managing dependencies, or syncing work with the bd (beads) CLI in a project where beads is initialized (.beads/ exists). Not for GitHub/Jira/Linear trackers, and not for projects where beads has not been initialized (no .beads/ directory, bd init not run).
---

# Beads Issue Tracker

In projects where beads is initialized (a `.beads/` directory exists, i.e. `bd init` has been run), use **bd** (beads) for all task tracking. Do NOT use TodoWrite, TaskCreate, or markdown TODO lists. In projects without beads initialized, this skill does not apply.

## Architecture

Issues live in a local Dolt database (`.beads/dolt/`). Cross-machine sync uses `bd dolt push/pull` via `refs/dolt/data` on your git remote — separate from `refs/heads/*`. `.beads/issues.jsonl` is a passive export, not the source of truth (JSONL is the source of truth in no-db mode — this repo itself runs no-db mode).

Reference: [references/sync-concepts.md](references/sync-concepts.md)

## Setup & Recovery

If bd reports "no beads database found" or you are unsure whether beads is set up:

```bash
bd init               # Initialize .beads/ (and the Dolt database) in the current project
bd where              # Show which beads database is actually active
bd doctor             # Diagnose installation, schema, and sync problems
```

## Commands

### Finding Work

```bash
bd ready                        # Show issues ready to work (no blockers)
bd list --status=open           # All open issues
bd list --status=in_progress    # Active work
bd show <id>                    # Issue details with dependencies
```

### Creating Issues

```bash
bd create --title="Summary" --description="Why and what" --type=task --priority=2
```

Valid types include `task`, `bug`, and `feature`; choose one concrete value.

- Priority: 0–4 (0=critical, 4=backlog). Use numbers, not words.
- Optional flags: `--acceptance="criteria"`, `--design="decisions"`, `--notes="context"`
- Do NOT use `bd edit` — it opens an interactive editor that blocks agents.

### Updating & Claiming

```bash
bd update <id> --claim                # Claim work
bd update <id> --assignee=username    # Assign
bd update <id> --title="..."          # Update fields inline
bd update <id> --description="..."
bd update <id> --notes="..."
bd update <id> --design="..."
```

### Completing Work

```bash
bd close <id>                   # Mark complete
bd close <id1> <id2> ...        # Close multiple at once
bd close <id> --reason="why"    # Close with explanation
bd close <id> --suggest-next    # Show newly unblocked issues
```

### Dependencies

```bash
bd dep add <issue> <depends-on> # issue depends on depends-on
bd blocked                      # Show all blocked issues
```

### Labels & Queries

```bash
bd create "..." -l "opord,opord:<slug>"        # --labels / -l, comma-separated
bd create "..." --parent <epic-id>             # Hierarchical child issue
bd update <id> --add-label=<label>             # Add a label to an existing issue
bd list --label=opord:<slug>                   # AND: issue must have ALL listed labels
bd list --label-any=a,b                        # OR: at least one of the labels
bd list --label-pattern="opord:*"              # Glob match on label names
bd query "label=opord:<slug> AND status=open"  # Compound filters (AND/OR/NOT, field=value)
```

Label convention: use namespaced `<domain>:<value>` labels (e.g. `pace:primary`, `cycle:recon`, `opord:<slug>`) to group related issues; retrieve them by exact label (`bd list --label` / `bd query "label=..."`) or by glob (`bd list --label-pattern`). The mission-planning skill uses these conventions for its OPORD epics and children.

### Sync & Search

```bash
bd dolt push          # Push beads data to remote
bd dolt pull          # Pull from remote
bd search <query>     # Search by keyword
```

### Quality & Hygiene

```bash
bd stats              # Project statistics
bd doctor             # Check for sync problems
bd lint               # Check issues for missing sections
bd stale              # Find issues with no recent activity
bd orphans            # Find broken dependencies
bd preflight          # Pre-PR checks
```

### Other

```bash
bd remember "insight"           # Persist knowledge across sessions
bd memories <keyword>           # Search memories
bd defer <id> --until="date"    # Defer work
bd supersede <id> --with=<new>  # Mark superseded
bd update <id> --add-label=human  # Flag for human decision (bd human list/respond reads the 'human' label)
bd formula list                 # Workflow templates
bd mol pour <name>              # Start workflow from template
```

## Session Close Protocol

When ending a session, complete ALL steps. Work is NOT done until the pushes in step 4 succeed.

1. **File issues** for remaining work
2. **Run quality gates** (tests, linters, builds) if code changed
3. **Update issue status** — close finished work, update in-progress items
4. **Push to remote** — `git push` alone does NOT sync beads data, which lives on `refs/dolt/data`, not `refs/heads/*`. Push both (the bd pre-push hook installed via `bd hooks install` automates the beads push):
   ```bash
   git pull --rebase
   git push
   bd dolt push  # Sync beads data to refs/dolt/data (skip in no-db mode: JSONL travels with git push)
   git status    # Must show "up to date with origin"
   ```
5. **Verify** all changes committed and pushed

**Rule:** Work is NOT complete until both pushes succeed — never stop before pushing (that strands work locally), never say "ready to push when you are"; if a push fails, resolve and retry until it succeeds.
