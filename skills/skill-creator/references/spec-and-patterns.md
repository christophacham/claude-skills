# Agent Skills specification details and eval workflows

Load this when you need frontmatter field details, scoping guidance, concrete pattern examples, or the full trigger/output evaluation workflows. The core rules are in `SKILL.md`.

## Frontmatter fields

`SKILL.md` must start with YAML frontmatter followed by Markdown instructions.

Required:

- `name`: 1-64 chars; lowercase `a-z`, `0-9`, hyphens; no leading/trailing hyphen; no consecutive hyphens; should match parent directory for cross-client compatibility.
- `description`: 1-1024 chars; describes what the skill does and when to use it.

Optional:

- `license`: short license name or bundled license file.
- `compatibility`: max 500 chars; include only for specific environment requirements.
- `metadata`: arbitrary key-value map.
- `allowed-tools`: experimental space-separated pre-approved tools string.

## Scoping

A skill should cover one coherent unit of work. Too narrow means multiple skills activate for one task. Too broad means imprecise triggering and bloated context.

Prefer moderate detail: concise stepwise guidance plus one concrete example usually beats exhaustive documentation.

## Grounding sources

Good skills are grounded in real expertise:

- Corrections users gave during real tasks.
- Internal runbooks, style guides, API specs, schemas, and config files.
- Code review comments, issue trackers, or repeated failure fixes.
- Existing scripts or manual procedures that should become repeatable.

## Trigger evaluation

The `description` determines whether a skill triggers. To evaluate it:

1. Create ~20 realistic queries: 8-10 should trigger, 8-10 should not. Include near-misses, casual language, paths, typos, and buried subtasks.
2. Run each query multiple times if possible and record trigger rate.
3. Revise from train-set failures; pick the best description by validation-set pass rate.

## Output quality evaluation

For important skills, create `evals/evals.json`:

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": "example",
      "prompt": "Realistic user prompt",
      "expected_output": "Human-readable success criteria",
      "files": ["evals/files/input.ext"],
      "assertions": [
        "Specific observable requirement"
      ]
    }
  ]
}
```

Run each eval with the skill and against a baseline (no skill or previous version). Capture outputs, timing/tokens when available, grade assertions with concrete evidence, then iterate from failed assertions, human feedback, and execution transcripts.

## Instruction pattern examples

### Gotchas

Use for concrete facts that defy reasonable assumptions:

```markdown
## Gotchas

- The `users` table uses soft deletes; include `WHERE deleted_at IS NULL`.
- `/health` only checks the web server. Use `/ready` for database readiness.
```

### Checklists

Use when steps have dependencies:

```markdown
Progress:
- [ ] Inspect inputs
- [ ] Create plan
- [ ] Validate plan
- [ ] Execute
- [ ] Verify outputs
```

### Validation loops

Use when outputs can be checked:

```markdown
1. Make the change.
2. Run `scripts/validate.sh`.
3. If it fails, fix the reported issue and rerun.
4. Proceed only when validation passes.
```

### Plan-validate-execute

Use for destructive or batch work. Create an intermediate plan, validate against source-of-truth data, then execute.

### Output templates

Provide exact structure when formatting matters. Keep short templates inline; move long templates to `assets/`.

## Script design extras

Beyond the rules in `SKILL.md`:

- Error messages should state what went wrong and what to try next.
- Keep output size predictable; support `--limit`, `--offset`, or `--output` for large results.

Common runners:

- Python: `uv run scripts/tool.py` with PEP 723 inline dependencies.
- Node: `npx package@version ...` for one-off tools.
- Deno: `deno run --allow-read scripts/tool.ts` with explicit permissions.
- Bun: `bun run scripts/tool.ts` when Bun is known to be available.
