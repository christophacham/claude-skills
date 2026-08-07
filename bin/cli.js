#!/usr/bin/env node
/**
 * Selective interactive installer for claude-skills.
 *
 *   npx claude-skills                 # wizard (project-default)
 *   bunx claude-skills
 *   node bin/cli.js
 *   node bin/cli.js install           # same as wizard (compat)
 *   node bin/cli.js uninstall [--yes] # tracked global smart uninstall
 */
import { parseArgs } from 'node:util';
import { runWizard } from '../lib/wizard.js';
import { runUninstallFlow } from '../lib/uninstall-flow.js';
import { runLegacyInstallFlow } from '../lib/install-flow-legacy.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: { type: 'string', short: 'p' },
    'skip-deps': { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    legacy: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'wizard';

if (values.help) {
  console.log(`claude-skills — interactive skill wizard (Node)

Usage:
  claude-skills                 Open the wizard (default)
  claude-skills wizard          Same
  claude-skills install         Same as wizard (compat alias)
  claude-skills uninstall       Remove tracked GLOBAL items only
  claude-skills --help

  npx -y claude-skills@latest
  bunx claude-skills

Options:
  -p, --project <dir>   Project root (default: cwd). Skills land in
                        <dir>/.claude/skills (and optionally .agents/skills).
      --skip-deps       Skip npm/pip/uv dependency setup on apply
      --legacy          Use the old linear install flow instead of wizard
  -y, --yes             Uninstall without confirm
  -h, --help            Show help

Wizard defaults:
  • Scope: PROJECT (not global)
  • Target: .claude/skills only
  • Optional: enable .agents/skills (symlink/copy mirror)
  • Browse skills by group: Search · Core · Author · Beads · Opt-in
  • Status shows selected vs on-disk; Apply installs/removes the diff
  • Global still available via Scope; tracked in
    ~/.claude/claude-skills-manifest.json
  • Project uninstall: deselect skills → Apply
`);
  process.exit(0);
}

if (command === 'wizard' || command === 'install') {
  if (values.legacy) {
    await runLegacyInstallFlow({
      projectPath: values.project,
      skipDeps: values['skip-deps'],
    });
  } else {
    await runWizard({
      projectPath: values.project,
      skipDeps: values['skip-deps'],
    });
  }
} else if (command === 'uninstall') {
  await runUninstallFlow({ yes: values.yes });
} else {
  console.error(`Unknown command: ${command}. Try wizard | install | uninstall | --help`);
  process.exit(1);
}
