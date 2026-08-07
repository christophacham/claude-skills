/**
 * Interactive menu-driven installer (ccstatusline-style).
 *
 * Default: project scope, .claude/skills only.
 * Optional: global scope, .agents/skills mirror (symlink/copy).
 */
import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  SKILL_GROUPS,
  allSkillIds,
  defaultSelectedSkillIds,
  TOP_LEVEL_AGENTS,
} from './catalog.js';
import {
  resolveProjectRoot,
  destLabel,
  userClaudeDir,
  agentsDest,
  poolDest,
} from './paths.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanAllInstalled, skillStatus } from './scan.js';
import {
  createDesiredState,
  setSelected,
  setManySelected,
  setScope,
  setTrees,
  planChanges,
  summarizePlan,
  planCounts,
  planIsEmpty,
} from './desired.js';
import { applyPlan } from './apply.js';
import {
  hasBraveKey,
  hasTavilyKey,
  setEnvKey,
  settingsPathForDisplay,
} from './settings.js';
import { runUninstallFlow } from './uninstall-flow.js';

function isCancel(v) {
  if (p.isCancel(v)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
  return v;
}

/**
 * @param {{ projectPath?: string, skipDeps?: boolean }} opts
 */
export async function runWizard(opts = {}) {
  let projectRoot;
  try {
    projectRoot = resolveProjectRoot(opts.projectPath);
  } catch (e) {
    p.log.error(e.message);
    process.exit(1);
  }

  p.intro(
    pc.bgCyan(pc.black(' claude-skills ')) +
      pc.dim(` wizard v1 · project-default`),
  );

  let installed = scanAllInstalled(projectRoot);
  const state = createDesiredState({
    projectRoot,
    scope: 'project',
    trees: ['claude'],
    skipDeps: Boolean(opts.skipDeps),
    seedFromInstalled: installed,
  });

  // If nothing installed in project yet, seed CORE+AUTHOR+SEARCH defaults as selected (not applied).
  if (state.selected.size === 0) {
    for (const id of defaultSelectedSkillIds()) state.selected.add(id);
  }

  p.note(statusBlock(state, installed), 'Session');

  /** @type {boolean} */
  let running = true;
  while (running) {
    installed = scanAllInstalled(projectRoot);
    const plan = planChanges(state, installed, presenceExtras(state));
    const counts = planCounts(plan);

    const action = isCancel(
      await p.select({
        message: mainMenuTitle(state, counts),
        options: [
          {
            value: 'browse',
            label: 'Browse & select skills',
            hint: 'groups · toggle selection',
          },
          {
            value: 'scope',
            label: `Scope: ${state.scope}`,
            hint: state.scope === 'project' ? projectRoot : userClaudeDir(),
          },
          {
            value: 'targets',
            label: `Targets: ${state.trees.join(' + ')}`,
            hint: state.trees.map((t) => destLabel(state.scope, t, projectRoot)).join(' · '),
          },
          {
            value: 'status',
            label: 'Status',
            hint: pendingHint(counts),
          },
          {
            value: 'apply',
            label: 'Apply changes',
            hint:
              counts.install + counts.remove === 0
                ? 'nothing pending'
                : `+${counts.install} / −${counts.remove}`,
          },
          {
            value: 'keys',
            label: 'API keys',
            hint: keyHint(),
          },
          {
            value: 'manage',
            label: 'Manage installation',
            hint: 'global tracked uninstall · resync',
          },
          {
            value: 'exit',
            label: 'Exit',
            hint: counts.install + counts.remove ? 'pending changes discarded' : '',
          },
        ],
      }),
    );

    switch (action) {
      case 'browse':
        await browseGroups(state, installed);
        break;
      case 'scope':
        await changeScope(state, installed, projectRoot);
        break;
      case 'targets':
        await changeTargets(state);
        break;
      case 'status':
        showStatus(state, installed);
        break;
      case 'apply':
        await doApply(state, installed);
        installed = scanAllInstalled(projectRoot);
        break;
      case 'keys':
        await manageKeys();
        break;
      case 'manage':
        await manageMenu(state, projectRoot);
        installed = scanAllInstalled(projectRoot);
        break;
      case 'exit':
        running = false;
        break;
      default:
        break;
    }
  }

  p.outro(pc.dim('Done. Re-run anytime: ') + pc.cyan('npx claude-skills') + pc.dim(' / bunx claude-skills'));
}

function mainMenuTitle(state, counts) {
  const pend =
    counts.install + counts.remove > 0
      ? pc.yellow(` · pending +${counts.install}/−${counts.remove}`)
      : '';
  return `Main menu  ${pc.dim(`[${state.scope}]`)}${pend}`;
}

function pendingHint(counts) {
  if (counts.install + counts.remove === 0) return 'in sync';
  return `+${counts.install} install · −${counts.remove} remove`;
}

function keyHint() {
  const b = hasBraveKey() ? 'brave✓' : 'brave·';
  const t = hasTavilyKey() ? 'tavily✓' : 'tavily·';
  return `${b} ${t}`;
}

/**
 * @param {import('./desired.js').DesiredState} state
 */
function presenceExtras(state) {
  const root =
    state.scope === 'project'
      ? agentsDest('project', state.projectRoot)
      : agentsDest('global');
  const agentsPresent = TOP_LEVEL_AGENTS.every((name) =>
    existsSync(join(root, name)),
  );
  const poolPresent = existsSync(
    state.scope === 'project'
      ? poolDest('project', state.projectRoot)
      : poolDest('global'),
  );
  return { agentsPresent, poolPresent };
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
function statusBlock(state, installed) {
  const plan = planChanges(state, installed, presenceExtras(state));
  const lines = [
    `scope:    ${state.scope}`,
    `project:  ${state.projectRoot}`,
    `targets:  ${state.trees.map((t) => destLabel(state.scope, t, state.projectRoot)).join('\n          ')}`,
    `selected: ${state.selected.size}/${allSkillIds().length} skills`,
    ...summarizePlan(plan).map((l) => `pending:  ${l}`),
  ];
  return lines.join('\n');
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
function showStatus(state, installed) {
  const plan = planChanges(state, installed, presenceExtras(state));
  p.note(statusBlock(state, installed), 'Status');

  /** @type {string[]} */
  const rows = [];
  for (const g of SKILL_GROUPS) {
    rows.push(pc.bold(g.label));
    for (const s of g.skills) {
      const want = state.selected.has(s.id) ? '●' : '○';
      const disk = skillStatus(installed, s.id, state.scope, state.trees);
      const diskMark =
        disk === 'installed' ? pc.green('on') : disk === 'partial' ? pc.yellow('partial') : pc.dim('off');
      rows.push(`  ${want} ${s.id.padEnd(26)} ${diskMark}  ${pc.dim(s.hint)}`);
    }
  }
  p.note(rows.join('\n'), 'Selected (●) vs disk');
  if (!planIsEmpty(plan)) {
    p.note(summarizePlan(plan).join('\n'), 'Apply plan');
  }
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
async function browseGroups(state, installed) {
  const groupId = isCancel(
    await p.select({
      message: 'Skill group  (↑↓ · Enter)',
      options: [
        {
          value: 'all',
          label: 'All',
          hint: 'search across every group',
        },
        ...SKILL_GROUPS.map((g) => ({
          value: g.id,
          label: g.label,
          hint: `${g.skills.length} · ${g.hint}`,
        })),
        { value: 'back', label: '← Back', hint: 'main menu' },
      ],
    }),
  );
  if (groupId === 'back') return;

  const skills =
    groupId === 'all'
      ? SKILL_GROUPS.flatMap((g) => g.skills.map((s) => ({ ...s, group: g.label })))
      : (SKILL_GROUPS.find((g) => g.id === groupId)?.skills || []).map((s) => ({
          ...s,
          group: groupId,
        }));

  if (!skills.length) {
    p.log.warn('No skills in group.');
    return;
  }

  const initial = skills.filter((s) => state.selected.has(s.id)).map((s) => s.id);
  const picked = isCancel(
    await p.multiselect({
      message:
        groupId === 'all'
          ? 'Toggle skills (space) · Enter confirm'
          : `${SKILL_GROUPS.find((g) => g.id === groupId)?.label || groupId} skills`,
      options: skills.map((s) => {
        const disk = skillStatus(installed, s.id, state.scope, state.trees);
        const mark =
          disk === 'installed' ? 'on disk' : disk === 'partial' ? 'partial' : 'not installed';
        return {
          value: s.id,
          label: s.label,
          hint: `${mark} · ${s.hint}`,
        };
      }),
      initialValues: initial,
      required: false,
    }),
  );

  // multiselect replaces selection for the browsed set
  const browsedIds = new Set(skills.map((s) => s.id));
  for (const id of browsedIds) {
    setSelected(state, id, picked.includes(id));
  }
  // keep non-browsed selection intact (already true via setSelected only on browsed)

  const n = picked.length;
  p.log.success(
    `Selection updated for ${browsedIds.size} skill(s) in view · ${n} selected in this set`,
  );
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 * @param {string} projectRoot
 */
async function changeScope(state, installed, projectRoot) {
  const next = isCancel(
    await p.select({
      message: 'Install scope (default: project)',
      options: [
        {
          value: 'project',
          label: 'Project',
          hint: `${projectRoot}/.claude/skills`,
        },
        {
          value: 'global',
          label: 'Global',
          hint: `${userClaudeDir()}/skills`,
        },
      ],
      initialValue: state.scope,
    }),
  );

  const resync = isCancel(
    await p.confirm({
      message: 'Resync selection from what is installed in the new scope?',
      initialValue: true,
    }),
  );

  setScope(state, next, installed, { resyncSelected: resync });
  if (resync && state.selected.size === 0) {
    const seed = isCancel(
      await p.confirm({
        message: 'Nothing installed there — seed default CORE+AUTHOR+SEARCH selection?',
        initialValue: true,
      }),
    );
    if (seed) {
      setManySelected(state, defaultSelectedSkillIds(), true);
    }
  }
  p.log.info(`Scope → ${state.scope}`);
}

/**
 * @param {import('./desired.js').DesiredState} state
 */
async function changeTargets(state) {
  const picked = isCancel(
    await p.multiselect({
      message: 'Skill targets (Claude is primary)',
      options: [
        {
          value: 'claude',
          label: '.claude/skills',
          hint: 'Claude Code skills (default)',
        },
        {
          value: 'agents',
          label: '.agents/skills',
          hint: 'portable mirror — symlink to .claude when possible',
        },
      ],
      initialValues: state.trees,
      required: true,
    }),
  );
  // ensure claude always present
  const trees = picked.includes('claude') ? picked : ['claude', ...picked];
  setTrees(state, /** @type {import('./paths.js').SkillTree[]} */ (trees));
  p.log.info(`Targets → ${state.trees.join(', ')}`);
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
async function doApply(state, installed) {
  const plan = planChanges(state, installed, presenceExtras(state));
  if (planIsEmpty(plan)) {
    p.log.info('Nothing to apply — selection matches disk for this scope/targets.');
    return;
  }

  p.note(summarizePlan(plan).join('\n'), 'Will apply');
  const ok = isCancel(
    await p.confirm({
      message: `Apply to ${state.scope}?`,
      initialValue: true,
    }),
  );
  if (!ok) {
    p.log.message(pc.dim('Apply cancelled.'));
    return;
  }

  const spin = p.spinner();
  spin.start('Applying…');
  const result = applyPlan(plan, state);
  spin.stop(
    result.errors.length
      ? `Finished with ${result.errors.length} error(s)`
      : `Applied +${result.installed.length} / −${result.removed.length}`,
  );

  for (const line of result.installed) p.log.success(`install ${line}`);
  for (const line of result.removed) p.log.step(`remove  ${line}`);
  if (result.agents) {
    p.log.message(
      pc.dim(
        `agents ${result.agents.mode}: ${result.agents.agents.length} + ${result.agents.panelists.length} panelists`,
      ),
    );
  }
  if (result.pool) p.log.message(pc.dim('pool.md ready'));
  for (const line of result.depLines) p.log.message(pc.dim(line));
  for (const err of result.errors) p.log.error(err);

  // Keys for newly installed search skills
  const installedClaude = new Set(
    result.installed
      .filter((x) => x.endsWith('@claude'))
      .map((x) => x.replace(/@claude$/, '')),
  );
  if (installedClaude.has('brave-search') || state.selected.has('brave-search')) {
    await maybePromptBrave();
  }
  if (installedClaude.has('tavily-search') || state.selected.has('tavily-search')) {
    await maybePromptTavily();
  }
}

async function maybePromptBrave() {
  if (hasBraveKey()) {
    p.log.info(pc.dim('Brave key already set (not printed).'));
    return;
  }
  const key = isCancel(
    await p.password({
      message: `Brave API key (Enter skip) — ${settingsPathForDisplay()}`,
    }),
  );
  if (key && String(key).trim()) {
    setEnvKey('BRAVE_API_KEY', String(key).trim());
    p.log.success('BRAVE_API_KEY saved. Restart Claude Code to pick up.');
  }
}

async function maybePromptTavily() {
  if (hasTavilyKey()) {
    p.log.info(pc.dim('Tavily key already set (not printed).'));
    return;
  }
  const key = isCancel(
    await p.password({
      message: `Tavily API key (Enter skip) — ${settingsPathForDisplay()}`,
    }),
  );
  if (key && String(key).trim()) {
    setEnvKey('TAVILY_API_KEY', String(key).trim());
    p.log.success('TAVILY_API_KEY saved. Restart Claude Code to pick up.');
  }
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {string} projectRoot
 */
async function manageMenu(state, projectRoot) {
  const action = isCancel(
    await p.select({
      message: 'Manage installation',
      options: [
        {
          value: 'resync',
          label: 'Resync selection from disk',
          hint: `scope=${state.scope}`,
        },
        {
          value: 'select-defaults',
          label: 'Select defaults (CORE+AUTHOR+SEARCH)',
          hint: 'does not apply until you Apply',
        },
        {
          value: 'clear-selection',
          label: 'Clear selection',
          hint: 'deselect all (apply will uninstall suite skills in scope)',
        },
        {
          value: 'global-uninstall',
          label: 'Uninstall tracked GLOBAL items',
          hint: 'manifest-based smart uninstall',
        },
        { value: 'back', label: '← Back' },
      ],
    }),
  );

  if (action === 'back') return;

  if (action === 'resync') {
    const installed = scanAllInstalled(projectRoot);
    setScope(state, state.scope, installed, { resyncSelected: true });
    p.log.success(`Selection ← disk (${state.selected.size} skills)`);
    return;
  }

  if (action === 'select-defaults') {
    state.selected = new Set(defaultSelectedSkillIds());
    p.log.success('Default selection loaded (not applied).');
    return;
  }

  if (action === 'clear-selection') {
    const ok = isCancel(
      await p.confirm({
        message: 'Clear all selected skills? (Apply later removes them from this scope/targets)',
        initialValue: false,
      }),
    );
    if (ok) {
      state.selected.clear();
      p.log.warn('Selection cleared.');
    }
    return;
  }

  if (action === 'global-uninstall') {
    await runUninstallFlow({ yes: false });
  }
}
