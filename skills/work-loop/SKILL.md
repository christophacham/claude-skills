---
name: work-loop
description: Orchestrate one work unit end-to-end — design gate, TDD implement, independent cross-model review, AC proof, fix escalation, committed-tree gate, push, tracker close; optional structural tidy only when debt is real. Beads (bd) is the canonical tracker, with gh/Linear/no-tracker fallbacks; repo conventions from CLAUDE.md. Use when implementing a non-trivial planned unit ("work X", "run the loop", "next unit") or resuming one. Not for one-line fixes, planning (use work-plan), epic walks (use bd-epic-runner), or repos that ship their own loop skill.
argument-hint: [unit-id]
arguments: [unit]
shell: bash
---

# work-loop — design → implement → review → push → close

You are the root orchestrator: **you guide, you never implement.** Work is
done by fresh isolated subagents; you select units, enforce the design gate,
resolve models, build packets, enforce verdicts, and own git + tracker
mechanics.

**Overlay rule:** if the repo ships its own loop skill (a
`.claude/skills/*loop*/SKILL.md` whose name is NOT `work-loop`), stop here —
load and follow that skill instead.

**Epic arg:** if the arg is a parent/epic rather than a leaf, hand off to
`bd-epic-runner`. Don't inline an epic walk here.

## Request

$ARGUMENTS

Treat only a token matching `[A-Za-z0-9][A-Za-z0-9._-]*` as a unit ID. Never
pass unvalidated request text to `bd` or a shell. Other text is a session-scoped
override. Resolve the contract after load with `bd show <unit-id> --json`.

## State at load (injected — read it, don't re-run it)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — fail loudly before any dispatch)"`

### Ready units
!`bd ready 2>/dev/null || echo "(no beads initialized — use the repo's tracker or your own notes)"`

### Tree state (must be clean of unrelated work)
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

Load-time data is a snapshot. Resolve the requested contract after validating
the ID; re-read all unit and tree state fresh for every later unit.

## Conventions discovery (first unit in a session)

Read `CLAUDE.md`. Extract and hold:

- **Test gate command** — must be green before push. None stated → ask once.
- **Map generator** (optional) — if present, map rides every code commit.
- **Commit format** — e.g. `<type>: <summary> (<unit-id>)`.
- **Push policy** — default: push after each finished unit.
- **Tracker + sync** — bd (`bd dolt push`), gh, Linear, or none.
- **Non-negotiables** — product rules workers and reviewers must honor.

## Doctrine

1. **Know the seam** — claimable content: testable AC, and for non-trivial
   work a one-place + touch list. Prefer short beads. Missing → `work-plan`
   Flow C. Label `designed` is optional audit, not the gate.
2. **TDD for behavior** — Phase A red→green; skill `testing-tdd`.
3. **Independent review** — different model tier. Re-run gate + how-you-know
   from AC (commands/tests named there). Mutation check on new tests.
4. **Tidy First** — structure ≠ behavior commits. Micro-tidy OK (≤2 files).
   Larger structure → prep unit or post-review tidy **only when debt is real**.
   Prefer `Refactor:` units over Cleanup shells. No always-on Cleanup pair.
5. **Committed-tree evidence** — gate and AC checks on committed tree only.
6. **Honesty** — no placeholders, no dead declarations, no "while I was here."

## Preconditions (every unit)

1. Validate the unit ID, then read its AC, design (if any), and deps with
   `bd show <unit-id> --json`. Prefer leaves over epics — epics are doctrine;
   do not claim an epic as implement work.
2. **Triviality:** one AC, one file, no semantic change → inline, gate, no review.
3. **Claim gate (content, not ceremony):**
   - **Bug / trivial:** non-empty AC is enough.
   - **Implement:** AC + design with one place + touch list (or justified
     single-file scope in AC). Empty → Flow C.
   - **Refactor / tidy:** AC or design names where + structural change.
   - How-you-know lives in AC bullets when present; no separate proof field
     required. Wrong-scope design → Flow C rewrite.
4. Tree clean; prior unit pushed. Never start red.
5. Claim via beads-creator. **One unit in progress at a time.**
6. Resolve coder/reviewer tiers from the pool.

## Pool resolution

- `pool:` → tier short-names. Empty → fail loudly.
- `coder:` / `reviewer:` pins win; must be pool members.
- **Cross-model:** coder ≠ reviewer tier names. Same tier → warn once,
  `degradedRun: true`.
- Unpinned coder by class: hardest → strongest; large mechanical → second;
  standard → middle; structural tidy → middle; trivial → weakest.
- Reviewer = strongest ≠ coder (full-loop units).

**Fixed-tier mechanical roles** (always `model=haiku`, not pool pins):
`beads-creator`, `beads-reviewer`. Map trust is **load-time injection** in
`work-plan` (script), not a haiku agent. If haiku unavailable for beads
roles, fail loudly once and ask.

## Roles

- **coder** — one phase per dispatch. Phase A: TDD + proof. Phase B (tidy):
  behavior-preserving structural commits only. Commits; never pushes/amends/
  tracker.
- **reviewer** — independent audit of committed diff; PASS/FIX/ROLLBACK;
  micro-fix commits only (typo/format/dead code). Re-runs gate + **AC proof**
  + mutation check (Phase A).
- **beads-creator** / **beads-reviewer** — tracker mutations / hygiene.

Agents live in `~/.claude/agents/` (repo `.claude/agents/` shadows). If a
named agent is missing, dispatch `general-purpose` with the role contract
pasted in.

## The loop (per unit)

### 1. Implement

`Agent(subagent_type="coder", model=<coder tier>, run_in_background: false)`
with a **WORKER_PACKET**:

- unit id + AC **verbatim** · design one-place + touch (if any)
- skills: Phase A → `testing-tdd`; Phase B → `refactoring` + `simple-design`;
  FFI/library → `third-party-integration`
- commit: repo format; commit, do NOT push/amend/close; report SHA
- **Proof rules:**
  1. Gate after commit on committed tree.
  2. Map rides the commit when generator exists and code was touched.
  3. Wired, not declared.
  4. Exercise how-you-know from AC (named tests/commands/scenarios), not only
     hoping the full suite touches the path.
  5. Emit structured report when done.
- **Phase B only:** work only seeded `where` + structural changes; no prose/
  glyph/docs as the work; Comments only as Extract/Rename that remove the
  comment's job; empty seed → report `nothingToTidy: true` and stop (success).

### 2. Independent review

`Agent(subagent_type="reviewer", model=<reviewer tier>, run_in_background: false)`
with a **REVIEW_PACKET**: unit id + AC + design, commit SHA(s), coder tier.
Reminders:

- Re-run the **gate** independently (paste output).
- Re-check AC how-you-know (paste evidence when AC names a command/test).
- **Mutation check** (Phase A): perturb one new/changed assert → red → restore.
  Phase B tests untouched → `skipped-byte-identical-tests`.
- Plan adherence: diff ⊆ touch list (or justified); no mixed structure+behavior.
- Phase A: optional `structuralDebt[]` (empty preferred). `where` + structural
  change only. Never invent debt. Prefer recommending a **Refactor:** unit over
  Cleanup shells when debt is large.
- Phase B: zero behavior delta; tests byte-identical; stays on seed.

**PASS:** AC met · how-you-know checked · gate green · mutation (Phase A) ·
no blocker/major.

- **FIX** → step 3.
- **ROLLBACK** (AC unmet and approach wrong) → `git revert`, document,
  replan via `work-plan`. Stop.

### 3. Fix loop (on FIX)

Fresh coder, findings verbatim, prior SHA. Until PASS.

- Same finding 2× → escalate coder tier, or one blind-fresh pass. Still
  failing → design wrong; stop, replan.
- 4 failed iterations → beads-creator: reopen + `human` label, stop.
- >2 FIX cycles → usually too big; propose a split.

### 4. Finalize (orchestrator only)

1. Map refresh already in worker commit when code was touched.
2. Prefer reviewer's pasted gate + proof evidence. Re-run the gate yourself
   only if the verdict lacks command output, after rebase onto new upstream,
   or on doubt. Red → FIX loop; do not push.
3. `git pull --rebase` (re-run gate if HEAD moved; non-trivial conflict →
   stop, ask) → `git push` → `git status` up to date.
4. beads-creator: close with one-line reason mapping to AC + tracker sync.
5. Tree carries only this unit's commits before the next unit.

### 5. Optional structural tidy (not always-on)

**Do not** pre-file a Cleanup sibling for every implement unit.

After Phase A PASS, merge structural debt from:

1. reviewer `structuralDebt[]` (where + structural change)
2. coder `Follow-ups` that are structural with a concrete where
3. in-scope structural `hotspotNotes` only if you can name where + change

**Drop:** free-text "tidy", prose/glyph/docs nits, taste renames, anything
already in `microFixCommits`.

Then:

| Debt left | Path |
|---|---|
| None | Done — no Cleanup unit |
| Structural, ≤2 files | Prefer micro-tidy on Phase A if still open; else small tidy commits now only if review already passed and you re-review |
| Structural, larger | File **one** `Refactor:` unit (preferred title) with where+change, dep on implement, work next |

Finish any filed tidy unit before opening a new implement unit. Empty debt
is success — do not invent comment theater.

## Hard rules

- One writer at a time on shared tree/state.
- Reviewer mandatory before push on full-loop units (trivial path excepted).
- No amend; fixes add commits.
- Worker never pushes, closes, claims, or writes the tracker.
- User sign-off mid-process → present between stages; no agent waits on input.

## When to skip the loop

Single-file typo, one-line config, single bad-commit revert, docs catch-up.
Inline, gate before push, no review.

## When to break mid-flight

Spec conflict → stop, ask. ROLLBACK → replan. Design wrong → revert, replan.
Structural gap too big for micro-tidy → worker stops; you invoke `work-plan`
Flow C; work new blockers first. User is the final reviewer.

## Steering (honor)

"stop after this unit" · "skip X, do Y" · "use haiku here" · "approve anyway"
· "escalate model" · "dry run" · "force tidy" (file/run Phase B even if debt
thin — note override on the unit).

## Worker report format

```
Work unit: <id>
Phase: A | B
Files: <path> (created|modified, ±lines) — one per line
Tests: <N> passed, 0 failed; full suite <N> passed
Proof:
  - <AC proof line>: <pass + evidence | fail>
Commit: <sha>
Deviations: <list or "none">
Blockers: <list or "none">
Follow-ups: <structural debt with where, or "none">
nothingToTidy: <true|false|n/a>   ← Phase B; true is success
```

## Per-unit report (to user)

```
<unit-id> <title>
  coder=<model> reviewer=<model> degraded=<yes|no> iterations=<n>
  verdict: <summary>
  proof: <all AC proofs observed | gaps>
  commits: <sha…>  pushed: ✓  closed: <reason>
  tidy: <none | micro | follow-up unit id>
```

## Gotchas

- Reviewer without independent gate **and** proof evidence → invalid; re-dispatch.
- Empty `structuralDebt[]` is a valid Phase A PASS; do not pressure inventing debt.
- Memory lives in files (unit, findings, diff) — every dispatch is fresh.
- Reviewer killed mid-run may have micro-fix commits — re-review must list them.
- Worker/reviewer never push or amend. Push is yours.
