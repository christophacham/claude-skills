# Layers A–F (full library scout)

Use for **full** mode. Topic mode may map subsets (types≈A/D, flow≈B/C, keys≈config, contracts≈E, local≈F).

| Layer | Name | Primary artifacts | Done bar (honest) |
|-------|------|-------------------|-------------------|
| **A** | Symbol / API catalog | `api-ref/`, `…_11_symbol_catalog_stats.md` | 100% public-surface inventory; decls labeled method (regex/AST/lang tool); host set tagged |
| **B** | Architecture | `20`–`52`, `60`, `70`, diagrams | Module map + critical pipeline E2E with **owners** |
| **C** | Use graph | `…_12_use_graph.md`, `api-ref/usage/` | Every HOST_SURFACE façade depth ≥1 or explicit no-callers; pipeline depth 2–3 samples |
| **D** | Mutation / ownership | `…_13_mutation_model.md`, `api-ref/types/` | Cards for all **core state types** that exist; field writers honest PARTIAL if not fully audited |
| **E** | Behavioral contracts | `…_14_behavioral_contracts.md` | load / config apply / primary pipeline / export (and topic-critical paths) |
| **F** | Local extensions | `…_90_local_extensions.md` | Product-local modules/paths **in this tree only** |

Plus: `…_80_reimpl_blueprint.md` (cites A/C/D/E/F), `…_91_adversary_notes.md`.

## Core state types (mutation cards — adapt to tree)

Create a card when the type **exists** in this codebase. Discover from the tree;
do not invent. Typical categories (rename to match the domain):

- **Domain aggregate roots** and their children (documents, models, graphs, jobs)
- **Primary IR / mesh / AST / buffer** types that pipeline stages mutate
- **Config / preset / settings** objects host and lib both touch
- **Pipeline session** types (run, print, compile, render, query plan)
- **Emit / export** writers and their runtime state
- **Host placement / session** vectors if present
- **Format entry** functions used by hosts (load/save adapters)

### Domain example (CAD/CAM / slicer trees only)

When the tree is a slicer-class codebase, cards often include model hierarchy,
mesh, print config, print object, G-code writer, plates/wipe-tower, format
loaders. Other domains use different names — always derive from **this** tree.

### Mutation card template

```markdown
## Type: <name>
- Header / module:
- Ownership: who allocates / frees
- Created by:
- Read by (major):
- Mutated by (major):
- Serialized by (load/store):
- Threading notes:
- Invariants:
- Related types:
```

## Full pack top-level skeleton

```text
2_<reponame>_<lib>_scout/
  2_<reponame>_00_index.md
  2_<reponame>_11_symbol_catalog_stats.md
  2_<reponame>_12_use_graph.md
  2_<reponame>_13_mutation_model.md
  2_<reponame>_14_behavioral_contracts.md
  2_<reponame>_20_domain_model.md
  2_<reponame>_30_config_system.md
  2_<reponame>_40_pipeline_primary.md
  2_<reponame>_41_pipeline_alt.md      # optional second tech
  2_<reponame>_42_emit_stack.md        # if applicable
  2_<reponame>_50_io_formats.md
  2_<reponame>_51_domain_support.md    # domain-specific OK
  2_<reponame>_52_geometry_or_kernel.md
  2_<reponame>_60_build_and_deps.md
  2_<reponame>_70_host_integration.md
  2_<reponame>_80_reimpl_blueprint.md
  2_<reponame>_90_local_extensions.md
  2_<reponame>_91_adversary_notes.md
  api-ref/
    INDEX.md
    HOST_SURFACE.md
    INTERNAL.md
    _surface_list.txt          # headers, modules, or public packages
    catalog.json               # optional
    by-header/                 # or by-module/ by-crate/
    by-module/
    types/
    usage/                     # single canonical includes/imports machine file
    shards/
    scripts/
  diagrams/
```

## Freeze vs scaffold

| Label | Meaning |
|-------|---------|
| **Scaffold** | Inventory + pipelines + partial cards; good for planning |
| **Freeze-ready** | Host surface deepened; mutation cards for freeze types; one host-include/import truth; contracts for export/load; adversary criticals closed |

Do not mark reimpl milestones complete while adversary criticals on host depth /
mutation / dual stats remain open.

## Extraction order (A)

1. Emit complete surface list (`_surface_list.txt` or language equivalent).
2. Mechanical extract → shards (regex/ctags/clang/rustc/tsc/… as available).
3. Merge → INDEX + stats with **method** and blind spots.
4. Tag host-referenced via includes/imports from outside the lib.
5. Deepen **host set first**, then internal.
6. Split HOST_SURFACE: (a) domain freeze (b) utility/i18n/logging.
