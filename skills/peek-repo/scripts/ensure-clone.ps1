#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Safely clone a GitHub repo into the user profile's code\tmp\<name>.

.DESCRIPTION
  Accepts owner/repo or an anchored github.com URL. Reuses only a standalone
  clone whose origin matches the requested slug. New clones use private staging
  and no-clobber finalization. Default history is shallow.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string] $Repo = '',

    [switch] $Full
)

$ErrorActionPreference = 'Stop'
if (Test-Path Variable:PSNativeCommandUseErrorActionPreference) {
    $PSNativeCommandUseErrorActionPreference = $false
}
$env:GH_PROMPT_DISABLED = '1'
$env:GIT_TERMINAL_PROMPT = '0'
$env:GCM_INTERACTIVE = 'Never'

$script:Stage = ''
$script:StageOwned = $false
$script:DestRoot = ''
$script:Dest = ''
$script:Slug = ''
$script:IsWindowsPlatform = $env:OS -eq 'Windows_NT'

function Write-CommonResult {
    param(
        [string] $Status,
        [int] $Code
    )
    Write-Output "STATUS=$Status"
    Write-Output "EXIT_CODE=$Code"
    if (-not [string]::IsNullOrWhiteSpace($script:Dest)) {
        Write-Output "PATH=$($script:Dest)"
    }
    if (-not [string]::IsNullOrWhiteSpace($script:Slug)) {
        Write-Output "SLUG=$($script:Slug)"
    }
}

function Stop-Helper {
    param(
        [int] $Code,
        [string] $Status,
        [string] $Kind,
        [string] $Detail,
        [Nullable[int]] $CommandExit = $null
    )
    Write-CommonResult -Status $Status -Code $Code
    Write-Output "ERROR=$Kind"
    Write-Output "DETAIL=$Detail"
    if ($null -ne $CommandExit) {
        Write-Output "COMMAND_EXIT=$CommandExit"
    }
    exit $Code
}

function Stop-Blocked {
    param(
        [string] $Kind,
        [string] $Detail
    )
    Stop-Helper -Code 2 -Status 'BLOCKED' -Kind $Kind -Detail $Detail
}

function Get-RepoSlug {
    param([string] $Raw)

    if ([string]::IsNullOrWhiteSpace($Raw)) {
        throw 'INVALID_REPOSITORY'
    }

    $value = $Raw.Trim().TrimEnd('/')
    $owner = $null
    $name = $null

    if ($value -match '(?i)^https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(?:/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '(?i)\.git$', ''
    } elseif ($value -match '(?i)^git@github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '(?i)\.git$', ''
    } elseif ($value -match '^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$') {
        $owner = $Matches[1]
        $name = $Matches[2] -replace '(?i)\.git$', ''
    } else {
        throw 'INVALID_REPOSITORY'
    }

    if ([string]::IsNullOrWhiteSpace($owner) -or
        [string]::IsNullOrWhiteSpace($name) -or
        $owner -notmatch '^[A-Za-z0-9_.-]+$' -or
        $name -notmatch '^[A-Za-z0-9_.-]+$' -or
        $owner -in @('.', '..') -or
        $name -in @('.', '..')) {
        throw 'INVALID_REPOSITORY'
    }

    return [pscustomobject]@{
        Slug = "$owner/$name"
        Name = $name
    }
}

function Get-UserHome {
    $candidates = @($env:USERPROFILE, $HOME, [Environment]::GetFolderPath('UserProfile'))
    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            if ($candidate.Contains("`n") -or $candidate.Contains("`r")) {
                Stop-Helper -Code 2 -Status 'ERROR' -Kind 'HOME_INVALID' -Detail 'The user home contains a line break.'
            }
            return [IO.Path]::GetFullPath([string]$candidate)
        }
    }
    Stop-Helper -Code 2 -Status 'ERROR' -Kind 'HOME_UNSET' -Detail 'Could not resolve the current user home directory.'
}

function Get-PathItem {
    param([string] $LiteralPath)
    try {
        return Get-Item -LiteralPath $LiteralPath -Force -ErrorAction Stop
    } catch [System.Management.Automation.ItemNotFoundException] {
        return $null
    } catch [System.IO.FileNotFoundException] {
        return $null
    } catch [System.IO.DirectoryNotFoundException] {
        return $null
    }
}

function Test-ReparsePoint {
    param([System.IO.FileSystemInfo] $Item)
    return (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)
}

function Test-PathEqual {
    param(
        [string] $Left,
        [string] $Right
    )
    $comparison = if ($script:IsWindowsPlatform) {
        [StringComparison]::OrdinalIgnoreCase
    } else {
        [StringComparison]::Ordinal
    }
    $separators = [char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
    $leftFull = [IO.Path]::GetFullPath($Left).TrimEnd($separators)
    $rightFull = [IO.Path]::GetFullPath($Right).TrimEnd($separators)
    return [string]::Equals($leftFull, $rightFull, $comparison)
}

function Ensure-SafeDirectory {
    param(
        [string] $Path,
        [string] $Label
    )
    $item = Get-PathItem -LiteralPath $Path
    if ($null -eq $item) {
        try {
            New-Item -ItemType Directory -Path $Path -ErrorAction Stop | Out-Null
        } catch {
            Stop-Helper -Code 4 -Status 'ERROR' -Kind 'ROOT_CREATE_FAILED' -Detail 'Could not create the inspection root.'
        }
        $item = Get-PathItem -LiteralPath $Path
    }
    if ($null -eq $item -or -not $item.PSIsContainer) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'UNSAFE_ROOT' -Detail "$Label exists but is not a directory."
    }
    if (Test-ReparsePoint -Item $item) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'UNSAFE_ROOT' -Detail "$Label is a symbolic link or reparse point; refusing to follow it."
    }
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath
    if (-not (Test-PathEqual -Left $resolved -Right $Path)) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'UNSAFE_ROOT' -Detail "$Label does not resolve to its physical path."
    }
}

function Invoke-Captured {
    param(
        [string] $Executable,
        [string[]] $Arguments
    )
    $lines = @(& $Executable @Arguments 2>$null)
    $code = $LASTEXITCODE
    return [pscustomobject]@{
        Code = [int]$code
        Output = (($lines | ForEach-Object { [string]$_ }) -join "`n").Trim()
    }
}

function Assert-ExistingOrigin {
    param([string] $RepositoryPath)

    $remoteResult = Invoke-Captured -Executable 'git' -Arguments @('-C', $RepositoryPath, 'remote', 'get-url', 'origin')
    if ($remoteResult.Code -ne 0 -or [string]::IsNullOrWhiteSpace($remoteResult.Output)) {
        Stop-Blocked -Kind 'ORIGIN_INVALID' -Detail 'Existing git repo has no canonical GitHub origin.'
    }
    try {
        $remoteSlug = (Get-RepoSlug -Raw $remoteResult.Output).Slug
    } catch {
        Stop-Blocked -Kind 'ORIGIN_INVALID' -Detail 'Existing git repo origin is not a canonical GitHub repository.'
    }
    if (-not [string]::Equals($remoteSlug, $script:Slug, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Blocked -Kind 'ORIGIN_MISMATCH' -Detail "Existing git repo origin is $remoteSlug, not requested $($script:Slug)."
    }
    return $remoteSlug
}

function Get-ShallowState {
    param([string] $RepositoryPath)
    $result = Invoke-Captured -Executable 'git' -Arguments @('-C', $RepositoryPath, 'rev-parse', '--is-shallow-repository')
    if ($result.Code -ne 0 -or $result.Output -notin @('true', 'false')) {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'GIT_VALIDATION_FAILED' -Detail 'Could not determine repository history depth.'
    }
    return $result.Output
}

function New-PrivateStage {
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $leaf = ".peek-repo-$($script:RepoName)-$([Guid]::NewGuid().ToString('N'))"
        $candidate = Join-Path $script:DestRoot $leaf
        try {
            $created = New-Item -ItemType Directory -Path $candidate -ErrorAction Stop
            if (Test-ReparsePoint -Item $created) {
                Stop-Helper -Code 4 -Status 'ERROR' -Kind 'STAGING_UNSAFE' -Detail 'Private staging is a symbolic link or reparse point.'
            }
            $script:Stage = [IO.Path]::GetFullPath($created.FullName)
            $script:StageOwned = $true
            return
        } catch [System.IO.IOException] {
            continue
        }
    }
    Stop-Helper -Code 4 -Status 'ERROR' -Kind 'STAGING_CREATE_FAILED' -Detail 'Could not create a private staging directory.'
}

function Move-DirectoryNoClobber {
    param(
        [string] $Source,
        [string] $Destination
    )

    try {
        # Directory.Move maps to an atomic rename on the local filesystem and
        # throws when the destination already exists; it is cross-platform in pwsh.
        [IO.Directory]::Move($Source, $Destination)
        return $true
    } catch [System.IO.IOException] {
        if ($null -ne (Get-PathItem -LiteralPath $Destination)) {
            return $false
        }
        throw
    }
}

function Remove-OwnedStage {
    if (-not $script:StageOwned -or [string]::IsNullOrWhiteSpace($script:Stage)) {
        return
    }
    $item = Get-PathItem -LiteralPath $script:Stage
    if ($null -eq $item) {
        return
    }
    $parent = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($script:Stage))
    if (-not (Test-PathEqual -Left $parent -Right $script:DestRoot)) {
        return
    }
    if (Test-ReparsePoint -Item $item) {
        Remove-Item -LiteralPath $script:Stage -Force -ErrorAction SilentlyContinue
        return
    }
    Remove-Item -LiteralPath $script:Stage -Recurse -Force -ErrorAction SilentlyContinue
}

function Invoke-Main {
    try {
        $parsed = Get-RepoSlug -Raw $Repo
    } catch {
        Stop-Helper -Code 2 -Status 'ERROR' -Kind 'INVALID_REPOSITORY' -Detail 'Need owner/repo or an anchored github.com URL.'
    }
    $script:Slug = $parsed.Slug
    $script:RepoName = $parsed.Name

    $homePath = Get-UserHome
    $homeItem = Get-PathItem -LiteralPath $homePath
    if ($null -eq $homeItem -or -not $homeItem.PSIsContainer) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'HOME_INVALID' -Detail 'The user home is not an existing directory.'
    }
    if (Test-ReparsePoint -Item $homeItem) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'HOME_INVALID' -Detail 'The user home is a symbolic link or reparse point; refusing to follow it.'
    }
    $resolvedHome = (Resolve-Path -LiteralPath $homePath -ErrorAction Stop).ProviderPath
    if (-not (Test-PathEqual -Left $resolvedHome -Right $homePath)) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'HOME_INVALID' -Detail 'The user home does not resolve to its physical path.'
    }

    $codeRoot = [IO.Path]::GetFullPath((Join-Path $homePath 'code'))
    $script:DestRoot = [IO.Path]::GetFullPath((Join-Path $codeRoot 'tmp'))
    Ensure-SafeDirectory -Path $codeRoot -Label 'The code directory'
    Ensure-SafeDirectory -Path $script:DestRoot -Label 'The temporary inspection directory'

    $script:Dest = [IO.Path]::GetFullPath((Join-Path $script:DestRoot $script:RepoName))
    if (-not (Test-PathEqual -Left ([IO.Path]::GetDirectoryName($script:Dest)) -Right $script:DestRoot)) {
        Stop-Helper -Code 2 -Status 'ERROR' -Kind 'DESTINATION_ESCAPE' -Detail 'Destination escaped the temporary inspection root.'
    }

    $destItem = Get-PathItem -LiteralPath $script:Dest
    if ($null -ne $destItem) {
        if (Test-ReparsePoint -Item $destItem) {
            Stop-Blocked -Kind 'DESTINATION_LINK' -Detail 'Path is a symbolic link or reparse point; refusing to reuse it.'
        }
        if (-not $destItem.PSIsContainer) {
            Stop-Blocked -Kind 'DESTINATION_OCCUPIED' -Detail 'Path already exists and is not a git repository directory.'
        }
        $resolvedDest = (Resolve-Path -LiteralPath $script:Dest -ErrorAction Stop).ProviderPath
        if (-not (Test-PathEqual -Left $resolvedDest -Right $script:Dest)) {
            Stop-Blocked -Kind 'DESTINATION_ESCAPE' -Detail 'Existing path resolves outside its direct physical location.'
        }

        $gitMetadata = Get-PathItem -LiteralPath (Join-Path $script:Dest '.git')
        if ($null -eq $gitMetadata -or -not $gitMetadata.PSIsContainer -or (Test-ReparsePoint -Item $gitMetadata)) {
            Stop-Blocked -Kind 'DESTINATION_OCCUPIED' -Detail 'Path already exists and is not a standalone git repository.'
        }
        if (-not (Get-Command git -CommandType Application -ErrorAction SilentlyContinue)) {
            Stop-Helper -Code 3 -Status 'ERROR' -Kind 'GIT_NOT_FOUND' -Detail 'git CLI not found on PATH.'
        }

        $topResult = Invoke-Captured -Executable 'git' -Arguments @('-C', $script:Dest, 'rev-parse', '--show-toplevel')
        if ($topResult.Code -ne 0 -or [string]::IsNullOrWhiteSpace($topResult.Output)) {
            Stop-Blocked -Kind 'DESTINATION_OCCUPIED' -Detail 'Path already exists but is not a valid git repository.'
        }
        if (-not (Test-PathEqual -Left $topResult.Output -Right $script:Dest)) {
            Stop-Blocked -Kind 'DESTINATION_ESCAPE' -Detail 'Repository top level is not the requested destination.'
        }

        $remoteSlug = Assert-ExistingOrigin -RepositoryPath $script:Dest
        $shallow = Get-ShallowState -RepositoryPath $script:Dest
        $action = 'NONE'
        $freshness = 'NOT_CHECKED'

        if ($Full -and $shallow -eq 'true') {
            $previousSshCommand = $env:GIT_SSH_COMMAND
            $env:GIT_SSH_COMMAND = 'ssh -o BatchMode=yes'
            try {
                $fetch = Invoke-Captured -Executable 'git' -Arguments @(
                    '-C', $script:Dest,
                    '-c', 'credential.interactive=never',
                    '-c', 'core.askPass=',
                    '-c', 'protocol.ext.allow=never',
                    '-c', 'protocol.file.allow=never',
                    'fetch', '--unshallow', 'origin',
                    '+refs/heads/*:refs/remotes/origin/*', '--tags'
                )
            } finally {
                $env:GIT_SSH_COMMAND = $previousSshCommand
            }
            if ($fetch.Code -ne 0) {
                Stop-Helper -Code 7 -Status 'ERROR' -Kind 'UNSHALLOW_FAILED' -Detail 'Could not fetch full branch and tag history without prompting.' -CommandExit $fetch.Code
            }

            $remoteSlug = Assert-ExistingOrigin -RepositoryPath $script:Dest
            $shallow = Get-ShallowState -RepositoryPath $script:Dest
            if ($shallow -ne 'false') {
                Stop-Helper -Code 7 -Status 'ERROR' -Kind 'UNSHALLOW_INCOMPLETE' -Detail 'Git fetch completed but the repository is still shallow.'
            }
            $action = 'UNSHALLOWED'
            $freshness = 'WORKTREE_NOT_UPDATED'
        }

        Write-CommonResult -Status 'EXISTS' -Code 0
        Write-Output "REMOTE=https://github.com/$remoteSlug.git"
        Write-Output "ACTION=$action"
        Write-Output "SHALLOW=$shallow"
        Write-Output "FRESHNESS=$freshness"
        Write-Output 'ORIGIN_CHECK=PASSED'
        exit 0
    }

    if (-not (Get-Command git -CommandType Application -ErrorAction SilentlyContinue)) {
        Stop-Helper -Code 3 -Status 'ERROR' -Kind 'GIT_NOT_FOUND' -Detail 'git CLI not found on PATH.'
    }

    New-PrivateStage
    if (-not (Test-PathEqual -Left ([IO.Path]::GetDirectoryName($script:Stage)) -Right $script:DestRoot)) {
        Stop-Helper -Code 4 -Status 'ERROR' -Kind 'STAGING_ESCAPE' -Detail 'Staging escaped the temporary inspection root.'
    }

    $safeUrl = "https://github.com/$($script:Slug).git"
    $gh = Get-Command gh -CommandType Application -ErrorAction SilentlyContinue
    $clone = $null
    if ($null -ne $gh) {
        $cloneBackend = 'gh'
        $cloneArgs = @('repo', 'clone', $safeUrl, $script:Stage)
        if (-not $Full) {
            $cloneArgs += @('--', '--depth', '1', '--single-branch')
        }
        $clone = Invoke-Captured -Executable $gh.Source -Arguments $cloneArgs
    }

    # Public repositories remain inspectable when gh is absent or unauthenticated.
    if ($null -eq $clone -or $clone.Code -ne 0) {
        if ($null -ne $clone) {
            Remove-OwnedStage
            $script:Stage = ''
            $script:StageOwned = $false
            New-PrivateStage
        }
        $cloneBackend = 'git'
        $cloneArgs = @('-c', 'credential.interactive=never', '-c', 'core.askPass=', 'clone')
        if (-not $Full) {
            $cloneArgs += @('--depth', '1', '--single-branch')
        }
        $cloneArgs += @($safeUrl, $script:Stage)
        $clone = Invoke-Captured -Executable 'git' -Arguments $cloneArgs
    }
    if ($clone.Code -ne 0) {
        Stop-Helper -Code 5 -Status 'ERROR' -Kind 'CLONE_FAILED' -Detail 'Repository clone failed without publishing command diagnostics.' -CommandExit $clone.Code
    }

    $stageGit = Get-PathItem -LiteralPath (Join-Path $script:Stage '.git')
    if ($null -eq $stageGit -or -not $stageGit.PSIsContainer -or (Test-ReparsePoint -Item $stageGit)) {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'CLONE_VALIDATION_FAILED' -Detail 'Clone command did not create standalone git metadata.'
    }
    $stageTop = Invoke-Captured -Executable 'git' -Arguments @('-C', $script:Stage, 'rev-parse', '--show-toplevel')
    if ($stageTop.Code -ne 0 -or -not (Test-PathEqual -Left $stageTop.Output -Right $script:Stage)) {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'CLONE_VALIDATION_FAILED' -Detail 'Clone top level is not the private staging directory.'
    }
    $remoteSlug = Assert-ExistingOrigin -RepositoryPath $script:Stage
    $shallow = Get-ShallowState -RepositoryPath $script:Stage
    if ($Full -and $shallow -ne 'false') {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'CLONE_VALIDATION_FAILED' -Detail 'A full clone remained shallow.'
    }

    # Publish only the completed clone. Directory.Move is an atomic no-clobber
    # rename on the local filesystem; a concurrent destination is preserved.
    if (-not (Move-DirectoryNoClobber -Source $script:Stage -Destination $script:Dest)) {
        Stop-Blocked -Kind 'DESTINATION_RACE' -Detail 'Destination appeared while cloning; refusing to publish over it.'
    }
    $script:StageOwned = $false
    $script:Stage = ''

    $finalItem = Get-PathItem -LiteralPath $script:Dest
    if ($null -eq $finalItem -or -not $finalItem.PSIsContainer -or (Test-ReparsePoint -Item $finalItem)) {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'FINAL_VALIDATION_FAILED' -Detail 'Final clone path could not be resolved safely.'
    }
    $resolvedFinal = (Resolve-Path -LiteralPath $script:Dest -ErrorAction Stop).ProviderPath
    if (-not (Test-PathEqual -Left $resolvedFinal -Right $script:Dest)) {
        Stop-Helper -Code 6 -Status 'ERROR' -Kind 'FINAL_VALIDATION_FAILED' -Detail 'Final clone escaped its physical destination.'
    }
    $remoteSlug = Assert-ExistingOrigin -RepositoryPath $script:Dest
    $shallow = Get-ShallowState -RepositoryPath $script:Dest

    Write-CommonResult -Status 'CLONED' -Code 0
    Write-Output "REMOTE=https://github.com/$remoteSlug.git"
    Write-Output 'ACTION=CLONED'
    Write-Output "SHALLOW=$shallow"
    Write-Output 'FRESHNESS=CLONE_TIME'
    Write-Output 'ORIGIN_CHECK=PASSED'
    Write-Output "CLONE_BACKEND=$cloneBackend"
    exit 0
}

try {
    Invoke-Main
} catch {
    $errorType = $_.Exception.GetType().Name
    Stop-Helper -Code 4 -Status 'ERROR' -Kind 'UNEXPECTED_ERROR' -Detail "The helper stopped on a sanitized internal error ($errorType)."
} finally {
    Remove-OwnedStage
}
