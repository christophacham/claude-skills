# ccc management (this machine)

## Installation (Windows / uv)

Preferred (matches current setup):

```powershell
uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]'
```

- `[full]` → local embeddings via `sentence-transformers` (no API key).
- Slim (cloud embeddings only): omit `[full]` and configure LiteLLM + keys in global settings.
- **Always pin `mcp>=1.0.0,<2`** for cocoindex-code 0.2.x. mcp 2.0 removed `mcp.server.fastmcp`; without the pin, `ccc mcp` dies and Claude reports `MCP error -32000: Connection closed`.

Executables land in `%USERPROFILE%\.local\bin\` (`ccc.exe`, `cocoindex-code.exe`).

Alternative (pipx):

```bash
pipx install 'cocoindex-code[full]'
# still need a compatible mcp if pipx resolves mcp 2.x — prefer uv --with pin
```

### Uninstall

```powershell
uv tool uninstall cocoindex-code
```

## Project initialization

From project root:

```powershell
ccc init --force
```

Creates:

| Path | Role |
|------|------|
| `%USERPROFILE%\.cocoindex_code\global_settings.yml` | embedding model, daemon (user-wide) |
| `<project>\.cocoindex_code\settings.yml` | include/exclude patterns |
| `.gitignore` entry | `/.cocoindex_code/` |

First-ever global setup is interactive unless you pass `--litellm-model …` (cloud) or write `global_settings.yml` by hand.

### Minimal local global settings (already used here)

```yaml
embedding:
  provider: sentence-transformers
  model: Snowflake/snowflake-arctic-embed-xs
  device: cpu

daemon:
  idle_timeout_minutes: 180
```

Then:

```powershell
ccc index
ccc doctor
```

## Claude MCP

```powershell
claude mcp add cocoindex-code -- C:\Users\snowman\.local\bin\ccc.exe mcp
claude mcp list
claude mcp get cocoindex-code
claude mcp remove cocoindex-code -s local
```

Absolute path avoids PATH differences between Claude’s spawn environment and your interactive shell.

## Daemon

Starts automatically on first index/search/mcp use.

```powershell
ccc daemon status
ccc daemon restart
ccc daemon stop
```

Logs: `%USERPROFILE%\.cocoindex_code\daemon.log`

## Diagnostics

```powershell
ccc doctor    # settings, model embed test, file walk, index
ccc status    # index stats / in-progress
```

## Cleanup

```powershell
ccc reset           # drop index DBs, keep settings (confirms)
ccc reset -f        # no confirm
ccc reset --all -f  # also remove project settings
```

## Agent recovery checklist

1. `Get-Command ccc` / `where.exe ccc` — missing → reinstall with pin.
2. `ccc doctor` — global settings / model fail → fix `global_settings.yml`.
3. Not in project → `cd` to root, `ccc init --force`.
4. No index → `ccc index` (wait; large trees take time).
5. MCP still red → absolute path re-add; confirm `mcp` package is 1.x inside the uv tool env:

```powershell
& "$env:USERPROFILE\AppData\Roaming\uv\tools\cocoindex-code\Scripts\python.exe" -c "import importlib.metadata as m; print(m.version('mcp'))"
# expect 1.x, not 2.x
```
