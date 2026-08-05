---
name: work-plan
description: Design and decompose work before it ships — sized design panel, short claimable beads (AC + seam + deps), Drop-Test prep refactors, optional provenance stamp. Use before non-trivial change ("plan X"), epic design check, or empty/stale design mid-loop (Flow C). Not for implementation (work-loop), one-line fixes, or architecture Q&A (architecture-design).
argument-hint: [feature-or-unit]
shell: bash
---

# work-plan — short plans, good seams

You plan so coders ship **good code**, not so the tracker fills with essays.
Independent panelists propose; you **compress** into a small graph of short
units. Execution is `work-loop`.

**Overlay:** repo `.claude/skills/*plan*/SKILL.md` (not named `work-plan`)
wins — stop and follow it.

**Noise rule:** a leaf bead must be readable in ~30 seconds. If a field does
not help the coder change the right code and know it works, **omit it**.

## State at load (injected — read it, don't re-run it)

!`cat "${CLAUDE_PROJECT_DIR}/.claude/pool.md" 2>/dev/null || cat ~/.claude/pool.md 2>/dev/null || echo "(no pool.md — panel tiers fall back to inherit)"`

### Tree state
!`git status --short --branch 2>/dev/null || echo "(not a git repo)"`

### Map trust
!`bash "${CLAUDE_SKILL_DIR}/scripts/map-drift-check.sh" 2>/dev/null || printf '%s\n' 'MAP_TRUST' 'mapPresent: false' 'claimsChecked: []' 'verdict: full-scan' 'notes: bundled map-drift script unavailable; panelists full-scan'`

Honor `MAP_TRUST` in panel packets (fail open: never invent `trust-map`).
`trust-map` → map then deep-read touch modules only; `partial` → re-check
implicated; `full-scan` / missing → live tree.

## Conventions

From `CLAUDE.md`: non-negotiables, optional map generator (refresh first if
present), tracker (bd / gh / Linear / markdown). Map refresh commit only when
you own commits.

## Panel (scan only — do not paste into beads)

| Lens | Aim | Skills |
|---|---|---|
| **deep-module** | One owner, small surface, real depth | `simple-design` |
| **minimal-diff** | Fewest honest touch points | `refactoring` |
| **seam** | One place for the change without ripple | `refactoring` (+ `architecture-design` if cross-layer) |

Panelists scan live code. You never invent prep they did not propose.

| Scope | Size |
|---|---|
| Trivial / Flow C unit | **1** |
| Feature (Flow A) | **2** (minimal-diff + deep-module, or seam if coupling) |
| Epic / program (Flow B) | **3** (or 2 if sub-epics already planned) |

**Packet:** scope + AC intent · known paths · sibling ownership · MAP_TRUST ·
lens · "what prep collapses shotgun surgery into one touch?"

**Judge compresses.** Panel essays, risks, cross-notes stay out of beads.
Keep only: one place, touch list, AC, prep that passes Drop Test, deps.

Tie-break: smaller honest touch list unless ownership is leaked.

## What goes on a bead (tiered — less is better)

### Leaf implement (default)

```text
title:      one-line outcome
acceptance: 2–5 testable bullets (include how you know — command/test/scenario)
design:     One place: <path>
            Touch: <≤5 paths>
            (optional one-line constraint if non-obvious)
deps:       only real blockers
```

**Do not file** a separate description that restates AC/design. Empty
description is fine. No phase labels, size labels, or proof sections required
when AC already says how to verify.

### Leaf bug / trivial

```text
title + acceptance only
```

Design only if the seam is non-obvious.

### Prep refactor (good — first-class)

Drop Test: *would we merge this if the feature died tomorrow?*

- **Pass + real structure work** → own unit:

```text
title:      Refactor: <structural outcome>
acceptance: standalone structural bullets (zero feature talk)
design:     where: <path:symbol>
            change: <Extract/Move/Inline/…>
```

- **Fail** → one line under implement design, or discard. Never a bead.
- Micro (≤2 files) may stay inside implement as `refactor:` commits — no bead.

No Cleanup siblings from planning. Ever.

### Epic

```text
title + short design (≤~40 lines):
  intent (2–3 lines)
  ownership / theOnePlace
  child sequence (or "see children")
  non-goals
  doc: <path>   ← long freezes (wire, ABI, schema) live in repo docs, not here
```

Do **not** append review-amendment novels to the epic. Update the doc or a
one-line note. Done-when = children closed (optional AC bullet).

## Present for approval (Flows A/B) — table, not a design doc

```text
| title | AC (one line) | touch | deps | notes |
```

Plus epic blurb if any. **Nothing filed until approve / edit / abort.**

On approve: file **only** the fields above. Stamp `designed` if the tracker
uses it (audit only — **content** is the claim gate). Prefer AC that embeds
proof over a parallel proof field.

## Flows

**A — new feature:** panel → compress graph → present table → gate → file.

**B — epic check:** same; closed children never get retro designs; child epics
plan first; program epics = boundaries + sequence, not every leaf.

**C — unit mid-loop (no user gate):** panel of 1 → write short design+AC if
missing → file real prep only → return. Handshake: claimable content present.

## Second pass

Shape disagreement only → one re-panel. Then escalate to user.

## Never

- Implement, claim, push, close units.
- File prep that fails Drop Test.
- Invent prep panelists did not propose.
- Paste panel output or research essays into description/design.
- Pre-file Cleanup or "pending seed" shells.
- Dual-write the same facts into description + design + AC.

## Handoff

Order: prep leaves first, then implement. Suggest first ready leaf. Go to
`work-loop` on go-ahead. Goal remains **good code at the seam**, not a dense
tracker.
