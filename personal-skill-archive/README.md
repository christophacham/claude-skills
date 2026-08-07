# personal-skill-archive

**This folder is a preservation archive — not part of the managed skill suite.**

It was copied from `~/.claude/skills/` on 2026-08-05 as a backup before wiping
the machine. These skills are **not** installed or wired by the Node installer
(`npx`/`bunx` claude-skills), and they are **not** validated against the suite's standards.
They are kept here only so nothing is lost.

---

## Current managed suite

The root [`README.md`](../README.md) is the source of truth for the current managed suite, its agents, installation behavior, and doctrine. This archive intentionally does not duplicate that catalog because archived contents and the active suite evolve independently.

---

## Archived skills (from `~/.claude/skills/`)

| Skill | What it does | Notes |
|-------|--------------|-------|
| `find-docs` | Context7 CLI docs lookup for library/API/CLI questions | Context7 CLI (`npx ctx7@latest`); matches the global `~/.claude/rules/context7.md` rule |
| `ccc` | Semantic code search via CocoIndex Code (`ccc` CLI / MCP) | Depends on a local index |
| `codebase-map` | Generated repo module/surface map + drift gate | Pairs with `quality-gates` |
| `quality-gates` | Two-tier quality gate system (fail-fast + nightly), fail-closed | Compatible with this repo's doctrine |
| `security-gates` | Self-hosted deterministic security gates (secrets, audit, SAST) | Complements `quality-gates` |
| `mmx-cli` | MiniMax media generation (`mmx`) | Personal tooling; needs account/API |
| `orca-cli` | Orca worktree/browser/terminal control | Personal tooling; needs Orca app |
| `orchestration` | Orca multi-agent orchestration (DAGs, dispatch, gates) | Personal tooling; needs Orca app |

## How to restore

Copy each subfolder back into the target Claude skills directory:

```powershell
# Windows
Copy-Item -Recurse -Force .\<skill-name> $env:USERPROFILE\.claude\skills\<skill-name>

# POSIX
cp -R ./<skill-name> ~/.claude/skills/<skill-name>
```

or install via `skills` marketplace/npx where the skill documents it (e.g.
`npx skills add <repo>`).

## Restore checklist

- [ ] `find-docs` → works out of the box (`npx ctx7@latest`)
- [ ] `ccc` / `codebase-map` → rebuild index/map after restore
- [ ] `quality-gates` / `security-gates` → install scripts into the repo
- [ ] `mmx-cli`, `orca-cli`, `orchestration` → reinstall the CLI / app and
      re-authenticate (MiniMax key, Orca)
