from __future__ import annotations

import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / "agents"
VALIDATOR_PATH = ROOT / "skills" / "skill-creator" / "scripts" / "validate_skill.py"

spec = importlib.util.spec_from_file_location("agent_contract_yaml", VALIDATOR_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def read_repo_file(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def frontmatter(text: str) -> dict[str, object]:
    match = re.match(r"\A---\n(.*?)\n---\n", text, re.DOTALL)
    if not match:
        raise AssertionError("agent file has no YAML frontmatter")
    values, errors = validator.parse_frontmatter(match.group(1))
    if errors:
        raise AssertionError(f"invalid agent frontmatter: {errors}")
    return values


def configured_tools(text: str) -> set[str]:
    tools = frontmatter(text).get("tools", "")
    if isinstance(tools, str):
        return {tool.strip() for tool in tools.split(",") if tool.strip()}
    if isinstance(tools, list):
        return {str(tool).strip() for tool in tools if str(tool).strip()}
    raise AssertionError(f"invalid tools field: {tools!r}")


def configured_skills(text: str) -> list[str]:
    skills = frontmatter(text).get("skills", [])
    if not isinstance(skills, list) or not all(isinstance(skill, str) for skill in skills):
        raise AssertionError(f"skills must be a YAML sequence of strings: {skills!r}")
    return skills


class AgentContractTests(unittest.TestCase):
    def test_all_seven_agent_identities_are_preserved(self) -> None:
        expected = {
            "agents/beads-creator.md": "beads-creator",
            "agents/beads-reviewer.md": "beads-reviewer",
            "agents/coder.md": "coder",
            "agents/reviewer.md": "reviewer",
            "agents/panelists/deep-module.md": "deep-module",
            "agents/panelists/minimal-diff.md": "minimal-diff",
            "agents/panelists/seam.md": "seam",
        }

        actual = {
            path: frontmatter(read_repo_file(path))["name"]
            for path in expected
        }

        self.assertEqual(expected, actual)

    def test_coder_accepts_a_normal_scoped_brief(self) -> None:
        text = read_repo_file("agents/coder.md")
        lowered = text.lower()

        self.assertEqual(
            {"Read", "Write", "Edit", "Bash", "Grep", "Glob"},
            configured_tools(text),
        )
        self.assertEqual(
            ["simple-design", "refactoring", "testing-tdd"],
            configured_skills(text),
        )
        for phrase in (
            "a scoped implementation brief",
            "project's `CLAUDE.md`",
            "relevant checks",
            "Only create a commit when the user explicitly authorizes it.",
            "Do not mutate any issue tracker",
            "Never push or amend",
        ):
            self.assertIn(phrase, text)
        self.assertNotIn("work unit", lowered)
        self.assertNotIn("one bead", lowered)
        self.assertNotIn("full test suite", lowered)

    def test_reviewer_is_read_only_and_accepts_common_review_targets(self) -> None:
        text = read_repo_file("agents/reviewer.md")

        self.assertEqual({"Read", "Grep", "Glob"}, configured_tools(text))
        self.assertEqual(
            ["simple-design", "refactoring", "testing-tdd"],
            configured_skills(text),
        )
        for forbidden_tool in ("Write", "Edit", "Bash"):
            self.assertNotIn(forbidden_tool, configured_tools(text))
        for target in ("diff", "commit", "branch", "files"):
            self.assertRegex(text, rf"(?i)\b{target}\b")
        self.assertIn(
            "Verdict: PASS | CHANGES_REQUESTED | REPLAN_RECOMMENDED",
            text,
        )
        self.assertIn(
            "A fresh review context remains independent even when it uses the same model",
            text,
        )
        self.assertIn("same-model review is not degraded", text)
        self.assertIn("evidence: <observed behavior, diff hunk, or supplied check output>", text)
        self.assertIn("impact: <concrete failure or maintenance cost>", text)
        self.assertNotIn("micro-fix exception", text.lower())
        self.assertNotIn("microFixCommits", text)
        self.assertNotIn("run formatters", text.lower())
        self.assertNotIn("re-running the test suite", text.lower())

    def test_panelists_are_no_bash_read_only_and_keep_distinct_lenses(self) -> None:
        contracts = {
            "agents/panelists/deep-module.md": (
                "the deep module",
                "The best recommendation may be to keep behavior in an existing owner or make no structural change.",
                ["simple-design"],
            ),
            "agents/panelists/minimal-diff.md": (
                "the minimal honest diff",
                "Defer structure when its current cost exceeds its demonstrated benefit",
                ["refactoring"],
            ),
            "agents/panelists/seam.md": (
                "the behavior-preserving seam",
                "A function boundary can be a valid seam when it forms a meaningful contract",
                ["simple-design"],
            ),
        }

        for path, (lens, correction, skills) in contracts.items():
            with self.subTest(path=path):
                text = read_repo_file(path)
                self.assertEqual({"Read", "Grep", "Glob"}, configured_tools(text))
                self.assertEqual(skills, configured_skills(text))
                self.assertIn("Read-only", text)
                self.assertIn(lens, text)
                self.assertIn(correction, text)
                self.assertNotIn("second caller", text.lower())
                self.assertNotIn("function boundary alone", text.lower())

    def test_beads_agents_preload_beads_and_require_user_authorization(self) -> None:
        for path in ("agents/beads-creator.md", "agents/beads-reviewer.md"):
            with self.subTest(path=path):
                text = read_repo_file(path)
                self.assertEqual(["beads"], configured_skills(text))
                self.assertIn("governing user request", text)
                self.assertNotIn("documented repository policy that authorizes", text)


class CoordinationDocumentationTests(unittest.TestCase):
    def test_readme_matches_agent_behavior(self) -> None:
        text = read_repo_file("README.md")

        self.assertIn("scoped implementation brief", text)
        self.assertIn("user-authorized commit", text)
        self.assertIn(
            "PASS / CHANGES_REQUESTED / REPLAN_RECOMMENDED",
            text,
        )
        self.assertIn("Same-model review remains valid", text)
        self.assertIn("advisory routing preferences", text)
        self.assertNotIn("PASS / FIX / ROLLBACK", text)

    def test_pool_is_advisory_and_same_model_review_is_valid(self) -> None:
        text = read_repo_file("pool.md")

        self.assertIn("advisory", text.lower())
        self.assertIn("Same-model review remains valid", text)
        self.assertIn("Pins are optional preferences", text)
        self.assertNotIn("degraded", text.lower())
        self.assertNotIn("config bug", text.lower())

    def test_archive_points_to_current_root_readme_without_stale_suite_claims(self) -> None:
        text = read_repo_file("personal-skill-archive/README.md")

        self.assertIn(
            "The root [`README.md`](../README.md) is the source of truth for the current managed suite",
            text,
        )
        for stale_current_skill in ("`work-loop`", "`work-plan`", "`bd-epic-runner`"):
            self.assertNotIn(stale_current_skill, text)

    def test_distribution_membership_is_unchanged(self) -> None:
        package = json.loads(read_repo_file("package.json"))
        expected_skills = {
            "architecture-design", "beads", "brave-search", "ddg-search",
            "distributed-architecture",
            "geometric-robustness", "peek-repo",
            "refactoring", "simple-design", "skill-creator",
            "tavily-search", "testing-tdd", "third-party-integration",
        }
        expected_agents = {
            "beads-creator.md", "beads-reviewer.md", "coder.md", "reviewer.md",
            "panelists/deep-module.md", "panelists/minimal-diff.md", "panelists/seam.md",
        }

        self.assertEqual(
            ["bin/", "lib/", "skills/", "agents/", "pool.md", "README.md"],
            package["files"],
        )
        self.assertEqual(
            expected_skills,
            {path.name for path in (ROOT / "skills").iterdir() if path.is_dir()},
        )
        self.assertEqual(
            expected_agents,
            {path.relative_to(AGENTS).as_posix() for path in AGENTS.rglob("*.md")},
        )
        self.assertEqual(
            {"brave-search", "ddg-search", "tavily-search"},
            {name for name in expected_skills if name.endswith("-search")},
        )


class ContinuousIntegrationContractTests(unittest.TestCase):
    def test_ci_runs_unittest_discovery_on_linux_and_windows_powershell(self) -> None:
        workflow = read_repo_file(".github/workflows/test.yml")

        self.assertIn("runs-on: ubuntu-latest", workflow)
        self.assertIn("runs-on: macos-latest", workflow)
        self.assertIn("runs-on: windows-latest", workflow)
        self.assertGreaterEqual(workflow.count("actions/setup-python@"), 3)
        self.assertGreaterEqual(
            workflow.count("python -m unittest discover -s tests -p 'test_*.py'"),
            3,
        )
        self.assertRegex(workflow, r"(?m)^\s+shell: pwsh$")


if __name__ == "__main__":
    unittest.main()
