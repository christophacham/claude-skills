# Agent Skills specification and eval workflows

Load this for frontmatter profile details, scoping, trigger evaluation, or output
eval design. The creation workflow is in `SKILL.md`; current Claude Code
extensions are in `claude-code-skills.md`.

## Validation profiles

### Portable

Portable package/upload frontmatter permits exactly:

| Field | Type | Rule |
|---|---|---|
| `name` | string | required; 1–64 lowercase letters/numbers/single hyphens; match directory for broad compatibility |
| `description` | string | required; 1–1024 characters; what + when |
| `license` | string | optional, non-empty |
| `compatibility` | string | optional, non-empty, max 500 characters |
| `metadata` | mapping | optional free-form data map |
| `allowed-tools` | string | optional portable tool grant syntax |

Portable validation rejects Claude Code extension fields rather than assuming an
upload client will ignore them.

### Claude Code

Claude Code accepts all portable fields plus `when_to_use`, `argument-hint`,
`arguments`, `disable-model-invocation`, `user-invocable`, `disallowed-tools`,
`model`, `effort`, `context`, `agent`, `background`, `hooks`, `paths`, and
`shell`. It permits string/YAML-list forms for arguments, tool lists, and paths;
booleans accept true/false, yes/no, on/off, and 1/0.

Field combinations matter:

- `context` currently supports `fork`.
- `agent` and `background` only apply with `context: fork`.
- `effort` is low/medium/high/xhigh/max.
- `hooks` and `metadata` are mappings.
- `shell` is bash/powershell.

Claude Code can derive a name/description when omitted. This repository still
keeps explicit portable identities so the same skill can be cataloged and
validated consistently.

## Conservative YAML

`scripts/validate_skill.py` parses a typed data-only subset sufficient for this
repository: mappings, sequences, quoted/plain scalars, booleans/numbers,
flow collections, and literal/folded block strings. It rejects duplicate keys,
tabs for indentation, anchors, aliases, tags, merge keys, directives, and
ambiguous unsupported syntax. Quote a scalar containing YAML-significant text
instead of relying on parser-specific coercion.

## Skill scope

One skill should own one coherent judgment/workflow. Combine steps that normally
activate together and share expertise. Split when activation, authority,
permissions, or support material differs. A directory full of generic reminders
is not expertise; a script with no judgment may be better exposed directly.

Ground skills in actual corrections, runbooks, schemas, source code, API docs,
review findings, or repeated failure transcripts. State the current contract,
not the history of how it was discovered.

## Trigger evaluation

Build realistic train and validation sets. Include:

- direct and indirect should-trigger requests;
- buried subtasks and file paths;
- casual wording and typos;
- near misses sharing domain keywords; and
- requests that belong to the adjacent skill named in the boundary.

Revise the description from train failures and select using held-out validation
results. Do not append every missed phrase; generalize the intent category.
`assets/TRIGGER_EVAL_QUERIES_TEMPLATE.json` is a compact input shape for this
work, separate from output evals.

## Output eval schema

The repository output-eval file is `<skill>/evals/evals.json` and follows the
official skill-creator plugin schema:

```json
{
  "skill_name": "my-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic user prompt",
      "expected_output": "Human-readable successful outcome",
      "files": [],
      "expectations": [
        "Observable requirement with concrete pass/fail evidence"
      ]
    }
  ]
}
```

Rules enforced by the validator:

- root is an object; `skill_name` equals frontmatter `name`;
- `evals` is non-empty and positive integer IDs are unique;
- `prompt` and `expected_output` are non-empty strings;
- `expectations` is a non-empty string array; and
- `files` is a string array of existing paths confined within the skill root
  (use `[]` when no fixture is needed).

Expectations should grade outputs/actions, not hidden reasoning. Prefer mechanical
evidence (command exit, schema, required section, named invariant) and use human
judgment only for criteria that are genuinely qualitative. Run each eval with
the skill and a baseline/previous version; preserve raw output and expectation
evidence so a change can be attributed.

## Useful instruction patterns

Use exact ordered steps for fragile operations, not for ordinary judgment.
Include a validation loop when a concrete checker exists. Put long reference
material off the activation path. Give one default with a reason and one escape
hatch only when a real exception exists. Include an output template only when
format is contractual.

Concrete gotchas beat generic advice:

```markdown
## Gotchas

- The `users` table uses soft deletes; active-user queries include
  `WHERE deleted_at IS NULL`.
- `/health` checks only the process. Deployment readiness uses `/ready`.
```

A script should state what it reads/writes, accept non-interactive inputs, bound
large output, and return meaningful status. Dynamic context injection has a
stricter contract because it runs before model judgment; use the dedicated skill
and Claude Code validator mode to audit it.
