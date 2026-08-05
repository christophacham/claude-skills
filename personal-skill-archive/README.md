# personal-skill-archive

**This folder is a preservation archive — not part of the managed skill suite.**

It was copied from `~/.claude/skills/` on 2026-08-05 as a backup before wiping
the machine. These skills are **not** installed or wired by `install.ps1` /
`install.sh`, and they are **not** validated against the suite's standards.
They are kept here only so nothing is lost.

---

## What we do here (the repo this sits in)

`claude-skills` is the universal software engineering doctrine and skills
suite for Claude Code:

- **Doctrine** — short beads + clear seams, design before build (TDD), Tidy
  First, independent cross-model review, drop-tested prep refactors,
  committed-tree evidence, honest gates.
- **Core skills** — `work-loop` (one unit end-to-end), `work-plan` (sized
  design panel), `bd-epic-runner`, `dynamic-context-injection`,
  `peek-repo`, `ddg-search`, `brave-search`, `tavily-search`,
  `reimpl-scout`.
- **Discipline skills** — architecture, decomposition, distributed systems,
  refactoring, simple-design, testing-tdd, third-party integration,
  mission-planning, skill-creator.
- **Trackers** — `beads` via the `bd` CLI, with GitHub/Linear/markdown
  fallbacks.
- **Install** — `install.ps1` (Windows) / `install.sh` (POSIX) copy skills,
  agents, panelists, `pool.md`, install runtime deps (Brave `npm`, `ddgs`,
  Tavily CLI), and optionally prompt for Brave/Tavily API keys into
  `~/.claude/settings.json`.

See the repo root `README.md` for the full picture.

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
