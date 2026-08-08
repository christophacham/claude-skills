/**
 * Suite version + offline stale-payload detection for github:/bunx installs.
 *
 * Bun/npx often cache a prior resolution of github:…#main by commit SHA.
 * If that SHA is pre-slim, this process still ships retired skills under
 * skills/ — refuse the wizard and print how to re-run a tagged release.
 *
 * Version tags: package.json is source of truth; CI auto-bumps patch on main
 * (see lib/release-plan.js). Major/minor are manual.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKG_ROOT, SKILLS_SRC } from './paths.js';

/** @type {string | null} */
let cachedVersion = null;

/**
 * Skills removed from the suite (must not appear next to a current bin/cli.js).
 * Keep in sync with tests/test_agent_contracts.py removed list.
 */
export const RETIRED_SKILL_IDS = Object.freeze([
  'operating-mode',
  'capability-plan',
  'beads-om',
  'beads',
  'skill-creator',
  'peek-repo',
]);

/**
 * First release tag for the current suite line. Used in stale-payload messages
 * so a cached pre-suite tree still points users at a known-good pin.
 * Bump this constant only when the next major ships (manual).
 */
export const FIRST_RELEASE_TAG = 'v1.0.0';

/** GitHub package specifier without fragment. */
export const GITHUB_PACKAGE = 'github:christophacham/claude-skills';

/**
 * Read package.json version from the running package root.
 * @returns {string}
 */
export function suiteVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const raw = readFileSync(join(PKG_ROOT, 'package.json'), 'utf8');
    const v = JSON.parse(raw).version;
    cachedVersion = typeof v === 'string' && v.trim() ? v.trim() : '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

/**
 * Git tag for this package's version (`v` + package.json).
 * @returns {string}
 */
export function releaseGitRef() {
  return `v${suiteVersion()}`;
}

/**
 * Retired skill dirs still present under the package skills/ tree.
 * Offline, definitive signal that this process is a pre-slim (or otherwise
 * wrong) payload — no network required.
 *
 * @param {string} [skillsSrc]
 * @returns {string[]}
 */
export function findRetiredSkillsPresent(skillsSrc = SKILLS_SRC) {
  const found = [];
  for (const id of RETIRED_SKILL_IDS) {
    if (existsSync(join(skillsSrc, id))) found.push(id);
  }
  return found;
}

/**
 * @param {string} [skillsSrc]
 * @returns {boolean}
 */
export function isStaleSuitePayload(skillsSrc = SKILLS_SRC) {
  return findRetiredSkillsPresent(skillsSrc).length > 0;
}

/**
 * User-facing resync instructions (no side effects).
 * @param {{ retired?: string[], version?: string }} [opts]
 * @returns {string}
 */
export function formatStaleSuiteMessage(opts = {}) {
  const retired = opts.retired ?? findRetiredSkillsPresent();
  const version = opts.version ?? suiteVersion();
  const pin = FIRST_RELEASE_TAG;
  const lines = [
    `claude-skills: stale suite payload (running package claims v${version}).`,
    '',
    'This install still ships skills that were removed from the suite:',
    ...retired.map((id) => `  • ${id}`),
    '',
    'Likely cause: bunx/npx reused a cached github: resolution of an older',
    'commit (branch pins like #main often stick to a prior SHA).',
    '',
    'Re-run a release tag (new cache key — preferred):',
    `  bunx ${GITHUB_PACKAGE}#${pin}`,
    `  npx -y ${GITHUB_PACKAGE}#${pin}`,
    '',
    'Or clear the runner cache once and take tip of main:',
    '  # Bun',
    '  rm -rf ~/.bun/install/cache ~/.bun/install/git /tmp/bunx-*-claude-skills*',
    `  bunx ${GITHUB_PACKAGE}#main`,
    '  # npm / npx',
    '  npm cache clean --force',
    `  npx -y ${GITHUB_PACKAGE}#main`,
    '',
    'This check does not delete caches or change project skills — only refuses',
    'to open the wizard on a known-bad package tree.',
  ];
  return lines.join('\n');
}

/**
 * Exit process if the package tree is a retired pre-slim payload.
 * Call before opening the wizard / apply paths that ship skills from PKG_ROOT.
 *
 * @param {{ skillsSrc?: string, exit?: (code: number) => void, write?: (s: string) => void }} [opts]
 * @returns {boolean} true if ok to continue, false if stale (after writing + exit)
 */
export function assertFreshSuitePayload(opts = {}) {
  const skillsSrc = opts.skillsSrc ?? SKILLS_SRC;
  const write = opts.write ?? ((s) => console.error(s));
  const exit =
    opts.exit ??
    ((code) => {
      process.exit(code);
    });

  const retired = findRetiredSkillsPresent(skillsSrc);
  if (!retired.length) return true;

  write(formatStaleSuiteMessage({ retired }));
  exit(2);
  return false;
}
