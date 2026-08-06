# Naming and pack conventions

## Series ladder (research docs)

| Series | Kind | Example pattern |
|--------|------|-----------------|
| `1_*` | Prompt or one-shot map that starts a line of work | `1_prompt_<lib>_…` |
| `2_<reponame>_…` | **Outputs** of a full-library scout | `2_<reponame>_<lib>_scout/` |
| `3_prompt_NN_<slug>_…` | **Topic scout prompts** (runnable) | `3_prompt_07_<slug>_scout.md` |
| `4_<reponame>_<slug>_…` | **Outputs** of a topic scout | `4_<reponame>_<slug>_scout/` |

Rules:

- `reponame` from **this** checkout only (folder or remote basename → kebab-case).
- Never hardcode a product folder name in a portable prompt; always `4_<reponame>_`.
- Top-level markdown inside a pack **must** carry the pack prefix. Nested `api-ref/`, `shards/`, `diagrams/` need not repeat the prefix on every file.
- Refuse unprefixed top-level scout docs.

## Output root

Prefer (if user already uses it):

```text
../<research-repo>/docs/
```

Fallback:

```text
docs/
```

State the chosen root in `00_index`.

## Topic pack skeleton

```text
4_<reponame>_<slug>_scout/
  4_<reponame>_<slug>_00_index.md
  4_<reponame>_<slug>_10_map.md
  4_<reponame>_<slug>_20_types_api.md
  4_<reponame>_<slug>_30_config_keys.md
  4_<reponame>_<slug>_40_runtime_flow.md
  4_<reponame>_<slug>_50_mutation_persistence.md
  4_<reponame>_<slug>_60_contracts.md
  4_<reponame>_<slug>_80_reimpl_notes.md
  4_<reponame>_<slug>_90_local_extensions.md
  4_<reponame>_<slug>_91_adversary_notes.md
  shards/
  diagrams/
```

Every topic index should include: public API/types, option tables, state machine
or steps, emit/pipeline order, invalidation edges if any, contracts, OUT OF
SCOPE, local-extensions, test seeds if any.

## Prompt series (`3_prompt_*`)

When designing a series:

1. Evidence-check topics in **this** tree (or the tree where the series will run).
2. Cap ~12–20 prompts; merge small topics.
3. Soft `depends_on` only — each prompt alone-runnable from seeds.
4. Ship `3_prompt_00_series_index.md` + optional `3_prompt_shared_boilerplate.md`.
5. Prompt body isolation: no foreign product names; seeds as repo-relative paths.
6. Output pattern inside each prompt: `4_<reponame>_<slug>_scout/`.

### Minimal prompt body sections

- Mission
- Isolation & naming
- Seed paths / symbols
- Must cover
- Deterministic extraction units and independent review role
- Deliverables
- Quality bar / adversary
- Final user message checklist

## Analytical-isolation checklist (prompt + pack)

- [ ] No other product names in findings
- [ ] “this codebase” wording
- [ ] No “see other repo”
- [ ] Compare packs only via a dedicated later compare doc, not inside scout
- [ ] Pack remains labeled `SOURCE_INFORMED`; isolation is not represented as
      clean-room source/implementation separation or provenance

## Dual-repo experiment

1. Same prompt text in repo A and repo B separately.
2. Each writes `2_<reponame>_…` or `4_<reponame>_…`.
3. Optional third session: `COMPARE.md` from the two packs only.
4. Treat separation as experimental control against cross-contamination, not as
   proof of clean-room implementation.
