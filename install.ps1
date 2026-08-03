# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  .\install.ps1 [-Project]
# Usage (remote): iwr -useb https://raw.githubusercontent.com/christophacham/claude-skills/main/install.ps1 | iex
param([switch]$Project)

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
  Invoke-RestMethod -Uri 'https://github.com/christophacham/claude-skills/archive/refs/heads/main.zip' -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
  $root = Join-Path $tmpDir 'claude-skills-main'
}

$dest = if ($Project) { Join-Path (Get-Location) '.claude' } else { Join-Path $HOME '.claude' }
New-Item -ItemType Directory -Force (Join-Path $dest 'skills') | Out-Null
New-Item -ItemType Directory -Force (Join-Path $dest 'agents') | Out-Null

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
# stale cleanup: pool used to live inside the skill dir
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'skills\work-loop\pool.md')

if ($cleanupTmp -and (Test-Path $cleanupTmp)) {
  Remove-Item -Recurse -Force $cleanupTmp -ErrorAction SilentlyContinue
}

Write-Output "done: $count items installed into $dest"
