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
import { parseSemver } from './release-plan.js';

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
 * Floor pin for recovery messages when the running package version is unreadable
 * or invalid. Bump only when the next major ships (manual).
 */
export const FIRST_RELEASE_TAG = 'v1.0.0';

/** GitHub package specifier without fragment. */
export const GITHUB_PACKAGE = 'github:christophacham/claude-skills';

/**
 * Preferred install pin for user-facing re-run hints.
 * Uses the running package version when valid; otherwise FIRST_RELEASE_TAG.
 * @param {string} [version] optional override (e.g. from formatStaleSuiteMessage opts)
 * @returns {string} e.g. v1.0.0
 */
export function preferredInstallTag(version) {
  const v = version ?? suiteVersion();
  if (v && v !== '0.0.0' && parseSemver(v)) {
    return `v${v}`;
  }
  return FIRST_RELEASE_TAG;
}

/**
 * Read package.json version from the running package root.
 * Successful reads are cached. Failures are not cached so a later call can recover.
 * @returns {string}
 */
export function suiteVersion() {
  if (cachedVersion != null) return cachedVersion;
  try {
    const raw = readFileSync(join(PKG_ROOT, 'package.json'), 'utf8');
    const v = JSON.parse(raw).version;
    if (typeof v === 'string' && v.trim() && parseSemver(v.trim())) {
      cachedVersion = v.trim();
      return cachedVersion;
    }
    console.error(
      'suite-version: package.json version missing or invalid (need X.Y.Z without leading zeros)',
    );
    return '0.0.0';
  } catch (err) {
    const msg = err && typeof err === 'object' && 'message' in err ? err.message : String(err);
    console.error(`suite-version: failed to read package.json version: ${msg}`);
    // Do not cache failures — transient FS issues should not stick for the process life.
    return '0.0.0';
  }
}

/**
 * Git tag for this package's version (`v` + package.json), or FIRST_RELEASE_TAG if unreadable.
 * @returns {string}
 */
export function releaseGitRef() {
  return preferredInstallTag();
}

/**
 * Install specifier with current release pin (for help / outro / TTY errors).
 * @returns {string}
 */
export function installPin() {
  return `${GITHUB_PACKAGE}#${releaseGitRef()}`;
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
  // Prefer a pin derived from the claimed/running version when valid so recovery
  // does not forever point at FIRST_RELEASE_TAG after later patches ship.
  // Stale pre-suite caches often claim 1.0.0 with retired skills — that pin is
  // still the right floor; later good packages claim their real version.
  const pin = preferredInstallTag(version);
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

/** Test-only: clear the successful-read cache. */
export function _resetSuiteVersionCacheForTests() {
  cachedVersion = null;
}
