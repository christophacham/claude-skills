"""Suite shape contracts after agent roster removal."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / "agents"
SKILLS = ROOT / "skills"


class SuiteShapeTests(unittest.TestCase):
    def test_agents_tree_is_gone(self) -> None:
        self.assertFalse(AGENTS.exists(), "agents/ must not ship with the suite")

    def test_removed_process_skills_are_gone(self) -> None:
        for gone in (
            "operating-mode",
            "capability-plan",
            "beads-om",
            "beads",
            "skill-creator",
        ):
            self.assertFalse(
                (SKILLS / gone).exists(),
                f"removed skill still present: {gone}",
            )

    def test_kept_skills_exist(self) -> None:
        for kept in (
            "ddg-search",
            "brave-search",
            "tavily-search",
            "simple-design",
            "refactoring",
            "architecture-design",
            "distributed-architecture",
            "geometric-robustness",
            "defectdojo-fix",
            "ink-cli-tui",
        ):
            self.assertTrue(
                (SKILLS / kept / "SKILL.md").is_file(),
                f"kept skill missing: {kept}",
            )

    def test_catalog_has_no_agent_pullers(self) -> None:
        catalog = (ROOT / "lib" / "catalog.js").read_text(encoding="utf-8")
        self.assertIn("export const SKILLS_NEEDING_AGENTS = new Set()", catalog)
        self.assertIn("export const TOP_LEVEL_AGENTS = []", catalog)
        self.assertIn("export const CORE_SKILLS", catalog)
        self.assertIn("export const OPT_IN_SKILLS", catalog)
        self.assertIn("export const SECURITY_SKILLS", catalog)
        self.assertIn("export const SPECIALIST_SKILLS", catalog)
        self.assertNotIn("PROJECT_SUGGESTED", catalog)
        self.assertNotIn("BEADS_SKILLS", catalog)
        for dead in (
            "operating-mode",
            "capability-plan",
            "beads-om",
            "skill-creator",
        ):
            self.assertNotIn(f"id: '{dead}'", catalog)
        for kept in (
            "simple-design",
            "refactoring",
            "architecture-design",
            "distributed-architecture",
            "geometric-robustness",
        ):
            self.assertIn(f"id: '{kept}'", catalog)

    def test_readme_does_not_advertise_om_or_agents(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertNotIn("`operating-mode`", readme)
        self.assertNotIn("`capability-plan`", readme)
        self.assertNotIn("`beads-om`", readme)
        self.assertNotIn("scope-scout", readme)
        self.assertNotIn("design×3", readme)
        self.assertIn("`simple-design`", readme)
        self.assertIn("`architecture-design`", readme)
        self.assertIn("`refactoring`", readme)

    def test_slim_and_om_handbooks_are_gone(self) -> None:
        self.assertFalse((ROOT / "SLIM.md").exists())
        for name in (
            "01-handbook-product-flow.md",
            "02-handbook-capability-plan.md",
            "03-handbook-operating-mode.md",
        ):
            self.assertFalse((ROOT / "docs" / name).exists(), name)

    def test_craft_skills_do_not_name_agents_or_other_skill_ids(self) -> None:
        forbidden = (
            "operating-mode",
            "capability-plan",
            "beads-om",
            "skill-creator",
            "scope-scout",
            "scope-auditor",
            "panelists/",
            "coder.md",
            "reviewer.md",
        )
        # other suite skill ids must not appear as backtick skill references
        other_ids = {
            "simple-design",
            "architecture-design",
            "distributed-architecture",
            "geometric-robustness",
            "refactoring",
        }
        for skill in sorted(other_ids | {"ink-cli-tui"}):
            root = SKILLS / skill
            for path in root.rglob("*"):
                if not path.is_file() or path.suffix in {".png", ".jpg"}:
                    continue
                text = path.read_text(encoding="utf-8", errors="ignore")
                for token in forbidden:
                    self.assertNotIn(
                        token,
                        text,
                        f"{path} still mentions {token}",
                    )
                for other in other_ids:
                    if other == skill:
                        continue
                    # backtick skill id references
                    self.assertNotIn(
                        f"`{other}`",
                        text,
                        f"{path} still cross-links skill `{other}`",
                    )
                    self.assertNotIn(
                        f"see {other}",
                        text,
                    )
                    self.assertNotIn(
                        f"→ `{other}`",
                        text,
                    )


if __name__ == "__main__":
    unittest.main()
