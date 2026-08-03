#!/usr/bin/env bash
# Read-only map trust spot-check for work-plan load-time injection.
# Fail open: uncertainty → partial | full-scan, never invent thin trust-map.
# Exit 0 always so skill load is never aborted.
set +e

ROOT="${CLAUDE_PROJECT_DIR:-.}"
cd "$ROOT" 2>/dev/null || true

map_files=()
while IFS= read -r f; do
  [ -n "$f" ] && map_files+=("$f")
done < <(
  find . -maxdepth 5 \( \
    -name 'module-index.md' -o \
    -name 'hot-spots.md' -o \
    -name 'codebase-map.md' -o \
    -path '*/docs/map/*' -o \
    -path '*/.claude/map/*' -o \
    -path '*/docs/codebase/*' \
  \) -type f 2>/dev/null | head -n 40
)

if [ ${#map_files[@]} -eq 0 ]; then
  cat <<'EOF'
MAP_TRUST
mapPresent: false
mapFiles: []
claimsChecked: []
verdict: full-scan
notes: no map pages under common paths; panelists full-scan
EOF
  exit 0
fi

paths=$(
  for m in "${map_files[@]}"; do
    grep -oE '`[^`]+`|\b(src|lib|app|pkg|tests?|scripts?|internal|cmd)/[A-Za-z0-9_./+-]+\.?[A-Za-z0-9]*\b|\b[A-Za-z0-9_./+-]+\.(cs|ts|tsx|js|jsx|py|rs|go|java|kt|rb|md)\b' "$m" 2>/dev/null
  done \
    | sed 's/^`//;s/`$//' \
    | grep -vE '^(http|https|www\.|TODO|FIXME)' \
    | sort -u \
    | head -n 24
)

checked=0
match=0
mismatch=0
missing=0
claims_block=""

while IFS= read -r p; do
  [ -z "$p" ] && continue
  case "$p" in
    *://*) continue ;;
  esac
  checked=$((checked + 1))
  rel="${p#./}"
  file_only="${rel%%:*}"
  if [ -e "$rel" ] || [ -e "./$rel" ] || [ -e "$file_only" ] || [ -e "./$file_only" ]; then
    match=$((match + 1))
    live="match"
  elif [ -n "$(dirname "$file_only" 2>/dev/null)" ] && [ -d "$(dirname "$file_only")" ] && [ ! -e "$file_only" ]; then
    missing=$((missing + 1))
    live="missing"
  else
    mismatch=$((mismatch + 1))
    live="mismatch"
  fi
  claims_block="${claims_block}  - claim: ${p}
    path: ${rel}
    live: ${live}
"
  [ "$checked" -ge 8 ] && break
done <<< "$paths"

if [ "$checked" -eq 0 ]; then
  verdict="partial"
  notes="map present but no path-like claims extracted; treat as partial"
elif [ "$missing" -eq 0 ] && [ "$mismatch" -eq 0 ] && [ "$match" -ge 2 ]; then
  verdict="trust-map"
  notes="spot-checked ${checked} path claims; all match"
elif [ "$match" -gt 0 ]; then
  verdict="partial"
  notes="spot-checked ${checked}: match=${match} missing=${missing} mismatch=${mismatch}"
else
  verdict="full-scan"
  notes="spot-checked ${checked}: none matched live tree"
fi

if [ "$verdict" = "trust-map" ] && [ "$checked" -lt 2 ]; then
  verdict="partial"
  notes="too few claims for trust-map; partial"
fi

{
  echo "MAP_TRUST"
  echo "mapPresent: true"
  echo "mapFiles:"
  for m in "${map_files[@]}"; do
    echo "  - $m"
  done
  echo "claimsChecked:"
  if [ -n "$claims_block" ]; then
    printf '%s' "$claims_block"
  else
    echo "  []"
  fi
  echo "verdict: $verdict"
  echo "notes: $notes"
}

exit 0
