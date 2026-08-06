---
name: reimpl-scout
description: >-
  Produce source-informed compatibility research packs for reimplementation:
  full library API catalogs (A–F layers), topic scouts, isolated dual-repo runs,
  mutation/use/contract maps, prompt series, and adversarial audits. Use when the
  user asks to map a library for reimplementation, catalog its public surface and
  behavior, write scout prompts, audit an existing pack, or resume a partial
  freeze. Call work clean-room only when actual source/implementation separation
  and provenance records exist. Not for ordinary implementation, one-off fixes,
  or casual source questions without a pack deliverable (use peek-repo).
compatibility: Claude Code; uses invocation arguments and static load-time shell injection.
argument-hint: "[full|topic|audit|prompt-series] [scope-or-slug]"
arguments: [mode, scope]
shell: bash
---

# Reimpl scout

**Orchestrator skill** (do **not** fork). Produce evidence-bearing
**documentation packs** a team can use to reimplement a subsystem — not tourist
READMEs and not production code ports. Source access makes the result
**source-informed compatibility research**. Do not label it clean-room merely
because agents, sessions, repositories, or output folders are isolated.

If the tree is not local yet, use **peek-repo** first, then scout the clone. Use
subagents only when the measured scope benefits from partitioning; the
orchestrator owns the scope manifest, merge, evidence judgment, and adversary.

## Live state (injected — do not re-run these checks)

Resolve mode and scope from the invocation arguments / user message. Never
interpolate user input into load-time shell commands; injections below are
static repository state only.

### Repo identity
```!
cwd=$(pwd)
echo "cwd=$cwd"
echo "folder=$(basename "$cwd")"
if command -v git >/dev/null 2>&1; then
  inside=$(git rev-parse --is-inside-work-tree 2>/dev/null) || inside=''
  if [ "$inside" = "true" ]; then
    echo "git=yes"
    sha=$(git rev-parse --short HEAD 2>/dev/null) || sha=''
    root=$(git rev-parse --show-toplevel 2>/dev/null) || root=''
    remote=$(git remote get-url origin 2>/dev/null) || remote=''
    [ -n "$sha" ] && echo "sha=$sha"
    [ -n "$root" ] && echo "git_root=$root"
    [ -n "$remote" ] && echo "origin=$remote"
  else
    echo "git=no"
  fi
else
  echo "git=(git not on PATH)"
fi
```

### Existing scout packs (docs/)
```!
docs="$(pwd)/docs"
if [ ! -d "$docs" ]; then
  echo "packs=none (no docs/ under cwd)"
  exit 0
fi
pack_dirs=$(find "$docs" -maxdepth 1 -mindepth 1 -type d \( -name '2_*' -o -name '4_*' \) 2>/dev/null | sed 's|.*/||' | sort)
pack_files=$(find "$docs" -maxdepth 1 -mindepth 1 -type f \( -name '1_*' -o -name '3_*' \) 2>/dev/null | sed 's|.*/||' | sort)
if [ -z "$pack_dirs" ] && [ -z "$pack_files" ]; then
  echo "packs=none under docs/ (no 1_/2_/3_/4_ scout artifacts)"
else
  if [ -n "$pack_dirs" ]; then
    echo "pack_dirs="
    echo "$pack_dirs"
  fi
  if [ -n "$pack_files" ]; then
    echo "pack_files="
    echo "$pack_files"
  fi
fi
```

## Modes (pick one)

| Mode | When | Default output |
|------|------|----------------|
| **full** | Whole core lib | `2_<reponame>_<lib>_scout/` |
| **topic** | One domain | `4_<reponame>_<slug>_scout/` |
| **prompt-series** | Design many topic prompts | `3_prompt_NN_<slug>_scout.md` + index |
| **audit** | Judge an existing pack | Update scorecard + `91_adversary_notes` |

Defaults: **full** when a library root is named; **topic** when a slug/domain is
named; **audit** when a pack path is named.

## Research classification and clean-room boundary

Write one classification in the pack index:

- `SOURCE_INFORMED`: default whenever scouts or pack authors can read the source.
- `CLEAN_ROOM_HANDOFF_CANDIDATE`: only when the user provides a documented
  separation process: identified source-reading researchers, implementers denied
  source access, provenance for every handoff artifact, applicable license/legal
  constraints, and an auditable transfer boundary. The pack is still a
  source-side specification, not proof that implementation stayed clean-room.

Repository, session, prompt, or agent isolation alone is not clean-room
provenance. Never make legal conclusions; record supplied controls and gaps.

## Non-negotiables

1. **This codebase only** — never name/compare other products inside pack findings or prompt bodies. Phrase as “this codebase / this tree.”
2. **Scope before staffing** — derive deterministic extraction units from the tree; never choose agent counts or quotas first.
3. **Code over folklore** — claims need `path` + symbol (line band when stable).
4. **No production edits** in the product tree. Scripts only under the **pack** dir.
5. **Never invent symbols** — use `NOT_FOUND` / `PARTIAL`, exact found/expected counts, and named missing units.
6. **Independent judgment** — extraction output is not self-certifying; a separate reviewer pass checks evidence and conclusions.
7. **Honest scorecards** — “DONE wave” and percentages are not freeze evidence. Use evidence states, counts, methods, and gaps.
8. **Naming** — see [references/naming-and-packs.md](references/naming-and-packs.md).

## Workflow

### 0. Detect (use injected state; fill gaps only)

- `reponame` = kebab-case of repo root folder (or git remote basename from injection).
- Library root, host roots (CLI/GUI/service), git short SHA (injected when available).
- Research out dir: prefer an existing research sibling the user already uses; else `docs/` under this tree. State choice in index.
- Resume: if injection lists matching `2_*` / `4_*` packs, prefer audit/resume over starting a second unprefixed pack.
- Record research classification and any claimed clean-room controls before work starts.

### 1. Build the deterministic scope manifest

1. Enumerate in-scope files/modules with a sorted, reproducible command or
   language-aware indexer. Save the command, tool version, root, exclusions,
   git identity, and manifest count.
2. Derive extraction units from that manifest: public modules/headers/packages,
   host roots, pipeline entry points, core state types, and contract paths.
3. Give every unit a stable ID, path set, method, expected artifact, and terminal
   state (`COMPLETE`, `PARTIAL`, `NOT_FOUND`, `BLOCKED`). Small scopes may be one
   unit; large scopes may be partitioned by non-overlapping path or A–F layer.
4. Add subagents with available task/subagent orchestration only when units can
   run independently. Agent count follows units and workload; no fixed minimum.

Mode order remains:

- **full:** A inventory → A declarations/host → C use + D mutate + E contracts → B architecture → F local + reimplementation blueprint → adversary.
- **topic:** map → types/API → config keys → runtime flow → mutation/persistence → contracts → reimplementation notes → adversary.

### 2. Extract, interpret, and reconcile

- Run deterministic extraction first (language indexer/compiler docs preferred;
  otherwise ctags or labeled scripts/regex). Save commands, zero-match units,
  parse failures, and exact manifest reconciliation.
- Scouts structure and cite the extracted evidence. Interpretive source reading
  may deepen it but must not silently replace or expand the scope manifest.
- Merge by stable unit ID; duplicate or missing ownership is a reconciliation
  failure, not a reason to average a score.
- Pack templates: [references/naming-and-packs.md](references/naming-and-packs.md).
- Full A–F definitions and bars: [references/layers-af.md](references/layers-af.md).
- Dual-repo / series isolation prevents cross-contamination only; compare in a
  **separate** later pack and never present isolation as clean-room provenance.

### 3. Independent judgment and adversary (mandatory before “done”)

Assign a reviewer who did not produce the extraction artifact when subagents are
available. The reviewer samples source, reconciles manifest counts, challenges
contracts/mutation/use claims, and writes `…_91_adversary_notes.md`. If no
independent reviewer is available, run a distinct checklist pass and disclose
`REVIEW_INDEPENDENCE=SELF_REVIEW` as a limitation.

Use [references/adversary-checklist.md](references/adversary-checklist.md).
Reassess the index scorecard from files on disk: evidence state + exact counts +
method + named gaps, never wave labels or an unsupported percentage.

### 4. Report to user

```markdown
## Pack
path + reponame + mode + git identity

## Scorecard (adversary-honest)
layer → COMPLETE | PARTIAL | NOT_FOUND | BLOCKED; found/expected counts; method; named gaps

## Top freeze surface
bounded host-facing symbol list, ranked by observed host use

## Critical residuals
ordered FIX list (from 91_)

## Not freeze-ready if
any of: host surface << host includes, dual contradicting stats files,
missing core mutation cards, regex-only decls claimed complete
```

## Defaults

| Decision | Default |
|----------|---------|
| Full pack prefix | `2_<reponame>_` |
| Topic pack prefix | `4_<reponame>_<slug>_` |
| Prompt series files | `3_prompt_NN_<slug>_scout.md` |
| Declaration extract | mechanical first; label **PARTIAL** until AST/structured |
| Host surface ranking | **domain freeze** first; utilities secondary |
| Cross-product compare | **out of band** after two packs exist |
| Fork this skill | **never** — orchestrator needs history, scope state, and task/subagent control |

## Gotchas

- **A reconciled inventory ≠ API freeze.** Deepen host-referenced surface before freeze language.
- **Dual machine stats** (two include/count JSONs that disagree) = FAIL until one canonical file.
- **Raw include frequency** often ranks utilities over domain types — split domain vs utility.
- **Indirect dispatch** (load via object method, not free function) — use graph must show edges.
- **Enum / flag steps ≠ real barriers** — contracts must say which flags never gate.
- **Wave DONE ≠ depth** — adversary overrides status tables.
- **Isolation scrubbers** that replace product tokens can mangle prose — write isolation text carefully.
- Types living **outside** the lib root must be called out for freeze boundary.
- Casual “how does X work?” without a pack deliverable → **peek-repo**, not this skill.

## Validation

Before claiming complete:

- [ ] Pack dir and **all top-level** docs use required prefix
- [ ] Index classification says source-informed unless separation/provenance is documented
- [ ] Index scorecard matches adversary evidence states and exact counts
- [ ] Scope manifest records command/tool, exclusions, git identity, and stable unit IDs
- [ ] Full mode: inventory list count == disk glob (language-appropriate)
- [ ] Full mode: HOST_SURFACE count == canonical includes/import machine file
- [ ] Topic mode: config key table + runtime flow with owners
- [ ] `91_adversary_notes` exists with critical count, FIX order, and review-independence label
- [ ] No foreign product names in pack body (analytical isolation)

If audit mode: do not preserve a prior percentage by inertia; replace it with
verified states, counts, methods, and gaps.

## Supporting files

| File | Load when |
|------|-----------|
| [references/layers-af.md](references/layers-af.md) | full scout or A–F questions |
| [references/naming-and-packs.md](references/naming-and-packs.md) | creating packs/prompts or naming fights |
| [references/adversary-checklist.md](references/adversary-checklist.md) | end of every run + audit mode |
