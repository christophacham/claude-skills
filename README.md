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
./install.sh                       # Global (~/.claude/)
./install.sh --project             # Project-local: $PWD/.claude
./install.sh --project /path/to/app   # Project-local: /path/to/app/.claude (relative or absolute)
./install.sh --brave-api-key "$BRAVE_API_KEY" --tavily-api-key "$TAVILY_API_KEY"

# Windows (PowerShell)
.\install.ps1                      # Global (~/.claude/)
.\install.ps1 -Project             # Project-local: current location\.claude
.\install.ps1 -Project C:\path\to\app   # Project-local: C:\path\to\app\.claude
.\install.ps1 -BraveApiKey $env:BRAVE_API_KEY -TavilyApiKey $env:TAVILY_API_KEY
```

Install also:
- runs `npm install` in the installed `brave-search` skill (Node 20 or >=22)
- ensures the `ddgs` Python package when Python >=3.10 is available (`ddg-search`)
- ensures the Tavily CLI (`tvly`) when possible (`tavily-search`)
- interactively prompts for **Brave** and **Tavily** API keys (optional) and writes
  `env.BRAVE_API_KEY` / `env.TAVILY_API_KEY` into `~/.claude/settings.json`
  (never into the project tree). Skip with `--skip-brave-key` / `-SkipBraveKey`,
  `--skip-tavily-key` / `-SkipTavilyKey`, or deps with `--skip-deps` / `-SkipDeps`.
  Restart Claude Code after setting keys.

### Selective installer (Node, interactive)

Keeps bulk `install.sh` / `install.ps1` for full installs. For pick-and-place:

```sh
npm install          # once, from a clone
node bin/cli.js install
# or: npx . install   /   node bin/cli.js install --project /path/to/app
```

Guided flow (Clack UI):

1. **Search skills globally?** → multiselect `ddg-search` / `brave-search` / `tavily-search`
2. **API keys** only if a key-backed skill was chosen and the key is not already set
3. **Project tools?** → `dynamic-context-injection` + `skill-creator` into the project `.claude/`
4. **Remaining skills one-by-one** → Global · Project · Skip · **Done** (stop early)

Global installs from this CLI are recorded in `~/.claude/claude-skills-manifest.json`.

```sh
node bin/cli.js uninstall        # removes only those tracked global items
node bin/cli.js uninstall --yes  # no confirm
```

Project installs and bulk shell installs are **not** removed by the Node uninstall
(use `./uninstall.sh` / `.\uninstall.ps1` for bulk).

### Uninstall (bulk shell)

Removes only the skills, agents, and `pool.md` that this repo installs. Leaves other
`.claude` content, global packages (`ddgs`, `tvly`, npm modules), and API keys alone
unless you ask:

```sh
# macOS / Linux (POSIX)
./uninstall.sh                         # Global (~/.claude/)
./uninstall.sh --project               # Project-local: $PWD/.claude
./uninstall.sh --project /path/to/app  # Project-local: /path/to/app/.claude
./uninstall.sh --remove-keys           # also drop BRAVE_* / TAVILY_API_KEY from ~/.claude/settings.json
curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/uninstall.sh | sh

# Windows (PowerShell)
.\uninstall.ps1                        # Global (~/.claude/)
.\uninstall.ps1 -Project               # Project-local: current location\.claude
.\uninstall.ps1 -Project C:\path\to\app
.\uninstall.ps1 -RemoveKeys            # also drop API keys from settings
iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/uninstall.ps1 | iex
```

---

## Core Doctrine

- **Short beads, clear seams** — A leaf unit should be readable in ~30 seconds: testable AC (how-you-know in the bullets), one place + touch list for non-trivial work. No dual-write of the same facts into description + design + AC.
- **Design before build** — Non-trivial work needs a seam from `work-plan` (sized panel; judge compresses — panel essays do not become bead text). Content is the claim gate; `designed` is optional audit.
- **TDD + how-you-know** — Red→green for behavior; review re-runs the gate and the checks named in AC (not a separate proof field).
- **Tidy First** — Structure and behavior never share a commit; structural debt only when real — prefer `Refactor:` units over Cleanup shells; no always-on Cleanup pair.
- **Independent cross-model review** — A different model tier audits the committed diff (PASS/FIX/ROLLBACK, gate + mutation check) before push.
- **Drop-Tested prep refactors** — Prep work earns a standalone unit only if it would merge with the feature cancelled.
- **Committed-tree evidence** — Gates and AC checks count on the committed tree; push only green.
- **Epics stay short** — Intent, ownership, sequence, non-goals; long freezes live in repo docs, not bead novels. Work leaves, not epic titles as implement units.

Beads (`bd`) is the canonical work tracker, with fallback support for GitHub, Linear, or markdown tracking.

---

## Bundled Skills

### Work Loop & Planning Core
- **`work-loop`**: One unit cycle — claim gate (AC + seam) → implement (TDD) → review → fix → Finalize; optional `Refactor:` when structural debt is real.
- **`work-plan`**: Sized design panel (`deep-module`, `minimal-diff`, `seam`), short tiered beads, Drop-Test prep, MAP_TRUST load injection, optional provenance stamp.
- **`bd-epic-runner`**: Walks all ready children of a beads epic to completion through `work-loop`.
- **`dynamic-context-injection`**: Auditor + guide for load-time shell state injection in skills.
- **`peek-repo`**: Get third-party GitHub source under `%USERPROFILE%\code\tmp\<name>` (or `~/code/tmp/<name>`) so answers can come from real code. Runtime helpers strictly validate `owner/repo`; the model resolves vague product names (search or ask — never guess org); idempotent shallow `gh repo clone`; inspect the clone when the question is “how does this work”.
- **`ddg-search`**: Free web/news search + URL extract via the `ddgs` Python package (no API key; Python >=3.10). Auto-installs `ddgs` if missing. **Always forks** into an Explore subagent (`context: fork`, `background: false`) so raw hits stay out of the main context. Prefer `find-docs` for library APIs; use this for general web facts or as a no-key alternative to Brave Search.
- **`brave-search`**: Web search and page content extraction via the Brave Search API (`search.js` / `content.js`; Node 20 or >=22). Requires `BRAVE_API_KEY`. **Always forks** into an Explore subagent like `ddg-search`. Prefer for key-backed search; use `ddg-search` when no Brave key.
- **`tavily-search`**: LLM-optimized web search + URL extract via Tavily CLI (`tvly`). Requires `TAVILY_API_KEY`. One skill (search default; extract when given URLs); forked Explore worker; load-time readiness injection. Not crawl/map/deep-research.

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
- **`reimpl-scout`**: Reimplementation-grade multi-agent codebase scouts (A–F layers, topic packs, adversary scorecards). Orchestrator skill with load-time repo/pack injection — **not** forked. Use for clean-room freeze docs; use `peek-repo` for light “how does X work” clones.
- **`skill-creator`**: Creating, auditing, validating, and packaging Agent Skills.

---

## Model Pool (`pool.md`)

`pool.md` sets the model routing pool installed to `~/.claude/pool.md`. A project's `.claude/pool.md` overrides global settings at load time:

- **Cross-model rule**: Coder and reviewer should be different model tiers whenever possible (e.g. `coder: sonnet`, `reviewer: opus`).
- **Pins**: Optional `coder:` / `reviewer:` pins (must be pool members). Unpinned tiers resolve by unit class.
- **Fixed-tier mechanical roles** (skill doctrine, **always `haiku`**, pool-independent — not configured in `pool.md`): `beads-creator`, `beads-reviewer`. Map trust is load-time injection (`work-plan/scripts/map-drift-check.sh`), not a model role.

---

## Extension & Customization

- **Repo Overlays**: If a repo has its own `.claude/skills/*loop*` or `*plan*` skill, it overrides `work-loop` or `work-plan`.
- **Agent Shadowing**: Placing a custom agent in `.claude/agents/coder.md` or `reviewer.md` extends the global role contract with stack-specific rules.
- **Project Bindings**: Test commands, commit formats, and non-negotiables are discovered from `CLAUDE.md`.
