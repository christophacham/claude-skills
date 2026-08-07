/**
 * Compat entry: linear flow is deprecated in favor of the menu wizard.
 * `runInstallFlow` now opens the wizard (project-default).
 * Pass { legacy: true } only if you need the old confirm ladder.
 */
import { runWizard } from './wizard.js';
import { runLegacyInstallFlow } from './install-flow-legacy.js';

/**
 * @param {{ projectPath?: string, skipDeps?: boolean, legacy?: boolean }} opts
 */
export async function runInstallFlow(opts = {}) {
  if (opts.legacy) {
    return runLegacyInstallFlow(opts);
  }
  return runWizard(opts);
}
