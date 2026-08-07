/** Skill / agent catalog for the selective installer.
 *
 * Groups match SLIM catalog law + specialist lane:
 *   SEARCH      — frozen trio; multiselect default-yes within group
 *   CORE        — lean default-yes craft
 *   AUTHOR      — project skill-authoring path
 *   BEADS       — tracker profile only when chosen
 *   OPT_IN      — broad domain craft; offer, never default-yes
 *   SPECIALIST  — narrow load-on-demand skills; offer, never default-yes
 */

/**
 * @typedef {{ id: string, label: string, hint: string }} SkillEntry
 * @typedef {{
 *   id: string,
 *   label: string,
 *   hint: string,
 *   defaultSelected: boolean,
 *   skills: SkillEntry[]
 * }} SkillGroup
 */

/** @type {SkillEntry[]} */
export const SEARCH_SKILLS = [
  {
    id: 'ddg-search',
    label: 'ddg-search',
    hint: 'free metasearch — no API key',
  },
  {
    id: 'brave-search',
    label: 'brave-search',
    hint: 'Brave Search API — needs BRAVE_API_KEY',
  },
  {
    id: 'tavily-search',
    label: 'tavily-search',
    hint: 'Tavily CLI — needs TAVILY_API_KEY',
  },
];

/** AUTHOR — suggested project-only tools (skill authoring + injection audit). */
/** @type {SkillEntry[]} */
export const PROJECT_SUGGESTED = [
  {
    id: 'skill-creator',
    label: 'skill-creator',
    hint: 'create / validate / package skills; audit load-time injection',
  },
];

/** CORE — install default-yes craft. */
/** @type {SkillEntry[]} */
export const CORE_SKILLS = [
  {
    id: 'operating-mode',
    label: 'operating-mode',
    hint: 'one-unit hands-off to PR; live gates; human PR review',
  },
  {
    id: 'beads-om',
    label: 'beads-om',
    hint: 'thin Beads companion to operating-mode (no agent roster)',
  },
  { id: 'simple-design', label: 'simple-design', hint: 'deep modules / small surface' },
  { id: 'refactoring', label: 'refactoring', hint: 'Fowler mechanics + smells' },
];

/** BEADS profile — offer only when user chooses (full tracker skill; no agent roster). */
/** @type {SkillEntry[]} */
export const BEADS_SKILLS = [
  { id: 'beads', label: 'beads', hint: 'full bd tracker skill (not OM thin companion)' },
];

/** OPT_IN — broad domain craft; offer, never default-yes. */
/** @type {SkillEntry[]} */
export const OPT_IN_SKILLS = [
  { id: 'architecture-design', label: 'architecture-design', hint: 'Clean Arch / ports' },
  {
    id: 'distributed-architecture',
    label: 'distributed-architecture',
    hint: 'sagas, topology, DB ownership, monolith decomp',
  },
  {
    id: 'geometric-robustness',
    label: 'geometric-robustness',
    hint: 'float/geometry robustness (Rust CAD/CAM)',
  },
];

/**
 * SPECIALIST — narrow, load-on-demand skills (not default craft).
 * Install when the task needs that specialty; never seed into fresh carts.
 * @type {SkillEntry[]}
 */
export const SPECIALIST_SKILLS = [
  {
    id: 'ink-cli-tui',
    label: 'ink-cli-tui',
    hint: 'full-screen Ink npx/bunx wizards (ccstatusline-style)',
  },
];

/**
 * Ordered groups for the wizard browser (ccstatusline-style categories).
 * @type {SkillGroup[]}
 */
export const SKILL_GROUPS = [
  {
    id: 'search',
    label: 'Search',
    hint: 'web / news search helpers (frozen trio)',
    defaultSelected: true,
    skills: SEARCH_SKILLS,
  },
  {
    id: 'core',
    label: 'Core',
    hint: 'default craft: operating-mode, beads-om, design, refactor',
    defaultSelected: true,
    skills: CORE_SKILLS,
  },
  {
    id: 'author',
    label: 'Author',
    hint: 'skill authoring (usually project-local)',
    defaultSelected: true,
    skills: PROJECT_SUGGESTED,
  },
  {
    id: 'beads',
    label: 'Beads',
    hint: 'full bd tracker skill — offer only',
    defaultSelected: false,
    skills: BEADS_SKILLS,
  },
  {
    id: 'opt_in',
    label: 'Opt-in',
    hint: 'architecture / distributed / geometry — never default-yes',
    defaultSelected: false,
    skills: OPT_IN_SKILLS,
  },
  {
    id: 'specialist',
    label: 'Specialist',
    hint: 'narrow load-on-demand skills — never default-yes',
    defaultSelected: false,
    skills: SPECIALIST_SKILLS,
  },
];

/**
 * Offer-only skills after CORE (skip default): BEADS + OPT_IN + SPECIALIST.
 * Kept as OTHER_SKILLS for callers that still want the combined list.
 */
export const OTHER_SKILLS = [...BEADS_SKILLS, ...OPT_IN_SKILLS, ...SPECIALIST_SKILLS];

/** Operating-mode roster: implementer, reviewer, design×3 panelists. */
export const TOP_LEVEL_AGENTS = ['coder.md', 'reviewer.md'];

export const PANELIST_AGENTS = ['deep-module.md', 'minimal-diff.md', 'seam.md'];

/**
 * Skills that pull the OM agent roster when installed.
 * operating-mode is the cadence kernel; simple-design / refactoring are agent preloads.
 * beads-om and full beads do not install agents (main uses skills; no tracker subagents).
 */
export const SKILLS_NEEDING_AGENTS = new Set([
  'operating-mode',
  'simple-design',
  'refactoring',
]);

/** Skills that should install pool.md when installed (optional routing doc). */
export const SKILLS_NEEDING_POOL = new Set(['operating-mode']);

/**
 * Stale agent basenames removed from the suite — drop on apply when ensuring roster
 * or when removing the orphaned roster.
 */
export const STALE_AGENT_FILES = ['beads-creator.md', 'beads-reviewer.md'];

/** @returns {string[]} */
export function allSkillIds() {
  return SKILL_GROUPS.flatMap((g) => g.skills.map((s) => s.id));
}

/** @returns {Map<string, SkillEntry & { groupId: string }>} */
export function skillIndex() {
  /** @type {Map<string, SkillEntry & { groupId: string }>} */
  const map = new Map();
  for (const g of SKILL_GROUPS) {
    for (const s of g.skills) {
      map.set(s.id, { ...s, groupId: g.id });
    }
  }
  return map;
}

/** @param {string} id */
export function findSkill(id) {
  return skillIndex().get(id) || null;
}

/** @param {string} groupId */
export function findGroup(groupId) {
  return SKILL_GROUPS.find((g) => g.id === groupId) || null;
}

/** Skill ids that are default-selected when seeding a fresh desired set. */
export function defaultSelectedSkillIds() {
  return SKILL_GROUPS.filter((g) => g.defaultSelected).flatMap((g) =>
    g.skills.map((s) => s.id),
  );
}
