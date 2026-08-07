#!/usr/bin/env bash
# Shared env/credentials resolution for DefectDojo scripts.
# Source this file; never prints token values.
#
# Exports:
#   DD_BASE   — base URL without trailing slash
#   DD_TOKEN  — API token
#   DD_AUTH   — "Authorization: Token …"
#
# Resolution order for URL:
#   1. DEFECTDOJO_URL (full base, e.g. http://192.168.50.179:8080)
#   2. DEFECTDOJO_HOST + DEFECTDOJO_PORT (port default 8080)
#      scheme: DEFECTDOJO_SCHEME or http
#   3. credentials file DEFECTDOJO_URL= / DD_URL=
#   4. credentials file host/port keys
#
# Token:
#   DEFECTDOJO_API_TOKEN | API_TOKEN | credentials file

_dd_load_file_kv() {
  local f="$1" key val
  [[ -r "$f" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    val="${val%$'\r'}"
    val="${val%\"}"
    val="${val#\"}"
    case "$key" in
      API_TOKEN|DEFECTDOJO_API_TOKEN)
        if [[ -z "${_DD_FILE_TOKEN:-}" ]]; then _DD_FILE_TOKEN="$val"; fi
        ;;
      DEFECTDOJO_URL|DD_URL)
        if [[ -z "${_DD_FILE_URL:-}" ]]; then _DD_FILE_URL="$val"; fi
        ;;
      DEFECTDOJO_HOST|DD_HOST)
        if [[ -z "${_DD_FILE_HOST:-}" ]]; then _DD_FILE_HOST="$val"; fi
        ;;
      DEFECTDOJO_PORT|DD_PORT)
        if [[ -z "${_DD_FILE_PORT:-}" ]]; then _DD_FILE_PORT="$val"; fi
        ;;
      DEFECTDOJO_SCHEME|DD_SCHEME)
        if [[ -z "${_DD_FILE_SCHEME:-}" ]]; then _DD_FILE_SCHEME="$val"; fi
        ;;
    esac
  done <"$f"
  return 0
}

_dd_build_url_from_parts() {
  local host="$1" port="$2" scheme="$3"
  [[ -n "$host" ]] || return 1
  scheme="${scheme:-http}"
  port="${port:-8080}"
  # host may already include scheme
  if [[ "$host" == http://* || "$host" == https://* ]]; then
    printf '%s' "${host%/}"
    return 0
  fi
  # if host already has :port, do not append again
  if [[ "$host" == *:* && "$host" != *\[*\]* ]]; then
    printf '%s://%s' "$scheme" "$host"
    return 0
  fi
  printf '%s://%s:%s' "$scheme" "$host" "$port"
}

dd_resolve_credentials() {
  _DD_FILE_TOKEN=""
  _DD_FILE_URL=""
  _DD_FILE_HOST=""
  _DD_FILE_PORT=""
  _DD_FILE_SCHEME=""

  for f in "${HOME:-}/.defectdojo-credentials" /root/.defectdojo-credentials; do
    _dd_load_file_kv "$f" || true
  done

  DD_TOKEN="${DEFECTDOJO_API_TOKEN:-${API_TOKEN:-${_DD_FILE_TOKEN:-}}}"

  DD_BASE="${DEFECTDOJO_URL:-}"
  if [[ -z "$DD_BASE" ]]; then
    if [[ -n "${DEFECTDOJO_HOST:-}" ]]; then
      DD_BASE=$(_dd_build_url_from_parts \
        "$DEFECTDOJO_HOST" \
        "${DEFECTDOJO_PORT:-8080}" \
        "${DEFECTDOJO_SCHEME:-http}")
    elif [[ -n "${_DD_FILE_URL:-}" ]]; then
      DD_BASE="$_DD_FILE_URL"
    elif [[ -n "${_DD_FILE_HOST:-}" ]]; then
      DD_BASE=$(_dd_build_url_from_parts \
        "$_DD_FILE_HOST" \
        "${_DD_FILE_PORT:-8080}" \
        "${_DD_FILE_SCHEME:-http}")
    fi
  fi
  DD_BASE="${DD_BASE%/}"

  if [[ -z "${DD_TOKEN}" ]]; then
    echo 'error: no DefectDojo token (set DEFECTDOJO_API_TOKEN or API_TOKEN, or credentials file)' >&2
    return 1
  fi
  if [[ -z "${DD_BASE}" ]]; then
    echo 'error: no DefectDojo URL (set DEFECTDOJO_URL, or DEFECTDOJO_HOST[+DEFECTDOJO_PORT], or credentials file)' >&2
    return 1
  fi

  DD_AUTH="Authorization: Token ${DD_TOKEN}"
  return 0
}
