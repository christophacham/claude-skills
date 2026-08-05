---
name: codebase-map
description: >
  Install or revive a mechanical codebase map in the current repo — generated
  module/surface index + hot spots, deterministic regen, map-drift in the
  quality gate, optional cheap pre-commit check. Use when the user asks to
  create a repo map, gen-map, map-drift gate, codebase index, public-API
  surface dump, or hot-spots page; or to port that pattern to a new stack
  (Rust, TypeScript/SvelteKit, C++/C#, etc.). Not for ad-hoc architecture
  writeups, one-off docs edits, or full language-server / type-graph tooling.
argument-hint: "[target-dir-or-stack-hint]"
arguments: [target]
shell: bash
---

# codebase-map — ship a usable map

You are installing a **product the team can run**, not writing a design essay.
End state: one regen command, committed generated pages, and a gate that fails
when those pages drift from the tree.

**Core idea:** a pure function of the product tree (+ limited history) writes a
small set of docs; humans curate only a marked pocket; CI/local gate regen+hash
compares and fails closed. Language extractors are adapters; the pipeline is not.

If the repo already has this shape (a root-level regen like `gen-map` plus
drift in the quality gate), **revive/extend** it — do not invent a parallel map.

## State at load (injected — read it; do not re-run for discovery)

### Tree + existing map tooling
```!
git rev-parse --show-toplevel 2>/dev/null || echo "(not a git repo)"
git status --short --branch 2>/dev/null | head -40
echo "--- map scripts (repo) ---"
if [ -d scripts ]; then ls -1 scripts | grep -E 'gen-map|map|gate' || echo "(no map/gate-ish names under scripts/)"; else echo "(no scripts/ dir)"; fi
echo "--- map docs ---"
find docs -maxdepth 4 \( -name 'module-index.md' -o -name 'hot-spots.md' -o -name 'gen-map*' \) 2>/dev/null | head -20 || echo "(no docs map hits)"
echo "--- hooks / gates (names only) ---"
ls -1 lefthook.yml .pre-commit-config.yaml 2>/dev/null || echo "(no lefthook/pre-commit config at root)"
if [ -d scripts ]; then ls -1 scripts | grep -E 'fast-gate|gate' || true; fi
```

### Stack signals (what lives here)
```!
echo "--- roots ---"
ls -1 | head -60
echo "--- language markers ---"
for f in Cargo.toml package.json pnpm-workspace.yaml go.mod pyproject.toml CMakeLists.txt *.sln Directory.Build.props build.zig flake.nix; do
  [ -e "$f" ] && echo "present: $f"
done 2>/dev/null
echo "--- CLAUDE map/gate lines (if any) ---"
if [ -f CLAUDE.md ]; then
  grep -nE 'gen-map|map-drift|hot-spot|module-index|fast-gate|lefthook|quality gate' CLAUDE.md 2>/dev/null | head -40 || echo "(no map/gate keywords in CLAUDE.md)"
else
  echo "(no CLAUDE.md)"
fi
```

### Optional target arg
!`if [ -n "$target" ]; then printf 'target arg: %s\n' "$target"; else echo "(no target arg — map the whole repo product surface)"; fi`

Load-time data is a snapshot. Re-check with tools only after you change files
or when a path was missing from the injection.

## What you must create (the usable thing)

Minimum shippable set:

| Piece | Role |
|-------|------|
| **Regen entrypoint** | One command from repo root (script twin per OS only if the repo already dual-scripts). Pure: same tree → same bytes. |
| **Generated pages** | At least: module/surface index + hot spots (LOC / churn / density). Small number of files under a stable docs path. |
| **Curated pocket** | One marked region that regen never overwrites (begin/end markers). Empty placeholder OK. |
| **Map-drift check** | Gate step or script: regen to temp → compare hashes/content to committed pages → nonzero on drift + print how to fix. |
| **How-to** | Short note in README, CLAUDE.md, or docs: when to regen, what not to hand-edit. |

Optional (add when the repo already has hooks/gates):

- Cheap pre-commit map-drift that **skips** when map inputs did not change.
- Pathspec for “map inputs” (usually product + test trees, not docs-only).

Do **not** require: language servers, full type graphs, auto-commit of the map,
or rewriting the whole docs site.

## Workflow

1. **Discover** — From injection: stack, existing map regen/gate/hooks, doc home.
   Read CLAUDE.md / gate docs only as needed. Prefer extending an existing
   repo map generator and gate steps over greenfield.

2. **Choose the map product for THIS repo** (write it down before coding):
   - **Inputs:** which trees count (e.g. `src/`, `crates/`, `apps/`, `tests/`).
   - **Modules:** stable reading-order groups (paths + one-line roles).
   - **Surface rule:** what “public” means here (`pub`, `export`, `public`,
     header decls, routes, etc.). Keep it mechanical and approximate.
   - **Output paths:** where generated pages live; what stays curated prose.
   - **Gate hook:** where drift runs (existing fast-gate / CI job / new script).

3. **Implement regen** — Single writer of generated pages.
   - Deterministic: no wall-clock, no HEAD sha in body; stable sort; LF.
   - Churn windows should not drift on docs-only commits when possible.
   - Extractors may be dumb (line/regex/AST-lite). State that on the page.
   - Preserve curated markers by splicing from the **canonical** committed file
     even when writing to a temp output dir (so drift compare works).

4. **Implement drift** — Fail closed. Remediation message names the regen
   command for this OS. Local skip when inputs unchanged is OK; CI should
   always run full drift when a CI env flag is set or always-on is cheaper.

5. **Generate once** — Run regen, put pages on the tree, run drift, fix until
   green. Wire into the real gate if one exists.

6. **Document lightly** — How to regen; “do not hand-edit generated pages”;
   where curated notes go. Match repo tone (CLAUDE.md quality-gates blurb if
   that file is the convention home).

7. **Stop** — Deliver a runnable map. No bonus multi-language frameworks
   unless asked.

## Defaults

- **One stack, one extractor mode** for the dominant languages in-tree.
- **Signatures over names** when cheap (full decl line + short doc if adjacent).
- **Types only if they fall out of the surface rule** (e.g. `export type`,
  `pub struct`, C# `public struct`) — do not build a second type system.
- **Hot spots** = largest files + high public-symbol density + churn; density
  is a *candidate* shallow-module signal, not a verdict.
- **Scripts over skills** for regen/drift — agents and humans share one CLI.
- If the repo is dual Windows/Unix gates already, follow that twin pattern;
  otherwise one portable script is enough.

## Gotchas

- Hand-edited generated pages will fight the next regen — always mark them
  generated and enforce drift.
- Curated content must live **between markers** (or outside generated files).
- Map-drift that always rewrites in place without compare is not a gate.
- User-level assumptions: this skill runs in many repos — never hardcode one
  product’s module table; derive modules from **this** tree.
- Injection is read-only discovery. Creating files, committing, and editing
  gates are normal tool calls after you decide.
- Keep extractors honest: multi-line decls, macros, and generated code will be
  wrong; the page should say “mechanical approximation.”

## Validation (must pass before you claim done)

- [ ] Regen from root succeeds twice with **byte-identical** output.
- [ ] Intentional edit to a generated page makes drift **fail**; regen restores green.
- [ ] Curated marker block survives regen unchanged.
- [ ] Docs state the regen command and “do not hand-edit.”
- [ ] If a quality gate exists, drift is on its critical path (or pre-commit
      cheap path + full path in CI — match repo policy).

## Output format

```markdown
## Map product
- inputs / modules / surface rule / output paths / gate hook

## What landed
- scripts, docs, gate/hook wiring

## How to use
- regen command
- when to run (touch list)

## Validation
- double-regen identical: yes/no
- drift fail-closed proof: yes/no
- curated preserved: yes/no
```

## Supporting files

Load only when needed:

- `references/design-contract.md` — abstract contract (determinism, markers,
  drift, surface rules) when designing or reviewing a map implementation.
- `references/extractor-hints.md` — light per-ecosystem surface heuristics
  (Rust / TS-Svelte / C++ / C#) when choosing what to scrape — not mandatory.
