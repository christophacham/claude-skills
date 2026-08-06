#!/bin/sh
# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  ./install.sh [--project [DIR]] [--brave-api-key KEY] [--tavily-api-key KEY]
#                               [--skip-brave-key] [--skip-tavily-key] [--skip-deps]
# Usage (remote): curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/install.sh | sh
# --project with no DIR uses the current working directory; DIR may be relative or absolute.
set -e

PROJECT=0
PROJECT_DIR=""
SKIP_BRAVE_KEY=0
SKIP_TAVILY_KEY=0
SKIP_DEPS=0
BRAVE_API_KEY_ARG=""
TAVILY_API_KEY_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT=1
      shift
      # Optional path: next token if present and not another flag
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
    --skip-brave-key) SKIP_BRAVE_KEY=1; shift ;;
    --skip-tavily-key) SKIP_TAVILY_KEY=1; shift ;;
    --skip-deps) SKIP_DEPS=1; shift ;;
    --brave-api-key)
      if [ -z "${2-}" ]; then
        echo "error: --brave-api-key requires a value" >&2
        exit 1
      fi
      BRAVE_API_KEY_ARG="$2"
      shift 2
      ;;
    --brave-api-key=*)
      BRAVE_API_KEY_ARG="${1#--brave-api-key=}"
      shift
      ;;
    --tavily-api-key)
      if [ -z "${2-}" ]; then
        echo "error: --tavily-api-key requires a value" >&2
        exit 1
      fi
      TAVILY_API_KEY_ARG="$2"
      shift 2
      ;;
    --tavily-api-key=*)
      TAVILY_API_KEY_ARG="${1#--tavily-api-key=}"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--project [DIR]] [--brave-api-key KEY] [--tavily-api-key KEY] [--skip-brave-key] [--skip-tavily-key] [--skip-deps]"
      echo "  --project [DIR]  install into DIR/.claude (default DIR: current working directory)"
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
  echo "Downloading latest claude-skills from GitHub..."
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
# Keys always land in the user settings file so project installs don't commit secrets.
USER_CLAUDE="$HOME/.claude"
USER_SETTINGS="$USER_CLAUDE/settings.json"

mkdir -p "$DEST/skills" "$DEST/agents" "$USER_CLAUDE"

count=0
for d in "$ROOT"/skills/*; do
  [ -d "$d" ] || continue
  name="$(basename "$d")"
  rm -rf "$DEST/skills/$name"
  cp -R "$d" "$DEST/skills/$name"
  echo "installed skill:  $name -> $DEST/skills/$name"
  count=$((count + 1))
done
for f in "$ROOT"/agents/*.md; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  cp "$f" "$DEST/agents/$name"
  echo "installed agent:  $name -> $DEST/agents/$name"
  count=$((count + 1))
done
if [ -d "$ROOT/agents/panelists" ]; then
  mkdir -p "$DEST/agents/panelists"
  for f in "$ROOT"/agents/panelists/*.md; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    cp "$f" "$DEST/agents/panelists/$name"
    echo "installed agent:  panelists/$name -> $DEST/agents/panelists/$name"
    count=$((count + 1))
  done
fi

# default model pool -> $DEST/pool.md (repo-local .claude/pool.md wins at load)
if [ -f "$ROOT/pool.md" ]; then
  cp "$ROOT/pool.md" "$DEST/pool.md"
  echo "installed pool:   pool.md -> $DEST/pool.md"
fi

# stale cleanup
for stale in tmp-clone web-ddgs work-loop work-plan bd-epic-runner architectural-decomposition mission-planning reimpl-scout dynamic-context-injection testing-tdd third-party-integration; do
  if [ -d "$DEST/skills/$stale" ]; then
    rm -rf "$DEST/skills/$stale"
    echo "removed stale:    $stale"
  fi
done

# --- helpers: read/write env keys in settings.json without printing them ---
find_python3() {
  min_minor="${1:-0}"
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1 &&
       "$candidate" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, $min_minor) else 1)" >/dev/null 2>&1; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

PYTHON_BIN="$(find_python3 0 || true)"
DDG_PYTHON_BIN="$(find_python3 10 || true)"

settings_has_env_key() {
  # $1 = path, $2 = primary name, $3 optional alt name
  [ -n "$PYTHON_BIN" ] || return 1
  SETTINGS_PATH="$1" KEY_NAME="$2" KEY_ALT="${3-}" "$PYTHON_BIN" - <<'PY' 2>/dev/null
import json, os, sys
p = os.environ.get("SETTINGS_PATH", "")
name = os.environ.get("KEY_NAME", "")
alt = os.environ.get("KEY_ALT", "") or ""
if not p or not os.path.isfile(p) or not name:
    sys.exit(1)
try:
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    sys.exit(1)
env = data.get("env") or {}
k = (env.get(name) or (env.get(alt) if alt else "") or "").strip()
sys.exit(0 if k else 1)
PY
}

write_env_key() {
  # $1 = env var name, $2 = value
  [ -n "$PYTHON_BIN" ] || {
    echo "error: Python 3 is required to update $USER_SETTINGS" >&2
    return 1
  }
  KEY_NAME="$1"
  KEY_VAL="$2"
  SETTINGS_PATH="$USER_SETTINGS" SETTINGS_ENV_NAME="$KEY_NAME" SETTINGS_ENV_VAL="$KEY_VAL" "$PYTHON_BIN" - <<'PY'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
name = os.environ["SETTINGS_ENV_NAME"]
key = os.environ["SETTINGS_ENV_VAL"]
data = {}
if os.path.isfile(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"error: could not parse {path}: {e}", file=sys.stderr)
        sys.exit(1)
if not isinstance(data, dict):
    data = {}
env = data.get("env")
if not isinstance(env, dict):
    env = {}
env[name] = key
data["env"] = env
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

node_version_supported() {
  node -e 'const m=Number(process.versions.node.split(".")[0]); process.exit(m === 20 || m >= 22 ? 0 : 1)' >/dev/null 2>&1
}

# --- skill runtime deps ---
if [ "$SKIP_DEPS" = "0" ]; then
  BRAVE_DIR="$DEST/skills/brave-search"
  if [ -f "$BRAVE_DIR/package.json" ]; then
    if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
      echo "deps skip:        node/npm not on PATH (brave-search needs Node 20 or >=22)"
    elif ! node_version_supported; then
      echo "deps skip:        unsupported $(node --version 2>/dev/null) (brave-search needs Node 20 or >=22)"
    else
      echo "deps install:     npm install -> $BRAVE_DIR"
      if (cd "$BRAVE_DIR" && npm install --no-fund --no-audit); then
        echo "deps ready:       brave-search node_modules"
      else
        echo "deps warn:        npm install failed — run manually in $BRAVE_DIR"
      fi
    fi
  fi
  # optional: install ddgs if supported Python is available
  if [ -n "$DDG_PYTHON_BIN" ]; then
    if "$DDG_PYTHON_BIN" -c "import ddgs" 2>/dev/null; then
      echo "deps ready:       ddgs ($DDG_PYTHON_BIN)"
    else
      echo "deps install:     $DDG_PYTHON_BIN -m pip install -U ddgs"
      "$DDG_PYTHON_BIN" -m pip install -U ddgs >/dev/null 2>&1 && echo "deps ready:       ddgs" || echo "deps warn:        ddgs pip install failed — first search will retry"
    fi
  elif [ -n "$PYTHON_BIN" ]; then
    echo "deps skip:        available Python is older than 3.10 (ddg-search requirement)"
  else
    echo "deps skip:        Python 3.10+ not on PATH (ddg-search requirement)"
  fi
  # optional: tavily CLI
  TAVILY_DIR="$DEST/skills/tavily-search"
  if [ -f "$TAVILY_DIR/scripts/ensure-tvly.ps1" ] || [ -d "$TAVILY_DIR" ]; then
    if command -v tvly >/dev/null 2>&1; then
      echo "deps ready:       tvly"
    elif command -v uv >/dev/null 2>&1; then
      echo "deps install:     uv tool install tavily-cli"
      uv tool install tavily-cli >/dev/null 2>&1 && echo "deps ready:       tvly" || echo "deps warn:        uv tool install tavily-cli failed"
    elif [ -n "$DDG_PYTHON_BIN" ]; then
      echo "deps install:     $DDG_PYTHON_BIN -m pip install -U tavily-cli"
      "$DDG_PYTHON_BIN" -m pip install -U tavily-cli >/dev/null 2>&1 && echo "deps ready:       tvly" || echo "deps warn:        tavily-cli pip install failed"
    elif [ -n "$PYTHON_BIN" ]; then
      echo "deps skip:        available Python is older than 3.10 (tavily-cli baseline)"
    else
      echo "deps skip:        no uv/Python 3.10+ for tavily-cli (run: uv tool install tavily-cli)"
    fi
  fi
else
  echo "deps skip:        --skip-deps"
fi

# --- Brave API key ---
if [ "$SKIP_BRAVE_KEY" = "0" ]; then
  EXISTING=""
  EXISTING_SRC=""
  if [ -n "${BRAVE_API_KEY-}" ]; then
    EXISTING="$BRAVE_API_KEY"
    EXISTING_SRC="process env BRAVE_API_KEY"
  elif [ -n "${BRAVE_SEARCH_API_KEY-}" ]; then
    EXISTING="$BRAVE_SEARCH_API_KEY"
    EXISTING_SRC="process env BRAVE_SEARCH_API_KEY"
  elif settings_has_env_key "$USER_SETTINGS" BRAVE_API_KEY BRAVE_SEARCH_API_KEY; then
    EXISTING="__present__"
    EXISTING_SRC="settings.json ($USER_SETTINGS)"
  fi

  KEY_TO_WRITE=""
  if [ -n "$BRAVE_API_KEY_ARG" ]; then
    KEY_TO_WRITE="$BRAVE_API_KEY_ARG"
  elif [ -n "$EXISTING" ]; then
    echo "brave key:        already set via $EXISTING_SRC (not printed)"
    if [ "$EXISTING" != "__present__" ] && ! settings_has_env_key "$USER_SETTINGS" BRAVE_API_KEY BRAVE_SEARCH_API_KEY; then
      KEY_TO_WRITE="$EXISTING"
      echo "brave key:        mirroring into $USER_SETTINGS"
    fi
  elif [ -t 0 ]; then
    echo ""
    echo "Brave Search (optional — free tier; skip to use ddg-search only)"
    echo "  Get a key: https://api-dashboard.search.brave.com/app/keys"
    echo "  Stored in: $USER_SETTINGS  under env.BRAVE_API_KEY"
    printf "Paste BRAVE_API_KEY (Enter to skip): "
    read -r ENTERED || ENTERED=""
    if [ -n "$ENTERED" ]; then
      KEY_TO_WRITE="$ENTERED"
    else
      echo "brave key:        skipped (ddg-search works without a key)"
    fi
  else
    echo "brave key:        not set (non-interactive). Re-run with --brave-api-key KEY or set env.BRAVE_API_KEY in $USER_SETTINGS"
  fi

  if [ -n "$KEY_TO_WRITE" ]; then
    if write_env_key BRAVE_API_KEY "$KEY_TO_WRITE"; then
      echo "brave key:        saved to $USER_SETTINGS (env.BRAVE_API_KEY) — restart Claude Code to pick up"
    else
      echo "brave key:        ERROR writing $USER_SETTINGS" >&2
    fi
  fi
else
  echo "brave key:        --skip-brave-key"
fi

# --- Tavily API key ---
if [ "$SKIP_TAVILY_KEY" = "0" ]; then
  EXISTING=""
  EXISTING_SRC=""
  if [ -n "${TAVILY_API_KEY-}" ]; then
    EXISTING="$TAVILY_API_KEY"
    EXISTING_SRC="process env TAVILY_API_KEY"
  elif settings_has_env_key "$USER_SETTINGS" TAVILY_API_KEY; then
    EXISTING="__present__"
    EXISTING_SRC="settings.json ($USER_SETTINGS)"
  fi

  KEY_TO_WRITE=""
  if [ -n "$TAVILY_API_KEY_ARG" ]; then
    KEY_TO_WRITE="$TAVILY_API_KEY_ARG"
  elif [ -n "$EXISTING" ]; then
    echo "tavily key:       already set via $EXISTING_SRC (not printed)"
    if [ "$EXISTING" != "__present__" ] && ! settings_has_env_key "$USER_SETTINGS" TAVILY_API_KEY; then
      KEY_TO_WRITE="$EXISTING"
      echo "tavily key:       mirroring into $USER_SETTINGS"
    fi
  elif [ -t 0 ]; then
    echo ""
    echo "Tavily Search (optional — LLM-optimized search/extract; skip if unused)"
    echo "  Get a key: https://tavily.com"
    echo "  Stored in: $USER_SETTINGS  under env.TAVILY_API_KEY"
    printf "Paste TAVILY_API_KEY (Enter to skip): "
    read -r ENTERED || ENTERED=""
    if [ -n "$ENTERED" ]; then
      KEY_TO_WRITE="$ENTERED"
    else
      echo "tavily key:       skipped (ddg-search / brave-search still available)"
    fi
  else
    echo "tavily key:       not set (non-interactive). Re-run with --tavily-api-key KEY or set env.TAVILY_API_KEY in $USER_SETTINGS"
  fi

  if [ -n "$KEY_TO_WRITE" ]; then
    if write_env_key TAVILY_API_KEY "$KEY_TO_WRITE"; then
      echo "tavily key:       saved to $USER_SETTINGS (env.TAVILY_API_KEY) — restart Claude Code to pick up"
    else
      echo "tavily key:       ERROR writing $USER_SETTINGS" >&2
    fi
  fi
else
  echo "tavily key:       --skip-tavily-key"
fi

if [ -n "$CLEANUP_TMP" ]; then
  rm -rf "$CLEANUP_TMP"
fi

echo "done: $count items installed into $DEST"
