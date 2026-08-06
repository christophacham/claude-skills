---
name: dynamic-context-injection
description: Audit and teach Claude Code dynamic context injection (load-time shell output embedded in skill content). Use when reviewing a skill's injected commands, replacing avoidable read-only setup calls, or checking argument safety, shell behavior, failure guards, and context cost. Not for writing a complete skill (use skill-creator), runtime tool-call tuning, or portable Agent Skills clients that do not implement Claude Code injection.
compatibility: Claude Code; this skill documents Claude Code-only load-time shell preprocessing.
argument-hint: "[skill-dir-or-empty-for-all]"
---

# Dynamic context injection — audit and teach

Dynamic context injection is a Claude Code extension, not part of portable Agent
Skills. Claude Code renders a skill before the model sees it: each active
placeholder runs in the configured shell and its stdout is inserted into the
skill body. Use it only for small, trusted, read-only state that every invocation
needs.

Literal examples are dangerous in `SKILL.md`: Claude Code preprocesses fenced
examples too. This file uses `KEY=!`…`` when naming the inline form so the `!`
is not active. Exact examples live in
[references/injection-examples.md](references/injection-examples.md), which is
read on demand and is not skill-preprocessed.

## Safety contract

1. **Read-only and unconditional.** Rendering occurs before the model can decide
   whether a command is appropriate. Do not inject claims, installs, writes,
   commits, network requests, or other mutations. Keep those as normal tool
   calls with ordinary permission and error handling.
2. **Invocation text is data, never shell source.** Claude Code substitutes
   all-arguments, indexed, and named argument placeholders before starting the
   shell. Quoting a placeholder inside the command does not turn textual
   substitution into safe argv passing. Do not put invocation arguments in an
   injection. Show them in prompt content, validate them, then use a tool call.
3. **Trusted platform paths are allowed.** The skill and project directory
   substitutions are platform-provided paths, but quote them in shell source.
   Session and effort substitutions are also trusted metadata; do not confuse
   them with user arguments.
4. **Do not expose secrets.** Inject only presence/status, never environment
   variable values, tokens, settings contents, credentials, or unredacted
   command output that may contain them. Inserted output becomes model context.
5. **Bound cost.** Commands must be local, quick, non-interactive, and bounded
   (`--limit`, a small file slice, or a concise summary). An injection is paid on
   accidental triggers too.

## Renderer and shell semantics

- The inline marker is recognized when `!` starts a line or follows whitespace;
  `KEY=!`cmd`` remains literal. A multi-line injection is one fenced shell
  script opened by a fence whose info string is `!`.
- Rendering scans the original skill once. Inserted stdout is plain text and is
  not scanned for new injection markers.
- Normal shell evaluation still happens *inside one injection*. Shell variables,
  pipelines, conditionals, and command substitution such as `$(...)` work. This
  is unrelated to the renderer's single pass.
- Treat separate placeholders as independent and unordered: implementations may
  execute them concurrently, and they do not share shell variables, working
  directory changes, or exit status. Put dependent reads in one fenced block;
  commands in that block run sequentially in one shell.
- `shell: bash` is the default. `shell: powershell` selects PowerShell only where
  Claude Code's PowerShell tool is enabled. Do not write a block that assumes
  both syntaxes.
- With `disableSkillShellExecution: true`, user/project/plugin injections are
  replaced by a policy placeholder. Bundled and managed skills are exempt. The
  surrounding instructions must remain useful when live state is unavailable.

## Failure and guard semantics

An injected failure is rendered before the model has a tool-result recovery
path. Stderr and failure text can pollute the prompt, and a malformed block may
leave the skill without useful state. Handle expected absence inside the same
injection and emit one short status line.

Guard the operation that can fail, not a later pipeline stage:

- In Bash, `cmd 2>/dev/null | head ... || fallback` is not a reliable guard
  without `pipefail`: `head` may succeed after `cmd` failed. Prefer an `if`
  around command substitution, then bound the captured output.
- An `|| fallback` at the end of a multi-line block guards only the immediately
  preceding command. Handle each expected failure or use an explicit block-level
  conditional.
- In PowerShell, use `try`/`catch`, `Get-Command`, and `-ErrorAction Stop` where
  absence is expected. Native command nonzero exits require checking
  `$LASTEXITCODE`; they are not automatically PowerShell exceptions.
- Redirect expected diagnostic stderr, but keep an informative stdout fallback.
  Unexpected failures should say the state is unavailable, not fabricate it.

## Audit procedure

Target the first skill argument. With no argument, inspect project and personal
Claude Code skill directories. For each `SKILL.md`:

1. Parse frontmatter first. Portable mode has no injection. In Claude Code mode,
   record `shell`, `arguments`, invocation control, and skill scope.
2. Find every active inline marker and fenced injection, including markers in
   Markdown examples. A marker may appear after prose whitespace, not only at
   column zero.
3. For each injection, verify: read-only; no invocation placeholders; no secret
   output; local/bounded/non-interactive; independent of sibling injections; and
   guarded where repository/tool/file absence is normal.
4. Check multi-line logic as shell code. Distinguish valid shell `$(...)`
   substitution within a block from invalid cross-placeholder dependency.
5. Find conversion candidates: instructions that always run a trusted static
   read solely to place bounded output in context. Leave mutations, user-derived
   arguments, conditional/slow/network work, and dependent runtime decisions as
   normal tool calls.
6. Run `../skill-creator/scripts/validate_skill.py <skill-dir> --mode
   claude-code --format text` when that relative layout exists. Treat validator
   output as a floor; manually review command meaning and possible secret output.

## Report

| skill | line | verdict | detail |
|-------|------|---------|--------|
| … | … | VIOLATION / CONVERT / OK | rule, failure mode, exact replacement |

Sort violations first. For each conversion, show a minimal before/after snippet
using the patterns in
[references/injection-examples.md](references/injection-examples.md). End with
how many routine tool round-trips the conversions remove and note any state that
remains a runtime tool call.

## Reference loading

- Read [references/injection-examples.md](references/injection-examples.md) for
  exact syntax, independent-versus-dependent examples, and Bash/PowerShell
  guards.
- Read `../skill-creator/references/claude-code-skills.md` for the current Claude
  Code field and substitution table when platform behavior is in question.
