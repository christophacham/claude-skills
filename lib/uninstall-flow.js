import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  loadManifest,
  clearManifest,
  manifestHasAnything,
} from './manifest.js';
import { globalManifestPath } from './paths.js';
import {
  removeSkill,
  removeAgents,
  removePanelists,
  removePool,
} from './fs-ops.js';

function isCancel(v) {
  if (p.isCancel(v)) {
    p.cancel('Uninstall cancelled.');
    process.exit(0);
  }
  return v;
}

/**
 * Smart uninstall: only global items recorded in the Node CLI manifest.
 * Does not touch project installs or items placed by install.sh / install.ps1
 * unless they were also recorded by this CLI.
 */
export async function runUninstallFlow(opts = {}) {
  p.intro(pc.bgYellow(pc.black(' claude-skills ')) + pc.dim(' smart global uninstall'));

  const m = loadManifest();
  if (!manifestHasAnything(m)) {
    p.log.warn(
      `No tracked global installs in ${globalManifestPath()}\n` +
        'This CLI only removes skills/agents it previously installed globally.\n' +
        'Shell installers (install.sh / install.ps1) are cleaned with uninstall.sh / uninstall.ps1.',
    );
    p.outro(pc.dim('Nothing to do.'));
    return;
  }

  const lines = [
    m.skills.length ? `skills:    ${m.skills.join(', ')}` : null,
    m.agents.length ? `agents:    ${m.agents.join(', ')}` : null,
    m.panelists.length ? `panelists: ${m.panelists.join(', ')}` : null,
    m.pool ? 'pool:      pool.md' : null,
  ].filter(Boolean);

  p.note(lines.join('\n'), 'Tracked global installs');

  if (!opts.yes) {
    const ok = isCancel(
      await p.confirm({
        message: 'Remove only these tracked items from ~/.claude?',
        initialValue: true,
      }),
    );
    if (!ok) {
      p.cancel('Left everything in place.');
      return;
    }
  }

  const spin = p.spinner();
  spin.start('Removing tracked global items');
  let count = 0;
  for (const id of m.skills) {
    if (removeSkill(id, 'global')) count++;
  }
  count += removeAgents(m.agents, 'global');
  count += removePanelists(m.panelists, 'global');
  if (m.pool && removePool('global')) count++;
  clearManifest();
  spin.stop(`Removed ${count} tracked item(s) from ~/.claude`);

  p.note(
    'API keys in settings.json were left alone.\n' +
      'Project .claude/ installs were not touched.\n' +
      'Global tools (ddgs, tvly, npm) were not uninstalled.',
    'Left alone',
  );

  p.outro(pc.green('Global tracked install cleared.'));
}
