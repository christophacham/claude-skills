import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { skillsDest } from './paths.js';

function nodeMajorOk() {
  const major = Number(process.versions.node.split('.')[0]);
  return major === 20 || major >= 22;
}

/**
 * Post-install runtime deps for skills that need them.
 * @param {string[]} skillIds
 * @param {'global'|'project'} scope
 * @param {string} [projectRoot]
 * @returns {string[]} log lines
 */
export function ensureSkillDeps(skillIds, scope, projectRoot) {
  const lines = [];
  if (skillIds.includes('brave-search')) {
    const dir = join(skillsDest(scope, projectRoot), 'brave-search');
    const pkg = join(dir, 'package.json');
    if (!existsSync(pkg)) {
      lines.push('deps skip: brave-search package.json missing');
    } else if (!nodeMajorOk()) {
      lines.push(`deps skip: Node ${process.version} (need 20 or >=22) for brave-search`);
    } else {
      const r = spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
        cwd: dir,
        encoding: 'utf8',
        shell: process.platform === 'win32',
      });
      if (r.status === 0) lines.push('deps ready: brave-search node_modules');
      else lines.push(`deps warn: npm install failed in ${dir}`);
    }
  }
  // ddgs / tvly are global tools — best-effort, non-fatal
  if (skillIds.includes('ddg-search')) {
    const r = spawnSync(
      process.platform === 'win32' ? 'py' : 'python3',
      process.platform === 'win32'
        ? ['-3', '-c', 'import ddgs']
        : ['-c', 'import ddgs'],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    );
    if (r.status === 0) {
      lines.push('deps ready: ddgs');
    } else {
      const inst = spawnSync(
        process.platform === 'win32' ? 'py' : 'python3',
        process.platform === 'win32'
          ? ['-3', '-m', 'pip', 'install', '-U', 'ddgs']
          : ['-m', 'pip', 'install', '-U', 'ddgs'],
        { encoding: 'utf8', shell: process.platform === 'win32' },
      );
      if (inst.status === 0) lines.push('deps ready: ddgs (installed)');
      else lines.push('deps warn: ddgs not available (pip install failed)');
    }
  }
  if (skillIds.includes('tavily-search')) {
    const check = spawnSync('tvly', ['--help'], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (check.status === 0) {
      lines.push('deps ready: tvly');
    } else {
      const uv = spawnSync('uv', ['tool', 'install', 'tavily-cli'], {
        encoding: 'utf8',
        shell: process.platform === 'win32',
      });
      if (uv.status === 0) lines.push('deps ready: tvly (uv tool install)');
      else {
        const pip = spawnSync(
          process.platform === 'win32' ? 'py' : 'python3',
          process.platform === 'win32'
            ? ['-3', '-m', 'pip', 'install', '-U', 'tavily-cli']
            : ['-m', 'pip', 'install', '-U', 'tavily-cli'],
          { encoding: 'utf8', shell: process.platform === 'win32' },
        );
        if (pip.status === 0) lines.push('deps ready: tvly (pip)');
        else lines.push('deps warn: tvly not installed (run: uv tool install tavily-cli)');
      }
    }
  }
  return lines;
}
