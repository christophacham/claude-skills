"""Targeted coverage for skills/defectdojo-fix/scripts/resolve-env.sh.

The script is sourced (not executed), so we drive it by exporting vars,
sourcing it in a subshell, and asserting on the resulting DD_TOKEN / DD_BASE.
Each test uses a fresh tmp HOME so the candidate files we place are the only
ones the resolver sees.
"""

from __future__ import annotations

import os
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / "skills" / "defectdojo-fix" / "scripts" / "resolve-env.sh"


def _run_resolve(home: Path, env_overrides: dict[str, str], creds_file: Path | None) -> tuple[int, str, str]:
    """Source resolve-env.sh in a subshell and return (rc, stdout, stderr)."""
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "HOME": str(home),
        # Be explicit: do not let the harness's own env leak in.
        "DEFECTDOJO_API_TOKEN": "",
        "API_TOKEN": "",
        "DEFECTDOJO_URL": "",
        "DEFECTDOJO_HOST": "",
        "DEFECTDOJO_PORT": "",
        "DEFECTDOJO_SCHEME": "",
        "DD_URL": "",
        "DD_HOST": "",
        "DD_PORT": "",
        "DD_SCHEME": "",
        **env_overrides,
    }
    # Stub /root/.defectdojo-credentials so the script does not see the real
    # one if the test happens to run as root. We point HOME elsewhere, so the
    # script's `${HOME}/.defectdojo-credentials` already points inside `home`
    # — the /root fallback is only reached if HOME is unset, which we ensure.
    script = """
        set -e
        source {script}
        dd_resolve_credentials
        echo "TOKEN=[$DD_TOKEN]"
        echo "BASE=[$DD_BASE]"
        """.format(script=str(SCRIPT))
    p = subprocess.run(
        ["bash", "-c", script],
        env=env,
        capture_output=True,
        text=True,
    )
    return p.returncode, p.stdout, p.stderr


def _extract(stdout: str, key: str) -> str:
    for line in stdout.splitlines():
        if line.startswith(f"{key}=["):
            return line[len(f"{key}=[") : -1]
    raise AssertionError(f"{key} not found in stdout: {stdout!r}")


class ResolveEnvTests(unittest.TestCase):
    def test_strips_double_quotes_and_whitespace(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_text(
                'DEFECTDOJO_API_TOKEN=  "abc123def"\n'
                "DEFECTDOJO_URL=http://127.0.0.1:8080\n",
                encoding="utf-8",
            )
            rc, out, err = _run_resolve(Path(home), {}, creds)
            self.assertEqual(rc, 0, msg=err)
            self.assertEqual(_extract(out, "TOKEN"), "abc123def")
            self.assertEqual(_extract(out, "BASE"), "http://127.0.0.1:8080")

    def test_strips_single_quotes(self) -> None:
        # The original code only stripped ", so a token wrapped in ' would
        # leak through and 401. This guards that regression.
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_text(
                "DEFECTDOJO_API_TOKEN='single-quoted'\n"
                "DEFECTDOJO_URL=http://127.0.0.1:8080\n",
                encoding="utf-8",
            )
            rc, out, err = _run_resolve(Path(home), {}, creds)
            self.assertEqual(rc, 0, msg=err)
            self.assertEqual(_extract(out, "TOKEN"), "single-quoted")

    def test_handles_crlf_line_endings(self) -> None:
        # A credentials file saved on Windows can carry \r. The trim must
        # strip the CR before the token is exported.
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_bytes(
                b"DEFECTDOJO_API_TOKEN=crlf-token\r\n"
                b"DEFECTDOJO_URL=http://127.0.0.1:8080\r\n",
            )
            rc, out, err = _run_resolve(Path(home), {}, creds)
            self.assertEqual(rc, 0, msg=err)
            self.assertEqual(_extract(out, "TOKEN"), "crlf-token")

    def test_warns_on_world_readable_creds(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_text(
                "DEFECTDOJO_API_TOKEN=ok\n"
                "DEFECTDOJO_URL=http://127.0.0.1:8080\n",
                encoding="utf-8",
            )
            os.chmod(creds, 0o644)
            rc, out, err = _run_resolve(Path(home), {}, creds)
            self.assertEqual(rc, 0, msg=err)
            self.assertIn("warning", err.lower())
            self.assertIn("chmod 600", err)

    def test_no_warn_on_owner_only_creds(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_text(
                "DEFECTDOJO_API_TOKEN=ok\n"
                "DEFECTDOJO_URL=http://127.0.0.1:8080\n",
                encoding="utf-8",
            )
            os.chmod(creds, 0o600)
            rc, out, err = _run_resolve(Path(home), {}, creds)
            self.assertEqual(rc, 0, msg=err)
            self.assertNotIn("chmod 600", err)

    def test_env_takes_precedence_over_creds_file(self) -> None:
        with tempfile.TemporaryDirectory() as home:
            creds = Path(home) / ".defectdojo-credentials"
            creds.write_text(
                "DEFECTDOJO_API_TOKEN=from-file\n"
                "DEFECTDOJO_URL=http://from.file:8080\n",
                encoding="utf-8",
            )
            os.chmod(creds, 0o600)
            rc, out, err = _run_resolve(
                Path(home),
                {
                    "DEFECTDOJO_API_TOKEN": "from-env",
                    "DEFECTDOJO_URL": "http://from.env:9000",
                },
                creds,
            )
            self.assertEqual(rc, 0, msg=err)
            self.assertEqual(_extract(out, "TOKEN"), "from-env")
            self.assertEqual(_extract(out, "BASE"), "http://from.env:9000")


if __name__ == "__main__":
    unittest.main()
