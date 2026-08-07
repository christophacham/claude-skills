/**
 * Interactive menu-driven installer (ccstatusline-style polish on Clack).
 *
 * Default: project scope, .claude/skills only.
 * Optional: global scope, .agents/skills mirror (symlink/copy).
 *
 * Plan-then-apply: selection is a draft cart; Apply is the sole mutator.
 * Sticky plan strip re-renders each main-menu turn.
 */
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKILL_GROUPS,
  allSkillIds,
  defaultSelectedSkillIds,
  TOP_LEVEL_AGENTS,
  findSkill,
} from './catalog.js';
import {
  resolveProjectRoot,
  destLabel,
  userClaudeDir,
  agentsDest,
  poolDest,
  skillsDestForTree,
} from './paths.js';
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
export async function runClackWizard(opts = {}) {
  let projectRoot;
  try {
    projectRoot = resolveProjectRoot(opts.projectPath);
  } catch (e) {
    p.log.error(e.message);
    process.exit(1);
  }

  p.intro(
    pc.bgCyan(pc.black(' claude-skills ')) +
      pc.dim(' wizard · project-default'),
  );

  let installed = scanAllInstalled(projectRoot);
  const state = createDesiredState({
    projectRoot,
    scope: 'project',
    trees: ['claude'],
    skipDeps: Boolean(opts.skipDeps),
    seedFromInstalled: installed,
  });

  // Fresh project: seed CORE+AUTHOR+SEARCH as selected (not applied).
  if (state.selected.size === 0) {
    for (const id of defaultSelectedSkillIds()) state.selected.add(id);
  }

  /** @type {boolean} */
  let running = true;
  while (running) {
    installed = scanAllInstalled(projectRoot);
    const extras = presenceExtras(state);
    const plan = planChanges(state, installed, extras);
    const counts = planCounts(plan);

    // Sticky plan strip (ccstatusline-style always-on context)
    p.note(statusBlock(state, installed, plan), stickyTitle(counts));

    const action = isCancel(
      await p.select({
        message: mainMenuTitle(state, counts),
        options: [
          {
            value: 'browse',
            label: 'Browse & select skills',
            hint: 'groups · filter · toggle',
          },
          {
            value: 'scope',
            label: `Scope: ${state.scope}`,
            hint:
              state.scope === 'project'
                ? shortPath(projectRoot)
                : shortPath(userClaudeDir()),
          },
          {
            value: 'targets',
            label: `Targets: ${state.trees.join(' + ')}`,
            hint: state.trees
              .map((t) => destLabel(state.scope, t, projectRoot))
              .map(shortPath)
              .join(' · '),
          },
          {
            value: 'status',
            label: 'Status detail',
            hint: pendingHint(counts),
          },
          {
            value: 'apply',
            label:
              counts.install + counts.remove === 0
                ? 'Apply changes'
                : `Apply changes  ${pc.yellow(`+${counts.install}/−${counts.remove}`)}`,
            hint:
              counts.install + counts.remove === 0
                ? 'in sync'
                : 'review paths · confirm',
          },
          {
            value: 'keys',
            label: 'API keys',
            hint: keyHint(),
          },
          {
            value: 'manage',
            label: 'Manage installation',
            hint: 'resync · defaults · global uninstall',
          },
          {
            value: 'exit',
            label: 'Exit',
            hint:
              counts.install + counts.remove
                ? pc.yellow('pending discarded')
                : '',
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
        break;
      case 'keys':
        await manageKeys();
        break;
      case 'manage':
        await manageMenu(state, projectRoot);
        break;
      case 'exit': {
        const pending = planCounts(
          planChanges(state, scanAllInstalled(projectRoot), presenceExtras(state)),
        );
        if (pending.install + pending.remove > 0) {
          const leave = isCancel(
            await p.confirm({
              message: `Exit and discard pending +${pending.install}/−${pending.remove}?`,
              initialValue: false,
            }),
          );
          if (!leave) break;
        }
        running = false;
        break;
      }
      default:
        break;
    }
  }

  p.outro(
    pc.dim('Done. Re-run: ') +
      pc.cyan('npx -y github:christophacham/claude-skills'),
  );
}

function shortPath(s) {
  const home = userClaudeDir().replace(/\/\.claude$/, '');
  if (s.startsWith(home)) return `~${s.slice(home.length)}`;
  return s;
}

function stickyTitle(counts) {
  if (counts.install + counts.remove === 0) return 'Plan  ·  in sync';
  return `Plan  ·  pending +${counts.install} / −${counts.remove}`;
}

function mainMenuTitle(state, counts) {
  const pend =
    counts.install + counts.remove > 0
      ? pc.yellow(` · pending +${counts.install}/−${counts.remove}`)
      : pc.dim(' · in sync');
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
 * @param {import('./desired.js').ApplyPlan} [plan]
 */
function statusBlock(state, installed, plan) {
  const pplan = plan || planChanges(state, installed, presenceExtras(state));
  const lines = [
    `scope:    ${state.scope}`,
    `project:  ${shortPath(state.projectRoot)}`,
    `targets:  ${state.trees
      .map((t) => shortPath(destLabel(state.scope, t, state.projectRoot)))
      .join('\n          ')}`,
    `selected: ${state.selected.size}/${allSkillIds().length}  ${pc.dim('(● cart · Apply writes disk)')}`,
    ...summarizePlan(pplan).map((l) =>
      l.startsWith('(no')
        ? `pending:  ${pc.dim(l)}`
        : `pending:  ${pc.yellow(l)}`,
    ),
  ];
  return lines.join('\n');
}

/**
 * Explicit side-effect paths for Apply confirm (ccstatusline-style).
 * @param {import('./desired.js').ApplyPlan} plan
 * @param {import('./desired.js').DesiredState} state
 */
function sideEffectLines(plan, state) {
  /** @type {string[]} */
  const lines = [];
  const rootHint =
    state.scope === 'project'
      ? shortPath(state.projectRoot)
      : shortPath(userClaudeDir().replace(/\/\.claude$/, '')) +
        (state.scope === 'global' ? '' : '');

  void rootHint;
  for (const op of plan.skillOps) {
    const dest = shortPath(
      join(
        skillsDestForTree(
          op.tree,
          op.scope,
          op.scope === 'project' ? state.projectRoot : undefined,
        ),
        op.id,
      ),
    );
    lines.push(`${op.op === 'install' ? '+' : '−'} ${dest}`);
  }
  if (plan.needAgents) {
    lines.push(
      `+ ${shortPath(agentsDest(state.scope, state.projectRoot))}  (agent roster)`,
    );
  }
  if (plan.needPool) {
    lines.push(
      `+ ${shortPath(poolDest(state.scope, state.projectRoot))}`,
    );
  }
  if (plan.removeAgentsIfOrphan) {
    lines.push(
      `− ${shortPath(agentsDest(state.scope, state.projectRoot))}  (roster if orphan)`,
    );
    lines.push(
      `− ${shortPath(poolDest(state.scope, state.projectRoot))}`,
    );
  }
  if (!lines.length) lines.push('(no file changes)');
  // cap display
  if (lines.length > 18) {
    const head = lines.slice(0, 16);
    head.push(`… +${lines.length - 16} more`);
    return head;
  }
  return lines;
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
function showStatus(state, installed) {
  const plan = planChanges(state, installed, presenceExtras(state));
  p.note(statusBlock(state, installed, plan), 'Status');

  /** @type {string[]} */
  const rows = [];
  for (const g of SKILL_GROUPS) {
    rows.push(pc.bold(g.label));
    for (const s of g.skills) {
      const want = state.selected.has(s.id) ? '●' : '○';
      const disk = skillStatus(installed, s.id, state.scope, state.trees);
      const diskMark =
        disk === 'installed'
          ? pc.green('on')
          : disk === 'partial'
            ? pc.yellow('partial')
            : pc.dim('off');
      rows.push(
        `  ${want} ${s.id.padEnd(26)} ${diskMark}  ${pc.dim(s.hint)}`,
      );
    }
  }
  p.note(rows.join('\n'), 'Selected (●) vs disk');
  if (!planIsEmpty(plan)) {
    p.note(sideEffectLines(plan, state).join('\n'), 'Would write');
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
          hint: 'every group · optional filter',
        },
        ...SKILL_GROUPS.map((g) => {
          const selected = g.skills.filter((s) => state.selected.has(s.id)).length;
          return {
            value: g.id,
            label: g.label,
            hint: `${selected}/${g.skills.length} selected · ${g.hint}`,
          };
        }),
        { value: 'back', label: '← Back', hint: 'main menu' },
      ],
    }),
  );
  if (groupId === 'back') return;

  let skills =
    groupId === 'all'
      ? SKILL_GROUPS.flatMap((g) =>
          g.skills.map((s) => ({ ...s, group: g.label })),
        )
      : (SKILL_GROUPS.find((g) => g.id === groupId)?.skills || []).map(
          (s) => ({ ...s, group: groupId }),
        );

  // Type-to-filter (ccstatusline-style search) for large sets / All
  if (skills.length > 6 || groupId === 'all') {
    const q = isCancel(
      await p.text({
        message: 'Filter skills (empty = all in view)',
        placeholder: 'e.g. design, search, beads',
      }),
    );
    const query = String(q || '')
      .trim()
      .toLowerCase();
    if (query) {
      skills = skills.filter(
        (s) =>
          s.id.includes(query) ||
          s.label.toLowerCase().includes(query) ||
          s.hint.toLowerCase().includes(query) ||
          String(s.group || '')
            .toLowerCase()
            .includes(query),
      );
      if (!skills.length) {
        p.log.warn(`No skills match “${query}”.`);
        return;
      }
      p.log.message(pc.dim(`${skills.length} match(es) for “${query}”`));
    }
  }

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
          disk === 'installed'
            ? 'on disk'
            : disk === 'partial'
              ? 'partial'
              : 'not installed';
        const groupBit =
          groupId === 'all' && s.group ? `${s.group} · ` : '';
        return {
          value: s.id,
          label: s.label,
          hint: `${groupBit}${mark} · ${s.hint}`,
        };
      }),
      initialValues: initial,
      required: false,
    }),
  );

  // multiselect replaces selection for the browsed (filtered) set only
  const browsedIds = new Set(skills.map((s) => s.id));
  for (const id of browsedIds) {
    setSelected(state, id, picked.includes(id));
  }

  p.log.success(
    `Cart updated · ${picked.length}/${browsedIds.size} selected in this view · Apply to write disk`,
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
          hint: shortPath(`${projectRoot}/.claude/skills`),
        },
        {
          value: 'global',
          label: 'Global',
          hint: shortPath(`${userClaudeDir()}/skills`),
        },
      ],
      initialValue: state.scope,
    }),
  );

  if (next === state.scope) {
    p.log.message(pc.dim('Scope unchanged.'));
    return;
  }

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
        message:
          'Nothing installed there — seed default CORE+AUTHOR+SEARCH selection?',
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
          hint: 'Claude Code skills (required)',
        },
        {
          value: 'agents',
          label: '.agents/skills',
          hint: 'portable mirror — symlink → copy fallback',
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
  if (state.trees.includes('agents')) {
    p.log.message(
      pc.dim(
        'Agents tree will symlink (or copy) each skill to the Claude install.',
      ),
    );
  }
}

/**
 * @param {import('./desired.js').DesiredState} state
 * @param {import('./scan.js').InstalledSkill[]} installed
 */
async function doApply(state, installed) {
  const plan = planChanges(state, installed, presenceExtras(state));
  if (planIsEmpty(plan)) {
    p.log.info(
      'Nothing to apply — selection matches disk for this scope/targets.',
    );
    return;
  }

  p.note(summarizePlan(plan).join('\n'), 'Plan summary');
  p.note(sideEffectLines(plan, state).join('\n'), 'Files that will change');

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

  // Keys only when search skills newly installed
  const installedClaude = new Set(
    result.installed
      .filter((x) => x.endsWith('@claude'))
      .map((x) => x.replace(/@claude$/, '')),
  );
  if (installedClaude.has('brave-search') && !hasBraveKey()) {
    await maybePromptBrave();
  }
  if (installedClaude.has('tavily-search') && !hasTavilyKey()) {
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

async function manageKeys() {
  p.note(
    [
      `Settings: ${settingsPathForDisplay()}`,
      `Brave:  ${hasBraveKey() ? 'set' : 'not set'}`,
      `Tavily: ${hasTavilyKey() ? 'set' : 'not set'}`,
      'Keys never go into the project tree.',
    ].join('\n'),
    'API keys',
  );

  const action = isCancel(
    await p.select({
      message: 'API keys',
      options: [
        {
          value: 'brave',
          label: hasBraveKey() ? 'Update Brave key' : 'Set Brave key',
          hint: 'BRAVE_API_KEY',
        },
        {
          value: 'tavily',
          label: hasTavilyKey() ? 'Update Tavily key' : 'Set Tavily key',
          hint: 'TAVILY_API_KEY',
        },
        { value: 'back', label: '← Back' },
      ],
    }),
  );

  if (action === 'back') return;
  if (action === 'brave') await maybePromptBraveForce();
  if (action === 'tavily') await maybePromptTavilyForce();
}

async function maybePromptBraveForce() {
  const key = isCancel(
    await p.password({
      message: `Brave API key (Enter cancel) — ${settingsPathForDisplay()}`,
    }),
  );
  if (key && String(key).trim()) {
    setEnvKey('BRAVE_API_KEY', String(key).trim());
    p.log.success('BRAVE_API_KEY saved. Restart Claude Code to pick up.');
  } else {
    p.log.message(pc.dim('Left Brave key unchanged.'));
  }
}

async function maybePromptTavilyForce() {
  const key = isCancel(
    await p.password({
      message: `Tavily API key (Enter cancel) — ${settingsPathForDisplay()}`,
    }),
  );
  if (key && String(key).trim()) {
    setEnvKey('TAVILY_API_KEY', String(key).trim());
    p.log.success('TAVILY_API_KEY saved. Restart Claude Code to pick up.');
  } else {
    p.log.message(pc.dim('Left Tavily key unchanged.'));
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
          hint: 'cart only — Apply to write',
        },
        {
          value: 'clear-selection',
          label: 'Clear selection',
          hint: 'deselect all · Apply uninstalls suite skills in scope',
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
        message:
          'Clear all selected skills? (Apply later removes them from this scope/targets)',
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

// keep findSkill available for future detail views without unused-import noise in some linters
void findSkill;
