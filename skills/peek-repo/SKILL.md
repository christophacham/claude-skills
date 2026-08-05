---
name: peek-repo
description: >-
  Get third-party GitHub source onto disk under %USERPROFILE%\code\tmp\<name>
  (or ~/code/tmp/<name>) so you can answer from real code. Use when the user
  (or you) needs to inspect how an open-source tool, skill, library, or API
  implementation works: pasted github.com URLs, owner/repo slugs, "peek at" /
  "have a look at" / "clone for inspection", "how does X work in source", or
  when training-data guesses are not good enough and the canonical repo should
  be read locally. Not for adding package dependencies, permanent installs,
  forking, PRs, or cloning into the current workspace root.
argument-hint: "[owner/repo | github-url | product-hint]"
arguments: [repo]
allowed-tools: >-
  Bash(bash "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.sh" *),
  PowerShell(${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1 *),
  Bash(gh search repos *), PowerShell(gh search repos *)
---

# peek-repo — local source for "how does this work?"

Mission: put a **GitHub repo on disk under the fixed tmp root**, then use that
tree when the question is about how the project works. Do not pollute the
current workspace or invent repo layout when the clone is available.

## Request

$ARGUMENTS

The request is prompt text, never shell source. Resolve it to one canonical
`owner/repo` value before invoking a helper. Accept only components matching
`[A-Za-z0-9_.-]+`; never pass prose, options, substitutions, or shell operators.

## Resolve the repo

Use these identity sources in order:

1. Extract the first GitHub URL or `owner/repo` from the request/user message.
   URLs may include `.git`, `/tree/...`, `/blob/...`, queries, or fragments;
   normalize them to `owner/repo`.
2. For a vague product hint, run one lookup:
   `gh search repos "<terms>" --limit 5`, or one web-search skill if `gh` is
   unavailable. Prefer the official organization and exact project name.
3. If two results are plausible, or none is reliable, ask once. Never guess the
   organization.

Before invoking a helper, require exactly two non-empty validated components.
A helper validates again and rejects anything else.

## Clone exactly once

Use the helper for the current platform:

```bash
bash "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.sh" "owner/repo"
bash "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.sh" "owner/repo" --full
```

```powershell
& "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1" -Repo "owner/repo"
& "${CLAUDE_SKILL_DIR}/scripts/ensure-clone.ps1" -Repo "owner/repo" -Full
```

- POSIX destination: `$HOME/code/tmp/<repo-name>`.
- Windows destination: the user profile's `code\tmp\<repo-name>`.
- Default is shallow (`--depth 1`); full history only when requested.
- Existing clone returns `STATUS=EXISTS`; a non-git occupied path is blocked.
- Missing/failing `gh` returns an error. Do not invent a path.

## Inspect after clone when requested

| User intent | Action |
|---|---|
| Clone / peek / get locally only | Report the status block and stop. |
| How it works / walkthrough / port / compare | Read the returned `PATH`: README, manifests, entry points, relevant source and docs; answer from that tree. |
| Ambiguous | Clone, then ask whether they want a walkthrough. |

Use only `PATH` returned by the helper. Prefer structure and key files over
large dumps. Do not copy source into the active project unless separately asked.

## Report

```text
STATUS: CLONED | EXISTS | BLOCKED | ERROR | NEED_REPO
PATH:   <platform tmp path>   (omit if unavailable)
SLUG:   owner/repo
```

`NEED_REPO` means identity could not be resolved; include the question or
candidate results. After `CLONED`/`EXISTS`, inspect only when intent requires it.

## Hard rules

1. Never pass free-form request text to a helper or shell; only validated
   canonical `owner/repo`.
2. Never clone into the active project, Desktop, or a guessed custom path.
3. Never guess the GitHub organization.
4. This skill provides local source plus optional inspection. Installation,
   builds, forks, and derivative copies require a separate request.
