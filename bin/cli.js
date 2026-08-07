#!/usr/bin/env node
/**
 * Selective interactive installer for claude-skills.
 *
 *   npx -y github:christophacham/claude-skills   # full-screen Ink wizard
 *   node bin/cli.js
 *   node bin/cli.js install                      # same as wizard
 *   node bin/cli.js uninstall [--yes]
 *   node bin/cli.js install --clack              # old Clack step UI
 *   node bin/cli.js install --legacy             # oldest linear ladder
 */
import { parseArgs } from 'node:util';
import { runWizard, runClackWizard } from '../lib/wizard.js';
import { runUninstallFlow } from '../lib/uninstall-flow.js';
import { runLegacyInstallFlow } from '../lib/install-flow-legacy.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: { type: 'string', short: 'p' },
    'skip-deps': { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    legacy: { type: 'boolean', default: false },
    clack: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'wizard';

if (values.help) {
  console.log(`claude-skills — full-screen skill wizard (Ink)

Usage:
  claude-skills                 Open the full-screen wizard (default)
  claude-skills wizard          Same
  claude-skills install         Same as wizard (compat alias)
  claude-skills uninstall       Remove tracked GLOBAL items only
  claude-skills --help

  npx -y github:christophacham/claude-skills
  bunx github:christophacham/claude-skills

Options:
  -p, --project <dir>   Project root (default: cwd)
      --skip-deps       Skip npm/pip/uv dependency setup on apply
      --clack           Use scrolling Clack UI instead of full-screen Ink
      --legacy          Old linear confirm ladder
  -y, --yes             Uninstall without confirm
  -h, --help            Show help

Wizard defaults:
  • Full-screen TUI (like ccstatusline) — redraws in place
  • Scope: PROJECT (not global)
  • Target: .claude/skills only
  • Optional: .agents/skills mirror (symlink/copy)
  • Browse by group · sticky plan header · Apply writes disk
`);
  process.exit(0);
}

if (command === 'wizard' || command === 'install') {
  const opts = {
    projectPath: values.project,
    skipDeps: values['skip-deps'],
  };
  if (values.legacy) {
    await runLegacyInstallFlow(opts);
  } else if (values.clack) {
    await runClackWizard(opts);
  } else {
    await runWizard(opts);
  }
} else if (command === 'uninstall') {
  await runUninstallFlow({ yes: values.yes });
} else {
  console.error(`Unknown command: ${command}. Try wizard | install | uninstall | --help`);
  process.exit(1);
}
