# Mechanical codebase map — design contract

Language-agnostic. Implementers adapt extractors; do not weaken these properties.

## Product

Two (or few) **generated** pages under a stable docs path:

1. **Module / surface index** — modules (path + role), per-file LOC, public
   surface bullets (declaration text + optional one-line doc), optional
   project-local dependency edges, optional test inventory.
2. **Hot spots** — largest files, high surface density, churn; plus a
   **curated** reviewer/notes section that survives regen.

All other architecture prose stays hand-written and is never overwritten.

## Determinism

Output is a pure function of:

- the product/test trees you declared as inputs, and
- optionally git history **touching those trees** (churn).

Forbidden in generated body:

- wall-clock timestamps
- HEAD commit SHAs
- unstable locale/sort
- CRLF/LF mix (pick LF and stick to it)

Docs-only commits should not move churn tables if the window is anchored to
the last commit that touched map inputs.

## Curated pocket

Exactly one splice region in the hot-spots (or index) page:

```text
<!-- gen-map:curated-begin -->
...human or orchestrator notes...
<!-- gen-map:curated-end -->
```

On regen:

- Read markers from the **canonical committed path**, even when writing to a
  temp directory for drift compare.
- If markers are missing, write an empty placeholder block so the next human
  has a home.

## Surface extraction

Mechanical is fine. State that on the page.

| Goal | Guidance |
|------|----------|
| Useful | Prefer full declaration lines over bare names |
| Honest | Single-line + simple re-join; skip macros/codegen lies |
| Bounded | Truncate very long decls/docs; stable ordering |
| Public | Define “public” per language; do not invent visibility |

Types: include when the surface rule naturally emits them (exported types,
public structs). Do not require a full type graph.

## Map-drift

1. Regen to a temp dir (or compare buffer).
2. Hash or byte-compare each generated page to the committed copy.
3. Nonzero exit on any drift.
4. Print the exact regen command for this platform.

Skip policy (optional, local only):

- If neither staged nor `base...HEAD` touches map inputs, skip is allowed.
- CI should force full drift (env flag or always-on).

Drift is a **gate**, not a silent rewrite.

## Pipeline shape

```text
tree + history  →  gen-map  →  committed pages
                         ↘
                     temp regen → compare → pass/fail
```

Hooks may call a **MapDriftOnly** mode; full quality gate still owns truth.

## What this is not

- Not a language server
- Not a substitute for curated architecture docs
- Not an auto-commit bot (humans/agents commit regen with the change)
- Not multi-language completeness theater — map the languages you ship
