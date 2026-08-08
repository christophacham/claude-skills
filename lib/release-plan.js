/**
 * Pure release planner for github: installs (no external version libs).
 *
 * Policy:
 *   - Major / minor: human bumps package.json in a PR.
 *   - Patch: on each merge to main, if package.json already matches the
 *     highest vX.Y.Z tag, bump patch by 1 and tag. If package is ahead of
 *     that tag (manual bump), only create the package tag. If no tags yet,
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
 *   highestTag: string | null,
 *   releaseVersion: string | null,
 *   releaseTag: string | null,
 *   reason: string,
 * }} ReleasePlan
 */

/**
 * Parse strict X.Y.Z (no prerelease / build / leading zeros).
 * @param {string} v
 * @returns {Semver | null}
 */
export function parseSemver(v) {
  if (typeof v !== 'string') return null;
  // Reject leading zeros (01.0.0) so we never silently normalize.
  const m = v.trim().match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
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
 * @param {string} tag  e.g. v1.0.0
 * @returns {string | null}  e.g. 1.0.0
 */
export function versionFromTag(tag) {
  if (typeof tag !== 'string') return null;
  const t = tag.trim();
  if (!t.startsWith('v')) return null;
  const ver = t.slice(1);
  return parseSemver(ver) ? ver : null;
}

/**
 * @param {string} version  e.g. 1.0.0
 * @returns {string}  e.g. v1.0.0
 */
export function tagFromVersion(version) {
  const p = parseSemver(version);
  if (!p) throw new Error(`tagFromVersion: invalid version ${version}`);
  return `v${formatSemver(p)}`;
}

/**
 * Highest semver among vX.Y.Z tags (not chronological recency).
 * A later-created hotfix on an older major does not win over a higher major.
 * @param {string[]} tags
 * @returns {string | null} tag with leading v, or null
 */
export function highestReleaseTag(tags) {
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
 * @deprecated Use highestReleaseTag — kept for a one-release compat window.
 * @param {string[]} tags
 * @returns {string | null}
 */
export function latestReleaseTag(tags) {
  return highestReleaseTag(tags);
}

/**
 * @param {{ packageVersion: string, highestTag?: string | null, latestTag?: string | null }} input
 *   `latestTag` accepted as alias of `highestTag` for older callers.
 * @returns {ReleasePlan}
 */
export function planRelease(input) {
  const packageVersion = String(input.packageVersion ?? '').trim();
  const rawTag =
    input.highestTag !== undefined
      ? input.highestTag
      : input.latestTag !== undefined
        ? input.latestTag
        : null;
  const highestTag =
    rawTag == null || rawTag === '' ? null : String(rawTag).trim();

  const pkg = parseSemver(packageVersion);
  if (!pkg) {
    return {
      action: 'none',
      packageVersion,
      highestTag,
      releaseVersion: null,
      releaseTag: null,
      reason: `invalid package.json version (need X.Y.Z, no leading zeros): ${packageVersion}`,
    };
  }

  if (!highestTag) {
    return {
      action: 'tag_only',
      packageVersion,
      highestTag: null,
      releaseVersion: packageVersion,
      releaseTag: tagFromVersion(packageVersion),
      reason: 'no vX.Y.Z tags yet — tag package.json as the first release',
    };
  }

  const highestVer = versionFromTag(highestTag);
  if (!highestVer) {
    return {
      action: 'none',
      packageVersion,
      highestTag,
      releaseVersion: null,
      releaseTag: null,
      reason: `highest tag is not vX.Y.Z: ${highestTag}`,
    };
  }

  const cmp = compareSemver(packageVersion, highestVer);
  if (cmp === 0) {
    const next = bumpPatch(packageVersion);
    return {
      action: 'bump_and_tag',
      packageVersion,
      highestTag,
      releaseVersion: next,
      releaseTag: tagFromVersion(next),
      reason: 'package matches highest tag — auto patch +1 for this main merge',
    };
  }
  if (cmp > 0) {
    return {
      action: 'tag_only',
      packageVersion,
      highestTag,
      releaseVersion: packageVersion,
      releaseTag: tagFromVersion(packageVersion),
      reason: 'package ahead of highest tag (manual major/minor) — tag as-is',
    };
  }
  return {
    action: 'none',
    packageVersion,
    highestTag,
    releaseVersion: null,
    releaseTag: null,
    reason: `package ${packageVersion} is behind highest tag ${highestTag} — skip (no auto-downgrade)`,
  };
}

/**
 * Whether a commit message should skip the release workflow (loop break / escape).
 * @param {string | null | undefined} message
 * @returns {boolean}
 */
export function shouldSkipReleaseCommit(message) {
  if (message == null || message === '') return false;
  const m = String(message);
  if (m.startsWith(RELEASE_COMMIT_PREFIX)) return true;
  if (m.includes(SKIP_VERSION_TOKEN)) return true;
  return false;
}
