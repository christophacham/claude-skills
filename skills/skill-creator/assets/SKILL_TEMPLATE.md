---
name: <skill-name>
description: <What the skill helps with. Use when the user asks for..., needs to..., or mentions.... Include boundaries if near-misses are common.>
---

# <Skill Title>

Use this skill when <specific user intent/task>. It helps the agent <core capability> by providing <specific knowledge/workflow/tools>.

## Workflow

1. <Inspect/clarify/gather required inputs.>
2. <Create a short plan if the operation is multi-step, destructive, or ambiguous.>
3. <Perform the core operation using the default approach below.>
4. <Validate the result; if validation fails, fix and rerun validation.>
5. <Report results in the requested format, including validation evidence.>

## Defaults

- Use <preferred tool/approach> for <common case> because <reason>.
- If <exception/edge case>, use <fallback> instead.

## Gotchas

- <Concrete, non-obvious fact the agent is likely to get wrong.>
- <Project/domain-specific convention or edge case.>

## Validation

- Run `<validation command>` when <condition>.
- If no automated check exists, verify <specific observable criteria> before finalizing.

## Output format

Use this structure unless the user requests something else:

```markdown
## Summary
<brief outcome>

## Changes / Results
- <item>

## Validation
- <checks run and results>

## Next steps
- <optional follow-ups>
```

## Supporting files

Only load these when needed:

- `references/<file>.md` — Read when <specific condition>.
- `scripts/<script>` — Run when <specific condition>; usage: `<command>`.
- `assets/<template>` — Use when <specific output/template condition>.
