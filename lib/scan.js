/**
 * Disk scan of installed suite skills (catalog ids only).
 * Does not invent ownership — only reports presence of known skill dirs.
 */
import { existsSync, readdirSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { allSkillIds } from './catalog.js';
import { skillsDestForTree } from './paths.js';

/**
 * @typedef {'claude'|'agents'} SkillTree
 * @typedef {'project'|'global'} Scope
 * @typedef {{
 *   id: string,
 *   scope: Scope,
 *   tree: SkillTree,
 *   path: string,
 *   kind: 'dir'|'symlink'|'other',
 *   linkTarget?: string
 * }} InstalledSkill
 */

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listDirNames(dir) {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/**
 * @param {string} path
 * @returns {{ kind: 'dir'|'symlink'|'other', linkTarget?: string }}
 */
function pathKind(path) {
  try {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) {
      let linkTarget;
      try {
        linkTarget = readlinkSync(path);
      } catch {
        linkTarget = undefined;
      }
      return { kind: 'symlink', linkTarget };
    }
    if (st.isDirectory()) return { kind: 'dir' };
    return { kind: 'other' };
  } catch {
    return { kind: 'other' };
  }
}

/**
 * Scan one skills directory for catalog skill ids.
 * @param {Scope} scope
 * @param {SkillTree} tree
 * @param {string} [projectRoot]
 * @param {Set<string>} [knownIds]
 * @returns {InstalledSkill[]}
 */
export function scanSkillsDir(scope, tree, projectRoot, knownIds = new Set(allSkillIds())) {
  const dest = skillsDestForTree(tree, scope, projectRoot);
  /** @type {InstalledSkill[]} */
  const out = [];
  for (const name of listDirNames(dest)) {
    if (!knownIds.has(name)) continue;
    const path = join(dest, name);
    const { kind, linkTarget } = pathKind(path);
    out.push({ id: name, scope, tree, path, kind, linkTarget });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Full scan: project + global × claude + agents.
 * @param {string} projectRoot
 * @returns {InstalledSkill[]}
 */
export function scanAllInstalled(projectRoot) {
  const known = new Set(allSkillIds());
  /** @type {InstalledSkill[]} */
  const all = [];
  for (const scope of /** @type {Scope[]} */ (['project', 'global'])) {
    for (const tree of /** @type {SkillTree[]} */ (['claude', 'agents'])) {
      all.push(...scanSkillsDir(scope, tree, projectRoot, known));
    }
  }
  return all;
}

/**
 * Map of skillId → list of placements.
 * @param {InstalledSkill[]} list
 */
export function indexBySkillId(list) {
  /** @type {Map<string, InstalledSkill[]>} */
  const map = new Map();
  for (const item of list) {
    const arr = map.get(item.id) || [];
    arr.push(item);
    map.set(item.id, arr);
  }
  return map;
}

/**
 * True if skill id is present under scope+tree.
 * @param {InstalledSkill[]} list
 * @param {string} id
 * @param {Scope} scope
 * @param {SkillTree} tree
 */
export function isInstalled(list, id, scope, tree) {
  return list.some((x) => x.id === id && x.scope === scope && x.tree === tree);
}

/**
 * Status glyph for a skill under the active scope.
 * @param {InstalledSkill[]} list
 * @param {string} id
 * @param {Scope} scope
 * @param {SkillTree[]} trees active trees (usually ['claude'] or ['claude','agents'])
 */
export function skillStatus(list, id, scope, trees) {
  const present = trees.filter((t) => isInstalled(list, id, scope, t));
  if (present.length === 0) return 'missing';
  if (present.length === trees.length) return 'installed';
  return 'partial';
}

/**
 * Resolve real path if possible (for link diagnostics).
 * @param {string} path
 */
export function tryRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
}
