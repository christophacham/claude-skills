# CLAUDE.md — claude-skills

Agent-facing map of this repository. For humans, prefer `README.md`. Catalog law and long-horizon intent: `SLIM.md`. Installer internals: `docs/node-native-installer-pattern.md`.

---

## Hard no-gos (do not violate)

### Search-related skills — **DO NOT TOUCH**

Do **not** edit, merge, rename, delete, move, “improve,” refactor, unify, re-catalog, or redesign any search-related skill. Do **not** plan or propose changes to them.

**In scope of this ban (active suite):**

- `skills/ddg-search/`
- `skills/brave-search/`
- `skills/tavily-search/`
- any future skill whose job is web/news search or page extract under those IDs
- install/catalog/deps/tests **only insofar as changing them would alter search-skill behavior, layout, IDs, or backends**

**Also off-limits without explicit user override:** inventing a merged `web-search` (or similar) that replaces the three; changing backend selection; rewriting their `SKILL.md`, scripts, or report contracts.

If a task would require touching search skills to “complete” a broader slim/refactor, **stop**, leave search skills unchanged, and do the rest of the work around them. Mention the skip; do not “just this once.”

Other skills, agents, installers (non-search paths), docs, and tests remain fair game unless the user says otherwise.

---

## What this repo is

**claude-skills** is a **Claude Code skill + agent suite** plus a **selective Node installer**.

| Layer | Role |
|-------|------|
| **Skills** (`skills/`) | Judgment libraries and operational skills Claude loads by trigger |
| **Agents** (`agents/`) | Dispatchable subagents (coder, reviewer, design panelists) |
| **Installer** (`bin/`, `lib/`) | Full-screen Ink TUI: pick skills → plan → apply (project-default) |
| **Docs** | `README.md` (users), `SLIM.md` (suite shape), `docs/01-handbook-operating-mode.md` (OM walkthrough), `docs/node-native-installer-pattern.md` (installer) |

**Not:** a product app, a personal CLI zoo, or a bulk “install everything by default” distribution.

**GitHub:** `https://github.com/christophacham/claude-skills`  
**Run installer (no clone):** `npx -y github:christophacham/claude-skills` or `bunx github:christophacham/claude-skills`  
**Do not use** `npx claude-skills@latest` — unscoped npm name is a **different** package.

Bulk `install.sh` / `install.ps1` are **gone**. Node CLI only.

---

## Layout (where things live)

```text
bin/cli.js                 # entry: default → full-screen wizard
lib/
  catalog.js               # SKILL_GROUPS + defaults (catalog law)
  desired.js / scan.js / apply.js   # pure plan-then-apply core
  paths.js / fs-ops.js / deps.js / manifest.js / settings.js
  tui/                     # Ink full-screen UI (App, List, MultiCheck, …)
  wizard.js                # → TUI by default
  wizard-clack.js          # --clack fallback
  install-flow-legacy.js   # --legacy linear ladder
skills/<id>/SKILL.md       # skill payloads
agents/*.md + panelists/   # custom agents
pool.md                    # optional routing note (with beads)
tests/                     # Python suite contracts + Node installer tests
personal-skill-archive/    # NOT managed suite — do not re-catalog into install
docs/                      # OM handbook + installer pattern essay```

---

## Catalog groups (`lib/catalog.js`)

| Group | Default in cart? | Contents (approx.) |
|-------|------------------|--------------------|
| **SEARCH** | yes | `ddg-search`, `brave-search`, `tavily-search` (**bodies frozen** — see ban) |
| **CORE** | yes | `operating-mode`, `beads-om`, `capability-plan`, `simple-design`, `refactoring` |
| **AUTHOR** | yes | `skill-creator` |
| **BEADS** | no | `beads` (full tracker skill only) |
| **OPT_IN** | no | `architecture-design`, `distributed-architecture`, `geometric-robustness` |
| **SPECIALIST** | no | load-on-demand niches, e.g. `ink-cli-tui` |

Fresh project with nothing on disk: cart seeds **CORE + AUTHOR + SEARCH**. Nothing hits disk until **Apply**.  
Adding a skill: `skills/<id>/` + entry in the right group in `lib/catalog.js` + README/docs/tests as needed.

---

## Installer (how distribution works)

- **Default UI:** full-screen **Ink** TUI (clear screen, sticky plan header, redraw in place) — not a scrolling Clack log.
- **Menu order (workflow):** Scope → Targets → Browse → Status → Apply · | · API keys · Manage · | · Exit.
- **Defaults:** scope **project**; target **`.claude/skills`** only; optional **`.agents/skills`** mirror (symlink → copy).
- **Plan-then-apply:** selection is a cart; Apply is the sole mutator for skills/agents/pool/manifest.
- **Cross-scope guard:** same skill **name** already in the other scope (project ↔ global) → **install blocked** with clear warnings; removes in the active scope still work.
- **Keys:** Brave/Tavily only in `~/.claude/settings.json` (never project tree).
- **Global uninstall:** tracked only via `~/.claude/claude-skills-manifest.json` (`uninstall` / Manage).
- **Project uninstall:** deselect → Apply (no project manifest).
- Fallbacks: `--clack`, `--legacy`. Deps skip: `--skip-deps`.

Pure core tests (no TTY): `npm run test:installer` / `node --test tests/test_installer_core.mjs`.  
Pattern reference skill: **`ink-cli-tui`** (SPECIALIST) — how we build this class of TUI.

---

## How we work **in this repo** (suite maintenance)

This is how agents should change **claude-skills itself** (installer, catalog, non-search skills, docs, tests):

1. **Feature branch** off `main` — e.g. `fix/…`, `feat/…`. Do not pile unrelated work on `main` without a PR when the change is non-trivial.
2. **One unit / one PR** — small vertical slice; no multi-feature oneshots.
3. **Implement + tests** — installer pure core via Node test; suite contracts via `python -m unittest` under `tests/` when catalog/agents/docs contracts move.
4. **Push + open PR** with `gh` (`gh pr create`). Prefer merge via **PR**, not silent force-push to main.
5. **Mira (self-hosted reviewer)** often comments — **read findings**, fix real bugs, reply on threads, resolve when done, then **merge** (`gh pr merge`).
6. **Search ban always wins** over “finish the refactor.”
7. After merge: sync local `main` (`git checkout main && git pull`).

Cadence echoes product **operating-mode** (kickoff → hands-off unit → PR → human understand/merge) adapted to a **skills/installer** codebase: Node/Ink/tests instead of Rust/Playwright unless a consuming app is the subject.

---

## Product work cadence (consuming apps)

When doing or planning product implementation **in a consuming app** (or when the user asks how we work on product), follow skill **`operating-mode`** and README **Operating mode**:

- Human: **kickoff**, **PR review**, **principles when missing**.
- Agent: hands-off **one unit** to a feature-branch PR; design×3; refactor-then-integrate; live gates (Rust/Playwright where that app uses them); ask only on blockers or missing law.
- Main may dispatch role agents / panelists without asking when that app has them installed.
- No multi-unit unattended loops.

---

## Agents (OM roster)

| Agent | Role |
|-------|------|
| `coder` | One-unit implementer (live gates, unit health; no tracker) |
| `reviewer` | Independent read-only unit/PR audit |
| `scope-scout` | Feasibility/research for capability-plan (no Beads writes) |
| `scope-auditor` | Plan verify / progress (read-only) |
| `panelists/deep-module`, `minimal-diff`, `seam` | Design×3 lenses (one unit) |

Roster installs when **operating-mode**, **capability-plan**, or design preloads are applied. Optional `pool.md` with operating-mode. Coder/reviewer preload **simple-design** + **refactoring**. No beads tracker agents.

---

## Tests & checks (this repo)

```sh
npm install
npm run test:installer          # Node installer core
node bin/cli.js --help
python -m unittest discover -s tests -v   # suite contracts (when relevant)
```

Do not invent CI requirements that are not in-repo; keep help/README/catalog/tests synchronized when installer behavior changes.

---

## Quick pointers

| Need | Go to |
|------|--------|
| User install / menu / groups | `README.md` |
| Suite slim / inventory law | `SLIM.md` |
| Installer module map | `docs/node-native-installer-pattern.md` |
| Catalog IDs / groups | `lib/catalog.js` |
| TUI | `lib/tui/` |
| Build another Ink wizard | skill `ink-cli-tui` |
| Product cadence skill | `operating-mode` |
| OM handbook (human when/how/what) | `docs/01-handbook-operating-mode.md` |
| Epic→feature→task map | `capability-plan` (+ `scope-scout` / `scope-auditor`) |
| Beads + OM (thin) | `beads-om` (CORE; no roster) || Full Beads skill | `beads` (BEADS group; skill only) |
| Search skills | **leave alone** |
