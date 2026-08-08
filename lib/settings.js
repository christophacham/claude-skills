import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { userSettingsPath } from './paths.js';

/**
 * Optional absolute path override for tests (isolates from host ~/.claude).
 * Production code never sets this.
 * @type {string|null}
 */
let settingsPathOverride = null;

/**
 * Test-only: point load/save at an isolated settings.json path.
 * Pass null to restore the real user path.
 * @param {string|null} path
 */
export function setSettingsPathForTests(path) {
  settingsPathOverride = path || null;
}

function resolvedSettingsPath() {
  return settingsPathOverride || userSettingsPath();
}

function loadSettings() {
  const path = resolvedSettingsPath();
  if (!existsSync(path)) return {};
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) {
    throw new Error(`Could not parse ${path}: ${e.message}`);
  }
}

function saveSettings(data) {
  const path = resolvedSettingsPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
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

/**
 * DefectDojo API token for installer chrome / Apply prompts.
 * Only DEFECTDOJO_API_TOKEN — not bare API_TOKEN (shared name; would false-positive
 * "set" when another tool owns API_TOKEN). Runtime skill still accepts API_TOKEN.
 */
export function hasDefectDojoToken() {
  return Boolean(getEnvKey(['DEFECTDOJO_API_TOKEN']));
}

/** Base URL via DEFECTDOJO_URL or host via DEFECTDOJO_HOST. */
export function hasDefectDojoUrl() {
  return Boolean(getEnvKey(['DEFECTDOJO_URL', 'DEFECTDOJO_HOST']));
}

/** True when both URL (or host) and token are available. */
export function hasDefectDojoConfig() {
  return hasDefectDojoUrl() && hasDefectDojoToken();
}

/**
 * Compact status for menu chrome.
 * @returns {'ok'|'partial'|'missing'}
 */
export function defectDojoConfigStatus() {
  const url = hasDefectDojoUrl();
  const tok = hasDefectDojoToken();
  if (url && tok) return 'ok';
  if (url || tok) return 'partial';
  return 'missing';
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
  return resolvedSettingsPath();
}
