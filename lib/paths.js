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

export function userClaudeDir() {
  return join(homedir(), '.claude');
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

export function claudeDir(scope, projectRoot) {
  if (scope === 'global') return userClaudeDir();
  return join(projectRoot, '.claude');
}

export function skillsDest(scope, projectRoot) {
  return join(claudeDir(scope, projectRoot), 'skills');
}

export function agentsDest(scope, projectRoot) {
  return join(claudeDir(scope, projectRoot), 'agents');
}

export function poolDest(scope, projectRoot) {
  return join(claudeDir(scope, projectRoot), 'pool.md');
}
