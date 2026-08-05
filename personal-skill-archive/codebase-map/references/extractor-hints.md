# Extractor hints (optional)

Use only as starting heuristics. Prefer the repo’s real public boundaries.

## Rust

- Files: `**/*.rs` (skip `target/`).
- Surface: `pub fn`, `pub struct`, `pub enum`, `pub trait`, `pub type`,
  `pub const`, `pub static`, `pub use`, `pub mod` (policy choice: include
  `pub(crate)` or not — default **no** unless the map is crate-internal).
- Docs: adjacent `///` lines.
- Multi-line signatures: re-join until `{` or `;`.
- Modules: `crates/*`, workspace members, or `src/{lib,main,bin}`.
- Deps (optional): `use crate::…`, path deps in `Cargo.toml`.
- Tests: `#[test]`, `#[tokio::test]` names.

## TypeScript / SvelteKit

- Files: `**/*.{ts,tsx,js,mjs}` under `src/`; optionally strip `<script>` from
  `.svelte` for exports only.
- Surface: `export function`, `export class`, `export const`, `export type`,
  `export interface`, `export enum`, re-exports.
- Routes (map as inventory, not signatures): `src/routes/**` load/actions.
- Prefer **lib exports + route table** over pretending `.svelte` is an API.
- Deps: `import … from '…'` project-local only.
- Tests: `*.test.ts`, `*.spec.ts`.

## C++ (headers)

- Files: public `*.h` / `*.hpp` (define which trees are public).
- Surface: declaration lines with `(` ending in `;`; skip control keywords,
  `typedef`/`using` noise unless you want type aliases.
- Re-join multi-line export macros until `;`.
- Docs: `//` / `///` immediately above.
- Deps: `#include "…"` project-local.

## C#

- Files: `*.cs` (skip `bin/` `obj/`).
- Surface: lines starting with `public ` (methods, properties, types, fields).
- Skip attribute-only lines when associating docs; keep trailing `{` stripped.
- Docs: `///` XML (strip tags for one-liner).

## Shared emit shape

One markdown bullet per symbol:

```markdown
- `full declaration here` — optional one-line doc
```

Cap declaration and doc length. Sort for stability (file order, then line).

## Density heuristic

Files with many public symbols per LOC are **shallow-module candidates** for
humans — never auto-label as “bad.”
