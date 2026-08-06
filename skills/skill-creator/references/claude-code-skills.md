# Claude Code skills — platform reference

Distilled from https://code.claude.com/docs/en/skills (verified 2026-08-06).
Read this when creating or editing skills that will run in Claude Code.
Claude Code follows the Agent Skills open standard and extends it; this file
covers only the extensions and platform behavior.

## Locations and precedence

| Location   | Path                                         | Applies to          |
|------------|----------------------------------------------|---------------------|
| Enterprise | managed settings                             | whole organization  |
| Personal   | `~/.claude/skills/<name>/SKILL.md`           | all your projects   |
| Project    | `.claude/skills/<name>/SKILL.md`             | this project        |
| Plugin     | `<plugin>/skills/<name>/SKILL.md`            | where plugin active |

- Precedence on name clash: enterprise > personal > project > bundled skill
  (a project `code-review` replaces the bundled `/code-review`).
- `.claude/commands/<name>.md` files still work and create `/<name>`; a skill
  with the same name wins. Commands support the same frontmatter.
- A skill entry may be a symlink to a directory elsewhere; followed, loaded once.
- Nested `.claude/skills/` below the working dir load on first file access in
  that subdirectory (not at startup). Clashing nested names get a qualified
  command: `apps/web:deploy`.
- Live change detection: edits to SKILL.md under watched skill dirs apply
  mid-session, no restart. A brand-new top-level skills dir needs a restart.
- Plugin skills are namespaced `plugin:skill` and can't clash.

## Frontmatter fields

Claude Code treats every field as optional and recommends `description`; it
falls back to the first body paragraph and directory name when metadata is
absent. Portable upload/package validation still requires `name` and
`description`. Booleans accept
yes/no/on/off/1/0 (v2.1.218+; before that only true/false).

| Field                      | Purpose |
|----------------------------|---------|
| `name`                     | Display label only (personal/project). In plugins, sets the command's last segment. |
| `description`              | What + when. Carries the activation burden. Key use case FIRST: combined description+when_to_use truncated at 1,536 chars in the listing. |
| `when_to_use`              | Extra trigger context/phrases, appended to description in the listing. |
| `argument-hint`            | Autocomplete hint, e.g. `[issue-number]`. |
| `arguments`                | Named positional args for `$name` substitution. String or YAML list. |
| `disable-model-invocation` | `true` = only the user can `/name` it; hidden from Claude entirely (also blocks scheduled-task firing). Use for side-effect workflows: deploy, push, send. |
| `user-invocable`           | `false` = hidden from `/` menu; Claude-only. Use for background knowledge. |
| `allowed-tools`            | Tools pre-approved during the invoking turn only. String or list. Clears on next user message. Does not restrict other tools. |
| `disallowed-tools`         | Tools removed while the skill is active (e.g. `AskUserQuestion` in an autonomous loop). Clears next turn. |
| `model`                    | Model override for the rest of the turn; not persisted. |
| `effort`                   | Effort override: low/medium/high/xhigh/max. |
| `context`                  | `fork` = run in a forked subagent (see below). |
| `agent`                    | Subagent type for `context: fork` (Explore, Plan, general-purpose, or custom). |
| `background`               | With fork: `false` = block until result (v2.1.218+; default true = background). |
| `hooks`                    | Skill-lifecycle-scoped hooks. |
| `paths`                    | Globs limiting auto-activation to matching files (path-specific-rules format). |
| `shell`                    | `bash` (default) or `powershell` for `!` injections in this skill. |

Invocation matrix:

| Frontmatter                      | User | Claude | Listing |
|----------------------------------|------|--------|---------|
| (default)                        | yes  | yes    | description always in context |
| `disable-model-invocation: true` | yes  | no     | description NOT in context |
| `user-invocable: false`          | no   | yes    | description always in context |

## Command naming

- Personal/project: command = directory name (frontmatter `name` is display only).
- Plugin `skills/` subdir: command = `plugin:<name-field or dir-name>`.
- Nested clash: `<subdir-path>:<name>`.

## String substitutions

| Variable                | Expands to |
|-------------------------|------------|
| `$ARGUMENTS`            | All args as typed. If absent from content, args are appended as `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]` / `$N`  | 0-based positional arg. Missing index stays literal. |
| `$name`                 | Named arg from `arguments:` frontmatter; missing expands to empty string. |
| `${CLAUDE_SESSION_ID}`  | Session id (logs, session-scoped files). |
| `${CLAUDE_EFFORT}`      | low/medium/high/xhigh/max (ultracode reports as xhigh). Adapt instructions to effort. |
| `${CLAUDE_SKILL_DIR}`   | The skill's own directory — reference bundled scripts regardless of cwd or install level. |
| `${CLAUDE_PROJECT_DIR}` | Project root. |

- Multi-word args need quotes at invocation: `/skill "hello world" second`.
- Literal `$`: escape as `\$1.00`.
- `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` also expand inside
  `allowed-tools` Bash rules — the pattern for permission-free bundled scripts:

```yaml
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
```

(SKILL_DIR in allowed-tools: v2.1.129+; PROJECT_DIR: v2.1.196+.)

## Dynamic context injection

`` !`<command>` `` is a Claude Code-only preprocessing feature. Before the model
sees a skill, Claude Code runs each active placeholder in the selected shell and
replaces it with stdout. Portable skill uploads accept the Markdown but do not
perform this preprocessing.

Exact literal examples belong in a reference file: the skill preprocessor scans
fenced examples in `SKILL.md` too. In body prose, `KEY=!`cmd`` is safe because the
`!` follows a non-whitespace character.

Semantics:

- Inline form is recognized when `!` starts a line or follows whitespace; it may
  appear after prose (`State: !`cmd``). Multi-line form is a fence opened with
  ` ```! ` and is one shell script.
- Rendering is a single pass over the original skill. Inserted stdout is not
  scanned for more injection placeholders.
- The selected shell still performs normal expansion inside a command. Shell
  variables, pipelines, conditionals, and `$(...)` command substitution work in
  one Bash block; this does not contradict single-pass rendering.
- Treat separate placeholders as independent and unordered. They may execute
  concurrently and do not share variables, `cd`, or exit status. Put dependent
  commands in one fenced script, where statements run sequentially.
- All-arguments, indexed, and named skill placeholders are substituted before
  shell execution. This is textual substitution, not safe argv quoting. Never
  place invocation text in injected shell, even inside quotes; keep it in prompt
  content, validate it, and use a normal tool call.
- `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` are trusted platform paths;
  quote them. Never print secret environment values—only presence/status.
- `shell: bash` is the default. `shell: powershell` uses PowerShell only where the
  PowerShell tool is enabled.
- `"disableSkillShellExecution": true` replaces user/project/plugin/additional-
  directory commands with `[shell command execution disabled by policy]`.
  Bundled and managed skills are not affected. Surrounding prose must tolerate
  missing live state.

A failing command has no recoverable tool-result turn: diagnostics/failure text
can pollute the rendered prompt. Guard expected absence in the same placeholder
and emit one bounded status line. In Bash, do not rely on
`cmd | head || fallback` without `pipefail`; the final pipeline command may hide
the read failure. In PowerShell, native nonzero exits require checking
`$LASTEXITCODE` even inside `try`/`catch`.

## Forked execution (`context: fork`)

Skill content becomes the prompt of an isolated subagent — no conversation
history. Use for parallelizable or context-polluting tasks.

- `agent: Explore` gives a cheap read-only researcher (skips CLAUDE.md/git
  status). Omit `agent` for general-purpose.
- Runs in background by default (v2.1.218+); `background: false` blocks.
  Also blocks: `-p`/SDK mode, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`,
  re-invoking while a previous fork of the same skill runs, scheduled tasks.
- Background forks get the narrower background-subagent tool set; if your
  steps need more, set `background: false`.
- Fork edits happen outside `/rewind` checkpoints — revert via git.
- WARNING: fork only makes sense with an actionable task. Pure guideline
  skills ("use these conventions") return nothing meaningful when forked.

## Content lifecycle (write for this)

- Rendered skill content enters context once and STAYS for the session —
  every body line is a recurring token cost. State what, not why.
- Re-invoking with identical rendered content adds only an "already loaded"
  note; changed args or injection output re-appends the full content.
- Compaction re-attaches invoked skills: first 5,000 tokens each, 25,000
  combined, most-recent-first — old skills can be dropped entirely.
  Re-invoke after compaction if the skill seems to have stopped applying.
- `allowed-tools` grants clear on the next user message; content persists.

## Skill listing budget

- Listing (names+descriptions) budget ≈ 1% of context window; overflow trims
  least-invoked skills first. `/doctor` estimates cost; `/context` shows the
  applied size. Tune: `skillListingBudgetFraction`,
  `skillListingMaxDescChars`, or set low-priority skills to `"name-only"`
  via `skillOverrides` in settings (or the `/skills` menu: Space cycles,
  Enter saves to settings.local.json).
- `skillOverrides` states: `"on"`, `"name-only"`, `"user-invocable-only"`
  (menu label: user-only), `"off"` (hidden everywhere; invocation errors).
- Permission rules also work: `Skill(commit)`, `Skill(review-pr *)`, deny
  `Skill` to disable all.

## High-leverage patterns (use these)

1. **Inject bounded local state** — static, read-only repository/tool readiness
   that every invocation needs, with expected failures guarded. Keep network
   reads, mutations, secret values, and invocation-derived arguments in normal
   tool calls.
2. **Permission-free bundled scripts** — `allowed-tools` +
   `${CLAUDE_SKILL_DIR}` rule matching the exact command the body runs.
3. **Fork for isolation/parallelism** — `context: fork` + `agent: Explore`
   for research; background default keeps the main loop free.
4. **`paths:` auto-activation** — skill loads itself only when relevant files
   are touched; no description-guessing.
5. **Per-skill model/effort** — cheap model for mechanical skills; or read
   `${CLAUDE_EFFORT}` in the body and branch (e.g. skip cross-model review on
   low effort).
6. **Invocation control** — `disable-model-invocation: true` on anything with
   side effects (push, deploy, close-beads); `user-invocable: false` for pure
   knowledge packs.
7. **Override bundled skills** — a project `code-review`/`verify` skill
   replaces the bundled one; encode your house review style once.
8. **`when_to_use`** — pack trigger phrases users actually say without
   bloating the description's first 1,536 chars.

## Troubleshooting quicklist

- Not triggering: keywords missing from description; malformed YAML loads
  body with empty metadata (`--debug` shows the parse error); invoke
  `/name` directly to test.
- Triggers too often: tighten description, or `disable-model-invocation`.
- Descriptions truncated: listing budget exceeded — see above.
