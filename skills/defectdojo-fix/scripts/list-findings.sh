#!/usr/bin/env bash
# List DefectDojo findings (paginated). Auth from env or credentials file.
# Never prints the token.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=resolve-env.sh
source "${SCRIPT_DIR}/resolve-env.sh"

usage() {
  cat <<'EOF'
Usage: list-findings.sh [options]

Options:
  --product NAME|ID   Product name (owner/repo) or numeric id
  --active true|false Default: true
  --severity LIST    Comma-separated: Critical,High,Medium,Low,Info
  --limit N           Max findings to return (default: 500)
  --page-size N       API page size (default: 200, max 200)
  --format json|ndjson  Default: ndjson (one compact object per line)
  --fields compact|full Default: compact
  -h, --help

Auth / base URL (first hit wins):
  Token: DEFECTDOJO_API_TOKEN | API_TOKEN | ~/.defectdojo-credentials
  URL:   DEFECTDOJO_URL
         or DEFECTDOJO_HOST + DEFECTDOJO_PORT (default 8080) [+ DEFECTDOJO_SCHEME]
         or credentials file keys (DEFECTDOJO_URL / HOST / PORT)
EOF
}

PRODUCT=""
ACTIVE="true"
SEVERITY=""
LIMIT=500
PAGE_SIZE=200
FORMAT="ndjson"
FIELDS="compact"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --product) PRODUCT="${2:-}"; shift 2 ;;
    --active) ACTIVE="${2:-true}"; shift 2 ;;
    --severity) SEVERITY="${2:-}"; shift 2 ;;
    --limit) LIMIT="${2:-500}"; shift 2 ;;
    --page-size) PAGE_SIZE="${2:-200}"; shift 2 ;;
    --format) FORMAT="${2:-ndjson}"; shift 2 ;;
    --fields) FIELDS="${2:-compact}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  echo 'error: curl required' >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo 'error: jq required' >&2
  exit 1
fi

dd_resolve_credentials || exit 1
BASE="$DD_BASE"
AUTH_HEADER="$DD_AUTH"
# drop token from environment of child mishaps
unset DEFECTDOJO_API_TOKEN API_TOKEN DD_TOKEN

resolve_product_id() {
  local name="$1" pid
  if [[ "$name" =~ ^[0-9]+$ ]]; then
    printf '%s' "$name"
    return 0
  fi
  pid=$(curl -sS -H "$AUTH_HEADER" --get --data-urlencode "name=${name}" \
    "${BASE}/api/v2/products/?limit=50" \
    | jq -r --arg n "$name" '.results[] | select(.name==$n) | .id' | head -1)
  if [[ -z "$pid" || "$pid" == "null" ]]; then
    echo "error: product not found: ${name}" >&2
    echo "hint: list with resolve-product.sh --list" >&2
    exit 1
  fi
  printf '%s' "$pid"
}

PRODUCT_ID=""
if [[ -n "$PRODUCT" ]]; then
  PRODUCT_ID=$(resolve_product_id "$PRODUCT")
fi

if (( PAGE_SIZE > 200 )); then PAGE_SIZE=200; fi
if (( PAGE_SIZE < 1 )); then PAGE_SIZE=1; fi

compact_jq='.results[] | {
  id, title, severity, active, verified, false_p, duplicate, is_mitigated,
  file_path, line, component_name, component_version,
  fix_available, fix_version,
  cve, cwe, tags, unique_id_from_tool, numerical_severity, date,
  references: (if .references == null then null else (.references|tostring|.[0:300]) end),
  description: (if .description == null then null else (.description|tostring|.[0:400]) end),
  mitigation: (if .mitigation == null then null else (.mitigation|tostring|.[0:300]) end)
}'

full_jq='.results[]'

# Note: plain ?product=<id> is ignored on some DD installs (returns all findings).
# Prefer test__engagement__product=<id>; product_name= also works for exact names.
query_base="${BASE}/api/v2/findings/?limit=${PAGE_SIZE}&active=${ACTIVE}"
if [[ -n "$PRODUCT_ID" ]]; then
  query_base+="&test__engagement__product=${PRODUCT_ID}"
fi
if [[ -n "$SEVERITY" ]]; then
  query_base+="&severity=$(printf '%s' "$SEVERITY" | jq -sRr @uri)"
fi

offset=0
collected=0
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

while :; do
  page=$(curl -sS -H "$AUTH_HEADER" "${query_base}&offset=${offset}")
  count=$(printf '%s' "$page" | jq -r '.count // 0')
  n=$(printf '%s' "$page" | jq -r '.results | length')
  if [[ "$n" == "0" || "$n" == "null" ]]; then
    break
  fi

  if [[ "$FIELDS" == "full" ]]; then
    printf '%s' "$page" | jq -c "$full_jq" >>"$tmp"
  else
    printf '%s' "$page" | jq -c "$compact_jq" >>"$tmp"
  fi

  collected=$((collected + n))
  if (( collected >= LIMIT )); then
    break
  fi
  next=$(printf '%s' "$page" | jq -r '.next // empty')
  if [[ -z "$next" || "$next" == "null" ]]; then
    break
  fi
  offset=$((offset + PAGE_SIZE))
done

if [[ -s "$tmp" ]]; then
  head -n "$LIMIT" "$tmp" >"${tmp}.out"
  mv "${tmp}.out" "$tmp"
fi

total_lines=$(wc -l <"$tmp" | tr -d ' ')
echo "meta: base=${BASE} product_id=${PRODUCT_ID:-all} active=${ACTIVE} severity=${SEVERITY:-any} returned=${total_lines} api_count=${count:-?}" >&2

if [[ "$FORMAT" == "json" ]]; then
  jq -s '.' "$tmp"
else
  cat "$tmp"
fi
