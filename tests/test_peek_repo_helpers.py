from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPERS = ROOT / "skills" / "peek-repo" / "scripts"
POSIX_HELPER = HELPERS / "ensure-clone.sh"
POWERSHELL_HELPER = HELPERS / "ensure-clone.ps1"
BASH = shutil.which("bash")
POWERSHELL = shutil.which("pwsh") or (shutil.which("powershell") if os.name == "nt" else None)


def parse_protocol(result: subprocess.CompletedProcess[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        if re.fullmatch(r"[A-Z_]+", key):
            if key in fields:
                raise AssertionError(f"duplicate protocol field: {key}")
            fields[key] = value
    return fields


def write_executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(0o755)


@unittest.skipIf(os.name == "nt" or BASH is None, "POSIX helper tests require bash on POSIX")
class PosixCloneProtocolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.home = self.base / "home"
        self.bin = self.base / "bin"
        self.home.mkdir()
        self.bin.mkdir()
        self.gh_log = self.base / "gh-args"
        self.env_log = self.base / "gh-env"
        self.mktemp_log = self.base / "mktemp-args"
        self.env = os.environ.copy()
        self.env.update(
            {
                "HOME": str(self.home),
                "GH_LOG": str(self.gh_log),
                "GH_ENV_LOG": str(self.env_log),
                "MKTEMP_LOG": str(self.mktemp_log),
                "REAL_MKTEMP": shutil.which("mktemp") or "mktemp",
                "PATH": str(self.bin) + os.pathsep + os.environ.get("PATH", ""),
            }
        )
        self.install_successful_gh()
        write_executable(
            self.bin / "mktemp",
            "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$MKTEMP_LOG\"\nexec \"$REAL_MKTEMP\" \"$@\"\n",
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def install_successful_gh(self) -> None:
        write_executable(
            self.bin / "gh",
            "#!/bin/sh\n"
            "printf '%s\\n' \"$@\" > \"$GH_LOG\"\n"
            "printf 'GH_PROMPT_DISABLED=%s\\nGIT_TERMINAL_PROMPT=%s\\nGCM_INTERACTIVE=%s\\n' "
            '"$GH_PROMPT_DISABLED" "$GIT_TERMINAL_PROMPT" "$GCM_INTERACTIVE" > "$GH_ENV_LOG"\n'
            "git -C \"$4\" init -q\n"
            "git -C \"$4\" remote add origin \"$3\"\n"
            "case \" $* \" in *' --depth 1 '*) printf '%040d\\n' 0 > \"$4/.git/shallow\";; esac\n",
        )

    def run_helper(self, repo: str, *extra: str) -> subprocess.CompletedProcess[str]:
        assert BASH
        return subprocess.run(
            [BASH, str(POSIX_HELPER), repo, *extra],
            env=self.env,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_clone_uses_private_stage_to_reserve_final_path_and_structured_protocol(self) -> None:
        result = self.run_helper("https://github.com/Example/Project.git/tree/main")
        fields = parse_protocol(result)

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("CLONED", fields["STATUS"])
        self.assertEqual("0", fields["EXIT_CODE"])
        self.assertEqual("Example/Project", fields["SLUG"])
        self.assertEqual("CLONED", fields["ACTION"])
        self.assertEqual("true", fields["SHALLOW"])
        self.assertEqual("CLONE_TIME", fields["FRESHNESS"])
        self.assertEqual("PASSED", fields["ORIGIN_CHECK"])
        self.assertEqual("gh", fields["CLONE_BACKEND"])

        destination = self.home / "code" / "tmp" / "Project"
        self.assertEqual(str(destination.resolve()), fields["PATH"])
        args = self.gh_log.read_text(encoding="utf-8").splitlines()
        self.assertEqual(["repo", "clone", "https://github.com/Example/Project.git"], args[:3])
        self.assertRegex(args[3], r"/code/tmp/\.peek-repo-Project\.")
        self.assertTrue((destination / ".git").is_dir())
        self.assertRegex(
            self.mktemp_log.read_text(encoding="utf-8"),
            re.escape(str(destination.parent.resolve() / ".peek-repo-Project.")) + r"X{8}",
        )
        self.assertEqual([], list(destination.parent.glob(".peek-repo-*")))

    def test_rejects_every_preexisting_non_repo_shape(self) -> None:
        root = self.home / "code" / "tmp"
        root.mkdir(parents=True)
        occupied = {
            "empty": "directory",
            "file": "file",
        }
        for name, kind in occupied.items():
            path = root / name
            if kind == "directory":
                path.mkdir()
            else:
                path.write_text("occupied", encoding="utf-8")
            with self.subTest(kind=kind):
                result = self.run_helper(f"example/{name}")
                fields = parse_protocol(result)
                self.assertEqual(2, result.returncode)
                self.assertEqual("BLOCKED", fields["STATUS"])
                self.assertEqual("2", fields["EXIT_CODE"])
                self.assertEqual("DESTINATION_OCCUPIED", fields["ERROR"])
        self.assertFalse(self.gh_log.exists())

    def test_rejects_root_and_destination_links(self) -> None:
        outside = self.base / "outside"
        outside.mkdir()
        try:
            (self.home / "code").symlink_to(outside, target_is_directory=True)
        except OSError as error:
            self.skipTest(f"cannot create directory symlink: {error}")
        root_result = self.run_helper("example/project")
        root_fields = parse_protocol(root_result)
        self.assertEqual(4, root_result.returncode)
        self.assertEqual("UNSAFE_ROOT", root_fields["ERROR"])
        self.assertFalse(self.gh_log.exists())

        (self.home / "code").unlink()
        root = self.home / "code" / "tmp"
        root.mkdir(parents=True)
        (root / "project").symlink_to(outside, target_is_directory=True)
        dest_result = self.run_helper("example/project")
        dest_fields = parse_protocol(dest_result)
        self.assertEqual(2, dest_result.returncode)
        self.assertEqual("DESTINATION_LINK", dest_fields["ERROR"])
        self.assertFalse(self.gh_log.exists())

    def test_no_clobber_finalization_preserves_racing_destination(self) -> None:
        real_mv = shutil.which("mv")
        assert real_mv
        write_executable(
            self.bin / "mv",
            "#!/bin/sh\n"
            "destination=$2\n"
            "mkdir -p \"$destination\"\n"
            "printf 'racer\\n' > \"$destination/sentinel\"\n"
            "exit 0\n",
        )
        self.env["REAL_MV"] = real_mv

        result = self.run_helper("example/project")
        fields = parse_protocol(result)
        destination = self.home / "code" / "tmp" / "project"
        self.assertEqual(2, result.returncode)
        self.assertEqual("BLOCKED", fields["STATUS"])
        self.assertEqual("DESTINATION_RACE", fields["ERROR"])
        self.assertEqual("racer\n", (destination / "sentinel").read_text(encoding="utf-8"))
        self.assertTrue(self.gh_log.exists())
        self.assertEqual([], list(destination.parent.glob(".peek-repo-*")))

    def test_disables_prompts_and_sanitizes_clone_failure(self) -> None:
        secret = "raw-gh-diagnostic-must-not-escape"
        write_executable(
            self.bin / "gh",
            "#!/bin/sh\n"
            "printf 'GH_PROMPT_DISABLED=%s\\nGIT_TERMINAL_PROMPT=%s\\nGCM_INTERACTIVE=%s\\n' "
            '"$GH_PROMPT_DISABLED" "$GIT_TERMINAL_PROMPT" "$GCM_INTERACTIVE" > "$GH_ENV_LOG"\n'
            f"printf '{secret}\\n'\n"
            f"printf '{secret}\\n' >&2\n"
            "exit 23\n",
        )
        result = self.run_helper("example/project")
        fields = parse_protocol(result)

        self.assertEqual(5, result.returncode)
        self.assertEqual("ERROR", fields["STATUS"])
        self.assertEqual("5", fields["EXIT_CODE"])
        self.assertEqual("CLONE_FAILED", fields["ERROR"])
        self.assertEqual("128", fields["COMMAND_EXIT"])  # sanitized HTTPS fallback failure
        self.assertNotIn(secret, result.stdout + result.stderr)
        env_values = self.env_log.read_text(encoding="utf-8")
        self.assertIn("GH_PROMPT_DISABLED=1", env_values)
        self.assertIn("GIT_TERMINAL_PROMPT=0", env_values)
        self.assertIn("GCM_INTERACTIVE=Never", env_values)

    def test_existing_clone_reports_freshness_without_network_claim(self) -> None:
        destination = self.home / "code" / "tmp" / "Project"
        destination.mkdir(parents=True)
        subprocess.run(["git", "-C", str(destination), "init"], check=True, capture_output=True)
        subprocess.run(
            ["git", "-C", str(destination), "remote", "add", "origin", "https://github.com/example/project.git"],
            check=True,
            capture_output=True,
        )

        result = self.run_helper("Example/Project")
        fields = parse_protocol(result)
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("EXISTS", fields["STATUS"])
        self.assertEqual("NONE", fields["ACTION"])
        self.assertEqual("NOT_CHECKED", fields["FRESHNESS"])
        self.assertEqual("false", fields["SHALLOW"])
        self.assertEqual("PASSED", fields["ORIGIN_CHECK"])
        self.assertFalse(self.gh_log.exists())

    def install_unshallow_git(self, after_origin: str = "https://github.com/example/project.git") -> None:
        destination = self.home / "code" / "tmp" / "project"
        destination.mkdir(parents=True)
        (destination / ".git").mkdir()
        self.env.update(
            {
                "FAKE_GIT_TOP": str(destination),
                "FAKE_GIT_STATE": str(self.base / "unshallowed"),
                "FAKE_GIT_COUNT": str(self.base / "origin-count"),
                "FAKE_GIT_LOG": str(self.base / "git-fetch"),
                "FAKE_AFTER_ORIGIN": after_origin,
            }
        )
        write_executable(
            self.bin / "git",
            "#!/bin/sh\n"
            "args=\" $* \"\n"
            "case \"$args\" in\n"
            "  *' rev-parse --show-toplevel '*) printf '%s\\n' \"$FAKE_GIT_TOP\";;\n"
            "  *' remote get-url origin '*)\n"
            "    count=0; [ -f \"$FAKE_GIT_COUNT\" ] && count=$(sed -n '1p' \"$FAKE_GIT_COUNT\")\n"
            "    count=$((count + 1)); printf '%s\\n' \"$count\" > \"$FAKE_GIT_COUNT\"\n"
            "    if [ \"$count\" -eq 1 ]; then printf '%s\\n' 'https://github.com/example/project.git'; "
            "else printf '%s\\n' \"$FAKE_AFTER_ORIGIN\"; fi;;\n"
            "  *' rev-parse --is-shallow-repository '*)\n"
            "    if [ -f \"$FAKE_GIT_STATE\" ]; then printf 'false\\n'; else printf 'true\\n'; fi;;\n"
            "  *' fetch --unshallow '*)\n"
            "    printf '%s\\n' \"$*\" > \"$FAKE_GIT_LOG\"\n"
            "    printf 'GIT_TERMINAL_PROMPT=%s\\nGCM_INTERACTIVE=%s\\n' "
            '"$GIT_TERMINAL_PROMPT" "$GCM_INTERACTIVE" >> "$FAKE_GIT_LOG"\n'
            "    : > \"$FAKE_GIT_STATE\";;\n"
            "  *) exit 91;;\n"
            "esac\n",
        )

    def test_full_existing_clone_checks_origin_before_and_after_unshallow(self) -> None:
        self.install_unshallow_git()
        result = self.run_helper("example/project", "--full")
        fields = parse_protocol(result)

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("EXISTS", fields["STATUS"])
        self.assertEqual("UNSHALLOWED", fields["ACTION"])
        self.assertEqual("false", fields["SHALLOW"])
        self.assertEqual("WORKTREE_NOT_UPDATED", fields["FRESHNESS"])
        self.assertEqual("2\n", (self.base / "origin-count").read_text(encoding="utf-8"))
        fetch_log = (self.base / "git-fetch").read_text(encoding="utf-8")
        self.assertIn("fetch --unshallow origin +refs/heads/*:refs/remotes/origin/* --tags", fetch_log)
        self.assertIn("GIT_TERMINAL_PROMPT=0", fetch_log)

    def test_full_existing_clone_blocks_origin_change_after_unshallow(self) -> None:
        self.install_unshallow_git("https://github.com/other/project.git")
        result = self.run_helper("example/project", "--full")
        fields = parse_protocol(result)

        self.assertEqual(2, result.returncode)
        self.assertEqual("BLOCKED", fields["STATUS"])
        self.assertEqual("ORIGIN_MISMATCH", fields["ERROR"])
        self.assertNotIn("ACTION", fields)
        self.assertEqual("2\n", (self.base / "origin-count").read_text(encoding="utf-8"))


class HelperProtocolParityTests(unittest.TestCase):
    def test_helpers_share_protocol_safety_and_freshness_vocabulary(self) -> None:
        posix = POSIX_HELPER.read_text(encoding="utf-8")
        powershell = POWERSHELL_HELPER.read_text(encoding="utf-8")
        for token in (
            "GH_PROMPT_DISABLED",
            "GIT_TERMINAL_PROMPT",
            "GCM_INTERACTIVE",
            "DESTINATION_OCCUPIED",
            "DESTINATION_LINK",
            "DESTINATION_RACE",
            "ORIGIN_MISMATCH",
            "UNSHALLOW_FAILED",
            "CLONE_FAILED",
            "ACTION",
            "SHALLOW",
            "FRESHNESS",
            "CLONE_TIME",
            "NOT_CHECKED",
            "WORKTREE_NOT_UPDATED",
            "ORIGIN_CHECK",
            "CLONE_BACKEND",
            ".peek-repo-",
        ):
            with self.subTest(token=token):
                self.assertIn(token, posix)
                self.assertIn(token, powershell)

        for code in range(2, 8):
            with self.subTest(exit_code=code):
                self.assertRegex(posix, rf"(?:error_result|emit_common) {code}\b|\"{code}\"")
                self.assertIn(f"-Code {code}", powershell)


@unittest.skipIf(POWERSHELL is None, "PowerShell is not installed")
class PowerShellCloneProtocolTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.home = self.base / "home"
        self.bin = self.base / "bin"
        self.home.mkdir()
        self.bin.mkdir()
        self.log = self.base / "gh-args"
        self.env = os.environ.copy()
        self.env.update(
            {
                "HOME": str(self.home),
                "USERPROFILE": str(self.home),
                "GH_LOG": str(self.log),
                "PATH": str(self.bin) + os.pathsep + os.environ.get("PATH", ""),
            }
        )
        if os.name == "nt":
            (self.bin / "gh.cmd").write_text(
                '@echo off\n>"%GH_LOG%" (echo %1& echo %2& echo %3& echo %4& echo %5& echo %6& echo %7& echo %8)\n'
                'git -C "%4%" init -q\n'
                'git -C "%4%" remote add origin "%3%"\n'
                'if "%6"=="--depth" >"%4%\\.git\\shallow" echo 0000000000000000000000000000000000000000\n',
                encoding="utf-8",
            )
        else:
            write_executable(
                self.bin / "gh",
                "#!/bin/sh\n"
                "printf '%s\\n' \"$@\" > \"$GH_LOG\"\n"
                "git -C \"$4\" init -q\n"
                "git -C \"$4\" remote add origin \"$3\"\n"
                "case \" $* \" in *' --depth 1 '*) printf '%040d\\n' 0 > \"$4/.git/shallow\";; esac\n",
            )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def run_helper(self, repo: str, *extra: str) -> subprocess.CompletedProcess[str]:
        assert POWERSHELL
        command = [POWERSHELL, "-NoProfile"]
        if os.name == "nt":
            command += ["-ExecutionPolicy", "Bypass"]
        command += ["-File", str(POWERSHELL_HELPER), "-Repo", repo, *extra]
        return subprocess.run(command, env=self.env, text=True, capture_output=True, check=False)

    def test_clone_matches_posix_protocol_casing(self) -> None:
        result = self.run_helper("example/project")
        fields = parse_protocol(result)
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertEqual("CLONED", fields["STATUS"])
        self.assertEqual("0", fields["EXIT_CODE"])
        self.assertEqual("CLONED", fields["ACTION"])
        self.assertEqual("true", fields["SHALLOW"])
        self.assertEqual("CLONE_TIME", fields["FRESHNESS"])
        self.assertEqual("PASSED", fields["ORIGIN_CHECK"])
        self.assertEqual("gh", fields["CLONE_BACKEND"])

    def test_file_and_empty_directory_are_blocked(self) -> None:
        root = self.home / "code" / "tmp"
        root.mkdir(parents=True)
        (root / "empty").mkdir()
        (root / "file").write_text("occupied", encoding="utf-8")
        for name in ("empty", "file"):
            with self.subTest(name=name):
                result = self.run_helper(f"example/{name}")
                fields = parse_protocol(result)
                self.assertEqual(2, result.returncode)
                self.assertEqual("BLOCKED", fields["STATUS"])
                self.assertEqual("DESTINATION_OCCUPIED", fields["ERROR"])


if __name__ == "__main__":
    unittest.main()
