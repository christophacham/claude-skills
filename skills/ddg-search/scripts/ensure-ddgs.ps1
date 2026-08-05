#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Ensure the ddgs Python package is importable; install if missing.

.DESCRIPTION
  Picks a usable Python (prefers py -3, then python on PATH that is not a
  broken stub), then `python -m pip install -U ddgs` when import fails.
  Idempotent. Prints STATUS lines for the agent.

.EXAMPLE
  ./ensure-ddgs.ps1
  ./ensure-ddgs.ps1 -CheckOnly
#>
[CmdletBinding()]
param(
    [switch] $CheckOnly
)

$ErrorActionPreference = 'Stop'

function Find-Python {
    # Prefer the py launcher's 3.x, then first real python.exe on PATH.
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try {
            $p = & py -3 -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $p -and (Test-Path -LiteralPath $p.Trim())) {
                return $p.Trim()
            }
        } catch {}
    }
    $candidates = @()
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $candidates += (Get-Command python).Source
    }
    $local = Join-Path $env:LOCALAPPDATA 'Python\pythoncore-3.13-64\python.exe'
    if (Test-Path -LiteralPath $local) { $candidates += $local }
    $local2 = Join-Path $env:LOCALAPPDATA 'Python\bin\python.exe'
    if (Test-Path -LiteralPath $local2) { $candidates += $local2 }

    foreach ($c in $candidates) {
        try {
            $out = & $c -c "import sys; print(sys.executable)" 2>$null
            if ($LASTEXITCODE -eq 0 -and $out) { return $out.Trim() }
        } catch {}
    }
    return $null
}

$py = Find-Python
if (-not $py) {
    Write-Output 'STATUS: ERROR'
    Write-Output 'REASON: no usable Python 3 found (need >= 3.10)'
    Write-Output 'HINT: install Python from https://www.python.org/ or `winget install Python.Python.3.13`'
    exit 1
}

$check = & $py -c "import importlib.util; import sys; s=importlib.util.find_spec('ddgs'); print(s.origin if s else '')" 2>$null
$installed = ($LASTEXITCODE -eq 0 -and $check -and $check.Trim().Length -gt 0)

if ($installed) {
    $ver = & $py -c "import ddgs; print(getattr(ddgs,'__version__','unknown'))" 2>$null
    Write-Output 'STATUS: READY'
    Write-Output "PYTHON: $py"
    Write-Output "DDGS:   $ver"
    exit 0
}

if ($CheckOnly) {
    Write-Output 'STATUS: MISSING'
    Write-Output "PYTHON: $py"
    Write-Output 'DDGS:   not installed'
    exit 2
}

Write-Output "STATUS: INSTALLING"
Write-Output "PYTHON: $py"
& $py -m pip install -U ddgs
if ($LASTEXITCODE -ne 0) {
    Write-Output 'STATUS: ERROR'
    Write-Output 'REASON: pip install ddgs failed'
    exit 1
}

$ver = & $py -c "import ddgs; print(getattr(ddgs,'__version__','unknown'))" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Output 'STATUS: ERROR'
    Write-Output 'REASON: ddgs still not importable after install'
    exit 1
}
Write-Output 'STATUS: READY'
Write-Output "PYTHON: $py"
Write-Output "DDGS:   $ver"
exit 0
