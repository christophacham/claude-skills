# Ink CLI TUI — pattern map

Read when implementing or reviewing a full-screen installer/config TUI.

## Why not Clack alone

| Clack | Ink full-screen |
|-------|-----------------|
| Appends `◇` steps to scrollback | Clears screen; redraws one frame |
| Good for 3–5 linear prompts | Good for multi-screen wizards |
| No sticky live preview | Header recomputes every render |

ccstatusline entry:

```ts
process.stdout.write('\x1b[2J\x1b[H');
render(<App />);
```

## Recommended file map

```text
bin/cli.js                 # shebang, parseArgs, default → runTUI
lib/tui/run.js             # TTY check, clear, render, waitUntilExit
lib/tui/App.js             # screen state, header, body switch
lib/tui/List.js            # single-select
lib/tui/MultiCheck.js      # multi-select cart
lib/tui/TextPrompt.js      # filter / secrets
lib/tui/h.js               # createElement helper (optional)
lib/<domain>/scan.js       # pure disk inventory
lib/<domain>/desired.js    # pure draft + planChanges
lib/<domain>/apply.js      # sole mutator
tests/test_<domain>_core.mjs
```

## Screen set (installer-shaped)

Minimal useful set:

1. **main** — browse, scope, targets, status, apply, manage, exit  
2. **browse** — categories → MultiCheck (+ optional filter prompt)  
3. **apply** — summarize plan + path list + confirm  
4. **manage** — resync / defaults / uninstall owned global bits  
5. **confirm-exit** — if pending  

Config tools swap “browse skills” for “edit sections” but keep plan/apply.

## List item shape

```js
{ label, value, sublabel?, description?, disabled? }
// or '-' for spacer
```

Selected row: `▶` prefix + cyan/bold; description under the list for the focused row.

## MultiCheck keys

- `space` / `x` — toggle  
- `a` / `n` — all / none  
- `Enter` — confirm selection set  
- `ESC` — cancel without applying to draft  

## Apply confirm must show paths

Users trust wizards that list:

```text
+ ~/proj/.claude/skills/foo
− ~/.claude/skills/bar
```

not only “install 2 skills”.

## GitHub vs npm

| Channel | Command |
|---------|---------|
| GitHub (no publish) | `npx -y github:owner/repo` |
| npm scoped | `npx -y @owner/pkg@latest` |
| Local clone | `node bin/cli.js` / `npx .` |

Document the channel you actually support. If unscoped npm name is taken, **do not** tell users `npx that-name@latest`.

## This monorepo’s live example

- `lib/tui/*` — Ink UI  
- `lib/desired.js`, `lib/scan.js`, `lib/apply.js` — pure core  
- `bin/cli.js` — default wizard; `--clack` / `--legacy` fallbacks  
