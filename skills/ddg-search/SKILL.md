---
name: ddg-search
description: >-
  Free web / news search and URL extraction via the ddgs Python package
  (metasearch: DuckDuckGo, Bing, Brave, Google, …). NO API KEY. Use when the
  user wants web search without Brave credentials, general current-web facts,
  news, or a no-key fallback to brave-search. Prefer find-docs/ctx7 for named
  library API docs. Not for login-walled pages, authenticated APIs, or
  interactive browsing.
argument-hint: <query>
arguments: [query]
shell: powershell
allowed-tools: >-
  Bash(python *), Bash(py *),
  PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-ddgs.ps1 *),
  Bash(python "${CLAUDE_SKILL_DIR}/scripts/search.py" *),
  Bash(py -3 "${CLAUDE_SKILL_DIR}/scripts/search.py" *)
---

# ddg-search

Headless free metasearch via [`ddgs`](https://pypi.org/project/ddgs/) — no
API key, no browser. Default path: ensure package → `text` search → report.

## Live state (injected — do not re-run these checks)

### Invocation arg
!`if ($null -ne $query -and "$query".Trim() -ne '') { "query=$query" } else { 'query=(none — extract search terms from the user message)' }`

### Python + ddgs readiness
```!
$ErrorActionPreference = 'Continue'
function Find-Python {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      $p = & py -3 -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() }
    } catch {}
  }
  foreach ($c in @('python')) {
    if (Get-Command $c -ErrorAction SilentlyContinue) {
      try {
        $p = & $c -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() }
      } catch {}
    }
  }
  $local = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.13-64\python.exe'
  if (Test-Path -LiteralPath $local) { return $local }
  return $null
}
$py = Find-Python
if (-not $py) {
  'python=(none — install Python >= 3.10)'
  exit 0
}
$ver = ''
try { $ver = & $py -c "import ddgs; print(getattr(ddgs,'__version__','unknown'))" 2>$null } catch {}
if ($LASTEXITCODE -eq 0 -and $ver) {
  "python=$py"
  "ddgs=installed ($($ver.Trim()))"
} else {
  "python=$py"
  'ddgs=MISSING — first search.py call auto-installs via pip'
}
```

## Setup (automatic)

1. **No API key.** Unlike brave-search, ddgs needs nothing in settings.
2. **Package:** first run of `scripts/search.py` runs
   `python -m pip install -U ddgs` if import fails. Or force:

```powershell
& "${CLAUDE_SKILL_DIR}/scripts/ensure-ddgs.ps1"
```

3. Requires **Python ≥ 3.10**. If readiness shows no python, stop and tell
   the user to install it — do not invent search results.

## Search (default agent path)

Prefer the bundled script (stable output, auto-install, Windows-safe):

```bash
python "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query"
python "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query" -n 10
python "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query" -t w -n 5
python "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query" -b duckduckgo
python "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query" --json
python "${CLAUDE_SKILL_DIR}/scripts/search.py" news "query" -n 5 -t d
python "${CLAUDE_SKILL_DIR}/scripts/search.py" extract "https://example.com"
python "${CLAUDE_SKILL_DIR}/scripts/search.py" check
```

If `python` on PATH is a broken/wrong venv, use:

```bash
py -3 "${CLAUDE_SKILL_DIR}/scripts/search.py" text "query"
```

### Options (text / news)

| Flag | Meaning | Default |
|------|---------|---------|
| `-n` / `--max-results` | Result count | `5` |
| `-r` / `--region` | e.g. `us-en`, `de-de` | `us-en` |
| `-s` / `--safesearch` | `on` \| `moderate` \| `off` | `moderate` |
| `-t` / `--timelimit` | `d` \| `w` \| `m` \| `y` | none |
| `-b` / `--backend` | `auto` or engine name | `auto` |
| `--json` | Raw JSON list | off |
| `--proxy` | Proxy URL | none |
| `--timeout` | Seconds | `10` |

**text backends:** `auto`, `all`, `bing`, `brave`, `duckduckgo`, `google`,
`mojeek`, `startpage`, `yandex`, `yahoo`, `wikipedia`, …

**Default recipe:** `text` with `-n 5` and `backend=auto`. Raise `-n` only
when the first page is thin. Use `news` + `-t d|w` for current events. Use
`extract` for one URL's readable markdown (not a substitute for find-docs).

## Output format

```
--- Result 1 ---
Title: …
Link: https://…
Snippet: …

--- Result 2 ---
…
```

News adds `Date` / `Source` when present. Extract:

```
URL: https://…
Content:
…
```

## When to use which skill

| Need | Skill |
|------|--------|
| Named library API / config docs | **find-docs** (ctx7) first |
| Web search with Brave key + optional llm-context | **brave-search** |
| Free no-key web / news / extract | **ddg-search** (this skill) |
| Login / JS-heavy / authenticated | browser / other tools — not this |

## Gotchas

- **Not official DuckDuckGo API** — metasearch scrapers; empty results or
  backend errors happen. Retry once with `-b duckduckgo` or `-b bing`, or
  simplify the query. Do not invent results.
- **Rate / block risk** — keep `-n` modest; avoid tight loops.
- **Wrong Python on PATH** — some envs put a venv `python` first without
  ddgs. Prefer `py -3` or run `ensure-ddgs.ps1` then use the PYTHON path it
  prints.
- **`backend=auto`** is more resilient than pinning; pin only when debugging.
- **find-docs still wins** for library signatures — web snippets go stale.
- **Educational / scraping nature** of ddgs — fine for agent research; not a
  SLA-backed search product.
- After a fresh install, re-run the same search command once if the first
  attempt only printed the pip install log.

## Report

Summarize top hits with title + link + one-line takeaway. Cite links. If
install was required, note it once. If zero results after a retry, say so
and suggest brave-search (if key present) or a refined query.
