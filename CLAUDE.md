# CLAUDE.md — claude-skills

Agent-facing map of this repository. For humans, prefer `README.md`. Installer internals: `docs/node-native-installer-pattern.md`.

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

Other skills, installers (non-search paths), docs, and tests remain fair game unless the user says otherwise.

---

## What this repo is

**claude-skills** is a **Claude Code skill suite** plus a **selective Node installer**.

| Layer | Role |
|-------|------|
| **Skills** (`skills/`) | Judgment libraries and operational skills Claude loads by trigger |
| **Installer** (`bin/`, `lib/`) | Full-screen Ink TUI: pick skills → plan → apply (project-default) |
| **Docs** | `README.md` (users), `docs/node-native-installer-pattern.md` (installer) |

**Not:** a product app, an agent roster distribution, or a bulk “install everything by default” package.

**GitHub:** `https://github.com/christophacham/claude-skills`  
**Run installer (no clone):** `npx -y github:christophacham/claude-skills#main` or `bunx github:christophacham/claude-skills#main` (pin `#main` so bunx/npx do not reuse a stale github: cache)  
**Do not use** `npx claude-skills@latest` — unscoped npm name is a **different** package; `@latest` is not the lever for this GitHub install.

Bulk `install.sh` / `install.ps1` are **gone**. Node CLI only.

**No custom agents ship with this suite.** Skills only.

---

## Layout (where things live)

```text
bin/cli.js                 # entry: default → full-screen wizard
lib/
  catalog.js               # SKILL_GROUPS + defaults
  desired.js / scan.js / apply.js   # pure plan-then-apply core
  paths.js / fs-ops.js / deps.js / manifest.js / settings.js
  tui/                     # Ink full-screen UI
  wizard.js                # → TUI by default
  wizard-clack.js          # --clack fallback
  install-flow-legacy.js   # --legacy linear ladder
skills/<id>/SKILL.md       # skill payloads
tools/validate_skill.py    # optional skill frontmatter validator (dev/tests)
tests/                     # Python suite contracts + Node installer tests
personal-skill-archive/    # NOT managed suite — do not re-catalog into install
docs/                      # installer pattern essay
```

---

## Catalog groups (`lib/catalog.js`)

| Group | Default in cart? | Contents |
|-------|------------------|----------|
| **SEARCH** | yes | `ddg-search`, `brave-search`, `tavily-search` (**bodies frozen** — see ban) |
| **CORE** | yes | `simple-design`, `refactoring` |
| **OPT_IN** | no | `architecture-design`, `distributed-architecture`, `geometric-robustness` |
| **SECURITY** | no | `defectdojo-fix` |
| **SPECIALIST** | no | `ink-cli-tui` |

Fresh project with nothing on disk: cart seeds **CORE + SEARCH**. Nothing hits disk until **Apply**.  
Adding a skill: `skills/<id>/` + entry in the right group in `lib/catalog.js` + README/docs/tests as needed.

---

## Installer (how distribution works)

- **Default UI:** full-screen **Ink** TUI (clear screen, sticky plan header, redraw in place) — not a scrolling Clack log.
- **Menu order (workflow):** Scope → Targets → Browse → Status → Apply · | · API keys · Manage · | · Exit.
- **Defaults:** scope **project**; target **`.claude/skills`** only; optional **`.agents/skills`** mirror (symlink → copy).
- **Plan-then-apply:** selection is a cart; Apply is the sole mutator for skills/manifest.
- **Cross-scope guard:** same skill **name** already in the other scope (project ↔ global) → **install blocked** with clear warnings; removes in the active scope still work.
- **Keys:** Brave/Tavily only in `~/.claude/settings.json` (never project tree).
- **Global uninstall:** tracked only via `~/.claude/claude-skills-manifest.json` (`uninstall` / Manage).
- **Project uninstall:** deselect → Apply (no project manifest).
- Fallbacks: `--clack`, `--legacy`. Deps skip: `--skip-deps`.

Pure core tests (no TTY): `npm run test:installer` / `node --test tests/test_installer_core.mjs`.  
Pattern reference skill: **`ink-cli-tui`** (SPECIALIST) — how we build this class of TUI.

---

## How we work **in this repo** (suite maintenance)

1. **Feature branch** off `main` — e.g. `fix/…`, `feat/…`. Do not pile unrelated work on `main` without a PR when the change is non-trivial.
2. **One unit / one PR** — small vertical slice; no multi-feature oneshots.
3. **Implement + tests** — installer pure core via Node test; suite contracts via `python -m unittest` under `tests/` when catalog/docs contracts move.
4. **Push + open PR** with `gh` (`gh pr create`). Prefer merge via **PR**, not silent force-push to main.
5. **Search ban always wins** over “finish the refactor.”
6. After merge: sync local `main` (`git checkout main && git pull`).

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
| Installer module map | `docs/node-native-installer-pattern.md` |
| Catalog IDs / groups | `lib/catalog.js` |
| TUI | `lib/tui/` |
| Build another Ink wizard | skill `ink-cli-tui` |
| Search skills | **leave alone** |
