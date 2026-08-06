# Geometric Robustness — Reference

Depth for the decisions the SKILL.md summary only names. Load the section you need.

## 1. Why predicates must be exact

Jonathan Shewchuk's "Adaptive Precision Floating-Point Arithmetic and Fast Robust
Geometric Predicates" (1997) is the canonical result. The short version:

- A predicate like `orient2d(a, b, c)` computes the sign of a determinant. With
  plain `f64` arithmetic the computed sign can be *wrong* when the true value is
  near zero — exactly the case that decides whether a mesh edge flip, a
  triangulation, or a polygon intersection is valid.
- The failure mode is not "slightly wrong answer"; it is *wrong branch taken*,
  which corrupts topology. Downstream code then crashes or loops far from the
  cause.
- Shewchuk's construction: compute the fast float result *and* an error bound.
  If `|result| > bound`, the sign is trustworthy. Otherwise expand to
  arbitrary-precision *expansion arithmetic* (non-overlapping floats summed
  exactly). The common case costs ~1 float op; exactness is guaranteed.

The `robust` crate ports these predicates to Rust (`orient2d`, `orient3d`,
`incircle`, `insphere`). Use it as-is; do not reimplement. Expansion arithmetic
has subtle ordering requirements that are easy to get wrong.

When `robust` has no predicate you need (rare — e.g. custom distance-to-line
classification), the fallback hierarchy is:

1. Reformulate as an orientation/incircle composition if possible.
2. Interval arithmetic (e.g. `inari` crate): if the interval excludes zero, the
   sign is known; else widen precision.
3. Exact rational arithmetic on the predicate only (`num-rational` over the
   float inputs, which are exact dyadic rationals). Slow; predicates only.

## 2. Floating-point error intuition for reviewers

Rules of thumb when reading numeric code:

- Relative rounding error per op: ~2^-53 ≈ 1.1e-16 for f64.
- Error grows roughly linearly with op count for well-behaved formulas, and
  *catastrophically* under cancellation: `a - b` with `a ≈ b` keeps absolute
  error but destroys relative accuracy. Cancellation near branch decisions is
  the classic predicate bug.
- The conditioning of the *problem* matters as much as the algorithm:
  near-degenerate inputs (near-collinear points) amplify input noise. This is
  why degenerates (SKILL.md §3) are a first-class concern, not edge cases.
- Kahan/compensated summation recovers the low-order bits lost in naive float
  sums; use it in long accumulation loops (area integrals, path length
  totals) before reaching for higher precision.

```rust
fn kahan_sum(values: impl Iterator<Item = f64>) -> f64 {
    let (mut sum, mut c) = (0.0, 0.0);
    for x in values {
        let y = x - c;
        let t = sum + y;
        c = (t - sum) - y; // algebraically zero; recovers lost low bits
        sum = t;
    }
    sum
}
```

## 3. Degenerate-case catalog and repair strategies

| Degenerate | Detection | Repair (at ingestion) |
|------------|-----------|------------------------|
| Duplicate vertices | Within geometric snap tolerance | Weld: spatial-hash grid keyed at snap scale, keep first |
| Zero-area faces | Area < numerical tolerance after weld | Drop face; record count in repair report |
| Collinear triples in polygons | Exact `orient2d` == 0 | Remove middle vertex (ear-clipping-safe removal) |
| Non-manifold edges | Edge shared by ≠2 faces | Split vertices per fan; if unrepairable, reject file with typed error |
| Flipped/inconsistent normals | BFS propagation of orientation across shared edges | Flip minority component; log |
| Unclosed shells | Boundary edges remain after stitching | Stitch within geometric tolerance; else typed error listing hole boundary |
| Self-intersections | Segment-segment intersection over face pairs (BVH-accelerated) | Do not auto-repair; reject or flag — repair changes model semantics |
| Slivers | Aspect ratio or min-angle threshold | Weld/remove; they poison offset and Voronoi code downstream |
| Degenerate layer slices | Empty layer, single-point polygon, self-touching ring | Typed errors per case; the slicer must represent "empty layer" as normal, "point polygon" as invalid |

Repair pipeline ordering matters — each step assumes the previous invariants:

```
parse → dedupe/weld → drop zero-area → orient normals → stitch shells
      → validate (manifold, closed, finite coords) → typed Mesh value object
```

After this pipeline, the `Mesh` type is *valid by construction*; kernel code
never re-checks ingestion invariants, only its own postconditions.

## 4. Proptest recipes for geometry

### Strategy: valid-ish meshes

Generate meshes that are valid by construction so shrinking yields meaningful
minimal cases:

```rust
use proptest::prelude::*;

fn cube_grid_mesh() -> impl Strategy<Value = Mesh> {
    (1usize..5, 1usize..5, 1usize..5, -0.3f64..0.3)
        .prop_map(|(nx, ny, nz, jitter)| {
            // grid of welded cubes, vertices perturbed by jitter
            // (keeps manifoldness; exercises tolerance code)
            build_jittered_grid(nx, ny, nz, jitter)
        })
}
```

Rules:

- **Perturb, don't scatter.** Random point clouds almost never form valid
  meshes; shrinkers then minimize into garbage. Structured generation +
  perturbation keeps every shrink step valid.
- **One strategy per degenerate class** (§3): near-coplanar quads,
  near-zero-height layers, tangent-touching shells. "Near-degenerate" inputs
  (within 10× of tolerance) find more bugs than exact degenerates.
- Bound coordinate ranges to model-plausible scales (0.01..1000.0 mm) so
  tolerances behave as in production.

### Symmetry properties (the highest-value invariants)

Geometry code has exploitable symmetries. Each is one test:

```rust
// Translation invariance: slice(M + t) == slice(M) + t
// Rotation: slice(rot(M)) == rot(slice(M))       (within numerical tol)
// Uniform scale: slice(s*M, s*p) == s * slice(M, p)
// Determinism: slice(M) bytes == slice(M) bytes
```

These catch half the bug classes (absolute-vs-relative coordinates, hardcoded
origins, tolerance scale bugs) with zero knowledge of expected output.

### Assertion tolerances

Property assertions use the tolerance module: geometric comparisons at the
geometric scale, conservation checks at the manufacturing scale, bit-checks
only for determinism. A property that needs a *new* tolerance scale is a
signal to extend the tolerance module, not to inline a literal.

## 5. Golden-test infrastructure

### Corpus governance

```
tests/corpus/
├── thin_wall_overhang/
│   ├── input.stl
│   ├── meta.toml        # feature, degenerate covered, source, date added
│   ├── params.toml      # slice parameters (versioned with the fixture)
│   └── expected/
│       ├── layers.json  # canonical float serialization (ryu)
│       └── stats.json   # cheap-to-diff summary: path counts, lengths, areas
└── ...
```

- Every fixture documents *why it exists* in `meta.toml`. A corpus without
  provenance rots into superstition ("don't touch that fixture, it breaks").
- Prefer small fixtures (< 50k triangles). Goldens exist to pin behavior, not
  to benchmark; large inputs belong in `benches/`.
- Store a `stats.json` summary alongside full output: reviewers read stats
  diffs; the full golden catches what stats miss.

### Comparison helper (one, shared)

```rust
pub struct GoldenDiff { pub max_abs: f64, pub max_rel: f64, pub worst_path: String }

pub fn compare_layers(actual: &[Layer], expected: &[Layer], tol: Tolerance) -> Result<(), GoldenDiff>
```

- Report the *worst* element with its path (`layers[3].paths[7].points[42].z`)
  so a failure is debuggable without diffing megabytes.
- Tolerances from the tolerance module; per-field scales (coordinates vs
  speeds vs temperatures may differ).

### Bless workflow

- `BLESS=1 cargo test --test golden` regenerates; normal runs are read-only.
- CI runs without `BLESS`; a drift is a failure.
- Blessing commits contain only golden changes and are reviewed as behavior
  changes: "this commit changes overhang wall ordering" — if you cannot
  explain the golden diff, the change is not done.

## 6. When f64 is not enough

Symptoms: convergence failures in root-finding, offset curves self-intersecting
on near-parallel inputs, area computations losing 6+ digits.

Escalation ladder (stop at the first rung that works):

1. **Reformulate** — most precision problems are algorithm problems. Compute
   areas via signed triangulation from a local origin, not absolute
   coordinates; intersect in parameter space, not coordinate space.
2. **Compensated arithmetic** — Kahan sums, TwoSum/TwoProd error-free
   transformations (these are exact: they return result + exact error term).
3. **Local origin / snapping** — translate inputs near zero before the
   sensitive computation, translate results back.
4. **Higher precision on the predicate only** — expansion arithmetic or
   `num-bigfloat` for the few scalars feeding branches. Never whole-pipeline
   arbitrary precision; the performance cost is 10–100× and it usually masks a
   formulation bug.

If you reach rung 4 broadly, revisit rung 1 — the algorithm is wrong, not the
arithmetic.
