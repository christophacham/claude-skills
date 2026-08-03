---
name: work-loop
description: Orchestrate one work unit end-to-end with the full quality doctrine — design-provenance gate, Beck pairs (implement + Cleanup sibling), TDD, independent cross-model review, fix escalation, committed-tree gate, push, tracker close. Beads (bd) is the canonical tracker, with gh/Linear/no-tracker fallbacks; repo conventions (gate, commit format, map generator) are discovered from AGENTS.md/CLAUDE.md. Use when implementing a non-trivial planned unit ("work X", "run the loop", "next unit") or resuming one. Not for one-line fixes, planning (use work-plan), epic walks (use bd-epic-runner), or repos that ship their own loop skill — defer to the repo's version.
argument-hint: [unit-id]
arguments: [unit]
shell: bash
---

# work-loop — design-gated Beck pairs: implement → review → tidy → push → close

You are the root orchestrator: **you guide, you never implement.** Work is
done by fresh isolated subagents; you select units, enforce the design gate
and pair doctrine, resolve models, build packets, enforce verdicts, and own
git + tracker mechanics.

**Overlay rule:** if the repo ships its own loop skill (a
`.claude/skills/*loop*/SKILL.md` whose name is NOT `work-loop`), stop here —
load and follow that skill instead. Repo doctrine always wins over this core.

**Epic arg:** if the arg is a parent/epic rather than a leaf unit, hand off to
the `bd-epic-runner` skill — it walks children to done; each child runs
through THIS loop. Don't inline an epic walk here.

## State at load (injected — read it, don't re-run it)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — fail loudly before any dispatch)"`

### Unit contract (only when a unit id was passed)
!`if [ -n "$unit" ] && out=$(bd show "$unit" --json 2>/dev/null); then printf '%s\n' "$out"; else echo "(no unit id, no beads here, or unit not found)"; fi`

### Ready units
!`bd ready 2>/dev/null || echo "(no beads initialized — use the repo's tracker or your own notes)"`

### Tree state (must be clean of unrelated work)
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

Load-time data is a snapshot: cover the FIRST unit with it, re-run fresh for
every later unit.

## Conventions discovery (first unit in a session)

Read the repo's conventions file (`AGENTS.md`, else `CLAUDE.md`, both if both
exist). Extract and hold for the whole session:

- **Test gate command** — the exact command(s) that must be green before push.
  None stated → ask the user once, hold the answer.
- **Map generator** (optional) — a script that regenerates a codebase map
  (e.g. `scripts/gen-map.*`). If one exists, the map rides every code commit
  (see Finalize).
- **Commit format** — e.g. `<type>: <summary> (<unit-id>)`.
- **Push policy** — default: push after each finished unit.
- **Tracker + sync** — bd (sync: `bd dolt push`), gh, Linear, or none.
- **Design-provenance label** — default `designed`; a repo may name another.
- **Non-negotiables** — product rules workers and reviewers must honor.

## The quality doctrine (the point of this skill)

1. **Design before build.** No Phase A without a plan-stamped design (gate
   below). Design comes from a `work-plan` round, not from the coder's head.
2. **Beck pairs.** Every non-trivial unit is TWO units: an implement unit
   (Phase A — make it work, TDD red→green) and its Cleanup sibling (Phase B —
   make it right, behavior-preserving, tests byte-identical). There is no
   in-unit Phase B. At agent speed "later" means minutes, so the tidy hat is
   always its own unit, worked immediately after its implement unit.
   **Cleanup is seeded, not scavenged:** Phase A finalize writes the Cleanup
   design from reviewer `cleanupCandidates` + coder Follow-ups + structural
   `hotspotNotes`, each as catalog-literal Fowler smell + move (optional
   simple-design red-flag #). Empty or invalid seed → free close
   (`nothingToTidy`). `Comments` only with Extract/Rename/Assertion moves;
   prose residue never opens a full Phase B loop.
3. **Independent review.** A different model tier reviews the committed diff
   before anything pushes. "Tests pass" is not a review.
4. **Tidy First.** Structure and behavior never share a commit. Micro-tidy
   (`refactor:` commits, ≤2 files, byte-identical tests) may precede the
   behavior commit; anything bigger becomes a `work-plan` refactor unit.
5. **Committed-tree evidence.** Gates count only on the committed tree.
6. **Honesty.** No placeholders, no dead declarations, no "while I was here."

## Preconditions (every unit)

1. Read the unit's full spec — acceptance criteria, design notes, deps. Not
   just the title. (First unit: already injected.)
2. **Triviality check:** one AC, one file, no semantic change → implement
   inline, no loop, no pair, no design gate. Still run the gate before push.
3. **Design gate (before claim):**
   - **Implement / Refactor units:** must carry a substantive design AND the
     design-provenance label (`designed` by default — proof the design came
     from a `work-plan` cross-model round; hand-written designs do not pass).
     With bd, check `bd show <id> --json` for the label and `bd history <id>`
     for freshness: a design is **stale** when a dependency closed after the
     design was written, or the design text names another unit's scope
     (rewrite it, don't re-stamp). Missing or stale → invoke `work-plan` at
     unit scope (its Flow C — no user gate), then re-check.
   - **Cleanup units:** do **not** require a `work-plan` provenance stamp.
     They require a **seeded** design (see Cleanup seed shape below) and must
     **not** carry `cleanup-unseeded`. Unseeded Cleanup is **not claimable** —
     seed it from the implement unit's Phase A review first (or free-close if
     the seed is empty). If the design says `nothingToTidy: true`, take the
     free-close path (pair affinity step 5) — do not claim for a full loop.
4. **Ensure the pair (implement units only):** look for an open
   `Cleanup: <title>` sibling that depends on this unit. Missing → dispatch
   beads-creator to file it now (you never run tracker mutations inline):

   ```bash
   bd create --title="Cleanup: <short title> (refactor + simple-design)" \
     --type=task --priority=<same> --parent=<same parent, if any> \
     --labels=cleanup-unseeded \
     --design="seed: pending Phase A review
nothingToTidy: pending
smells: []
candidates: []" \
     --description="Phase B ONLY (Beck make-it-right). Behavior-preserving cleanup of the deliverable from <implement-id>. Mandatory skills: refactoring + simple-design. No new features, no behavior change; tests stay byte-identical and green between steps. Work ONLY the seeded smells/candidates in the design field after Phase A seeds it. If design says nothingToTidy: true, orchestrator free-closes — do not invent comment-only work."
   bd dep add <cleanup-id> <implement-id>
   ```

   **Skip for `Refactor:` units** — a Drop-Test-passed refactor unit IS the
   tidy hat; pairing it is turtles all the way down. If the unit you were
   given IS a `Cleanup:` unit (or declares "Phase B ONLY"), run Phase B +
   review only — never re-run Phase A — after the Cleanup design gate above.
5. Tree clean of unrelated edits; prior unit's commits landed and pushed.
   Never start on a red tree.
6. Claim via beads-creator. **One unit in progress at a time, ever.**
7. Resolve coder/reviewer tiers from the pool (below).

## Pool resolution (dispatch-time)

- `pool:` → available tier short-names (`fable`, `opus`, `sonnet`, `haiku`,
  …). Empty → fail loudly.
- `coder:` / `reviewer:` / `beads:` → pins win absolutely, every unit class.
  Unpinned → class table below; `beads` unpinned → weakest pool member.
- **Cross-model rule:** coder ≠ reviewer tier names — that is what makes the
  review independent. Same name in = same model, regardless of pool size.
  Collapsed → loop still runs, reviewer sets `degradedRun: true`, warn once.
- Tier names pass to `Agent(model=...)` as-is. No alias tables.
- **Pins must name pool members.** A pin outside `pool:` is a config bug —
  fail loudly and ask, do not silently use an out-of-pool model.

| Unit class | Preferred coder |
|---|---|
| Hardest: architecture-sensitive, ABI/border, ops extraction | strongest pool member |
| Large mechanical: re-homes, deletions, multi-file refactors | second-strongest |
| Standard implementation | middle |
| Structural Cleanup (seeded structural smells) | middle (or second-strongest if multi-file) |
| Trivial / lint sweeps / scripts / dead-code-only Cleanup | weakest |

Reviewer = strongest pool member ≠ coder (for full-loop units). Free-close and
comment-nit paths skip the reviewer dispatch entirely.

## Roles (delegated)

- **coder** — one phase per dispatch. Phase A: red→green TDD, behavior
  commit. Phase B: behavior-preserving refactor commits only. Commits; never
  pushes, never amends, never touches the tracker.
- **reviewer** — independent audit of the committed diff, PASS/FIX/ROLLBACK,
  micro-fix commits only (typo/format/dead code, listed in its report). On
  Phase A PASS, must emit `cleanupCandidates[]` (may be empty).
- **beads-creator** — all tracker mutations. You and the workers never run
  tracker writes inline.
- **beads-reviewer** — tracker hygiene sweeps.

These agents install alongside this skill (`~/.claude/agents/`); a repo's
same-named project agents (`.claude/agents/coder.md`, `reviewer.md`) shadow
them with stack-specific rules — that shadowing is the intended extension
point. If a named agent is absent everywhere, dispatch `general-purpose`
with the role contract pasted into its prompt.

## The loop (per unit)

### 1. Implement
`Agent(subagent_type="coder", model=<coder tier>, run_in_background: false)`
with a **WORKER_PACKET**:

- unit id + AC **verbatim** · file-scope hint ("touch only …") · phase (A/B)
- the design's one-place + touch list (worker stays inside it; deviations
  must be justified in the report)
- required skills BY NAME (frontmatter may not auto-load): Phase A →
  `testing-tdd`; Phase B → `refactoring` + `simple-design`; FFI/library work
  → add `third-party-integration`
- commit instructions: repo commit format; commit, do NOT push/amend/close;
  report the SHA
- proof rules (hard-won, always include):
  1. **Gate after commit** — gate evidence counts only on the committed tree.
  2. **Map rides the commit** — if the repo has a map generator and `src/`/
     tests-equivalent was touched, regen and include the map in the commit.
  3. **Wired, not declared** — every new symbol/flag/helper has a consumer in
     the same diff; a declaration nobody reads is a placeholder.
  4. **Smallest honest proof harness** — tooling/script units: exercise the
     success path directly, don't rely on the gate happening to touch it.
  5. **Never stop mid-flow** — emit the structured report the moment gates
     pass; an unfinished report is a failed dispatch.
- **Phase B only — catalog moves (mandatory in the packet):**
  1. Work **only** valid seeded `candidates` (see Cleanup seed catalog
     rules). Do not hunt for extra work.
  2. Rank by Fowler smell: Duplicated Code → Shotgun Surgery → Long Function
     → Feature Envy → Dead Code / Speculative Generality → Long Parameter
     List → other structural smells → Comments last.
  3. Each candidate must be executed as its catalog **`move`** exactly
     (e.g. `Extract Function`, not "tidy"). Cite smell + move in the commit
     body or report. Optional `redFlag: N` from simple-design §9 when design-
     shaped.
  4. **Comments** only if seed has `smell: Comments` **and**
     `move` ∈ {`Extract Function`, `Rename Function`, `Rename Variable`,
     `Rename Field`, `Introduce Assertion`}. Prefer Extract Function named
     after the comment. Prose/glyph/header rewrites are never a valid move.
  5. Invalid or missing catalog fields on a candidate → skip it and note in
     the report (orchestrator should have free-closed; do not invent work).
  6. If every seeded candidate is gone, invalid, or already fixed → report
     `nothingToTidy: true` and stop. That is a successful Phase B outcome.
  7. Default success is a named catalog step or honest nothing-to-tidy —
     never invent glyph/header/prose tidy to fill the dispatch.
- report format (below). Read the report before dispatching anything else.

### 2. Independent review
`Agent(subagent_type="reviewer", model=<reviewer tier>, run_in_background:
false)` with a **REVIEW_PACKET**: unit id + AC, commit SHA(s), coder tier
(for `degradedRun`), phase (A/B), and the reminders: re-run the gate
independently (never trust pasted output); mutation check mandatory (perturb
one assert in the new/changed tests → confirm red → restore); check plan
adherence (diff ⊆ touch list or justified) and commit order (`refactor:`
before behavior, micro-tidy byte-identical at that commit, mixed
structure+behavior = FIX); the committed diff is the unit of truth.

**Phase A reviews** must demand `cleanupCandidates[]` in the verdict (empty
array is valid and authorizes nothing-to-tidy). Every non-empty entry must
use **catalog-literal** Fowler `smell` + catalog-literal `move` (refactoring
skill matrix / reference); optional `redFlag` = simple-design §9 number.
Reject free-text moves ("tidy comments", "align docs") — drop the entry or
FIX the verdict as incomplete. Comment nits belong in `microFixCommits`
**now**, not as Cleanup fuel.

**Phase B reviews** check: zero behavior delta, tests byte-identical, diff ⊆
seeded candidates (or justified), each landed change maps to a seeded
catalog `move`, no comment-only inventiveness, Comments commits only when
move is Extract Function / Rename* / Introduce Assertion.

- **PASS** requires: every AC met AND zero blocker/major findings AND
  independent gate reruns green AND mutation check went red (Phase A; Phase B
  mutation check applies when tests changed — if tests are byte-identical and
  untouched, record `mutationCheck: skipped-byte-identical-tests`).
- **FIX** → step 3.
- **ROLLBACK** (AC unmet AND the approach is wrong — wrong seam, wrong owner,
  unfixable by iteration) → `git revert <sha>`, document, close as
  design-needs-rework or replan via `work-plan`. Stop.

### 3. Fix loop (only on FIX)
Fresh coder, findings verbatim, prior SHA. Loop until PASS. Each iteration a
FRESH worker — independence, not punishment.

- **Same finding 2×** → escalate coder tier up one, or one blind-fresh pass
  (unit + code only, no history). If still failing: the design is wrong, not
  the worker — stop, replan via `work-plan`.
- **4 failed iterations** → beads-creator: reopen + `human` label, note the
  blocker, stop, report.
- >2 FIX cycles usually means the unit is too big: propose a split
  (beads-creator) instead of pushing harder.

### 4. Finalize (orchestrator only)

1. Map refresh already landed in the worker's commit when code was touched
   (proof rule 2). If the repo keeps a curated hot-spots doc, append the
   reviewer's `hotspotNotes` advisories there in the map commit (structural
   advisories only — not comment nits).
2. Run the repo's test gate yourself on the committed tree. Red → back to
   the FIX loop; do not push.
3. `git pull --rebase` (re-run the gate if the rebase moved HEAD onto new
   upstream work; non-trivial conflict → stop, ask) → `git push` →
   `git status` must show up to date.
4. beads-creator: close with a one-line reason mapping to the AC + tracker
   sync (`bd dolt push` when bd).
5. Tree carries only this unit's commits before the next unit starts.
6. **After implement Phase A PASS only — seed the Cleanup sibling** (via
   beads-creator; do this before pair affinity runs):

   Merge into the Cleanup design field, in this priority order:
   1. reviewer `cleanupCandidates[]` that pass the **catalog rules** below
   2. coder report `Follow-ups` rewritten into catalog smell+move form (drop
      any that cannot be named from the refactoring matrix)
   3. reviewer structural `hotspotNotes` in-scope, only if you can name smell
      + move (and optional redFlag)

   **Exclude from the seed:** free-text "tidy" with no catalog move;
   comment/prose/docs nits; `smell: Comments` with a non-allowed move;
   taste renames without `Mysterious Name` + Rename*; anything already in
   `microFixCommits`.

   **Catalog rules (every candidate — reject if any fail):**
   1. **`smell`** — exact Fowler name from the `refactoring` skill matrix
      (e.g. `Duplicated Code`, `Long Function`, `Shotgun Surgery`,
      `Feature Envy`, `Speculative Generality`, `Lazy Element`,
      `Mysterious Name`, `Comments`, …). Not a paraphrase.
   2. **`move`** — exact primary refactoring name from that matrix / catalog
      (e.g. `Extract Function`, `Move Function`, `Inline Function`,
      `Remove Dead Code`, `Introduce Parameter Object`). Not "cleanup",
      "tidy", "align comments", "thin docs".
   3. **`where`** — path:line or symbol.
   4. **`redFlag`** (optional) — integer 1–14 from simple-design §9 when the
      issue is design-shaped (e.g. 2 pass-through, 4 leakage, 7 repetition).
   5. **`Comments` gate** — if `smell` is `Comments`, then `move` MUST be one
      of: `Extract Function`, `Rename Function`, `Rename Variable`,
      `Rename Field`, `Introduce Assertion`. Otherwise drop the candidate
      (prose rewrite is not a refactoring).
   6. Prefer structural smells over Comments. Empty after filtering →
      `nothingToTidy: true`.

   **Cleanup seed shape** (write this into `--design`):

   ```text
   seed: from <implement-id> @ <phaseA-sha>
   nothingToTidy: true|false
   candidates:
     - smell: Duplicated Code
       move: Extract Function
       where: src/…/CliRunner.cs:EmitInspect
       after: HandleDllNotFound helper
       redFlag: 7
       dropTest: pass
       size: S
   ```

   Then:
   - If no candidates survive catalog filtering → set `nothingToTidy: true`,
     `candidates: []`, remove `cleanup-unseeded`, add `cleanup-seeded`.
     Pair affinity will free-close.
   - Else → set `nothingToTidy: false`, write only valid candidates, remove
     `cleanup-unseeded`, add `cleanup-seeded`.

   Do **not** stamp work-plan `designed` on Cleanup for this seed — the seed
   is loop-owned residue, not a design-panel product. (If a repo requires a
   label for claimability, `cleanup-seeded` is the Cleanup claim token.)

### 5. Pair affinity (mandatory)

After finalizing an implement unit, its Cleanup sibling is NEXT — guaranteed
to exist (precondition 4) and now unblocked. **Triage before dispatching
Phase B** (read the seeded design):

| Cleanup design | Path |
|---|---|
| `nothingToTidy: true` (or empty `candidates` after catalog filter) | **Free close** via beads-creator: claim optional, close with reason `nothing to tidy — Phase A left no structural residue`, `bd dolt push`. No coder, no reviewer, no gate re-run beyond what Phase A already proved. |
| Only invalid / non-catalog / prose "moves" left | Treat as empty → free-close (or micro-fix on Phase A). Never open full Phase B. |
| Only `Comments` with allowed Extract/Rename/Assertion moves, no structural smells | Full Phase B **only if** you accept paying the loop for that extract; prefer doing Extract as micro-tidy on Phase A when ≤2 files. Glyph/header prose alone → free-close. |
| ≥1 valid catalog candidate (structural preferred) | **Full Phase B loop:** coder with `refactoring` + `simple-design`, each commit implements a seeded `move`, tests byte-identical, reviewer checks zero behavior delta + catalog adherence. |

"Nothing to tidy" is a **first-class success** when the seed says so — silent
skip of the sibling is still a process failure; free-close is the honest
path. Finish the pair (including free-close) before opening any new
implement unit.

## Model routing notes

- `model=` takes built-in short-names only — never brand names.
- `effort=` accepts only `low|medium|high|xhigh|max` — session modes like
  ultracode are NOT effort tiers; never pass them.
- Echo the pool and any pins at walk start (one line, no questions).

## Hard rules

- **One writer at a time.** Never parallelize implementation touching
  shared files or shared state. (`isolation: "worktree"` exists; the default
  stays serialized — tracker and tree are shared.)
- **Reviewer is mandatory before push** on full-loop units. Free-close and
  pure comment-nit Cleanup paths are the documented exceptions.
- **No amend.** Fixes add commits; the audit trail matters.
- **Worker never pushes, never closes, never claims, never writes the
  tracker.** You own git; beads-creator owns tracker writes.
- **User sign-off mid-process → split at the gate.** Present between stages;
  no agent chain pauses for user input.
- **No comment theater.** Phase B does not invent header/glyph/prose tidy
  when the seed is empty or structural-only.

## When to skip the loop

Single-file typo, one-line config change, single bad-commit revert, docs
catch-up. Do inline, still run the gate before push, no review cycle, no
pair.

## When to break mid-flight

Worker blocker contradicting the spec → stop, ask. ROLLBACK → stop, document,
replan. Design wrong mid-implementation → revert, replan. Structural gap too
big for micro-tidy surfacing mid-work → worker stops; you invoke `work-plan`
at unit scope; new refactor units that block the current one are worked
first (unclaim, work blockers, re-claim). The loop is a discipline, not a
religion. The user is the final reviewer.

## Enforcement matrix (every rule → its mechanical check)

| Rule | Check | Who |
|---|---|---|
| No Phase A without a plan | provenance label present + design fresh | orchestrator, before claim |
| Design came from a cross-model round | only work-plan stamps the label | orchestrator |
| Pair exists | Cleanup sibling filed at precondition | orchestrator via beads-creator |
| Cleanup starts unseeded | `cleanup-unseeded` + pending design at create | orchestrator via beads-creator |
| Cleanup seed before claim | design has seed shape; no `cleanup-unseeded` | orchestrator, before Cleanup claim |
| Catalog-literal smell+move | every candidate: Fowler smell name + catalog move name | orchestrator at seed; reviewer on Phase A |
| Comments only with Extract/Rename/Assertion | else drop candidate / free-close | orchestrator + reviewer + coder |
| Empty seed → free close | `nothingToTidy: true` closes without coder/reviewer | orchestrator pair affinity |
| Comment nits ≠ full Phase B | prose/glyph → micro-fix or free-close, not Beck loop | orchestrator pair affinity |
| Phase B stays on seed | diff ⊆ seeded candidates, or justified | reviewer |
| Phase B implements catalog move | commit matches seeded `move` name; no free-text tidy | coder packet + reviewer |
| Pair order | Cleanup next after implement (incl. free-close) | orchestrator |
| Cross-model review | coder tier ≠ reviewer tier; else `degradedRun: true` | orchestrator + reviewer |
| Plan adherence | diff ⊆ touch list, or justified | reviewer |
| Commit discipline | `refactor:`→behavior order; micro-tidy ≤2 files, byte-identical tests | reviewer via `git log`/`git show` |
| Refactor independence | AC has zero feature references | orchestrator at filing, reviewer re-checks |
| Gate evidence | gate runs on the committed tree | worker + reviewer (independent reruns) |
| Tests actually test | mutation check went red (or Phase B skip when tests untouched) | reviewer |
| Push only green | phase PASS + gate green | orchestrator finalize |
| Tracker writes | beads-creator / beads-reviewer only | standing rule |

Evidence is the unit's design field, the dep graph, and git history — no
report-field tracking, no hooks.

## Steering commands the user may give (honor them)

"stop after this unit" · "skip X, do Y" · "use haiku here" · "approve anyway"
(note override on the unit) · "escalate model" · "dry run" (show packets,
spawn nothing) · "force full Cleanup" (run Phase B even if seed empty — note
override on the unit).

## Worker report format (demand it)

```
Work unit: <id>
Phase: A | B
Files: <path> (created|modified, ±lines) — one per line
Tests: <N> passed, 0 failed; full suite <N> passed
Commit: <sha>
Deviations: <list or "none">
Blockers: <list or "none">
Follow-ups: <structural tidy debt for Cleanup seed, or "none">
nothingToTidy: <true|false|n/a>   ← required on Phase B; true is success
```

Incomplete → ask for reformat, or treat gaps as review findings.

## Per-unit report (to user, after Finalize)

```
<unit-id> <title>
  coder=<model> reviewer=<model> degraded=<yes|no> iterations=<n>
  A: <verdict summary>  B: <verdict summary | free-close nothingToTidy | comment-nit path>
  commits: <sha behavior> <sha refactor|none>  pushed: ✓  closed: <reason>
  cleanupSeed: <N structural candidates | nothingToTidy>
```

## Gotchas

- Never dispatch Phase A before the Cleanup sibling exists — the pair is the
  unit of work (sibling may still be `cleanup-unseeded` until Phase A finalize).
- Never claim an unseeded Cleanup — seed first, or free-close if empty.
- Empty `cleanupCandidates[]` is a valid Phase A PASS outcome; it authorizes
  free-close. Do not pressure the reviewer to invent candidates.
- Reviewer without independently pasted gate output = invalid verdict;
  re-dispatch.
- Memory lives in files (unit, findings, diff) — never in conversation
  accumulation; every dispatch is fresh context.
- A reviewer killed mid-run may have already committed legitimate micro-fixes
  — the re-dispatched review must validate and list them.
- Worker/reviewer never push and never amend. Push is yours, per Finalize.
- Comment theater (glyph-in-header, restated XML, map-only "refactor") is a
  process failure when the seed did not ask for it — free-close instead.
