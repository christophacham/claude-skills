---
name: skill-creator
description: Create, improve, review, or package Agent Skills. Use when the user asks to make a new skill, edit a SKILL.md, write skill metadata or descriptions, add scripts/references/assets, validate skills, evaluate or optimize skill triggering and output quality, or package a skill collection as an npm package with a Node-native npx/bunx install and uninstall CLI. Not for general npm publishing unrelated to Agent Skills.
compatibility: Agent Skills-compatible clients. Optional validator script requires Python 3.
---

# Skill Creator

Use this skill to create or improve Agent Skills: folders containing `SKILL.md` plus optional `scripts/`, `references/`, and `assets/` files. Optimize for progressive disclosure: only metadata is always loaded, `SKILL.md` loads on activation, supporting files load on demand.

## Where to put skills

In Claude Code (this environment's primary client):

- Personal (all projects): `~/.claude/skills/<skill-name>/SKILL.md`
- Project-local: `.claude/skills/<skill-name>/SKILL.md` (commit to share)
- Precedence on name clash: enterprise > personal > project > bundled skill.
- SKILL.md edits are picked up live mid-session; a brand-new top-level
  skills directory needs a restart.

Cross-agent directories (use only when the skill must also serve Pi or other
Agent Skills clients):

- Global default: `~/.agents/skills/<skill-name>/SKILL.md`
- Pi also loads: `~/.pi/agent/skills/`
- Project-local defaults: `.agents/skills/<skill-name>/SKILL.md` or `.pi/skills/`

In Pi, `.agents/skills` root `.md` files are ignored; use a directory containing `SKILL.md`.

**Claude Code extends the base skill format** with invocation control,
dynamic context injection (a bang-prefixed backtick command), forked subagent execution,
per-skill model/effort, `allowed-tools` permission grants, `paths`
auto-activation, and `${CLAUDE_SKILL_DIR}`/`${CLAUDE_PROJECT_DIR}`
substitutions. Read [references/claude-code-skills.md](references/claude-code-skills.md)
when creating or editing any skill for Claude Code — the high-leverage
patterns section there lists the features most worth using.

## Creation workflow

1. **Clarify the expertise and trigger.** Identify the recurring task, source material, user prompts that should activate it, and near-miss prompts that should not. If the domain expertise is missing, ask for runbooks, examples, corrections from previous work, API docs, schemas, or concrete tasks.
2. **Choose a precise name.** Use lowercase letters, numbers, and hyphens only; 1-64 characters; no leading/trailing hyphen; no consecutive hyphens. For broad compatibility, make the folder name match `name`.
3. **Write the description first.** Keep under 1024 characters. Use imperative trigger phrasing: `Use when...`. Mention user intents, domain terms, implicit cases, and boundaries/near-misses when useful.
4. **Write lean instructions.** Include only what the agent would likely get wrong without the skill: project conventions, workflow steps, gotchas, exact tools, validation loops, and output templates. Prefer procedures over one-off answers.
5. **Add supporting files only when they improve reuse or context economy.**
   - `references/` for detailed docs loaded on demand.
   - `scripts/` for repeated, fragile, or mechanically verifiable operations.
   - `assets/` for templates and static resources.
6. **Validate.** Run the validator from this skill directory when possible:
   - POSIX: `python3 scripts/validate_skill.py <target-skill-dir> --format text`
   - Windows: `py -3 scripts/validate_skill.py <target-skill-dir> --format text` (fallback: `python ...`)
   Also check scripts for non-interactive behavior and useful `--help` output.
7. **Iterate from real use.** Add corrections to gotchas, remove vague/general instructions, and evaluate triggering/output quality for important skills.

## Bundled files

Use these files as needed; do not load them all by default.

- `assets/SKILL_TEMPLATE.md` — Copy/adapt when creating a new skill.
- `assets/TRIGGER_EVAL_QUERIES_TEMPLATE.json` — Copy when optimizing the `description` field.
- `assets/OUTPUT_EVALS_TEMPLATE.json` — Copy to `<skill>/evals/evals.json` when evaluating output quality.
- `scripts/validate_skill.py` — Validate a skill directory after creating or editing it.
- `references/spec-and-patterns.md` — Read when you need frontmatter field details, scoping guidance, pattern examples, or the full trigger/output eval workflows.
- `references/node-native-installer-pattern.md` — Read when implementing or refactoring the actual installer CLI, registry, or install/uninstall code for a packaged skill collection.

## Description guidance

Good descriptions carry the activation burden. Prefer:

```yaml
description: Create and maintain database migrations for this Rails app. Use when adding tables, altering columns, backfilling data, or diagnosing migration failures. Do not use for general SQL analysis unrelated to schema changes.
```

Avoid vague descriptions like `Helps with databases.`

When optimizing a description, build about 20 realistic queries: 8-10 should trigger and 8-10 near-miss should-not-trigger. Vary phrasing, explicitness, file paths, typos, and complexity. Split into train/validation sets if iterating.

## Instruction patterns to include when useful

- **Checklist:** for multi-step workflows where order matters.
- **Validation loop:** do work, run validator/checklist/tests, fix, repeat until pass.
- **Plan-validate-execute:** for destructive, batch, or high-stakes operations.
- **Gotchas:** concrete facts the agent is likely to assume incorrectly.
- **Output template:** exact formats for reports, JSON, commit messages, etc.
- **Defaults with escape hatches:** choose one recommended tool/approach; mention alternatives only when they matter.

## Script guidance

Bundle scripts when the agent would otherwise reinvent the same logic or when correctness is mechanically checkable.

Scripts should:

- Be non-interactive; accept flags, env vars, or stdin.
- Provide concise `--help` with examples.
- Emit machine-readable data on stdout and diagnostics on stderr.
- Have clear error messages and meaningful exit codes.
- Be idempotent where possible and support `--dry-run` for risky actions.
- Pin dependencies or use self-contained runners when feasible (`uv run`, `npx package@version`, `deno run`, etc.).

Reference scripts from `SKILL.md` with paths relative to the skill root, e.g. `scripts/validate_skill.py`. After adding a script, run its `--help` and make sure it cannot block waiting for input.

## Packaging & distribution

When shipping a repo of skills as an npm package:

**Core principle: `npx` must not require Bun.** `bunx` runs Node packages fine, so the portable default is a Node-native CLI: `"bin": { "pkg": "bin/cli.js" }` with `#!/usr/bin/env node` as the shebang. A wrapper that spawns `bun` makes `npx` feel broken; require Bun only if the package is explicitly Bun-only and the README says so. `bunx` working does not prove `npx` is clean — test with Node only.

**Package shape:**

```text
repo/
├── bin/cli.js        # Node-native executable CLI
├── lib/groups.js     # single registry of groups + standalone skills
├── lib/installer.js  # install/uninstall/copy logic
├── skills/           # skill directories containing SKILL.md
└── package.json
```

- Install and uninstall must derive from the same registry (`lib/groups.js`); duplicated lists drift.
- `package.json.files` must list the CLI, libs, README/LICENSE, and every shipped skill directory.
- Default global install copies to both `~/.claude/skills` and `~/.agents/skills`; project-local install uses `.claude/skills` and `.agents/skills` under `process.cwd()` — the user's invocation directory, never the package directory.

**CLI checklist:**

```bash
pkg                          # interactive install (keep a non-interactive path)
pkg install --all            # global install of everything
pkg install --group NAME     # one selectable unit; repeatable flag
pkg uninstall --group NAME   # symmetric removal
pkg install --all --dry-run  # no filesystem writes
pkg --help
```

Richer features (`doctor`, target-root selection, project/global flags, symlink mode) are enhancements, not prerequisites for a basic `npx` experience.

**Gotcha — adding a skill means updating 4 places:** the skill directory, the registry, `package.json.files`, and the README skill list/examples.

**Validation:**

```bash
node bin/cli.js --help
node bin/cli.js install --group <known> --dry-run
node bin/cli.js uninstall --group <known> --dry-run
npm pack --dry-run   # must list every SKILL.md + support file, exclude local-only files
```

Also confirm registry names match directory names and `SKILL.md` `name` fields, and README examples match actual CLI flags. For GitHub Packages, the README needs scope registry setup and `read:packages` token instructions.

## Review checklist

Before finalizing a skill:

- [ ] Directory contains `SKILL.md` and the folder name matches `name`.
- [ ] `name` is valid: lowercase alphanumeric and hyphens, 1-64 chars.
- [ ] `description` is non-empty, under 1024 chars, and says when to use the skill.
- [ ] `SKILL.md` is concise (recommended under 500 lines / 5000 tokens); long content is split into `references/` or `assets/`.
- [ ] Supporting files are referenced with relative paths and clear load/run conditions.
- [ ] Instructions focus on task-specific expertise — no generic advice the agent already knows (`handle errors`, `follow best practices`).
- [ ] Description is neither so broad it triggers on unrelated tasks nor so narrow it only matches exact keywords.
- [ ] Gotchas are concrete and high-value.
- [ ] Decisions have one recommended default, not menus of equal options.
- [ ] Scripts are documented, non-interactive, and safe, with useful errors; fragile, destructive, or multi-step workflows include a validation or self-check step.
- [ ] The skill has been tested on at least one realistic prompt.
- [ ] For Claude Code skills: considered the high-leverage extensions — dynamic injection for live state, `allowed-tools` + `${CLAUDE_SKILL_DIR}` for bundled scripts, invocation control for side-effecting skills, `paths` for auto-activation ([references/claude-code-skills.md](references/claude-code-skills.md)).

## When more detail is needed

For Claude Code skills, the local [references/claude-code-skills.md](references/claude-code-skills.md)
is the first stop. When it seems stale or the user asks for the latest
behavior, fetch the official documentation index on demand with `WebFetch`,
then read only the relevant pages before editing:

- https://code.claude.com/docs/llms.txt
- https://agentskills.io/llms.txt
