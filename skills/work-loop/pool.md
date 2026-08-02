# Active pool — edit when the week turns. Built-in short-names only
# (fable, opus, sonnet, haiku) or a full model ID; passed to Agent(model=) as-is.
# pool:     active tiers. 2+ enables cross-model review; 1 = every unit degraded.
# coder:    optional pin — this tier codes EVERY unit
# reviewer: optional pin — this tier reviews EVERY unit
# beads:    optional pin — this tier runs all tracker mutations
# Pins must name pool members; absent pins resolve by unit class (see SKILL.md).

pool: opus, sonnet
