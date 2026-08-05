from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"
VALIDATOR_PATH = SKILLS / "skill-creator" / "scripts" / "validate_skill.py"

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
        expected = {"bd-epic-runner", "work-loop", "work-plan"}
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
            self.assertIn("shell: bash", text, skill_dir.name)

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
                self.assertIsNone(
                    re.search(r"\b(curl|wget|Invoke-WebRequest)\b", command),
                    f"network injection in {skill_dir.name}:{line}",
                )
        self.assertEqual(expected, actual)


@unittest.skipIf(os.name == "nt", "POSIX installer tests require a POSIX host")
class InstallerTests(unittest.TestCase):
    def test_posix_installer_persists_key_without_printing_it(self) -> None:
        sentinel = "test-secret-must-not-be-printed"
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            settings = home / ".claude" / "settings.json"
            settings.parent.mkdir(parents=True)
            project.mkdir()
            settings.write_text(
                json.dumps({"theme": "dark", "env": {"OTHER": "kept"}, "nested": {"items": [1, 2]}}),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            result = subprocess.run(
                [
                    str(ROOT / "install.sh"),
                    "--project",
                    "--skip-deps",
                    "--brave-api-key",
                    sentinel,
                ],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertNotIn(sentinel, result.stdout + result.stderr)
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual(sentinel, data["env"]["BRAVE_API_KEY"])
            self.assertEqual("kept", data["env"]["OTHER"])
            self.assertEqual({"items": [1, 2]}, data["nested"])
            self.assertTrue((project / ".claude" / "skills" / "brave-search" / "SKILL.md").is_file())

    def test_posix_installer_falls_back_from_old_python3(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            fake_bin = base / "bin"
            home.mkdir()
            project.mkdir()
            fake_bin.mkdir()

            (fake_bin / "python3").write_text(
                "#!/bin/sh\ncase \"$2\" in *'(3, 0)'*) exit 0;; *'(3, 10)'*) exit 1;; esac\nexit 1\n",
                encoding="utf-8",
            )
            (fake_bin / "python").write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$PYTHON_LOG\"\n"
                "case \"$1:$2\" in\n"
                "  -c:*'(3, 0)'*|-c:*'(3, 10)'*|-c:*'import ddgs'*) exit 0;;\n"
                "  -m:pip*) exit 99;;\n"
                "esac\n"
                "exit 1\n",
                encoding="utf-8",
            )
            (fake_bin / "node").write_text(
                "#!/bin/sh\nif [ \"$1\" = '--version' ]; then echo v22.0.0; fi\nexit 0\n",
                encoding="utf-8",
            )
            (fake_bin / "npm").write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
            for executable in fake_bin.iterdir():
                executable.chmod(0o755)

            python_log = base / "python.log"
            env = os.environ.copy()
            env["HOME"] = str(home)
            env["PATH"] = str(fake_bin) + os.pathsep + env.get("PATH", "")
            env["PYTHON_LOG"] = str(python_log)
            result = subprocess.run(
                [str(ROOT / "install.sh"), "--project", "--skip-brave-key"],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertIn("deps ready:       ddgs (python)", result.stdout)
            calls = python_log.read_text(encoding="utf-8")
            self.assertIn("import ddgs", calls)
            self.assertNotIn("-m pip", calls)


@unittest.skipIf(os.name == "nt", "POSIX helper tests require a POSIX host")
class PeekRepoHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.home = self.base / "home"
        self.bin = self.base / "bin"
        self.home.mkdir()
        self.bin.mkdir()
        self.log = self.base / "gh-args"
        self.helper = SKILLS / "peek-repo" / "scripts" / "ensure-clone.sh"
        gh = self.bin / "gh"
        gh.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$GH_LOG\"\nmkdir -p \"$4/.git\"\n",
            encoding="utf-8",
        )
        gh.chmod(0o755)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_helper(self, *args: str, with_gh: bool = True) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["HOME"] = str(self.home)
        env["GH_LOG"] = str(self.log)
        if with_gh:
            env["PATH"] = str(self.bin) + os.pathsep + env.get("PATH", "")
        else:
            isolated = self.base / "isolated-bin"
            isolated.mkdir(exist_ok=True)
            mkdir = shutil.which("mkdir")
            assert mkdir
            (isolated / "mkdir").symlink_to(mkdir)
            env["PATH"] = str(isolated)
        return subprocess.run(
            ["/bin/bash", str(self.helper), *args],
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_shallow_clone_normalizes_github_url(self) -> None:
        result = self.run_helper("https://github.com/example/project.git/tree/main")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("STATUS=CLONED", result.stdout)
        self.assertIn("SLUG=example/project", result.stdout)
        self.assertEqual(
            ["repo", "clone", "example/project", str(self.home / "code" / "tmp" / "project"), "--", "--depth", "1"],
            self.log.read_text(encoding="utf-8").splitlines(),
        )

    def test_full_clone_omits_depth(self) -> None:
        result = self.run_helper("example/project", "--full")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            ["repo", "clone", "example/project", str(self.home / "code" / "tmp" / "project")],
            self.log.read_text(encoding="utf-8").splitlines(),
        )

    def test_rejects_shell_text_without_side_effect(self) -> None:
        marker = self.base / "owned"
        result = self.run_helper(f"example/project;touch {marker}")
        self.assertNotEqual(0, result.returncode)
        self.assertIn("STATUS=ERROR", result.stdout)
        self.assertFalse(marker.exists())
        self.assertFalse(self.log.exists())

    def test_rejects_dot_segment_destination(self) -> None:
        result = self.run_helper("example/..")
        self.assertNotEqual(0, result.returncode)
        self.assertIn("STATUS=ERROR", result.stdout)
        self.assertFalse(self.log.exists())

    def test_blocks_existing_clone_from_different_owner(self) -> None:
        dest = self.home / "code" / "tmp" / "project"
        dest.mkdir(parents=True)
        subprocess.run(["git", "-C", str(dest), "init"], check=True, capture_output=True)
        subprocess.run(
            ["git", "-C", str(dest), "remote", "add", "origin", "https://github.com/other/project.git"],
            check=True,
            capture_output=True,
        )
        result = self.run_helper("example/project")
        self.assertEqual(2, result.returncode)
        self.assertIn("STATUS=BLOCKED", result.stdout)
        self.assertIn("other/project", result.stdout)
        self.assertFalse(self.log.exists())

    def test_reuses_existing_clone_with_case_insensitive_matching_origin(self) -> None:
        dest = self.home / "code" / "tmp" / "Project"
        dest.mkdir(parents=True)
        subprocess.run(["git", "-C", str(dest), "init"], check=True, capture_output=True)
        subprocess.run(
            ["git", "-C", str(dest), "remote", "add", "origin", "git@github.com:example/Project.git"],
            check=True,
            capture_output=True,
        )
        result = self.run_helper("Example/Project")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("STATUS=EXISTS", result.stdout)
        self.assertFalse(self.log.exists())

    def test_blocks_occupied_non_git_destination(self) -> None:
        dest = self.home / "code" / "tmp" / "project"
        dest.mkdir(parents=True)
        (dest / "file.txt").write_text("occupied", encoding="utf-8")
        result = self.run_helper("example/project")
        self.assertEqual(2, result.returncode)
        self.assertIn("STATUS=BLOCKED", result.stdout)
        self.assertFalse(self.log.exists())

    def test_reports_missing_gh(self) -> None:
        result = self.run_helper("example/project", with_gh=False)
        self.assertEqual(3, result.returncode)
        self.assertIn("gh CLI not found", result.stdout)


@unittest.skipUnless(shutil.which("pwsh"), "pwsh is not installed")
class PeekRepoPowerShellHelperTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.home = self.base / "home"
        self.bin = self.base / "bin"
        self.log = self.base / "gh-args"
        self.home.mkdir()
        self.bin.mkdir()
        self.helper = SKILLS / "peek-repo" / "scripts" / "ensure-clone.ps1"
        if os.name == "nt":
            gh = self.bin / "gh.cmd"
            gh.write_text(
                "@echo off\n>\"%GH_LOG%\" (echo %1& echo %2& echo %3& echo %4& echo %5& echo %6& echo %7)\nmkdir \"%4%\\.git\"\n",
                encoding="utf-8",
            )
        else:
            gh = self.bin / "gh"
            gh.write_text(
                "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$GH_LOG\"\nmkdir -p \"$4/.git\"\n",
                encoding="utf-8",
            )
            gh.chmod(0o755)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_helper(self, repo: str) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["HOME"] = str(self.home)
        env["USERPROFILE"] = str(self.home)
        env["GH_LOG"] = str(self.log)
        env["PATH"] = str(self.bin) + os.pathsep + env.get("PATH", "")
        return subprocess.run(
            ["pwsh", "-NoProfile", "-File", str(self.helper), "-Repo", repo],
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def make_clone(self, name: str, origin: str) -> Path:
        dest = self.home / "code" / "tmp" / name
        dest.mkdir(parents=True)
        subprocess.run(["git", "-C", str(dest), "init"], check=True, capture_output=True)
        subprocess.run(
            ["git", "-C", str(dest), "remote", "add", "origin", origin],
            check=True,
            capture_output=True,
        )
        return dest

    def test_rejects_dot_segment_and_lookalike_host(self) -> None:
        for repo in ("example/..", "https://notgithub.com/example/project"):
            with self.subTest(repo=repo):
                result = self.run_helper(repo)
                self.assertNotEqual(0, result.returncode)

    def test_blocks_mismatched_origin(self) -> None:
        self.make_clone("project", "https://github.com/other/project.git")
        result = self.run_helper("example/project")
        self.assertEqual(2, result.returncode)
        self.assertIn("STATUS=BLOCKED", result.stdout)

    def test_reuses_case_insensitive_matching_origin(self) -> None:
        self.make_clone("Project", "git@github.com:example/Project.git")
        result = self.run_helper("Example/Project")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("STATUS=EXISTS", result.stdout)

    def test_clone_passes_arguments_without_shell_reparsing(self) -> None:
        result = self.run_helper("example/project")
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertIn("STATUS=CLONED", result.stdout)
        args = self.log.read_text(encoding="utf-8").splitlines()
        self.assertEqual(["repo", "clone", "example/project"], args[:3])
        self.assertEqual(["--", "--depth", "1"], args[-3:])

    def test_blocks_destination_symlink(self) -> None:
        root = self.home / "code" / "tmp"
        outside = self.base / "outside"
        root.mkdir(parents=True)
        outside.mkdir()
        try:
            (root / "project").symlink_to(outside, target_is_directory=True)
        except OSError as error:
            self.skipTest(f"cannot create directory symlink: {error}")
        result = self.run_helper("example/project")
        self.assertEqual(2, result.returncode)
        self.assertIn("symbolic link", result.stdout)


if __name__ == "__main__":
    unittest.main()
