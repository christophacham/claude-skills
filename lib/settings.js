import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { userSettingsPath, userClaudeDir } from './paths.js';

function loadSettings() {
  const path = userSettingsPath();
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) {
    throw new Error(`Could not parse ${path}: ${e.message}`);
  }
}

function saveSettings(data) {
  mkdirSync(userClaudeDir(), { recursive: true });
  writeFileSync(userSettingsPath(), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** @param {string[]} names */
export function getEnvKey(names) {
  // process env first
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return { value: String(v).trim(), source: `env ${n}` };
  }
  const data = loadSettings();
  const env = data.env && typeof data.env === 'object' ? data.env : {};
  for (const n of names) {
    const v = env[n];
    if (v && String(v).trim()) {
      return { value: String(v).trim(), source: `settings.json ${n}` };
    }
  }
  return null;
}

export function hasBraveKey() {
  return Boolean(getEnvKey(['BRAVE_API_KEY', 'BRAVE_SEARCH_API_KEY']));
}

export function hasTavilyKey() {
  return Boolean(getEnvKey(['TAVILY_API_KEY']));
}

/** Write a key into ~/.claude/settings.json env — never print the value. */
export function setEnvKey(name, value) {
  const data = loadSettings();
  if (!data.env || typeof data.env !== 'object' || Array.isArray(data.env)) {
    data.env = {};
  }
  data.env[name] = value;
  saveSettings(data);
}

export function settingsPathForDisplay() {
  return userSettingsPath();
}
