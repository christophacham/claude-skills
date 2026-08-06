#!/usr/bin/env bash
# Safely clone a GitHub repo into $HOME/code/tmp/<name>.
set -u
umask 077

export GH_PROMPT_DISABLED=1
export GIT_TERMINAL_PROMPT=0
export GCM_INTERACTIVE=Never

stage=""
stage_owned=0
root=""
dest=""
slug=""

usage() {
  printf 'Usage: %s <owner/repo|github-url> [--full]\n' "$0" >&2
}

emit_common() {
  printf 'STATUS=%s\nEXIT_CODE=%s\n' "$1" "$2"
  [ -n "$dest" ] && printf 'PATH=%s\n' "$dest"
  [ -n "$slug" ] && printf 'SLUG=%s\n' "$slug"
}

error_result() {
  local code=$1
  local kind=$2
  local detail=$3
  local command_exit=${4:-}
  emit_common "ERROR" "$code"
  printf 'ERROR=%s\nDETAIL=%s\n' "$kind" "$detail"
  [ -n "$command_exit" ] && printf 'COMMAND_EXIT=%s\n' "$command_exit"
  exit "$code"
}

blocked() {
  emit_common "BLOCKED" 2
  printf 'ERROR=%s\nDETAIL=%s\n' "$1" "$2"
  exit 2
}

cleanup() {
  if [ "$stage_owned" -eq 1 ] && [ -n "$stage" ] && [ -n "$root" ]; then
    case "$stage" in
      "$root"/.peek-repo-*)
        if [ -d "$stage" ] && [ ! -L "$stage" ]; then
          rm -rf -- "$stage" 2>/dev/null || true
        fi
        ;;
    esac
  fi
}
trap cleanup EXIT
trap 'exit 130' HUP INT TERM

parse_repo() {
  local raw=${1%/}
  PARSED_OWNER=""
  PARSED_NAME=""
  if [[ "$raw" =~ ^https?://(www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)(/.*|\?.*|#.*)?$ ]]; then
    PARSED_OWNER=${BASH_REMATCH[2]}
    PARSED_NAME=${BASH_REMATCH[3]}
  elif [[ "$raw" =~ ^git@github\.com:([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$ ]]; then
    PARSED_OWNER=${BASH_REMATCH[1]}
    PARSED_NAME=${BASH_REMATCH[2]}
  elif [[ "$raw" =~ ^([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$ ]]; then
    PARSED_OWNER=${BASH_REMATCH[1]}
    PARSED_NAME=${BASH_REMATCH[2]}
  else
    return 1
  fi
  PARSED_NAME=${PARSED_NAME%.git}
  [[ "$PARSED_OWNER" =~ ^[A-Za-z0-9_.-]+$ ]] || return 1
  [[ "$PARSED_NAME" =~ ^[A-Za-z0-9_.-]+$ ]] || return 1
  [ -n "$PARSED_OWNER" ] && [ -n "$PARSED_NAME" ] || return 1
  [ "$PARSED_OWNER" != "." ] && [ "$PARSED_OWNER" != ".." ] || return 1
  [ "$PARSED_NAME" != "." ] && [ "$PARSED_NAME" != ".." ] || return 1
}

path_exists() {
  [ -e "$1" ] || [ -L "$1" ]
}

ensure_real_directory() {
  local path=$1
  local label=$2
  local actual

  if [ -L "$path" ]; then
    error_result 4 "UNSAFE_ROOT" "$label is a symbolic link; refusing to follow it."
  fi
  if [ -e "$path" ]; then
    [ -d "$path" ] || error_result 4 "UNSAFE_ROOT" "$label exists but is not a directory."
  else
    mkdir -- "$path" 2>/dev/null || error_result 4 "ROOT_CREATE_FAILED" "Could not create the inspection root."
  fi
  [ ! -L "$path" ] || error_result 4 "UNSAFE_ROOT" "$label became a symbolic link; refusing to follow it."
  actual=$(cd -P -- "$path" 2>/dev/null && pwd -P) || error_result 4 "ROOT_RESOLVE_FAILED" "Could not resolve the inspection root."
  [ "$actual" = "$path" ] || error_result 4 "UNSAFE_ROOT" "$label does not resolve to its physical path."
}

check_existing_origin() {
  local repo_path=$1
  local remote
  local remote_slug
  local remote_key
  local requested_key

  remote=$(git -C "$repo_path" remote get-url origin 2>/dev/null) || remote=""
  if [ -z "$remote" ] || ! parse_repo "$remote"; then
    blocked "ORIGIN_INVALID" "Existing git repo has no canonical GitHub origin."
  fi
  remote_slug="$PARSED_OWNER/$PARSED_NAME"
  remote_key=$(printf '%s' "$remote_slug" | tr '[:upper:]' '[:lower:]')
  requested_key=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]')
  if [ "$remote_key" != "$requested_key" ]; then
    blocked "ORIGIN_MISMATCH" "Existing git repo origin is $remote_slug, not requested $slug."
  fi
  CHECKED_REMOTE_SLUG=$remote_slug
}

get_shallow_state() {
  local repo_path=$1
  local value
  value=$(git -C "$repo_path" rev-parse --is-shallow-repository 2>/dev/null) || \
    error_result 6 "GIT_VALIDATION_FAILED" "Could not determine repository history depth."
  case "$value" in
    true|false) SHALLOW_STATE=$value ;;
    *) error_result 6 "GIT_VALIDATION_FAILED" "Git returned an unknown history-depth state." ;;
  esac
}

repo=""
full=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --full) full=1 ;;
    -h|--help) usage; exit 0 ;;
    --*) error_result 2 "INVALID_ARGUMENT" "Unknown option." ;;
    *)
      if [ -n "$repo" ]; then
        error_result 2 "INVALID_ARGUMENT" "Expected exactly one repository argument."
      fi
      repo=$1
      ;;
  esac
  shift
done

if [ -z "$repo" ] || ! parse_repo "$repo"; then
  error_result 2 "INVALID_REPOSITORY" "Need owner/repo or an anchored github.com URL."
fi
owner=$PARSED_OWNER
name=$PARSED_NAME
slug="$owner/$name"

if [ -z "${HOME:-}" ]; then
  error_result 2 "HOME_UNSET" "HOME is not set."
fi
case "$HOME" in
  *$'\n'*|*$'\r'*) error_result 2 "HOME_INVALID" "HOME contains a line break." ;;
esac
[ -d "$HOME" ] || error_result 4 "HOME_INVALID" "HOME is not an existing directory."
physical_home=$(cd -P -- "$HOME" 2>/dev/null && pwd -P) || \
  error_result 4 "HOME_INVALID" "Could not resolve HOME."
case "$physical_home" in
  *$'\n'*|*$'\r'*) error_result 2 "HOME_INVALID" "HOME resolves to a path containing a line break." ;;
esac

code_root="$physical_home/code"
root="$code_root/tmp"
ensure_real_directory "$code_root" "The code directory"
ensure_real_directory "$root" "The temporary inspection directory"

dest="$root/$name"
[ "${dest%/*}" = "$root" ] || error_result 2 "DESTINATION_ESCAPE" "Destination escaped the temporary inspection root."

if path_exists "$dest"; then
  [ ! -L "$dest" ] || blocked "DESTINATION_LINK" "Path is a symbolic link; refusing to reuse it."
  [ -d "$dest" ] || blocked "DESTINATION_OCCUPIED" "Path already exists and is not a git repository directory."

  dest_physical=$(cd -P -- "$dest" 2>/dev/null && pwd -P) || \
    blocked "DESTINATION_UNRESOLVED" "Existing path could not be resolved safely."
  [ "$dest_physical" = "$dest" ] || blocked "DESTINATION_ESCAPE" "Existing path resolves outside its direct physical location."

  if [ ! -d "$dest/.git" ] || [ -L "$dest/.git" ]; then
    blocked "DESTINATION_OCCUPIED" "Path already exists and is not a standalone git repository."
  fi

  command -v git >/dev/null 2>&1 || error_result 3 "GIT_NOT_FOUND" "git CLI not found on PATH."
  git_dir_physical=$(cd -P -- "$dest/.git" 2>/dev/null && pwd -P) || \
    blocked "GIT_METADATA_UNSAFE" "Git metadata could not be resolved safely."
  [ "$git_dir_physical" = "$dest/.git" ] || blocked "GIT_METADATA_UNSAFE" "Git metadata is linked outside the repository."

  top=$(git -C "$dest" rev-parse --show-toplevel 2>/dev/null) || \
    blocked "DESTINATION_OCCUPIED" "Path already exists but is not a valid git repository."
  top_physical=$(cd -P -- "$top" 2>/dev/null && pwd -P) || \
    blocked "DESTINATION_UNRESOLVED" "Repository top level could not be resolved safely."
  [ "$top_physical" = "$dest" ] || blocked "DESTINATION_ESCAPE" "Repository top level is not the requested destination."

  check_existing_origin "$dest"
  get_shallow_state "$dest"
  action="NONE"
  freshness="NOT_CHECKED"

  if [ "$full" -eq 1 ] && [ "$SHALLOW_STATE" = "true" ]; then
    command_exit=0
    GIT_SSH_COMMAND="ssh -o BatchMode=yes" git -C "$dest" \
      -c credential.interactive=never \
      -c core.askPass= \
      -c protocol.ext.allow=never \
      -c protocol.file.allow=never \
      fetch --unshallow origin \
      '+refs/heads/*:refs/remotes/origin/*' --tags >/dev/null 2>&1 || command_exit=$?
    if [ "$command_exit" -ne 0 ]; then
      error_result 7 "UNSHALLOW_FAILED" "Could not fetch full branch and tag history without prompting." "$command_exit"
    fi

    check_existing_origin "$dest"
    get_shallow_state "$dest"
    [ "$SHALLOW_STATE" = "false" ] || \
      error_result 7 "UNSHALLOW_INCOMPLETE" "Git fetch completed but the repository is still shallow."
    action="UNSHALLOWED"
    freshness="WORKTREE_NOT_UPDATED"
  fi

  emit_common "EXISTS" 0
  printf 'REMOTE=https://github.com/%s.git\n' "$CHECKED_REMOTE_SLUG"
  printf 'ACTION=%s\nSHALLOW=%s\nFRESHNESS=%s\nORIGIN_CHECK=PASSED\n' \
    "$action" "$SHALLOW_STATE" "$freshness"
  exit 0
fi

command -v git >/dev/null 2>&1 || error_result 3 "GIT_NOT_FOUND" "git CLI not found on PATH."
command -v mktemp >/dev/null 2>&1 || error_result 3 "MKTEMP_NOT_FOUND" "mktemp not found on PATH."
command -v mv >/dev/null 2>&1 || error_result 3 "MOVE_NOT_FOUND" "mv not found on PATH."

# Publishing is safe only when another account cannot replace entries in the
# inspection root. Concurrent invocations by this user are handled below.
[ -O "$root" ] || error_result 4 "UNSAFE_ROOT" "The inspection root is not owned by the current user."
if [ -n "$(find "$root" -prune -perm -022 -print 2>/dev/null)" ]; then
  error_result 4 "UNSAFE_ROOT" "The inspection root is group- or world-writable."
fi

stage=$(mktemp -d "$root/.peek-repo-$name.XXXXXXXX" 2>/dev/null) || \
  error_result 4 "STAGING_CREATE_FAILED" "Could not create a private staging directory."
stage_owned=1
stage_physical=$(cd -P -- "$stage" 2>/dev/null && pwd -P) || \
  error_result 4 "STAGING_RESOLVE_FAILED" "Could not resolve the private staging directory."
[ "$stage_physical" = "$stage" ] || error_result 4 "STAGING_UNSAFE" "Staging does not resolve to its physical path."
[ "${stage%/*}" = "$root" ] || error_result 4 "STAGING_ESCAPE" "Staging escaped the temporary inspection root."

safe_url="https://github.com/$slug.git"
command_exit=0
clone_backend=git
if command -v gh >/dev/null 2>&1; then
  clone_backend=gh
  if [ "$full" -eq 1 ]; then
    gh repo clone "$safe_url" "$stage" >/dev/null 2>&1 || command_exit=$?
  else
    gh repo clone "$safe_url" "$stage" -- --depth 1 --single-branch >/dev/null 2>&1 || command_exit=$?
  fi
fi

# Public repositories remain inspectable when gh is missing or unauthenticated.
# Retry from a fresh private stage so a partial gh clone cannot contaminate git.
if [ "$clone_backend" = "git" ] || [ "$command_exit" -ne 0 ]; then
  if [ "$clone_backend" = "gh" ]; then
    rm -rf "$stage" 2>/dev/null || error_result 4 "STAGING_RESET_FAILED" "Could not clean a failed gh staging clone."
    stage=$(mktemp -d "$root/.peek-repo-$name.XXXXXXXX" 2>/dev/null) || \
      error_result 4 "STAGING_CREATE_FAILED" "Could not recreate private staging for HTTPS fallback."
  fi
  clone_backend=git
  command_exit=0
  if [ "$full" -eq 1 ]; then
    git -c credential.interactive=never -c core.askPass= clone "$safe_url" "$stage" >/dev/null 2>&1 || command_exit=$?
  else
    git -c credential.interactive=never -c core.askPass= clone --depth 1 --single-branch "$safe_url" "$stage" >/dev/null 2>&1 || command_exit=$?
  fi
fi
if [ "$command_exit" -ne 0 ]; then
  error_result 5 "CLONE_FAILED" "Repository clone failed without publishing command diagnostics." "$command_exit"
fi

[ -d "$stage/.git" ] && [ ! -L "$stage/.git" ] || \
  error_result 6 "CLONE_VALIDATION_FAILED" "Clone command did not create standalone git metadata."
stage_top=$(git -C "$stage" rev-parse --show-toplevel 2>/dev/null) || \
  error_result 6 "CLONE_VALIDATION_FAILED" "Cloned repository has no valid top level."
stage_top_physical=$(cd -P -- "$stage_top" 2>/dev/null && pwd -P) || \
  error_result 6 "CLONE_VALIDATION_FAILED" "Cloned repository top level could not be resolved."
[ "$stage_top_physical" = "$stage" ] || \
  error_result 6 "CLONE_VALIDATION_FAILED" "Clone top level is not the private staging directory."
check_existing_origin "$stage"
get_shallow_state "$stage"
if [ "$full" -eq 1 ] && [ "$SHALLOW_STATE" != "false" ]; then
  error_result 6 "CLONE_VALIDATION_FAILED" "A full clone remained shallow."
fi

# Publish only the completed, validated clone. Plain mv is Bash-3/BSD portable.
# If a same-user concurrent invocation creates the destination, mv either fails
# or nests our uniquely named stage inside it; detect and remove only our stage.
marker=".peek-repo-owned-$$"
printf '%s\n' "$slug" > "$stage/$marker" || error_result 4 "STAGING_MARK_FAILED" "Could not mark the private staging directory."
stage_name=${stage##*/}
if path_exists "$dest"; then
  blocked "DESTINATION_RACE" "Destination appeared while cloning; refusing to publish over it."
fi
move_exit=0
mv "$stage" "$dest" 2>/dev/null || move_exit=$?
if [ -f "$dest/$stage_name/$marker" ]; then
  rm -rf "$dest/$stage_name" 2>/dev/null || true
  blocked "DESTINATION_RACE" "Destination appeared during publication; it was preserved."
fi
if path_exists "$stage"; then
  if path_exists "$dest"; then
    blocked "DESTINATION_RACE" "Destination appeared during publication; it was preserved."
  fi
  error_result 4 "FINALIZE_FAILED" "Could not publish the completed clone." "$move_exit"
fi
stage_owned=0
stage=""
[ -f "$dest/$marker" ] || error_result 6 "FINAL_VALIDATION_FAILED" "Published clone ownership marker is missing."
rm -f "$dest/$marker" || error_result 6 "FINAL_VALIDATION_FAILED" "Could not remove the publication marker."

[ ! -L "$dest" ] || error_result 6 "FINAL_VALIDATION_FAILED" "Published destination is a symbolic link."
final_physical=$(cd -P -- "$dest" 2>/dev/null && pwd -P) || \
  error_result 6 "FINAL_VALIDATION_FAILED" "Final clone path could not be resolved safely."
[ "$final_physical" = "$dest" ] || error_result 6 "FINAL_VALIDATION_FAILED" "Final clone escaped its physical destination."
check_existing_origin "$dest"
get_shallow_state "$dest"

emit_common "CLONED" 0
printf 'REMOTE=https://github.com/%s.git\n' "$CHECKED_REMOTE_SLUG"
printf 'ACTION=CLONED\nSHALLOW=%s\nFRESHNESS=CLONE_TIME\nORIGIN_CHECK=PASSED\nCLONE_BACKEND=%s\n' \
  "$SHALLOW_STATE" "$clone_backend"
exit 0
