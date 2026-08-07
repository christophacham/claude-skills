/** Skill catalog for the selective installer.
 *
 * Groups:
 *   SEARCH      — frozen trio; multiselect default-yes within group
 *   CORE        — lean default-yes craft
 *   OPT_IN      — broad domain craft; offer, never default-yes
 *   SECURITY    — vuln / scanner integrations; offer, never default-yes
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

/** CORE — install default-yes craft. */
/** @type {SkillEntry[]} */
export const CORE_SKILLS = [
  { id: 'simple-design', label: 'simple-design', hint: 'deep modules / small surface' },
  { id: 'refactoring', label: 'refactoring', hint: 'Fowler mechanics + smells' },
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
 * SECURITY — vuln tracker / scanner integrations (never default-yes).
 * Needs host credentials (env or credentials file); not general code-review.
 * @type {SkillEntry[]}
 */
export const SECURITY_SKILLS = [
  {
    id: 'defectdojo-fix',
    label: 'defectdojo-fix',
    hint: 'self-hosted DefectDojo → triage + fix (needs DEFECTDOJO_URL + token)',
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
 * Ordered groups for the wizard browser.
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
    hint: 'default craft: simple-design, refactoring',
    defaultSelected: true,
    skills: CORE_SKILLS,
  },
  {
    id: 'opt_in',
    label: 'Opt-in',
    hint: 'architecture / distributed / geometry — never default-yes',
    defaultSelected: false,
    skills: OPT_IN_SKILLS,
  },
  {
    id: 'security',
    label: 'Security',
    hint: 'vuln trackers (DefectDojo, …) — never default-yes',
    defaultSelected: false,
    skills: SECURITY_SKILLS,
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
 * Offer-only skills after CORE: OPT_IN + SECURITY + SPECIALIST.
 * Kept as OTHER_SKILLS for callers that still want the combined list.
 */
export const OTHER_SKILLS = [
  ...OPT_IN_SKILLS,
  ...SECURITY_SKILLS,
  ...SPECIALIST_SKILLS,
];

/** No agent roster in this suite. */
export const TOP_LEVEL_AGENTS = [];

export const PANELIST_AGENTS = [];

/** Skills that pull an agent roster when installed — none remain. */
export const SKILLS_NEEDING_AGENTS = new Set();

/**
 * Stale agent basenames from older suite versions — drop on apply when
 * ensuring roster or removing an orphaned roster.
 */
export const STALE_AGENT_FILES = [
  'coder.md',
  'reviewer.md',
  'scope-scout.md',
  'scope-auditor.md',
  'beads-creator.md',
  'beads-reviewer.md',
];

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
