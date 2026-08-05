#!/usr/bin/env bash
# Idempotently clone a GitHub repo into $HOME/code/tmp/<name>.
set -u

usage() {
  printf 'Usage: %s <owner/repo|github-url> [--full]\n' "$0" >&2
}

error() {
  printf 'STATUS=ERROR\nERROR=%s\n' "$1"
  exit "${2:-1}"
}

blocked() {
  printf 'STATUS=BLOCKED\nPATH=%s\nSLUG=%s\nERROR=%s\n' "$dest" "$slug" "$1"
  exit 2
}

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

repo=""
full=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --full) full=1 ;;
    -h|--help) usage; exit 0 ;;
    --*) error "Unknown option: $1" 2 ;;
    *)
      if [ -n "$repo" ]; then
        error "Expected one repository argument" 2
      fi
      repo="$1"
      ;;
  esac
  shift
done

if [ -z "$repo" ] || ! parse_repo "$repo"; then
  error "Need owner/repo or a github.com URL" 2
fi
owner=$PARSED_OWNER
name=$PARSED_NAME

if [ -z "${HOME:-}" ]; then
  error "HOME is not set" 2
fi

slug="$owner/$name"
root="$HOME/code/tmp"
mkdir -p "$root" || error "Could not create destination root: $root" 4
root=$(cd "$root" 2>/dev/null && pwd -P) || error "Could not resolve destination root: $root" 4
dest="$root/$name"
[ "${dest%/*}" = "$root" ] || error "Destination escaped the temporary root" 2

if [ -L "$dest" ]; then
  blocked "Path is a symbolic link; refusing to reuse it."
fi

if [ -d "$dest/.git" ]; then
  remote=$(git -C "$dest" remote get-url origin 2>/dev/null || true)
  if [ -z "$remote" ] || ! parse_repo "$remote"; then
    blocked "Existing git repo has no canonical GitHub origin."
  fi
  remote_slug="$PARSED_OWNER/$PARSED_NAME"
  remote_key=$(printf '%s' "$remote_slug" | tr '[:upper:]' '[:lower:]')
  requested_key=$(printf '%s' "$slug" | tr '[:upper:]' '[:lower:]')
  if [ "$remote_key" != "$requested_key" ]; then
    blocked "Existing git repo origin is $remote_slug, not requested $slug."
  fi
  printf 'STATUS=EXISTS\nPATH=%s\nSLUG=%s\nREMOTE=%s\n' "$dest" "$slug" "$remote"
  exit 0
fi

if [ -e "$dest" ] && [ -n "$(find "$dest" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  blocked "Path exists, is non-empty, and is not a git repo. Remove or rename it, then retry."
fi

command -v gh >/dev/null 2>&1 || error "gh CLI not found on PATH" 3

if [ "$full" -eq 1 ]; then
  gh repo clone "$slug" "$dest"
else
  gh repo clone "$slug" "$dest" -- --depth 1
fi
status=$?
if [ "$status" -ne 0 ]; then
  printf 'STATUS=ERROR\nPATH=%s\nSLUG=%s\nERROR=gh repo clone failed (exit %s)\n' "$dest" "$slug" "$status"
  exit "$status"
fi

printf 'STATUS=CLONED\nPATH=%s\nSLUG=%s\nSHALLOW=%s\n' "$dest" "$slug" "$([ "$full" -eq 0 ] && printf true || printf false)"
