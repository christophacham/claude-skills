---
name: skill-creator
description: Create, improve, review, validate, evaluate, or package Agent Skills; audit Claude Code dynamic context injection (load-time shell). Use when writing SKILL.md metadata/instructions, adding scripts/references/assets/evals, choosing portable versus Claude Code features, reviewing injected commands for argument safety/shell behavior/failure guards/context cost, converting avoidable read-only setup into load-time injection, or working on this repository's Node installer. Not for general npm publishing, runtime tool-call tuning unrelated to skills, or portable clients that lack injection.
compatibility: Agent Skills-compatible clients. Bundled validator requires Python 3.10+. Dynamic context injection is Claude Code-only.
---

# Skill creator

An Agent Skill is a directory with `SKILL.md` and optional support files. Only
metadata is listed up front; the body loads when activated; references, scripts,
assets, and eval inputs load on demand. Keep each layer useful at its own cost.

## Choose the target before authoring

Use one profile deliberately:

- **Portable Agent Skills:** only `name`, `description`, `license`,
  `compatibility`, `metadata`, and `allowed-tools` in frontmatter. `name` and
  `description` are required by portable packaging/upload validation. Claude
  Code-only body preprocessing does not run in portable clients.
- **Claude Code:** accepts portable fields plus invocation control, arguments,
  tool grants/restrictions, model/effort, forked execution, hooks, paths, shell,
  and dynamic context injection. Claude Code itself can fall back when `name` or
  `description` is omitted, but this repository keeps both for identity and
  cross-client compatibility.

Validate with the matching mode; do not call a Claude Code skill portable merely
because another client ignores unknown behavior.

## Locations

Claude Code discovers personal skills under `~/.claude/skills/<name>/` and
project skills under `.claude/skills/<name>/`. Other Agent Skills clients commonly
use `~/.agents/skills/` and `.agents/skills/`, but this repository's selective
Node installer currently writes only Claude Code locations. Copying to cross-
agent locations is a separate/manual distribution decision.

Read [references/claude-code-skills.md](references/claude-code-skills.md) before
adding Claude Code extensions. Its platform table distinguishes standard fields
from extensions and documents substitution and injection hazards.

## Workflow

1. Define one recurring unit of work, its source expertise, should-trigger
   prompts, and near misses. Ask for runbooks, corrections, schemas, examples, or
   concrete failures when domain knowledge is missing.
2. Choose a lowercase hyphenated directory/name (1–64 characters) and preserve
   that identity. Write the description first: what the skill does, when to use
   it, and the nearest boundary.
3. Write only the non-obvious contract: decision rules, fragile ordered steps,
   project conventions, exact commands, failure modes, validation, and output
   shape. Do not fill a template section that has no job.
4. Put detailed optional knowledge in `references/`, reusable deterministic
   operations in `scripts/`, static output material in `assets/`, and output
   evaluations in `evals/`.
5. Validate in the intended profile, run script `--help`/smoke checks, and run at
   least one realistic eval. Fix errors; review warnings rather than blindly
   suppressing them.
6. Iterate from observed trigger misses and output failures. Preserve useful
   identities/files unless the user explicitly approves a rename or removal.

## Dynamic context injection (audit mode)

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

### Safety contract

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

### Renderer and shell semantics

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

### Failure and guard semantics

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

### Audit procedure

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
6. Run `scripts/validate_skill.py <skill-dir> --mode claude-code --format text`
   (or `${CLAUDE_SKILL_DIR}/scripts/validate_skill.py` when installed). Treat
   validator output as a floor; manually review command meaning and possible
   secret output.

### Report

| skill | line | verdict | detail |
|-------|------|---------|--------|
| … | … | VIOLATION / CONVERT / OK | rule, failure mode, exact replacement |

Sort violations first. For each conversion, show a minimal before/after snippet
using the patterns in
[references/injection-examples.md](references/injection-examples.md). End with
how many routine tool round-trips the conversions remove and note any state that
remains a runtime tool call.

## Validation

The bundled validator is standard-library-only and uses a conservative typed
YAML subset. It rejects duplicate keys, aliases/anchors/tags/merge keys, unknown
fields for the selected profile, invalid extension types/combinations, unsafe
load-time injection, and malformed eval files. Python cache artifacts are ignored
when inventorying scripts.

```bash
# Portable upload/package surface
python3 scripts/validate_skill.py <skill-dir> --mode portable --format text

# Claude Code frontmatter + dynamic injection audit
python3 scripts/validate_skill.py <skill-dir> --mode claude-code --format text
```

The default is `claude-code` for this Claude Code-first repository, but automation
should pass `--mode` explicitly. Windows can use `py -3` or `python`.

The injection audit is intentionally conservative, not a shell proof. It rejects
invocation argument substitution, obvious mutations, and file-writing
redirection; it warns about unguarded reads. Manually review data sensitivity,
network/latency, and whether every command is truly unconditional.

## Frontmatter and description

Portable example:

```yaml
---
name: rails-migrations
description: Create and maintain Rails database migrations. Use when adding or altering schema, backfilling data, or diagnosing migration failures. Not for read-only SQL analysis.
compatibility: Rails application with Bundler available.
---
```

Claude Code extension example:

```yaml
---
name: deploy-preview
description: Deploy a preview environment after explicit user invocation.
disable-model-invocation: true
argument-hint: [environment]
arguments: [environment]
allowed-tools: Bash(./scripts/deploy-preview *)
---
```

Descriptions carry activation. Use realistic intents and boundaries, not a list
of synonyms. For trigger tuning, keep train and validation queries separate and
include indirect phrasing, paths, typos, buried subtasks, and keyword-sharing
near misses.

## Supporting files and scripts

Reference support paths relative to the skill root and say when to load/run them.
Scripts should be non-interactive, accept flags/env/stdin, provide useful
`--help`, separate machine output from diagnostics, use meaningful exit codes,
and be idempotent where practical. Add `--dry-run` when a repeated operation can
mutate external state.

For Claude Code bundled scripts, `${CLAUDE_SKILL_DIR}` locates the installed
skill and can also appear in a matching `allowed-tools` Bash rule. Never paste
user invocation arguments into load-time shell. Use the audit mode above (and
[references/injection-examples.md](references/injection-examples.md)) when adding
or reviewing injections.

## Output eval schema

Place output evaluations at `<skill>/evals/evals.json`. The schema used by the
official skill-creator plugin is an object with `skill_name` and a non-empty
`evals` array. Each eval has a unique positive integer `id`, realistic `prompt`,
human-readable `expected_output`, optional `files`, and a non-empty
`expectations` array. File paths are relative to and confined within the skill
root and must exist. Use `files: []` when no fixture is needed.

```json
{
  "skill_name": "rails-migrations",
  "evals": [
    {
      "id": 1,
      "prompt": "Add a production-safe index for users.email.",
      "expected_output": "A migration plan and implementation that avoids a blocking transaction.",
      "files": [],
      "expectations": [
        "Uses the repository's migration safety mechanism.",
        "Includes a concrete validation command and expected success evidence."
      ]
    }
  ]
}
```

Expectations describe observable pass/fail evidence, not internal reasoning or
vague quality. Run evals with the skill and a baseline/previous version; record
outputs, expectation evidence, and cost/latency when available.

Templates:

- `assets/SKILL_TEMPLATE.md` — minimal portable starting point.
- `assets/TRIGGER_EVAL_QUERIES_TEMPLATE.json` — copy to `evals/trigger_queries.json`; include at least one positive and one near-miss negative query.
- `assets/OUTPUT_EVALS_TEMPLATE.json` — output eval schema above.
- [references/spec-and-patterns.md](references/spec-and-patterns.md) — field
  types, scoping, and eval workflow.
- [references/injection-examples.md](references/injection-examples.md) — literal
  injection syntax, guards, and convert/violation pairs.
- [references/claude-code-skills.md](references/claude-code-skills.md) — Claude
  Code field and substitution table.

## This repository's package behavior

The published package exposes the Node-native `claude-skills` CLI (Node
`>=20.11.0`). `npx` does not require Bun. The current CLI is interactive and
selective:

```bash
claude-skills install [--project <dir>] [--skip-deps]
claude-skills uninstall [--yes]
claude-skills --help
```

With no command it starts `install`. It offers SEARCH skills globally (default-yes),
suggests AUTHOR `skill-creator` for the selected project, offers CORE
(`operating-mode`, `beads-om`, `simple-design`, `refactoring`) default-yes,
then OPT_IN/beads individually as skip-default/global/project. Global means
`~/.claude`; project means `<project>/.claude`. It does not install to `.agents/`.

The Node uninstaller removes only global items recorded in
`~/.claude/claude-skills-manifest.json`; it leaves project installs, API keys,
and dependencies alone. Remove project installs via the wizard (deselect + Apply).

When changing this repository's package behavior, read
`docs/node-native-installer-pattern.md` at the package root and inspect
`bin/cli.js`, `lib/catalog.js`, `lib/install-flow.js`, `lib/uninstall-flow.js`,
and `lib/paths.js`. Do not document aspirational flags as implemented.
`package.json.files` currently ships whole `bin/`, `lib/`, `skills/`, and
`agents/` trees plus `pool.md` and README, so a new file under a shipped skill
does not require a per-skill package entry. Catalog/README updates are still
needed when adding a selectable skill.

## Review checklist

- [ ] Target profile is explicit; validator passes in that mode.
- [ ] Directory, `name`, references, and `skill_name` agree.
- [ ] Description states trigger and nearest non-trigger.
- [ ] Body contains task-specific judgment, not generic filler.
- [ ] Support files are referenced and optional content is off the hot path.
- [ ] Frontmatter values use supported types; no duplicate or advanced YAML.
- [ ] Claude Code injection is static/read-only/bounded/secret-safe and guarded.
- [ ] Scripts are non-interactive and smoke-tested.
- [ ] Evals use positive integer IDs, confined existing fixtures, and observable expectations.
- [ ] Package instructions match the executable CLI rather than a desired future CLI.
