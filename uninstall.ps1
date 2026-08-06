# Uninstall claude-skills: remove skills/agents/pool this repo installed into ~/.claude (or DIR/.claude)
# Usage (local):  .\uninstall.ps1 [-Project] [<ProjectPath>] [-RemoveKeys]
# Usage (remote): iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/uninstall.ps1 | iex
# -Project with no path uses the current location; path may be relative or absolute.
#
# Does not remove: other skills/agents, Claude settings (except optional keys), global pip/npm/uv tools.
param(
  [switch] $Project,
  [Parameter(Position = 0)]
  [string] $ProjectPath,
  [switch] $RemoveKeys
)

$ErrorActionPreference = 'Stop'

$scriptDir = if ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { $null }
$cleanupTmp = $null

if ($scriptDir -and (Test-Path (Join-Path $scriptDir 'skills'))) {
  $root = $scriptDir
} else {
  Write-Host "Downloading latest claude-skills from GitHub (to learn installed names)..."
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
$userSettingsPath = Join-Path (Join-Path $HOME '.claude') 'settings.json'

$count = 0

if (-not (Test-Path -LiteralPath $dest)) {
  Write-Output "bundle:          $dest does not exist (nothing to remove there)"
} else {
  Get-ChildItem (Join-Path $root 'skills') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $target = Join-Path $dest "skills\$($_.Name)"
    if (Test-Path -LiteralPath $target) {
      Remove-Item -Recurse -Force $target
      Write-Output "removed skill:   $($_.Name)"
      $count++
    }
  }

  Get-ChildItem (Join-Path $root 'agents') -File -Filter *.md -ErrorAction SilentlyContinue | ForEach-Object {
    $target = Join-Path $dest "agents\$($_.Name)"
    if (Test-Path -LiteralPath $target) {
      Remove-Item -Force $target
      Write-Output "removed agent:   $($_.Name)"
      $count++
    }
  }

  $panel = Join-Path $root 'agents\panelists'
  if (Test-Path -LiteralPath $panel) {
    Get-ChildItem $panel -File -Filter *.md | ForEach-Object {
      $target = Join-Path $dest "agents\panelists\$($_.Name)"
      if (Test-Path -LiteralPath $target) {
        Remove-Item -Force $target
        Write-Output "removed agent:   panelists/$($_.Name)"
        $count++
      }
    }
  }

  $panelDest = Join-Path $dest 'agents\panelists'
  if (Test-Path -LiteralPath $panelDest) {
    $left = @(Get-ChildItem -LiteralPath $panelDest -Force -ErrorAction SilentlyContinue)
    if ($left.Count -eq 0) {
      Remove-Item -Force $panelDest
      Write-Output "removed empty:   agents/panelists"
    }
  }

  $poolDest = Join-Path $dest 'pool.md'
  if (Test-Path -LiteralPath $poolDest) {
    Remove-Item -Force $poolDest
    Write-Output "removed pool:    pool.md"
    $count++
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

function Remove-SettingsEnvKeys {
  param(
    [string] $Path,
    [string[]] $Names
  )
  if (-not (Test-Path -LiteralPath $Path)) {
    return @()
  }

  $py = Get-UsablePython
  if ($py) {
    $env:SETTINGS_PATH = $Path
    $env:SETTINGS_ENV_NAMES = ($Names -join ',')
    $code = @'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
names = [n for n in os.environ.get("SETTINGS_ENV_NAMES", "").split(",") if n]
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"error: could not parse {path}: {e}", file=sys.stderr)
    sys.exit(1)
if not isinstance(data, dict):
    print("")
    sys.exit(0)
env = data.get("env")
if not isinstance(env, dict):
    print("")
    sys.exit(0)
removed = [k for k in names if k in env]
for k in removed:
    del env[k]
if not env:
    data.pop("env", None)
else:
    data["env"] = env
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(",".join(removed))
'@
    try {
      $out = $code | & $py -
      if ($LASTEXITCODE -ne 0) { throw "python settings write failed (exit $LASTEXITCODE)" }
      if ([string]::IsNullOrWhiteSpace($out)) { return @() }
      return @($out.Trim() -split ',' | Where-Object { $_ })
    } finally {
      Remove-Item Env:SETTINGS_PATH -ErrorAction SilentlyContinue
      Remove-Item Env:SETTINGS_ENV_NAMES -ErrorAction SilentlyContinue
    }
  }

  # Fallback: ConvertFrom-Json / ConvertTo-Json (may reformat nested hooks)
  $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
  if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
  $obj = $raw | ConvertFrom-Json
  if ($null -eq $obj.env) { return @() }
  $removed = New-Object System.Collections.Generic.List[string]
  foreach ($n in $Names) {
    if ($obj.env.PSObject.Properties.Name -contains $n) {
      $obj.env.PSObject.Properties.Remove($n)
      $removed.Add($n) | Out-Null
    }
  }
  $envProps = @($obj.env.PSObject.Properties)
  if ($envProps.Count -eq 0) {
    $obj.PSObject.Properties.Remove('env')
  }
  $json = $obj | ConvertTo-Json -Depth 100
  [System.IO.File]::WriteAllText($Path, $json + [Environment]::NewLine)
  return @($removed)
}

if ($RemoveKeys) {
  if (-not (Test-Path -LiteralPath $userSettingsPath)) {
    Write-Output "keys:            no $userSettingsPath"
  } else {
    $removed = Remove-SettingsEnvKeys -Path $userSettingsPath -Names @('BRAVE_API_KEY', 'BRAVE_SEARCH_API_KEY', 'TAVILY_API_KEY')
    if ($removed.Count -gt 0) {
      Write-Output "keys:            removed $($removed -join ', ') from $userSettingsPath — restart Claude Code"
    } else {
      Write-Output "keys:            none of BRAVE_* / TAVILY_API_KEY present in $userSettingsPath"
    }
  }
}

if ($cleanupTmp -and (Test-Path $cleanupTmp)) {
  Remove-Item -Recurse -Force $cleanupTmp -ErrorAction SilentlyContinue
}

Write-Output "done: $count items removed from $dest"
if (-not $RemoveKeys) {
  Write-Output "note: global tools (ddgs, tvly, npm pkgs) left installed; pass -RemoveKeys to drop API keys from settings"
} else {
  Write-Output "note: global tools (ddgs, tvly, npm pkgs) left installed"
}
