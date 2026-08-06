/** Skill / agent catalog for the selective installer.
 *
 * Groups match SLIM catalog law:
 *   SEARCH  — frozen trio; multiselect default-yes
 *   CORE    — lean default-yes craft (peek-repo, simple-design, refactoring)
 *   AUTHOR  — project skill-authoring path (skill-creator)
 *   BEADS   — tracker profile only when chosen
 *   OPT_IN  — offer, never default-yes (architecture, distributed, geometric)
 */

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
export const PROJECT_SUGGESTED = [
  {
    id: 'skill-creator',
    label: 'skill-creator',
    hint: 'create / validate / package skills; audit load-time injection',
  },
];

/** CORE — install default-yes craft. */
export const CORE_SKILLS = [
  { id: 'peek-repo', label: 'peek-repo', hint: 'shallow-clone GitHub for inspection' },
  { id: 'simple-design', label: 'simple-design', hint: 'deep modules / small surface' },
  { id: 'refactoring', label: 'refactoring', hint: 'Fowler mechanics + smells' },
];

/** BEADS profile — offer only when user chooses (pulls agents + pool). */
export const BEADS_SKILLS = [
  { id: 'beads', label: 'beads', hint: 'bd issue tracker + installs agents' },
];

/** OPT_IN — offer, never default-yes. */
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

export function allSkillIds() {
  return [
    ...SEARCH_SKILLS.map((s) => s.id),
    ...PROJECT_SUGGESTED.map((s) => s.id),
    ...CORE_SKILLS.map((s) => s.id),
    ...BEADS_SKILLS.map((s) => s.id),
    ...OPT_IN_SKILLS.map((s) => s.id),
  ];
}
