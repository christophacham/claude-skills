from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
VALIDATOR_PATH = SKILLS / "skill-creator" / "scripts" / "validate_skill.py"

spec = importlib.util.spec_from_file_location("skill_validator_semantics", VALIDATOR_PATH)
assert spec and spec.loader
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)


def flatten(text: str) -> str:
    return " ".join(text.split())


class GeometryDoctrineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.skill = (SKILLS / "geometric-robustness" / "SKILL.md").read_text(encoding="utf-8")
        cls.reference = (
            SKILLS / "geometric-robustness" / "references" / "reference.md"
        ).read_text(encoding="utf-8")
        cls.skill_flat = flatten(cls.skill)
        cls.reference_flat = flatten(cls.reference)

    def test_tolerances_separate_uncertainty_roundoff_snap_and_process(self) -> None:
        for phrase in (
            "Input uncertainty",
            "Numerical error bound",
            "Geometric snap/weld distance",
            "Process/manufacturing tolerance",
            "absolute-plus-relative",
        ):
            self.assertIn(phrase, self.skill_flat)
        self.assertIn("Exact predicate signs are compared with zero exactly", self.skill_flat)
        self.assertNotIn("Relative beats absolute", self.skill_flat)
        self.assertNotIn("~1e-9 to 1e-12", self.skill_flat)

    def test_predicates_and_constructions_have_scoped_guarantees(self) -> None:
        self.assertIn("represented input floats", self.skill_flat)
        self.assertIn("does not remove measurement uncertainty", self.skill_flat)
        self.assertIn("certification", self.skill.lower())
        self.assertIn("NeedsHigherPrecision", self.reference_flat)
        self.assertIn("Do not recompute topology from the constructed coordinate", self.skill_flat)
        self.assertNotIn("construct with floats; never reverse", self.skill_flat)

    def test_determinism_uses_explicit_tiers(self) -> None:
        for tier in (
            "D0 — topological/canonical",
            "D1 — pinned-byte",
            "D2 — cross-platform-byte",
        ):
            self.assertIn(tier, self.skill_flat)
        self.assertIn("does not prove", self.skill_flat)
        self.assertIn("runtime/math implementation", self.skill_flat)
        self.assertIn("standard transcendental functions", self.skill_flat)
        self.assertIn("IndexMap` is deterministic only when", self.skill_flat)
        self.assertNotIn("bit-identical output on every run and every supported platform", self.skill_flat)

    def test_transform_properties_include_frame_and_process_parameters(self) -> None:
        for phrase in (
            "layer phase",
            "inverse transpose",
            "negative determinant",
            "dimensionless relative tolerances stay unchanged",
            "invertible linear part",
            "preserve coordinate distinctions",
            "classifications/signs",
        ):
            self.assertIn(phrase, self.skill_flat)
        self.assertIn("Rotating only the mesh is a different problem", self.skill_flat)

        def orient(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
            return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

        points = ((0.0, 0.0), (1.0, 0.0), (0.0, 1.0))
        translated = tuple((x + 2**53, y + 2**53) for x, y in points)
        self.assertGreater(orient(*points), 0.0)
        self.assertEqual(0.0, orient(*translated))
        self.assertNotIn("orient(a,b,c) == -orient(b,a,c)", self.reference)

    def test_invariants_and_golden_authority_are_not_self_referential(self) -> None:
        self.assertIn("An additive toolpath is not expected to avoid the model volume itself", self.skill_flat)
        self.assertIn("specification and documented preconditions/postconditions", self.skill_flat)
        self.assertIn("A golden records prior behavior", self.skill_flat)
        self.assertIn("independent reference", self.skill_flat)
        self.assertNotIn("total sliced area per height interval is monotone", self.skill_flat)


class DesignDoctrineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.architecture = (SKILLS / "architecture-design" / "references" / "reference.md").read_text(encoding="utf-8")
        cls.architecture_skill = (SKILLS / "architecture-design" / "SKILL.md").read_text(encoding="utf-8")
        cls.distributed = (SKILLS / "distributed-architecture" / "SKILL.md").read_text(encoding="utf-8")
        cls.distributed_ref = (SKILLS / "distributed-architecture" / "references" / "reference.md").read_text(encoding="utf-8")
        cls.refactoring = (SKILLS / "refactoring" / "SKILL.md").read_text(encoding="utf-8")

    def test_architecture_design_has_no_ddd_pedagogy(self) -> None:
        combined = f"{self.architecture_skill}\n{self.architecture}".lower()
        for forbidden in (
            "ddd",
            "domain-driven",
            "tactical ddd",
            "strategic ddd",
            "ubiquitous language",
            "bounded context",
            "aggregate root",
            "value object",
            "domain event",
            "anemic domain",
        ):
            self.assertNotIn(forbidden, combined, forbidden)
        self.assertNotIn("bounded context", self.distributed_ref.lower())

    def test_atomic_persistence_example_includes_idempotent_result_and_outbox(self) -> None:
        self.assertIn("save_submission", self.architecture)
        self.assertIn("command result in one", self.architecture)
        self.assertIn("mark_events_committed", self.architecture)
        self.assertNotIn("ApiResponse::error(e.to_string())", self.architecture)
        self.assertNotIn("Utc::now()", self.architecture)
        self.assertNotIn("Uuid::new_v4()", self.architecture)

    def test_main_sequence_and_saga_terms_are_consistent(self) -> None:
        self.assertNotIn("atomic/eventual", self.distributed)
        self.assertIn("stable and concrete", self.distributed_ref)
        self.assertIn("unstable and abstract", self.distributed_ref)
        corners = {(a, i): abs(a + i - 1) for a in (0, 1) for i in (0, 1)}
        self.assertEqual(1, corners[(0, 0)])
        self.assertEqual(1, corners[(1, 1)])
        self.assertEqual(0, corners[(0, 1)])
        self.assertEqual(0, corners[(1, 0)])

    def test_abstraction_and_double_guidance_share_ownership(self) -> None:
        self.assertIn("not an automatic threshold", self.refactoring)


class DynamicInjectionDoctrineTests(unittest.TestCase):
    """Injection audit lives under skill-creator after the DCI merge."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.skill_path = SKILLS / "skill-creator" / "SKILL.md"
        cls.skill = cls.skill_path.read_text(encoding="utf-8")
        cls.examples = (
            SKILLS / "skill-creator" / "references" / "injection-examples.md"
        ).read_text(encoding="utf-8")
        cls.skill_flat = flatten(cls.skill)
        cls.examples_flat = flatten(cls.examples)

    def test_teaching_skill_does_not_self_execute(self) -> None:
        _, body, errors = validator.split_frontmatter(self.skill)
        self.assertEqual([], errors)
        injections, injection_errors = validator.find_injections(body)
        self.assertEqual([], injection_errors)
        self.assertEqual([], injections)

    def test_argument_substitution_is_not_described_as_safe_argv(self) -> None:
        self.assertIn("does not turn textual substitution into safe argv passing", self.skill_flat)
        self.assertIn("do not create a safely escaped argv element", self.examples_flat)
        self.assertIn("$ARGUMENTS", self.examples_flat)
        self.assertNotIn("so `$0` works", self.examples_flat)

    def test_shell_substitution_and_concurrency_are_distinguished(self) -> None:
        self.assertIn("Normal shell evaluation still happens", self.skill_flat)
        self.assertIn("command substitution such as `$(...)` work", self.skill_flat)
        self.assertIn("may execute them concurrently", self.skill_flat)
        self.assertIn("commands in that block run sequentially", self.skill_flat)
        self.assertIn("renderer's single-pass rule", self.examples_flat)

    def test_failure_guards_cover_pipeline_and_powershell_semantics(self) -> None:
        self.assertIn("not a reliable guard", self.skill_flat)
        self.assertIn("`head` can still exit zero", self.examples_flat)
        self.assertIn("$LASTEXITCODE", self.skill_flat)
        self.assertIn("service_key=present", self.examples_flat)
        self.assertIn("never a token value", self.examples_flat)

    def test_audit_mode_is_entry_visible_in_skill_creator(self) -> None:
        self.assertIn("## Dynamic context injection (audit mode)", self.skill)
        self.assertIn("references/injection-examples.md", self.skill)


class SkillCreatorContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.skill = (SKILLS / "skill-creator" / "SKILL.md").read_text(encoding="utf-8")
        cls.spec = (
            SKILLS / "skill-creator" / "references" / "spec-and-patterns.md"
        ).read_text(encoding="utf-8")
        cls.installer = (
            ROOT / "docs" / "node-native-installer-pattern.md"
        ).read_text(encoding="utf-8")
        cls.skill_flat = flatten(cls.skill)
        cls.spec_flat = flatten(cls.spec)
        cls.installer_flat = flatten(cls.installer)

    def test_docs_distinguish_portable_and_claude_code_modes(self) -> None:
        self.assertIn("--mode portable", self.skill_flat)
        self.assertIn("--mode claude-code", self.skill_flat)
        self.assertIn("only `name`, `description`, `license`", self.skill_flat)
        self.assertIn("Claude Code-only body preprocessing", self.skill_flat)
        self.assertIn("Portable validation rejects Claude Code extension fields", self.spec_flat)

    def test_installer_docs_match_current_repository_behavior(self) -> None:
        self.assertIn("claude-skills install [--project <dir>] [--skip-deps]", self.skill_flat)
        self.assertIn("does not install to `.agents/`", self.skill_flat)
        self.assertIn("removes only global items recorded", self.skill_flat)
        self.assertIn("docs/node-native-installer-pattern.md", self.skill_flat)
        self.assertIn("menu wizard", self.installer_flat)
        self.assertIn("SKILL_GROUPS", self.installer)
        self.assertIn("**CORE** — default-selected", self.installer)
        self.assertIn("**AUTHOR** — default-selected", self.installer)
        self.assertIn("**OPT_IN** — offer only", self.installer)
        self.assertIn("**SECURITY** — offer only", self.installer)
        self.assertIn("**SPECIALIST** — offer only", self.installer)
        self.assertNotIn("dynamic-context-injection", self.installer_flat)
        self.assertNotIn("npx @scope/agent-skill-books install --all", self.installer_flat)
        self.assertNotIn("install.sh", self.installer_flat)
        self.assertNotIn("install.ps1", self.installer_flat)
        # Installer essay is repo docs, not skill payload
        self.assertFalse(
            (SKILLS / "skill-creator" / "references" / "node-native-installer-pattern.md").exists()
        )

    def test_eval_schema_is_consistent_across_docs_and_template(self) -> None:
        template = json.loads(
            (SKILLS / "skill-creator" / "assets" / "OUTPUT_EVALS_TEMPLATE.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual({"skill_name", "evals"}, set(template))
        entry = template["evals"][0]
        self.assertEqual(
            {"id", "prompt", "expected_output", "files", "expectations"},
            set(entry),
        )
        self.assertEqual(1, entry["id"])
        self.assertEqual([], entry["files"])
        self.assertIn("positive integer", self.skill.lower())
        self.assertIn("confined within the skill", self.skill_flat)

    def test_all_corrected_eval_and_trigger_files_validate(self) -> None:
        names = {
            "architecture-design", "beads", "beads-om", "capability-plan",
            "distributed-architecture",
            "geometric-robustness", "operating-mode",
            "refactoring", "simple-design",
            "skill-creator",
        }
        for name in names:
            with self.subTest(skill=name):
                report = validator.validate_skill(SKILLS / name, mode="portable")
                self.assertTrue(report["ok"], report["errors"])
                self.assertGreater(report["summary"]["evals"], 0)
                self.assertGreater(report["summary"]["trigger_queries"], 0)


if __name__ == "__main__":
    unittest.main()
