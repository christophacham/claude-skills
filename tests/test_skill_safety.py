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


def _resolve_powershell() -> str | None:
    """Return a usable PowerShell executable (pwsh preferred), or None."""
    path = shutil.which("pwsh")
    if path:
        return path
    if os.name == "nt":
        return shutil.which("powershell")
    return None


_POWERSHELL = _resolve_powershell()
_BASH = shutil.which("bash")


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
        expected = {"reimpl-scout", "tavily-search"}
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
                self.assertIsNone(
                    re.search(r"\b(curl|wget|Invoke-WebRequest)\b", command),
                    f"network injection in {skill_dir.name}:{line}",
                )
        self.assertEqual(expected, actual)


@unittest.skipIf(os.name == "nt", "POSIX installer tests require a POSIX host")
class InstallerTests(unittest.TestCase):
    def test_posix_installer_persists_keys_without_printing_them(self) -> None:
        sentinel = "test-brave-secret-must-not-be-printed"
        tavily_sentinel = "test-tavily-secret-must-not-be-printed"
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
                    "--tavily-api-key",
                    tavily_sentinel,
                ],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            output = result.stdout + result.stderr
            self.assertNotIn(sentinel, output)
            self.assertNotIn(tavily_sentinel, output)
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual(sentinel, data["env"]["BRAVE_API_KEY"])
            self.assertEqual(tavily_sentinel, data["env"]["TAVILY_API_KEY"])
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

    def test_posix_installer_project_path_absolute_or_relative(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            elsewhere = base / "elsewhere"
            target = base / "apps" / "my-app"
            home.mkdir()
            elsewhere.mkdir()
            target.mkdir(parents=True)
            env = os.environ.copy()
            env["HOME"] = str(home)

            # Absolute path from a different cwd
            result = subprocess.run(
                [
                    str(ROOT / "install.sh"),
                    "--project",
                    str(target),
                    "--skip-deps",
                    "--skip-brave-key",
                    "--skip-tavily-key",
                ],
                cwd=elsewhere,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue((target / ".claude" / "skills" / "simple-design" / "SKILL.md").is_file())
            self.assertFalse((elsewhere / ".claude").exists())

            # Relative path from parent of target
            sibling = base / "apps" / "other"
            sibling.mkdir()
            result = subprocess.run(
                [
                    str(ROOT / "install.sh"),
                    "--project",
                    "other",
                    "--skip-deps",
                    "--skip-brave-key",
                    "--skip-tavily-key",
                ],
                cwd=base / "apps",
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue((sibling / ".claude" / "pool.md").is_file())

            # Uninstall by absolute path from elsewhere
            result = subprocess.run(
                [str(ROOT / "uninstall.sh"), "--project", str(target)],
                cwd=elsewhere,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertFalse((target / ".claude" / "skills" / "simple-design").exists())

            # Missing project path fails
            missing = base / "no-such-dir"
            result = subprocess.run(
                [str(ROOT / "install.sh"), "--project", str(missing), "--skip-deps", "--skip-brave-key"],
                cwd=elsewhere,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("not a directory", result.stderr)

    def test_posix_uninstaller_removes_bundle_and_preserves_foreign(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            settings = home / ".claude" / "settings.json"
            settings.parent.mkdir(parents=True)
            project.mkdir()
            settings.write_text(
                json.dumps(
                    {
                        "theme": "dark",
                        "env": {
                            "OTHER": "kept",
                            "BRAVE_API_KEY": "secret-brave",
                            "TAVILY_API_KEY": "secret-tavily",
                        },
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            install = subprocess.run(
                [str(ROOT / "install.sh"), "--project", "--skip-deps", "--skip-brave-key", "--skip-tavily-key"],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, install.returncode, install.stderr)
            dest = project / ".claude"
            foreign_skill = dest / "skills" / "my-own-skill"
            foreign_skill.mkdir(parents=True)
            (foreign_skill / "SKILL.md").write_text("# mine\n", encoding="utf-8")
            foreign_agent = dest / "agents" / "custom.md"
            foreign_agent.write_text("# custom\n", encoding="utf-8")
            (dest / "skills" / "simple-design" / "SKILL.md").write_text("# should go\n", encoding="utf-8")

            result = subprocess.run(
                [str(ROOT / "uninstall.sh"), "--project"],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertFalse((dest / "skills" / "simple-design").exists())
            self.assertFalse((dest / "skills" / "brave-search").exists())
            self.assertFalse((dest / "agents" / "coder.md").exists())
            self.assertFalse((dest / "agents" / "panelists" / "seam.md").exists())
            self.assertFalse((dest / "pool.md").exists())
            self.assertTrue(foreign_skill.is_dir())
            self.assertTrue(foreign_agent.is_file())
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual("secret-brave", data["env"]["BRAVE_API_KEY"])
            self.assertEqual("secret-tavily", data["env"]["TAVILY_API_KEY"])
            self.assertEqual("kept", data["env"]["OTHER"])

    def test_posix_uninstaller_remove_keys(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            settings = home / ".claude" / "settings.json"
            settings.parent.mkdir(parents=True)
            project.mkdir()
            settings.write_text(
                json.dumps(
                    {
                        "theme": "dark",
                        "env": {
                            "OTHER": "kept",
                            "BRAVE_API_KEY": "secret-brave",
                            "BRAVE_SEARCH_API_KEY": "alt-brave",
                            "TAVILY_API_KEY": "secret-tavily",
                        },
                        "nested": {"items": [1, 2]},
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            result = subprocess.run(
                [str(ROOT / "uninstall.sh"), "--project", "--remove-keys"],
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            output = result.stdout + result.stderr
            self.assertNotIn("secret-brave", output)
            self.assertNotIn("secret-tavily", output)
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual("dark", data["theme"])
            self.assertEqual({"items": [1, 2]}, data["nested"])
            self.assertEqual({"OTHER": "kept"}, data["env"])


@unittest.skipIf(_POWERSHELL is None, "PowerShell is not installed")
class PowerShellInstallerTests(unittest.TestCase):
    def test_windows_installer_persists_keys_without_printing_them(self) -> None:
        sentinel = "test-brave-secret-must-not-be-printed"
        tavily_sentinel = "test-tavily-secret-must-not-be-printed"
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
            env["USERPROFILE"] = str(home)
            command = [_POWERSHELL, "-NoProfile"]
            if os.name == "nt":
                command += ["-ExecutionPolicy", "Bypass"]
            command += [
                "-File",
                str(ROOT / "install.ps1"),
                "-Project",
                "-SkipDeps",
                "-BraveApiKey",
                sentinel,
                "-TavilyApiKey",
                tavily_sentinel,
            ]
            result = subprocess.run(
                command,
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            output = result.stdout + result.stderr
            self.assertNotIn(sentinel, output)
            self.assertNotIn(tavily_sentinel, output)
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual(sentinel, data["env"]["BRAVE_API_KEY"])
            self.assertEqual(tavily_sentinel, data["env"]["TAVILY_API_KEY"])
            self.assertEqual("kept", data["env"]["OTHER"])
            self.assertEqual({"items": [1, 2]}, data["nested"])
            self.assertTrue((project / ".claude" / "skills" / "brave-search" / "SKILL.md").is_file())

    def test_windows_uninstaller_removes_bundle_and_preserves_foreign(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            settings = home / ".claude" / "settings.json"
            settings.parent.mkdir(parents=True)
            project.mkdir()
            settings.write_text(
                json.dumps(
                    {
                        "theme": "dark",
                        "env": {
                            "OTHER": "kept",
                            "BRAVE_API_KEY": "secret-brave",
                            "TAVILY_API_KEY": "secret-tavily",
                        },
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            env["USERPROFILE"] = str(home)
            command = [_POWERSHELL, "-NoProfile"]
            if os.name == "nt":
                command += ["-ExecutionPolicy", "Bypass"]
            install_cmd = command + [
                "-File",
                str(ROOT / "install.ps1"),
                "-Project",
                "-SkipDeps",
                "-SkipBraveKey",
                "-SkipTavilyKey",
            ]
            install = subprocess.run(
                install_cmd,
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, install.returncode, install.stderr)
            dest = project / ".claude"
            foreign_skill = dest / "skills" / "my-own-skill"
            foreign_skill.mkdir(parents=True)
            (foreign_skill / "SKILL.md").write_text("# mine\n", encoding="utf-8")
            foreign_agent = dest / "agents" / "custom.md"
            foreign_agent.write_text("# custom\n", encoding="utf-8")

            uninstall_cmd = command + ["-File", str(ROOT / "uninstall.ps1"), "-Project"]
            result = subprocess.run(
                uninstall_cmd,
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            self.assertFalse((dest / "skills" / "simple-design").exists())
            self.assertFalse((dest / "skills" / "brave-search").exists())
            self.assertFalse((dest / "agents" / "coder.md").exists())
            self.assertFalse((dest / "pool.md").exists())
            self.assertTrue(foreign_skill.is_dir())
            self.assertTrue(foreign_agent.is_file())
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual("secret-brave", data["env"]["BRAVE_API_KEY"])
            self.assertEqual("secret-tavily", data["env"]["TAVILY_API_KEY"])
            self.assertEqual("kept", data["env"]["OTHER"])

    def test_windows_uninstaller_remove_keys(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            home = base / "home"
            project = base / "project"
            settings = home / ".claude" / "settings.json"
            settings.parent.mkdir(parents=True)
            project.mkdir()
            settings.write_text(
                json.dumps(
                    {
                        "theme": "dark",
                        "env": {
                            "OTHER": "kept",
                            "BRAVE_API_KEY": "secret-brave",
                            "BRAVE_SEARCH_API_KEY": "alt-brave",
                            "TAVILY_API_KEY": "secret-tavily",
                        },
                        "nested": {"items": [1, 2]},
                    }
                ),
                encoding="utf-8",
            )
            env = os.environ.copy()
            env["HOME"] = str(home)
            env["USERPROFILE"] = str(home)
            command = [_POWERSHELL, "-NoProfile"]
            if os.name == "nt":
                command += ["-ExecutionPolicy", "Bypass"]
            command += ["-File", str(ROOT / "uninstall.ps1"), "-Project", "-RemoveKeys"]
            result = subprocess.run(
                command,
                cwd=project,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(0, result.returncode, result.stderr)
            output = result.stdout + result.stderr
            self.assertNotIn("secret-brave", output)
            self.assertNotIn("secret-tavily", output)
            data = json.loads(settings.read_text(encoding="utf-8"))
            self.assertEqual("dark", data["theme"])
            self.assertEqual({"items": [1, 2]}, data["nested"])
            self.assertEqual({"OTHER": "kept"}, data["env"])


@unittest.skipIf(os.name == "nt" or _BASH is None, "POSIX helper tests require bash on a POSIX host")
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
            "#!/bin/sh\n"
            "printf '%s\\n' \"$@\" > \"$GH_LOG\"\n"
            "git -C \"$4\" init -q\n"
            "git -C \"$4\" remote add origin \"$3\"\n"
            "case \" $* \" in *' --depth 1 '*) printf '%040d\\n' 0 > \"$4/.git/shallow\";; esac\n",
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
            for command in ("mkdir", "mktemp", "mv", "find", "tr", "rm"):
                executable = shutil.which(command)
                assert executable, command
                (isolated / command).symlink_to(executable)
            real_git = shutil.which("git")
            assert real_git
            fake_git = isolated / "git"
            fake_git.write_text(
                "#!/bin/sh\n"
                "case \" $* \" in\n"
                "  *' clone '*)\n"
                "    eval \"dest=\\${$#}\"\n"
                "    url=\n"
                "    for arg in \"$@\"; do case \"$arg\" in https://github.com/*) url=$arg;; esac; done\n"
                "    \"$REAL_GIT\" -C \"$dest\" init -q\n"
                "    \"$REAL_GIT\" -C \"$dest\" remote add origin \"$url\"\n"
                "    case \" $* \" in *' --depth 1 '*) printf '%040d\\n' 0 > \"$dest/.git/shallow\";; esac;;\n"
                "  *) exec \"$REAL_GIT\" \"$@\";;\n"
                "esac\n",
                encoding="utf-8",
            )
            fake_git.chmod(0o755)
            env["REAL_GIT"] = real_git
            env["PATH"] = str(isolated)
        bash = _BASH
        assert bash
        return subprocess.run(
            [bash, str(self.helper), *args],
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
        args = self.log.read_text(encoding="utf-8").splitlines()
        self.assertEqual(["repo", "clone", "https://github.com/example/project.git"], args[:3])
        self.assertRegex(args[3], r"/code/tmp/\.peek-repo-project\.")
        self.assertEqual(["--", "--depth", "1", "--single-branch"], args[4:])
        self.assertTrue((self.home / "code" / "tmp" / "project" / ".git").is_dir())

    def test_full_clone_omits_depth(self) -> None:
        result = self.run_helper("example/project", "--full")
        self.assertEqual(0, result.returncode, result.stderr)
        args = self.log.read_text(encoding="utf-8").splitlines()
        self.assertEqual(["repo", "clone", "https://github.com/example/project.git"], args[:3])
        self.assertRegex(args[3], r"/code/tmp/\.peek-repo-project\.")
        self.assertEqual(4, len(args))
        self.assertTrue((self.home / "code" / "tmp" / "project" / ".git").is_dir())

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

    def test_uses_noninteractive_git_fallback_without_gh(self) -> None:
        result = self.run_helper("example/project", with_gh=False)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("STATUS=CLONED", result.stdout)
        self.assertIn("CLONE_BACKEND=git", result.stdout)


@unittest.skipIf(_POWERSHELL is None, "PowerShell is not installed")
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
                "@echo off\n>\"%GH_LOG%\" (echo %1& echo %2& echo %3& echo %4& echo %5& echo %6& echo %7& echo %8)\n"
                "git -C \"%4%\" init -q\n"
                "git -C \"%4%\" remote add origin \"%3%\"\n"
                "if \"%6\"==\"--depth\" >\"%4%\\.git\\shallow\" echo 0000000000000000000000000000000000000000\n",
                encoding="utf-8",
            )
        else:
            gh = self.bin / "gh"
            gh.write_text(
                "#!/bin/sh\n"
                "printf '%s\\n' \"$@\" > \"$GH_LOG\"\n"
                "git -C \"$4\" init -q\n"
                "git -C \"$4\" remote add origin \"$3\"\n"
                "case \" $* \" in *' --depth 1 '*) printf '%040d\\n' 0 > \"$4/.git/shallow\";; esac\n",
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
            [_POWERSHELL, "-NoProfile", "-File", str(self.helper), "-Repo", repo],
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
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("STATUS=CLONED", result.stdout)
        args = self.log.read_text(encoding="utf-8").splitlines()
        self.assertEqual(["repo", "clone", "https://github.com/example/project.git"], args[:3])
        self.assertEqual(["--", "--depth", "1", "--single-branch"], args[-4:])

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
