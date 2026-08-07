/**
 * Full-screen installer App (Ink) — ccstatusline-style layout:
 * sticky plan header + one active screen, redrawn in place.
 */
import { useCallback, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  SKILL_GROUPS,
  allSkillIds,
  defaultSelectedSkillIds,
  TOP_LEVEL_AGENTS,
} from '../catalog.js';
import {
  resolveProjectRoot,
  destLabel,
  userClaudeDir,
  agentsDest,
  poolDest,
  skillsDestForTree,
  globalManifestPath,
} from '../paths.js';
import {
  scanAllInstalled,
  skillStatus,
  isInstalledOtherScope,
  otherScope,
} from '../scan.js';
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
} from '../desired.js';
import { applyPlan } from '../apply.js';
import {
  hasBraveKey,
  hasTavilyKey,
  setEnvKey,
  settingsPathForDisplay,
} from '../settings.js';
import {
  loadManifest,
  clearManifest,
  manifestHasAnything,
} from '../manifest.js';
import {
  removeSkill,
  removeAgents,
  removePanelists,
  removePool,
} from '../fs-ops.js';
import { PANELIST_AGENTS } from '../catalog.js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { h } from './h.js';
import { List } from './List.js';
import { MultiCheck } from './MultiCheck.js';
import { TextPrompt } from './TextPrompt.js';

/**
 * @typedef {'main'|'browse-groups'|'browse-skills'|'scope'|'targets'|'status'|'apply'|'manage'|'keys'|'key-input'|'confirm-exit'|'global-uninstall'|'message'} Screen
 */

function shortPath(s) {
  const home = userClaudeDir().replace(/\/\.claude$/, '');
  if (s.startsWith(home)) return `~${s.slice(home.length)}`;
  return s;
}

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

function sideEffectLines(plan, state) {
  /** @type {string[]} */
  const lines = [];
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
    lines.push(`+ ${shortPath(agentsDest(state.scope, state.projectRoot))}  (agents)`);
  }
  if (plan.needPool) {
    lines.push(`+ ${shortPath(poolDest(state.scope, state.projectRoot))}`);
  }
  if (plan.removeAgentsIfOrphan) {
    lines.push(`− agents roster / pool (orphan)`);
  }
  if (!lines.length) lines.push('(no file changes)');
  if (lines.length > 14) {
    return [...lines.slice(0, 12), `… +${lines.length - 12} more`];
  }
  return lines;
}

/**
 * @param {{ projectPath?: string, skipDeps?: boolean }} props
 */
export function App({ projectPath, skipDeps = false }) {
  const { exit } = useApp();

  const [boot] = useState(() => {
    try {
      const projectRoot = resolveProjectRoot(projectPath);
      const installed = scanAllInstalled(projectRoot);
      const s = createDesiredState({
        projectRoot,
        scope: 'project',
        trees: ['claude'],
        skipDeps,
        seedFromInstalled: installed,
      });
      if (s.selected.size === 0) {
        for (const id of defaultSelectedSkillIds()) s.selected.add(id);
      }
      return { ok: true, projectRoot, state: s, error: null };
    } catch (e) {
      return { ok: false, projectRoot: null, state: null, error: e.message };
    }
  });

  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // hooks that always run (rules of hooks)
  const [screen, setScreen] = useState(/** @type {Screen} */ ('main'));
  const [browseGroup, setBrowseGroup] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [awaitingFilter, setAwaitingFilter] = useState(false);
  const [flash, setFlash] = useState(/** @type {string|null} */ (null));
  const [keyTarget, setKeyTarget] = useState(
    /** @type {'brave'|'tavily'|null} */ (null),
  );
  const [message, setMessage] = useState(
    /** @type {{ title: string, lines: string[] }|null} */ (null),
  );
  const [applying, setApplying] = useState(false);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  if (!boot.ok) {
    return h(
      Box,
      { flexDirection: 'column', padding: 1 },
      h(Text, { color: 'red' }, boot.error),
      h(Text, { dimColor: true }, 'Press Ctrl+C to exit'),
    );
  }

  const projectRoot = boot.projectRoot;
  const state = boot.state;

  // Force re-read of disk + plan when tick changes
  void tick;
  const installed = scanAllInstalled(projectRoot);
  const extras = presenceExtras(state);
  const plan = planChanges(state, installed, extras);
  const counts = planCounts(plan);
  const blockedCount = plan.blocked?.length || 0;
  const pendingOps = counts.install + counts.remove;
  const headerColor = blockedCount ? 'red' : pendingOps ? 'yellow' : 'cyan';
  const headerStatus = blockedCount
    ? `  ·  ${blockedCount} blocked` + (pendingOps ? ` · pending +${counts.install}/−${counts.remove}` : '')
    : pendingOps
      ? `  ·  pending +${counts.install}/−${counts.remove}`
      : '  ·  in sync';

  const goMain = () => {
    setFlash(null);
    setScreen('main');
    refresh();
  };

  const header = h(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: headerColor,
      paddingX: 1,
      marginBottom: 1,
    },
    h(
      Text,
      { bold: true, color: headerColor === 'red' ? 'red' : 'cyan' },
      `claude-skills wizard  ·  ${state.scope}` + headerStatus,
    ),
    h(Text, { dimColor: true }, `project  ${shortPath(state.projectRoot)}`),
    h(
      Text,
      { dimColor: true },
      `targets  ${state.trees.map((t) => shortPath(destLabel(state.scope, t, state.projectRoot))).join('  ·  ')}`,
    ),
    h(
      Text,
      { dimColor: true },
      `selected ${state.selected.size}/${allSkillIds().length}  ·  cart only until Apply  ·  ctrl+c quit`,
    ),
    ...summarizePlan(plan).map((line, i) =>
      h(
        Text,
        {
          key: `p-${i}`,
          color: line.startsWith('blocked')
            ? 'red'
            : line.startsWith('(no')
              ? undefined
              : 'yellow',
          dimColor: line.startsWith('(no'),
          bold: line.startsWith('blocked'),
        },
        line.startsWith('blocked') ? line : `pending  ${line}`,
      ),
    ),
    blockedCount
      ? h(
          Text,
          { color: 'red' },
          `⚠ same skill name already in ${state.scope === 'project' ? 'global' : 'project'} — install blocked (see Status / Apply)`,
        )
      : null,
    flash ? h(Text, { color: 'green' }, flash) : null,
  );

  /** @type {any} */
  let body;

  if (screen === 'main') {
    body = h(List, {
      items: [
        {
          label: 'Browse & select skills',
          value: 'browse',
          description: 'Groups · filter · toggle cart (does not write disk)',
        },
        {
          label: `Scope: ${state.scope}`,
          value: 'scope',
          sublabel: state.scope === 'project' ? shortPath(projectRoot) : '~/.claude',
          description: 'Project (default) or global ~/.claude/skills',
        },
        {
          label: `Targets: ${state.trees.join(' + ')}`,
          value: 'targets',
          description: '.claude/skills required · optional .agents/skills mirror (symlink)',
        },
        {
          label: 'Status detail',
          value: 'status',
          sublabel: blockedCount
            ? `${blockedCount} blocked`
            : pendingOps
              ? `+${counts.install}/−${counts.remove}`
              : 'in sync',
          description:
            'Selected (●) vs on-disk; warns when the same name exists in the other scope',
        },
        {
          label: pendingOps
            ? `Apply changes  (+${counts.install}/−${counts.remove})`
            : blockedCount
              ? `Apply changes  (${blockedCount} blocked)`
              : 'Apply changes',
          value: 'apply',
          sublabel: pendingOps
            ? 'writes disk'
            : blockedCount
              ? 'no installs across scopes'
              : 'nothing pending',
          description:
            'Review paths and apply. Cross-scope duplicates are never installed.',
        },
        {
          label: 'API keys',
          value: 'keys',
          sublabel: `${hasBraveKey() ? 'brave✓' : 'brave·'} ${hasTavilyKey() ? 'tavily✓' : 'tavily·'}`,
          description: 'Brave / Tavily → ~/.claude/settings.json only',
        },
        {
          label: 'Manage installation',
          value: 'manage',
          description: 'Resync · defaults · clear cart · global tracked uninstall',
        },
        '-',
        {
          label: 'Exit',
          value: 'exit',
          sublabel: counts.install + counts.remove ? 'pending discarded' : '',
          description: 'Leave the wizard',
        },
      ],
      onSelect: (value) => {
        if (value === 'browse') setScreen('browse-groups');
        else if (value === 'scope') setScreen('scope');
        else if (value === 'targets') setScreen('targets');
        else if (value === 'status') setScreen('status');
        else if (value === 'apply') setScreen('apply');
        else if (value === 'keys') setScreen('keys');
        else if (value === 'manage') setScreen('manage');
        else if (value === 'exit') {
          if (pendingOps > 0) setScreen('confirm-exit');
          else exit();
        }
      },
    });
  } else if (screen === 'browse-groups') {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true }, 'Skill group'),
      h(Text, { dimColor: true }, '↑↓ · Enter · ESC back'),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        showBack: true,
        onBack: goMain,
        items: [
          {
            label: 'All',
            value: 'all',
            description: 'Every skill · optional filter',
          },
          ...SKILL_GROUPS.map((g) => {
            const n = g.skills.filter((s) => state.selected.has(s.id)).length;
            return {
              label: g.label,
              value: g.id,
              sublabel: `${n}/${g.skills.length}`,
              description: g.hint,
            };
          }),
        ],
        onSelect: (value) => {
          setBrowseGroup(value);
          setFilterQuery('');
          if (value === 'all' || (SKILL_GROUPS.find((g) => g.id === value)?.skills.length || 0) > 6) {
            setAwaitingFilter(true);
            setScreen('browse-skills');
          } else {
            setAwaitingFilter(false);
            setScreen('browse-skills');
          }
        },
      }),
    );
  } else if (screen === 'browse-skills' && awaitingFilter) {
    body = h(TextPrompt, {
      message: 'Filter skills (empty = all in view)',
      placeholder: 'e.g. design, search, beads',
      onCancel: () => {
        setAwaitingFilter(false);
        setScreen('browse-groups');
      },
      onSubmit: (q) => {
        setFilterQuery(q.trim().toLowerCase());
        setAwaitingFilter(false);
      },
    });
  } else if (screen === 'browse-skills') {
    let skills =
      browseGroup === 'all'
        ? SKILL_GROUPS.flatMap((g) => g.skills.map((s) => ({ ...s, group: g.label })))
        : (SKILL_GROUPS.find((g) => g.id === browseGroup)?.skills || []).map((s) => ({
            ...s,
            group: browseGroup,
          }));
    if (filterQuery) {
      skills = skills.filter(
        (s) =>
          s.id.includes(filterQuery) ||
          s.label.toLowerCase().includes(filterQuery) ||
          s.hint.toLowerCase().includes(filterQuery) ||
          String(s.group || '')
            .toLowerCase()
            .includes(filterQuery),
      );
    }
    if (!skills.length) {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { color: 'yellow' }, 'No skills match.'),
        h(List, {
          items: [{ label: '← Back', value: 'back' }],
          onSelect: () => setScreen('browse-groups'),
        }),
      );
    } else {
      body = h(MultiCheck, {
        title:
          browseGroup === 'all'
            ? `All skills${filterQuery ? ` · filter “${filterQuery}”` : ''}`
            : SKILL_GROUPS.find((g) => g.id === browseGroup)?.label || browseGroup,
        items: skills.map((s) => {
          const disk = skillStatus(installed, s.id, state.scope, state.trees);
          const cross = isInstalledOtherScope(installed, s.id, state.scope);
          const mark =
            disk === 'installed'
              ? 'on disk'
              : disk === 'partial'
                ? 'partial'
                : 'off';
          const crossMark = cross
            ? ` · ⚠ also ${otherScope(state.scope)}`
            : '';
          return {
            id: s.id,
            label: s.label,
            hint: `${mark}${crossMark} · ${s.hint}`,
          };
        }),
        initialSelected: skills.filter((s) => state.selected.has(s.id)).map((s) => s.id),
        onCancel: () => setScreen('browse-groups'),
        onConfirm: (ids) => {
          const browsed = new Set(skills.map((s) => s.id));
          const picked = new Set(ids);
          for (const id of browsed) setSelected(state, id, picked.has(id));
          setFlash(`Cart updated · ${ids.length}/${browsed.size} in view`);
          refresh();
          setScreen('browse-groups');
        },
      });
    }
  } else if (screen === 'scope') {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true }, 'Install scope'),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        showBack: true,
        onBack: goMain,
        items: [
          {
            label: 'Project',
            value: 'project',
            sublabel: shortPath(`${projectRoot}/.claude/skills`),
            description: 'Default — skills live with the repo',
          },
          {
            label: 'Global',
            value: 'global',
            sublabel: '~/.claude/skills',
            description: 'User-wide Claude Code skills',
          },
        ],
        onSelect: (value) => {
          if (value === state.scope) {
            goMain();
            return;
          }
          // resync from disk by default
          setScope(state, value, installed, { resyncSelected: true });
          if (state.selected.size === 0) {
            setManySelected(state, defaultSelectedSkillIds(), true);
          }
          setFlash(`Scope → ${state.scope}`);
          goMain();
        },
      }),
    );
  } else if (screen === 'targets') {
    body = h(MultiCheck, {
      title: 'Skill targets (Claude is primary)',
      items: [
        { id: 'claude', label: '.claude/skills', hint: 'required' },
        {
          id: 'agents',
          label: '.agents/skills',
          hint: 'symlink mirror → copy fallback',
        },
      ],
      initialSelected: state.trees,
      onCancel: goMain,
      onConfirm: (ids) => {
        const trees = ids.includes('claude') ? ids : ['claude', ...ids];
        setTrees(state, /** @type {any} */ (trees));
        setFlash(`Targets → ${state.trees.join(', ')}`);
        goMain();
      },
    });
  } else if (screen === 'status') {
    const rows = [];
    for (const g of SKILL_GROUPS) {
      rows.push(h(Text, { key: `g-${g.id}`, bold: true, color: 'magenta' }, g.label));
      for (const s of g.skills) {
        const want = state.selected.has(s.id) ? '●' : '○';
        const disk = skillStatus(installed, s.id, state.scope, state.trees);
        const cross = isInstalledOtherScope(installed, s.id, state.scope);
        const diskMark =
          disk === 'installed' ? 'on' : disk === 'partial' ? 'partial' : 'off';
        const crossBit = cross ? ` ⚠${otherScope(state.scope)}` : '';
        rows.push(
          h(
            Text,
            {
              key: s.id,
              color:
                cross && state.selected.has(s.id) && disk !== 'installed'
                  ? 'red'
                  : undefined,
            },
            `  ${want} ${s.id.padEnd(26)} ${diskMark.padEnd(8)}${crossBit} ${s.hint}`,
          ),
        );
      }
    }
    const blockedBox =
      blockedCount > 0
        ? h(
            Box,
            { flexDirection: 'column', marginBottom: 1 },
            h(
              Text,
              { bold: true, color: 'red' },
              'Blocked — already installed in other scope (by name)',
            ),
            ...plan.blocked.map((b, i) =>
              h(
                Text,
                { key: `b-${i}`, color: 'red' },
                `  ${b.id} → ${b.otherScope}: ${b.paths.map(shortPath).join(', ') || b.otherScope}`,
              ),
            ),
            h(
              Text,
              { dimColor: true },
              '  Fix: switch Scope to manage the existing copy, or remove it there first.',
            ),
          )
        : null;
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true }, 'Selected (●) vs disk'),
      h(
        Text,
        { dimColor: true },
        `active scope: ${state.scope} · ⚠ = same id also present elsewhere`,
      ),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      ...rows,
      h(Box, { height: 1 }, h(Text, null, ' ')),
      blockedBox,
      !planIsEmpty(plan)
        ? h(
            Box,
            { flexDirection: 'column', marginBottom: 1 },
            h(Text, { bold: true, color: 'yellow' }, 'Would write'),
            ...sideEffectLines(plan, state).map((l, i) =>
              h(Text, { key: `e-${i}`, dimColor: true }, l),
            ),
          )
        : null,
      h(List, {
        items: [{ label: '← Back', value: 'back' }],
        onSelect: goMain,
      }),
    );
  } else if (screen === 'apply') {
    if (planIsEmpty(plan) && !blockedCount) {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { color: 'green' }, 'Nothing to apply — cart matches disk.'),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(List, {
          items: [{ label: '← Back', value: 'back' }],
          onSelect: goMain,
        }),
      );
    } else if (planIsEmpty(plan) && blockedCount) {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { bold: true, color: 'red' }, 'Nothing to write — installs blocked'),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(
          Text,
          { color: 'red' },
          'These skill names already exist in the other scope. This wizard will not install a second copy.',
        ),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        ...plan.blocked.map((b, i) =>
          h(
            Box,
            { key: `bb-${i}`, flexDirection: 'column', marginBottom: 1 },
            h(Text, { color: 'red', bold: true }, `• ${b.id}`),
            h(Text, { dimColor: true }, `  already: ${b.otherScope}`),
            ...b.paths.map((p, j) =>
              h(Text, { key: `bp-${j}`, dimColor: true }, `  ${shortPath(p)}`),
            ),
            h(Text, { dimColor: true }, `  ${b.reason}`),
          ),
        ),
        h(
          Text,
          { dimColor: true },
          'Switch Scope to manage the existing install, or uninstall it there, then retry.',
        ),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(List, {
          items: [
            {
              label: `Switch scope to ${otherScope(state.scope)}`,
              value: 'switch',
              description: 'Manage the copy that already exists',
            },
            { label: '← Back', value: 'back' },
          ],
          onSelect: (value) => {
            if (value === 'switch') {
              setScope(state, otherScope(state.scope), installed, {
                resyncSelected: true,
              });
              setFlash(`Scope → ${state.scope}`);
              goMain();
            } else goMain();
          },
        }),
      );
    } else if (applying) {
      body = h(Text, { color: 'cyan' }, 'Applying…');
    } else {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { bold: true }, 'Apply plan'),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        ...summarizePlan(plan).map((l, i) =>
          h(
            Text,
            {
              key: `s-${i}`,
              color: l.startsWith('blocked') ? 'red' : 'yellow',
              bold: l.startsWith('blocked'),
            },
            l,
          ),
        ),
        blockedCount
          ? h(
              Box,
              { flexDirection: 'column', marginY: 1 },
              h(Text, { color: 'red', bold: true }, 'Will NOT install (other scope owns name):'),
              ...plan.blocked.map((b, i) =>
                h(
                  Text,
                  { key: `bx-${i}`, color: 'red' },
                  `  ${b.id} — already ${b.otherScope}${b.paths[0] ? ` @ ${shortPath(b.paths[0])}` : ''}`,
                ),
              ),
            )
          : null,
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(Text, { bold: true }, 'Files that will change'),
        ...sideEffectLines(plan, state).map((l, i) =>
          h(Text, { key: `f-${i}`, dimColor: true }, l),
        ),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(List, {
          items: [
            {
              label: `Apply allowed ops to ${state.scope}`,
              value: 'yes',
              description: blockedCount
                ? `Writes +${counts.install}/−${counts.remove}; ${blockedCount} install(s) stay blocked`
                : 'Write skills / agents / pool / manifest as planned',
            },
            { label: 'Cancel', value: 'no' },
          ],
          onSelect: (value) => {
            if (value === 'no') {
              goMain();
              return;
            }
            setApplying(true);
            // next tick so UI can show Applying…
            setTimeout(() => {
              try {
                const result = applyPlan(plan, state);
                const parts = [
                  `+${result.installed.length}`,
                  `−${result.removed.length}`,
                ];
                if (result.blocked?.length) {
                  parts.push(`${result.blocked.length} blocked`);
                }
                if (result.errors.length) parts.push(`${result.errors.length} error(s)`);
                setFlash(`Applied ${parts.join(' / ')}`);
                setMessage({
                  title: result.blocked?.length
                    ? 'Apply result (some installs blocked)'
                    : 'Apply result',
                  lines: [
                    ...result.installed.map((x) => `install ${x}`),
                    ...result.removed.map((x) => `remove  ${x}`),
                    ...(result.blocked || []).map((x) => `BLOCKED ${x}`),
                    ...result.depLines,
                    ...result.errors.map((e) => `error: ${e}`),
                    result.agents
                      ? `agents ${result.agents.mode}: ${result.agents.agents.length} + panelists`
                      : '',
                  ].filter(Boolean),
                });
                setScreen('message');
              } catch (e) {
                setFlash(`Apply failed: ${e.message}`);
                goMain();
              } finally {
                setApplying(false);
                refresh();
              }
            }, 10);
          },
        }),
      );
    }
  } else if (screen === 'keys') {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true }, 'API keys'),
      h(Text, { dimColor: true }, settingsPathForDisplay()),
      h(Text, null, `Brave:  ${hasBraveKey() ? 'set' : 'not set'}`),
      h(Text, null, `Tavily: ${hasTavilyKey() ? 'set' : 'not set'}`),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        showBack: true,
        onBack: goMain,
        items: [
          {
            label: hasBraveKey() ? 'Update Brave key' : 'Set Brave key',
            value: 'brave',
          },
          {
            label: hasTavilyKey() ? 'Update Tavily key' : 'Set Tavily key',
            value: 'tavily',
          },
        ],
        onSelect: (value) => {
          setKeyTarget(value);
          setScreen('key-input');
        },
      }),
    );
  } else if (screen === 'key-input') {
    const name = keyTarget === 'brave' ? 'BRAVE_API_KEY' : 'TAVILY_API_KEY';
    body = h(TextPrompt, {
      message: `${name} (Enter save · ESC cancel) — never printed`,
      mask: true,
      onCancel: () => setScreen('keys'),
      onSubmit: (v) => {
        if (v && v.trim()) {
          setEnvKey(name, v.trim());
          setFlash(`${name} saved · restart Claude Code`);
        }
        setScreen('keys');
        refresh();
      },
    });
  } else if (screen === 'manage') {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true }, 'Manage installation'),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        showBack: true,
        onBack: goMain,
        items: [
          {
            label: 'Resync selection from disk',
            value: 'resync',
            description: `scope=${state.scope}`,
          },
          {
            label: 'Select defaults (CORE+AUTHOR+SEARCH)',
            value: 'defaults',
            description: 'Cart only — Apply to write',
          },
          {
            label: 'Clear selection',
            value: 'clear',
            description: 'Deselect all · Apply uninstalls suite skills in scope',
          },
          {
            label: 'Uninstall tracked GLOBAL items',
            value: 'global',
            description: globalManifestPath(),
          },
        ],
        onSelect: (value) => {
          if (value === 'resync') {
            setScope(state, state.scope, scanAllInstalled(projectRoot), {
              resyncSelected: true,
            });
            setFlash(`Selection ← disk (${state.selected.size})`);
            goMain();
          } else if (value === 'defaults') {
            state.selected = new Set(defaultSelectedSkillIds());
            setFlash('Default selection loaded');
            goMain();
          } else if (value === 'clear') {
            state.selected.clear();
            setFlash('Selection cleared');
            goMain();
          } else if (value === 'global') {
            setScreen('global-uninstall');
          }
        },
      }),
    );
  } else if (screen === 'global-uninstall') {
    const m = loadManifest();
    if (!manifestHasAnything(m)) {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { color: 'yellow' }, 'No tracked global installs.'),
        h(Text, { dimColor: true }, globalManifestPath()),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(List, {
          items: [{ label: '← Back', value: 'back' }],
          onSelect: () => setScreen('manage'),
        }),
      );
    } else {
      body = h(
        Box,
        { flexDirection: 'column' },
        h(Text, { bold: true, color: 'yellow' }, 'Remove tracked GLOBAL items?'),
        h(Text, { dimColor: true }, `skills: ${m.skills.join(', ') || '—'}`),
        h(Text, { dimColor: true }, `agents: ${m.agents.join(', ') || '—'}`),
        h(Box, { height: 1 }, h(Text, null, ' ')),
        h(List, {
          items: [
            { label: 'Yes, remove from ~/.claude', value: 'yes' },
            { label: 'Cancel', value: 'no' },
          ],
          onSelect: (value) => {
            if (value === 'yes') {
              for (const id of m.skills) removeSkill(id, 'global');
              removeAgents(m.agents, 'global');
              removePanelists(m.panelists, 'global');
              if (m.pool) removePool('global');
              // also remove panelists list if stored
              removePanelists(PANELIST_AGENTS, 'global');
              clearManifest();
              setFlash('Global tracked install cleared');
              goMain();
            } else {
              setScreen('manage');
            }
          },
        }),
      );
    }
  } else if (screen === 'confirm-exit') {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(
        Text,
        { color: 'yellow' },
        `Exit and discard pending +${counts.install}/−${counts.remove}?`,
      ),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        items: [
          { label: 'Stay', value: 'stay' },
          { label: 'Exit without applying', value: 'exit' },
        ],
        onSelect: (value) => {
          if (value === 'exit') exit();
          else goMain();
        },
      }),
    );
  } else if (screen === 'message' && message) {
    body = h(
      Box,
      { flexDirection: 'column' },
      h(Text, { bold: true, color: 'green' }, message.title),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      ...message.lines.slice(0, 20).map((l, i) => h(Text, { key: i, dimColor: true }, l)),
      h(Box, { height: 1 }, h(Text, null, ' ')),
      h(List, {
        items: [{ label: 'Continue', value: 'ok' }],
        onSelect: goMain,
      }),
    );
  } else {
    body = h(Text, null, '…');
  }

  return h(
    Box,
    { flexDirection: 'column', paddingX: 1, paddingY: 0 },
    header,
    body,
  );
}
