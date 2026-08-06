#!/usr/bin/env node
/**
 * Selective interactive installer for claude-skills.
 *   node bin/cli.js install [--project <dir>] [--skip-deps]
 *   node bin/cli.js uninstall [--yes]
 *
 * Existing install.sh / install.ps1 remain for full bulk installs.
 * This CLI tracks global installs in ~/.claude/claude-skills-manifest.json
 * and only uninstalls what it recorded.
 */
import { parseArgs } from 'node:util';
import { runInstallFlow } from '../lib/install-flow.js';
import { runUninstallFlow } from '../lib/uninstall-flow.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: { type: 'string', short: 'p' },
    'skip-deps': { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'install';

if (values.help) {
  console.log(`claude-skills — selective installer (Node)

Usage:
  claude-skills install [--project <dir>] [--skip-deps]
  claude-skills uninstall [--yes]

  install     Interactive: search skills globally, project tools,
              then remaining skills one-by-one (global / project / skip / done).
  uninstall   Remove only globally tracked items from this CLI's manifest
              (~/.claude/claude-skills-manifest.json). Does not touch
              project installs or bulk install.sh installs.

Options:
  -p, --project <dir>   Project root for project-local installs (default: cwd)
      --skip-deps       Skip npm/pip/uv dependency setup
  -y, --yes             Uninstall without confirm
  -h, --help            Show help

Bulk installers (unchanged):
  ./install.sh / .\\install.ps1
  ./uninstall.sh / .\\uninstall.ps1
`);
  process.exit(0);
}

if (command === 'install') {
  await runInstallFlow({
    projectPath: values.project,
    skipDeps: values['skip-deps'],
  });
} else if (command === 'uninstall') {
  await runUninstallFlow({ yes: values.yes });
} else {
  console.error(`Unknown command: ${command}. Try install | uninstall | --help`);
  process.exit(1);
}
