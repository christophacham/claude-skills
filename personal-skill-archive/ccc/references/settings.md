# ccc settings

Two YAML files, created by `ccc init`.

## User-level — `%USERPROFILE%\.cocoindex_code\global_settings.yml`

```yaml
embedding:
  provider: sentence-transformers   # or "litellm" (default when provider omitted)
  model: Snowflake/snowflake-arctic-embed-xs
  device: cpu                       # optional: cpu | cuda | mps
  min_interval_ms: 300              # LiteLLM only: pace requests

envs:                               # injected into daemon if not in shell env
  OPENAI_API_KEY: your-key

daemon:
  idle_timeout_minutes: 180         # 0 = never
```

### Model examples

**Local (default here):**

```yaml
embedding:
  provider: sentence-transformers
  model: Snowflake/snowflake-arctic-embed-xs
  device: cpu
```

**Stronger local code model (~1 GB VRAM):**

```yaml
embedding:
  provider: sentence-transformers
  model: nomic-ai/CodeRankEmbed
  device: cuda
```

**Cloud (LiteLLM):**

```yaml
embedding:
  model: text-embedding-3-small   # or voyage/voyage-code-3, gemini/…, ollama/…
  min_interval_ms: 300
envs:
  OPENAI_API_KEY: …
```

After **any** embedding model change (vector size may change):

```powershell
ccc reset -f
ccc index
```

## Project-level — `<repo>\.cocoindex_code\settings.yml`

Controls which files are indexed. Defaults cover many languages (C/C++, Python, JS/TS, Rust, Go, …).

```yaml
include_patterns:
  - "**/*.cpp"
  - "**/*.h"
  # …

exclude_patterns:
  - "**/.*"
  - "**/node_modules"
  - "**/__pycache__"
  - "**/.cocoindex_code"
  # …

language_overrides:
  - ext: inc
    lang: php
```

After edits: `ccc index`.

### BambuStudio notes

- Tree is large (thousands of matched files). First CPU index is slow; use `ccc status`.
- `deps/` and vendored trees may still match some globs; tighten `exclude_patterns` if the index is noisy or huge (e.g. extra `**/deps/**` if you only care about first-party code).
- Do not commit `.cocoindex_code/` (gitignored).
