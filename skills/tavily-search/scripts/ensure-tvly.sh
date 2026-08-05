#!/bin/sh
# Ensure the Tavily CLI (`tvly`) is on PATH; install via uv/pip if missing.
#
# Read-only check with -CheckOnly. Install is idempotent. Does NOT authenticate —
# needs TAVILY_API_KEY in env / ~/.claude/settings.json, or `tvly login`.
#
# Usage:
#   ./ensure-tvly.sh
#   ./ensure-tvly.sh -CheckOnly

check_only=0
case "${1:-}" in
  -CheckOnly|--check-only) check_only=1 ;;
esac

# Reports 'env', 'settings', or 'missing' — mirrors Get-KeyState in ensure-tvly.ps1.
key_state() {
  if [ -n "${TAVILY_API_KEY:-}" ]; then
    printf '%s\n' 'env'
    return 0
  fi
  if [ -n "${HOME:-}" ] && [ -f "$HOME/.claude/settings.json" ]; then
    py=''
    if command -v python3 >/dev/null 2>&1; then
      py=python3
    elif command -v python >/dev/null 2>&1; then
      py=python
    fi
    if [ -n "$py" ]; then
      hit=$("$py" -c 'import json,sys; d=json.load(open(sys.argv[1])); e=d.get("env") or {}; print("1" if e.get("TAVILY_API_KEY") else "0")' "$HOME/.claude/settings.json" 2>/dev/null)
      if [ "$hit" = "1" ]; then
        printf '%s\n' 'settings'
        return 0
      fi
    fi
  fi
  printf '%s\n' 'missing'
}

# Prefers a Python 3.10+ `python3`, then a Python 3.10+ `python`; prints the name.
find_python() {
  if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    printf '%s\n' 'python3'
    return 0
  fi
  if command -v python >/dev/null 2>&1 && python -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' 2>/dev/null; then
    printf '%s\n' 'python'
    return 0
  fi
  return 1
}

# Prints `tvly --version` (fallback `tvly --status | head -n1`), else 'present'.
tvly_version() {
  if command -v tvly >/dev/null 2>&1; then
    ver=$(tvly --version 2>/dev/null | head -n1)
    if [ -z "$ver" ]; then
      ver=$(tvly --status 2>/dev/null | head -n1)
    fi
    printf '%s\n' "${ver:-present}"
  fi
}

key=$(key_state)

if command -v tvly >/dev/null 2>&1; then
  ver=$(tvly_version)
  printf '%s\n' 'STATUS: READY'
  printf 'TVLY:   %s\n' "$ver"
  printf 'KEY:    %s\n' "$key"
  if [ "$key" = "missing" ]; then
    printf '%s\n' 'HINT:   set TAVILY_API_KEY (tavily.com) or run: tvly login --api-key tvly-…'
  fi
  exit 0
fi

if [ "$check_only" = "1" ]; then
  printf '%s\n' 'STATUS: MISSING'
  printf '%s\n' 'TVLY:   not on PATH'
  printf 'KEY:    %s\n' "$key"
  exit 2
fi

printf '%s\n' 'STATUS: INSTALLING'
if command -v uv >/dev/null 2>&1; then
  if ! uv tool install tavily-cli; then
    printf '%s\n' 'STATUS: ERROR'
    printf '%s\n' 'REASON: uv tool install tavily-cli failed'
    exit 1
  fi
else
  py=$(find_python) || py=''
  if [ -z "$py" ]; then
    printf '%s\n' 'STATUS: ERROR'
    printf '%s\n' 'REASON: no uv and no Python 3.10+ — install from https://docs.tavily.com or: pip install tavily-cli'
    exit 1
  fi
  printf 'PYTHON: %s\n' "$py"
  if ! "$py" -m pip install -U tavily-cli; then
    printf '%s\n' 'STATUS: ERROR'
    printf '%s\n' 'REASON: pip install tavily-cli failed'
    exit 1
  fi
fi

if ! command -v tvly >/dev/null 2>&1; then
  printf '%s\n' 'STATUS: ERROR'
  printf '%s\n' 'REASON: tvly still not on PATH after install (open a new shell or add Scripts to PATH)'
  printf '%s\n' 'HINT:   uv tool install tavily-cli   OR   pip install tavily-cli'
  exit 1
fi

printf '%s\n' 'STATUS: READY'
printf '%s\n' 'TVLY:   installed'
printf 'KEY:    %s\n' "$key"
if [ "$key" = "missing" ]; then
  printf '%s\n' 'HINT:   set TAVILY_API_KEY (tavily.com) or run: tvly login --api-key tvly-…'
fi
exit 0
