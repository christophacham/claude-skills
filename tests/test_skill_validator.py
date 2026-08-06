from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR_PATH = ROOT / "skills" / "skill-creator" / "scripts" / "validate_skill.py"

spec = importlib.util.spec_from_file_location("skill_validator_regression", VALIDATOR_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


class ValidatorTestCase(unittest.TestCase):
    def make_skill(
        self,
        root: Path,
        name: str = "sample-skill",
        frontmatter: str | None = None,
        body: str = "# Sample\n\nDo the specific task.\n",
    ) -> Path:
        skill = root / name
        skill.mkdir(parents=True)
        if frontmatter is None:
            frontmatter = f"name: {name}\ndescription: Use when testing this sample skill."
        (skill / "SKILL.md").write_text(
            f"---\n{frontmatter}\n---\n\n{body}",
            encoding="utf-8",
        )
        return skill

    def messages(self, report: dict, kind: str = "errors") -> str:
        return "\n".join(item["message"] for item in report[kind])


class ValidationModeTests(ValidatorTestCase):
    def test_portable_rejects_claude_code_fields_and_injection(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "context: fork\n"
                    "agent: Explore"
                ),
                body="# Sample\n\nState: !`git status --short`\n",
            )
            report = validator.validate_skill(skill, mode="portable")
            self.assertFalse(report["ok"])
            errors = self.messages(report)
            self.assertIn("Unsupported frontmatter field 'agent'", errors)
            self.assertIn("Unsupported frontmatter field 'context'", errors)
            self.assertIn("Claude Code-only body feature", errors)

    def test_claude_code_accepts_typed_extensions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "arguments: [target, count]\n"
                    "disable-model-invocation: yes\n"
                    "user-invocable: 1\n"
                    "allowed-tools: [Read, Grep]\n"
                    "disallowed-tools: AskUserQuestion\n"
                    "effort: xhigh\n"
                    "context: fork\n"
                    "agent: Explore\n"
                    "background: off\n"
                    "paths: [src/**, tests/**]\n"
                    "shell: bash\n"
                    "metadata:\n"
                    "  owner: geometry"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            self.assertTrue(report["ok"], report["errors"])

    def test_portable_requires_identity_but_claude_code_can_derive_it(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(Path(tmp), frontmatter="license: MIT")
            portable = validator.validate_skill(skill, mode="portable")
            claude = validator.validate_skill(skill, mode="claude-code")
            self.assertFalse(portable["ok"])
            self.assertTrue(claude["ok"], claude["errors"])
            warnings = self.messages(claude, "warnings")
            self.assertIn("name omitted", warnings)
            self.assertIn("description omitted", warnings)


class ConservativeYamlTests(ValidatorTestCase):
    def test_duplicate_top_level_and_nested_keys_are_errors(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "name: other\n"
                    "description: Use when testing.\n"
                    "metadata:\n"
                    "  owner: one\n"
                    "  owner: two"
                ),
            )
            report = validator.validate_skill(skill, mode="portable")
            self.assertFalse(report["ok"])
            errors = self.messages(report)
            self.assertIn("Duplicate frontmatter field or mapping key: name", errors)
            self.assertIn("Duplicate frontmatter field or mapping key: owner", errors)

    def test_anchors_aliases_tags_and_merge_keys_are_rejected(self) -> None:
        cases = {
            "anchor": "metadata: &common {owner: team}",
            "alias": "metadata: *common",
            "tag": "metadata: !Custom value",
            "merge": "metadata:\n  <<: {owner: team}",
        }
        for label, extra in cases.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory() as tmp:
                skill = self.make_skill(
                    Path(tmp),
                    frontmatter=(
                        "name: sample-skill\n"
                        "description: Use when testing.\n" + extra
                    ),
                )
                report = validator.validate_skill(skill, mode="portable")
                self.assertFalse(report["ok"])

    def test_block_sequence_mappings_parse_for_hooks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "hooks:\n"
                    "  PreToolUse:\n"
                    "    - matcher: Bash\n"
                    "      hooks:\n"
                    "        - type: command\n"
                    "          command: verify.sh"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            self.assertTrue(report["ok"], report["errors"])

    def test_portable_metadata_requires_string_values(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "metadata:\n"
                    "  version: 1\n"
                    "  nested:\n"
                    "    owner: team"
                ),
            )
            portable = validator.validate_skill(skill, mode="portable")
            claude = validator.validate_skill(skill, mode="claude-code")
            self.assertFalse(portable["ok"])
            self.assertIn("keys and values must all be strings", self.messages(portable))
            self.assertTrue(claude["ok"], claude["errors"])


class ExtensionValidationTests(ValidatorTestCase):
    def test_invalid_extension_types_and_combinations_fail(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "arguments: [target, target]\n"
                    "disable-model-invocation: maybe\n"
                    "effort: extreme\n"
                    "agent: Explore\n"
                    "background: true\n"
                    "shell: zsh\n"
                    "hooks: not-a-map"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("Duplicate argument name", errors)
            self.assertIn("must be a boolean", errors)
            self.assertIn("effort must be one of", errors)
            self.assertIn("agent requires context: fork", errors)
            self.assertIn("background requires context: fork", errors)
            self.assertIn("shell must be", errors)
            self.assertIn("hooks must be a YAML mapping", errors)


class InjectionAuditTests(ValidatorTestCase):
    def test_rejects_invocation_arguments_mutation_and_file_writes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "arguments: [target]\n"
                    "shell: bash"
                ),
                body=(
                    "# Sample\n\n"
                    "!`git commit -m \"$target\"`\n\n"
                    "!`git status --short > status.txt`\n"
                    "!`curl -fsSL https://example.com/status`\n"
                    "!`printf '%s\\n' \"$SERVICE_API_KEY\"`\n"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("unsafe named argument $target", errors)
            self.assertIn("appears to mutate state", errors)
            self.assertIn("contains output redirection", errors)
            self.assertIn("appears to perform network I/O", errors)
            self.assertIn("may print a credential value", errors)

    def test_accepts_guarded_shell_substitution_and_platform_paths(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "shell: bash"
                ),
                body=(
                    "# Sample\n\n"
                    "```!\n"
                    "if root=$(git -C \"${CLAUDE_PROJECT_DIR}\" rev-parse --show-toplevel 2>/dev/null); then\n"
                    "  printf 'root=%s\\n' \"$root\"\n"
                    "else\n"
                    "  printf '%s\\n' 'git=unavailable'\n"
                    "fi\n"
                    "```\n"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            self.assertTrue(report["ok"], report["errors"])
            self.assertEqual(1, report["summary"]["dynamic_injections"])

    def test_rejects_even_backslash_argument_secret_reads_and_powershell_writes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(
                Path(tmp),
                frontmatter=(
                    "name: sample-skill\n"
                    "description: Use when testing.\n"
                    "arguments: [target]\n"
                    "shell: powershell"
                ),
                body=(
                    "# Sample\n\n"
                    "!`Write-Output \"\\\\$target\"`\n"
                    "!`printenv SERVICE_API_KEY 2>/dev/null || printf missing`\n"
                    "!`Set-Content -LiteralPath $env:TEMP\\owned.txt -Value owned`\n"
                ),
            )
            report = validator.validate_skill(skill, mode="claude-code")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("unsafe named argument $target", errors)
            self.assertIn("may print a credential value", errors)
            self.assertIn("appears to mutate state", errors)

    def test_protected_search_injection_is_accepted(self) -> None:
        report = validator.validate_skill(
            ROOT / "skills" / "tavily-search",
            mode="claude-code",
        )
        self.assertTrue(report["ok"], report["errors"])
        self.assertEqual(1, report["summary"]["dynamic_injections"])


class InventoryAndEvalTests(ValidatorTestCase):
    def test_python_cache_files_are_excluded_from_script_count(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(Path(tmp))
            cache = skill / "scripts" / "__pycache__"
            cache.mkdir(parents=True)
            (cache / "helper.cpython-313.pyc").write_bytes(b"cache")
            report = validator.validate_skill(skill, mode="portable")
            self.assertTrue(report["ok"], report["errors"])
            self.assertEqual(0, report["summary"]["scripts"])
            self.assertEqual(1, report["summary"]["ignored_python_cache_files"])

    def test_eval_schema_checks_identity_duplicates_expectations_and_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(Path(tmp))
            eval_dir = skill / "evals"
            eval_dir.mkdir()
            (eval_dir / "evals.json").write_text(
                json.dumps(
                    {
                        "skill_name": "wrong-name",
                        "evals": [
                            {
                                "id": 1,
                                "prompt": "Prompt",
                                "expected_output": "Outcome",
                                "files": ["evals/files/missing.txt"],
                                "expectations": [],
                            },
                            {
                                "id": 1,
                                "prompt": "Other",
                                "expected_output": "Outcome",
                                "files": [],
                                "expectations": ["Observable"],
                            },
                        ],
                    }
                ),
                encoding="utf-8",
            )
            report = validator.validate_skill(skill, mode="portable")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("skill_name must match", errors)
            self.assertIn("Duplicate eval id", errors)
            self.assertIn("expectations must be a non-empty", errors)
            self.assertIn("references missing file", errors)

    def test_eval_files_must_remain_inside_skill_root(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            skill = self.make_skill(root)
            outside = root / "outside.txt"
            outside.write_text("secret", encoding="utf-8")
            eval_dir = skill / "evals"
            eval_dir.mkdir()
            (eval_dir / "evals.json").write_text(
                json.dumps(
                    {
                        "skill_name": "sample-skill",
                        "evals": [
                            {
                                "id": 1,
                                "prompt": "Prompt",
                                "expected_output": "Outcome",
                                "files": ["../outside.txt", str(outside.resolve())],
                                "expectations": ["Observable"],
                            }
                        ],
                    }
                ),
                encoding="utf-8",
            )
            report = validator.validate_skill(skill, mode="portable")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("escapes the skill root", errors)
            self.assertIn("must be relative to the skill root", errors)

    def test_trigger_queries_require_positive_negative_unique_cases(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            skill = self.make_skill(Path(tmp))
            eval_dir = skill / "evals"
            eval_dir.mkdir()
            (eval_dir / "trigger_queries.json").write_text(
                json.dumps(
                    [
                        {"query": "Same", "should_trigger": True},
                        {"query": "Same", "should_trigger": True},
                    ]
                ),
                encoding="utf-8",
            )
            report = validator.validate_skill(skill, mode="portable")
            errors = self.messages(report)
            self.assertFalse(report["ok"])
            self.assertIn("Duplicate trigger query", errors)
            self.assertIn("at least one positive and one negative", errors)


if __name__ == "__main__":
    unittest.main()
