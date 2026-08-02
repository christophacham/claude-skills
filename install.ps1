# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage: .\install.ps1 [-Project]   (-Project installs into .\.claude\ instead)
param([switch]$Project)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
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
Copy-Item -Force (Join-Path $root 'pool.md') (Join-Path $dest 'pool.md')
Write-Output "installed pool:   pool.md -> $dest\pool.md"
# stale cleanup: pool used to live inside the skill dir
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $dest 'skills\work-loop\pool.md')
Write-Output "done: $count items installed into $dest"
