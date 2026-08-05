---
name: reimpl-scout
description: >-
  Run reimplementation-grade multi-agent codebase scouts: full library API
  catalog (A–F layers), topic scouts, dual-repo isolated runs, adversary quality
  bars, and numbered research packs (1_prompt / 2_output / 3_topic /
  4_topic-output). Use when the user asks to scout a library for clean-room
  reimpl, map API surface + mutation + use graph + contracts, write series of
  scout prompts, audit an existing scout pack quality, or resume a partial
  freeze. Not for ordinary feature implementation, one-off bugfixes, or casual
  “how does X work” without a pack deliverable (use peek-repo for light local
  source inspection).
argument-hint: "[full|topic|audit|prompt-series] [scope-or-slug]"
arguments: [mode, scope]
shell: bash
---

# Reimpl scout

**Orchestrator skill** (do **not** fork). Produce **documentation packs** a team
can use to reimplement a subsystem — not tourist READMEs and not production
code ports. Fan out subagents for shards; you merge, score, and run adversary.

If the tree is not local yet, use **peek-repo** first, then scout the clone.

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

## Non-negotiables

1. **This codebase only** — never name/compare other products inside pack findings or prompt bodies. Phrase as “this codebase / this tree.”
2. **Multi-agent fan-out** — do not solo-read huge trees; shard by directory/layer; orchestrator merges.
3. **Code over folklore** — claims need `path` + symbol (line band when stable).
4. **No production edits** in the product tree. Scripts only under the **pack** dir.
5. **Never invent symbols** — `NOT_FOUND` / `PARTIAL` + coverage %.
6. **Honest scorecards** — “DONE wave” ≠ freeze bar. Adversary may cut %.
7. **Naming** — see [references/naming-and-packs.md](references/naming-and-packs.md).

## Workflow

### 0. Detect (use injected state; fill gaps only)

- `reponame` = kebab-case of repo root folder (or git remote basename from injection).
- Library root, host roots (CLI/GUI/service), git short SHA (injected when available).
- Research out dir: prefer an existing research sibling the user already uses; else `docs/` under this tree. State choice in index.
- Resume: if injection lists matching `2_*` / `4_*` packs, prefer audit/resume over starting a second unprefixed pack.

### 1. Plan shards

- **full:** waves A inventory → A decls/host → C use + D mutate + E contracts (parallel) → B architecture → F local + reimpl + **adversary**.
- **topic:** map → types/API → config keys → runtime flow → mutation/persistence → contracts → reimpl notes → adversary.
- Minimum concurrent scouts: **4** (topic), **8** (full) when agents available; use Workflow/Agent tools.

### 2. Execute

- Prefer mechanical extract for catalogs (script/ctags/clang/language tools if present); agents structure and cite.
- Pack templates: [references/naming-and-packs.md](references/naming-and-packs.md).
- Full A–F definitions and bars: [references/layers-af.md](references/layers-af.md).
- Dual-repo / series: isolation rules above; compare only in a **separate** later pack, never inside a scout run.

### 3. Adversary (mandatory before “done”)

Run checks in [references/adversary-checklist.md](references/adversary-checklist.md).
Write `…_91_adversary_notes.md` with critical gaps + FIX list. **Re-score** the
index scorecard from adversary evidence (files on disk), not from wave status labels.

### 4. Report to user

```markdown
## Pack
path + reponame + mode + git identity

## Scorecard (adversary-honest)
layer → % + method

## Top freeze surface
≤15 host-facing symbols

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
| Fork this skill | **never** — orchestrator needs history + multi-agent control |

## Gotchas

- **Inventory 100% ≠ API freeze.** Deepen host-referenced surface before freeze language.
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
- [ ] Index scorecard matches adversary numbers
- [ ] Full mode: inventory list count == disk glob (language-appropriate)
- [ ] Full mode: HOST_SURFACE count == canonical includes/import machine file
- [ ] Topic mode: config key table + runtime flow with owners
- [ ] `91_adversary_notes` exists with critical count and FIX order
- [ ] No foreign product names in pack body (isolation)

If audit mode: do **not** inflate %; prefer cutting prior scorecard.

## Supporting files

| File | Load when |
|------|-----------|
| [references/layers-af.md](references/layers-af.md) | full scout or A–F questions |
| [references/naming-and-packs.md](references/naming-and-packs.md) | creating packs/prompts or naming fights |
| [references/adversary-checklist.md](references/adversary-checklist.md) | end of every run + audit mode |
