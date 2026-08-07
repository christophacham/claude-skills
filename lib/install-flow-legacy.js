import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  SEARCH_SKILLS,
  PROJECT_SUGGESTED,
  CORE_SKILLS,
  OTHER_SKILLS,
} from './catalog.js';
import { resolveProjectRoot } from './paths.js';
import { installSkillsBundle } from './fs-ops.js';
import { recordGlobalInstall } from './manifest.js';
import { ensureSkillDeps } from './deps.js';
import {
  hasBraveKey,
  hasTavilyKey,
  setEnvKey,
  settingsPathForDisplay,
} from './settings.js';

function isCancel(v) {
  if (p.isCancel(v)) {
    p.cancel('Install cancelled.');
    process.exit(0);
  }
  return v;
}

/**
 * @param {{ projectPath?: string, skipDeps?: boolean }} opts
 */
export async function runLegacyInstallFlow(opts = {}) {
  p.intro(pc.bgCyan(pc.black(' claude-skills ')) + pc.dim(' selective installer'));

  let projectRoot;
  try {
    projectRoot = resolveProjectRoot(opts.projectPath);
  } catch (e) {
    p.log.error(e.message);
    process.exit(1);
  }

  p.note(
    [
      `Package: skills + agents from this repo`,
      `Global target:  ~/.claude/`,
      `Project target: ${projectRoot}/.claude/`,
      `API keys always go to ~/.claude/settings.json`,
      `Global installs are tracked for smart uninstall`,
      `Groups: SEARCH · CORE (default-yes) · AUTHOR · OPT_IN/BEADS (offer-only)`,
    ].join('\n'),
    'Where things land',
  );

  // --- 1. Search skills (global) ---
  const wantSearch = isCancel(
    await p.confirm({
      message: 'Install search skills globally? (ddg + brave + tavily → ~/.claude)',
      initialValue: true,
    }),
  );

  /** @type {string[]} */
  let searchIds = [];
  if (wantSearch) {
    const picked = isCancel(
      await p.multiselect({
        message: 'Which search skills?',
        options: SEARCH_SKILLS.map((s) => ({
          value: s.id,
          label: s.label,
          hint: s.hint,
        })),
        initialValues: SEARCH_SKILLS.map((s) => s.id),
        required: false,
      }),
    );
    searchIds = picked;
    if (searchIds.length) {
      const spin = p.spinner();
      spin.start('Installing search skills globally');
      const bundle = installSkillsBundle(searchIds, 'global');
      recordGlobalInstall(bundle);
      if (!opts.skipDeps) {
        const depLines = ensureSkillDeps(searchIds, 'global');
        spin.stop('Search skills installed globally');
        for (const line of depLines) p.log.message(pc.dim(line));
      } else {
        spin.stop('Search skills installed globally (deps skipped)');
      }
    } else {
      p.log.info('No search skills selected.');
    }

    // Keys only if relevant skill installed
    if (searchIds.includes('brave-search') && !hasBraveKey()) {
      const key = isCancel(
        await p.password({
          message: `Brave API key (Enter to skip) — stored in ${settingsPathForDisplay()}`,
        }),
      );
      if (key && String(key).trim()) {
        setEnvKey('BRAVE_API_KEY', String(key).trim());
        p.log.success('BRAVE_API_KEY saved (not printed). Restart Claude Code to pick up.');
      } else {
        p.log.message(pc.dim('Brave key skipped — ddg-search still works without a key.'));
      }
    } else if (searchIds.includes('brave-search') && hasBraveKey()) {
      p.log.info(pc.dim('Brave key already set (not printed).'));
    }

    if (searchIds.includes('tavily-search') && !hasTavilyKey()) {
      const key = isCancel(
        await p.password({
          message: `Tavily API key (Enter to skip) — stored in ${settingsPathForDisplay()}`,
        }),
      );
      if (key && String(key).trim()) {
        setEnvKey('TAVILY_API_KEY', String(key).trim());
        p.log.success('TAVILY_API_KEY saved (not printed). Restart Claude Code to pick up.');
      } else {
        p.log.message(pc.dim('Tavily key skipped.'));
      }
    } else if (searchIds.includes('tavily-search') && hasTavilyKey()) {
      p.log.info(pc.dim('Tavily key already set (not printed).'));
    }
  } else {
    p.log.message(pc.dim('Skipped global search skills.'));
  }

  // --- 2. AUTHOR project tools ---
  const wantProjectTools = isCancel(
    await p.confirm({
      message: `Install skill-authoring tools in this project? (${PROJECT_SUGGESTED.map((s) => s.id).join(', ')})`,
      initialValue: true,
    }),
  );

  if (wantProjectTools) {
    const picked = isCancel(
      await p.multiselect({
        message: 'Project tools to install into .claude/skills',
        options: PROJECT_SUGGESTED.map((s) => ({
          value: s.id,
          label: s.label,
          hint: s.hint,
        })),
        initialValues: PROJECT_SUGGESTED.map((s) => s.id),
        required: false,
      }),
    );
    if (picked.length) {
      const spin = p.spinner();
      spin.start(`Installing into ${projectRoot}/.claude`);
      installSkillsBundle(picked, 'project', projectRoot);
      spin.stop(`Installed ${picked.length} project skill(s)`);
    }
  }

  // --- 3. CORE skills (default-yes) ---
  const wantCore = isCancel(
    await p.confirm({
      message: `Install CORE skills? (${CORE_SKILLS.map((s) => s.id).join(', ')})`,
      initialValue: true,
    }),
  );

  if (wantCore) {
    const coreIds = isCancel(
      await p.multiselect({
        message: 'Which CORE skills?',
        options: CORE_SKILLS.map((s) => ({
          value: s.id,
          label: s.label,
          hint: s.hint,
        })),
        initialValues: CORE_SKILLS.map((s) => s.id),
        required: false,
      }),
    );

    if (coreIds.length) {
      const coreScope = isCancel(
        await p.select({
          message: 'Where should CORE skills install?',
          options: [
            { value: 'global', label: 'Globally', hint: '~/.claude (default)' },
            {
              value: 'project',
              label: 'This project only',
              hint: `${projectRoot}/.claude`,
            },
          ],
          initialValue: 'global',
        }),
      );

      const spin = p.spinner();
      spin.start(`Installing CORE → ${coreScope}`);
      const bundle = installSkillsBundle(
        coreIds,
        coreScope,
        coreScope === 'project' ? projectRoot : undefined,
      );
      if (coreScope === 'global') recordGlobalInstall(bundle);
      if (!opts.skipDeps) {
        const depLines = ensureSkillDeps(
          coreIds,
          coreScope,
          coreScope === 'project' ? projectRoot : undefined,
        );
        spin.stop(`Installed ${coreIds.length} CORE skill(s) → ${coreScope}`);
        for (const line of depLines) p.log.message(pc.dim(line));
      } else {
        spin.stop(`Installed ${coreIds.length} CORE skill(s) → ${coreScope}`);
      }
    } else {
      p.log.info('No CORE skills selected.');
    }
  } else {
    p.log.message(pc.dim('Skipped CORE skills.'));
  }

  // --- 4. OPT_IN + BEADS one-by-one (skip default) ---
  const more = isCancel(
    await p.confirm({
      message:
        'Offer OPT_IN / beads skills one-by-one? (architecture, distributed, geometric, beads — default skip)',
      initialValue: true,
    }),
  );

  if (more) {
    p.note(
      'For each skill: Skip (default) · Global · Project · Done (stop asking).\n' +
        'beads also installs the agent roster + optional pool.md when chosen.',
      'OPT_IN / BEADS placement',
    );

    for (const skill of OTHER_SKILLS) {
      const choice = isCancel(
        await p.select({
          message: `${skill.label}  ${pc.dim(skill.hint)}`,
          options: [
            { value: 'skip', label: 'Skip', hint: 'leave uninstalled (default)' },
            { value: 'global', label: 'Install globally', hint: '~/.claude' },
            {
              value: 'project',
              label: 'Install in this project',
              hint: `${projectRoot}/.claude`,
            },
            { value: 'done', label: 'Done', hint: 'stop asking about the rest' },
          ],
          initialValue: 'skip',
        }),
      );

      if (choice === 'done') {
        p.log.message(pc.dim('Stopped early — remaining skills left untouched.'));
        break;
      }
      if (choice === 'skip') continue;

      const scope = choice === 'global' ? 'global' : 'project';
      const spin = p.spinner();
      spin.start(`Installing ${skill.id} (${scope})`);
      const bundle = installSkillsBundle(
        [skill.id],
        scope,
        scope === 'project' ? projectRoot : undefined,
      );
      if (scope === 'global') recordGlobalInstall(bundle);
      if (!opts.skipDeps) {
        const depLines = ensureSkillDeps(
          [skill.id],
          scope,
          scope === 'project' ? projectRoot : undefined,
        );
        spin.stop(`Installed ${skill.id} → ${scope}`);
        for (const line of depLines) p.log.message(pc.dim(line));
      } else {
        spin.stop(`Installed ${skill.id} → ${scope}`);
      }
    }
  }

  p.outro(
    pc.green('Done.') +
      pc.dim('  Global uninstall later: ') +
      pc.cyan('npx claude-skills uninstall') +
      pc.dim(' (only removes items this CLI tracked).'),
  );
}
