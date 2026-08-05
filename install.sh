#!/bin/sh
# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  ./install.sh [--project] [--brave-api-key KEY] [--skip-brave-key] [--skip-deps]
# Usage (remote): curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/install.sh | sh
set -e

PROJECT=0
SKIP_BRAVE_KEY=0
SKIP_DEPS=0
BRAVE_API_KEY_ARG=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT=1; shift ;;
    --skip-brave-key) SKIP_BRAVE_KEY=1; shift ;;
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
    -h|--help)
      echo "Usage: $0 [--project] [--brave-api-key KEY] [--skip-brave-key] [--skip-deps]"
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
  DEST="./.claude"
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
rm -f "$DEST/skills/work-loop/pool.md"
for stale in tmp-clone web-ddgs; do
  if [ -d "$DEST/skills/$stale" ]; then
    rm -rf "$DEST/skills/$stale"
    echo "removed stale:    $stale"
  fi
done

# --- helpers: read/write BRAVE key in settings.json without printing it ---
settings_has_brave_key() {
  SETTINGS_PATH="$1" python3 - <<'PY' 2>/dev/null || SETTINGS_PATH="$1" python - <<'PY' 2>/dev/null || true
import json, os, sys
p = os.environ.get("SETTINGS_PATH", "")
if not p or not os.path.isfile(p):
    sys.exit(1)
try:
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
except Exception:
    sys.exit(1)
env = data.get("env") or {}
k = (env.get("BRAVE_API_KEY") or env.get("BRAVE_SEARCH_API_KEY") or "").strip()
sys.exit(0 if k else 1)
PY
}

write_brave_key() {
  KEY_VAL="$1"
  SETTINGS_PATH="$USER_SETTINGS" BRAVE_KEY_VAL="$KEY_VAL" python3 - <<'PY' 2>/dev/null || SETTINGS_PATH="$USER_SETTINGS" BRAVE_KEY_VAL="$KEY_VAL" python - <<'PY'
import json, os, sys
path = os.environ["SETTINGS_PATH"]
key = os.environ["BRAVE_KEY_VAL"]
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
env["BRAVE_API_KEY"] = key
data["env"] = env
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY
}

# --- skill runtime deps ---
if [ "$SKIP_DEPS" = "0" ]; then
  BRAVE_DIR="$DEST/skills/brave-search"
  if [ -f "$BRAVE_DIR/package.json" ]; then
    if command -v npm >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
      echo "deps install:     npm install -> $BRAVE_DIR"
      if (cd "$BRAVE_DIR" && npm install --no-fund --no-audit); then
        echo "deps ready:       brave-search node_modules"
      else
        echo "deps warn:        npm install failed — run manually in $BRAVE_DIR"
      fi
    else
      echo "deps skip:        node/npm not on PATH (brave-search needs: npm install in $BRAVE_DIR)"
    fi
  fi
  # optional: install ddgs if python available
  if command -v python3 >/dev/null 2>&1; then
    if python3 -c "import ddgs" 2>/dev/null; then
      echo "deps ready:       ddgs (python3)"
    else
      echo "deps install:     python3 -m pip install -U ddgs"
      python3 -m pip install -U ddgs >/dev/null 2>&1 && echo "deps ready:       ddgs" || echo "deps warn:        ddgs pip install failed — first search will retry"
    fi
  elif command -v python >/dev/null 2>&1; then
    if python -c "import ddgs" 2>/dev/null; then
      echo "deps ready:       ddgs (python)"
    else
      echo "deps install:     python -m pip install -U ddgs"
      python -m pip install -U ddgs >/dev/null 2>&1 && echo "deps ready:       ddgs" || echo "deps warn:        ddgs pip install failed — first search will retry"
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
  elif settings_has_brave_key "$USER_SETTINGS"; then
    EXISTING="__present__"
    EXISTING_SRC="settings.json ($USER_SETTINGS)"
  fi

  KEY_TO_WRITE=""
  if [ -n "$BRAVE_API_KEY_ARG" ]; then
    KEY_TO_WRITE="$BRAVE_API_KEY_ARG"
  elif [ -n "$EXISTING" ]; then
    echo "brave key:        already set via $EXISTING_SRC (not printed)"
    if [ "$EXISTING" != "__present__" ] && ! settings_has_brave_key "$USER_SETTINGS"; then
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
    if write_brave_key "$KEY_TO_WRITE"; then
      echo "brave key:        saved to $USER_SETTINGS (env.BRAVE_API_KEY) — restart Claude Code to pick up"
    else
      echo "brave key:        ERROR writing $USER_SETTINGS" >&2
    fi
  fi
else
  echo "brave key:        --skip-brave-key"
fi

if [ -n "$CLEANUP_TMP" ]; then
  rm -rf "$CLEANUP_TMP"
fi

echo "done: $count items installed into $DEST"
