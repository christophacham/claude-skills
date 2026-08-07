import { homedir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Package root (repo root when developing; package root when published). */
export const PKG_ROOT = resolve(__dirname, '..');
export const SKILLS_SRC = join(PKG_ROOT, 'skills');
export const AGENTS_SRC = join(PKG_ROOT, 'agents');
export const POOL_SRC = join(PKG_ROOT, 'pool.md');

/**
 * Install scope: project (default) or global user home.
 * @typedef {'project'|'global'} Scope
 */

/**
 * Skill tree roots we manage.
 * - claude: <root>/.claude/skills  (default / always primary)
 * - agents: <root>/.agents/skills  (opt-in portable mirror)
 * @typedef {'claude'|'agents'} SkillTree
 */

export function userClaudeDir() {
  return join(homedir(), '.claude');
}

export function userAgentsDir() {
  return join(homedir(), '.agents');
}

export function userSettingsPath() {
  return join(userClaudeDir(), 'settings.json');
}

/** Manifest of global installs performed by this Node CLI only. */
export function globalManifestPath() {
  return join(userClaudeDir(), 'claude-skills-manifest.json');
}

/**
 * Resolve project root for project-local installs.
 * @param {string | undefined} projectPath relative or absolute; default cwd
 */
export function resolveProjectRoot(projectPath) {
  const base = projectPath && String(projectPath).trim() ? projectPath : process.cwd();
  const abs = isAbsolute(base) ? base : resolve(process.cwd(), base);
  if (!existsSync(abs)) {
    throw new Error(`Project path does not exist: ${abs}`);
  }
  return abs;
}

/**
 * Root for a given skill tree + scope.
 * @param {SkillTree} tree
 * @param {Scope} scope
 * @param {string} [projectRoot]
 */
export function treeRoot(tree, scope, projectRoot) {
  if (tree === 'claude') {
    if (scope === 'global') return userClaudeDir();
    return join(projectRoot, '.claude');
  }
  if (tree === 'agents') {
    if (scope === 'global') return userAgentsDir();
    return join(projectRoot, '.agents');
  }
  throw new Error(`Unknown skill tree: ${tree}`);
}

/**
 * @param {Scope} scope
 * @param {string} [projectRoot]
 * @deprecated Prefer treeRoot('claude', ...) — kept for existing callers.
 */
export function claudeDir(scope, projectRoot) {
  return treeRoot('claude', scope, projectRoot);
}

/**
 * Skills destination under a tree.
 * @param {SkillTree} tree
 * @param {Scope} scope
 * @param {string} [projectRoot]
 */
export function skillsDestForTree(tree, scope, projectRoot) {
  return join(treeRoot(tree, scope, projectRoot), 'skills');
}

/**
 * Default Claude skills dest (backward-compatible).
 * @param {Scope} scope
 * @param {string} [projectRoot]
 */
export function skillsDest(scope, projectRoot) {
  return skillsDestForTree('claude', scope, projectRoot);
}

/**
 * Claude Code agents dir (custom subagents), not the .agents skill tree.
 * @param {Scope} scope
 * @param {string} [projectRoot]
 */
export function agentsDest(scope, projectRoot) {
  return join(treeRoot('claude', scope, projectRoot), 'agents');
}

/**
 * @param {Scope} scope
 * @param {string} [projectRoot]
 */
export function poolDest(scope, projectRoot) {
  return join(treeRoot('claude', scope, projectRoot), 'pool.md');
}

/**
 * Human-readable label for a scope+tree pair.
 * @param {Scope} scope
 * @param {SkillTree} tree
 * @param {string} [projectRoot]
 */
export function destLabel(scope, tree, projectRoot) {
  const root = treeRoot(tree, scope, projectRoot);
  return `${root}/skills`;
}
