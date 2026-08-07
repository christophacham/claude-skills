/**
 * Installer wizard entry.
 * Default: full-screen Ink TUI (ccstatusline-style).
 * Legacy: Clack step UI via runClackWizard / --legacy on CLI.
 */
export { runTuiWizard as runWizard } from './tui/run.js';

/** Optional Clack fallback kept for --legacy install path. */
export { runClackWizard } from './wizard-clack.js';
