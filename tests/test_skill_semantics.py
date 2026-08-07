"""Light contracts for kept craft + ops skills."""

from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"


class KeptSkillPresenceTests(unittest.TestCase):
    def test_each_kept_skill_has_frontmatter_name(self) -> None:
        for skill_id in (
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
            text = (SKILLS / skill_id / "SKILL.md").read_text(encoding="utf-8")
            self.assertTrue(text.startswith("---\n"), skill_id)
            self.assertIn(f"name: {skill_id}", text)


class SimpleDesignSkillTests(unittest.TestCase):
    def test_deep_modules_language(self) -> None:
        text = (SKILLS / "simple-design" / "SKILL.md").read_text(encoding="utf-8")
        lowered = text.lower()
        self.assertIn("deep", lowered)
        self.assertIn("complexity", lowered)
        self.assertNotIn("`architecture-design`", text)
        self.assertNotIn("`refactoring`", text)


class ArchitectureSkillTests(unittest.TestCase):
    def test_ports_and_layers(self) -> None:
        text = (SKILLS / "architecture-design" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("Dependency Rule", text)
        self.assertNotIn("`simple-design`", text)
        self.assertNotIn("`distributed-architecture`", text)


class DistributedSkillTests(unittest.TestCase):
    def test_tradeoff_language(self) -> None:
        text = (SKILLS / "distributed-architecture" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("trade-off", text.lower())
        self.assertNotIn("`architecture-design`", text)


class RefactoringSkillTests(unittest.TestCase):
    def test_covers_mechanics_and_smells(self) -> None:
        text = (SKILLS / "refactoring" / "SKILL.md").read_text(encoding="utf-8")
        lowered = text.lower()
        self.assertIn("refactor", lowered)
        self.assertTrue(
            "smell" in lowered or "mechanics" in lowered or "fowler" in lowered
        )


class DefectDojoSkillTests(unittest.TestCase):
    def test_skill_names_defectdojo(self) -> None:
        text = (SKILLS / "defectdojo-fix" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: defectdojo-fix", text)
        self.assertIn("DefectDojo", text)


class InkCliTuiSkillTests(unittest.TestCase):
    def test_skill_names_ink(self) -> None:
        text = (SKILLS / "ink-cli-tui" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("name: ink-cli-tui", text)
        self.assertIn("Ink", text)
        self.assertNotIn("skill-creator", text)


class InstallerDocsTests(unittest.TestCase):
    def test_catalog_groups_in_readme(self) -> None:
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("SEARCH", readme)
        self.assertIn("CORE", readme)
        self.assertIn("OPT_IN", readme)
        self.assertIn("SECURITY", readme)
        self.assertIn("SPECIALIST", readme)
        self.assertNotIn("**AUTHOR**", readme)
        self.assertNotIn("**BEADS**", readme)


if __name__ == "__main__":
    unittest.main()
