# Dolt Storage and Sync Concepts

Read this when a Beads task involves storage identity, pending changes, commits, remotes, bootstrap, or JSONL exports.

## Authoritative state

Current Beads supports Dolt as its storage backend. The active Dolt database—not a JSONL file—is authoritative for `bd list`, `bd show`, `bd ready`, and mutations. Legacy SQLite and `no-db` instructions do not describe current behavior; use the installed `bd init --help` or `bd migrate --help` for migration guidance.

Do not assume the database is always a particular directory under the current checkout. Beads can use redirects, embedded Dolt, or a configured server. Resolve the effective workspace first:

```bash
bd where
bd context       # when backend/repository identity also matters
bd dolt show     # Dolt configuration and connectivity
```

`bd dolt status` reports Dolt engine/server health. It does **not** report pending issue-data changes. Use `bd vc status` for the current Dolt branch and uncommitted working-set changes.

## JSONL is an optional export

`.beads/issues.jsonl` may be produced when `export.auto` is enabled. It supports viewers, interchange, and issue-level migration; it is not the normal cross-machine sync channel or a backup of Dolt history.

Do not use routine `bd import .beads/issues.jsonl` as a substitute for `bd dolt pull`. JSONL import cannot represent all history semantics and cannot determine whether an absent record was deleted, omitted, or never exported.

Confirm effective export settings rather than assuming hooks or auto-staging:

```bash
bd config get export.auto
bd config get export.git-add
bd config show
```

## Working set and commits

A successful write can be durable in the local Dolt working set without yet being a Dolt commit. The effective `dolt.auto-commit` policy controls commit timing:

- `on` commits each write.
- `batch` accumulates writes for `bd dolt commit`.
- `off` leaves writes uncommitted until an explicit commit; this is the CLI default unless configuration overrides it.

Inspect before committing:

```bash
bd vc status
bd dolt commit -m "Describe the issue-data changes"
# bd vc commit offers additional commit-message input options
```

Do not change the auto-commit policy or create a commit merely because an issue was mutated. Commit only when the governing user request authorizes it; repository workflow may define the procedure but cannot create consent. If authorized to publish pending requested Beads changes, inspect the status, disclose what the commit includes, and then create the necessary non-destructive Dolt commit.

Dolt commits are independent of source Git commits. Neither operation implies authorization for the other.

## Remotes and cross-machine sync

Dolt remotes are optional. Inspect configuration before pull or push:

```bash
bd dolt remote list
bd config validate
```

When a remote is configured, cross-machine issue-data synchronization uses:

```bash
bd dolt pull
bd dolt push
```

Pull and push change shared state. Run them only when the governing user request explicitly authorizes them; documented repository policy may define how, not whether, to do so. A request to create, update, claim, or close an issue is not implicit sync permission. Never use force-push merely to make a rejected push succeed.

Source Git and Dolt remotes may share hosting, but their histories remain separate: `git push` does not publish issue-data commits, and `bd dolt push` does not publish source branches.

## Fresh clones and recovery

Use `bd bootstrap` only when setting up or repairing a checkout and only after inspecting its help and the intended remote. Do not assume every repository publishes Dolt history or that a remote named `origin` is configured.

For diagnosis, prefer read-only discovery first:

```bash
bd where
bd doctor
bd dolt show
bd dolt remote list
bd vc status
bd bootstrap --help
```

Remote creation, pull, bootstrap, reinitialization, history replacement, and force operations can affect shared or local history. Explain the intended source of truth and obtain explicit authorization before performing them.
