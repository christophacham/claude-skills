/** Skill / agent catalog for the selective installer. */

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

/** Suggested project-only tools (skill authoring + injection audit). */
export const PROJECT_SUGGESTED = [
  {
    id: 'skill-creator',
    label: 'skill-creator',
    hint: 'create / validate / package skills; audit load-time injection',
  },
];

/** Remaining skills offered one-by-one (local / global / skip / done). */
export const OTHER_SKILLS = [
  { id: 'beads', label: 'beads', hint: 'bd issue tracker + installs agents' },
  { id: 'peek-repo', label: 'peek-repo', hint: 'shallow-clone GitHub for inspection' },
  { id: 'architecture-design', label: 'architecture-design', hint: 'Clean Arch / ports' },
  {
    id: 'distributed-architecture',
    label: 'distributed-architecture',
    hint: 'sagas, topology, DB ownership, monolith decomp',
  },
  { id: 'refactoring', label: 'refactoring', hint: 'Fowler mechanics + smells' },
  { id: 'simple-design', label: 'simple-design', hint: 'deep modules / small surface' },
  {
    id: 'geometric-robustness',
    label: 'geometric-robustness',
    hint: 'float/geometry robustness (Rust CAD/CAM)',
  },
];

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
    ...OTHER_SKILLS.map((s) => s.id),
  ];
}
