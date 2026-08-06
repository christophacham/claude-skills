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
claude-skills install [--project <dir>] [--skip-deps]
claude-skills uninstall [--yes]
claude-skills --help
```

No subcommand defaults to `install`. The CLI is intentionally interactive; it
does **not** currently implement `--all`, `--group`, `--dry-run`, project
uninstall, target-root selection, or `.agents/` installation. Do not put those
flags in skill instructions unless the implementation changes in the same task.

`--project` accepts an absolute path or a path relative to the invocation working
directory. The package root is used only as the copy source; project output is
never resolved relative to the installed package.

## Selection and placement

`lib/catalog.js` is the selectable inventory (SLIM groups):

1. **SEARCH** — offered for global install under `~/.claude/skills` (default-yes multiselect).
2. **AUTHOR** — `skill-creator` suggested for the chosen project's `.claude/skills`.
3. **CORE** — `operating-mode`, `peek-repo`, `simple-design`, `refactoring` (confirm default-yes; multiselect all selected; global or project placement).
4. **OPT_IN + BEADS** — architecture, distributed, geometric, beads — one by one as skip (default) / global / project / done.
5. Skills that declare agent/pool coupling in the catalog install those related
   resources through the shared filesystem operations.

`lib/paths.js` is the placement authority:

- global Claude root: `~/.claude`;
- project Claude root: `<resolved-project>/.claude`;
- skill/agent/pool destinations are derived from that root.

There is no automatic mirror to `~/.agents` or `.agents` in this Node flow.
Portable-client distribution must be a separately designed feature with tests.

## Manifest and uninstall ownership

The Node installer records only global items it installed in
`~/.claude/claude-skills-manifest.json`. `lib/uninstall-flow.js` removes only
those recorded global skills/agents/panelists/pool entries, then clears the
manifest.

It deliberately leaves these untouched:

- project `.claude` installs;
- API keys in `~/.claude/settings.json`;
- installed npm/Python/uv dependencies; and
- files placed only by `install.sh` or `install.ps1`.

The shell/PowerShell bulk installers have matching bulk uninstallers and are a
separate ownership path. Do not make the Node uninstaller infer ownership by
scanning arbitrary directories.

## Change map

Inspect all owners before editing behavior:

| Concern | Source |
|---|---|
| CLI arguments/help/default command | `bin/cli.js` |
| Selectable skills and coupled resources | `lib/catalog.js` |
| Interactive install sequence | `lib/install-flow.js` |
| Tracked global uninstall | `lib/uninstall-flow.js` |
| Global/project destination paths | `lib/paths.js` |
| Copy/remove behavior | `lib/fs-ops.js` |
| Dependency setup | `lib/deps.js` |
| Manifest schema/merge | `lib/manifest.js` |
| API-key presence/storage | `lib/settings.js` |
| Published files/runtime/dependencies | `package.json` |

Keep help text, SKILL guidance, README, tests, and implementation synchronized.
Install and uninstall must share ownership data; duplicated hand-maintained lists
will drift.

## Verification

At minimum:

```bash
node bin/cli.js --help
npm pack --dry-run
```

For flow changes, use isolated temporary HOME/project directories and verify:

- absolute and relative `--project` resolution;
- selected items land only in the intended `.claude` root;
- global manifest entries are deduplicated and sorted;
- uninstall removes recorded global items only;
- project files, foreign files, settings keys, and dependencies survive; and
- no credential value appears on stdout/stderr.

If adding non-interactive flags, test them directly with Node before documenting
`npx`; `bunx` success alone does not prove the Node path works.
