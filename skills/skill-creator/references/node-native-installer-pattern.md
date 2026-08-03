# Node-native Agent Skill installer pattern

Reference implementation for packaging a skill repo as a portable Node CLI that works with both `npx` and `bunx` without requiring Bun. The principles, CLI checklist, and validation commands are in `SKILL.md`; this file is the code.

## package.json essentials

```json
{
  "type": "module",
  "bin": {
    "agent-skill-books": "bin/cli.js"
  },
  "files": [
    "bin/",
    "lib/",
    "skills/",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=20.11.0"
  }
}
```

Groups are registry-level labels; skills always live flat under `skills/`, so `files: ["skills/"]` covers every group.

## CLI entrypoint

```js
#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { installAll, installGroups, uninstallAll, uninstallGroups } from '../lib/installer.js';

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    all: { type: 'boolean', default: false },
    group: { type: 'string', multiple: true },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

const command = positionals[0] || 'install';
const opts = { dryRun: values['dry-run'] };

if (values.help) {
  console.log(`Usage: agent-skill-books [install|uninstall] [--all] [--group <name>] [--dry-run]`);
  process.exit(0);
}

if (command === 'install') {
  const skills = values.all
    ? installAll('global', opts)
    : installGroups(values.group ?? [], 'global', opts);
  console.log(`Installed ${skills.length} skills globally.`);
} else if (command === 'uninstall') {
  const skills = values.all
    ? uninstallAll('global', opts)
    : uninstallGroups(values.group ?? [], 'global', opts);
  console.log(`Removed ${skills.length} skills globally.`);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
```

Interactive prompts can be added, but keep the non-interactive path simple and scriptable.

## Registry pattern

```js
export const GROUPS = [
  {
    name: 'design',
    label: 'A Philosophy of Software Design',
    type: 'multi',
    skills: ['simple-design', 'refactoring'],
  },
  {
    name: 'skill-creator',
    label: 'Skill Creator',
    type: 'single',
  },
];

export function getGroup(name) {
  const group = GROUPS.find((g) => g.name === name);
  if (!group) {
    const valid = GROUPS.map((g) => g.name).join(', ');
    throw new Error(`Unknown group "${name}". Valid groups: ${valid}`);
  }
  return group;
}

export function getSkillNames(group) {
  return group.type === 'multi' ? group.skills : [group.name];
}
```

## Installer pattern

```js
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { GROUPS, getGroup, getSkillNames } from './groups.js';

const PKG_ROOT = resolve(import.meta.dirname, '..');
const SKILLS_ROOT = join(PKG_ROOT, 'skills');

function targetDirs(scope) {
  const base = scope === 'global' ? homedir() : process.cwd();
  return [join(base, '.claude', 'skills'), join(base, '.agents', 'skills')];
}

export function installGroup(groupName, scope, opts = {}) {
  const group = getGroup(groupName);
  const skills = getSkillNames(group);
  for (const dir of targetDirs(scope)) {
    if (!opts.dryRun) mkdirSync(dir, { recursive: true });
    for (const skill of skills) {
      const src = join(SKILLS_ROOT, skill);
      const dest = join(dir, skill);
      if (opts.dryRun) console.log(`copy ${src} -> ${dest}`);
      else cpSync(src, dest, { recursive: true });
    }
  }
  return skills;
}

export function uninstallGroup(groupName, scope, opts = {}) {
  const group = getGroup(groupName);
  const skills = getSkillNames(group);
  for (const dir of targetDirs(scope)) {
    for (const skill of skills) {
      const target = join(dir, skill);
      if (opts.dryRun) console.log(`delete ${target}`);
      else rmSync(target, { recursive: true, force: true });
    }
  }
  return skills;
}

export function installAll(scope, opts = {}) {
  return GROUPS.flatMap((g) => installGroup(g.name, scope, opts));
}

export function uninstallAll(scope, opts = {}) {
  return GROUPS.flatMap((g) => uninstallGroup(g.name, scope, opts));
}
```

## README examples

Show both runners, but avoid implying Bun is required for `npx`:

```bash
npx @scope/agent-skill-books install --all
bunx @scope/agent-skill-books install --all
npx @scope/agent-skill-books install --group skill-creator
npx @scope/agent-skill-books uninstall --group skill-creator
```

For GitHub Packages, include one-time scope registry setup and token scope requirements.
