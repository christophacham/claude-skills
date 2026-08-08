/**
 * Pure/unit tests for the selective installer core (no TTY).
 * Run: node --test tests/test_installer_core.mjs
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  existsSync,
  lstatSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createDesiredState,
  planChanges,
  planIsEmpty,
  planCounts,
  summarizePlan,
} from '../lib/desired.js';
import { allSkillIds, defaultSelectedSkillIds, SKILL_GROUPS } from '../lib/catalog.js';
import { scanAllInstalled, isInstalled, skillStatus } from '../lib/scan.js';
import { applyPlan } from '../lib/apply.js';
import { installSkillToTree, removeSkillFromTree, trySymlink } from '../lib/fs-ops.js';
import { skillsDestForTree } from '../lib/paths.js';
import {
  suiteVersion,
  releaseGitRef,
  findRetiredSkillsPresent,
  isStaleSuitePayload,
  formatStaleSuiteMessage,
  assertFreshSuitePayload,
  FIRST_RELEASE_TAG,
} from '../lib/suite-version.js';
import {
  parseSemver,
  compareSemver,
  bumpPatch,
  latestReleaseTag,
  planRelease,
  shouldSkipReleaseCommit,
  RELEASE_COMMIT_PREFIX,
  SKIP_VERSION_TOKEN,
  tagFromVersion,
  versionFromTag,
} from '../lib/release-plan.js';

const known = allSkillIds();

describe('catalog groups', () => {
  it('exposes five groups covering all skill ids', () => {
    assert.equal(SKILL_GROUPS.length, 5);
    const fromGroups = SKILL_GROUPS.flatMap((g) => g.skills.map((s) => s.id)).sort();
    assert.deepEqual(fromGroups, [...known].sort());
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'search'));
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'core'));
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'opt_in'));
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'security'));
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'specialist'));
  });

  it('defaultSelected includes CORE+SEARCH not opt_in/security/specialist', () => {
    const d = new Set(defaultSelectedSkillIds());
    assert.ok(d.has('simple-design'));
    assert.ok(d.has('refactoring'));
    assert.ok(d.has('ddg-search'));
    assert.ok(d.has('brave-search'));
    assert.ok(d.has('tavily-search'));
    assert.ok(!d.has('architecture-design'));
    assert.ok(!d.has('defectdojo-fix'));
    assert.ok(!d.has('ink-cli-tui'));
  });

  it('known suite is the ten kept skills', () => {
    assert.deepEqual(
      [...known].sort(),
      [
        'architecture-design',
        'brave-search',
        'ddg-search',
        'defectdojo-fix',
        'distributed-architecture',
        'geometric-robustness',
        'ink-cli-tui',
        'refactoring',
        'simple-design',
        'tavily-search',
      ],
    );
  });
});

describe('desired planChanges', () => {
  it('plans install for selected missing skills under project/claude', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: ['refactoring', 'simple-design'],
    });
    const plan = planChanges(state, []);
    assert.equal(plan.skillOps.length, 2);
    assert.ok(plan.skillOps.every((o) => o.op === 'install' && o.tree === 'claude'));
    assert.deepEqual(planCounts(plan), { install: 2, remove: 0 });
  });

  it('plans remove when installed but not selected', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: [],
    });
    const installed = [
      {
        id: 'refactoring',
        scope: 'project',
        tree: 'claude',
        path: '/x',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.equal(plan.skillOps.length, 1);
    assert.equal(plan.skillOps[0].op, 'remove');
  });

  it('disabling agents tree schedules agents-tree removals', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: ['refactoring'],
    });
    const installed = [
      {
        id: 'refactoring',
        scope: 'project',
        tree: 'claude',
        path: '/c',
        kind: 'dir',
      },
      {
        id: 'refactoring',
        scope: 'project',
        tree: 'agents',
        path: '/a',
        kind: 'symlink',
      },
    ];
    const plan = planChanges(state, installed);
    const rem = plan.skillOps.filter((o) => o.op === 'remove');
    assert.equal(rem.length, 1);
    assert.equal(rem[0].tree, 'agents');
  });

  it('suite skills never pull agent roster', () => {
    for (const id of known) {
      const state = createDesiredState({
        projectRoot: '/tmp/proj',
        selected: [id],
      });
      const plan = planChanges(state, [], { agentsPresent: false });
      assert.equal(plan.needAgents, false, id);
    }
  });

  it('summarizePlan lists ops', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      selected: ['simple-design'],
    });
    const lines = summarizePlan(planChanges(state, []));
    assert.ok(lines.some((l) => l.includes('install')));
  });

  it('blocks project install when same skill name exists globally', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: ['refactoring', 'simple-design'],
    });
    const installed = [
      {
        id: 'refactoring',
        scope: 'global',
        tree: 'claude',
        path: '/home/x/.claude/skills/refactoring',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.ok(plan.blocked.some((b) => b.id === 'refactoring'));
    assert.ok(plan.blocked.every((b) => b.otherScope === 'global'));
    assert.ok(
      !plan.skillOps.some((o) => o.op === 'install' && o.id === 'refactoring'),
    );
    assert.ok(plan.skillOps.some((o) => o.op === 'install' && o.id === 'simple-design'));
    const lines = summarizePlan(plan);
    assert.ok(lines.some((l) => l.startsWith('blocked')));
  });

  it('blocks global install when same skill name exists in project', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'global',
      trees: ['claude'],
      selected: ['architecture-design'],
    });
    const installed = [
      {
        id: 'architecture-design',
        scope: 'project',
        tree: 'claude',
        path: '/tmp/proj/.claude/skills/architecture-design',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.equal(plan.blocked.length, 1);
    assert.equal(plan.blocked[0].otherScope, 'project');
    assert.equal(plan.skillOps.filter((o) => o.op === 'install').length, 0);
  });

  it('still allows remove in active scope when other scope also has the skill', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: [],
    });
    const installed = [
      {
        id: 'refactoring',
        scope: 'project',
        tree: 'claude',
        path: '/tmp/proj/.claude/skills/refactoring',
        kind: 'dir',
      },
      {
        id: 'refactoring',
        scope: 'global',
        tree: 'claude',
        path: '/home/x/.claude/skills/refactoring',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.ok(
      plan.skillOps.some(
        (o) => o.op === 'remove' && o.id === 'refactoring' && o.scope === 'project',
      ),
    );
  });
});

describe('apply + scan integration (isolated project)', () => {
  /** @type {string} */
  let projectRoot;
  /** @type {string} */
  let home;
  /** @type {string|undefined} */
  let oldHome;

  before(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'cs-proj-'));
    home = mkdtempSync(join(tmpdir(), 'cs-home-'));
    oldHome = process.env.HOME;
    process.env.HOME = home;
  });

  after(() => {
    if (oldHome !== undefined) process.env.HOME = oldHome;
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  });

  it('installs selected skills into project .claude/skills', () => {
    const state = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude'],
      selected: ['refactoring', 'simple-design'],
      skipDeps: true,
    });
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    assert.ok(!planIsEmpty(plan));
    const result = applyPlan(plan, state);
    assert.equal(result.errors.length, 0);
    assert.ok(existsSync(join(projectRoot, '.claude/skills/refactoring/SKILL.md')));
    assert.ok(existsSync(join(projectRoot, '.claude/skills/simple-design/SKILL.md')));

    const installed = scanAllInstalled(projectRoot);
    assert.ok(isInstalled(installed, 'refactoring', 'project', 'claude'));
    assert.equal(skillStatus(installed, 'refactoring', 'project', ['claude']), 'installed');
  });

  it('mirrors to .agents/skills via symlink or copy', () => {
    const state = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude', 'agents'],
      selected: ['refactoring'],
      skipDeps: true,
    });
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    const agentsOps = plan.skillOps.filter((o) => o.tree === 'agents' && o.op === 'install');
    assert.ok(agentsOps.length >= 1);
    const result = applyPlan(plan, state);
    assert.equal(result.errors.length, 0);
    const agentsPath = join(projectRoot, '.agents/skills/refactoring');
    assert.ok(existsSync(agentsPath));
  });

  it('removes when deselected', () => {
    const state = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude'],
      selected: [],
      skipDeps: true,
    });
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    assert.ok(plan.skillOps.some((o) => o.op === 'remove'));
    applyPlan(plan, state);
    const state2 = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude'],
      selected: [],
      skipDeps: true,
    });
    applyPlan(planChanges(state2, scanAllInstalled(projectRoot)), state2);
    assert.ok(!existsSync(join(projectRoot, '.claude/skills/refactoring')));
  });
});

describe('settings helpers (DefectDojo)', () => {
  it('reports missing / partial / ok with isolated settings path', async () => {
    const {
      hasDefectDojoUrl,
      hasDefectDojoToken,
      hasDefectDojoConfig,
      defectDojoConfigStatus,
      setSettingsPathForTests,
      setEnvKey,
    } = await import('../lib/settings.js');

    const dir = mkdtempSync(join(tmpdir(), 'cs-settings-'));
    const settingsFile = join(dir, 'settings.json');
    // Empty isolated file — no host ~/.claude/settings.json bleed-through.
    writeFileSync(settingsFile, '{}\n', 'utf8');

    const prevUrl = process.env.DEFECTDOJO_URL;
    const prevHost = process.env.DEFECTDOJO_HOST;
    const prevTok = process.env.DEFECTDOJO_API_TOKEN;
    const prevApi = process.env.API_TOKEN;
    try {
      setSettingsPathForTests(settingsFile);
      delete process.env.DEFECTDOJO_URL;
      delete process.env.DEFECTDOJO_HOST;
      delete process.env.DEFECTDOJO_API_TOKEN;
      delete process.env.API_TOKEN;

      assert.equal(defectDojoConfigStatus(), 'missing');
      assert.equal(hasDefectDojoConfig(), false);
      assert.equal(hasDefectDojoUrl(), false);
      assert.equal(hasDefectDojoToken(), false);

      // URL only → partial
      process.env.DEFECTDOJO_URL = 'http://example.test:8080';
      assert.equal(hasDefectDojoUrl(), true);
      assert.equal(hasDefectDojoToken(), false);
      assert.equal(defectDojoConfigStatus(), 'partial');
      assert.equal(hasDefectDojoConfig(), false);

      // URL + token via env → ok
      process.env.DEFECTDOJO_API_TOKEN = 'unit-test-token-not-a-secret';
      assert.equal(hasDefectDojoToken(), true);
      assert.equal(hasDefectDojoConfig(), true);
      assert.equal(defectDojoConfigStatus(), 'ok');

      // Token only (clear URL/host env) → partial
      delete process.env.DEFECTDOJO_URL;
      delete process.env.DEFECTDOJO_HOST;
      assert.equal(hasDefectDojoUrl(), false);
      assert.equal(hasDefectDojoToken(), true);
      assert.equal(defectDojoConfigStatus(), 'partial');

      // HOST alias counts as URL present
      delete process.env.DEFECTDOJO_API_TOKEN;
      delete process.env.API_TOKEN;
      process.env.DEFECTDOJO_HOST = '192.0.2.1';
      assert.equal(hasDefectDojoUrl(), true);
      assert.equal(defectDojoConfigStatus(), 'partial');

      // settings.json write path (no env) still visible after clear
      delete process.env.DEFECTDOJO_HOST;
      setEnvKey('DEFECTDOJO_URL', 'http://from-settings.test:8080');
      setEnvKey('DEFECTDOJO_API_TOKEN', 'from-settings-token');
      assert.equal(hasDefectDojoConfig(), true);
      assert.equal(defectDojoConfigStatus(), 'ok');
      assert.ok(existsSync(settingsFile));
    } finally {
      setSettingsPathForTests(null);
      if (prevUrl === undefined) delete process.env.DEFECTDOJO_URL;
      else process.env.DEFECTDOJO_URL = prevUrl;
      if (prevHost === undefined) delete process.env.DEFECTDOJO_HOST;
      else process.env.DEFECTDOJO_HOST = prevHost;
      if (prevTok === undefined) delete process.env.DEFECTDOJO_API_TOKEN;
      else process.env.DEFECTDOJO_API_TOKEN = prevTok;
      if (prevApi === undefined) delete process.env.API_TOKEN;
      else process.env.API_TOKEN = prevApi;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('trySymlink', () => {
  it('creates a usable symlink when permitted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-link-'));
    try {
      const target = join(dir, 'target');
      const link = join(dir, 'link');
      mkdirSync(target);
      writeFileSync(join(target, 'f.txt'), 'ok');
      const ok = trySymlink(target, link);
      if (ok) {
        assert.ok(lstatSync(link).isSymbolicLink() || existsSync(join(link, 'f.txt')));
      } else {
        assert.equal(ok, false);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('installSkillToTree direct', () => {
  it('copies package skill into isolated project', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'cs-skill-'));
    try {
      const r = installSkillToTree('refactoring', 'claude', 'project', projectRoot);
      assert.equal(r.kind, 'dir');
      assert.ok(existsSync(join(r.path, 'SKILL.md')));
      removeSkillFromTree('refactoring', 'claude', 'project', projectRoot);
      assert.ok(
        !existsSync(join(skillsDestForTree('claude', 'project', projectRoot), 'refactoring')),
      );
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});

describe('suite version + stale payload gate', () => {
  it('reads package.json version as 1.0.0', () => {
    assert.equal(suiteVersion(), '1.0.0');
    assert.equal(releaseGitRef(), 'v1.0.0');
    assert.equal(FIRST_RELEASE_TAG, 'v1.0.0');
  });

  it('current package skills/ has no retired ids', () => {
    assert.deepEqual(findRetiredSkillsPresent(), []);
    assert.equal(isStaleSuitePayload(), false);
  });

  it('detects retired skill dirs in a fake skills tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-stale-'));
    try {
      mkdirSync(join(dir, 'operating-mode'));
      mkdirSync(join(dir, 'beads-om'));
      writeFileSync(join(dir, 'operating-mode', 'SKILL.md'), '# fake\n');
      const found = findRetiredSkillsPresent(dir);
      assert.ok(found.includes('operating-mode'));
      assert.ok(found.includes('beads-om'));
      assert.equal(isStaleSuitePayload(dir), true);
      const msg = formatStaleSuiteMessage({ retired: found, version: '1.0.0' });
      assert.match(msg, /stale suite payload/);
      assert.match(msg, /operating-mode/);
      assert.match(msg, /#v1\.0\.0/);
      assert.match(msg, /bunx github:christophacham\/claude-skills#v1\.0\.0/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('assertFreshSuitePayload exits on stale tree without mutating disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-gate-'));
    try {
      mkdirSync(join(dir, 'capability-plan'));
      let exitCode;
      const lines = [];
      const ok = assertFreshSuitePayload({
        skillsSrc: dir,
        write: (s) => lines.push(s),
        exit: (c) => {
          exitCode = c;
        },
      });
      assert.equal(ok, false);
      assert.equal(exitCode, 2);
      assert.ok(lines.some((l) => /capability-plan/.test(l)));
      assert.ok(existsSync(join(dir, 'capability-plan')));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('assertFreshSuitePayload allows current package tree', () => {
    let exited = false;
    const ok = assertFreshSuitePayload({
      exit: () => {
        exited = true;
      },
    });
    assert.equal(ok, true);
    assert.equal(exited, false);
  });
});

describe('release plan (DIY semver, no external libs)', () => {
  it('parses and compares X.Y.Z only', () => {
    assert.deepEqual(parseSemver('2.0.0'), { major: 2, minor: 0, patch: 0 });
    assert.equal(parseSemver('2.0.0-beta'), null);
    assert.equal(parseSemver('v2.0.0'), null);
    assert.equal(compareSemver('2.0.0', '2.0.1'), -1);
    assert.equal(compareSemver('2.1.0', '2.0.9'), 1);
    assert.equal(compareSemver('2.0.0', '2.0.0'), 0);
    assert.equal(bumpPatch('2.0.0'), '2.0.1');
    assert.equal(tagFromVersion('2.0.1'), 'v2.0.1');
    assert.equal(versionFromTag('v2.0.1'), '2.0.1');
    assert.equal(versionFromTag('2.0.1'), null);
  });

  it('picks latest v* tag and ignores junk', () => {
    assert.equal(latestReleaseTag(['v1.0.0', 'v2.0.0', 'v2.0.1', 'nightly']), 'v2.0.1');
    assert.equal(latestReleaseTag(['v2.0.0', 'v10.0.0', 'v9.9.9']), 'v10.0.0');
    assert.equal(latestReleaseTag(['foo', 'bar']), null);
  });

  it('first release: no tags → tag package as-is', () => {
    const p = planRelease({ packageVersion: '1.0.0', latestTag: null });
    assert.equal(p.action, 'tag_only');
    assert.equal(p.releaseVersion, '1.0.0');
    assert.equal(p.releaseTag, 'v1.0.0');
  });

  it('auto patch when package equals latest tag', () => {
    const p = planRelease({ packageVersion: '1.0.0', latestTag: 'v1.0.0' });
    assert.equal(p.action, 'bump_and_tag');
    assert.equal(p.releaseVersion, '1.0.1');
    assert.equal(p.releaseTag, 'v1.0.1');
  });

  it('manual major/minor: package ahead → tag as-is', () => {
    const p = planRelease({ packageVersion: '2.0.0', latestTag: 'v1.0.5' });
    assert.equal(p.action, 'tag_only');
    assert.equal(p.releaseVersion, '2.0.0');
    assert.equal(p.releaseTag, 'v2.0.0');
  });

  it('package behind latest tag → none (no auto-downgrade)', () => {
    const p = planRelease({ packageVersion: '1.0.0', latestTag: 'v1.0.3' });
    assert.equal(p.action, 'none');
    assert.equal(p.releaseTag, null);
  });

  it('invalid package version → none', () => {
    const p = planRelease({ packageVersion: 'nope', latestTag: null });
    assert.equal(p.action, 'none');
  });

  it('skips release commits and escape hatch', () => {
    assert.equal(shouldSkipReleaseCommit(`${RELEASE_COMMIT_PREFIX} v2.0.1`), true);
    assert.equal(shouldSkipReleaseCommit(`feat: x ${SKIP_VERSION_TOKEN}`), true);
    assert.equal(shouldSkipReleaseCommit('feat: add skill'), false);
  });
});
