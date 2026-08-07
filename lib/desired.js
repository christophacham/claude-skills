/**
 * Desired-state model for the interactive wizard.
 *
 * Pending changes are computed by comparing desired skill set under the
 * active scope/targets against a disk scan of currently installed skills.
 * Pure module — no I/O, no prompts.
 */
import { allSkillIds, defaultSelectedSkillIds, SKILLS_NEEDING_AGENTS, SKILLS_NEEDING_POOL } from './catalog.js';
import { isInstalled, isInstalledOtherScope, otherScope, otherScopePlacements } from './scan.js';

/**
 * @typedef {'project'|'global'} Scope
 * @typedef {'claude'|'agents'} SkillTree
 * @typedef {import('./scan.js').InstalledSkill} InstalledSkill
 *
 * @typedef {{
 *   scope: Scope,
 *   trees: SkillTree[],
 *   selected: Set<string>,
 *   projectRoot: string,
 *   skipDeps: boolean,
 * }} DesiredState
 *
 * @typedef {{
 *   op: 'install'|'remove',
 *   id: string,
 *   scope: Scope,
 *   tree: SkillTree,
 * }} SkillOp
 *
 * @typedef {{
 *   id: string,
 *   activeScope: Scope,
 *   otherScope: Scope,
 *   trees: SkillTree[],
 *   paths: string[],
 *   reason: string,
 * }} BlockedInstall
 *
 * @typedef {{
 *   skillOps: SkillOp[],
 *   blocked: BlockedInstall[],
 *   needAgents: boolean,
 *   needPool: boolean,
 *   removeAgentsIfOrphan: boolean,
 * }} ApplyPlan
 */

/**
 * @param {{
 *   projectRoot: string,
 *   scope?: Scope,
 *   trees?: SkillTree[],
 *   selected?: Iterable<string>,
 *   skipDeps?: boolean,
 *   seedFromInstalled?: InstalledSkill[],
 *   seedDefaults?: boolean,
 * }} opts
 * @returns {DesiredState}
 */
export function createDesiredState(opts) {
  const scope = opts.scope || 'project';
  const trees = normalizeTrees(opts.trees || ['claude']);
  /** @type {Set<string>} */
  let selected;
  if (opts.selected) {
    selected = new Set([...opts.selected].filter((id) => allSkillIds().includes(id)));
  } else if (opts.seedFromInstalled) {
    selected = new Set(
      opts.seedFromInstalled
        .filter((x) => x.scope === scope && trees.includes(x.tree))
        .map((x) => x.id),
    );
  } else if (opts.seedDefaults) {
    selected = new Set(defaultSelectedSkillIds());
  } else {
    selected = new Set();
  }
  return {
    scope,
    trees,
    selected,
    projectRoot: opts.projectRoot,
    skipDeps: Boolean(opts.skipDeps),
  };
}

/**
 * @param {SkillTree[]|undefined} trees
 * @returns {SkillTree[]}
 */
export function normalizeTrees(trees) {
  const set = new Set(trees && trees.length ? trees : ['claude']);
  // claude is always primary when any tree is active
  if (set.has('agents') && !set.has('claude')) set.add('claude');
  /** @type {SkillTree[]} */
  const ordered = [];
  if (set.has('claude')) ordered.push('claude');
  if (set.has('agents')) ordered.push('agents');
  return ordered;
}

/**
 * @param {DesiredState} state
 * @param {string} id
 * @param {boolean} on
 */
export function setSelected(state, id, on) {
  if (!allSkillIds().includes(id)) return state;
  if (on) state.selected.add(id);
  else state.selected.delete(id);
  return state;
}

/**
 * @param {DesiredState} state
 * @param {string} id
 */
export function toggleSelected(state, id) {
  if (state.selected.has(id)) state.selected.delete(id);
  else if (allSkillIds().includes(id)) state.selected.add(id);
  return state;
}

/**
 * @param {DesiredState} state
 * @param {Iterable<string>} ids
 * @param {boolean} on
 */
export function setManySelected(state, ids, on) {
  for (const id of ids) setSelected(state, id, on);
  return state;
}

/**
 * @param {DesiredState} state
 * @param {Scope} scope
 * @param {InstalledSkill[]} installed
 * @param {{ resyncSelected?: boolean }} [opts]
 */
export function setScope(state, scope, installed, opts = {}) {
  state.scope = scope;
  if (opts.resyncSelected) {
    state.selected = new Set(
      installed
        .filter((x) => x.scope === scope && state.trees.includes(x.tree))
        .map((x) => x.id),
    );
  }
  return state;
}

/**
 * @param {DesiredState} state
 * @param {SkillTree[]} trees
 */
export function setTrees(state, trees) {
  state.trees = normalizeTrees(trees);
  return state;
}

/**
 * Human reason when a skill is already present in the other scope.
 * @param {Scope} activeScope
 * @param {string} id
 */
export function crossScopeBlockReason(activeScope, id) {
  if (activeScope === 'project') {
    return (
      `${id} is already installed globally — project install blocked. ` +
      `Switch Scope to Global to manage it, or uninstall the global copy first.`
    );
  }
  return (
    `${id} is already installed in this project — global install blocked. ` +
    `Switch Scope to Project to manage it, or remove the project copy first.`
  );
}

/**
 * Diff desired selection against disk for the active scope + trees.
 * Installs are blocked (not scheduled) when the same skill id already exists
 * in the opposite scope (global ↔ project), by name.
 *
 * @param {DesiredState} state
 * @param {InstalledSkill[]} installed
 * @param {{ agentsPresent?: boolean, poolPresent?: boolean }} [extras]
 * @returns {ApplyPlan}
 */
export function planChanges(state, installed, extras = {}) {
  /** @type {SkillOp[]} */
  const skillOps = [];
  /** @type {Map<string, BlockedInstall>} */
  const blockedMap = new Map();
  const known = allSkillIds();

  for (const id of known) {
    const want = state.selected.has(id);
    const cross = isInstalledOtherScope(installed, id, state.scope);

    for (const tree of state.trees) {
      const have = isInstalled(installed, id, state.scope, tree);
      if (want && !have) {
        if (cross) {
          if (!blockedMap.has(id)) {
            const places = otherScopePlacements(installed, id, state.scope);
            blockedMap.set(id, {
              id,
              activeScope: state.scope,
              otherScope: otherScope(state.scope),
              trees: [...new Set(places.map((p) => p.tree))],
              paths: places.map((p) => p.path),
              reason: crossScopeBlockReason(state.scope, id),
            });
          }
          // do not schedule install
        } else {
          skillOps.push({ op: 'install', id, scope: state.scope, tree });
        }
      } else if (!want && have) {
        skillOps.push({ op: 'remove', id, scope: state.scope, tree });
      }
    }
  }

  // Disabling a tree schedules removal of catalog skills under that tree for active scope.
  const allTrees = /** @type {import('./paths.js').SkillTree[]} */ (['claude', 'agents']);
  for (const tree of allTrees) {
    if (state.trees.includes(tree)) continue;
    for (const id of known) {
      if (isInstalled(installed, id, state.scope, tree)) {
        skillOps.push({ op: 'remove', id, scope: state.scope, tree });
      }
    }
  }

  const selectedList = [...state.selected];
  const wantAgents = selectedList.some((id) => SKILLS_NEEDING_AGENTS.has(id));
  const wantPool = selectedList.some((id) => SKILLS_NEEDING_POOL.has(id));
  // Only schedule ensure when missing (avoids perpetual "pending" after apply).
  const needAgents = wantAgents && extras.agentsPresent !== true;
  const needPool = wantPool && extras.poolPresent !== true;
  // If beads is being removed and no remaining selected skill needs agents, drop agents/pool.
  const removingBeads =
    !state.selected.has('beads') &&
    installed.some((x) => x.id === 'beads' && x.scope === state.scope);

  return {
    skillOps,
    blocked: [...blockedMap.values()].sort((a, b) => a.id.localeCompare(b.id)),
    needAgents,
    needPool,
    removeAgentsIfOrphan: removingBeads && !wantAgents,
  };
}

/**
 * @param {ApplyPlan} plan
 */
export function planIsEmpty(plan) {
  return (
    plan.skillOps.length === 0 &&
    !plan.needAgents &&
    !plan.needPool &&
    !plan.removeAgentsIfOrphan
  );
}

/**
 * True when there is nothing writable and no cross-scope blocks to surface.
 * @param {ApplyPlan} plan
 */
export function planHasNoWork(plan) {
  return planIsEmpty(plan) && (!plan.blocked || plan.blocked.length === 0);
}

/**
 * Human summary lines for status pane.
 * @param {ApplyPlan} plan
 */
export function summarizePlan(plan) {
  const installs = plan.skillOps.filter((o) => o.op === 'install');
  const removes = plan.skillOps.filter((o) => o.op === 'remove');
  /** @type {string[]} */
  const lines = [];
  if (installs.length) {
    lines.push(
      `install (${installs.length}): ` +
        installs.map((o) => `${o.id}@${o.tree}`).join(', '),
    );
  }
  if (removes.length) {
    lines.push(
      `remove  (${removes.length}): ` +
        removes.map((o) => `${o.id}@${o.tree}`).join(', '),
    );
  }
  if (plan.blocked?.length) {
    lines.push(
      `blocked (${plan.blocked.length}): ` +
        plan.blocked
          .map((b) => `${b.id} (already ${b.otherScope})`)
          .join(', '),
    );
  }
  if (plan.needAgents) lines.push('agents:  ensure roster under .claude/agents');
  if (plan.needPool) lines.push('pool:    ensure pool.md');
  if (plan.removeAgentsIfOrphan) lines.push('agents:  remove roster (beads unselected)');
  if (!lines.length) lines.push('(no pending changes)');
  return lines;
}

/**
 * Count pending skill ops.
 * @param {ApplyPlan} plan
 */
export function planCounts(plan) {
  return {
    install: plan.skillOps.filter((o) => o.op === 'install').length,
    remove: plan.skillOps.filter((o) => o.op === 'remove').length,
  };
}
