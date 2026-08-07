---
name: ink-cli-tui
description: "Build full-screen, in-place terminal wizards for Node/Bun packages shippable via npx/bunx/github: — React+Ink screen FSM, sticky header, List/MultiCheck, plan-then-apply, clear-screen entry (ccstatusline-style). Use when creating or rewriting an interactive CLI installer/configurator, npx -y github:… TUI, Ink menus that must not scroll like Clack logs, or when the user asks for ccstatusline-like UX. Not for web UI, blessed/ncurses without React, non-interactive CLIs, or Claude Code skill authoring (skill-creator)."
---

# Ink CLI TUI (npx / bunx)

Ship a **full-screen, redraw-in-place** interactive CLI for packages people run with:

```sh
npx -y github:owner/repo
# or after npm publish:
npx -y @scope/pkg@latest
bunx github:owner/repo
```

Model after **ccstatusline** (Ink + clear screen + sticky header) and this suite’s installer (`lib/tui/*`).

## Decision rules

- **Default stack:** Node ≥18 ESM + **React 18** + **Ink 5** as **runtime** dependencies (so `npx github:…` installs them). Do not put Ink only in devDependencies unless you **bundle** a single bin (ccstatusline/Bun build).
- **Prefer full-screen Ink** for multi-screen wizards (installers, configurators). Use **Clack** only for short linear confirm ladders.
- **Plan-then-apply:** mutate an in-memory draft (cart/settings); **one** apply path writes disk. Sticky header always shows pending diff.
- **Pure core outside React:** `scan` / `desired` / `plan` / `apply` as plain modules; TUI only calls them. Enables `node --test` without a TTY.
- **Entry:** TTY → clear + `render(<App />)`; non-TTY → clear error (or dual-mode renderer if you also accept stdin JSON — optional).
- **No JSX required** in plain `.js` packages: `h = React.createElement` is fine.

## Workflow

### 1. Package skeleton

```json
{
  "name": "my-tool",
  "type": "module",
  "bin": { "my-tool": "bin/cli.js" },
  "files": ["bin/", "lib/", "README.md"],
  "engines": { "node": ">=20" },
  "dependencies": {
    "ink": "^5.2.0",
    "react": "^18.3.0"
  }
}
```

- `bin/cli.js`: shebang `#!/usr/bin/env node`, parse args, default command opens TUI.
- GitHub install: `npx -y github:owner/repo` (works without npm publish; unscoped names may already be taken on npm).
- Optional later: scoped npm `@owner/my-tool` + `"publishConfig": { "access": "public" }`.

### 2. Clear-screen entry (ccstatusline pattern)

```js
// lib/tui/run.js
import { render } from 'ink';
import { createElement as h } from 'react';
import { App } from './App.js';

export async function runTUI(opts = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Needs an interactive TTY.');
    process.exit(1);
  }
  process.stdout.write('\x1b[2J\x1b[H'); // clear + cursor home
  const instance = render(h(App, opts), { exitOnCtrlC: false });
  await instance.waitUntilExit();
}
```

Clack’s `intro`/`note`/`select` **scrolls** a log — that is *not* this UX.

### 3. Screen FSM + sticky chrome

```text
screen: 'main' | 'browse' | 'apply' | 'manage' | …
header: always re-rendered from draft + disk plan
body:   only the active screen component
```

- `useApp().exit` for clean shutdown; handle **Ctrl+C** in `useInput` if `exitOnCtrlC: false`.
- **ESC** = back to parent screen (explicit `setScreen(parent)`), not process exit.
- Optional: remember list cursor per screen (`menuSelections[screen] = index`).

### 4. Primitives to implement once

| Primitive | Keys | Role |
|-----------|------|------|
| **List** | ↑↓ Enter, ESC back | Single-select menus; support `'-'` separators, `sublabel`, `description`, `disabled` |
| **MultiCheck** | space toggle, a/n all/none, Enter confirm | Cart / multi-select |
| **TextPrompt** | type, backspace, Enter, ESC | Filter query, passwords (`mask`) |

Keep them under `lib/tui/` and reuse across screens.

### 5. Plan-then-apply (installers / config)

```text
installed = scanDisk()
desired   = in-memory selection / settings draft
plan      = diff(desired, installed)   // pure
apply     = write(plan)                // sole mutator
```

- Header shows `pending +N/−M` or `in sync`.
- Apply screen lists **concrete paths** that will change, then confirm.
- Exit with pending changes → confirm discard.
- Global ownership: small manifest of what *this* CLI installed; never delete foreign files by scanning alone.

### 6. Layout recipe (body under header)

```js
return h(Box, { flexDirection: 'column', paddingX: 1 },
  h(Box, {
    flexDirection: 'column',
    borderStyle: 'round',
    borderColor: pending ? 'yellow' : 'cyan',
    paddingX: 1,
    marginBottom: 1,
  }, /* title, paths, pending lines */),
  body, // List | MultiCheck | confirm | …
);
```

### 7. Validate

```sh
node bin/cli.js --help
# interactive:
node bin/cli.js
# pure core without TTY:
node --test tests/…
npm pack --dry-run   # or: npx -y github:owner/repo from another dir
```

## Gotchas

- **Hooks order:** resolve project root / load config inside `useState` initializer or after all hooks; never `return` before hooks on error paths.
- **Mutating a `useState` object in place** (e.g. `state.selected.add`) needs a `tick`/`refresh` to re-render — or store immutable updates.
- **Ink 6 + React 19** works when bundled (ccstatusline); for **unbundled** `npx github:` prefer **Ink 5 + React 18** (fewer peer pains).
- **Windows:** symlinks/junctions may fail → copy fallback; test paths.
- **Name collisions:** check `npm view <name>` before documenting `npx pkg@latest`; GitHub form always works for public repos.
- **Do not** put secrets in project trees; user settings only when keys are required.
- **Dual-mode CLIs** (TUI vs stdin JSON renderer) are optional — only if the bin also runs as a non-interactive formatter/hook.

## Output

When using this skill, deliver:

1. `bin/cli.js` + `lib/tui/{run,App,List,…}.js` (or TS equivalents)
2. Pure non-UI modules for domain plan/apply
3. `package.json` bin + runtime ink/react
4. README quick start: `npx -y github:owner/repo` (and npm if published)
5. At least one pure unit test of plan/diff without Ink

## Supporting files

- `references/pattern.md` — File map, screen list, and copy-paste snippets aligned with this suite’s installer.
- External reference implementation: [ccstatusline TUI](https://github.com/sirmalloc/ccstatusline) (`src/tui/App.tsx`, `components/List.tsx`).
