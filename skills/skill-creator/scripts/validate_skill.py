#!/usr/bin/env python3
"""Validate an Agent Skill directory.

Checks the portable Agent Skills rules plus a few practical quality warnings.
Uses only the Python standard library so it can run in most agent environments.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

VALID_NAME = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONTMATTER_KEY = re.compile(r"^([A-Za-z0-9_-]+):(?:\s*(.*))?$")
KNOWN_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
    # Claude Code extensions (https://code.claude.com/docs/en/skills)
    "when_to_use",
    "argument-hint",
    "arguments",
    "disable-model-invocation",
    "user-invocable",
    "disallowed-tools",
    "model",
    "effort",
    "context",
    "agent",
    "background",
    "hooks",
    "paths",
    "shell",
}
REFERENCE_RE = re.compile(
    r"\[[^\]]*\]\((?P<link>(?:references|scripts|assets)/[^)#\s]+)(?:#[^)]+)?\)"
    r"|`(?P<tick>(?:references|scripts|assets)/[^`\s]+)`"
)


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        return value[1:-1]
    return value


def split_frontmatter(text: str) -> tuple[str | None, str, list[str]]:
    errors: list[str] = []
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text, ["SKILL.md must start with YAML frontmatter delimited by ---"]

    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            frontmatter = "\n".join(lines[1:index])
            body = "\n".join(lines[index + 1 :])
            return frontmatter, body, errors

    return None, text, ["YAML frontmatter is missing the closing --- delimiter"]


def parse_frontmatter(frontmatter: str) -> tuple[dict[str, Any], list[str]]:
    """Parse the small subset of YAML normally used by SKILL.md files.

    This is intentionally conservative. It extracts top-level scalar values and
    block strings well enough for validation without depending on PyYAML.
    """

    fields: dict[str, Any] = {}
    errors: list[str] = []
    lines = frontmatter.splitlines()
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()
        if not line.strip() or line.lstrip().startswith("#"):
            i += 1
            continue
        if raw[:1].isspace():
            errors.append(f"Unexpected indented top-level frontmatter line {i + 1}: {raw!r}")
            i += 1
            continue

        match = FRONTMATTER_KEY.match(line)
        if not match:
            errors.append(f"Cannot parse frontmatter line {i + 1}: {raw!r}")
            i += 1
            continue

        key, value = match.group(1), (match.group(2) or "").strip()
        if key in fields:
            errors.append(f"Duplicate frontmatter field: {key}")

        if value in {">", "|", ">-", "|-", ">+", "|+"}:
            block_lines: list[str] = []
            i += 1
            while i < len(lines) and (not lines[i].strip() or lines[i][:1].isspace()):
                block_lines.append(lines[i])
                i += 1
            stripped = [entry[2:] if entry.startswith("  ") else entry.lstrip() for entry in block_lines]
            if value.startswith(">"):
                fields[key] = " ".join(part.strip() for part in stripped if part.strip())
            else:
                fields[key] = "\n".join(stripped).strip("\n")
            continue

        if value == "":
            # Nested map/list or intentionally blank. Store a sentinel so callers
            # can still detect that the field exists.
            fields[key] = ""
        else:
            fields[key] = strip_quotes(value)
        i += 1

    return fields, errors


def add_issue(issues: list[dict[str, str]], message: str, path: str | None = None) -> None:
    issue = {"message": message}
    if path:
        issue["path"] = path
    issues.append(issue)


def validate_skill(path: Path, allow_name_mismatch: bool = False) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    path = path.expanduser().resolve()
    skill_dir = path.parent if path.name == "SKILL.md" else path
    skill_file = skill_dir / "SKILL.md"

    if not skill_dir.exists():
        add_issue(errors, f"Skill path does not exist: {skill_dir}")
        return result(path, skill_dir, None, errors, warnings, {})
    if not skill_dir.is_dir():
        add_issue(errors, f"Skill path is not a directory: {skill_dir}")
        return result(path, skill_dir, None, errors, warnings, {})
    if not skill_file.exists():
        add_issue(errors, "Skill directory must contain SKILL.md", str(skill_file))
        return result(path, skill_dir, None, errors, warnings, {})

    text = skill_file.read_text(encoding="utf-8")
    frontmatter, body, fm_errors = split_frontmatter(text)
    for message in fm_errors:
        add_issue(errors, message, str(skill_file))

    fields: dict[str, Any] = {}
    if frontmatter is not None:
        fields, parse_errors = parse_frontmatter(frontmatter)
        for message in parse_errors:
            add_issue(errors, message, str(skill_file))

    name = str(fields.get("name", "")).strip()
    description = str(fields.get("description", "")).strip()

    if not name:
        add_issue(errors, "Missing required frontmatter field: name", str(skill_file))
    else:
        if len(name) > 64:
            add_issue(errors, "name must be at most 64 characters", str(skill_file))
        if not VALID_NAME.fullmatch(name):
            add_issue(
                errors,
                "name must use lowercase letters, numbers, and single hyphens only; no leading/trailing hyphen",
                str(skill_file),
            )
        if not allow_name_mismatch and name != skill_dir.name:
            add_issue(
                errors,
                f"name must match parent directory for cross-client compatibility: name={name!r}, directory={skill_dir.name!r}",
                str(skill_file),
            )

    if not description:
        add_issue(errors, "Missing required frontmatter field: description", str(skill_file))
    elif len(description) > 1024:
        add_issue(errors, f"description must be at most 1024 characters; got {len(description)}", str(skill_file))

    compatibility = str(fields.get("compatibility", "")).strip()
    if "compatibility" in fields and not compatibility:
        add_issue(errors, "compatibility must be non-empty if provided", str(skill_file))
    elif len(compatibility) > 500:
        add_issue(errors, f"compatibility must be at most 500 characters; got {len(compatibility)}", str(skill_file))

    for key in sorted(set(fields) - KNOWN_FIELDS):
        add_issue(warnings, f"Unknown frontmatter field {key!r}; clients may ignore it", str(skill_file))

    if not body.strip():
        add_issue(warnings, "SKILL.md body is empty; add task instructions after frontmatter", str(skill_file))

    line_count = len(text.splitlines())
    estimated_tokens = len(text) // 4
    if line_count > 500:
        add_issue(warnings, f"SKILL.md is {line_count} lines; recommended maximum is 500", str(skill_file))
    if estimated_tokens > 5000:
        add_issue(warnings, f"SKILL.md is roughly {estimated_tokens} tokens; recommended maximum is about 5000", str(skill_file))

    referenced_paths = sorted(
        {
            (match.group("link") or match.group("tick")).rstrip(".,;:")
            for match in REFERENCE_RE.finditer(text)
        }
    )
    for ref in referenced_paths:
        target = skill_dir / ref
        if not target.exists():
            add_issue(errors, f"Referenced support file does not exist: {ref}", str(skill_file))

    scripts_dir = skill_dir / "scripts"
    script_count = 0
    if scripts_dir.exists():
        for script in scripts_dir.rglob("*"):
            if not script.is_file():
                continue
            script_count += 1
            try:
                start = script.read_bytes()[:2]
            except OSError:
                continue
            if start == b"#!" and not os.access(script, os.X_OK):
                add_issue(warnings, f"Script has a shebang but is not executable: {script.relative_to(skill_dir)}", str(script))

    summary = {
        "name": name or None,
        "description_chars": len(description),
        "skill_md_lines": line_count,
        "estimated_tokens": estimated_tokens,
        "referenced_support_files": len(referenced_paths),
        "scripts": script_count,
    }
    return result(path, skill_dir, skill_file, errors, warnings, summary)


def result(
    input_path: Path,
    skill_dir: Path,
    skill_file: Path | None,
    errors: list[dict[str, str]],
    warnings: list[dict[str, str]],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "ok": not errors,
        "input_path": str(input_path),
        "skill_dir": str(skill_dir),
        "skill_file": str(skill_file) if skill_file else None,
        "summary": summary,
        "errors": errors,
        "warnings": warnings,
    }


def print_text(report: dict[str, Any]) -> None:
    status = "OK" if report["ok"] else "FAILED"
    print(f"{status}: {report['skill_dir']}")
    if report.get("summary"):
        for key, value in report["summary"].items():
            print(f"  {key}: {value}")
    for label in ("errors", "warnings"):
        items = report[label]
        if not items:
            continue
        print(f"\n{label.upper()}:")
        for item in items:
            location = f" ({item['path']})" if "path" in item else ""
            print(f"- {item['message']}{location}")


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Validate an Agent Skill directory.",
        epilog=(
            "Examples:\n"
            "  scripts/validate_skill.py ~/.agents/skills/my-skill --format text\n"
            "  scripts/validate_skill.py .agents/skills/my-skill --allow-name-mismatch"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("path", help="Skill directory or SKILL.md file to validate")
    parser.add_argument("--allow-name-mismatch", action="store_true", help="Do not require name to match the parent directory")
    parser.add_argument("--format", choices=("json", "text"), default="json", help="Output format (default: json)")
    args = parser.parse_args(argv)

    report = validate_skill(Path(args.path), allow_name_mismatch=args.allow_name_mismatch)
    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_text(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
