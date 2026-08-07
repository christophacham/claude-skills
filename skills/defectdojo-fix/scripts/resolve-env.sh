#!/usr/bin/env bash
# Shared env/credentials resolution for DefectDojo scripts.
# Source this file; never prints token values.
#
# Does NOT read ~/.claude/settings.json — that file is only visible to
# scripts when Claude Code has already injected env into the process.
# Outside the harness: export vars or use ~/.defectdojo-credentials.
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
#   DEFECTDOJO_API_TOKEN (prefer) | API_TOKEN (legacy) | credentials file
#
# Credentials file permissions: if a candidate file is group- or world-readable,
# we emit a warning to stderr but keep going. The file holds an API token; the
# user should `chmod 600` it. Hard-failing would break legitimate shared hosts
# where the file is intentionally readable; the user gets a clear reminder.

_dd_load_file_kv() {
  local f="$1" key val
  [[ -r "$f" ]] || return 1
  # Warn if the credentials file is readable by other users on this host.
  # The token is sensitive; chmod 600 is the recommended baseline. We do not
  # hard-fail because some shared hosts intentionally keep the file open.
  if [[ -O "$f" || "$(id -u)" -eq 0 ]]; then
    local mode go_other
    mode=$(stat -c '%a' "$f" 2>/dev/null || stat -f '%Lp' "$f" 2>/dev/null || echo "")
    # Last two octal digits = group + other permission bits. If any are set,
    # the file is exposed to users other than the owner. 700 -> 0, 600 -> 0,
    # 644 -> 44 (warn), 704 -> 4 (warn).
    go_other=$((mode % 100))
    if [[ "$go_other" != "0" ]]; then
      echo "warning: $f is mode $mode (group/world readable); run: chmod 600 $f" >&2
    fi
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    # Strip trailing CR, then surrounding whitespace, then a single pair of
    # matching " or ' quotes. DefectDojo tokens never contain quotes, so this
    # trims common .env-style quoting without altering the value.
    val="${val%$'\r'}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    if [[ ${#val} -ge 2 ]]; then
      local first="${val:0:1}" last="${val: -1}"
      if [[ "$first" == '"' && "$last" == '"' ]] || [[ "$first" == "'" && "$last" == "'" ]]; then
        val="${val:1:${#val}-2}"
      fi
    fi
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
