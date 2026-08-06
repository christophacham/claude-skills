import {
  cpSync,
  rmSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import {
  SKILLS_SRC,
  AGENTS_SRC,
  POOL_SRC,
  skillsDest,
  agentsDest,
  poolDest,
  claudeDir,
} from './paths.js';
import {
  TOP_LEVEL_AGENTS,
  PANELIST_AGENTS,
  SKILLS_NEEDING_AGENTS,
  SKILLS_NEEDING_POOL,
} from './catalog.js';

/**
 * @param {string} skillId
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function installSkill(skillId, scope, projectRoot) {
  const src = join(SKILLS_SRC, skillId);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    throw new Error(`Unknown skill in package: ${skillId}`);
  }
  const destRoot = skillsDest(scope, projectRoot);
  const dest = join(destRoot, skillId);
  mkdirSync(destRoot, { recursive: true });
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  return dest;
}

/**
 * @param {string} skillId
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function removeSkill(skillId, scope, projectRoot) {
  const dest = join(skillsDest(scope, projectRoot), skillId);
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
    return true;
  }
  return false;
}

/**
 * Install the standard agent roster (top-level + panelists).
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function installAgents(scope, projectRoot) {
  const dest = agentsDest(scope, projectRoot);
  mkdirSync(dest, { recursive: true });
  const installed = { agents: [], panelists: [] };

  for (const name of TOP_LEVEL_AGENTS) {
    const src = join(AGENTS_SRC, name);
    if (!existsSync(src)) continue;
    cpSync(src, join(dest, name));
    installed.agents.push(name);
  }

  const panelSrc = join(AGENTS_SRC, 'panelists');
  const panelDest = join(dest, 'panelists');
  if (existsSync(panelSrc)) {
    mkdirSync(panelDest, { recursive: true });
    for (const name of PANELIST_AGENTS) {
      const src = join(panelSrc, name);
      if (!existsSync(src)) continue;
      cpSync(src, join(panelDest, name));
      installed.panelists.push(name);
    }
  }
  return installed;
}

/**
 * @param {string[]} agentNames e.g. ['coder.md']
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function removeAgents(agentNames, scope, projectRoot) {
  const dest = agentsDest(scope, projectRoot);
  let n = 0;
  for (const name of agentNames) {
    const p = join(dest, name);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      n++;
    }
  }
  return n;
}

/**
 * @param {string[]} names panelist basenames
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function removePanelists(names, scope, projectRoot) {
  const dest = join(agentsDest(scope, projectRoot), 'panelists');
  let n = 0;
  for (const name of names) {
    const p = join(dest, name);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      n++;
    }
  }
  // drop empty panelists dir
  if (existsSync(dest)) {
    try {
      if (readdirSync(dest).length === 0) rmSync(dest, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  return n;
}

/**
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function installPool(scope, projectRoot) {
  if (!existsSync(POOL_SRC)) return false;
  const dest = poolDest(scope, projectRoot);
  mkdirSync(claudeDir(scope, projectRoot), { recursive: true });
  cpSync(POOL_SRC, dest);
  return true;
}

/**
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function removePool(scope, projectRoot) {
  const dest = poolDest(scope, projectRoot);
  if (existsSync(dest)) {
    rmSync(dest, { force: true });
    return true;
  }
  return false;
}

/**
 * Install a set of skills and auto-attach agents/pool when needed.
 * @param {string[]} skillIds
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 */
export function installSkillsBundle(skillIds, scope, projectRoot) {
  const result = {
    skills: [],
    agents: [],
    panelists: [],
    pool: false,
  };
  for (const id of skillIds) {
    installSkill(id, scope, projectRoot);
    result.skills.push(id);
  }
  const needAgents = skillIds.some((id) => SKILLS_NEEDING_AGENTS.has(id));
  const needPool = skillIds.some((id) => SKILLS_NEEDING_POOL.has(id));
  if (needAgents) {
    const a = installAgents(scope, projectRoot);
    result.agents = a.agents;
    result.panelists = a.panelists;
  }
  if (needPool) {
    result.pool = installPool(scope, projectRoot);
  }
  return result;
}
