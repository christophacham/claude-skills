---
name: dynamic-context-injection
description: Audit and teach the dynamic-context-injection pattern (load-time shell commands inlined into skill content) in Agent Skills. Use when reviewing skills for context efficiency, checking whether existing injections are correct, converting "run this command" skill instructions into load-time injection, or learning how the pattern works with examples. Not for writing whole skills from scratch (use skill-creator) or for tool-call tuning unrelated to context cost.
argument-hint: [skill-dir-or-empty-for-all]
---

# Dynamic context injection — audit & teach

Context is treasure. Every `Bash(...)` tool call a skill makes just to *read*
state costs the model context three times: the tool_use block, the tool_result
envelope, and the model's reasoning about whether to call. An injection (a
line whose `!` sits at line start or after whitespace, followed by a backtick
command) runs the command when the skill loads and inlines the output as
plain content — the model simply reads the result. Same data, no system-call
noise. This skill audits skills for correct use of that pattern and finds
conversions.

**Writing examples of this pattern is itself dangerous:** the preprocessor
scans the whole SKILL.md including fenced code blocks, and an example that
matches the syntax EXECUTES at load. All literal before/after examples live
in [references/injection-examples.md](references/injection-examples.md) —
reference files are read on demand and never preprocessed. In SKILL.md
prose, keep a non-whitespace character in front of any `!` (e.g. `KEY=!`…``)
so it stays literal.

## The rules (every audit checks these)

1. **Read-only only.** Injected commands run unconditionally at load, even if
   the model never acts. Never inject mutations (`bd update`, `git commit`,
   `bd dep add`, file writes). Mutations stay tool calls.
2. **Single pass.** Substitution runs once over the original file; command
   output is NOT re-scanned. A command cannot emit a placeholder for a later
   pass — no chaining.
3. **No invocation text in shell source.** Inject only trusted static commands
   and trusted environment-provided paths such as the bundled skill directory. Invocation
   arguments are preprocessor paste-text, not safely escaped argv; keep them in
   ordinary prompt content, validate them, then use a normal tool call. Commands
   depending on prior output likewise stay tool calls.
4. **Syntax:** the `!` must be at line start or directly after whitespace.
   `KEY=!`cmd`` is literal and never runs. Multi-line commands use a fenced
   block opened with three backticks + `!`.
5. **Cheap, non-interactive, cwd-safe.** It runs on every load, including
   accidental triggers. User-level skills load in ANY repo — an injected
   `bd ...` there must be guarded (append `2>/dev/null || echo "…"`) or it
   pollutes context with error text instead of saving it.
6. **Failure pollutes.** A failing injected command dumps its error into
   context — worse, an unparseable one can abort the whole skill load.
   Guard anything that can legitimately fail.
7. **Policy kill-switch:** `"disableSkillShellExecution": true` in settings
   replaces each command with `[shell command execution disabled by policy]`
   — skill bodies must still make sense with that placeholder.
8. **Self-execution hazard.** A skill TEACHING this pattern must not contain
   literal trigger syntax in SKILL.md — put examples in a references/ file.

## Audit procedure

Target: the skill's first argument — a skill directory, or empty = audit
all skills in `.claude/skills/` (project) and `~/.claude/skills/` (user).

For each `SKILL.md`:

1. **Existing injections** — find every injection line and fenced-`!` block;
   check against rules 1–8. Common violations: mutations injected, args from
   prior output, unguarded cross-repo commands, `!` examples that execute.
2. **Conversion candidates** — find instructions telling the model to run a
   read-only command purely to consume its output before acting. Signals:
   imperative "run X", "check X", "read X via command", bash blocks whose
   only purpose is to feed the next instruction. For each, judge: is every
   input trusted static/environment state (rule 3)? Is it read-only (rule 1)?
   Is it cwd-safe at this skill's scope (rule 5)? All three → candidate.
3. **Leave-alone** — mutations, dependent-step commands, interactive or slow
   commands, and commands the model must decide *whether* to run.

## Report format

| skill | line | verdict | detail |
|-------|------|---------|--------|
| … | … | VIOLATION / CONVERT / OK | rule cited, proposed replacement |

Sort VIOLATIONs first. For each CONVERT, show the exact before/after diff
snippet (patterns: [references/injection-examples.md](references/injection-examples.md)).
End with the count of tool calls per typical invocation the conversions
would eliminate.

## Examples and reference

- Worked before/after examples, including the classic violations (mutation
  injected, chained args, unguarded user-level scope):
  [references/injection-examples.md](references/injection-examples.md)
- Full platform semantics (substitution variables, kill-switch, `shell:
  powershell`): `../skill-creator/references/claude-code-skills.md` (or `~/.claude/skills/skill-creator/references/claude-code-skills.md`)
  — section "Dynamic context injection".
