#!/usr/bin/env python3
"""Validate an Agent Skill directory with the Python standard library only.

Two explicit profiles are supported:

* ``portable`` validates the Agent Skills upload/package surface.
* ``claude-code`` validates that surface plus Claude Code frontmatter and
  load-time shell injection.

The YAML reader intentionally accepts a conservative data-only subset. It does
not execute tags, aliases, merge keys, or other YAML object construction.
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
MAP_KEY = re.compile(r"^[A-Za-z0-9_.-]+$")
ARGUMENT_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")
PORTABLE_FIELDS = {
    "name",
    "description",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}
CLAUDE_CODE_FIELDS = PORTABLE_FIELDS | {
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
UNSAFE_YAML_TOKEN = re.compile(r"(^|[\s\[{,])(?:&[A-Za-z0-9_-]+|\*[A-Za-z0-9_-]+|![^\s]+)")
MUTATING_COMMAND = re.compile(
    r"(?:^|[;&|]\s*|\n\s*)"
    r"(?:rm|rmdir|mv|cp|mkdir|touch|truncate|tee|chmod|chown|install)\b"
    r"|\bgit\s+(?:add|commit|push|pull|checkout|switch|reset|clean|rebase|merge|tag|stash)\b"
    r"|\bbd\s+(?:update|close|create|dep\s+add)\b"
    r"|\bgh\s+(?:pr\s+(?:merge|close)|issue\s+(?:close|create))\b"
    r"|\b(?:npm|pnpm|yarn|pip|uv)\s+(?:install|add|remove|uninstall)\b"
    r"|\b(?:Set|Add|Clear|Remove)-Content\b|\bOut-File\b"
    r"|\b(?:New|Remove|Move|Copy|Rename)-Item\b|\b(?:ni|ri|rm|mi|mv|cp)\b",
    re.IGNORECASE,
)
NETWORK_COMMAND = re.compile(
    r"(?:^|[;&|]\s*|\n\s*)(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b"
    r"|\bgh\s+api\b|\btvly\s+(?:search|extract)\b",
    re.IGNORECASE,
)
SECRET_NAME = r"(?:[A-Z][A-Z0-9_]*(?:_KEY|_TOKEN|_SECRET|_PASSWORD)|API_KEY|TOKEN|SECRET|PASSWORD)"
SECRET_OUTPUT = re.compile(
    rf"(?:echo|printf|Write-Output|Write-Host)[^\n]*(?:\$\{{?{SECRET_NAME}\}}?|\$env:{SECRET_NAME})"
    rf"|\bprintenv\s+(?:--\s+)?{SECRET_NAME}\b"
    rf"|\b(?:Get-Item|Get-Content|Get-ChildItem|gi|gc|gci)\s+(?:Env:|env\\:){SECRET_NAME}\b"
    r"|(?:^|[;&|]\s*|\n\s*)env(?:\.exe)?(?:\s|$)",
    re.IGNORECASE,
)


class YamlSubsetError(ValueError):
    """A frontmatter construct is outside the validator's safe YAML subset."""


class FlowParser:
    def __init__(self, text: str, line: int, errors: list[str]) -> None:
        self.text = text
        self.line = line
        self.errors = errors
        self.pos = 0

    def parse(self) -> Any:
        value = self._value()
        self._space()
        if self.pos != len(self.text):
            raise YamlSubsetError(
                f"Cannot parse flow value on frontmatter line {self.line}: "
                f"unexpected {self.text[self.pos:]!r}"
            )
        return value

    def _space(self) -> None:
        while self.pos < len(self.text) and self.text[self.pos].isspace():
            self.pos += 1

    def _value(self) -> Any:
        self._space()
        if self.pos >= len(self.text):
            raise YamlSubsetError(f"Missing value on frontmatter line {self.line}")
        char = self.text[self.pos]
        if char == "[":
            return self._sequence()
        if char == "{":
            return self._mapping()
        if char in {'"', "'"}:
            return self._quoted()
        start = self.pos
        while self.pos < len(self.text) and self.text[self.pos] not in ",]}":
            self.pos += 1
        return parse_scalar(self.text[start:self.pos].strip(), self.line)

    def _quoted(self) -> str:
        quote = self.text[self.pos]
        start = self.pos
        self.pos += 1
        if quote == '"':
            escaped = False
            while self.pos < len(self.text):
                char = self.text[self.pos]
                self.pos += 1
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    token = self.text[start:self.pos]
                    try:
                        value = json.loads(token)
                    except json.JSONDecodeError as error:
                        raise YamlSubsetError(
                            f"Invalid double-quoted string on frontmatter line {self.line}: {error.msg}"
                        ) from error
                    if not isinstance(value, str):
                        raise YamlSubsetError(f"Expected string on frontmatter line {self.line}")
                    return value
            raise YamlSubsetError(f"Unterminated quoted string on frontmatter line {self.line}")

        chunks: list[str] = []
        while self.pos < len(self.text):
            char = self.text[self.pos]
            self.pos += 1
            if char != "'":
                chunks.append(char)
                continue
            if self.pos < len(self.text) and self.text[self.pos] == "'":
                chunks.append("'")
                self.pos += 1
                continue
            return "".join(chunks)
        raise YamlSubsetError(f"Unterminated quoted string on frontmatter line {self.line}")

    def _sequence(self) -> list[Any]:
        self.pos += 1
        result: list[Any] = []
        self._space()
        if self.pos < len(self.text) and self.text[self.pos] == "]":
            self.pos += 1
            return result
        while True:
            result.append(self._value())
            self._space()
            if self.pos >= len(self.text):
                raise YamlSubsetError(f"Unterminated flow sequence on frontmatter line {self.line}")
            char = self.text[self.pos]
            self.pos += 1
            if char == "]":
                return result
            if char != ",":
                raise YamlSubsetError(
                    f"Expected ',' or ']' in flow sequence on frontmatter line {self.line}"
                )

    def _mapping(self) -> dict[str, Any]:
        self.pos += 1
        result: dict[str, Any] = {}
        self._space()
        if self.pos < len(self.text) and self.text[self.pos] == "}":
            self.pos += 1
            return result
        while True:
            self._space()
            if self.pos >= len(self.text):
                raise YamlSubsetError(f"Unterminated flow mapping on frontmatter line {self.line}")
            if self.text[self.pos] in {'"', "'"}:
                key = self._quoted()
            else:
                start = self.pos
                while self.pos < len(self.text) and self.text[self.pos] not in ":,}":
                    self.pos += 1
                key = self.text[start:self.pos].strip()
            if not key or key == "<<" or not MAP_KEY.fullmatch(key):
                raise YamlSubsetError(
                    f"Unsupported mapping key {key!r} on frontmatter line {self.line}"
                )
            self._space()
            if self.pos >= len(self.text) or self.text[self.pos] != ":":
                raise YamlSubsetError(
                    f"Expected ':' after mapping key on frontmatter line {self.line}"
                )
            self.pos += 1
            value = self._value()
            if key in result:
                self.errors.append(f"Duplicate mapping key {key!r} on frontmatter line {self.line}")
            else:
                result[key] = value
            self._space()
            if self.pos >= len(self.text):
                raise YamlSubsetError(f"Unterminated flow mapping on frontmatter line {self.line}")
            char = self.text[self.pos]
            self.pos += 1
            if char == "}":
                return result
            if char != ",":
                raise YamlSubsetError(
                    f"Expected ',' or '}}' in flow mapping on frontmatter line {self.line}"
                )


def strip_plain_comment(value: str) -> str:
    for index, char in enumerate(value):
        if char == "#" and (index == 0 or value[index - 1].isspace()):
            return value[:index].rstrip()
    return value.rstrip()


def parse_scalar(value: str, line: int) -> Any:
    value = value.strip()
    if not value:
        return None
    if value[0] in {'"', "'"}:
        return FlowParser(value, line, []).parse()
    value = strip_plain_comment(value)
    if not value:
        return None
    if value.startswith(("[", "{")):
        errors: list[str] = []
        parsed = FlowParser(value, line, errors).parse()
        if errors:
            raise YamlSubsetError("; ".join(errors))
        return parsed
    if value == "<<" or value.startswith("%") or UNSAFE_YAML_TOKEN.search(value):
        raise YamlSubsetError(
            f"Unsupported YAML anchor, alias, tag, merge, or directive on frontmatter line {line}"
        )
    lower = value.lower()
    if lower in {"true", "yes", "on"}:
        return True
    if lower in {"false", "no", "off"}:
        return False
    if lower in {"null", "~"}:
        return None
    if re.fullmatch(r"[-+]?(?:0|[1-9][0-9]*)", value):
        return int(value)
    if re.fullmatch(r"[-+]?(?:[0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(?:[eE][-+]?[0-9]+)?", value):
        return float(value)
    if ": " in value:
        raise YamlSubsetError(
            f"Plain scalar containing ': ' is unsupported on frontmatter line {line}; quote it"
        )
    return value


def split_mapping(content: str, line: int) -> tuple[str, str]:
    if content.startswith("<<:"):
        raise YamlSubsetError(f"YAML merge keys are unsupported on frontmatter line {line}")
    match = re.match(r"^([A-Za-z0-9_.-]+):(?:\s*(.*))?$", content)
    if not match:
        raise YamlSubsetError(f"Cannot parse mapping on frontmatter line {line}: {content!r}")
    return match.group(1), (match.group(2) or "")


class BlockParser:
    def __init__(self, text: str) -> None:
        self.rows = text.splitlines()
        self.errors: list[str] = []

    @staticmethod
    def _indent(raw: str) -> int:
        return len(raw) - len(raw.lstrip(" "))

    def _next_content(self, index: int) -> int | None:
        while index < len(self.rows):
            stripped = self.rows[index].strip()
            if stripped and not stripped.startswith("#"):
                return index
            index += 1
        return None

    def parse(self) -> tuple[dict[str, Any], list[str]]:
        if any("\t" in row[: len(row) - len(row.lstrip())] for row in self.rows):
            self.errors.append("Tabs are unsupported for YAML indentation")
        index = self._next_content(0)
        if index is None:
            return {}, self.errors
        if self._indent(self.rows[index]) != 0:
            self.errors.append("Frontmatter top-level fields must not be indented")
            return {}, self.errors
        value, _ = self._node(index, 0)
        if not isinstance(value, dict):
            self.errors.append("Frontmatter root must be a mapping")
            return {}, self.errors
        return value, self.errors

    def _node(self, index: int, indent: int) -> tuple[Any, int]:
        raw = self.rows[index]
        content = raw[indent:]
        if content == "-" or content.startswith("- "):
            return self._sequence(index, indent)
        return self._mapping(index, indent)

    def _mapping(self, index: int, indent: int) -> tuple[dict[str, Any], int]:
        result: dict[str, Any] = {}
        while index < len(self.rows):
            raw = self.rows[index]
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                index += 1
                continue
            current_indent = self._indent(raw)
            if current_indent < indent:
                break
            if current_indent > indent:
                self.errors.append(
                    f"Unexpected indentation on frontmatter line {index + 1}: {raw!r}"
                )
                index += 1
                continue
            content = raw[indent:]
            if content == "-" or content.startswith("- "):
                break
            try:
                key, tail = split_mapping(content, index + 1)
            except YamlSubsetError as error:
                self.errors.append(str(error))
                index += 1
                continue
            if key in result:
                self.errors.append(f"Duplicate frontmatter field or mapping key: {key}")
            if tail in {">", "|", ">-", "|-", ">+", "|+"}:
                value, index = self._block_scalar(index + 1, indent, tail)
            elif tail:
                try:
                    value = parse_scalar(tail, index + 1)
                except YamlSubsetError as error:
                    self.errors.append(str(error))
                    value = None
                index += 1
            else:
                child = self._next_content(index + 1)
                if child is not None and self._indent(self.rows[child]) > indent:
                    value, index = self._node(child, self._indent(self.rows[child]))
                else:
                    value = None
                    index += 1
            if key not in result:
                result[key] = value
        return result, index

    def _sequence(self, index: int, indent: int) -> tuple[list[Any], int]:
        result: list[Any] = []
        while index < len(self.rows):
            raw = self.rows[index]
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                index += 1
                continue
            current_indent = self._indent(raw)
            if current_indent < indent:
                break
            if current_indent != indent:
                self.errors.append(
                    f"Unexpected indentation on frontmatter line {index + 1}: {raw!r}"
                )
                index += 1
                continue
            content = raw[indent:]
            if not (content == "-" or content.startswith("- ")):
                break
            tail = content[1:].strip()
            if not tail:
                child = self._next_content(index + 1)
                if child is None or self._indent(self.rows[child]) <= indent:
                    result.append(None)
                    index += 1
                else:
                    value, index = self._node(child, self._indent(self.rows[child]))
                    result.append(value)
                continue
            if re.match(r"^[A-Za-z0-9_.-]+:", tail):
                item, index = self._sequence_mapping_item(index, indent, tail)
                result.append(item)
                continue
            try:
                result.append(parse_scalar(tail, index + 1))
            except YamlSubsetError as error:
                self.errors.append(str(error))
                result.append(None)
            index += 1
        return result, index

    def _sequence_mapping_item(
        self, index: int, sequence_indent: int, tail: str
    ) -> tuple[dict[str, Any], int]:
        item: dict[str, Any] = {}
        map_indent = sequence_indent + 2
        try:
            key, value_text = split_mapping(tail, index + 1)
        except YamlSubsetError as error:
            self.errors.append(str(error))
            return item, index + 1

        if value_text in {">", "|", ">-", "|-", ">+", "|+"}:
            value, cursor = self._block_scalar(index + 1, map_indent, value_text)
        elif value_text:
            try:
                value = parse_scalar(value_text, index + 1)
            except YamlSubsetError as error:
                self.errors.append(str(error))
                value = None
            cursor = index + 1
        else:
            child = self._next_content(index + 1)
            if child is not None and self._indent(self.rows[child]) > map_indent:
                value, cursor = self._node(child, self._indent(self.rows[child]))
            else:
                value = None
                cursor = index + 1
        item[key] = value

        continuation = self._next_content(cursor)
        if continuation is not None and self._indent(self.rows[continuation]) == map_indent:
            rest, cursor = self._mapping(continuation, map_indent)
            for rest_key, rest_value in rest.items():
                if rest_key in item:
                    self.errors.append(f"Duplicate mapping key: {rest_key}")
                else:
                    item[rest_key] = rest_value
        return item, cursor

    def _block_scalar(self, index: int, parent_indent: int, style: str) -> tuple[str, int]:
        collected: list[str] = []
        content_indents: list[int] = []
        cursor = index
        while cursor < len(self.rows):
            raw = self.rows[cursor]
            if raw.strip():
                indent = self._indent(raw)
                if indent <= parent_indent:
                    break
                content_indents.append(indent)
            collected.append(raw)
            cursor += 1
        if not content_indents:
            return "", cursor
        trim = min(content_indents)
        lines = [raw[trim:] if raw.strip() else "" for raw in collected]
        if style.startswith("|"):
            value = "\n".join(lines)
        else:
            paragraphs: list[str] = []
            current: list[str] = []
            for line in lines:
                if line:
                    current.append(line.strip())
                else:
                    if current:
                        paragraphs.append(" ".join(current))
                        current = []
                    paragraphs.append("")
            if current:
                paragraphs.append(" ".join(current))
            value = "\n".join(paragraphs)
        if style.endswith("-"):
            value = value.rstrip("\n")
        elif style.endswith("+"):
            value += "\n"
        return value, cursor


def split_frontmatter(text: str) -> tuple[str | None, str, list[str]]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text, ["SKILL.md must start with YAML frontmatter delimited by ---"]
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[1:index]), "\n".join(lines[index + 1 :]), []
    return None, text, ["YAML frontmatter is missing the closing --- delimiter"]


def parse_frontmatter(frontmatter: str) -> tuple[dict[str, Any], list[str]]:
    """Parse a typed, conservative, data-only YAML subset."""

    return BlockParser(frontmatter).parse()


def add_issue(issues: list[dict[str, str]], message: str, path: str | None = None) -> None:
    issue = {"message": message}
    if path:
        issue["path"] = path
    issues.append(issue)


def is_string(value: Any) -> bool:
    return isinstance(value, str)


def string_list(value: Any) -> list[str] | None:
    if isinstance(value, str):
        return [part for part in re.split(r"[\s,]+", value.strip()) if part]
    if isinstance(value, list) and all(isinstance(item, str) and item.strip() for item in value):
        return [item.strip() for item in value]
    return None


def duplicate_list_items(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    strings = [item.strip() for item in value if isinstance(item, str)]
    return sorted({item for item in strings if strings.count(item) > 1})


def validate_frontmatter_fields(
    fields: dict[str, Any],
    mode: str,
    skill_dir: Path,
    skill_file: Path,
    allow_name_mismatch: bool,
    errors: list[dict[str, str]],
    warnings: list[dict[str, str]],
) -> tuple[str, str]:
    allowed = PORTABLE_FIELDS if mode == "portable" else CLAUDE_CODE_FIELDS
    for key in sorted(set(fields) - allowed):
        add_issue(errors, f"Unsupported frontmatter field {key!r} in {mode} mode", str(skill_file))

    name_value = fields.get("name")
    description_value = fields.get("description")
    name = name_value.strip() if isinstance(name_value, str) else ""
    description = description_value.strip() if isinstance(description_value, str) else ""

    if mode == "portable":
        if not name:
            add_issue(errors, "Missing required frontmatter field: name", str(skill_file))
        if not description:
            add_issue(errors, "Missing required frontmatter field: description", str(skill_file))
    else:
        if name_value is None:
            add_issue(warnings, "name omitted; Claude Code uses the skill directory name", str(skill_file))
        elif not isinstance(name_value, str) or not name:
            add_issue(errors, "name must be a non-empty string if provided", str(skill_file))
        if description_value is None:
            add_issue(
                warnings,
                "description omitted; Claude Code falls back to the first body paragraph",
                str(skill_file),
            )
        elif not isinstance(description_value, str) or not description:
            add_issue(errors, "description must be a non-empty string if provided", str(skill_file))

    if name:
        if len(name) > 64:
            add_issue(errors, "name must be at most 64 characters", str(skill_file))
        if not VALID_NAME.fullmatch(name):
            add_issue(
                errors if mode == "portable" else warnings,
                "name is not portable: use lowercase letters, numbers, and single hyphens",
                str(skill_file),
            )
        if not allow_name_mismatch and name != skill_dir.name:
            add_issue(
                errors if mode == "portable" else warnings,
                f"name differs from directory: name={name!r}, directory={skill_dir.name!r}",
                str(skill_file),
            )

    if description:
        if mode == "portable" and len(description) > 1024:
            add_issue(
                errors,
                f"description must be at most 1024 characters; got {len(description)}",
                str(skill_file),
            )
        elif mode == "claude-code" and len(description) > 1536:
            add_issue(
                warnings,
                "description exceeds Claude Code's 1,536-character combined listing budget",
                str(skill_file),
            )

    for field in ("license", "compatibility"):
        if field in fields and (not is_string(fields[field]) or not fields[field].strip()):
            add_issue(errors, f"{field} must be a non-empty string if provided", str(skill_file))
    compatibility = fields.get("compatibility")
    if isinstance(compatibility, str) and len(compatibility) > 500:
        add_issue(
            errors,
            f"compatibility must be at most 500 characters; got {len(compatibility)}",
            str(skill_file),
        )
    if "metadata" in fields and not isinstance(fields["metadata"], dict):
        add_issue(errors, "metadata must be a YAML mapping", str(skill_file))
    elif isinstance(fields.get("metadata"), dict):
        metadata = fields["metadata"]
        reserved = sorted(set(metadata) & CLAUDE_CODE_FIELDS)
        if reserved:
            add_issue(
                errors,
                f"metadata must not reuse frontmatter field name(s): {', '.join(reserved)}",
                str(skill_file),
            )
        if mode == "portable" and any(
            not isinstance(key, str) or not isinstance(value, str)
            for key, value in metadata.items()
        ):
            add_issue(
                errors,
                "portable metadata keys and values must all be strings",
                str(skill_file),
            )

    when_to_use = fields.get("when_to_use")
    if mode == "claude-code" and isinstance(when_to_use, str):
        combined_length = len(description) + len(when_to_use)
        if combined_length > 1536:
            add_issue(
                warnings,
                f"description + when_to_use exceed Claude Code's 1,536-character listing cap; got {combined_length}",
                str(skill_file),
            )

    if "allowed-tools" in fields:
        parsed = string_list(fields["allowed-tools"])
        if parsed is None or not parsed:
            add_issue(errors, "allowed-tools must be a non-empty string or string list", str(skill_file))
        elif mode == "portable" and not isinstance(fields["allowed-tools"], str):
            add_issue(errors, "portable allowed-tools must be a string", str(skill_file))
        duplicates = duplicate_list_items(fields["allowed-tools"])
        if duplicates:
            add_issue(errors, f"Duplicate allowed-tools entry/entries: {', '.join(duplicates)}", str(skill_file))

    if mode == "claude-code":
        for field in ("when_to_use", "argument-hint", "model", "agent"):
            if field in fields and (not is_string(fields[field]) or not fields[field].strip()):
                add_issue(errors, f"{field} must be a non-empty string", str(skill_file))
        for field in ("disable-model-invocation", "user-invocable", "background"):
            if field in fields and not (
                isinstance(fields[field], bool)
                or isinstance(fields[field], int) and fields[field] in {0, 1}
            ):
                add_issue(errors, f"{field} must be a boolean (true/false, yes/no, on/off, or 1/0)", str(skill_file))
        for field in ("disallowed-tools", "paths"):
            if field in fields:
                parsed = string_list(fields[field])
                if parsed is None or not parsed:
                    add_issue(errors, f"{field} must be a non-empty string or string list", str(skill_file))
                duplicates = duplicate_list_items(fields[field])
                if duplicates:
                    add_issue(errors, f"Duplicate {field} entry/entries: {', '.join(duplicates)}", str(skill_file))
        arguments: list[str] = []
        if "arguments" in fields:
            parsed = string_list(fields["arguments"])
            if parsed is None or not parsed:
                add_issue(errors, "arguments must be a non-empty string or string list", str(skill_file))
            else:
                arguments = parsed
                invalid = [item for item in arguments if not ARGUMENT_NAME.fullmatch(item)]
                if invalid:
                    add_issue(errors, f"Invalid argument name(s): {', '.join(invalid)}", str(skill_file))
                duplicates = sorted({item for item in arguments if arguments.count(item) > 1})
                if duplicates:
                    add_issue(errors, f"Duplicate argument name(s): {', '.join(duplicates)}", str(skill_file))
        if fields.get("effort") not in {None, "low", "medium", "high", "xhigh", "max"}:
            add_issue(errors, "effort must be one of: low, medium, high, xhigh, max", str(skill_file))
        if fields.get("context") not in {None, "fork"}:
            add_issue(errors, "context currently supports only 'fork'", str(skill_file))
        if "agent" in fields and fields.get("context") != "fork":
            add_issue(errors, "agent requires context: fork", str(skill_file))
        if "background" in fields and fields.get("context") != "fork":
            add_issue(errors, "background requires context: fork", str(skill_file))
        if "hooks" in fields and not isinstance(fields["hooks"], dict):
            add_issue(errors, "hooks must be a YAML mapping", str(skill_file))
        if fields.get("shell") not in {None, "bash", "powershell"}:
            add_issue(errors, "shell must be 'bash' or 'powershell'", str(skill_file))

    return name, description


def find_injections(body: str) -> tuple[list[tuple[int, str, str]], list[str]]:
    """Return (line, command, kind) for active inline and fenced injections."""

    lines = body.splitlines()
    found: list[tuple[int, str, str]] = []
    errors: list[str] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        fence = re.match(r"^\s*(`{3,})!\s*$", line)
        if fence:
            marker = fence.group(1)
            start = index + 1
            command_lines: list[str] = []
            index += 1
            while index < len(lines):
                closing = re.match(r"^\s*(`{3,})\s*$", lines[index])
                if closing and len(closing.group(1)) >= len(marker):
                    break
                command_lines.append(lines[index])
                index += 1
            if index >= len(lines):
                errors.append(f"Unterminated injection fence at body line {start}")
                break
            found.append((start, "\n".join(command_lines), "fenced"))
            index += 1
            continue

        cursor = 0
        while True:
            match = re.search(r"(?<!\S)!`", line[cursor:])
            if not match:
                break
            begin = cursor + match.start()
            end = line.find("`", begin + 2)
            if end < 0:
                errors.append(f"Unterminated inline injection at body line {index + 1}")
                break
            found.append((index + 1, line[begin + 2 : end], "inline"))
            cursor = end + 1
        index += 1
    return found, errors


def injection_argument_tokens(arguments: list[str]) -> list[tuple[str, re.Pattern[str]]]:
    tokens = [
        ("$ARGUMENTS", re.compile(r"\$ARGUMENTS(?:\[[0-9]+\])?")),
        ("positional argument", re.compile(r"\$(?:[0-9]+|\{[0-9]+\})")),
    ]
    for name in arguments:
        tokens.append((f"named argument ${name}", re.compile(rf"\$(?:{re.escape(name)}\b|\{{{re.escape(name)}\}})")))
    return tokens


def has_unescaped_match(text: str, pattern: re.Pattern[str]) -> bool:
    """Return true when a token is preceded by an even number of backslashes."""

    for match in pattern.finditer(text):
        backslashes = 0
        index = match.start() - 1
        while index >= 0 and text[index] == "\\":
            backslashes += 1
            index -= 1
        if backslashes % 2 == 0:
            return True
    return False


def audit_injections(
    body: str,
    fields: dict[str, Any],
    mode: str,
    skill_file: Path,
    errors: list[dict[str, str]],
    warnings: list[dict[str, str]],
) -> int:
    injections, parse_errors = find_injections(body)
    for message in parse_errors:
        add_issue(errors, message, str(skill_file))
    if not injections:
        return 0
    if mode == "portable":
        for line, _, _ in injections:
            add_issue(
                errors,
                f"Dynamic shell injection is a Claude Code-only body feature (body line {line})",
                str(skill_file),
            )
        return len(injections)

    arguments = string_list(fields.get("arguments")) or []
    unsafe_tokens = injection_argument_tokens(arguments)
    if fields.get("shell") is None:
        add_issue(
            warnings,
            "Skill uses dynamic injection without an explicit shell; Claude Code defaults to bash",
            str(skill_file),
        )
    for line, command, _ in injections:
        if not command.strip():
            add_issue(errors, f"Empty dynamic injection at body line {line}", str(skill_file))
            continue
        for label, pattern in unsafe_tokens:
            if has_unescaped_match(command, pattern):
                add_issue(
                    errors,
                    f"Dynamic injection at body line {line} interpolates unsafe {label}; keep invocation text out of shell source",
                    str(skill_file),
                )
        if MUTATING_COMMAND.search(command):
            add_issue(
                errors,
                f"Dynamic injection at body line {line} appears to mutate state; load-time commands must be read-only",
                str(skill_file),
            )
        if NETWORK_COMMAND.search(command):
            add_issue(
                errors,
                f"Dynamic injection at body line {line} appears to perform network I/O; load-time context must be local and cheap",
                str(skill_file),
            )
        if SECRET_OUTPUT.search(command):
            add_issue(
                errors,
                f"Dynamic injection at body line {line} may print a credential value; emit presence/status only",
                str(skill_file),
            )
        redirection_scan = re.sub(
            r"(?<!\S)[12]?>\s*/dev/null\b|(?<!\S)[12]?>\s*\$null\b",
            "",
            command,
            flags=re.IGNORECASE,
        )
        if re.search(r"(^|[;&|]\s*|\n\s*|\s)>{1,2}\s*[^&]", redirection_scan):
            add_issue(
                errors,
                f"Dynamic injection at body line {line} contains output redirection; load-time commands must not write files",
                str(skill_file),
            )
        external_lines = [
            item.strip()
            for item in command.splitlines()
            if item.strip()
            and not item.lstrip().startswith("#")
            and not re.match(r"^(?:if|then|else|elif|fi|for|do|done|case|esac|while|until|function|\{|\}|\[|test\b|echo\b|printf\b|exit\b|return\b|[A-Za-z_][A-Za-z0-9_]*=)", item.strip())
        ]
        if external_lines and not any(
            marker in command
            for marker in ("2>/dev/null", "2>$null", "try {", "-ErrorAction", "||", "if ", "command -v", "Get-Command")
        ):
            add_issue(
                warnings,
                f"Dynamic injection at body line {line} has no visible failure guard; expected absence can pollute rendered context",
                str(skill_file),
            )
    return len(injections)


def validate_evals(
    eval_path: Path,
    skill_dir: Path,
    skill_name: str,
    errors: list[dict[str, str]],
) -> int:
    if not eval_path.exists():
        return 0
    try:
        data = json.loads(eval_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        add_issue(errors, f"Cannot parse evals/evals.json: {error}", str(eval_path))
        return 0
    if not isinstance(data, dict):
        add_issue(errors, "evals/evals.json root must be an object", str(eval_path))
        return 0
    if data.get("skill_name") != skill_name:
        add_issue(
            errors,
            f"evals skill_name must match frontmatter name {skill_name!r}",
            str(eval_path),
        )
    evals = data.get("evals")
    if not isinstance(evals, list) or not evals:
        add_issue(errors, "evals must be a non-empty array", str(eval_path))
        return 0
    seen: set[int] = set()
    skill_root = skill_dir.resolve()
    for index, entry in enumerate(evals):
        label = f"evals[{index}]"
        if not isinstance(entry, dict):
            add_issue(errors, f"{label} must be an object", str(eval_path))
            continue
        for field in ("prompt", "expected_output"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                add_issue(errors, f"{label}.{field} must be a non-empty string", str(eval_path))
        eval_id = entry.get("id")
        if not isinstance(eval_id, int) or isinstance(eval_id, bool) or eval_id < 1:
            add_issue(errors, f"{label}.id must be a positive integer", str(eval_path))
        elif eval_id in seen:
            add_issue(errors, f"Duplicate eval id: {eval_id}", str(eval_path))
        else:
            seen.add(eval_id)
        expectations = entry.get("expectations")
        if not isinstance(expectations, list) or not expectations or not all(
            isinstance(item, str) and item.strip() for item in expectations
        ):
            add_issue(errors, f"{label}.expectations must be a non-empty string array", str(eval_path))
        files = entry.get("files", [])
        if not isinstance(files, list) or not all(isinstance(item, str) and item for item in files):
            add_issue(errors, f"{label}.files must be a string array", str(eval_path))
        else:
            for item in files:
                candidate = Path(item)
                if candidate.is_absolute():
                    add_issue(errors, f"{label} file path must be relative to the skill root: {item}", str(eval_path))
                    continue
                target = (skill_root / candidate).resolve()
                if not target.is_relative_to(skill_root):
                    add_issue(errors, f"{label} file path escapes the skill root: {item}", str(eval_path))
                elif not target.is_file():
                    add_issue(errors, f"{label} references missing file: {item}", str(eval_path))
    return len(evals)


def validate_trigger_queries(
    query_path: Path,
    errors: list[dict[str, str]],
) -> int:
    if not query_path.exists():
        return 0
    try:
        data = json.loads(query_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        add_issue(errors, f"Cannot parse evals/trigger_queries.json: {error}", str(query_path))
        return 0
    if not isinstance(data, list) or not data:
        add_issue(errors, "evals/trigger_queries.json must be a non-empty array", str(query_path))
        return 0
    seen: set[str] = set()
    outcomes: set[bool] = set()
    for index, entry in enumerate(data):
        label = f"trigger_queries[{index}]"
        if not isinstance(entry, dict) or set(entry) != {"query", "should_trigger"}:
            add_issue(errors, f"{label} must contain exactly query and should_trigger", str(query_path))
            continue
        query = entry.get("query")
        should_trigger = entry.get("should_trigger")
        if not isinstance(query, str) or not query.strip():
            add_issue(errors, f"{label}.query must be a non-empty string", str(query_path))
        elif query in seen:
            add_issue(errors, f"Duplicate trigger query: {query}", str(query_path))
        else:
            seen.add(query)
        if not isinstance(should_trigger, bool):
            add_issue(errors, f"{label}.should_trigger must be a boolean", str(query_path))
        else:
            outcomes.add(should_trigger)
    if outcomes != {False, True}:
        add_issue(errors, "trigger queries must include at least one positive and one negative case", str(query_path))
    return len(data)


def validate_skill(
    path: Path,
    allow_name_mismatch: bool = False,
    mode: str = "claude-code",
) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    if mode not in {"portable", "claude-code"}:
        add_issue(errors, f"Unknown validation mode: {mode}")
        path = path.expanduser().resolve()
        return result(path, path, None, mode, errors, warnings, {})

    path = path.expanduser().resolve()
    skill_dir = path.parent if path.name == "SKILL.md" else path
    skill_file = skill_dir / "SKILL.md"
    if not skill_dir.exists():
        add_issue(errors, f"Skill path does not exist: {skill_dir}")
        return result(path, skill_dir, None, mode, errors, warnings, {})
    if not skill_dir.is_dir():
        add_issue(errors, f"Skill path is not a directory: {skill_dir}")
        return result(path, skill_dir, None, mode, errors, warnings, {})
    if not skill_file.exists():
        add_issue(errors, "Skill directory must contain SKILL.md", str(skill_file))
        return result(path, skill_dir, None, mode, errors, warnings, {})

    try:
        text = skill_file.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        add_issue(errors, f"SKILL.md must be UTF-8: {error}", str(skill_file))
        return result(path, skill_dir, skill_file, mode, errors, warnings, {})
    frontmatter, body, fm_errors = split_frontmatter(text)
    for message in fm_errors:
        add_issue(errors, message, str(skill_file))

    fields: dict[str, Any] = {}
    if frontmatter is not None:
        fields, parse_errors = parse_frontmatter(frontmatter)
        for message in parse_errors:
            add_issue(errors, message, str(skill_file))

    name, description = validate_frontmatter_fields(
        fields,
        mode,
        skill_dir,
        skill_file,
        allow_name_mismatch,
        errors,
        warnings,
    )
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

    script_count = 0
    ignored_cache_files = 0
    scripts_dir = skill_dir / "scripts"
    if scripts_dir.exists():
        for script in scripts_dir.rglob("*"):
            relative = script.relative_to(skill_dir)
            if "__pycache__" in relative.parts or script.suffix in {".pyc", ".pyo"}:
                if script.is_file():
                    ignored_cache_files += 1
                continue
            if not script.is_file():
                continue
            script_count += 1
            try:
                start = script.read_bytes()[:2]
            except OSError:
                continue
            if start == b"#!" and not os.access(script, os.X_OK):
                add_issue(warnings, f"Script has a shebang but is not executable: {relative}", str(script))

    injection_count = audit_injections(body, fields, mode, skill_file, errors, warnings)
    eval_count = validate_evals(skill_dir / "evals" / "evals.json", skill_dir, name, errors)
    trigger_query_count = validate_trigger_queries(skill_dir / "evals" / "trigger_queries.json", errors)
    summary = {
        "mode": mode,
        "name": name or None,
        "description_chars": len(description),
        "skill_md_lines": line_count,
        "estimated_tokens": estimated_tokens,
        "referenced_support_files": len(referenced_paths),
        "scripts": script_count,
        "ignored_python_cache_files": ignored_cache_files,
        "dynamic_injections": injection_count,
        "evals": eval_count,
        "trigger_queries": trigger_query_count,
    }
    return result(path, skill_dir, skill_file, mode, errors, warnings, summary)


def result(
    input_path: Path,
    skill_dir: Path,
    skill_file: Path | None,
    mode: str,
    errors: list[dict[str, str]],
    warnings: list[dict[str, str]],
    summary: dict[str, Any],
) -> dict[str, Any]:
    return {
        "ok": not errors,
        "mode": mode,
        "input_path": str(input_path),
        "skill_dir": str(skill_dir),
        "skill_file": str(skill_file) if skill_file else None,
        "summary": summary,
        "errors": errors,
        "warnings": warnings,
    }


def print_text(report: dict[str, Any]) -> None:
    status = "OK" if report["ok"] else "FAILED"
    print(f"{status} [{report['mode']}]: {report['skill_dir']}")
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
            "  tools/validate_skill.py ~/.agents/skills/my-skill --mode portable --format text\n"
            "  tools/validate_skill.py .claude/skills/my-skill --mode claude-code --format text"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("path", help="Skill directory or SKILL.md file to validate")
    parser.add_argument(
        "--mode",
        choices=("portable", "claude-code"),
        default="claude-code",
        help="Validation profile (default: claude-code)",
    )
    parser.add_argument(
        "--allow-name-mismatch",
        action="store_true",
        help="Do not require portable name to match the parent directory",
    )
    parser.add_argument("--format", choices=("json", "text"), default="json", help="Output format")
    args = parser.parse_args(argv)

    report = validate_skill(
        Path(args.path),
        allow_name_mismatch=args.allow_name_mismatch,
        mode=args.mode,
    )
    if args.format == "json":
        print(json.dumps(report, indent=2, sort_keys=True))
    else:
        print_text(report)
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
