# CLAUDE.md — claude-skills

## Hard no-gos (do not violate)

### Search-related skills — **DO NOT TOUCH**

Do **not** edit, merge, rename, delete, move, “improve,” refactor, unify, re-catalog, or redesign any search-related skill. Do **not** plan or propose changes to them.

**In scope of this ban (active suite):**

- `skills/ddg-search/`
- `skills/brave-search/`
- `skills/tavily-search/`
- any future skill whose job is web/news search or page extract under those IDs
- install/catalog/deps/tests **only insofar as changing them would alter search-skill behavior, layout, IDs, or backends**

**Also off-limits without explicit user override:** inventing a merged `web-search` (or similar) that replaces the three; changing backend selection; rewriting their `SKILL.md`, scripts, or report contracts.

If a task would require touching search skills to “complete” a broader slim/refactor, **stop**, leave search skills unchanged, and do the rest of the work around them. Mention the skip; do not “just this once.”

Other skills, agents, installers (non-search paths), docs, and tests remain fair game unless the user says otherwise.

## Project purpose

Software engineering skills and custom agents for Claude Code (doctrine, craft, tracker, meta), plus a selective installer. See `README.md` and, when present, `SLIM.md` for suite shape — **except** anything that contradicts the search no-go above (search ban wins).
