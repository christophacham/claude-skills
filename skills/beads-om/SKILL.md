---
name: beads-om
description: "Optional thin Beads companion to operating-mode: one unit ↔ at most one bead, claim at kickoff, park discovered work without doing it, close only after human merge (or explicit ask), never multi-unit from the tracker. Use when a project already has Beads initialized and product work follows operating-mode (kickoff → hands-off unit → PR). Not for full board hygiene, Dolt ops beyond explicit publish, GitHub/Jira/Linear, uninitialized repos, or inventing epic/phase/label workflows. Prefer the full beads skill for general tracker work outside this cadence."
---

# Beads + operating-mode (thin)

Companion to **`operating-mode`**. Operating-mode remains the control plane: human kickoff → hands-off one unit → feature-branch **PR** → human review/merge. Beads is only an optional **queue + memory** around that spine.

Requires an **already initialized** Beads workspace and the `bd` CLI on PATH. Do not run `bd init` unless the user asks.

## Rules

1. **OM is law** — one unit → PR. Beads never authorizes multi-unit loops, mid-unit human pings, or inventing adjacent features.
2. **1 unit ↔ 0..1 bead** — prefer one bead per unit. The delivery proof is the **PR**, not ticket state.
3. **Consent** — kickoff may claim; discovery may create; close and Dolt publish only with explicit ask or a written post-merge project policy. Create ≠ claim ≠ close ≠ `dolt push`.
4. **Discovery parks only** — new beads for adjacent work; never pull them into the current unit.
5. **No invented doctrine** — no phase, epic, mission, size, or label schemes unless the request or project docs supply exact values.
6. **Help before invent** — if workspace or flags are unclear: `bd where`, `bd help`, `bd <cmd> --help`.

## Who may touch the tracker

| Role | Tracker |
|------|---------|
| **main** | May run this thin surface (claim / create / note / dep / close / publish-when-asked) |
| **coder / reviewer / panelists** | **No** tracker mutations |
| Full `beads` skill / beads-creator / beads-reviewer | Only when the user wants general board work beyond OM |

## Minimum `bd` surface

```bash
bd where                              # active workspace; stop if none
bd ready                              # unblocked open work (next unit candidates)
bd show <id>                          # inspect; use --json when scripting
bd list --status=open                 # backlog fallback

bd create --title="…" --description="…" [--type=task] [--priority=2] [--acceptance="…"]
bd update <id> --claim                # assignee + in_progress

bd note <id> "…"                      # optional short note; not a PR substitute
bd dep add <later> <current>          # optional: later depends on current

bd close <id> --reason="…"            # post-merge or explicit ask only

# publish only when the user authorizes Beads sync/publish:
bd vc status
bd dolt commit -m "…"                 # if pending and needed
bd dolt push
```

Priorities are **0–4** (`0` highest). CLI default priority is `2`. Do not invent acceptance, design, labels, parents, or deps the request did not supply.

## Lifecycle map

| OM moment | Beads action |
|-----------|----------------|
| Human kickoff unit | Claim existing bead, or create + claim if the unit is new |
| Principle gap / design×3 / implement / gates | **None** |
| Discover adjacent work | `bd create` (park); optional `dep add` if sequencing is explicit |
| Open/update PR | **None** (optional `note` with PR URL) |
| Human merge + understand | `close` only if authorized or post-merge policy says so |
| Next unit | Human kickoff or `bd ready` — still **one** unit |

## Explicitly out of scope

- Mid-unit status theater, auto-close on PR open, `--claim-next` multi-unit chains
- Epic / swarm / formula / gate / lint / stale / orphans / duplicates workflows
- JSONL import/export as sync, force-push, destructive reinit, source `git` ops because beads changed
- Replacing `operating-mode` or treating beads as the product pipeline

If the user needs full tracker ops (labels, audits, complex deps, Dolt recovery), load **`beads`** (or dispatch beads agents) instead of stretching this skill.
