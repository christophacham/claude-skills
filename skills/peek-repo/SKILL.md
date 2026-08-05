---
name: peek-repo
description: >-
  Clone a GitHub repo into %USERPROFILE%\code\tmp\<name> for local inspection.
  Use when the user says "have a look at", "look at how X works", "peek at",
  "clone X for inspection", pastes a github.com URL to study source, or wants
  a library/tool/repo available under code\tmp without touching the current
  project. Not for adding dependencies, permanent installs, forking, PRs, or
  cloning into the workspace root.
argument-hint: <owner/repo|github-url>
arguments: [repo]
shell: powershell
allowed-tools: PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1 *), Bash(pwsh -NoProfile -File ${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1 *)
---

# peek-repo

One job: ensure a GitHub repo is present at
`%USERPROFILE%\code\tmp\<repo-name>` via `gh repo clone`. Then stop.

## Resolve the repo

Required input: `owner/repo` or a `https://github.com/owner/repo` URL.

1. Prefer the skill arg `repo` when present (see live state below).
2. Else extract from the current user message (URL, `owner/repo`, or
   `gh repo clone owner/repo ...`).
3. Bare product names without owner (e.g. just "serena") are not enough —
   ask once for `owner/repo` or a GitHub URL. Do not guess the org.

## Live state (injected — read it; do not re-run these checks)

### Invocation arg
!`if ($null -ne $repo -and "$repo".Trim() -ne '') { "repo=$repo" } else { 'repo=(none — extract owner/repo or GitHub URL from the user message)' }`

### Dest root
!`Join-Path $env:USERPROFILE 'code\tmp'`

### Existing tmp clones
!` $root = Join-Path $env:USERPROFILE 'code\tmp'; if (-not (Test-Path -LiteralPath $root)) { '(tmp root missing — script will create it)' } else { $dirs = @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name); if ($dirs.Count -eq 0) { '(empty)' } else { $dirs -join "`n" } } `

### Target path for this arg (exists? git?)
```!
$raw = if ($null -ne $repo) { "$repo".Trim() } else { '' }
if ([string]::IsNullOrWhiteSpace($raw)) {
  '(no repo arg — skip target check)'
  exit 0
}
$name = $null
if ($raw -match '(?i)(?:https?://|git@)[^/:]+[:/][^/]+/([^/]+?)(?:\.git)?$') { $name = $Matches[1] -replace '\.git$','' }
elseif ($raw -match '^[^/]+/([^/]+?)(?:\.git)?$') { $name = $Matches[1] -replace '\.git$','' }
if (-not $name) { "could not parse name from: $raw"; exit 0 }
$dest = Join-Path (Join-Path $env:USERPROFILE 'code\tmp') $name
if (-not (Test-Path -LiteralPath $dest)) { "TARGET=$dest`nSTATE=missing"; exit 0 }
if (Test-Path -LiteralPath (Join-Path $dest '.git')) {
  $url = ''
  try { $url = git -C $dest remote get-url origin 2>$null } catch {}
  "TARGET=$dest`nSTATE=git`nORIGIN=$url"
} else {
  "TARGET=$dest`nSTATE=non-git-path-present"
}
```

### gh auth (short)
!` gh auth status 2>&1 | Select-Object -First 6 | Out-String `

## Action (exactly one command)

Run the bundled script with the resolved repo. Idempotent: already-cloned is success.

```powershell
& "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1" -Repo "<owner/repo-or-url>"
```

- Default is shallow (`--depth 1`). Only pass `-Full` if the user asked for history.
- Do not `cd` into the clone and start exploring unless the user asked in the same turn to inspect code; this skill's job ends at a confirmed path.
- Do not clone into the current project, Desktop, or a custom path unless the user explicitly overrides — default dest is fixed.

## Report (and stop)

```text
STATUS: CLONED | EXISTS | BLOCKED | ERROR
PATH:   C:\Users\…\code\tmp\<name>
SLUG:   owner/repo
```

One short line of next-step suggestion is fine (e.g. "say if you want a walkthrough of the layout"). No automatic tree dump, no install, no build.
