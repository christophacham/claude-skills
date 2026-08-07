import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { globalManifestPath, userClaudeDir } from './paths.js';

/**
 * @typedef {{
 *   version: 1,
 *   updatedAt: string,
 *   skills: string[],
 *   agents: string[],
 *   panelists: string[],
 * }} Manifest
 */

/** @returns {Manifest} */
export function emptyManifest() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    skills: [],
    agents: [],
    panelists: [],
  };
}

/** @returns {Manifest} */
export function loadManifest() {
  const path = globalManifestPath();
  if (!existsSync(path)) return emptyManifest();
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return {
      version: 1,
      updatedAt: data.updatedAt || new Date().toISOString(),
      skills: Array.isArray(data.skills) ? [...new Set(data.skills.map(String))] : [],
      agents: Array.isArray(data.agents) ? [...new Set(data.agents.map(String))] : [],
      panelists: Array.isArray(data.panelists)
        ? [...new Set(data.panelists.map(String))]
        : [],
    };
  } catch {
    return emptyManifest();
  }
}

/** @param {Manifest} m */
export function saveManifest(m) {
  mkdirSync(userClaudeDir(), { recursive: true });
  const out = {
    version: 1,
    updatedAt: new Date().toISOString(),
    skills: [...new Set(m.skills)].sort(),
    agents: [...new Set(m.agents)].sort(),
    panelists: [...new Set(m.panelists)].sort(),
  };
  writeFileSync(globalManifestPath(), JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

/**
 * Merge newly installed global items into the manifest.
 * @param {{ skills?: string[], agents?: string[], panelists?: string[] }} delta
 */
export function recordGlobalInstall(delta) {
  const m = loadManifest();
  if (delta.skills?.length) m.skills = [...new Set([...m.skills, ...delta.skills])];
  if (delta.agents?.length) m.agents = [...new Set([...m.agents, ...delta.agents])];
  if (delta.panelists?.length) {
    m.panelists = [...new Set([...m.panelists, ...delta.panelists])];
  }
  return saveManifest(m);
}

/** Clear the global manifest after a full uninstall of tracked items. */
export function clearManifest() {
  const path = globalManifestPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function manifestHasAnything(m = loadManifest()) {
  return m.skills.length > 0 || m.agents.length > 0 || m.panelists.length > 0;
}
