# claude-skills

Software engineering skills and custom agents for Claude Code: architecture, simple design, testing, refactoring, search helpers, plus a subagent roster (coder, reviewer, beads, design panelists) you dispatch from the main agent.

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
3. **Project tools?** → `skill-creator` into the project `.claude/` (authoring + injection audit)
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

- **Deep modules, small surfaces** — Maximize benefit per unit of interface cost when the boundary is earned (`simple-design`).
- **TDD + how-you-know** — Use red→green for changed behavior and run the checks relevant to the affected surface.
- **Tidy First** — Separate structural and behavioral changes when doing so improves reviewability.
- **Independent review** — Review from a fresh context and require evidence-based findings. Same-model review remains valid; a different model tier is an optional source of diversity.
- **Ceremony follows irreversibility** — Ports, ADRs, and sagas only when earned (`architecture-design`, `distributed-architecture`).

Optional: Beads (`bd`) for issue tracking; design panelists for multi-lens design when the parent wants them. The general `coder` and `reviewer` do not mutate trackers.

---

## Bundled Skills

### Search & utilities
- **`peek-repo`**: Third-party GitHub source under `~/code/tmp/<name>` (or `%USERPROFILE%\code\tmp\<name>`) for answers from real code.
- **`ddg-search`**: Free web/news search via `ddgs` (no API key). Always forks into an Explore subagent.
- **`brave-search`**: Brave Search API (`BRAVE_API_KEY`). Always forks like `ddg-search`.
- **`tavily-search`**: Tavily CLI (`TAVILY_API_KEY`). Search/extract; forked Explore worker.
- **`skill-creator`**: Create, validate, evaluate, and package Agent Skills; audit Claude Code load-time shell injection.

### Tracker
- **`beads`**: Issue creation, claiming, status updates, dependency graphing, and Dolt sync via `bd`.

### Software engineering
- **`architecture-design`**: Clean Architecture layering, ports & adapters.
- **`distributed-architecture`**: Trade-offs across deployables — granularity, monolith decomposition, data, sagas, contracts.
- **`simple-design`**: Ousterhout deep modules, information hiding, red flags.
- **`refactoring`**: Fowler smells and safe structural steps.
- **`geometric-robustness`**: Float/geometry robustness for slicers and CAD/CAM (Rust).

---

## Custom Agents (`agents/`)

Install into `~/.claude/agents` (or project `.claude/agents`). Dispatch from the main agent — no work-loop skill required.

| Agent | Role |
|-------|------|
| **`coder`** | Implement a scoped implementation brief using project `CLAUDE.md`, focused changes, and relevant checks; a user-authorized commit is optional |
| **`reviewer`** | Read-only independent audit of a diff, commit, branch, or file set → PASS / CHANGES_REQUESTED / REPLAN_RECOMMENDED |
| **`beads-creator`** | Execute explicitly requested Beads creates, updates, labels, and links; destructive actions and Dolt pushes require user authorization |
| **`beads-reviewer`** | Read-only board hygiene by default; apply only explicitly requested, deterministic repairs |
| **`panelists/deep-module`** | Design lens: natural ownership, information hiding, and justified module depth |
| **`panelists/minimal-diff`** | Design lens: every touch point and structural cost must be earned |
| **`panelists/seam`** | Design lens: smallest justified contract that contains demonstrated coupling |

Optional **`pool.md`** (global or project `.claude/pool.md`) provides advisory routing preferences for agent model tiers. Agents do not require it, and same-model review remains valid.

---

## Extension & Customization

- **Agent shadowing**: project `.claude/agents/coder.md` (etc.) overrides the global role.
- **Project bindings**: test commands, commit formats, and non-negotiables from `CLAUDE.md`.
