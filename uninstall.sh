#!/bin/sh
# Uninstall claude-skills: remove skills/agents/pool this repo installed into ~/.claude (or DIR/.claude)
# Usage (local):  ./uninstall.sh [--project [DIR]] [--remove-keys]
# Usage (remote): curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/uninstall.sh | sh
# --project with no DIR uses the current working directory; DIR may be relative or absolute.
#
# Does not remove: other skills/agents, Claude settings (except optional keys), global pip/npm/uv tools.
set -e

PROJECT=0
PROJECT_DIR=""
REMOVE_KEYS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT=1
      shift
      if [ $# -gt 0 ]; then
        case "$1" in
          -*) ;;
          *) PROJECT_DIR="$1"; shift ;;
        esac
      fi
      ;;
    --project=*)
      PROJECT=1
      PROJECT_DIR="${1#--project=}"
      shift
      ;;
    --remove-keys) REMOVE_KEYS=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--project [DIR]] [--remove-keys]"
      echo "  --project [DIR]  remove from DIR/.claude (default DIR: current working directory)"
      echo "  --remove-keys    also drop BRAVE_* / TAVILY_API_KEY from ~/.claude/settings.json"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR=""
if [ -n "$0" ] && [ -f "$0" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd || echo "")"
fi

CLEANUP_TMP=""
if [ -n "$SCRIPT_DIR" ] && [ -d "$SCRIPT_DIR/skills" ]; then
  ROOT="$SCRIPT_DIR"
else
  echo "Downloading latest claude-skills from GitHub (to learn installed names)..."
  TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'claude-skills')"
  CLEANUP_TMP="$TMP_DIR"

  TOKEN=""
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    TOKEN="$(gh auth token 2>/dev/null || echo "")"
  fi

  if [ -n "$TOKEN" ]; then
    curl -fsSL -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" https://api.github.com/repos/christophacham/claude-skills/tarball/main | tar -xz -C "$TMP_DIR"
  else
    curl -fsSL https://github.com/christophacham/claude-skills/archive/refs/heads/main.tar.gz | tar -xz -C "$TMP_DIR"
  fi

  ROOT="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
fi

if [ "$PROJECT" = "1" ]; then
  if [ -z "$PROJECT_DIR" ]; then
    PROJECT_DIR="."
  fi
  if [ ! -d "$PROJECT_DIR" ]; then
    echo "error: project path is not a directory: $PROJECT_DIR" >&2
    exit 1
  fi
  PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
  DEST="$PROJECT_DIR/.claude"
else
  DEST="$HOME/.claude"
fi
USER_SETTINGS="$HOME/.claude/settings.json"

count=0

if [ ! -d "$DEST" ]; then
  echo "bundle:          $DEST does not exist (nothing to remove there)"
else
  for d in "$ROOT"/skills/*; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    target="$DEST/skills/$name"
    if [ -e "$target" ]; then
      rm -rf "$target"
      echo "removed skill:   $name"
      count=$((count + 1))
    fi
  done

  for f in "$ROOT"/agents/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    target="$DEST/agents/$name"
    if [ -f "$target" ]; then
      rm -f "$target"
      echo "removed agent:   $name"
      count=$((count + 1))
    fi
  done

  if [ -d "$ROOT/agents/panelists" ]; then
    for f in "$ROOT"/agents/panelists/*.md; do
      [ -f "$f" ] || continue
      name="$(basename "$f")"
      target="$DEST/agents/panelists/$name"
      if [ -f "$target" ]; then
        rm -f "$target"
        echo "removed agent:   panelists/$name"
        count=$((count + 1))
      fi
    done
  fi

  # Drop empty panelists dir left behind (keep agents/ even if empty — user may use it)
  if [ -d "$DEST/agents/panelists" ]; then
    # rmdir fails if non-empty — intentional
    rmdir "$DEST/agents/panelists" 2>/dev/null && echo "removed empty:   agents/panelists" || true
  fi

  if [ -f "$DEST/pool.md" ]; then
    rm -f "$DEST/pool.md"
    echo "removed pool:    pool.md"
    count=$((count + 1))
  fi
fi

# Optional: strip API keys this installer may have written (user settings only)
if [ "$REMOVE_KEYS" = "1" ]; then
  find_python3() {
    for candidate in python3 python; do
      if command -v "$candidate" >/dev/null 2>&1 &&
         "$candidate" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 0) else 1)" >/dev/null 2>&1; then
        printf '%s\n' "$candidate"
        return 0
      fi
    done
    return 1
  }
  PYTHON_BIN="$(find_python3 || true)"
  if [ -z "$PYTHON_BIN" ]; then
    echo "keys warn:       Python 3 required to edit $USER_SETTINGS — skipped" >&2
  elif [ ! -f "$USER_SETTINGS" ]; then
    echo "keys:            no $USER_SETTINGS"
  else
    if REMOVED_KEYS="$(
      SETTINGS_PATH="$USER_SETTINGS" "$PYTHON_BIN" - <<'PY'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
keys = ("BRAVE_API_KEY", "BRAVE_SEARCH_API_KEY", "TAVILY_API_KEY")
try:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
except Exception as e:
    print(f"error: could not parse {path}: {e}", file=sys.stderr)
    sys.exit(1)
if not isinstance(data, dict):
    print("")
    sys.exit(0)
env = data.get("env")
if not isinstance(env, dict):
    print("")
    sys.exit(0)
removed = [k for k in keys if k in env]
for k in removed:
    del env[k]
if not env:
    data.pop("env", None)
else:
    data["env"] = env
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(",".join(removed))
PY
    )"; then
      if [ -n "$REMOVED_KEYS" ]; then
        echo "keys:            removed $REMOVED_KEYS from $USER_SETTINGS — restart Claude Code"
      else
        echo "keys:            none of BRAVE_* / TAVILY_API_KEY present in $USER_SETTINGS"
      fi
    else
      echo "keys:            ERROR updating $USER_SETTINGS" >&2
    fi
  fi
fi

if [ -n "$CLEANUP_TMP" ]; then
  rm -rf "$CLEANUP_TMP"
fi

echo "done: $count items removed from $DEST"
if [ "$REMOVE_KEYS" = "0" ]; then
  echo "note: global tools (ddgs, tvly, npm pkgs) left installed; pass --remove-keys to drop API keys from settings"
else
  echo "note: global tools (ddgs, tvly, npm pkgs) left installed"
fi
