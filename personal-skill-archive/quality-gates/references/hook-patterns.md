# Hook patterns (optional)

Use when the repo wants local git hooks. Prefer one orchestrator (lefthook,
pre-commit framework, husky+lint-staged, etc.) already in the ecosystem.

## Good patterns

- **Path globs** so C++ format does not run on docs-only commits.
- **Union change detection:** staged files OR commits since merge-base — so
  both “about to commit” and “range already committed” are visible.
- **MapDriftOnly / LintOnly modes** on the main gate script instead of forked
  half-implementations.
- **commit-msg** policy hooks (trailer bans, issue id) stay separate from
  build hooks.
- **Warm caches** (build dirs, ccache) documented; cold configure is allowed
  to be slow once.

## Anti-patterns

| Pattern | Why it hurts |
|---------|----------------|
| `cmd \|\| true` then grep | False green on crash |
| Env var set on its own line without export | Child tool never sees it |
| Five project loops that swallow errors | Slow + wrong; prefer workspace/solution once |
| Full Docker suite on every commit | Budget death; reserve containers |
| Full gate on pre-push **and** auto-push | Double pay; drop one |
| Soft-skip of format/tidy when tool “missing” | Silent decay; fail or install |

## Proof for any new hook

1. Plant a failure the hook claims to catch → commit blocked (or push blocked
   at the chosen enforcement point).
2. Clean tree → hook exits 0 with a message that reflects real work (timing
   not suspiciously empty).
3. Break the tool (bad path) → nonzero, not “0 findings.”

## Budget note

State a warm budget if you care (e.g. “pre-commit subset under N seconds”).
Measure once on a representative machine; put numbers in docs, not folklore.
