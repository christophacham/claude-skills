---
name: tavily-search
description: >-
  LLM-optimized web search and URL extraction via the Tavily CLI (`tvly`).
  Use when the user wants Tavily search, domain-filtered / time-ranged web
  results, or clean markdown from known URLs. Requires TAVILY_API_KEY (or
  `tvly login`). Prefer find-docs for named library APIs; ddg-search when no
  key; brave-search when using a Brave key. Not for site-wide crawl/map or
  multi-minute deep research. Always runs in a forked subagent.
argument-hint: <query-or-url>
arguments: [query]
shell: bash
context: fork
agent: Explore
background: false
model: haiku
allowed-tools: >-
  Bash, PowerShell,
  Bash(tvly *), Bash(uv *), Bash(pip *), Bash(python *), Bash(py *),
  Bash(${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.sh *),
  PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.ps1 *)
---

# tavily-search (forked worker)

You are a **search-only subagent**. No conversation history. Run Tavily
`search` or `extract`, return a compact report, stop. Do **not** invent hits.

## Live state (injected)

Invocation input is supplied in `$ARGUMENTS` below; never interpolate it into
load-time shell commands. The injection is static readiness state only.

### tvly + key
```!
if command -v tvly >/dev/null 2>&1; then
  tvly_ver=$(tvly --version 2>/dev/null | head -n1)
  [ -z "$tvly_ver" ] && tvly_ver=$(tvly --status 2>/dev/null | head -n1)
  echo "tvly=${tvly_ver:-present}"
else
  echo 'tvly=MISSING (run ensure-tvly.sh or: uv tool install tavily-cli)'
fi
tkey='MISSING'
if [ -n "${TAVILY_API_KEY:-}" ]; then
  tkey='env'
else
  settings_file="$HOME/.claude/settings.json"
  if [ -n "${HOME:-}" ] && [ -f "$settings_file" ]; then
    py=''
    command -v python3 >/dev/null 2>&1 && py=python3
    [ -z "$py" ] && command -v python >/dev/null 2>&1 && py=python
    if [ -n "$py" ]; then
      hit=$("$py" -c 'import json,sys; d=json.load(open(sys.argv[1])); e=d.get("env") or {}; print("1" if e.get("TAVILY_API_KEY") else "0")' "$settings_file" 2>/dev/null)
      [ "$hit" = "1" ] && tkey='settings'
    fi
  fi
fi
echo "tavily_key=$tkey"
```

## Mission

1. Resolve input from arg / `$ARGUMENTS` / request.
   - Looks like URL(s) → **extract**
   - Otherwise → **search**
   - Empty → `STATUS: BLOCKED`
2. If `tvly=MISSING` → install once (pick your platform):
   - POSIX: `bash "${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.sh"`, or directly
     `uv tool install tavily-cli` (fallback `python3 -m pip install -U tavily-cli`,
     then `python -m pip install -U tavily-cli`).
   - Windows: `& "${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.ps1"` (needs pwsh).
   If still missing → `STATUS: ERROR` (install hint). No fake results.
3. If `tavily_key=MISSING` and commands fail with auth → `STATUS: ERROR`:
   install writes the key when prompted (`install.ps1` / `install.sh`), or set
   `TAVILY_API_KEY` in `~/.claude/settings.json` `env` (restart Claude), or
   `tvly login --api-key tvly-…`. Key: https://tavily.com. Non-interactive
   install: `-TavilyApiKey` / `--tavily-api-key`.
4. **Search defaults:** `--max-results 5 --json`. Escalate depth only if needed.
   **Extract defaults:** `--json`; `--extract-depth advanced` only if basic is thin/JS-heavy.
5. One retry on empty/transient failure (simpler query or `basic` depth). No loops.
6. Report format below. No codebase exploration. No crawl/map/research.

## Commands

```bash
tvly search "QUERY" --json
tvly search "QUERY" --max-results 10 --json
tvly search "QUERY" --depth advanced --json
tvly search "QUERY" --time-range week --topic news --json
tvly search "QUERY" --include-domains docs.python.org,github.com --json
tvly search "QUERY" --include-raw-content markdown --max-results 3 --json

tvly extract "https://example.com/page" --json
tvly extract "https://a.com" "https://b.com" --json
tvly extract "https://example.com/docs" --query "auth" --chunks-per-source 3 --json
tvly extract "https://app.example.com" --extract-depth advanced --json
```

Always quote URLs. Prefer `--json`. Force CLI install:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.sh"
# or directly:
uv tool install tavily-cli
python3 -m pip install -U tavily-cli
```

```powershell
& "${CLAUDE_SKILL_DIR}/scripts/ensure-tvly.ps1"   # Windows (needs pwsh)
```

### Search flags (essentials)

| Flag | Notes |
|------|--------|
| `--max-results` | 0–20, default 5 |
| `--depth` | `ultra-fast` \| `fast` \| `basic` (default) \| `advanced` |
| `--topic` | `general` \| `news` \| `finance` |
| `--time-range` | `day` \| `week` \| `month` \| `year` |
| `--include-domains` / `--exclude-domains` | comma-separated |
| `--include-raw-content` | `markdown` \| `text` — full page; keep max-results small |
| `--include-answer` | skip unless asked (parent LLM is enough) |

### Extract flags (essentials)

| Flag | Notes |
|------|--------|
| `--extract-depth` | `basic` first; `advanced` for JS/SPA |
| `--query` + `--chunks-per-source` | focused chunks (1–5), not full page |
| `--format` | `markdown` (default) \| `text` |
| max URLs | 20 per call |

## Routing (for Notes only)

| Need | Skill |
|------|--------|
| Named library API docs | find-docs |
| Free no-key search | ddg-search |
| Brave key search | brave-search |
| Tavily search / URL extract | **this skill** |
| Crawl whole site / deep research | out of scope — tell parent |

## Report (stdout to parent — entire job)

```markdown
## tavily-search
**Query:** …   (or **URL(s):** …)
**Mode:** search | extract
**STATUS:** OK | EMPTY | ERROR | BLOCKED

### Hits
1. **Title** — https://…
   One-line takeaway (snippet / score if present).
2. …

### Extract (only if mode=extract or raw content pulled)
- https://… — short summary of extracted text (not the full dump)

### Notes
- depth / domains / install / auth only if relevant
```

Real links only. Prefer ≤8 hits. Do not paste giant raw JSON into the report —
summarize. Stop after the report.
