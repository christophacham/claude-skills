# Geometric robustness — reference

Load only the section needed. The policy summary and review defaults are in
`SKILL.md`.

## 1. What filtered-exact predicates guarantee

A predicate such as `orient2d(a, b, c)` returns the sign of a determinant.
Straight `f64` evaluation can return the wrong sign after cancellation. Adaptive
predicates first evaluate a fast approximation with a proven error bound and
escalate when the bound includes zero.

The guarantee is exact sign for the binary floating-point coordinates supplied
to the predicate. Those coordinates are exact dyadic rationals; they are not the
unknown mathematical points that existed before measurement, decimal parsing,
unit conversion, or earlier approximate construction. Keep these questions
separate:

- **Arithmetic ambiguity:** can the sign of the represented floats be computed?
  Filtered-exact predicates solve this.
- **Input uncertainty:** could the source point lie on either side within its
  accuracy/quantization? Product policy solves this before topology.
- **True degeneracy:** is the exact determinant zero? The algorithm needs a
  documented zero/tie policy.

The Rust `robust` crate provides common Shewchuk-style predicates. Verify its API,
argument orientation, dimensions, and coordinate type for the operation at hand.
A wrapper with domain names is safer than positional calls scattered through the
kernel.

When no predicate matches:

1. Reformulate into a composition of supported orientation/in-circle predicates.
2. Evaluate an interval; if it excludes zero, the sign is certified.
3. Escalate the decision expression to expansion or rational arithmetic.
4. If exact zero remains, apply the algorithm's degeneracy or symbolic-
   perturbation policy.

Never substitute `abs(det) < epsilon` for this ladder.

## 2. Numerical error bounds and tolerances

Machine epsilon for `f64` is about `2^-52`; unit roundoff is about `2^-53`.
Neither number is a geometry tolerance. A useful numerical bound has:

- an operation/formula whose error is being bounded;
- a local dimensional scale;
- a conditioning assumption or a branch for ill-conditioned cases; and
- a conservative factor justified by analysis or differential testing.

Prefer local coordinates. Subtracting nearby points around world coordinate
`1e12` has already lost detail before an orientation or intersection formula
runs. Translate to a local origin, compute, then translate the constructed result
back. A robust predicate can recover the sign of the rounded inputs, but cannot
recover bits lost while forming those inputs.

### Absolute plus relative comparison

For values with the same units:

```text
abs(a - b) <= abs_tol + rel_tol * max(abs(a), abs(b))
```

`abs_tol` carries the value's units and handles values near zero. `rel_tol` is
dimensionless and handles scale. Select each from the contract; do not set both
to a generic `1e-6`. For vectors, state whether the norm is Euclidean,
component-wise, or a conservative infinity norm.

### Summation

Canonical order provides reproducibility. Pairwise or compensated summation
provides accuracy. They solve different problems and often should be combined:

```rust
fn neumaier_sum(values: impl IntoIterator<Item = f64>) -> f64 {
    let mut sum = 0.0;
    let mut correction = 0.0;
    for x in values {
        let next = sum + x;
        correction += if sum.abs() >= x.abs() {
            (sum - next) + x
        } else {
            (x - next) + sum
        };
        sum = next;
    }
    sum + correction
}
```

Sort or otherwise fix the input order before calling it when deterministic bytes
matter.

## 3. Predicate plus certified construction

A robust line/segment intersection should not infer event topology from the
rounded intersection point. One useful structure is:

```text
classify(a,b,c,d)
  -> Disjoint
   | Endpoint { canonical_endpoint }
   | Collinear { overlap_order }
   | Proper { exact_sign_provenance }

construct(Proper, a,b,c,d)
  -> CertifiedPoint { point, parameter_bounds, residual_bound }
   | NeedsHigherPrecision
```

For a proper intersection:

1. Translate to a nearby endpoint or bounding-box origin.
2. Compute parameters using a formulation whose denominator sign/nonzero state
   came from the predicate classification.
3. Evaluate parameter intervals and line residuals. Account for operation error,
   not snap distance.
4. Accept only if the point is finite, parameters satisfy the classified domain,
   and residual intervals meet the construction bound.
5. Escalate if the intervals straddle a required boundary. Do not clamp to make
   the result fit.

Endpoint cases use the canonical input endpoint rather than constructing a near
copy. Collinear overlap is an ordering problem; project onto a dominant axis
chosen deterministically and compare with robust/order-aware logic.

If later topology depends on a constructed point, preserve provenance (which
curves/segments and parameters define it), use an exact construction, or run a
predicate representation designed for constructed values. Re-running a robust
predicate on already-rounded construction coordinates certifies those rounded
coordinates, not the intended exact intersection.

## 4. Degenerate input and repair

Repair changes geometry. Make each operation conditional on a product policy and
record before/after counts, maximum displacement, and affected IDs.

| Case | Classification | Possible policy (not universal) |
|---|---|---|
| Duplicate observations | input uncertainty / snap distance | deterministic clustering and representative choice |
| Exact duplicate vertex | representation redundancy | deduplicate while preserving provenance |
| Zero-area face | robust collinearity plus construction/area contract | reject, retain lower-dimensional feature, or drop with report |
| Non-manifold edge | topological validation | reject or split by a documented fan policy |
| Inconsistent winding | component adjacency/orientability | orient an orientable component; reject contradictions |
| Boundary loop | open-shell topology | accept surface input, stitch within explicit policy, or reject closed-solid contract |
| Self-intersection | robust pair classification | report/reject unless product owns a semantic repair algorithm |
| Sliver | quality metric, not one epsilon | preserve, remesh, or reject under downstream conditioning limits |
| Coplanar/tangent slice | exact event classification | deterministic half-open/event ownership rule |

A defensible staged pipeline is:

```text
parse + units
  -> reject non-finite/out-of-range data
  -> classify topology and uncertainty
  -> optional policy-owned repair with report
  -> validate target type guarantees
  -> construct FiniteMesh / ManifoldMesh / ClosedOrientedMesh
```

Do not name a type `Mesh` and silently assume every caller received the strongest
guarantees.

## 5. Determinism engineering

### Stable identities and ordering

Choose canonical keys from domain data, not allocation address, thread completion
order, default hash state, or an approximate coordinate string. Equal primary
keys need a stable secondary key. Canonicalize signed zero if the format treats
`-0.0` and `0.0` as equivalent.

`BTreeMap` orders by its key. `IndexMap` preserves insertion order, which is only
helpful if insertion was deterministic. `f64::total_cmp` gives a total ordering
including NaNs; a geometry kernel should reject NaN first rather than legitimizing
it as a coordinate.

### Parallelism

A deterministic pattern is:

```text
parallel map independent input shards
  -> collect (completion order irrelevant)
  -> sort by canonical domain key
  -> sequential or fixed-tree reduction
  -> canonical serialization
```

Parallel fold/reduce with float addition is not deterministic because grouping
changes rounding. Kahan/Neumaier compensation reduces error but does not make
arbitrary grouping identical.

### Platform math

IEEE-754 basic operations still permit differences from contraction/FMA,
extended intermediates, target features, compiler flags, and dependency/libm
implementations. Transcendentals are not promised bit-identical by IEEE-754
across arbitrary libraries. D2 output may require a pinned deterministic math
implementation, disabled contraction, fixed target features, integer/fixed-point
representation for selected quantities, and cross-platform hash CI.

Test each tier directly. Running twice on one machine checks only a subset of D1.

## 6. Transform test matrix

For a function `F(input, parameters, frame)`, write the transformed relation
before generating cases:

```text
F(T(input), T(parameters), T(frame)) ~= T(F(input, parameters, frame))
```

Then decide what `T` means for every item.

| Transform | Required accompanying changes | Common false property |
|---|---|---|
| XY translation | translate XY origins/regions | assuming large world offsets do not affect un-localized arithmetic |
| Z translation | translate slice-plane origin/layer phase | slicing translated mesh at unchanged world layers |
| Rigid rotation | rotate planes, build direction, gravity, anisotropic axes | rotate mesh only and expect same toolpath |
| Positive uniform scale | scale all lengths, absolute tolerances, layer/nozzle/kerf params | scaling coordinates but not process params |
| Non-uniform affine | for an invertible linear part, inverse-transpose normals; otherwise handle collapse/recompute; reassess distance/angle semantics | treating circles/offset radii as unchanged |
| Reflection | reverse orientation/winding policy | expecting predicate signs to stay equal |

Useful tests:

- Predicate translation and positive-scale sign preservation only when the
  transformation preserves coordinate distinctions in the represented type (or
  is performed exactly before conversion).
- Predicate argument-swap antisymmetry compares classifications/signs, not the
  full floating return magnitude of an adaptive predicate implementation.
- Construction permutation symmetry: swapping segments changes ownership labels
  as documented but not geometric event.
- Forward/inverse transform residual bounded by an operation-derived numerical
  tolerance.
- For an invertible affine linear part, a normal remains perpendicular to
  transformed tangents and finite after inverse-transpose normalization; singular
  transforms follow an explicit collapse or recomputation contract.

Do not use arbitrary rotations as a slicer invariant unless the slicing frame and
all manufacturing axes rotate too.

## 7. Property strategies

Generate topology first and coordinates second so shrinking preserves meaningful
preconditions. For each operation, keep separate families:

- ordinary well-conditioned valid inputs;
- exact degeneracies (zero determinant, coincident endpoint, coplanarity);
- near-degeneracies on both signs, expressed in ULPs and domain units;
- large translation with small local extent;
- extreme but supported scale and unit conversion;
- every supported transform class; and
- repaired versus unrepaired variants with an expected repair report.

Persist the minimized input, policy/config, seed, and expected classification.
A raw RNG seed alone is fragile when a generator changes.

Prefer algebraic properties with explicit preconditions. Examples:

```text
sign(orient(a,b,c)) == -sign(orient(b,a,c))
intersect(a,b,c,d).topology == intersect(c,d,a,b).topology (modulo ownership)
parse(serialize(x)) == x under the representation contract
canonicalize(canonicalize(x)) == canonicalize(x)
```

For slicers/toolpaths, derive properties from product semantics: printable-region
containment, closed rings for transverse closed-solid intersections, extrusion
volume consistency under the bead model, and collision clearance of the nozzle
envelope. Avoid universal area monotonicity or "path never enters model volume."

## 8. Golden governance

A fixture should include source/provenance, units, parameters, tolerance-policy
version, determinism tier, feature/degeneracy covered, and why it exists. Keep a
small independently readable summary beside large structured output.

Comparison order:

1. Validate structure and invariants on the actual output.
2. Compare exact topology/IDs/order required by the contract.
3. Compare numeric fields with named per-field tolerances and report the worst
   path and bound.
4. Compare bytes only for a D1/D2 artifact in its declared environment.

An implementation cannot be its own correctness oracle. A bless run may capture
new behavior, but acceptance requires invariant/spec reasoning or an independent
reference. Reviewers should be able to answer:

- Which higher-level rule says the new result is correct?
- Did topology change or only coordinates?
- Which tolerance and determinism tier apply?
- Is the change caused by policy/config/toolchain drift?
- What regression would this fixture catch in the future?

Normal tests never write expected files. Blessing is an explicit command or env
mode, produces a reviewable diff, and records the justification with the change.
