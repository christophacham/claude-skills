---
name: ccc
description: "Semantic code search and index management via CocoIndex Code (`ccc` CLI / MCP). Use when searching the codebase by meaning (not exact text), when the user asks to find related code, update/rebuild the index, run ccc/cocoindex, or after large refactors where grep would miss renames. Prefer Grep/Glob for exact symbols and filenames; prefer code-graph/code-trace skills for call hierarchies. Not for web search or non-code docs outside the repo."
shell: bash
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/ensure-index.sh *), PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-index.ps1 *)
---

# ccc — Semantic Code Search

`ccc` is the CLI for [CocoIndex Code](https://github.com/cocoindex-io/cocoindex-code): AST-chunked semantic search over the current project.

| Path | When |
|------|------|
| **CLI** (`ccc search` / `ccc index`) | Default — works without MCP |
| **MCP** tool `search` (server `cocoindex-code`) | If session has MCP connected |

Human cheat sheet: [references/user-guide.md](references/user-guide.md). Install/troubleshoot: [references/management.md](references/management.md). Settings: [references/settings.md](references/settings.md).

## Live index state (injected — read-only)

Do **not** re-run status for discovery; use this snapshot. Re-check with a tool only after you start/finish an index.

```!
export PATH="$HOME/.local/bin:$PATH"
if ! command -v ccc >/dev/null 2>&1; then
  echo "ccc: NOT ON PATH — install: uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]'"
elif [ ! -d .cocoindex_code ]; then
  echo "ccc: project not initialized here (no .cocoindex_code). From project root: ccc init --force && ccc index"
else
  ccc status 2>/dev/null || echo "ccc: status failed (see doctor)"
fi
```

### Auto-refresh policy (tool calls — never via injection)

Dynamic injection is **read-only**. `ccc index` is a mutation and can be slow on large trees — it must be a **tool call**, not an injection, and not stuffed into CLAUDE.md as a fake auto-run.

When this skill loads or semantic search is needed:

1. Read the injected status above.
2. If **not on PATH** → tell the user the install one-liner from management.md; stop.
3. If **not initialized** → from project root: `ccc init --force`, then ensure index.
4. If **no index / zero chunks / “Index not created”** → run ensure (below). First full index of a huge monorepo may take a long time; say so and prefer background if the user is waiting.
5. If **“Indexing in progress”** → do not start a second `ccc index`; wait / poll `ccc status`, then search.
6. If **healthy with chunks** → search. After you make large code edits this session, run ensure again before the next conceptual search.

Ensure commands (prefer skill scripts; pre-approved via `allowed-tools`):

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ensure-index.sh"
# status only:
bash "${CLAUDE_SKILL_DIR}/scripts/ensure-index.sh" --status
```

PowerShell equivalent: `"${CLAUDE_SKILL_DIR}/scripts/ensure-index.ps1"` or `-Status`.

Or bare: `ccc index` / `ccc search --refresh <query>`.

### Project SessionStart (optional, already wired in BambuStudio)

If the project has a SessionStart hook that runs `ccc index` when `.cocoindex_code` exists, that is the **session-level** auto-index. Skill injection still only reports status. See project `.claude/settings.json` + `.claude/rules/ccc.md`.

## Ownership (agents)

The agent owns init / index / search for the current project. Do not ask the user to do them unless install is broken.

## When to use ccc vs other tools

| Need | Tool |
|------|------|
| Concept / fuzzy “where is filament remaining preferred?” | **`ccc search`** |
| Exact symbol / string | **Grep** |
| File name patterns | **Glob** |
| Callers/callees / includes | **code-graph** / **code-trace** |
| Library docs on the web | **find-docs** / **brave-search** |

Follow hits with `Read` on path:line.

## Search

```bash
ccc search database connection pooling
ccc search --lang cpp --lang h motion calibration
ccc search --path 'src/*' filament mapping
ccc search --offset 5 --limit 5 plate arrangement
ccc search --refresh error handling retry
```

Query = natural-language behavior, not regex. Default path scope = current working directory under the project root.

Structural (no embeddings): `ccc grep …`

## This machine (Windows)

- CLI: `%USERPROFILE%\.local\bin\ccc.exe` via `uv tool install`
- Global: `%USERPROFILE%\.cocoindex_code\global_settings.yml` (sentence-transformers / arctic-embed-xs / cpu)
- Project: `<repo>\.cocoindex_code\` (gitignored)
- MCP: `claude mcp add cocoindex-code -- %USERPROFILE%\.local\bin\ccc.exe mcp`

**Install pin (required):** mcp 2.x broke FastMCP; always:

```powershell
uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]'
```

## Gotchas

- Injection must stay **status-only** — never inject `ccc index` / `ccc reset` / installs ([windows-winget-ensure-tools] memory + dynamic-context-injection rules).
- Large monorepos: first index is slow on CPU; `ccc status` shows progress.
- Model change → `ccc reset -f && ccc index`.
- Ensure `~\.local\bin` on PATH or use absolute `ccc.exe`.

## Supporting files

- `references/user-guide.md` — human cheat sheet
- `references/management.md` — install / MCP / doctor
- `references/settings.md` — YAML
- `scripts/ensure-index.sh` / `ensure-index.ps1` — explicit ensure (mutation)
