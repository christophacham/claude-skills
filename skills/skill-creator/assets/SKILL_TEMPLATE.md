---
name: <skill-name>
description: <What this skill does. Use when the request involves specific intents/tasks. Not for the nearest keyword-sharing case.>
---

# <Skill title>

<State the task-specific contract or goal in one short paragraph. Remove every
placeholder section that the skill does not need.>

## Decision rules

- <Non-obvious default, with the condition that makes it apply.>
- <Real exception and fallback, only if one exists.>

## Workflow

1. <First dependency-sensitive or fragile step.>
2. <Core operation.>
3. <Concrete validation and what to do on failure.>

## Gotchas

- <Specific fact a capable agent would reasonably get wrong.>

## Output

<Include an exact output shape only when the format is contractual. Otherwise
state the few facts/evidence the final response must contain.>

## Supporting files

- `references/<file>.md` — Read when <condition>.
- `scripts/<script>` — Run when <condition>; usage: `<command>`.
- `assets/<file>` — Use when <condition>.

<!--
Validate explicitly for the intended target:
  python3 scripts/validate_skill.py <skill-dir> --mode portable --format text
  python3 scripts/validate_skill.py <skill-dir> --mode claude-code --format text

Portable frontmatter uses only name, description, license, compatibility,
metadata, and allowed-tools. Read references/claude-code-skills.md before adding
Claude Code-only fields or dynamic injection.
-->
