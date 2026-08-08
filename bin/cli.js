#!/usr/bin/env node
/**
 * Selective interactive installer for claude-skills.
 *
 *   npx -y github:christophacham/claude-skills#v1.0.0   # full-screen Ink wizard
 *   bunx github:christophacham/claude-skills#v1.0.0
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
import {
  assertFreshSuitePayload,
  suiteVersion,
  releaseGitRef,
  installPin,
} from '../lib/suite-version.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    project: { type: 'string', short: 'p' },
    'skip-deps': { type: 'boolean', default: false },
    yes: { type: 'boolean', short: 'y', default: false },
    legacy: { type: 'boolean', default: false },
    clack: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
    version: { type: 'boolean', short: 'V', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'wizard';
const ver = suiteVersion();
const pin = installPin();

if (values.version) {
  console.log(`claude-skills v${ver}`);
  process.exit(0);
}

if (values.help) {
  console.log(`claude-skills v${ver} — full-screen skill wizard (Ink)

Usage:
  claude-skills                 Open the full-screen wizard (default)
  claude-skills wizard          Same
  claude-skills install         Same as wizard (compat alias)
  claude-skills uninstall       Remove tracked GLOBAL items only
  claude-skills --version
  claude-skills --help

  npx -y ${pin}
  bunx ${pin}

Options:
  -p, --project <dir>   Project root (default: cwd)
      --skip-deps       Skip npm/pip/uv dependency setup on apply
      --clack           Use scrolling Clack UI instead of full-screen Ink
      --legacy          Old linear confirm ladder
  -y, --yes             Uninstall without confirm
  -V, --version         Print suite version and exit
  -h, --help            Show help

Wizard defaults:
  • Full-screen TUI (like ccstatusline) — redraws in place
  • Scope: PROJECT (not global)
  • Target: .claude/skills only
  • Optional: .agents/skills mirror (symlink/copy)
  • Browse by group · sticky plan header · Apply writes disk

Install pin: prefer a release tag (this build: #${releaseGitRef()}). Patches
auto-tag on merge to main; major/minor are manual. #main is tip-of-branch and
may stick in bunx/npx caches after merges — see README if the catalog looks old.
`);
  process.exit(0);
}

// Offline gate: refuse pre-slim / retired skill payloads (stale github: cache).
// Uninstall does not need the package skills tree; still safe to check early.
assertFreshSuitePayload();

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
