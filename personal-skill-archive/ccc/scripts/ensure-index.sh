#!/usr/bin/env bash
# Read-only by default with --status; mutation only with (default) ensure.
# Usage:
#   ensure-index.sh              # if project initialized, run ccc index
#   ensure-index.sh --status     # print ccc status only (no mutation)
#   ensure-index.sh --dry-run    # print what would run
set -euo pipefail

mode=ensure
for arg in "$@"; do
  case "$arg" in
    --status) mode=status ;;
    --dry-run) mode=dry-run ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
  esac
done

if ! command -v ccc >/dev/null 2>&1; then
  echo "ccc: not on PATH (install: uv tool install --upgrade --with 'mcp>=1.0.0,<2' 'cocoindex-code[full]')"
  exit 1
fi

root="${CLAUDE_PROJECT_DIR:-.}"
cd "$root" 2>/dev/null || cd .

if [ ! -d .cocoindex_code ] && [ ! -f .cocoindex_code/settings.yml ]; then
  echo "ccc: project not initialized (no .cocoindex_code). Run: ccc init --force && ccc index"
  exit 2
fi

case "$mode" in
  status)
    ccc status
    ;;
  dry-run)
    echo "would run: ccc index  (cwd=$(pwd))"
    ccc status 2>/dev/null || true
    ;;
  ensure)
    ccc index
    ;;
esac
