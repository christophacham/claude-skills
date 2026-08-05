#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Idempotently clone a GitHub repo into the user profile's code\tmp\<name>.

.DESCRIPTION
  Accepts owner/repo or an anchored github.com URL (including subpaths, .git,
  query, or hash). Creates the tmp root if needed. Reuses only a clone whose
  origin matches the requested slug. Default is shallow (--depth 1).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Repo,

    [switch] $Full
)

$ErrorActionPreference = 'Stop'

function Get-UserHome {
    $candidates = @($env:USERPROFILE, $HOME, [Environment]::GetFolderPath('UserProfile'))
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return [string]$candidate
        }
    }
    throw 'Could not resolve the current user home directory.'
}

function Get-RepoSlug {
    param([string] $Raw)

    if ([string]::IsNullOrWhiteSpace($Raw)) {
        throw 'Need owner/repo or a GitHub URL. Got empty input.'
    }

    $value = $Raw.Trim().TrimEnd('/')
    $owner = $null
    $name = $null

    if ($value -match '(?i)^https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '\.git$', ''
    } elseif ($value -match '(?i)^git@github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '\.git$', ''
    } elseif ($value -match '^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '\.git$', ''
    } else {
        throw "Need owner/repo or an anchored github.com URL. Got: $Raw"
    }

    if ($owner -notmatch '^[A-Za-z0-9_.-]+$' -or
        $name -notmatch '^[A-Za-z0-9_.-]+$' -or
        $owner -in @('.', '..') -or
        $name -in @('.', '..')) {
        throw "Invalid GitHub owner/repository: $Raw"
    }

    return [pscustomobject]@{
        Slug = "$owner/$name"
        Name = $name
    }
}

function Write-Blocked {
    param(
        [string] $Path,
        [string] $Slug,
        [string] $Reason
    )
    Write-Output 'STATUS=BLOCKED'
    Write-Output "PATH=$Path"
    Write-Output "SLUG=$Slug"
    Write-Output "ERROR=$Reason"
    exit 2
}

$parsed = Get-RepoSlug -Raw $Repo
$slug = $parsed.Slug
$name = $parsed.Name
$destRoot = [IO.Path]::GetFullPath((Join-Path (Join-Path (Get-UserHome) 'code') 'tmp'))
$dest = [IO.Path]::GetFullPath((Join-Path $destRoot $name))
if ([IO.Path]::GetDirectoryName($dest) -ne $destRoot) {
    throw 'Destination escaped the temporary root.'
}

if (-not (Test-Path -LiteralPath $destRoot)) {
    New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
}

if (Test-Path -LiteralPath $dest) {
    $item = Get-Item -LiteralPath $dest -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Write-Blocked -Path $dest -Slug $slug -Reason 'Path is a symbolic link; refusing to reuse it.'
    }
}

$gitDir = Join-Path $dest '.git'
if (Test-Path -LiteralPath $gitDir) {
    $remote = ''
    try { $remote = (& git -C $dest remote get-url origin 2>$null).Trim() } catch {}
    if ([string]::IsNullOrWhiteSpace($remote)) {
        Write-Blocked -Path $dest -Slug $slug -Reason 'Existing git repo has no canonical GitHub origin.'
    }
    try { $remoteSlug = (Get-RepoSlug -Raw $remote).Slug } catch {
        Write-Blocked -Path $dest -Slug $slug -Reason 'Existing git repo origin is not a canonical GitHub repository.'
    }
    if ($remoteSlug -ne $slug) {
        Write-Blocked -Path $dest -Slug $slug -Reason "Existing git repo origin is $remoteSlug, not requested $slug."
    }
    Write-Output 'STATUS=EXISTS'
    Write-Output "PATH=$dest"
    Write-Output "SLUG=$slug"
    Write-Output "REMOTE=$remote"
    exit 0
}

if (Test-Path -LiteralPath $dest) {
    $items = @(Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue)
    if ($items.Count -gt 0) {
        Write-Blocked -Path $dest -Slug $slug -Reason 'Path exists, is non-empty, and is not a git repo. Remove or rename it, then retry.'
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Output 'STATUS=ERROR'
    Write-Output 'ERROR=gh CLI not found on PATH'
    exit 3
}

$cloneArgs = @('repo', 'clone', $slug, $dest)
if (-not $Full) {
    $cloneArgs += @('--', '--depth', '1')
}

& gh @cloneArgs
if ($LASTEXITCODE -ne 0) {
    Write-Output 'STATUS=ERROR'
    Write-Output "PATH=$dest"
    Write-Output "SLUG=$slug"
    Write-Output "ERROR=gh repo clone failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

Write-Output 'STATUS=CLONED'
Write-Output "PATH=$dest"
Write-Output "SLUG=$slug"
Write-Output "SHALLOW=$([bool](-not $Full))"
exit 0
