# Active pool — edit when the week turns. Built-in short-names only
# (fable, opus, sonnet, haiku) or a full model ID; passed to Agent(model=) as-is.
# pool:     active tiers. 2+ enables cross-model review; 1 = every unit degraded.
# coder:    optional pin — this tier codes EVERY unit
# reviewer: optional pin — this tier reviews EVERY unit
# beads:    optional pin — this tier runs all tracker mutations
# Pins must name pool members; a pin outside pool: is a config bug (loop fails loudly).
# Absent pins resolve by unit class (see work-loop SKILL.md):
#   hardest → strongest; large mechanical → second-strongest; standard → middle;
#   structural Cleanup → middle; trivial / dead-code-only Cleanup → weakest;
#   reviewer → strongest ≠ coder; free-close Cleanup skips agents entirely.
# Include a weak tier (e.g. haiku) if you want cheap trivial/Cleanup coding without
# pins leaving the pool. Repo .claude/pool.md overrides this file at load time.

pool: opus, sonnet, haiku
# Leave coder/reviewer/beads unpinned so class resolution + cross-model review work.
# Example pins (must be pool members):
# coder: sonnet
# reviewer: opus
# beads: haiku
