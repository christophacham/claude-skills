---
name: geometric-robustness
description: "Use when writing or reviewing numeric and geometry-heavy Rust code (slicers, mesh processing, toolpaths, CAD/CAM): floating-point robustness, exact geometric predicates, epsilon and tolerance policy, degenerate-case handling (collinear, coplanar, zero-area, slivers), deterministic output, property-based tests for geometric invariants, and golden/snapshot regression tests. Covers tolerance architecture (numerical vs geometric vs manufacturing scales), mesh ingestion repair, determinism rules for parallel and float code, and float-safety fitness functions. Not for general module design (see simple-design), layer placement (see architecture-design), or non-numeric code."
---

# Geometric Robustness

The inherent complexity of a slicer lives here: floats are noisy, real-world meshes are broken, and any nondeterminism poisons regression testing. Every rule below exists to keep that complexity *inherent* — decided once, owned by one module — instead of scattered accidentally across the codebase.

Three policies must be decided centrally before writing geometry code: the **tolerance architecture** (§1), the **predicate strategy** (§2), and the **determinism rules** (§4). Everything else follows from them.

## 1. Tolerance architecture — three scales, one home

There is no single "epsilon." Conflating scales is the most common source of silent corruption in geometry code.

| Scale | Purpose | Typical magnitude (mm-based models) | Example decision |
|-------|---------|-------------------------------------|------------------|
| **Numerical** | Absorb float rounding noise | ~1e-9 to 1e-12 × model extent | "Are these computed points the same point?" |
| **Geometric** | Snap/modeling coincidence | ~1e-4 to 1e-6 | "Do these mesh vertices weld?" |
| **Manufacturing** | Machine/physics limits | ~0.01 to 0.5 | "Is this wall printable?" |

Rules:

- **One module owns all tolerances** (e.g. `kernel::tolerance`). Every tolerance is a named, documented constant with its scale and units. Bare epsilon literals anywhere else are a defect — enforce with a fitness function (`grep -rnE '1e-[0-9]+' --include='*.rs'` outside the tolerance module must be empty).
- **Never compare floats with `==`** except: bit-exact determinism checks, sentinel values you set yourself in the same function. Everything else goes through a tolerance helper: `approx_eq(a, b, tol)`, or relative/ULP comparison when magnitudes vary.
- **Relative beats absolute** when values span scales. `|a - b| <= tol * max(1, |a|, |b|)` survives both millimeter details and meter-scale models. Scale tolerances by model extent at ingestion, not per call site.
- **Tolerances are part of a module's interface contract.** If a function's correctness depends on a tolerance, say which scale it uses in its doc comment. Hidden tolerance coupling between modules is information leakage (simple-design §3).

## 2. Predicates: exact for decisions, floats for construction

The single most important structural rule in geometry code:

> **Classify with exact predicates; construct with floats; never reverse.**

A *predicate* (orientation, in-circle, point-on-which-side) returns a sign and feeds a branch. A *construction* (intersection point, offset vertex) produces new coordinates. Wrong-sign branches corrupt topology and crash downstream code in un-debuggable places; a slightly-off coordinate merely perturbs geometry.

| Role | Arithmetic | Rust tooling |
|------|-----------|--------------|
| Predicates | Exact or floating-point-filtered exact | `robust` crate (Shewchuk's predicates: `orient2d`, `orient3d`, `incircle`) |
| Constructions | `f64` | plain arithmetic, `nalgebra`/`glam` |

- **Never implement orientation tests with raw float cross products** on the branch path. `robust::orient2d` costs little and removes a whole failure class.
- Filter-then-exact pattern (inside the predicate, already done by `robust`): fast float check with error bound; fall back to exact arithmetic only when the fast check is inconclusive. Do not hand-roll this.
- **f64 for geometry, always.** f32 halves the working tolerance budget and saves nothing in a slicer. f32 only at the GPU/render boundary, converted explicitly.

## 3. Degenerate geometry: repair at the boundary, assert in the kernel

Degeneracies are certain, not exceptional. Catalog: zero-area triangles, duplicate vertices, collinear triples, coplanar intersections, slivers, non-manifold edges, self-intersections, unclosed shells, flipped normals.

- **Repair at ingestion.** One mesh-repair module on the input boundary: weld vertices, drop degenerate faces, stitch/orient shells. Inside the kernel, meshes are *valid by construction* (value-object rule: invalid states unrepresentable, architecture-design — Tactical DDD).
- **Assert postconditions in the kernel**, cheaply: `debug_assert!(face.area() > tol)` after construction. A violated invariant near its cause is a 5-minute fix; 40 calls later it is a week.
- **Never silently fix-and-continue mid-algorithm.** If a layer-polygon operation hits a degenerate it cannot represent, return a typed error naming the degeneracy. Silent repair inside algorithms is how slivers multiply.
- **Feed every degenerate you ever meet into the test corpus** (§6). The corpus is institutional memory; production surprises become permanent regression fixtures.

## 4. Determinism: bit-identical or documented-otherwise

Same input must produce bit-identical output on every run and every supported platform. Nondeterminism destroys golden testing (§6), makes bugs irreproducible, and erodes user trust ("same file, different g-code").

| Source of nondeterminism | Rule |
|--------------------------|------|
| `HashMap`/`HashSet` iteration | Iterate `BTreeMap`/`IndexMap`, or collect + sort, on any path that feeds output |
| Parallel reduction order (`rayon`) | Use deterministic reduction: `map` → `collect` → sequential `reduce`, or fold with commutative-exact ops (integer counts); never float `sum()` over unordered partials |
| Float summation order | Sum hierarchically or with compensated (Kahan) summation when precision matters; keep one canonical order |
| Randomness (jitter, sampling) | Seeded RNG only; seed derived from input hash, recorded in output metadata |
| Platform-dependent math | Transcendentals (`sin`, `powf`) are platform-stable per IEEE for basic ops but libm differs for some; in golden paths prefer operations with one correctly-rounded result, or accept tolerance in the comparison (§6) |
| Build flags | No `-C target-cpu=native` or fast-math in release builds that produce g-code |

**Fitness function:** run the full slice twice on a fixture mesh, hash the output bytes, compare in CI. This is cheap and catches every rule above at once.

## 5. Property-based testing: invariants over examples

Example-based tests sample; invariants *characterize*. Geometry is the ideal proptest domain: input spaces are huge and the truths are simple. Use `proptest`.

Slicer invariant catalog (write each once, run forever):

- **Safety:** toolpath never intersects the model volume (sampled); nozzle never below build plate.
- **Conservation:** extruded volume per layer ≈ path length × bead cross-section, within manufacturing tolerance; total sliced area per height interval is monotone in known ways.
- **Validity:** slicing a watertight mesh yields closed polygons per layer; polygon count is finite and every segment endpoint is shared by exactly one other segment.
- **Idempotence/stability:** slicing twice gives identical bytes (ties to §4); translating the model by a constant translates the toolpath by the same constant (symmetry properties — rotate/translate/scale in/out and compare).
- **Roundtrips:** serialize → parse a mesh/g-code and compare within numerical tolerance.

Strategy guidance:

- Generate *valid-ish* meshes (weld + perturb a cube grid) so shrinking produces minimal real failures, not noise. Deglomerate: one strategy per degenerate class (§3).
- Assert with tolerances from the tolerance module (§1) — never local epsilons.
- Persist every proptest failure seed as an explicit regression test.

## 6. Golden regression tests

For full-pipeline outputs (sliced layers, g-code) where invariants are too weak:

- **Corpus layout:** `tests/corpus/<name>/input.stl` + `expected/` + `meta.toml` (what degenerate/feature this fixture covers, when added, why).
- **Compare with tolerance, not bytes**, except the determinism check (§4) which is bit-exact. Numeric comparison lives in one test-support helper: per-field tolerances from the tolerance module, worst-error report on failure.
- **Bless procedure is explicit:** `BLESS=1 cargo test` regenerates goldens; the diff of a blessing commit is reviewed like code. Silent regeneration in normal test runs is forbidden.
- **Serialize floats canonically** in goldens (`ryu`, shortest round-trip representation) so diffs are meaningful and platform-stable.
- Golden tests are few and slow; proptest invariants are many and fast. Invariants catch *classes* of bugs; goldens catch *regressions of known behavior*. Use both; do not substitute one for the other.

## 7. Rust implementation notes

| Concern | Default |
|---------|---------|
| Orientation/incircle predicates | `robust` crate |
| Geometry math | `f64` everywhere; f32 only at GPU/render boundary |
| Ordered float keys (maps/sorts) | `ordered_float::OrderedFloat` or `total_cmp` (Rust 1.62+) |
| NaN policy | NaN is a bug, not a value: `debug_assert!(x.is_finite())` on constructed coordinates; never propagate NaN through the kernel |
| Property tests | `proptest`; `test-strategy` for derive-style |
| Parallelism | `rayon` with deterministic reduction (§4) |
| Deterministic iteration | `BTreeMap`/`IndexMap` in output paths |
| Golden serialization | `ryu` for floats |

## 8. Red flags checklist

|| Red flag | Signal → fix |
|--|----------|--------------|
| 1 | Scattered epsilon | Bare `1e-5`-style literal outside the tolerance module → move to named constant at the correct scale (§1) |
| 2 | `==` on floats | Comparison on the logic path → tolerance helper, or `total_cmp` for sort keys only (§1) |
| 3 | Float branch predicate | Cross-product sign feeding an `if` → exact predicate via `robust` (§2) |
| 4 | Silent mid-algorithm repair | Clamping/degenerate-dropping inside a kernel function → typed error or ingestion-time repair (§3) |
| 5 | Nondeterministic iteration | `HashMap` iteration feeding output → ordered structure + determinism CI check (§4) |
| 6 | Unseeded randomness | `thread_rng()` in library code → seeded, recorded RNG (§4) |
| 7 | Example-only testing | A geometry function with 3 hardcoded cases and no invariant → proptest the invariant (§5) |
| 8 | NaN flow-through | `.min()`/comparisons misbehaving on NaN inputs → assert finite at construction (§7) |
| 9 | f32 in geometry | Half-precision tolerance budget → f64, convert at the boundary (§2) |
| 10 | Local assertion tolerance | Test defines its own epsilon → use tolerance module scales (§1, §5) |

**Review loop:** name the flag, state which failure class it invites (topology corruption / nondeterminism / silent drift), then propose the smallest change that removes it.

## Reference loading

Read `references/reference.md` only when you need depth beyond this summary:

- Shewchuk predicate background and the floating-point filter theory behind `robust`
- Full degenerate-case catalog with repair strategies per class
- Mesh ingestion/repair pipeline ordering (weld → orient → stitch → validate)
- Proptest strategy recipes for meshes and toolpaths, shrinking guidance
- Golden-test infrastructure detail: corpus governance, comparison helpers, bless workflow
- Compensated summation and error-bounded arithmetic when f64 alone is not enough

Do not load it for tolerance naming, predicate choice, or the red-flag checks above.
