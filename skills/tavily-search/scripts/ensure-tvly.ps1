#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Ensure the Tavily CLI (`tvly`) is on PATH; install via uv/pip if missing.

.DESCRIPTION
  Read-only check with -CheckOnly. Install is idempotent. Does NOT authenticate —
  needs TAVILY_API_KEY in env / ~/.claude/settings.json, or `tvly login`.

.EXAMPLE
  ./ensure-tvly.ps1
  ./ensure-tvly.ps1 -CheckOnly
#>
[CmdletBinding()]
param([switch] $CheckOnly)

$ErrorActionPreference = 'Stop'

function Find-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try {
            $p = & py -3 -c "import sys; print(sys.executable) if sys.version_info >= (3, 10) else sys.exit(1)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() }
        } catch {}
    }
    foreach ($name in @('python', 'python3')) {
        if (Get-Command $name -ErrorAction SilentlyContinue) {
            try {
                $p = & $name -c "import sys; print(sys.executable) if sys.version_info >= (3, 10) else sys.exit(1)" 2>$null
                if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() }
            } catch {}
        }
    }
    $local = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.13-64\python.exe'
    if (Test-Path -LiteralPath $local) { return $local }
    return $null
}

function Test-Tvly {
    if (-not (Get-Command tvly -ErrorAction SilentlyContinue)) { return $false }
    try {
        & tvly --help 1>$null 2>$null
        return ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq $null)
    } catch {
        return $false
    }
}

function Get-KeyState {
    if (-not [string]::IsNullOrWhiteSpace($env:TAVILY_API_KEY)) { return 'env' }
    $settings = Join-Path $env:USERPROFILE '.claude\settings.json'
    if (Test-Path -LiteralPath $settings) {
        try {
            $obj = Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
            if ($obj.env -and -not [string]::IsNullOrWhiteSpace([string]$obj.env.TAVILY_API_KEY)) {
                return 'settings'
            }
        } catch {}
    }
    return 'missing'
}

$has = Test-Tvly
$key = Get-KeyState

if ($has) {
    $ver = ''
    try { $ver = (& tvly --version 2>$null | Out-String).Trim() } catch {}
    if (-not $ver) {
        try {
            $st = (& tvly --status 2>$null | Out-String).Trim()
            if ($st) { $ver = ($st -split "`n")[0].Trim() }
        } catch {}
    }
    Write-Output 'STATUS: READY'
    Write-Output "TVLY:   $(if ($ver) { $ver } else { 'present' })"
    Write-Output "KEY:    $key"
    exit 0
}

if ($CheckOnly) {
    Write-Output 'STATUS: MISSING'
    Write-Output 'TVLY:   not on PATH'
    Write-Output "KEY:    $key"
    exit 2
}

Write-Output 'STATUS: INSTALLING'
if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv tool install tavily-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Output 'STATUS: ERROR'
        Write-Output 'REASON: uv tool install tavily-cli failed'
        exit 1
    }
} else {
    $py = Find-Python
    if (-not $py) {
        Write-Output 'STATUS: ERROR'
        Write-Output 'REASON: no uv and no Python 3.10+ — install from https://docs.tavily.com or: pip install tavily-cli'
        exit 1
    }
    Write-Output "PYTHON: $py"
    & $py -m pip install -U tavily-cli
    if ($LASTEXITCODE -ne 0) {
        Write-Output 'STATUS: ERROR'
        Write-Output 'REASON: pip install tavily-cli failed'
        exit 1
    }
}

if (-not (Test-Tvly)) {
    Write-Output 'STATUS: ERROR'
    Write-Output 'REASON: tvly still not on PATH after install (open a new shell or add Scripts to PATH)'
    Write-Output 'HINT:   uv tool install tavily-cli   OR   pip install tavily-cli'
    exit 1
}

Write-Output 'STATUS: READY'
Write-Output 'TVLY:   installed'
Write-Output "KEY:    $key"
if ($key -eq 'missing') {
    Write-Output 'HINT:   set TAVILY_API_KEY (tavily.com) or run: tvly login --api-key tvly-…'
}
exit 0
