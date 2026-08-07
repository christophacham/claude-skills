# claude-skills

Selective Claude Code skills: search helpers, simple design, refactoring, architecture craft, DefectDojo ops, and Ink TUI craft — plus a plan-then-apply Node installer.

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
| Selection seed | **CORE + SEARCH** (cart only — not on disk until Apply) |
| Opt-in / Security / Specialist | off until you select them |

If the active scope already has suite skills on disk, selection seeds from the scan instead.

**Main menu** (workflow order — place → pick → review → write):

1. **Scope: project \| global** — project = `<root>/.claude/skills`; global = `~/.claude/skills`
2. **Targets** — `.claude/skills` always primary; optional `.agents/skills` portable mirror (symlink → copy fallback)
3. **Browse & select skills** — groups: Search · Core · Opt-in · Security · Specialist; optional filter; toggle is a cart, not an install
4. **Status detail** — selected (●) vs on-disk; pending `+install` / `−remove`; paths that would change
5. **Apply changes** — sole write path; confirms with file side-effect list for the active scope/targets  
   —  
6. **API keys** — Brave / Tavily into `~/.claude/settings.json` only
7. **Manage installation** — resync from disk · select defaults (CORE+SEARCH) · clear selection · uninstall tracked GLOBAL items  
   —  
8. **Exit** — confirms if cart still has pending changes, then discards

### Where files land

| What | Project scope | Global scope |
|------|---------------|--------------|
| Skills (primary) | `<project>/.claude/skills/<id>` | `~/.claude/skills/<id>` |
| Skills (optional mirror) | `<project>/.agents/skills/<id>` | `~/.agents/skills/<id>` |
| API keys (Brave / Tavily) | always `~/.claude/settings.json` (never the project tree) | same |
| Global install manifest | — | `~/.claude/claude-skills-manifest.json` |

Claude skill dirs are a full **copy** from the package. The `.agents/skills` mirror prefers **symlink** to the Claude skill dir, **copy** on failure. This suite does **not** ship custom agent files.

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

## Bundled Skills

Catalog groups (selective Node installer): **SEARCH** · **CORE** (default-yes) · **OPT_IN** · **SECURITY** · **SPECIALIST** (OPT_IN + SECURITY + SPECIALIST: offer, never default-yes).

### SEARCH
- **`ddg-search`**: Free web/news search via `ddgs` (no API key). Always forks into an Explore subagent.
- **`brave-search`**: Brave Search API (`BRAVE_API_KEY`). Always forks like `ddg-search`.
- **`tavily-search`**: Tavily CLI (`TAVILY_API_KEY`). Search/extract; forked Explore worker.

### CORE (default-yes)
- **`simple-design`**: Ousterhout deep modules, information hiding, red flags.
- **`refactoring`**: Fowler smells and safe structural steps.

### OPT_IN (offer, never default-yes)
- **`architecture-design`**: Clean Architecture layering, ports & adapters.
- **`distributed-architecture`**: Trade-offs across deployables — granularity, monolith decomposition, data, sagas, contracts.
- **`geometric-robustness`**: Float/geometry robustness for slicers and CAD/CAM (Rust).

### SECURITY (offer, never default-yes)
Vuln-tracker integrations. Need host credentials (env / settings / credentials file); not a substitute for PR security review.

- **`defectdojo-fix`**: Pull active findings from self-hosted DefectDojo, triage, and fix what is safely fixable in the current repo (any severity). Needs `DEFECTDOJO_API_TOKEN` and `DEFECTDOJO_URL` (or `DEFECTDOJO_HOST` + `DEFECTDOJO_PORT`).

### SPECIALIST (load on demand — never default-yes)
Narrow, task-specific skills. Install only when you need that specialty (wizard group **Specialist**).

- **`ink-cli-tui`**: Full-screen React+Ink wizards for `npx`/`bunx`/`github:` CLIs (ccstatusline-style plan-then-apply TUI).

---

## Extension & Customization

- **Project bindings**: test commands, commit formats, and non-negotiables from `CLAUDE.md` in the consuming app.
- **Add a skill**: drop `skills/<id>/SKILL.md`, register it in `lib/catalog.js`, update README and installer tests.
