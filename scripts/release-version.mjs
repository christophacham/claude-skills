#!/usr/bin/env node
/**
 * DIY suite release helper (no external version packages).
 *
 *   node scripts/release-version.mjs plan
 *   node scripts/release-version.mjs plan --github-output
 *   node scripts/release-version.mjs write 2.0.1
 *   node scripts/release-version.mjs list-tags   # debug
 *
 * Pure plan lives in lib/release-plan.js. This CLI reads package.json + git tags.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  planRelease,
  latestReleaseTag,
  parseSemver,
  RELEASE_COMMIT_PREFIX,
} from '../lib/release-plan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PKG_PATH = join(ROOT, 'package.json');
const LOCK_PATH = join(ROOT, 'package-lock.json');

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  return String(pkg.version ?? '');
}

/**
 * List local tags (caller should fetch --tags in CI).
 * @returns {string[]}
 */
function listGitTags() {
  try {
    const out = execFileSync('git', ['tag', '-l', 'v*'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Write package.json version; keep package-lock root version in sync if present.
 * @param {string} version
 */
function writeVersion(version) {
  if (!parseSemver(version)) {
    throw new Error(`write: invalid version ${version} (need X.Y.Z)`);
  }
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));
  pkg.version = version;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

  if (existsSync(LOCK_PATH)) {
    const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
    lock.version = version;
    if (lock.packages && lock.packages['']) {
      lock.packages[''].version = version;
    }
    writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2) + '\n', 'utf8');
  }
}

/**
 * @param {import('../lib/release-plan.js').ReleasePlan} plan
 */
function emitGithubOutput(plan) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) {
    console.error('plan --github-output: GITHUB_OUTPUT not set');
    process.exit(1);
  }
  const lines = [
    `action=${plan.action}`,
    `package_version=${plan.packageVersion}`,
    `latest_tag=${plan.latestTag ?? ''}`,
    `release_version=${plan.releaseVersion ?? ''}`,
    `release_tag=${plan.releaseTag ?? ''}`,
    `reason=${plan.reason.replace(/\r?\n/g, ' ')}`,
  ];
  appendFileSync(path, lines.join('\n') + '\n', 'utf8');
}

function usage() {
  console.log(`release-version — DIY suite tags (no external version libs)

Usage:
  node scripts/release-version.mjs plan [--github-output]
  node scripts/release-version.mjs write <X.Y.Z>
  node scripts/release-version.mjs list-tags

Policy:
  • Manual major/minor: bump package.json in a PR, merge → CI tags as-is
  • Auto patch: each main merge where package == latest tag → patch+1 + tag
  • First release: no tags yet → tag package.json version as-is
  • Release commits use prefix "${RELEASE_COMMIT_PREFIX}" so CI does not re-run
`);
}

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === '-h' || cmd === '--help') {
  usage();
  process.exit(cmd ? 0 : 1);
}

if (cmd === 'list-tags') {
  const tags = listGitTags();
  const latest = latestReleaseTag(tags);
  console.log(JSON.stringify({ tags, latest }, null, 2));
  process.exit(0);
}

if (cmd === 'plan') {
  const packageVersion = readPackageVersion();
  const tags = listGitTags();
  const latestTag = latestReleaseTag(tags);
  const plan = planRelease({ packageVersion, latestTag });
  console.log(JSON.stringify(plan, null, 2));
  if (args.includes('--github-output')) {
    emitGithubOutput(plan);
  }
  process.exit(0);
}

if (cmd === 'write') {
  const version = args[1];
  if (!version) {
    console.error('write: missing version (X.Y.Z)');
    process.exit(1);
  }
  writeVersion(version);
  console.log(JSON.stringify({ wrote: version, package: PKG_PATH }, null, 2));
  process.exit(0);
}

console.error(`unknown command: ${cmd}`);
usage();
process.exit(1);
