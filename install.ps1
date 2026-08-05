# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  .\install.ps1 [-Project] [-BraveApiKey <key>] [-SkipBraveKey] [-SkipDeps]
# Usage (remote): iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/install.ps1 | iex
param(
  [switch] $Project,
  [string] $BraveApiKey,
  [switch] $SkipBraveKey,
  [switch] $SkipDeps
)

$ErrorActionPreference = 'Stop'

$scriptDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
$cleanupTmp = $null

if ($scriptDir -and (Test-Path (Join-Path $scriptDir 'skills'))) {
  $root = $scriptDir
} else {
  Write-Host "Downloading latest claude-skills from GitHub..."
  $tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
  New-Item -ItemType Directory -Force $tmpDir | Out-Null
  $cleanupTmp = $tmpDir
  $zipPath = Join-Path $tmpDir 'repo.zip'

  $token = $null
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    $token = (gh auth token 2>$null)
  }

  $headers = @{}
  if ($token) {
    $headers['Authorization'] = "token $token"
  }

  try {
    if ($token) {
      $apiUrl = 'https://api.github.com/repos/christophacham/claude-skills/zipball/main'
      Invoke-RestMethod -Uri $apiUrl -Headers $headers -OutFile $zipPath
    } else {
      $publicUrl = 'https://github.com/christophacham/claude-skills/archive/refs/heads/main.zip'
      Invoke-RestMethod -Uri $publicUrl -OutFile $zipPath
    }
  } catch {
    $publicUrl = 'https://github.com/christophacham/claude-skills/archive/refs/heads/main.zip'
    Invoke-RestMethod -Uri $publicUrl -OutFile $zipPath
  }

  Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
  $root = Get-ChildItem $tmpDir -Directory | Select-Object -First 1 | Select-Object -ExpandProperty FullName
}

$dest = if ($Project) { Join-Path (Get-Location) '.claude' } else { Join-Path $HOME '.claude' }
# Keys always land in the user settings file so project installs don't commit secrets.
$userClaude = Join-Path $HOME '.claude'
$userSettingsPath = Join-Path $userClaude 'settings.json'

New-Item -ItemType Directory -Force (Join-Path $dest 'skills') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $dest 'agents') | Out-Null
New-Item -ItemType Directory -Force $userClaude | Out-Null

$count = 0
Get-ChildItem (Join-Path $root 'skills') -Directory | ForEach-Object {
  $target = Join-Path $dest "skills\$($_.Name)"
  if (Test-Path $target) { Remove-Item -Recurse -Force $target }
  Copy-Item -Recurse -Force $_.FullName $target
  Write-Output "installed skill:  $($_.Name) -> $target"
  $count++
}
Get-ChildItem (Join-Path $root 'agents') -File -Filter *.md | ForEach-Object {
  Copy-Item -Force $_.FullName (Join-Path $dest "agents\$($_.Name)")
  Write-Output "installed agent:  $($_.Name) -> $dest\agents\$($_.Name)"
  $count++
}
$panel = Join-Path $root 'agents\panelists'
if (Test-Path $panel) {
  New-Item -ItemType Directory -Force (Join-Path $dest 'agents\panelists') | Out-Null
  Get-ChildItem $panel -File -Filter *.md | ForEach-Object {
    Copy-Item -Force $_.FullName (Join-Path $dest "agents\panelists\$($_.Name)")
    Write-Output "installed agent:  panelists/$($_.Name) -> $dest\agents\panelists\$($_.Name)"
    $count++
  }
}
# default model pool -> $dest\pool.md (repo-local .claude\pool.md wins at load)
$poolFile = Join-Path $root 'pool.md'
if (Test-Path $poolFile) {
  Copy-Item -Force $poolFile (Join-Path $dest 'pool.md')
  Write-Output "installed pool:   pool.md -> $dest\pool.md"
}
# stale cleanup: pool used to live inside the skill dir; renamed skills
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'skills\work-loop\pool.md')
foreach ($stale in @('tmp-clone', 'web-ddgs')) {
  $stalePath = Join-Path $dest "skills\$stale"
  if (Test-Path $stalePath) {
    Remove-Item -Recurse -Force $stalePath
    Write-Output "removed stale:    $stale"
  }
}

function Test-IsInteractive {
  try {
    if (-not [Environment]::UserInteractive) { return $false }
    if ([Console]::IsInputRedirected) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Get-SettingsBraveKey {
  param([string] $Path)
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $obj = $raw | ConvertFrom-Json
    if ($null -eq $obj.env) { return $null }
    $k = $obj.env.BRAVE_API_KEY
    if ([string]::IsNullOrWhiteSpace($k)) { $k = $obj.env.BRAVE_SEARCH_API_KEY }
    if ([string]::IsNullOrWhiteSpace($k)) { return $null }
    return [string]$k
  } catch {
    return $null
  }
}

function Set-SettingsBraveKey {
  param(
    [string] $Path,
    [string] $Key
  )
  # Prefer Python for merge fidelity (ConvertTo-Json mangles nested hooks/arrays).
  $py = $null
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      $cand = & py -3 -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $cand) { $py = $cand.Trim() }
    } catch {}
  }
  if (-not $py -and (Get-Command python -ErrorAction SilentlyContinue)) {
    $py = (Get-Command python).Source
  }
  if ($py) {
    $env:SETTINGS_PATH = $Path
    $env:BRAVE_KEY_VAL = $Key
    $code = @'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
key = os.environ["BRAVE_KEY_VAL"]
data = {}
if os.path.isfile(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"error: could not parse {path}: {e}", file=sys.stderr)
        sys.exit(1)
if not isinstance(data, dict):
    data = {}
env = data.get("env")
if not isinstance(env, dict):
    env = {}
env["BRAVE_API_KEY"] = key
data["env"] = env
os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
'@
    try {
      $code | & $py -
      if ($LASTEXITCODE -ne 0) { throw "python settings write failed (exit $LASTEXITCODE)" }
      return
    } finally {
      Remove-Item Env:SETTINGS_PATH -ErrorAction SilentlyContinue
      Remove-Item Env:BRAVE_KEY_VAL -ErrorAction SilentlyContinue
    }
  }

  $obj = $null
  if (Test-Path -LiteralPath $Path) {
    try {
      $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $obj = $raw | ConvertFrom-Json
      }
    } catch {
      throw "Could not parse existing settings at $Path — fix JSON manually, then re-run with -BraveApiKey."
    }
  }
  if ($null -eq $obj) {
    $obj = [pscustomobject]@{}
  }
  if ($null -eq $obj.env) {
    $obj | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $envObj = $obj.env
  if ($envObj.PSObject.Properties.Name -contains 'BRAVE_API_KEY') {
    $envObj.BRAVE_API_KEY = $Key
  } else {
    $envObj | Add-Member -NotePropertyName BRAVE_API_KEY -NotePropertyValue $Key -Force
  }
  $json = $obj | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine)
}

function Install-SkillNodeDeps {
  param([string] $SkillDir)
  $pkg = Join-Path $SkillDir 'package.json'
  if (-not (Test-Path -LiteralPath $pkg)) { return }
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Output "deps skip:        npm not on PATH (brave-search needs: npm install in $SkillDir)"
    return
  }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Output "deps skip:        node not on PATH (brave-search needs Node.js)"
    return
  }
  Write-Output "deps install:     npm install -> $SkillDir"
  Push-Location -LiteralPath $SkillDir
  try {
    & npm install --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) {
      Write-Output "deps warn:        npm install failed (exit $LASTEXITCODE) — run manually in $SkillDir"
    } else {
      Write-Output "deps ready:       brave-search node_modules"
    }
  } finally {
    Pop-Location
  }
}

function Install-DdgsIfPossible {
  param([string] $SkillDir)
  $ensure = Join-Path $SkillDir 'scripts\ensure-ddgs.ps1'
  if (-not (Test-Path -LiteralPath $ensure)) { return }
  Write-Output "deps install:     ensure ddgs (Python) ..."
  try {
    & $ensure
  } catch {
    Write-Output "deps warn:        ddgs ensure failed — first search will retry: $_"
  }
}

# --- skill runtime deps ---
if (-not $SkipDeps) {
  $braveDir = Join-Path $dest 'skills\brave-search'
  if (Test-Path $braveDir) {
    Install-SkillNodeDeps -SkillDir $braveDir
  }
  $ddgDir = Join-Path $dest 'skills\ddg-search'
  if (Test-Path $ddgDir) {
    Install-DdgsIfPossible -SkillDir $ddgDir
  }
} else {
  Write-Output "deps skip:        -SkipDeps"
}

# --- Brave API key ---
if (-not $SkipBraveKey) {
  $existing = $null
  if (-not [string]::IsNullOrWhiteSpace($env:BRAVE_API_KEY)) {
    $existing = $env:BRAVE_API_KEY
    $existingSource = 'process env BRAVE_API_KEY'
  } elseif (-not [string]::IsNullOrWhiteSpace($env:BRAVE_SEARCH_API_KEY)) {
    $existing = $env:BRAVE_SEARCH_API_KEY
    $existingSource = 'process env BRAVE_SEARCH_API_KEY'
  } else {
    $fromSettings = Get-SettingsBraveKey -Path $userSettingsPath
    if ($fromSettings) {
      $existing = $fromSettings
      $existingSource = "settings.json ($userSettingsPath)"
    }
  }

  $keyToWrite = $null
  if (-not [string]::IsNullOrWhiteSpace($BraveApiKey)) {
    $keyToWrite = $BraveApiKey.Trim()
  } elseif ($existing) {
    Write-Output "brave key:        already set via $existingSource (not printed)"
    # If only in process env, still mirror into settings so Claude Code sessions see it.
    $inSettings = Get-SettingsBraveKey -Path $userSettingsPath
    if (-not $inSettings) {
      $keyToWrite = $existing
      Write-Output "brave key:        mirroring into $userSettingsPath"
    }
  } elseif (Test-IsInteractive) {
    Write-Host ""
    Write-Host "Brave Search (optional — free tier; skip to use ddg-search only)"
    Write-Host "  Get a key: https://api-dashboard.search.brave.com/app/keys"
    Write-Host "  Stored in: $userSettingsPath  under env.BRAVE_API_KEY"
    $entered = Read-Host "Paste BRAVE_API_KEY (Enter to skip)"
    if (-not [string]::IsNullOrWhiteSpace($entered)) {
      $keyToWrite = $entered.Trim()
    } else {
      Write-Output "brave key:        skipped (ddg-search works without a key)"
    }
  } else {
    Write-Output "brave key:        not set (non-interactive). Re-run with -BraveApiKey <key> or set env.BRAVE_API_KEY in $userSettingsPath"
  }

  if ($keyToWrite) {
    Set-SettingsBraveKey -Path $userSettingsPath -Key $keyToWrite
    Write-Output "brave key:        saved to $userSettingsPath (env.BRAVE_API_KEY) — restart Claude Code to pick up"
  }
} else {
  Write-Output "brave key:        -SkipBraveKey"
}

if ($cleanupTmp -and (Test-Path $cleanupTmp)) {
  Remove-Item -Recurse -Force $cleanupTmp -ErrorAction SilentlyContinue
}

Write-Output "done: $count items installed into $dest"
