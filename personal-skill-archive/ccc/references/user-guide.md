# ccc user guide (humans)

Semantic search for the current repo. Agents use the same CLI; this page is the short manual for you.

## One-time setup (already done on this PC)

```powershell
# Install (note the mcp pin — required until cocoindex supports mcp 2.x)
uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]'

# PATH: %USERPROFILE%\.local\bin must include ccc.exe
ccc --help
```

Global config: `%USERPROFILE%\.cocoindex_code\global_settings.yml`  
(local model: Snowflake arctic-embed-xs on CPU)

### Per project

```powershell
cd C:\Users\snowman\code\BambuStudio   # or any repo
ccc init --force                       # once: creates .cocoindex_code/settings.yml + gitignore
ccc index                              # build (first run can take a while on big trees)
ccc status
```

### Optional: Claude Code MCP

```powershell
claude mcp add cocoindex-code -- C:\Users\snowman\.local\bin\ccc.exe mcp
claude mcp list   # expect: cocoindex-code … ✔ Connected
```

MCP exposes a `search` tool to the agent. The **skill** (`/ccc` or auto-trigger) teaches the agent to run the CLI even without MCP.

Remove:

```powershell
claude mcp remove cocoindex-code -s local
```

## Auto-index (what runs without you typing)

| Mechanism | What it does | Mutates? |
|-----------|--------------|----------|
| **Skill injection** (`/ccc`) | Inlines `ccc status` when the skill loads | **No** (read-only only) |
| **Agent policy** (skill body) | If status says empty/missing, agent runs `ccc index` / ensure script | Yes (tool call) |
| **SessionStart hook** (BambuStudio `.claude/settings.json`) | On new Claude session in this repo, runs `ccc index` if `.cocoindex_code` exists | Yes |
| **Project rule** (`.claude/rules/ccc.md`) | Tells every session about ccc + prefer search vs grep | No |

**Do not** put `ccc index` in skill `!` injection or as a “run on every load” fake CLAUDE.md command — injection is read-only and index is too slow/heavy for that.

Disable SessionStart auto-index: remove the `SessionStart` block from `.claude/settings.json`.

## Daily commands

| Goal | Command |
|------|---------|
| Search by meaning | `ccc search filament remaining preference` |
| Limit language | `ccc search --lang cpp motion calibration` |
| Limit path | `ccc search --path 'src/*' plate selection` |
| Update then search | `ccc search --refresh …` |
| Rebuild / refresh index | `ccc index` |
| Progress / stats | `ccc status` |
| Health check | `ccc doctor` |
| Structural pattern (no index) | `ccc grep …` |
| Reset index DBs only | `ccc reset` |
| Reset index + project settings | `ccc reset --all` |
| Daemon | `ccc daemon status` / `restart` / `stop` |

### Search tips

- Write a **sentence or phrase about behavior**, not a regex.
- Good: `where AMS slot with least remaining filament is chosen`
- Weak: `AMS` alone (too vague) or a full function body paste
- Open the returned `file:line` in the editor; ccc returns chunks, not full files
- Next page: `ccc search --offset 5 --limit 5 …`

## When to use what

- **ccc** — conceptual / “how does X work” / fuzzy naming
- **IDE / ripgrep** — exact symbol, error string, TODO
- **code-graph skill** — callers, callees, include graph (this repo’s recon tooling)

## Upgrade

```powershell
uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]'
```

After changing the embedding model in `global_settings.yml`:

```powershell
ccc reset -f
ccc index
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `ccc` not recognized | Add `%USERPROFILE%\.local\bin` to user PATH; open a new shell |
| MCP Connection closed | Reinstall with mcp pin; run `ccc doctor`; absolute path in `claude mcp add` |
| Global settings not found | Create via interactive `ccc init` or copy YAML from management.md |
| Index never finishes | `ccc status` / `ccc doctor`; check `%USERPROFILE%\.cocoindex_code\daemon.log` |
| Bad / empty hits | Re-index; widen query; check `include_patterns` in project settings |

Invoke the agent skill in Claude Code with **`/ccc`** or by asking to “search the codebase for …”.
