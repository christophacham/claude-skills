#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Idempotently clone a GitHub repo into $env:USERPROFILE\code\tmp\<name>.

.DESCRIPTION
  Accepts owner/repo or a github.com URL (including /tree /blob /issues paths,
  .git suffix, query/hash). Creates the tmp root if needed. Skips clone when
  the dest already has a .git. Default is shallow (--depth 1).

.PARAMETER Repo
  owner/repo or https://github.com/owner/repo[.git][/...]

.PARAMETER Full
  Clone full history instead of --depth 1.

.EXAMPLE
  ./ensure-clone.ps1 -Repo oraios/serena

.EXAMPLE
  ./ensure-clone.ps1 -Repo https://github.com/oraios/serena/tree/main
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $Repo,

    [switch] $Full
)

$ErrorActionPreference = 'Stop'

function Get-RepoSlug {
    param([string] $Raw)

    if ([string]::IsNullOrWhiteSpace($Raw)) {
        throw 'Need owner/repo or a GitHub URL. Got empty input.'
    }

    $r = $Raw.Trim().TrimEnd('/')

    # git@github.com:owner/repo.git or https://github.com/owner/repo[/tree/...]
    if ($r -match '(?i)(?:https?://|git@)(?:www\.)?([^/:]+)[:/]+([^/\s]+)/([^/\s#?]+)') {
        $hostName = $Matches[1] -replace '^www\.', ''
        $owner = $Matches[2]
        $name = $Matches[3] -replace '\.git$', ''
        if ($hostName -notmatch '(?i)github\.com$') {
            throw "Only github.com is supported. Host: $hostName"
        }
        if ($owner -match '^(?i)https?$' -or [string]::IsNullOrWhiteSpace($name)) {
            throw "Need owner/repo or a GitHub URL. Got: $Raw"
        }
        return [pscustomobject]@{
            Host = 'github.com'
            Slug = "$owner/$name"
            Name = $name
        }
    }

    # bare owner/repo
    if ($r -match '^(?i)([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '\.git$', ''
        return [pscustomobject]@{
            Host = 'github.com'
            Slug = "$owner/$name"
            Name = $name
        }
    }

    throw "Need owner/repo or a GitHub URL. Got: $Raw"
}

$parsed = Get-RepoSlug -Raw $Repo
$slug = $parsed.Slug
$name = $parsed.Name
$destRoot = Join-Path $env:USERPROFILE 'code\tmp'
$dest = Join-Path $destRoot $name

if (-not (Test-Path -LiteralPath $destRoot)) {
    New-Item -ItemType Directory -Force -Path $destRoot | Out-Null
}

$gitDir = Join-Path $dest '.git'
if (Test-Path -LiteralPath $gitDir) {
    $remote = ''
    try {
        $remote = & git -C $dest remote get-url origin 2>$null
    } catch { }
    Write-Output "STATUS=EXISTS"
    Write-Output "PATH=$dest"
    Write-Output "SLUG=$slug"
    Write-Output "REMOTE=$remote"
    exit 0
}

if (Test-Path -LiteralPath $dest) {
    $items = @(Get-ChildItem -LiteralPath $dest -Force -ErrorAction SilentlyContinue)
    if ($items.Count -gt 0) {
        Write-Output "STATUS=BLOCKED"
        Write-Output "PATH=$dest"
        Write-Output "SLUG=$slug"
        Write-Output "ERROR=Path exists, is non-empty, and is not a git repo. Remove or rename it, then retry."
        exit 2
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Output "STATUS=ERROR"
    Write-Output "ERROR=gh CLI not found on PATH"
    exit 3
}

$cloneArgs = @('repo', 'clone', $slug, $dest)
if (-not $Full) {
    $cloneArgs += @('--', '--depth', '1')
}

& gh @cloneArgs
if ($LASTEXITCODE -ne 0) {
    Write-Output "STATUS=ERROR"
    Write-Output "PATH=$dest"
    Write-Output "SLUG=$slug"
    Write-Output "ERROR=gh repo clone failed (exit $LASTEXITCODE)"
    exit $LASTEXITCODE
}

Write-Output "STATUS=CLONED"
Write-Output "PATH=$dest"
Write-Output "SLUG=$slug"
Write-Output "SHALLOW=$([bool](-not $Full))"
exit 0
