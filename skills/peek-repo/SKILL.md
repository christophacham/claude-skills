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
compatibility: Claude Code; requires git and either gh or HTTPS clone access, plus Bash or PowerShell.
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
- Default is shallow (`--depth 1`). On a matching existing shallow clone,
  `--full` fetches full history but never pulls, resets, or updates the worktree.
- Helpers reject every pre-existing file, link/reparse point, empty directory, or
  non-repository directory. They reuse only a physically contained standalone
  clone with a case-insensitively matching canonical GitHub origin.
- New clones are completed and validated inside an invocation-owned unpredictable
  staging directory, then published with a no-clobber rename. A destination that
  appears concurrently is preserved. `gh` receives an explicit github.com URL;
  when `gh` is unavailable, public HTTPS clone falls back to noninteractive `git`.
- Prompts are disabled. Raw `gh`/`git` diagnostics are suppressed; report only
  the structured result. Missing/failing tools never justify inventing a path.

## Inspect after clone when requested

| User intent | Action |
|---|---|
| Clone / peek / get locally only | Report the status block and stop. |
| How it works / walkthrough / port / compare | Read the returned `PATH`: README, manifests, entry points, relevant source and docs; answer from that tree. |
| Ambiguous | Clone, then ask whether they want a walkthrough. |

Use only `PATH` returned by the helper. Prefer structure and key files over
large dumps. Do not copy source into the active project unless separately asked.

## Structured result and report

Preserve helper field names and casing exactly:

```text
STATUS=CLONED | EXISTS | BLOCKED | ERROR
EXIT_CODE=0 | 2 | 3 | 4 | 5 | 6 | 7
PATH=<platform tmp path>       # when a destination was resolved
SLUG=owner/repo                # when identity was resolved
ACTION=CLONED | NONE | UNSHALLOWED
SHALLOW=true | false
FRESHNESS=CLONE_TIME | NOT_CHECKED | WORKTREE_NOT_UPDATED
ORIGIN_CHECK=PASSED
CLONE_BACKEND=gh | git            # new clones only
```

Exit `0` is success; `2` is invalid input or a blocked/pre-existing path; `3`
is a missing tool; `4` is a filesystem/finalization error; `5` is clone failure;
`6` is clone/git validation failure; `7` is unshallow failure. `ERROR` and
`COMMAND_EXIT` add sanitized detail on failures.

If identity cannot be resolved before helper invocation, report
`STATUS=NEED_REPO` in prose with the question or candidate results; this is an
agent status, not helper output. Never describe `EXISTS` as current:
`FRESHNESS=NOT_CHECKED` means no remote freshness check occurred, and
`WORKTREE_NOT_UPDATED` means history was fetched without changing checkout.
After `CLONED`/`EXISTS`, inspect only when intent requires it.

## Hard rules

1. Never pass free-form request text to a helper or shell; only validated
   canonical `owner/repo`.
2. Never clone into the active project, Desktop, or a guessed custom path.
3. Never guess the GitHub organization.
4. This skill provides local source plus optional inspection. Installation,
   builds, forks, and derivative copies require a separate request.
