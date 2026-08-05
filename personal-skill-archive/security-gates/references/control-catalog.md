# Control catalog (defaults, not mandates)

Choose tools that match the repo’s manifests. Prefer what is already on the
runner. Verify language version support before gating.

## Secrets

| Tool class | Typical use |
|------------|-------------|
| Gitleaks-class | Offline protect staged + detect diff/full history |
| Verified scanners (e.g. trufflehog `--only-verified`) | Scheduled live-key check |
| Hosted secret scanning | Extra layer on public/paid plans — not sole gate for private sovereignty |

Config: ignore paths for **fixtures** that deliberately look like credentials.

## Dependency / SCA

| Ecosystem | Common fail-closed approach |
|-----------|-----------------------------|
| .NET | Restore-time audit properties workspace-wide + parse `dotnet list package --vulnerable` (exit 0 trap) + lockfile |
| Rust | `cargo audit` / `cargo deny` on lockfile |
| Node | `npm/pnpm/yarn audit` or OSV-Scanner on lockfile; parse severity |
| Go | `govulncheck` / OSV on `go.mod` |
| Python | `pip-audit` / OSV on requirements/lock |
| Cross-ecosystem | OSV-Scanner (or similar) on committed lockfiles; offline DB cache when air-gapped |

Always: **workspace/solution scope**, not a random subset of packages.

## Native / C++ supply chain

| Approach | Notes |
|----------|-------|
| Manifest + baseline (vcpkg/conan/etc.) | Makes the graph auditable |
| OSV / advisory DB on lock or SBOM | Second opinion vs language SCA |
| Pin single system deps | Document version and review upgrades |

Classic unpinned system packages without a lock are **ungated** until you pin.

## SAST (code)

| Language family | Prefer starting points |
|-----------------|------------------------|
| C / C++ | clang-tidy (analyzer/cert/bugprone sets), cppcheck cheap pass, Clang Static Analyzer deep/nightly |
| C# | Roslyn NetAnalyzers (`AnalysisLevel`) + security analyzer packages in build |
| Rust | `clippy -D warnings` (policy) + optional advanced tools later |
| TypeScript / JS | eslint security plugins / typescript-eslint; keep noise under control |
| Go | `govulncheck` + `staticcheck` / vet |
| Generic pattern SAST | Only if it **parses** this language version; never sole C++/modern C# plan without proof |

## Aggregation (T3, optional)

- Phase 0: SARIF/NDJSON into existing logs/metrics — zero new services.
- Phase 1: self-hosted finding DB (e.g. DefectDojo-class) when volume hurts.

## Agentic deep audit (T4, non-gating)

- Attack-surface recon, advisory intelligence, human-readable reports.
- Sandbox + scoped keys + human review.
- Output is **tickets/notes**, not a required green check.

## Proof recipes (generic)

1. **Secrets:** add a clearly fake AWS/GitHub-shaped token in a temp file →
   protect/detect fails → remove → green. Allowlist only under test paths.
2. **SCA:** temporarily pin a known-vulnerable version in a branch → gate red
   → restore.
3. **Tool down:** rename scanner on PATH → gate red, not “0 findings.”
