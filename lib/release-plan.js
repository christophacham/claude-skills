/**
 * Pure release planner for github: installs (no external version libs).
 *
 * Policy:
 *   - Major / minor: human bumps package.json in a PR.
 *   - Patch: on each merge to main, if package.json already matches the
 *     latest vX.Y.Z tag, bump patch by 1 and tag. If package is ahead of
 *     the latest tag (manual bump), only create that tag. If no tags yet,
 *     tag package.json as-is (first release).
 *
 * Loop safety is the caller's job: release commits must use a message
 * prefix that the workflow skips (see RELEASE_COMMIT_PREFIX).
 */

/** Commit subject prefix for automated release commits — workflow must skip these. */
export const RELEASE_COMMIT_PREFIX = 'chore(release):';

/** Escape hatch substring in commit message — workflow skips versioning. */
export const SKIP_VERSION_TOKEN = '[skip version]';

/**
 * @typedef {{ major: number, minor: number, patch: number }} Semver
 * @typedef {{
 *   action: 'none' | 'tag_only' | 'bump_and_tag',
 *   packageVersion: string,
 *   latestTag: string | null,
 *   releaseVersion: string | null,
 *   releaseTag: string | null,
 *   reason: string,
 * }} ReleasePlan
 */

/**
 * Parse strict X.Y.Z (no prerelease / build).
 * @param {string} v
 * @returns {Semver | null}
 */
export function parseSemver(v) {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

/**
 * @param {Semver} s
 * @returns {string}
 */
export function formatSemver(s) {
  return `${s.major}.${s.minor}.${s.patch}`;
}

/**
 * @param {string | Semver} a
 * @param {string | Semver} b
 * @returns {-1 | 0 | 1}
 */
export function compareSemver(a, b) {
  const pa = typeof a === 'string' ? parseSemver(a) : a;
  const pb = typeof b === 'string' ? parseSemver(b) : b;
  if (!pa || !pb) {
    throw new Error(`compareSemver: invalid input ${JSON.stringify({ a, b })}`);
  }
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}

/**
 * @param {string} version
 * @returns {string}
 */
export function bumpPatch(version) {
  const p = parseSemver(version);
  if (!p) throw new Error(`bumpPatch: invalid version ${version}`);
  return formatSemver({ major: p.major, minor: p.minor, patch: p.patch + 1 });
}

/**
 * @param {string} tag  e.g. v2.0.0
 * @returns {string | null}  e.g. 2.0.0
 */
export function versionFromTag(tag) {
  if (typeof tag !== 'string') return null;
  const t = tag.trim();
  if (!t.startsWith('v')) return null;
  const ver = t.slice(1);
  return parseSemver(ver) ? ver : null;
}

/**
 * @param {string} version  e.g. 2.0.0
 * @returns {string}  e.g. v2.0.0
 */
export function tagFromVersion(version) {
  const p = parseSemver(version);
  if (!p) throw new Error(`tagFromVersion: invalid version ${version}`);
  return `v${formatSemver(p)}`;
}

/**
 * Highest vX.Y.Z among tags; ignores other tag names.
 * @param {string[]} tags
 * @returns {string | null} tag with leading v, or null
 */
export function latestReleaseTag(tags) {
  /** @type {{ tag: string, ver: Semver } | null} */
  let best = null;
  for (const raw of tags) {
    const verStr = versionFromTag(raw);
    if (!verStr) continue;
    const ver = parseSemver(verStr);
    if (!ver) continue;
    if (!best || compareSemver(ver, best.ver) > 0) {
      best = { tag: `v${verStr}`, ver };
    }
  }
  return best ? best.tag : null;
}

/**
 * @param {{ packageVersion: string, latestTag: string | null }} input
 * @returns {ReleasePlan}
 */
export function planRelease(input) {
  const packageVersion = String(input.packageVersion ?? '').trim();
  const latestTag = input.latestTag == null || input.latestTag === ''
    ? null
    : String(input.latestTag).trim();

  const pkg = parseSemver(packageVersion);
  if (!pkg) {
    return {
      action: 'none',
      packageVersion,
      latestTag,
      releaseVersion: null,
      releaseTag: null,
      reason: `invalid package.json version (need X.Y.Z): ${packageVersion}`,
    };
  }

  if (!latestTag) {
    return {
      action: 'tag_only',
      packageVersion,
      latestTag: null,
      releaseVersion: packageVersion,
      releaseTag: tagFromVersion(packageVersion),
      reason: 'no vX.Y.Z tags yet — tag package.json as the first release',
    };
  }

  const latestVer = versionFromTag(latestTag);
  if (!latestVer) {
    return {
      action: 'none',
      packageVersion,
      latestTag,
      releaseVersion: null,
      releaseTag: null,
      reason: `latest tag is not vX.Y.Z: ${latestTag}`,
    };
  }

  const cmp = compareSemver(packageVersion, latestVer);
  if (cmp === 0) {
    const next = bumpPatch(packageVersion);
    return {
      action: 'bump_and_tag',
      packageVersion,
      latestTag,
      releaseVersion: next,
      releaseTag: tagFromVersion(next),
      reason: 'package matches latest tag — auto patch +1 for this main merge',
    };
  }
  if (cmp > 0) {
    return {
      action: 'tag_only',
      packageVersion,
      latestTag,
      releaseVersion: packageVersion,
      releaseTag: tagFromVersion(packageVersion),
      reason: 'package ahead of latest tag (manual major/minor) — tag as-is',
    };
  }
  return {
    action: 'none',
    packageVersion,
    latestTag,
    releaseVersion: null,
    releaseTag: null,
    reason: `package ${packageVersion} is behind latest tag ${latestTag} — skip (no auto-downgrade)`,
  };
}

/**
 * Whether a commit message should skip the release workflow (loop break / escape).
 * @param {string | null | undefined} message
 * @returns {boolean}
 */
export function shouldSkipReleaseCommit(message) {
  if (!message) return false;
  const m = String(message);
  if (m.startsWith(RELEASE_COMMIT_PREFIX)) return true;
  if (m.includes(SKIP_VERSION_TOKEN)) return true;
  return false;
}
