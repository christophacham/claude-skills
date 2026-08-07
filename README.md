# claude-skills

Software engineering skills and custom agents for Claude Code: architecture, simple design, testing, refactoring, search helpers, plus a subagent roster (coder, reviewer, beads, design panelists) you dispatch from the main agent.

---

## Quick Start & Installation

Node CLI only. Full-screen **plan-then-apply** wizard (Ink TUI, like ccstatusline — redraws in place). **Project scope by default** — not global.

> **Note:** The unscoped npm name `claude-skills` is a *different* package. Install **this** suite from GitHub (or a clone), not `npx claude-skills@latest`.

### Quick start (no clone)

```sh
# from any project directory — runs the interactive wizard
npx -y github:christophacham/claude-skills
```

Same idea with Bun:

```sh
bunx github:christophacham/claude-skills
```

### From a clone

```sh
git clone https://github.com/christophacham/claude-skills.git
cd claude-skills
npm install
node bin/cli.js
# or: node bin/cli.js --project /path/to/app
# or: npm run wizard
```

No subcommand opens the full-screen wizard. Compat aliases: `wizard`, `install` (same UI). Options: `-p/--project <dir>`, `--skip-deps`, `--clack` (scrolling Clack UI), `--legacy` (old linear ladder), `-y/--yes` (uninstall only).

### What the wizard does

Defaults on a fresh project (nothing installed yet):

| Knob | Default |
|------|---------|
| Scope | **project** (`cwd` or `--project`) |
| Skill target | `.claude/skills` only |
| Selection seed | **CORE + AUTHOR + SEARCH** (cart only — not on disk until Apply) |
| Beads / Opt-in | off until you select them |

If the active scope already has suite skills on disk, selection seeds from the scan instead.

**Main menu** (labels match the live wizard):

1. **Browse & select skills** — groups: Search · Core · Author · Beads · Opt-in · Specialist; optional filter; toggle is a cart, not an install
2. **Scope: project \| global** — project = `<root>/.claude/skills`; global = `~/.claude/skills`
3. **Targets** — `.claude/skills` always primary; optional `.agents/skills` portable mirror (symlink → copy fallback)
4. **Status detail** — selected (●) vs on-disk; pending `+install` / `−remove`; paths that would change
5. **Apply changes** — sole write path; confirms with file side-effect list for the active scope/targets
6. **API keys** — Brave / Tavily into `~/.claude/settings.json` only
7. **Manage installation** — resync from disk · select defaults (CORE+AUTHOR+SEARCH) · clear selection · uninstall tracked GLOBAL items
8. **Exit** — confirms if cart still has pending changes, then discards

### Where files land

| What | Project scope | Global scope |
|------|---------------|--------------|
| Skills (primary) | `<project>/.claude/skills/<id>` | `~/.claude/skills/<id>` |
| Skills (optional mirror) | `<project>/.agents/skills/<id>` | `~/.agents/skills/<id>` |
| Agent roster (when **beads** selected) | `<project>/.claude/agents/` | `~/.claude/agents/` |
| Optional `pool.md` (with beads) | `<project>/.claude/pool.md` | `~/.claude/pool.md` |
| API keys (Brave / Tavily) | always `~/.claude/settings.json` (never the project tree) | same |
| Global install manifest | — | `~/.claude/claude-skills-manifest.json` |

Claude skill dirs are a full **copy** from the package. The `.agents/skills` mirror prefers **symlink** to the Claude skill dir, **copy** on failure. Agent files under `.claude/agents` prefer symlink to the package, copy on failure.

### Apply model

Selection is an in-memory **cart**. Nothing is written until **Apply changes**.

- Select skills → **Apply** → installs the pending `+` set for the active scope/targets  
- Deselect skills → **Apply** → removes the pending `−` set (project uninstall)  
- Cancel / Exit with pending changes → cart discarded; disk unchanged  

When you apply skills that need them, the CLI also:

- runs `npm install` in the installed `brave-search` skill (Node 20 or >=22)
- ensures the `ddgs` Python package when Python >=3.10 is available (`ddg-search`)
- ensures the Tavily CLI (`tvly`) when possible (`tavily-search`)
- may prompt for **Brave** / **Tavily** keys into `~/.claude/settings.json` (or set them later via **API keys**). Restart Claude Code after setting keys.

Use `--skip-deps` to skip npm/pip/uv setup on apply.

### Uninstall

| Scope | How |
|-------|-----|
| **Project** | Wizard: deselect skills (or **Manage → Clear selection**) → **Apply**. No project manifest. |
| **Global (tracked)** | Only items recorded in `~/.claude/claude-skills-manifest.json` |

```sh
npx -y github:christophacham/claude-skills uninstall   # confirm, then remove tracked global items
node bin/cli.js uninstall --yes                        # no confirm (from a clone)
# or from Manage installation → Uninstall tracked GLOBAL items
```

Tracked global uninstall does **not** touch project installs, API keys, or npm/Python deps.

---

## Operating mode

We work in **tiny vertical units** on year-scale product work: deep modules, light structure, quality over speed. An agent may write every line; the human rarely codes but **must understand every line that merges**. Hard human stops are **kickoff**, **PR review**, and **defining principles when missing**—not mid-unit micromanagement. After kickoff the main agent runs **hands-off inside one unit** until a feature-branch PR is ready: design ×3 → pick, refactor-then-integrate, live Rust watch/tests and/or Playwright as soon as UI exists, early SoC/errors/traces/unknowns. It may dispatch `coder` / `reviewer` / panelists **without asking**. It asks only on blockers or missing project law (then helps define that law). Unit size guidance ~200–300 LOC production (one idea). Oneshot multi-feature work and unattended multi-unit loops are out; **Ralf-style iteration inside one unit until PR is in**.

Spine: Beck (small steps + feedback), Fowler (tidy/refactor), Ousterhout (deep modules), Hohpe (architecture that reaches working code). CI is the hard gate (lefthook/mise-class checks, strict Rust); UI confidence is Playwright. There is **no** grill→tickets product pipeline—main is the kernel; subagents are optional tools for the current unit. The main agent loads this cadence via **`operating-mode`** (CORE).

Default: you kick off one unit → agent runs to PR (assuming repo principles) → you review for understanding → merge only when you understand and gates are green → optional prototype → next unit.

```
YOU: kick off ONE unit
        │
        ▼
MAIN (hands-off until PR)
  principles clear? ──no──► propose → agree → write down → continue
        │
  design ×3 → pick → refactor existing → integrate
  live Rust / Playwright + errors · traces · SoC · unknowns
  may dispatch coder / reviewer / panelists (no ask)
  open/update feature-branch PR
        │
        ▼
YOU: review PR (understand / change / reject)
        │
        ▼
merge only if understood + green
  → optional prototype → next ONE unit
```

### Core doctrine (judgment libraries)

- **Deep modules, small surfaces** — Maximize benefit per unit of interface cost when the boundary is earned (`simple-design`).
- **Live how-you-know** — Run the checks relevant to the surface under change (Rust watch/tests; Playwright for UI), not a final oneshot hope.
- **Tidy First** — Separate structural and behavioral changes when doing so improves reviewability (`refactoring`).
- **Independent review** — Review from a fresh context and require evidence-based findings. Same-model review remains valid; a different model tier is an optional source of diversity.
- **Ceremony follows irreversibility** — Ports, ADRs, and sagas only when earned (`architecture-design`, `distributed-architecture`).

Optional: Beads (`bd`) for issue tracking; design panelists for multi-lens design when the parent wants them. The general `coder` and `reviewer` do not mutate trackers.

---

## Bundled Skills

Catalog groups (selective Node installer): **SEARCH** · **CORE** (default-yes) · **AUTHOR** · **BEADS** · **OPT_IN** · **SPECIALIST** (last two: offer, never default-yes).

### SEARCH
- **`ddg-search`**: Free web/news search via `ddgs` (no API key). Always forks into an Explore subagent.
- **`brave-search`**: Brave Search API (`BRAVE_API_KEY`). Always forks like `ddg-search`.
- **`tavily-search`**: Tavily CLI (`TAVILY_API_KEY`). Search/extract; forked Explore worker.

### CORE (default-yes)
- **`operating-mode`**: Hands-off one-unit run to PR; design×3; live gates; main may dispatch subagents; human reviews at PR.
- **`peek-repo`**: Third-party GitHub source under `~/code/tmp/<name>` (or `%USERPROFILE%\code\tmp\<name>`) for answers from real code.
- **`simple-design`**: Ousterhout deep modules, information hiding, red flags.
- **`refactoring`**: Fowler smells and safe structural steps.

### AUTHOR (project path)
- **`skill-creator`**: Create, validate, evaluate, and package Agent Skills; audit Claude Code load-time shell injection.

### BEADS (profile — only when chosen)
- **`beads`**: Issue creation, claiming, status updates, dependency graphing, and Dolt sync via `bd` (also installs agents + optional `pool.md`).

### OPT_IN (offer, never default-yes)
- **`architecture-design`**: Clean Architecture layering, ports & adapters.
- **`distributed-architecture`**: Trade-offs across deployables — granularity, monolith decomposition, data, sagas, contracts.
- **`geometric-robustness`**: Float/geometry robustness for slicers and CAD/CAM (Rust).

### SPECIALIST (load on demand — never default-yes)
Narrow, task-specific skills. Install only when you need that specialty (wizard group **Specialist**).

- **`ink-cli-tui`**: Full-screen React+Ink wizards for `npx`/`bunx`/`github:` CLIs (ccstatusline-style plan-then-apply TUI).

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
