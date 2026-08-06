# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  .\install.ps1 [-Project] [<ProjectPath>] [-BraveApiKey <key>] [-TavilyApiKey <key>] [-SkipBraveKey] [-SkipTavilyKey] [-SkipDeps]
# Usage (remote): iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/install.ps1 | iex
# -Project with no path uses the current location; path may be relative or absolute.
param(
  [switch] $Project,
  [Parameter(Position = 0)]
  [string] $ProjectPath,
  [string] $BraveApiKey,
  [string] $TavilyApiKey,
  [switch] $SkipBraveKey,
  [switch] $SkipTavilyKey,
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

if ($Project) {
  if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    $projectRoot = (Get-Location).Path
  } else {
    if (-not (Test-Path -LiteralPath $ProjectPath -PathType Container)) {
      throw "Project path is not a directory: $ProjectPath"
    }
    $projectRoot = (Resolve-Path -LiteralPath $ProjectPath).Path
  }
  $dest = Join-Path $projectRoot '.claude'
} else {
  $dest = Join-Path $HOME '.claude'
}
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
# stale cleanup: removed skills and old pool location
foreach ($stale in @('tmp-clone', 'web-ddgs', 'work-loop', 'work-plan', 'bd-epic-runner', 'architectural-decomposition')) {
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

function Get-UsablePython {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    try {
      $candidate = & py -3 -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $candidate -and (Test-Path -LiteralPath $candidate.Trim())) {
        return $candidate.Trim()
      }
    } catch {}
  }
  if (Get-Command python -ErrorAction SilentlyContinue) {
    try {
      $command = (Get-Command python).Source
      $candidate = & $command -c "import sys; print(sys.executable)" 2>$null
      if ($LASTEXITCODE -eq 0 -and $candidate -and (Test-Path -LiteralPath $candidate.Trim())) {
        return $candidate.Trim()
      }
    } catch {}
  }
  return $null
}

function Test-SupportedNode {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  try {
    $major = & node -p "Number(process.versions.node.split('.')[0])" 2>$null
    return ($LASTEXITCODE -eq 0 -and ([int]$major -eq 20 -or [int]$major -ge 22))
  } catch {
    return $false
  }
}

function Get-SettingsEnvKey {
  param(
    [string] $Path,
    [string[]] $Names
  )
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  try {
    $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    $obj = $raw | ConvertFrom-Json
    if ($null -eq $obj.env) { return $null }
    foreach ($n in $Names) {
      $prop = $obj.env.PSObject.Properties[$n]
      if ($null -ne $prop -and -not [string]::IsNullOrWhiteSpace([string]$prop.Value)) {
        return [string]$prop.Value
      }
    }
    return $null
  } catch {
    return $null
  }
}

function Set-SettingsEnvKey {
  param(
    [string] $Path,
    [string] $Name,
    [string] $Value
  )
  # Prefer a verified Python for merge fidelity (ConvertTo-Json mangles nested hooks/arrays).
  $py = Get-UsablePython
  if ($py) {
    $env:SETTINGS_PATH = $Path
    $env:SETTINGS_ENV_NAME = $Name
    $env:SETTINGS_ENV_VAL = $Value
    $code = @'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
name = os.environ["SETTINGS_ENV_NAME"]
key = os.environ["SETTINGS_ENV_VAL"]
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
env[name] = key
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
      Remove-Item Env:SETTINGS_ENV_NAME -ErrorAction SilentlyContinue
      Remove-Item Env:SETTINGS_ENV_VAL -ErrorAction SilentlyContinue
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
      throw "Could not parse existing settings at $Path — fix JSON manually, then re-run with the API key flag."
    }
  }
  if ($null -eq $obj) {
    $obj = [pscustomobject]@{}
  }
  if ($null -eq $obj.env) {
    $obj | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{}) -Force
  }
  $envObj = $obj.env
  if ($envObj.PSObject.Properties.Name -contains $Name) {
    $envObj.$Name = $Value
  } else {
    $envObj | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
  }
  $json = $obj | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine)
}

function Get-SettingsBraveKey {
  param([string] $Path)
  return Get-SettingsEnvKey -Path $Path -Names @('BRAVE_API_KEY', 'BRAVE_SEARCH_API_KEY')
}

function Set-SettingsBraveKey {
  param([string] $Path, [string] $Key)
  Set-SettingsEnvKey -Path $Path -Name 'BRAVE_API_KEY' -Value $Key
}

function Get-SettingsTavilyKey {
  param([string] $Path)
  return Get-SettingsEnvKey -Path $Path -Names @('TAVILY_API_KEY')
}

function Set-SettingsTavilyKey {
  param([string] $Path, [string] $Key)
  Set-SettingsEnvKey -Path $Path -Name 'TAVILY_API_KEY' -Value $Key
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
    Write-Output "deps skip:        node not on PATH (brave-search needs Node 20 or >=22)"
    return
  }
  if (-not (Test-SupportedNode)) {
    $version = (& node --version 2>$null)
    Write-Output "deps skip:        unsupported $version (brave-search needs Node 20 or >=22)"
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

function Install-TvlyIfPossible {
  param([string] $SkillDir)
  $ensure = Join-Path $SkillDir 'scripts\ensure-tvly.ps1'
  if (-not (Test-Path -LiteralPath $ensure)) { return }
  Write-Output "deps install:     ensure tvly (Tavily CLI) ..."
  try {
    & $ensure
  } catch {
    Write-Output "deps warn:        tvly ensure failed — first tavily-search will retry: $_"
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
  $tavilyDir = Join-Path $dest 'skills\tavily-search'
  if (Test-Path $tavilyDir) {
    Install-TvlyIfPossible -SkillDir $tavilyDir
  }
} else {
  Write-Output "deps skip:        -SkipDeps"
}

# --- Brave API key ---
if (-not $SkipBraveKey) {
  $existing = $null
  $existingSource = $null
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

# --- Tavily API key ---
if (-not $SkipTavilyKey) {
  $existing = $null
  $existingSource = $null
  if (-not [string]::IsNullOrWhiteSpace($env:TAVILY_API_KEY)) {
    $existing = $env:TAVILY_API_KEY
    $existingSource = 'process env TAVILY_API_KEY'
  } else {
    $fromSettings = Get-SettingsTavilyKey -Path $userSettingsPath
    if ($fromSettings) {
      $existing = $fromSettings
      $existingSource = "settings.json ($userSettingsPath)"
    }
  }

  $keyToWrite = $null
  if (-not [string]::IsNullOrWhiteSpace($TavilyApiKey)) {
    $keyToWrite = $TavilyApiKey.Trim()
  } elseif ($existing) {
    Write-Output "tavily key:       already set via $existingSource (not printed)"
    $inSettings = Get-SettingsTavilyKey -Path $userSettingsPath
    if (-not $inSettings) {
      $keyToWrite = $existing
      Write-Output "tavily key:       mirroring into $userSettingsPath"
    }
  } elseif (Test-IsInteractive) {
    Write-Host ""
    Write-Host "Tavily Search (optional — LLM-optimized search/extract; skip if unused)"
    Write-Host "  Get a key: https://tavily.com"
    Write-Host "  Stored in: $userSettingsPath  under env.TAVILY_API_KEY"
    $entered = Read-Host "Paste TAVILY_API_KEY (Enter to skip)"
    if (-not [string]::IsNullOrWhiteSpace($entered)) {
      $keyToWrite = $entered.Trim()
    } else {
      Write-Output "tavily key:       skipped (ddg-search / brave-search still available)"
    }
  } else {
    Write-Output "tavily key:       not set (non-interactive). Re-run with -TavilyApiKey <key> or set env.TAVILY_API_KEY in $userSettingsPath"
  }

  if ($keyToWrite) {
    Set-SettingsTavilyKey -Path $userSettingsPath -Key $keyToWrite
    Write-Output "tavily key:       saved to $userSettingsPath (env.TAVILY_API_KEY) — restart Claude Code to pick up"
  }
} else {
  Write-Output "tavily key:       -SkipTavilyKey"
}

if ($cleanupTmp -and (Test-Path $cleanupTmp)) {
  Remove-Item -Recurse -Force $cleanupTmp -ErrorAction SilentlyContinue
}

Write-Output "done: $count items installed into $dest"
