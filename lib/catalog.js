/** Skill / agent catalog for the selective installer.
 *
 * Groups match SLIM catalog law:
 *   SEARCH  — frozen trio; multiselect default-yes within group
 *   CORE    — lean default-yes craft
 *   AUTHOR  — project skill-authoring path
 *   BEADS   — tracker profile only when chosen
 *   OPT_IN  — offer, never default-yes
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
  { id: 'peek-repo', label: 'peek-repo', hint: 'shallow-clone GitHub for inspection' },
  { id: 'simple-design', label: 'simple-design', hint: 'deep modules / small surface' },
  { id: 'refactoring', label: 'refactoring', hint: 'Fowler mechanics + smells' },
];

/** BEADS profile — offer only when user chooses (pulls agents + pool). */
/** @type {SkillEntry[]} */
export const BEADS_SKILLS = [
  { id: 'beads', label: 'beads', hint: 'bd issue tracker + installs agents' },
];

/** OPT_IN — offer, never default-yes. */
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
    hint: 'default craft: operating-mode, design, refactor',
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
    hint: 'issue tracker profile + agents',
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
];

/**
 * Offer-only skills after CORE (skip default): BEADS + OPT_IN.
 * Kept as OTHER_SKILLS for callers that still want the combined list.
 */
export const OTHER_SKILLS = [...BEADS_SKILLS, ...OPT_IN_SKILLS];

export const TOP_LEVEL_AGENTS = [
  'beads-creator.md',
  'beads-reviewer.md',
  'coder.md',
  'reviewer.md',
];

export const PANELIST_AGENTS = ['deep-module.md', 'minimal-diff.md', 'seam.md'];

/** Skills that should pull the agent roster when installed. */
export const SKILLS_NEEDING_AGENTS = new Set(['beads']);

/** Skills that should install pool.md when installed (optional routing doc). */
export const SKILLS_NEEDING_POOL = new Set(['beads']);

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
