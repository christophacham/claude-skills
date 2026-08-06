---
name: geometric-robustness
description: "Use when writing or reviewing numeric and geometry-heavy Rust code (slicers, mesh processing, toolpaths, CAD/CAM): floating-point error budgets, robust predicates and constructions, tolerance policy, degenerate topology, deterministic output, affine transforms, property tests, and golden regressions. Covers exact classification of represented coordinates, explicit uncertainty/snap policy, certified constructions, determinism tiers, and authority of invariants over snapshots. Not for general module design, application layering, rendering-only math, or non-numeric code."
---

# Geometric robustness

Robust geometry separates four concerns that are often collapsed into one
`epsilon`: uncertainty in the input model, rounding error in a computation,
topological classification, and acceptable manufacturing deviation. Decide the
contracts for each before choosing arithmetic or tests.

## 1. Default policy

Use these defaults unless the application's error budget proves otherwise:

1. Keep source units and declared input resolution at ingestion. Reject
   non-finite coordinates. Translate sensitive calculations to a local origin so
   rounding depends on local extent rather than a large world-space offset.
2. Use `f64` for CPU geometry kernels. `f32` is allowed at a rendering/GPU or
   storage boundary, or in a kernel with a measured error budget and tests; it is
   not categorically forbidden.
3. Classify topology with a filtered-exact predicate when one exists. A robust
   predicate returns the sign for the *represented input floats*; it does not
   remove measurement uncertainty or define a snap policy.
4. Construct coordinates in `f64` only when the result can be validated. Keep
   topological decisions from the predicate path, check construction residuals,
   and escalate to interval/expansion/rational construction when a result cannot
   be certified.
5. Default determinism target: stable topology and canonical ordering across
   supported platforms, plus bit-identical bytes on a pinned target/toolchain.
   Cross-platform byte identity is a stronger opt-in contract.

## 2. Tolerance architecture

A central policy type owns named tolerances, units, derivation, and intended
uses. It may produce per-operation error bounds; it must not expose one number
called `EPSILON` for every comparison.

| Quantity | Source | Use | Must not decide |
|---|---|---|---|
| **Input uncertainty** | file quantization, scanner/CAD accuracy, unit conversion | whether observations are distinguishable | arithmetic roundoff |
| **Numerical error bound** | formula, operation count, conditioning, local scale | whether an approximate construction/residual is certified | whether two authored features should weld |
| **Geometric snap/weld distance** | product semantics and input uncertainty | intentional canonicalization of nearby entities | predicate sign |
| **Process/manufacturing tolerance** | nozzle, kerf, machine and material behavior | output acceptance and feature viability | mesh topology or float equality |

Rules:

- Derive numerical bounds from forward-error analysis or a tested conservative
  bound such as `k * f64::EPSILON * local_scale`; choose and document `k` per
  algorithm. A fixed fraction of model extent is not a universal numerical
  tolerance.
- For dimensional scalar comparisons, use an explicit absolute-plus-relative
  policy when both terms make sense:
  `|a-b| <= abs_tol + rel_tol * max(|a|, |b|)`. The absolute term carries units;
  the relative term is dimensionless. Relative comparison is not automatically
  better near zero.
- ULP comparisons are useful for tightly controlled arithmetic regressions, not
  for model coincidence or manufacturing acceptance.
- Exact predicate signs are compared with zero exactly. Do not turn a small
  nonzero determinant into zero with a distance epsilon.
- Snapping is an operation with ownership and provenance, not a comparison
  helper. It chooses a canonical representative, records changed entities, and
  has deterministic cluster/tie rules.
- Name tolerance parameters in public contracts (`snap_distance`,
  `construction_bound`, `process_allowance`). Tests import the same policy;
  local magic epsilons are review findings.

## 3. Predicates and degeneracy

Predicates answer discrete questions: orientation, side of plane, in-circle,
intersection classification, ordering. Use a filtered-exact implementation such
as the `robust` crate when its predicate and input assumptions match. Do not
hand-roll a raw cross-product sign on a topology branch.

Exact sign does not mean every case is nondegenerate:

- Zero is a real result and needs a named policy: reject, preserve as a
  lower-dimensional feature, or resolve with deterministic symbolic
  perturbation/tie-breaking. Never choose a branch from hash iteration order.
- Exactness applies to the binary floating-point inputs supplied. If two source
  points are uncertain within a geometric tolerance, resolve that uncertainty
  in ingestion/snap policy before calling the predicate.
- Predicate inputs must use one coordinate frame and consistent orientation.
  Reordering arguments changes signs; encode wrappers with domain names rather
  than scattering positional calls.

If no library predicate matches, prefer: reformulation into known predicates;
then interval arithmetic with a zero-excluding bound; then exact arithmetic for
the small decision expression. Tolerance-based sign guessing is not a fallback.

## 4. Constructions

"Predicates exact, constructions approximate" is safe only with a certification
step. A segment intersection, for example, should:

1. classify endpoint/collinear/proper-intersection cases with robust predicates;
2. choose topology and ownership from that classification;
3. compute parameters/coordinates in a well-conditioned local frame;
4. validate finite values, parameter intervals, and residuals against a
   numerical construction bound; and
5. use a canonical endpoint or escalate arithmetic when validation is
   inconclusive.

Do not recompute topology from the constructed coordinate using approximate
point equality. Do not clamp an invalid parameter and silently continue. If an
approximate construction later becomes input to another topological decision,
either preserve the exact provenance needed by that decision or use an exact/
certified construction representation.

## 5. Boundary policy and kernel invariants

Parsing, validation, and repair are separate stages. Repair is not universally
correct: welding, dropping faces, stitching holes, and changing winding alter
model semantics. Make repair opt-in or product-defined and return a report of
every change.

Use types to express achieved guarantees (`RawMesh`, `FiniteMesh`,
`ManifoldMesh`, `ClosedOrientedMesh`). Boundary validation of untrusted data is a
release-mode `Result`, not only a `debug_assert!`. Kernel assertions then check
postconditions introduced by that kernel operation.

Distinguish normal lower-dimensional outcomes from invalid state. An empty slice
can be valid; a one-point ring usually is not. Return typed degeneracy results
when an algorithm cannot represent a case. Add every production case to the
small regression corpus.

## 6. Determinism tiers

Name the required tier per output instead of promising "deterministic" without a
scope.

| Tier | Contract | Typical checks |
|---|---|---|
| **D0 — topological/canonical** | Same classified topology, stable IDs/order, and numerically equivalent coordinates across supported platforms | exact topology comparison plus field tolerances |
| **D1 — pinned-byte** | Bit-identical output for a pinned target, toolchain, dependencies, build flags, runtime/math implementation, and thread configuration | two-run byte hash in CI and a pinned-build golden |
| **D2 — cross-platform-byte** | Bit-identical bytes across named platforms/toolchains | cross-platform CI hashes; deterministic math/serialization contract |

Default to D0 for in-memory geometry. Require D1 for serialized production output
only when its byte-sensitive path also controls the runtime math implementation;
standard transcendental functions whose precision is explicitly unspecified do
not satisfy D1 merely because the toolchain is pinned. Claim D2 only when it is a
real requirement and the implementation avoids or controls libm differences,
fused operations, target-specific code generation, and dependency drift.

Implementation rules:

- Canonicalize iteration by a domain key. `IndexMap` is deterministic only when
  insertion order is deterministic; collecting from a hash table into it is not
  enough.
- Parallel work may compute independent items concurrently, then sort by stable
  key and reduce in a specified order. A compensated sum improves accuracy but
  does not make an unordered reduction deterministic.
- Define tie-breakers for equal keys and total-order finite floats with
  `total_cmp`; reject NaN before ordering.
- Seed randomized algorithms from explicit input/config and record the seed.
  Do not rely on a hash whose algorithm or serialization is unspecified.
- Canonically serialize units, ordering, signed zero policy, and floats. Pin
  build flags for D1; avoid `target-cpu=native` and fast-math where bytes matter.
- A two-run hash catches within-run nondeterminism only. It does not prove
  cross-platform stability or geometric correctness.

## 7. Transform contracts and metamorphic tests

State whether a function is invariant (same output) or equivariant (output
transforms with input), and transform every frame-dependent parameter.

- Translation equivariance holds only for coordinate-neutral algorithms and when
  planes/origins are translated too. A slicer with fixed world Z layers is not
  equivariant under arbitrary Z translation because layer phase changes.
- Rotation equivariance requires rotating build direction, planes, gravity, and
  anisotropic process parameters. Rotating only the mesh is a different problem.
- Uniform scaling requires scaling every dimensional tolerance and process
  parameter; dimensionless relative tolerances stay unchanged. Non-uniform
  scaling changes distances, angles, circles, and often the algorithm's meaning.
- A reflection or any affine transform with negative determinant reverses
  orientation. Flip winding/sign conventions deliberately.
- For a non-rigid affine transform with an invertible linear part, transform
  normals with the inverse transpose, then renormalize with a certified nonzero
  norm. Singular transforms can collapse the tangent plane; handle collapse
  explicitly or recompute a normal from surviving transformed geometry.
- Compose transforms once where possible. Repeated forward/inverse float
  transforms accumulate error; round-trip assertions use a numerical bound, not
  byte equality.

High-value predicate properties compare **classifications/signs**, not adaptive
predicate magnitudes: swapping two orientation arguments reverses the sign.
Translation and positive-scale sign preservation require the transform to preserve
coordinate distinctions in the represented type, or to be performed in an exact
representation before conversion. High-value construction properties include
endpoint symmetry, residual bounds, and permutation-invariant topology.

## 8. Property and regression testing

Generate structured valid inputs, then perturb toward degeneracy. Random point
clouds rarely shrink into useful geometry. Keep separate strategies for exact
zero, near-zero on each side, extreme scale, large coordinate offset, and each
supported repair class. Persist minimized failures as explicit tests.

Choose invariants that are true for the operation's preconditions:

- all constructed coordinates are finite and certified;
- topology indices are valid and canonical ordering is stable;
- a closed transverse slice produces closed rings, while documented tangent or
  coplanar cases produce their specified degeneracy result;
- segment intersection classification is symmetric under segment exchange;
- serialize/parse preserves the declared representation contract;
- D0/D1 checks match the output's named determinism tier; and
- toolpath centerlines and clearance envelopes satisfy the product's printable-
  region and collision rules. An additive toolpath is not expected to avoid the
  model volume itself.

Do not assert that arbitrary sliced area is monotone with height, that every
slice vertex always has degree two without degeneracy preconditions, or that a
mesh-only rotation/translation must preserve a world-fixed slicing result.

## 9. Golden authority

The authority order is:

1. specification and documented preconditions/postconditions;
2. mathematical/metamorphic invariants and independent reference oracles;
3. reviewed golden outputs as regression evidence.

A golden records prior behavior; it does not prove that behavior correct. When a
golden conflicts with a valid invariant, investigate and fix the implementation
or the fixture—do not weaken the invariant merely to preserve the snapshot.

Compare topology, identifiers, and ordering exactly. Compare numeric fields with
the field's declared test tolerance unless the output contract is D1/D2 bytes.
Use one comparison helper that reports the worst path, absolute error, relative
error, and tolerance source. Canonical serialization makes diffs reviewable but
does not justify byte equality across unpinned platforms.

Blessing is explicit and read-only by default. A blessing change includes the
reason, invariant/oracle evidence, parameter and policy versions, and a reviewed
diff. Never let the implementation under test silently regenerate its own
expected result during a normal run.

## 10. Rust review defaults

| Concern | Default review question |
|---|---|
| Scalar type | Is `f64` sufficient under a stated bound? Is any `f32` boundary explicit? |
| Predicate | Is branch sign robust for represented inputs, including exact zero policy? |
| Construction | Is the approximate result finite and certified, or escalated? |
| Tolerance | Which named policy quantity applies, with units and derivation? |
| Parallelism | Is output keyed, sorted, and reduced in a specified order? |
| Transform | Were frame-dependent parameters, winding, and normals handled? |
| Test | Does it assert a real invariant and the declared determinism tier? |
| Golden | What higher authority justifies this expected change? |

Read [references/reference.md](references/reference.md) for predicate limits,
certified intersection patterns, tolerance derivation, transform test matrices,
and golden governance. Review by naming the violated contract and proposing the
smallest change that restores it.
