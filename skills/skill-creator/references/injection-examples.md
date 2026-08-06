# Dynamic context injection — worked examples

Reference files are read on demand and are not preprocessed as skill bodies, so
this file can show literal Claude Code injection syntax. Each `After` block is
what would appear in a real `SKILL.md`.

## Convert: bounded static read

Before (one routine tool round-trip on every invocation):

```markdown
First run `git status --short` and use the result as repository context.
```

After:

```markdown
## Repository state at load
!`git status --short 2>/dev/null || printf '%s\n' '(git status unavailable)'`

If the state line says it is unavailable, continue without repository state.
```

No invocation text enters the command. The fallback is short and the surrounding
instruction still works when shell execution is disabled by policy.

## Convert: dependent reads in one fenced script

Commands inside one fenced injection run sequentially in one shell, so local
variables and shell command substitution are valid:

````markdown
## Repository identity
```!
if root=$(git rev-parse --show-toplevel 2>/dev/null); then
  printf 'root=%s\n' "$root"
  if sha=$(git -C "$root" rev-parse --short HEAD 2>/dev/null); then
    printf 'sha=%s\n' "$sha"
  else
    printf '%s\n' 'sha=unavailable'
  fi
else
  printf '%s\n' 'git=unavailable'
fi
```
````

The `$(...)` forms are normal Bash command substitution. The renderer's
single-pass rule only says that *stdout* is not scanned for more injection
markers.

## Independent placeholders: no ordering contract

```markdown
## Runtime
!`node --version 2>/dev/null || printf '%s\n' 'node=unavailable'`

## Repository
!`git status --short 2>/dev/null || printf '%s\n' 'git=unavailable'`
```

These reads are independent. Claude Code may execute separate placeholders
concurrently. They cannot share `cd`, variables, temporary files, or exit status.
If the second read depends on the first, combine them into one fenced script.

## Violation: invocation argument pasted into shell

```markdown
!`bd show "$ARGUMENTS"`
!`bd show "$0"`
```

Both are unsafe. Claude Code performs argument substitution before the shell
runs; shell quotes surround the pasted text but do not create a safely escaped
argv element. Keep the argument visible as ordinary prompt content and execute
only after model-side validation:

```markdown
## Request
$ARGUMENTS

Validate the requested bead id as data. Then call `bd show` with a normal Bash
tool call; do not interpolate it into load-time shell.
```

Named arguments behave the same way. If frontmatter declares
`arguments: [bead]`, `$bead` must not appear in injected shell source.

## Violation: cross-placeholder dependency

```markdown
!`bd ready --json`
!`bd show "$id_from_the_previous_output"`
```

Separate placeholders do not pass data or shell state to one another. The first
stdout becomes prompt text; it is not a shell variable and is not reprocessed.
Keep the second step as a normal tool call after the model selects and validates
an id. If all inputs are trusted and the read is truly unconditional, combine
the dependent commands into one guarded fenced injection instead.

## Violation: mutation at load

```markdown
!`bd update task-123 --claim`
!`git add -A && git commit -m checkpoint`
```

Rendering is unconditional and precedes model judgment. Claims, installs,
writes, commits, pushes, and other state changes stay ordinary tool calls.

## Violation: misleading pipeline fallback

This looks guarded but is not reliable in Bash without `pipefail`:

```markdown
!`cat package.json 2>/dev/null | head -40 || echo '(no package.json)'`
```

If `cat` fails, `head` can still exit zero, so the fallback never runs. Guard
the failing read and bound output afterward:

````markdown
```!
if content=$(cat package.json 2>/dev/null); then
  printf '%s\n' "$content" | head -40
else
  printf '%s\n' '(package.json unavailable)'
fi
```
````

## Bash guard for optional tooling

````markdown
```!
if command -v bd >/dev/null 2>&1; then
  if ready=$(bd ready 2>/dev/null); then
    printf '%s\n' "$ready" | head -30
  else
    printf '%s\n' 'beads=unavailable'
  fi
else
  printf '%s\n' 'beads=not-installed'
fi
```
````

The output is bounded and reveals no credential value.

## PowerShell guard for optional tooling

With `shell: powershell`:

````markdown
```!
if (Get-Command git -ErrorAction SilentlyContinue) {
  try {
    $root = & git rev-parse --show-toplevel 2>$null
    if ($LASTEXITCODE -eq 0) { "root=$root" } else { 'git=unavailable' }
  } catch {
    'git=unavailable'
  }
} else {
  'git=not-installed'
}
```
````

PowerShell `try`/`catch` does not turn every native nonzero exit into an
exception, so the example checks `$LASTEXITCODE`.

## Secret-safe readiness snapshot

Report only presence, never a token value:

````markdown
```!
if [ -n "${SERVICE_API_KEY:-}" ]; then
  printf '%s\n' 'service_key=present'
else
  printf '%s\n' 'service_key=missing'
fi
```
````

Environment variables used as trusted local state are different from skill
invocation arguments. Still audit the output: anything inserted here becomes
model-visible context.

## What does not convert

- User-derived arguments or values selected from earlier model-visible output.
- Mutations: issue claims/updates, installs, file writes, commits, pushes.
- Network calls, long scans, interactive commands, and optional expensive work.
- Commands whose execution is itself a model decision.
- Reads whose raw output may expose secrets or is too large to bound safely.
