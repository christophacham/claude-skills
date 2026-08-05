# Ensure cocoindex-code index for the current project.
# Usage:
#   .\ensure-index.ps1              # run ccc index if initialized
#   .\ensure-index.ps1 -Status      # status only (read-only)
#   .\ensure-index.ps1 -DryRun
param(
  [switch]$Status,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ccc = Get-Command ccc -ErrorAction SilentlyContinue
if (-not $ccc) {
  $fallback = Join-Path $env:USERPROFILE ".local\bin\ccc.exe"
  if (Test-Path $fallback) {
    Set-Alias -Name ccc -Value $fallback -Scope Script
  } else {
    Write-Output "ccc: not on PATH (install: uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]')"
    exit 1
  }
}

$root = if ($env:CLAUDE_PROJECT_DIR) { $env:CLAUDE_PROJECT_DIR } else { Get-Location }
Set-Location $root

if (-not (Test-Path ".cocoindex_code")) {
  Write-Output "ccc: project not initialized (no .cocoindex_code). Run: ccc init --force && ccc index"
  exit 2
}

if ($Status) {
  ccc status
  exit 0
}

if ($DryRun) {
  Write-Output "would run: ccc index  (cwd=$(Get-Location))"
  try { ccc status } catch {}
  exit 0
}

ccc index
