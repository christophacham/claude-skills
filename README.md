# claude-skills

Software engineering skills and custom agents for Claude Code: architecture, simple design, refactoring, search helpers, plus an operating-mode subagent roster (coder, reviewer, design panelists) you dispatch from the main agent.

---

## Quick Start & Installation

Node CLI only. Full-screen **plan-then-apply** wizard (Ink TUI, like ccstatusline — redraws in place). **Project scope by default** — not global.

> **Note:** The unscoped npm name `claude-skills` is a *different* package. Install **this** suite from GitHub (or a clone), not `npx claude-skills@latest`.

### Quick start (no clone)

Always pin **`#main`** so bunx/npx resolve the tip of this branch (plain `github:…` often reuses a stale local cache).

```sh
# from any project directory — runs the interactive wizard
npx -y github:christophacham/claude-skills#main
```

Same idea with Bun:

```sh
bunx github:christophacham/claude-skills#main
```

If it still looks old after a merge, clear the runner cache and re-run with `#main`:

```sh
# Bun
rm -rf ~/.bun/install/cache ~/.bun/install/git
bunx github:christophacham/claude-skills#main

# npm / npx
npm cache clean --force
npx -y github:christophacham/claude-skills#main
```

Do **not** use `@latest` here — that is npm-registry semantics. This suite is installed from GitHub; the unscoped npm name `claude-skills` is a different package.

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

**Main menu** (workflow order — place → pick → review → write):

1. **Scope: project \| global** — project = `<root>/.claude/skills`; global = `~/.claude/skills`
2. **Targets** — `.claude/skills` always primary; optional `.agents/skills` portable mirror (symlink → copy fallback)
3. **Browse & select skills** — groups: Search · Core · Author · Beads · Opt-in · Specialist; optional filter; toggle is a cart, not an install
4. **Status detail** — selected (●) vs on-disk; pending `+install` / `−remove`; paths that would change
5. **Apply changes** — sole write path; confirms with file side-effect list for the active scope/targets  
   —  
6. **API keys** — Brave / Tavily into `~/.claude/settings.json` only
7. **Manage installation** — resync from disk · select defaults (CORE+AUTHOR+SEARCH) · clear selection · uninstall tracked GLOBAL items  
   —  
8. **Exit** — confirms if cart still has pending changes, then discards

### Where files land

| What | Project scope | Global scope |
|------|---------------|--------------|
| Skills (primary) | `<project>/.claude/skills/<id>` | `~/.claude/skills/<id>` |
| Skills (optional mirror) | `<project>/.agents/skills/<id>` | `~/.agents/skills/<id>` |
| Agent roster (when **operating-mode** / design-preload skills selected) | `<project>/.claude/agents/` | `~/.claude/agents/` |
| Optional `pool.md` (with operating-mode) | `<project>/.claude/pool.md` | `~/.claude/pool.md` |
| API keys (Brave / Tavily) | always `~/.claude/settings.json` (never the project tree) | same |
| Global install manifest | — | `~/.claude/claude-skills-manifest.json` |

Claude skill dirs are a full **copy** from the package. The `.agents/skills` mirror prefers **symlink** to the Claude skill dir, **copy** on failure. Agent files under `.claude/agents` prefer symlink to the package, copy on failure.

### Apply model

Selection is an in-memory **cart**. Nothing is written until **Apply changes**.

- Select skills → **Apply** → installs the pending `+` set for the active scope/targets  
- Deselect skills → **Apply** → removes the pending `−` set (project uninstall)  
- Cancel / Exit with pending changes → cart discarded; disk unchanged  
- **Cross-scope guard:** if the same skill **name** is already installed in the *other* scope (e.g. global while you are in project), install is **blocked** with a clear warning — switch Scope to manage the existing copy, or remove it there first. Removes in the active scope still work.  

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
npx -y github:christophacham/claude-skills#main uninstall   # confirm, then remove tracked global items
node bin/cli.js uninstall --yes                            # no confirm (from a clone)
# or from Manage installation → Uninstall tracked GLOBAL items
```

Tracked global uninstall does **not** touch project installs, API keys, or npm/Python deps.

---

## Operating mode

We work in **tiny vertical units** on year-scale product work: deep modules, light structure, quality over speed. An agent may write every line; the human rarely codes but **must understand every line that merges**. Hard human stops are **kickoff**, **PR review**, and **defining principles when missing**—not mid-unit micromanagement. After kickoff the main agent runs **hands-off inside one unit** until a feature-branch PR is ready: design ×3 → pick, refactor-then-integrate, live Rust watch/tests and/or Playwright as soon as UI exists, early SoC/errors/traces/unknowns. It may dispatch `coder` / `reviewer` / panelists **without asking**. It asks only on blockers or missing project law (then helps define that law). Unit size guidance ~200–300 LOC production (one idea). Oneshot multi-feature work and unattended multi-unit loops are out; **Ralf-style iteration inside one unit until PR is in**.

**In one line:** plan the initiative (what/why) → kick off one unit → main runs hands-off to PR → you understand and merge → repeat.

Handbooks (execution order):

1. **[`docs/01-handbook-product-flow.md`](docs/01-handbook-product-flow.md)** — combined plan + unit flow  
2. **[`docs/02-handbook-capability-plan.md`](docs/02-handbook-capability-plan.md)** — epic → features → OM tasks  
3. **[`docs/03-handbook-operating-mode.md`](docs/03-handbook-operating-mode.md)** — one unit → PR  

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

Optional: **`beads-om`** (CORE) for a thin Beads queue around operating-mode units; full **`beads`** for general tracker ops (skill only). The OM roster (`coder` / `reviewer` / panelists) installs with **operating-mode** (and design preloads). `coder` and `reviewer` do not mutate trackers.

---

## Bundled Skills

Catalog groups (selective Node installer): **SEARCH** · **CORE** (default-yes) · **AUTHOR** · **BEADS** · **OPT_IN** · **SPECIALIST** (last two: offer, never default-yes).

### SEARCH
- **`ddg-search`**: Free web/news search via `ddgs` (no API key). Always forks into an Explore subagent.
- **`brave-search`**: Brave Search API (`BRAVE_API_KEY`). Always forks like `ddg-search`.
- **`tavily-search`**: Tavily CLI (`TAVILY_API_KEY`). Search/extract; forked Explore worker.

### CORE (default-yes)
- **`operating-mode`**: Hands-off one-unit run to PR; design×3; live gates; main may dispatch subagents; human reviews at PR.
- **`beads-om`**: Thin Beads companion to operating-mode (claim unit bead, park discoveries, close post-merge). Skill only; needs `bd` + initialized `.beads/`.
- **`capability-plan`**: Epic → features (what/why) → OM-sized tasks; create/verify/modify/progress. Research stays out of Beads. Agents: `scope-scout`, `scope-auditor`.
- **`simple-design`**: Ousterhout deep modules, information hiding, red flags.
- **`refactoring`**: Fowler smells and safe structural steps.

### AUTHOR (project path)
- **`skill-creator`**: Create, validate, evaluate, and package Agent Skills; audit Claude Code load-time shell injection.

### BEADS (profile — only when chosen)
- **`beads`**: Full `bd` tracker skill (create/claim/deps/Dolt). Does **not** install agents; use `beads-om` for OM-thin usage.

### OPT_IN (offer, never default-yes)
- **`architecture-design`**: Clean Architecture layering, ports & adapters.
- **`distributed-architecture`**: Trade-offs across deployables — granularity, monolith decomposition, data, sagas, contracts.
- **`geometric-robustness`**: Float/geometry robustness for slicers and CAD/CAM (Rust).

### SPECIALIST (load on demand — never default-yes)
Narrow, task-specific skills. Install only when you need that specialty (wizard group **Specialist**).

- **`ink-cli-tui`**: Full-screen React+Ink wizards for `npx`/`bunx`/`github:` CLIs (ccstatusline-style plan-then-apply TUI).

---

## Custom Agents (`agents/`)

Install into `~/.claude/agents` (or project `.claude/agents`) when **operating-mode** (or `simple-design` / `refactoring`) is applied. Dispatch from main under operating-mode — no permission ping for unit work.

| Agent | Role |
|-------|------|
| **`coder`** | One-unit implementer: refactor-then-integrate, live gates, unit health; optional user-authorized commit; no tracker |
| **`reviewer`** | Read-only unit/PR audit → PASS / CHANGES_REQUESTED / REPLAN_RECOMMENDED (includes OM PR bar) |
| **`scope-scout`** | Research/feasibility for capability-plan; what-level split hints; no Beads writes, no how-for-tracker |
| **`scope-auditor`** | Verify plan OM-fit / what-why purity or report epic·feature progress; read-only |
| **`panelists/deep-module`** | Design×3 lens: natural ownership, information hiding, justified module depth (one unit) |
| **`panelists/minimal-diff`** | Design×3 lens: every touch point and structural cost must be earned (one unit) |
| **`panelists/seam`** | Design×3 lens: smallest justified contract that contains demonstrated coupling (one unit) |

Optional **`pool.md`** (global or project `.claude/pool.md`) provides advisory routing preferences for agent model tiers. Agents do not require it, and same-model review remains valid.

---

## Extension & Customization

- **Agent shadowing**: project `.claude/agents/coder.md` (etc.) overrides the global role.
- **Project bindings**: test commands, commit formats, and non-negotiables from `CLAUDE.md`.
