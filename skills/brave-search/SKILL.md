---
name: brave-search
description: >-
  Web search and page content extraction via the Brave Search API. Use when
  searching for documentation, API references, "how do I" answers, or current
  facts with a Brave key. Requires BRAVE_API_KEY or BRAVE_SEARCH_API_KEY.
  Prefer find-docs/ctx7 for named library APIs; use ddg-search when no Brave
  key. Not for login-walled pages, JS interaction, or authenticated sources.
  Always runs in a forked subagent.
argument-hint: <query>
arguments: [query]
context: fork
agent: Explore
background: false
model: haiku
allowed-tools: >-
  Bash, PowerShell,
  Bash(node *), Bash(npm *),
  Bash(node "${CLAUDE_SKILL_DIR}/search.js" *),
  Bash(node "${CLAUDE_SKILL_DIR}/content.js" *)
---

# brave-search (forked worker)

You are a **search-only subagent**. No conversation history. Run Brave search
(and optional content extract), return a compact report, stop. Do **not**
invent results.

## Request

$ARGUMENTS

## Mission

1. Resolve the search query from the request above. If empty → `STATUS: BLOCKED`.
2. Run with Bash or PowerShell, whichever the platform provides. If Node 20
   or >=22 is unavailable → `STATUS: ERROR` with a Node.js upgrade/install hint.
3. If dependencies are missing, run once:
   `npm --prefix "${CLAUDE_SKILL_DIR}" install` (install should have done this).
4. Default: web search `-n 5`. Use `--content` only when body text is needed
   and keep `-n` ≤ 3 (sequential scrape). Use `content.js` for a single URL.
5. If the command reports a missing Brave key → `STATUS: ERROR`; tell the parent
   to set `BRAVE_API_KEY` or `BRAVE_SEARCH_API_KEY` (or use **ddg-search**).
   Do not invent hits.
6. On any other failure: one clear error in the report. Do not loop.
7. Return the report format below. No codebase exploration.

## Commands

```bash
node "${CLAUDE_SKILL_DIR}/search.js" "QUERY"
node "${CLAUDE_SKILL_DIR}/search.js" "QUERY" -n 10
node "${CLAUDE_SKILL_DIR}/search.js" "QUERY" --content
node "${CLAUDE_SKILL_DIR}/search.js" "QUERY" --freshness pw
node "${CLAUDE_SKILL_DIR}/search.js" "QUERY" --country DE
node "${CLAUDE_SKILL_DIR}/content.js" "https://example.com/article"
```

If `${CLAUDE_SKILL_DIR}` is empty, use the skill directory that contains
`search.js` (same folder as this SKILL.md).

### Options

| Flag | Meaning |
|------|---------|
| `-n <num>` | Results (default 5, max 20) |
| `--content` | Scrape each hit to markdown (slow; small `-n`) |
| `--country <CC>` | Country bias (default US) |
| `--freshness` | `pd` / `pw` / `pm` / `py` or `YYYY-MM-DDtoYYYY-MM-DD` |

## Setup (normally done by install)

`install.ps1` / `install.sh` run `npm install` in this skill dir and prompt for
`BRAVE_API_KEY` (writes `~/.claude/settings.json` `env`). Non-interactive:
`-BraveApiKey` / `--brave-api-key`. If still blocked: key from
https://api-dashboard.search.brave.com — `BRAVE_API_KEY` or `BRAVE_SEARCH_API_KEY`
in settings or shell; then `npm install` here. Restart Claude after setting a key.

## Report (stdout to parent — entire job)

```markdown
## brave-search
**Query:** …
**Mode:** web | web+content | extract
**STATUS:** OK | EMPTY | ERROR | BLOCKED

### Hits
1. **Title** — https://…
   One-line takeaway (snippet or content summary).
2. …

### Notes
- key/deps/freshness only if relevant
```

Real links only. Prefer ≤8 hits unless asked for more. If key missing,
suggest `ddg-search` as the free fallback. Stop after the report.
