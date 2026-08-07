from __future__ import annotations

import importlib.util
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
VALIDATOR_PATH = ROOT / "tools" / "validate_skill.py"

spec = importlib.util.spec_from_file_location("validate_skill", VALIDATOR_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def active_injections(text: str) -> list[tuple[int, str]]:
    lines = text.splitlines()
    found: list[tuple[int, str]] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.lstrip()
        if stripped.startswith("```!"):
            start = index + 1
            block: list[str] = []
            index += 1
            while index < len(lines) and lines[index].strip() != "```":
                block.append(lines[index])
                index += 1
            if index >= len(lines):
                raise AssertionError(f"unterminated injection fence at line {start}")
            found.append((start, "\n".join(block)))
        elif stripped.startswith("!`"):
            if not re.fullmatch(r"!`[^`\n]*`", stripped):
                raise AssertionError(f"inline injection must close on line {index + 1}")
            found.append((index + 1, stripped[2:-1]))
        index += 1
    return found


class SkillValidationTests(unittest.TestCase):
    def test_all_skills_validate(self) -> None:
        failures = {}
        for skill_dir in sorted(SKILLS.iterdir()):
            if not skill_dir.is_dir():
                continue
            report = validator.validate_skill(skill_dir)
            if not report["ok"]:
                failures[skill_dir.name] = report["errors"]
        self.assertEqual({}, failures)

    def test_active_injections_are_static_and_trusted(self) -> None:
        # Skills that may use network tools in load-time injections (API clients).
        network_allowed = {"defectdojo-fix"}
        expected_with_injections = {"tavily-search", "defectdojo-fix"}
        actual = set()
        for skill_dir in sorted(SKILLS.iterdir()):
            skill_file = skill_dir / "SKILL.md"
            if not skill_file.exists():
                continue
            text = skill_file.read_text(encoding="utf-8")
            injections = active_injections(text)
            if not injections:
                continue
            actual.add(skill_dir.name)
            self.assertRegex(text, r"(?m)^shell: (bash|powershell)$", skill_dir.name)

            argument_names = []
            match = re.search(r"(?m)^arguments:\s*\[([^]]*)\]", text)
            if match:
                argument_names = [part.strip() for part in match.group(1).split(",")]
            forbidden = ["$ARGUMENTS", *(f"${name}" for name in argument_names if name)]

            for line, command in injections:
                for token in forbidden:
                    self.assertNotIn(token, command, f"{skill_dir.name}:{line}")
                self.assertNotIn(
                    "${CLAUDE_PROJECT_DIR}/.claude/skills",
                    command,
                    f"{skill_dir.name}:{line}",
                )
                if skill_dir.name not in network_allowed:
                    self.assertIsNone(
                        re.search(r"\b(curl|wget|Invoke-WebRequest)\b", command),
                        f"network injection in {skill_dir.name}:{line}",
                    )
        self.assertEqual(expected_with_injections, actual)


if __name__ == "__main__":
    unittest.main()
