---
name: skill-creator
description: Create, improve, review, validate, evaluate, or package Agent Skills. Use when writing SKILL.md metadata/instructions, adding scripts/references/assets/evals, choosing portable versus Claude Code features, auditing dynamic injection, or working on this repository's Node installer. Not for general npm publishing or unrelated prompt/API design.
compatibility: Agent Skills-compatible clients. Bundled validator requires Python 3.10+.
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
user invocation arguments into load-time shell. Use
[dynamic-context-injection](../dynamic-context-injection/SKILL.md) to audit that
pattern.

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

## This repository's package behavior

The published package exposes the Node-native `claude-skills` CLI (Node
`>=20.11.0`). `npx` does not require Bun. The current CLI is interactive and
selective:

```bash
claude-skills install [--project <dir>] [--skip-deps]
claude-skills uninstall [--yes]
claude-skills --help
```

With no command it starts `install`. It offers search skills globally, suggests
`dynamic-context-injection` and `skill-creator` for the selected project, then
offers remaining skills individually as global/project/skip. Global means
`~/.claude`; project means `<project>/.claude`. It does not install to
`.agents/`.

The Node uninstaller removes only global items recorded in
`~/.claude/claude-skills-manifest.json`; it leaves project installs, API keys,
dependencies, and bulk-shell installs alone. `install.sh`/`install.ps1` and their
matching uninstallers are separate bulk flows.

When changing package behavior, read
[references/node-native-installer-pattern.md](references/node-native-installer-pattern.md)
and inspect `bin/cli.js`, `lib/catalog.js`, `lib/install-flow.js`,
`lib/uninstall-flow.js`, and `lib/paths.js`. Do not document aspirational flags as
implemented. `package.json.files` currently ships whole `bin/`, `lib/`,
`skills/`, and `agents/` trees plus `pool.md` and README, so a new file under a
shipped skill does not require a per-skill package entry. Catalog/README updates
are still needed when adding a selectable skill.

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
