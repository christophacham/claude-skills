# Advisory model-routing preferences for parent agents.
# This file does not enforce or validate routing, and agents work without it.
# Values may use built-in short names (fable, opus, sonnet, haiku) or full model IDs.
#
# pool: preferred tiers available for ordinary dispatch decisions.
# coder / reviewer: optional role preferences a parent may honor when appropriate.
# Pins are optional preferences, not correctness constraints or an allowlist.
# Same-model review remains valid because independence comes from fresh context and
# evidence-based review. Different models can add diversity when available.
# A project `.claude/pool.md` may provide project-specific preferences.
#
# Common advisory choices:
#   coder, reviewer, panelists -> tiers suited to task difficulty; different tiers when useful

pool: opus, sonnet, haiku
# Leave coder/reviewer unpinned so the parent can choose per task.
# Example preferences:
# coder: sonnet
# reviewer: opus
