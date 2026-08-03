#!/bin/sh
# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage (local):  ./install.sh [--project]
# Usage (remote): curl -fsSL https://raw.githubusercontent.com/christophacham/claude-skills/main/install.sh | sh
set -e

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

if [ "$1" = "--project" ]; then
  DEST="./.claude"
else
  DEST="$HOME/.claude"
fi
mkdir -p "$DEST/skills" "$DEST/agents"

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

# stale cleanup: pool used to live inside the skill dir
rm -f "$DEST/skills/work-loop/pool.md"

if [ -n "$CLEANUP_TMP" ]; then
  rm -rf "$CLEANUP_TMP"
fi

echo "done: $count items installed into $DEST"
