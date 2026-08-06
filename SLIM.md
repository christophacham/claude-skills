# Slim plan — 30-year maintainable core

Branch: `slim/30y-maintainable-core`  
Status: **in progress** (injection → skill-creator merge done; third-party fold may remain).  
Revised after full multi-agent audit + adversarial pass (workflow `skill-suite-slim-audit`).

## Mission (one sentence)

Ship a **small, deep, stable** Claude Code suite: SE judgment libraries, thin operational seams, role agents, **one** selective installer — not a zoo of personal CLIs or chapter-per-skill textbooks.

## Absolute constraint — search skills

**`CLAUDE.md` bans all changes to search-related skills.**  
Do **not** merge, rename, delete, or redesign `ddg-search`, `brave-search`, or `tavily-search`.  
Do **not** invent `web-search`. Leave catalog SEARCH entries, their install deps/keys, and their tests alone unless a change is forced by an unrelated bug and still does not alter search skill IDs or bodies.

All inventory rows below that said “MERGE → web-search” are **void**. Search trio stays three product IDs, untouched.

## Research spine

| Law | Rule | Implication |
|-----|------|-------------|
| **1. Complexity is the budget** | Hard to understand/change = cost (Ousterhout). | Skills, install surfaces, flags, tokens are the product surface. Net surface falls. |
| **2. Deep modules, small interfaces** | Simple interface > simple implementation. | One deep skill per job; backends are seams, not sibling IDs. |
| **3. One job + composition** | Unix (McIlroy/Pike). | Search backends compose under `web-search`; agents compose skills. |
| **4. Stable core, volatile edge** | Microkernel / plugin. | Doctrine + agents + catalog law stay; vendors and niches are edge/archive. |
| **5. Dependency rule** | Depend toward stability. | Doctrine does not depend on Brave/Tavily/ddgs. |
| **6. Rule of two** | No abstraction until second real consumer. | No skill framework / plugin host. |
| **7. Design for deletion** | Unused code is liability; VCS is archive. | Archive niches; delete IDs; no tombstones. |
| **8. Progressive disclosure** | name+desc always; body on trigger; refs on demand. | Ship refs the body loads; evals out of install payload. |
| **9. Boring contracts** | SQLite-style longevity. | Catalog groups + agent tool contracts are the durable API. |
| **10. Less accidental, keep essential** | Brooks. | Merge three search IDs (accidental); keep simple ≠ architecture ≠ distributed (essential). |

### Anti-goals

- Microkernel cosplay, mega-skill dumps, frozen-prose test theater.
- Restoring personal archive (Orca, mmx, ccc, gates) into managed suite.
- Dual full installers forever; “install everything” defaults.
- OPT-IN as a polite name for never-cutting niche skills.

## Catalog law (write once in `lib/catalog.js`)

| Group | IDs | Install default |
|-------|-----|-----------------|
| **SEARCH** | `ddg-search`, `brave-search`, `tavily-search` | multiselect as today; **do not change skill bodies/IDs** |
| **CORE** | `peek-repo`, `simple-design`, `refactoring`, `testing-tdd` | yes |
| **AUTHOR** | `skill-creator` | project/author path |
| **PROFILE · BEADS** | `beads` (+ agents + `pool.md`) | only when beads chosen |
| **OPT_IN** | `architecture-design`, `distributed-architecture`, `geometric-robustness` | no — offer, never default-yes |
| **Archive** | never catalog | VCS / `personal-skill-archive/` |

Newcomer placement: rare domain → archive or external project skill; agent-pulling package → PROFILE. **Never** merge or replace SEARCH IDs.

## Final target inventory

| Item | Decision | Rationale |
|------|----------|-----------|
| `ddg-search` | **NOGO — leave untouched** | `CLAUDE.md` hard ban |
| `brave-search` | **NOGO — leave untouched** | same |
| `tavily-search` | **NOGO — leave untouched** | same |
| `web-search` (proposed merge) | **CANCELLED** | Conflicts with search no-go |
| `third-party-integration` | **MERGE → `testing-tdd`** (≤~40-line body § + thin ref) | GOOS vendor-boundary is test design |
| `dynamic-context-injection` | **MERGE → `skill-creator`** (Audit H2 **in body** + thin ref) | Same audience; safety entry-visible |
| `peek-repo` | **KEEP · CORE** | Unique clone-hardening contract |
| `simple-design` | **KEEP · CORE** | Kernel doctrine; agent preload |
| `refactoring` | **KEEP · CORE** | Edit mechanics; panelist lens |
| `testing-tdd` | **KEEP · CORE** | Absorbs third-party thinly |
| `architecture-design` | **KEEP · OPT_IN** | Episodic layering / ports — not lean default |
| `distributed-architecture` | **KEEP · OPT_IN** | Multi-deployable; never content-merge with above |
| `skill-creator` | **KEEP · AUTHOR** | Absorbs injection; eject repo-only installer essay → `docs/` |
| `beads` | **KEEP · BEADS profile only** | Tracker package; never CORE |
| `mission-planning` | **DELETE** | Removed from suite; stale cleanup on install |
| `reimpl-scout` | **DELETE** | Removed from suite; stale cleanup on install |
| `geometric-robustness` | **KEEP** | Domain skill retained |
| `find-docs` + personal archive | **ARCHIVE stay** | Do not restore; do not edit search skills to fix citations — if search descriptions mention find-docs, **leave them** (search no-go) |
| Agents `coder`, `reviewer` | **KEEP** | Permanent roles; preloads: simple-design + refactoring + testing-tdd only |
| `beads-creator`, `beads-reviewer` | **KEEP · BEADS-only** | Install only with beads |
| `panelists/*` ×3 | **KEEP** | Lenses stay separate |
| `pool.md` | **KEEP advisory** | Prefer exclude from npm `files` if trivial |
| Install product | **Prefer Node CLI**; bulk shell may remain if deleting them risks search install paths — **do not break search install** |
| Evals | **git / `dev/` only** where easy without touching search | Never npm install surface for non-search |
| Skill-linked `references/` | **SHIP with skill** | Progressive disclosure intact |

**After mission/reimpl delete + injection merge:** 13 skill IDs (was 16). Search trio untouched. `geometric-robustness` kept. `dynamic-context-injection` folded into `skill-creator`. Further planned merge: third-party → testing-tdd.

## Merge specs

### A. Search trio — **OUT OF SCOPE**

No merge spec. No `web-search`. Do not open these directories for edit.

### B. `testing-tdd` ← third-party

- Short body section (≤~40 lines) + optional thin `references/third-party-adapters.md`.
- Do **not** paste the old skill wholesale.
- Triggers: mock external libs, wrap vendor APIs, “should I mock this library?”
- Delete `skills/third-party-integration/`.

### C. `skill-creator` ← injection

- **Audit mode H2 in body** (safety contract entry-visible) + thin ref for examples/renderer.
- Description triggers: audit injections / load-time shell.
- Move repo-specific Node installer pattern → `docs/node-native-installer-pattern.md` (not skill payload).
- Delete standalone skill dir.

### D. Delete niches (executed for mission/reimpl)

- **Delete** `mission-planning` and `reimpl-scout` from the managed suite (skill dirs, catalog, README, tests).
- Add both to install stale cleanup so prior installs drop them on next run.
- **Keep** `geometric-robustness` as a product skill.

## Doctrine spine

1. SE judgment + role agents — not personal CLI zoo.  
2. Deep modules / small surfaces for the suite itself.  
3. Layers: doctrine ≠ operational ≠ agents ≠ install ≠ archive.  
4. One job → one skill ID; backends are seams.  
5. Cross-route, don’t restate; protect preload budgets.  
6. Agents constrain tools/output; skills hold reusable judgment.  
7. Ceremony follows irreversibility.  
8. Ship only what runs or is load-on-demand from the skill.  
9. Portable doctrine harness-agnostic; Claude-only mechanisms isolated in meta/operational skills.  
10. Design for deletion; catalog is truth.

## Further improvements (beyond original ask)

- Delete mission-planning + reimpl-scout (done); keep geometric-robustness.  
- CORE = non-search lean set; demote architecture-design from default-yes.  
- Ship rule: install any ref SKILL.md tells the model to Read (non-search).  
- Body budgets on absorb (no wholesale paste).  
- One catalog law in code for non-search groups; **SEARCH group frozen**.  
- Prefer invariant tests over frozen doctrine phrases.  
- Optional later only: collapse panelists → one `design-panel`; drop pool from package.  
- Installer simplification only if search install paths stay behavior-identical.

## Risks accepted

- Folding third-party/injection may pressure re-split if body budgets ignored.  
- Archiving niches loses default discoverability (VCS preserves content).  
- Two architecture IDs remain (trigger precision over mega-chapter).  
- Panelist trio roster tax deferred.  
- Users of bulk shell installers must switch to Node CLI (document once).

## Sources

- [Unix philosophy](https://en.wikipedia.org/wiki/Unix_philosophy)  
- [Ousterhout deep modules](https://www.janmeppe.com/blog/a-philosophy-of-software-design-john-ousterhout)  
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)  
- [SQLite longevity](https://sqlite.org/about.html)  
- [Microkernel monolith](https://software-architecture-guild.com/guide/architecture/styles/microkernel-monolith/)  
- Suite audit workflow + tavily/ddg/brave/WebSearch research  

---

## THE PROMPT

Copy the block below into an implementing agent session on branch `slim/30y-maintainable-core`.

```text
# Execute: Slim claude-skills to durable 30-year shape

## Mission
Transform `/home/snowman/source/claude-skills` into a small durable suite: SE judgment libraries, thin operational seams, role agents, clearer install groups. Prefer less surface. You may delete/merge/archive **non-search** skill IDs and rewrite non-search catalog/install UX. Preserve kept capabilities; removals only as specified.

Branch: slim/30y-maintainable-core. Read CLAUDE.md and SLIM.md. **CLAUDE.md search no-go wins over everything.**

## HARD NO-GO — search skills
DO NOT touch, open for edit, merge, rename, delete, move, or redesign:
- skills/ddg-search/
- skills/brave-search/
- skills/tavily-search/
Do NOT create web-search. Do NOT change their SKILL.md, scripts, report contracts, IDs, or backend behavior.
Do NOT “fix find-docs citations” inside search skills.
If a step would require editing search skills, skip that step and continue.

## Success criteria
1. Search trio still present and **byte-stable** (or only untouched): ddg-search, brave-search, tavily-search.
2. Product skill IDs: no `mission-planning`, `reimpl-scout`; `geometric-robustness` remains. Further slim may still drop `third-party-integration` / `dynamic-context-injection` via merge.
3. Agents set unchanged; coder/reviewer preloads: simple-design + refactoring + testing-tdd only.
4. Catalog groups: SEARCH (frozen list) + CORE + AUTHOR + BEADS + OPT_IN as in SLIM.md.
5. third-party folded thinly into testing-tdd; injection audit in skill-creator body + thin ref.
6. Three niches archived under personal-skill-archive; never catalog.
7. Tests green. Search-related tests remain green without rewriting search skill bodies.
8. README matches reality for non-search changes; search section can stay as-is.
9. PR evidence: before/after counts, archived paths, proof search dirs unchanged (e.g. git diff --stat on those paths empty).

## Non-goals
- Any search skill work (including “improvements”).
- Restoring archive into product.
- Content-merging the design stack.
- Expanding agent preloads.
- Drive-by renames.

## MERGE (non-search only)
1. third-party-integration → testing-tdd (≤~40-line body § + optional thin ref). Delete old dir.
2. dynamic-context-injection → skill-creator (Audit H2 in body + thin ref). Delete old dir.

## DELETE
- mission-planning, reimpl-scout (skill dirs + catalog + README + tests + install stale list)

## KEEP
- geometric-robustness

## KEEP
- SEARCH: ddg-search, brave-search, tavily-search (untouched)
- CORE: peek-repo, simple-design, refactoring, testing-tdd
- AUTHOR: skill-creator
- BEADS profile: beads (+ agents + pool when chosen)
- OPT_IN: architecture-design, distributed-architecture, geometric-robustness
- Agents: full current set

## Implementation order
1. Read CLAUDE.md, SLIM.md, catalog, tests.
2. Delete mission-planning + reimpl-scout (done); keep geometric-robustness; fold third-party; fold injection.
3. Update catalog groups for non-search only; leave SEARCH_SKILLS entries as the three existing IDs.
4. README for non-search inventory; do not rewrite search skill docs.
5. Fix tests for removed/merged non-search IDs; do not weaken search coverage.
6. Verify `git diff -- skills/ddg-search skills/brave-search skills/tavily-search` is empty.
7. Full suite green; report with evidence.

## Forbidden
- Touching search skills in any way.
- New web-search skill.
- Restoring personal archive into catalog.
- Empty stub dirs for deleted non-search IDs.
- Ceremony and drive-by refactors.

## Done definition
Leaner non-search suite; search trio frozen; mission-planning + reimpl-scout deleted; geometric-robustness kept; thin folds done; tests green; CLAUDE.md no-go honored.

Begin. Prefer working code over discussion. Do not push unless asked.
```
