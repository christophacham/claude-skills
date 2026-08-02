---
name: work-loop
description: Orchestrate one work unit end-to-end — claim → implement → independent cross-model review → fix iterations → gate → push → close. Beads (bd) is the canonical tracker, with gh/Linear/no-tracker fallbacks. Use when implementing a planned work unit ("work X", "run the loop", "next unit") or resuming one. Not for one-line fixes, planning (use work-plan), or repos that ship their own loop skill — defer to the repo's version.
argument-hint: [unit-id]
arguments: [unit]
shell: bash
---

# work-loop — generic implement → review → fix → push → close

You are the root orchestrator: **you guide, you never implement.** Work is
done by fresh isolated subagents; you select units, resolve models, build
packets, enforce verdicts, and own git + tracker mechanics.

**Overlay rule:** if the repo ships its own loop skill
(`.claude/skills/*loop*/SKILL.md`, e.g. `nps-loop`), stop here — load and
follow that skill instead. Repo doctrine always wins over this generic core.

## State at load (injected — read it, don't re-run it)

### Pool (repo pool wins; global default is the fallback)
!`cat "${CLAUDE_PROJECT_DIR}/.claude/skills/work-loop/pool.md" 2>/dev/null || cat "${CLAUDE_PROJECT_DIR}/.claude/skills/loop/pool.md" 2>/dev/null || cat ~/.claude/skills/work-loop/pool.md 2>/dev/null || echo "(no pool.md found — fail loudly before any dispatch)"`

### Unit contract (only when a unit id was passed)
!`bd show $unit --json 2>/dev/null || echo "(no unit id, no beads here, or unit not found)"`

### Ready units
!`bd ready 2>/dev/null || echo "(no beads initialized — use the repo's tracker or your own notes)"`

### Tree state (must be clean of unrelated work)
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

Load-time data is a snapshot: cover the FIRST unit with it, re-run fresh for
every later unit.

## Preconditions (first unit in a session)

1. Read the repo's conventions file (`AGENTS.md`, else `CLAUDE.md`). Extract
   and hold: test gate command, commit format, push policy, non-negotiables.
2. Read the unit's full spec — acceptance criteria, design notes, deps. Not
   just the title.
3. Tree clean of unrelated edits (see injected state). Dirty → stop, ask.
4. Previous unit closed and pushed before claiming the next. Sequential.
5. Unit has substantive design notes. Absent or stale → run the `work-plan`
   skill first.

## Pool resolution (dispatch-time)

- `pool:` → available tier short-names (`fable`, `opus`, `sonnet`, `haiku`,
  …). Empty → fail loudly.
- `coder:` / `reviewer:` / `beads:` → pins win absolutely. Unpinned → class
  table below; `beads` unpinned → weakest pool member.
- **Cross-model rule:** coder ≠ reviewer tier names — that is what makes the
  review independent. Same name in = same model, regardless of pool size.
  Collapsed → loop still runs, reviewer sets `degradedRun: true`, warn once.
- Tier names pass to `Agent(model=...)` as-is. No alias tables.

| Unit class | Preferred coder |
|---|---|
| Hardest: architecture-sensitive, ABI, ops extraction | strongest pool member |
| Large mechanical: re-homes, deletions, multi-file refactors | second-strongest |
| Standard implementation | middle |
| Trivial / lint sweeps / scripts | weakest |

Reviewer = strongest pool member ≠ coder.

## Roles (delegated)

- **coder** — writes code and tests, commits, never pushes, never amends,
  never touches the tracker.
- **reviewer** — independent review of the committed diff, PASS/FIX/ROLLBACK,
  micro-fix commits only (typo/format/dead code, listed in its report).
- **beads-creator** — all tracker mutations. You and the workers never run
  tracker writes inline.
- **beads-reviewer** — tracker hygiene sweeps.

These agents install alongside this skill (`~/.claude/agents/`). If a named
agent is absent, dispatch `general-purpose` with the role contract pasted
into its prompt.

## Workflow per unit

### 1. Claim
Via beads-creator (`bd update <id> --claim`). No tracker → skip, keep your
own list.

### 2. Implement (Phase A — TDD new behavior, or Phase B — refactor)
`Agent(subagent_type="coder", model=<coder tier>, run_in_background: false)`
with a packet containing: unit id + AC **verbatim** · file-scope hint
("touch only …") · phase · commit instructions ("commit; do NOT push, amend,
or close; report the SHA") · required skills by name (Phase A: testing-tdd;
Phase B: refactoring + simple-design) · report format (below). Read the
report before dispatching anything else.

### 3. Independent review
`Agent(subagent_type="reviewer", model=<reviewer tier>, run_in_background:
false)` with: commit SHA(s), AC, file paths, coder tier (for `degradedRun`),
and the reminder: re-run the gate independently — never trust pasted output;
the committed diff is the unit of truth.

- **PASS** → step 5.
- **FIX** → step 4.
- **ROLLBACK** → `git revert <sha>`, document, close as design-needs-rework
  or replan via `work-plan`. Stop.

### 4. Fix loop (only on FIX)
Fresh coder, findings JSON verbatim, prior SHA. Loop 3–4 until PASS. Each
iteration a FRESH worker — independence, not punishment. **Same finding
twice → stop, escalate to the user** — the design is wrong, not the worker.

### 5. Gate + push
Run the repo's test gate yourself on the committed tree. Green, then:

```
git pull --rebase && git push
```

Non-trivial rebase conflict → stop, ask. Push policy from conventions or the
user overrides the default (push after each unit).

### 6. Close
Via beads-creator, with the SHA and a one-line reason mapping to the AC.
Report newly unblocked units.

## Hard rules

- **One writer at a time.** Never parallelize implementation touching
  shared files or shared state. (`isolation: "worktree"` exists; the default
  stays serialized — tracker and tree are shared.)
- **Reviewer is mandatory before push.** "Tests pass" is not a substitute.
- **No amend.** Fixes add commits; the audit trail matters.
- **Worker never pushes, never closes, never claims, never writes the
  tracker.** You own all four.
- **User sign-off mid-process → split at the gate.** Present between stages;
  no agent chain pauses for user input.
- `effort=` accepts only `low|medium|high|xhigh|max` — session modes like
  ultracode are NOT effort tiers; never pass them.

## When to skip the loop

Single-file typo, one-line config change, single bad-commit revert, docs
catch-up. Do inline, still run the gate before push, no review cycle.

## When to break mid-flight

Worker blocker contradicting the spec → stop, ask. ROLLBACK → stop,
document. Design wrong mid-implementation → revert, replan.

The loop is a discipline, not a religion. The user is the final reviewer.

## Worker report format (demand it)

```
Work unit: <id>
Files: <path> (created|modified, ±lines) — one per line
Tests: <N> passed, 0 failed; full suite <N> passed
Commit: <sha>
Deviations: <list or "none">
Blockers: <list or "none">
```

Incomplete → ask for reformat, or treat gaps as review findings.
