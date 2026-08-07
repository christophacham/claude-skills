# Node-native installer — this repository's pattern

Use this reference when changing the package installer in this repository. It is
a description of the current implementation, not a wishlist for a generic skill
package.

## Package contract

`package.json` exposes `claude-skills` from `bin/cli.js`, requires Node
`>=20.11.0`, and ships complete `bin/`, `lib/`, `skills/`, and `agents/` trees
plus `pool.md` and README. The entrypoint has a Node shebang and no Bun runtime
dependency, so both `npx` and `bunx` can launch it.

Because the whole `skills/` tree is packaged, adding an eval/reference/script
under an already-shipped skill does not require another `package.json.files`
entry. Adding a selectable skill still requires a catalog entry and matching
README examples/catalog text.

## Current CLI

```text
claude-skills                      # wizard (default)
claude-skills wizard
claude-skills install              # alias of wizard
claude-skills install --legacy     # old linear flow
claude-skills uninstall [--yes]
claude-skills --help
```

Options: `-p/--project <dir>`, `--skip-deps`, `--legacy`, `-y/--yes`.

No subcommand opens the **menu wizard**. The linear confirm ladder remains only
behind `--legacy`.

## Wizard model (plan-then-apply)

```
installed  = scanAllInstalled(projectRoot)   // catalog ids on disk
desired    = DesiredState                    // in-memory selection + scope + trees
plan       = planChanges(desired, installed) // pure delta
apply      = applyPlan(plan, desired)        // sole mutator
```

### Defaults

| Knob | Default |
|---|---|
| Scope | **project** (`--project` or cwd) |
| Skill trees | `['claude']` only |
| Agents tree | off until toggled under Targets |
| Claude install | full **copy** from package `skills/<id>` |
| Agents install | **symlink/junction** to Claude skill dir → **copy** fallback |
| Agent roster / pool | under `.claude/agents` + `pool.md` when beads selected |
| API keys | always `~/.claude/settings.json` |
| Deps | run against **claude** skill path only |

### Groups (`lib/catalog.js` → `SKILL_GROUPS`)

1. **SEARCH** — default-selected in a fresh cart  
2. **CORE** — default-selected  
3. **AUTHOR** — default-selected (skill-creator)  
4. **BEADS** — offer only  
5. **OPT_IN** — offer only (broad domain craft)  
6. **SPECIALIST** — offer only (narrow load-on-demand; e.g. `ink-cli-tui`)  

Fresh project with nothing installed: seed selected = `defaultSelectedSkillIds()`.
If the active scope already has suite skills on disk: seed selected from scan.

### Main menu

Browse groups · Scope · Targets · Status · Apply · API keys · Manage · Exit.

Apply is the only path that writes skills/agents/pool/manifest for the wizard.
Cancel discards the in-memory cart (no partial mid-menu writes).

## Placement

`lib/paths.js` is the placement authority:

- Claude tree: `~/.claude` or `<project>/.claude`  
- Agents skill tree: `~/.agents` or `<project>/.agents`  
- Skill dirs: `<tree-root>/skills/<id>`  
- Custom agents (coder/reviewer/…): always under Claude tree `.claude/agents`  

## Manifest and uninstall ownership

The Node installer records only **global** items it installed in
`~/.claude/claude-skills-manifest.json`. `lib/uninstall-flow.js` removes only
those recorded global skills/agents/panelists/pool entries, then clears the
manifest.

There is **no project manifest**. Project uninstall is “deselect + Apply” in the
wizard for the active project scope/targets.

Left alone by smart global uninstall:

- project `.claude` / `.agents` installs  
- API keys in `~/.claude/settings.json`  
- npm/Python/uv dependencies  

## Module map

| Concern | Source |
|---|---|
| CLI arguments/help/default command | `bin/cli.js` |
| Selectable skills and groups | `lib/catalog.js` |
| Menu wizard | `lib/wizard.js` |
| Desired state + pure plan | `lib/desired.js` |
| Disk scan of installed skills | `lib/scan.js` |
| Apply plan (sole mutator) | `lib/apply.js` |
| Legacy linear flow | `lib/install-flow-legacy.js` |
| Compat `runInstallFlow` → wizard | `lib/install-flow.js` |
| Tracked global uninstall | `lib/uninstall-flow.js` |
| Dual-tree destinations | `lib/paths.js` |
| Copy / symlink / remove | `lib/fs-ops.js` |
| Dependency setup | `lib/deps.js` |
| Manifest schema/merge | `lib/manifest.js` |
| API-key presence/storage | `lib/settings.js` |
| Unit tests (no TTY) | `tests/test_installer_core.mjs` |

## Verification

```bash
node bin/cli.js --help
npm run test:installer
npm pack --dry-run
```

For flow changes, use isolated temporary HOME/project directories and verify:

- absolute and relative `--project` resolution  
- selected items land only in the intended roots  
- agents tree is symlink (or copy fallback) to claude tree  
- global manifest entries are deduplicated and sorted  
- uninstall removes recorded global items only  
- project files, foreign files, settings keys, and dependencies survive  
- no credential value appears on stdout/stderr  

If adding non-interactive flags, test them directly with Node before documenting
`npx`; `bunx` success alone does not prove the Node path works.
