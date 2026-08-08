/**
 * Full-screen TUI entry — matches ccstatusline:
 *   process.stdout.write('\x1b[2J\x1b[H');
 *   render(<App />);
 */
import { render } from 'ink';
import { h } from './h.js';
import { App } from './App.js';
import { installPin } from '../suite-version.js';

/**
 * @param {{ projectPath?: string, skipDeps?: boolean }} opts
 */
export async function runTuiWizard(opts = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      'claude-skills wizard needs an interactive TTY.\n' +
        `Run from a terminal: npx -y ${installPin()}`,
    );
    process.exit(1);
  }

  // Clear scrollback view and move cursor home (full-screen, in-place)
  process.stdout.write('\x1b[2J\x1b[H');

  const instance = render(
    h(App, {
      projectPath: opts.projectPath,
      skipDeps: Boolean(opts.skipDeps),
    }),
    {
      exitOnCtrlC: false, // App handles ctrl+c via useApp().exit
    },
  );

  await instance.waitUntilExit();
}
