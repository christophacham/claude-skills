# Active pool — edit when the week turns. Built-in short-names only
# (fable, opus, sonnet, haiku) or a full model ID; passed to Agent(model=) as-is.
# pool:     active tiers. 2+ enables cross-model review; 1 = every unit degraded.
# coder:    optional pin — this tier codes EVERY unit
# reviewer: optional pin — this tier reviews EVERY unit
# Pins must name pool members; a pin outside pool: is a config bug.
# Absent pins: parent agent chooses tiers. Prefer coder ≠ reviewer for independence.
# Include a weak tier (e.g. haiku) if you want cheap mechanical work (beads-*).
# Repo .claude/pool.md overrides this file at load time.
#
# Suggested mechanical roles (not enforced by a skill — parent dispatches):
#   beads-creator, beads-reviewer → haiku
#   coder / reviewer → different pool members when possible

pool: opus, sonnet, haiku
# Leave coder/reviewer unpinned so the parent can choose per task.
# Example pins (must be pool members):
# coder: sonnet
# reviewer: opus
