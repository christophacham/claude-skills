# claude-skills

Software engineering skills and custom agents for Claude Code: architecture, simple design, testing, refactoring, search helpers, plus a subagent roster (coder, reviewer, beads, design panelists) you dispatch from the main agent.

---

## Quick Start & Installation

Menu-driven wizard (Clack UI) — **project scope by default**, not global.
Pick skills by group, see what’s on disk, apply a pending plan.

```sh
# from npm (once published) or a clone
npx -y claude-skills@latest
# or: bunx claude-skills
# or: npm install && node bin/cli.js
# or: node bin/cli.js --project /path/to/app
```

**Main menu**

1. **Browse & select skills** — groups: Search · Core · Author · Beads · Opt-in  
2. **Scope** — Project (default, `<cwd>/.claude/skills`) or Global (`~/.claude/skills`)  
3. **Targets** — `.claude/skills` always; optional `.agents/skills` mirror (symlink → copy fallback)  
4. **Status** — selected (●) vs on-disk; pending +install / −remove  
5. **Apply changes** — installs/removes the diff for the active scope/targets  
6. **API keys** — Brave / Tavily into `~/.claude/settings.json` only  
7. **Manage** — resync selection from disk, seed defaults, clear selection, tracked global uninstall  
8. **Exit**

Defaults when the project has nothing installed yet: **CORE + AUTHOR + SEARCH** selected (not applied until you hit Apply). Beads / Opt-in stay off until you opt in.

`beads` still pulls the agent roster into `.claude/agents` (+ optional `pool.md`); agent files prefer symlink to the package, copy on failure.

Install also (when you apply skills that need them):
- runs `npm install` in the installed `brave-search` skill (Node 20 or >=22)
- ensures the `ddgs` Python package when Python >=3.10 is available (`ddg-search`)
- ensures the Tavily CLI (`tvly`) when possible (`tavily-search`)
- can write **Brave** / **Tavily** API keys into `~/.claude/settings.json` via the API keys menu (never into the project tree). Restart Claude Code after setting keys.

Global installs from this CLI are recorded in `~/.claude/claude-skills-manifest.json`.

```sh
node bin/cli.js uninstall        # removes only those tracked global items
node bin/cli.js uninstall --yes  # no confirm
node bin/cli.js install --legacy # old linear confirm ladder (compat)
```

Project installs are removed via the wizard (deselect + Apply), not by the tracked global uninstall.

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

Catalog groups (selective Node installer): **SEARCH** · **CORE** (default-yes) · **AUTHOR** · **BEADS** · **OPT_IN** (offer, never default-yes).

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
