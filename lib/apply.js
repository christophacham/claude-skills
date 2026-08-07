/**
 * Apply an ApplyPlan to disk + update global manifest when scope is global.
 */
import {
  installSkillToTree,
  removeSkillFromTree,
  installAgents,
  installPool,
  removeAgents,
  removePanelists,
  removePool,
} from './fs-ops.js';
import { TOP_LEVEL_AGENTS, PANELIST_AGENTS, STALE_AGENT_FILES } from './catalog.js';
import { recordGlobalInstall, loadManifest, saveManifest } from './manifest.js';
import { ensureSkillDeps } from './deps.js';
import { planIsEmpty, crossScopeBlockReason } from './desired.js';
import { scanAllInstalled, isInstalledOtherScope } from './scan.js';

/**
 * @typedef {import('./desired.js').ApplyPlan} ApplyPlan
 * @typedef {import('./desired.js').DesiredState} DesiredState
 * @typedef {import('./desired.js').SkillOp} SkillOp
 */

/**
 * @param {ApplyPlan} plan
 * @param {DesiredState} state
 * @returns {{
 *   installed: string[],
 *   removed: string[],
 *   blocked: string[],
 *   agents?: { agents: string[], panelists: string[], mode: string },
 *   pool?: boolean,
 *   depLines: string[],
 *   errors: string[],
 * }}
 */
export function applyPlan(plan, state) {
  /** @type {string[]} */
  const installed = [];
  /** @type {string[]} */
  const removed = [];
  /** @type {string[]} */
  const blocked = [];
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const depLines = [];

  if (planIsEmpty(plan) && !plan.needAgents && !plan.needPool) {
    return {
      installed,
      removed,
      blocked: (plan.blocked || []).map((b) => b.reason),
      depLines,
      errors,
    };
  }

  // Live re-scan so we never write a duplicate across scopes even if UI was stale.
  const liveInstalled = scanAllInstalled(state.projectRoot);

  // Removals first (agents tree before claude when both), then installs (claude before agents).
  const removes = plan.skillOps.filter((o) => o.op === 'remove');
  const installs = plan.skillOps.filter((o) => o.op === 'install');

  removes.sort((a, b) => {
    // agents before claude
    if (a.tree !== b.tree) return a.tree === 'agents' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  installs.sort((a, b) => {
    // claude before agents
    if (a.tree !== b.tree) return a.tree === 'claude' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  for (const op of removes) {
    try {
      const ok = removeSkillFromTree(
        op.id,
        op.tree,
        op.scope,
        op.scope === 'project' ? state.projectRoot : undefined,
      );
      if (ok) removed.push(`${op.id}@${op.tree}`);
    } catch (e) {
      errors.push(`remove ${op.id}@${op.tree}: ${e.message}`);
    }
  }

  /** @type {string[]} */
  const installedIdsForDeps = [];

  for (const op of installs) {
    if (isInstalledOtherScope(liveInstalled, op.id, op.scope)) {
      const msg = crossScopeBlockReason(op.scope, op.id);
      // Intentional policy guard — not an apply failure.
      if (!blocked.includes(msg)) blocked.push(msg);
      continue;
    }
    try {
      installSkillToTree(
        op.id,
        op.tree,
        op.scope,
        op.scope === 'project' ? state.projectRoot : undefined,
      );
      installed.push(`${op.id}@${op.tree}`);
      if (op.tree === 'claude') installedIdsForDeps.push(op.id);
    } catch (e) {
      errors.push(`install ${op.id}@${op.tree}: ${e.message}`);
    }
  }

  // Surface planner-blocked items too (selected but never scheduled).
  for (const b of plan.blocked || []) {
    if (!blocked.includes(b.reason)) blocked.push(b.reason);
  }

  let agentsResult;
  let poolResult;

  const projectRoot = state.scope === 'project' ? state.projectRoot : undefined;

  if (plan.needAgents) {
    try {
      agentsResult = installAgents(state.scope, projectRoot);
    } catch (e) {
      errors.push(`agents: ${e.message}`);
    }
  } else if (plan.removeAgentsIfOrphan) {
    try {
      removeAgents(
        [...TOP_LEVEL_AGENTS, ...STALE_AGENT_FILES],
        state.scope,
        projectRoot,
      );
      removePanelists(PANELIST_AGENTS, state.scope, projectRoot);
    } catch (e) {
      errors.push(`remove agents: ${e.message}`);
    }
  }

  if (plan.needPool) {
    try {
      poolResult = installPool(state.scope, projectRoot);
    } catch (e) {
      errors.push(`pool: ${e.message}`);
    }
  } else if (plan.removeAgentsIfOrphan) {
    try {
      removePool(state.scope, projectRoot);
    } catch (e) {
      errors.push(`remove pool: ${e.message}`);
    }
  }

  // Manifest: only global scope
  if (state.scope === 'global') {
    updateGlobalManifest({
      installedIds: [...new Set(installedIdsForDeps)],
      removedIds: [
        ...new Set(
          removes.filter((o) => o.tree === 'claude').map((o) => o.id),
        ),
      ],
      agents: agentsResult,
      pool: poolResult,
      removeAgents: plan.removeAgentsIfOrphan,
    });
  }

  if (!state.skipDeps && installedIdsForDeps.length) {
    try {
      const lines = ensureSkillDeps(installedIdsForDeps, state.scope, projectRoot);
      depLines.push(...lines);
    } catch (e) {
      depLines.push(`deps warn: ${e.message}`);
    }
  }

  return {
    installed,
    removed,
    blocked,
    agents: agentsResult,
    pool: poolResult,
    depLines,
    errors,
  };
}

/**
 * @param {{
 *   installedIds: string[],
 *   removedIds: string[],
 *   agents?: { agents: string[], panelists: string[] },
 *   pool?: boolean,
 *   removeAgents?: boolean,
 * }} delta
 */
function updateGlobalManifest(delta) {
  if (delta.installedIds.length || delta.agents || delta.pool) {
    recordGlobalInstall({
      skills: delta.installedIds,
      agents: delta.agents?.agents,
      panelists: delta.agents?.panelists,
      pool: delta.pool,
    });
  }
  if (delta.removedIds.length || delta.removeAgents) {
    const m = loadManifest();
    if (delta.removedIds.length) {
      const drop = new Set(delta.removedIds);
      m.skills = m.skills.filter((id) => !drop.has(id));
    }
    if (delta.removeAgents) {
      m.agents = [];
      m.panelists = [];
      m.pool = false;
    }
    saveManifest(m);
  }
}
