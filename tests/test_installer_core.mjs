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
  symlinkSync,
  lstatSync,
  readFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDesiredState, planChanges, planIsEmpty, planCounts, setSelected, setTrees, summarizePlan } from '../lib/desired.js';
import { allSkillIds, defaultSelectedSkillIds, SKILL_GROUPS } from '../lib/catalog.js';
import { scanAllInstalled, isInstalled, skillStatus } from '../lib/scan.js';
import { applyPlan } from '../lib/apply.js';
import { installSkillToTree, removeSkillFromTree, trySymlink } from '../lib/fs-ops.js';
import { skillsDestForTree } from '../lib/paths.js';

const known = allSkillIds();

describe('catalog groups', () => {
  it('exposes six groups covering all skill ids', () => {
    assert.equal(SKILL_GROUPS.length, 6);
    const fromGroups = SKILL_GROUPS.flatMap((g) => g.skills.map((s) => s.id)).sort();
    assert.deepEqual(fromGroups, [...known].sort());
    assert.ok(SKILL_GROUPS.some((g) => g.id === 'specialist'));
  });

  it('defaultSelected includes CORE+AUTHOR+SEARCH not beads/opt_in/specialist', () => {
    const d = new Set(defaultSelectedSkillIds());
    assert.ok(d.has('operating-mode'));
    assert.ok(d.has('beads-om'));
    assert.ok(d.has('skill-creator'));
    assert.ok(d.has('ddg-search'));
    assert.ok(!d.has('beads'));
    assert.ok(!d.has('architecture-design'));
    assert.ok(!d.has('ink-cli-tui'));
  });
});

describe('desired planChanges', () => {
  it('plans install for selected missing skills under project/claude', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: ['operating-mode', 'refactoring'],
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
        id: 'operating-mode',
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
      selected: ['operating-mode'],
    });
    const installed = [
      {
        id: 'operating-mode',
        scope: 'project',
        tree: 'claude',
        path: '/c',
        kind: 'dir',
      },
      {
        id: 'operating-mode',
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

  it('needAgents only when beads selected and agents missing', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      selected: ['beads'],
    });
    const planMissing = planChanges(state, [], { agentsPresent: false });
    assert.equal(planMissing.needAgents, true);
    const planPresent = planChanges(state, [], { agentsPresent: true, poolPresent: true });
    assert.equal(planPresent.needAgents, false);
    assert.equal(planPresent.needPool, false);
  });

  it('summarizePlan lists ops', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      selected: ['peek-repo'],
    });
    const lines = summarizePlan(planChanges(state, []));
    assert.ok(lines.some((l) => l.includes('install')));
  });

  it('blocks project install when same skill name exists globally', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'project',
      trees: ['claude'],
      selected: ['operating-mode', 'refactoring'],
    });
    const installed = [
      {
        id: 'operating-mode',
        scope: 'global',
        tree: 'claude',
        path: '/home/x/.claude/skills/operating-mode',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.ok(plan.blocked.some((b) => b.id === 'operating-mode'));
    assert.ok(plan.blocked.every((b) => b.otherScope === 'global'));
    assert.ok(
      !plan.skillOps.some(
        (o) => o.op === 'install' && o.id === 'operating-mode',
      ),
    );
    // refactoring not global → still schedules install
    assert.ok(
      plan.skillOps.some((o) => o.op === 'install' && o.id === 'refactoring'),
    );
    const lines = summarizePlan(plan);
    assert.ok(lines.some((l) => l.startsWith('blocked')));
  });

  it('blocks global install when same skill name exists in project', () => {
    const state = createDesiredState({
      projectRoot: '/tmp/proj',
      scope: 'global',
      trees: ['claude'],
      selected: ['simple-design'],
    });
    const installed = [
      {
        id: 'simple-design',
        scope: 'project',
        tree: 'claude',
        path: '/tmp/proj/.claude/skills/simple-design',
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
      selected: [], // deselect → remove project copy
    });
    const installed = [
      {
        id: 'operating-mode',
        scope: 'project',
        tree: 'claude',
        path: '/tmp/proj/.claude/skills/operating-mode',
        kind: 'dir',
      },
      {
        id: 'operating-mode',
        scope: 'global',
        tree: 'claude',
        path: '/home/x/.claude/skills/operating-mode',
        kind: 'dir',
      },
    ];
    const plan = planChanges(state, installed);
    assert.ok(
      plan.skillOps.some(
        (o) => o.op === 'remove' && o.id === 'operating-mode' && o.scope === 'project',
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
      selected: ['operating-mode', 'simple-design'],
      skipDeps: true,
    });
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    assert.ok(!planIsEmpty(plan));
    const result = applyPlan(plan, state);
    assert.equal(result.errors.length, 0);
    assert.ok(existsSync(join(projectRoot, '.claude/skills/operating-mode/SKILL.md')));
    assert.ok(existsSync(join(projectRoot, '.claude/skills/simple-design/SKILL.md')));

    const installed = scanAllInstalled(projectRoot);
    assert.ok(isInstalled(installed, 'operating-mode', 'project', 'claude'));
    assert.equal(skillStatus(installed, 'operating-mode', 'project', ['claude']), 'installed');
  });

  it('mirrors to .agents/skills via symlink or copy', () => {
    setTrees(
      createDesiredState({ projectRoot, selected: [] }),
      ['claude', 'agents'],
    );
    const state = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude', 'agents'],
      selected: ['operating-mode'],
      skipDeps: true,
    });
    // ensure claude already has it from previous test; plan agents install
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    const agentsOps = plan.skillOps.filter((o) => o.tree === 'agents' && o.op === 'install');
    assert.ok(agentsOps.length >= 1);
    const result = applyPlan(plan, state);
    assert.equal(result.errors.length, 0);
    const agentsPath = join(projectRoot, '.agents/skills/operating-mode');
    assert.ok(existsSync(agentsPath));
  });

  it('removes when deselected', () => {
    const state = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude'],
      selected: [], // remove all
      skipDeps: true,
    });
    // keep only empty selection for known skills that were installed
    const plan = planChanges(state, scanAllInstalled(projectRoot));
    assert.ok(plan.skillOps.some((o) => o.op === 'remove'));
    applyPlan(plan, state);
    // agents tree still may have operating-mode if trees only claude — disabling agents tree removes it
    const state2 = createDesiredState({
      projectRoot,
      scope: 'project',
      trees: ['claude'],
      selected: [],
      skipDeps: true,
    });
    applyPlan(planChanges(state2, scanAllInstalled(projectRoot)), state2);
    assert.ok(!existsSync(join(projectRoot, '.claude/skills/operating-mode')));
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
        // environment may forbid symlinks — not a hard fail
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
      assert.ok(!existsSync(join(skillsDestForTree('claude', 'project', projectRoot), 'refactoring')));
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
