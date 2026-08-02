#!/bin/sh
# Install claude-skills: skills -> ~/.claude/skills, agents -> ~/.claude/agents
# Usage: ./install.sh [--project]   (--project installs into ./.claude/ instead)
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
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
echo "done: $count items installed into $DEST"
