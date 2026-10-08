/// Geometric tolerance constants for the NEXUS kernel.
///
/// Tiered by operation type — different operations need different precision.
/// Values based on cross-referencing Manifold (1e-12 base), Cadmium (1e-10),
/// and web-ifc (multi-tier). See docs/research/findings/13-sprint8-vendor-deep-dive.md.
/// Two points are considered the same location.
/// Used in: coincident constraints, snap detection, degenerate entity rejection.
pub const POINT_COINCIDENCE: f64 = 1e-8;

/// A segment/edge is considered zero-length (degenerate).
/// Used in: offset normal calculation, mirror axis validation, constraint zero-checks.
pub const ZERO_LENGTH: f64 = 1e-10;

/// Denominator too close to zero in intersection/division.
/// Used in: line-line intersection, parallel detection.
pub const PARALLEL_DENOMINATOR: f64 = 1e-12;

/// Parameter t/u range extension for line segment intersection.
/// Allows intersection detection slightly beyond segment endpoints.
pub const PARAMETER_EXTENSION: f64 = 1e-9;

/// Constraint solver convergence threshold.
/// Solver stops when max constraint error is below this value.
pub const SOLVER_CONVERGENCE: f64 = 1e-6;

/// Constraint zero-length guard.
/// When computing constraint corrections, skip if reference length is below this.
pub const CONSTRAINT_ZERO_LENGTH: f64 = 1e-10;
