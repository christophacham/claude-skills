#!/usr/bin/env bash
# Resolve DefectDojo product name → id (and print name\tid).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=resolve-env.sh
source "${SCRIPT_DIR}/resolve-env.sh"

usage() {
  echo "Usage: resolve-product.sh <product-name-or-id>" >&2
  echo "       resolve-product.sh --list" >&2
}

if [[ $# -lt 1 ]]; then usage; exit 2; fi

if ! command -v curl >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
  echo 'error: curl and jq required' >&2
  exit 1
fi

dd_resolve_credentials || exit 1
BASE="$DD_BASE"
AUTH_HEADER="$DD_AUTH"
unset DEFECTDOJO_API_TOKEN API_TOKEN DD_TOKEN

if [[ "$1" == "--list" ]]; then
  curl -sS -H "$AUTH_HEADER" "${BASE}/api/v2/products/?limit=200" \
    | jq -r '.results[] | "\(.id)\t\(.name)"'
  exit 0
fi

NAME="$1"
if [[ "$NAME" =~ ^[0-9]+$ ]]; then
  curl -sS -H "$AUTH_HEADER" "${BASE}/api/v2/products/${NAME}/" \
    | jq -r '"\(.id)\t\(.name)"'
  exit 0
fi

hit=$(curl -sS -H "$AUTH_HEADER" --get --data-urlencode "name=${NAME}" \
  "${BASE}/api/v2/products/?limit=50" \
  | jq -r --arg n "$NAME" '.results[] | select(.name==$n) | "\(.id)\t\(.name)"' | head -1)

if [[ -z "$hit" ]]; then
  echo "error: product not found: ${NAME}" >&2
  exit 1
fi
printf '%s\n' "$hit"
