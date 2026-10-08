use crate::entity::{GeometryType, Point2D};
use crate::tolerance;
use std::f64::consts::{FRAC_PI_2, PI};

const TWO_PI: f64 = 2.0 * PI;
const QUADRANT_ANGLES: [f64; 4] = [0.0, FRAC_PI_2, PI, 3.0 * FRAC_PI_2];

pub fn circle_quadrant_points(cx: f64, cy: f64, radius: f64) -> [Point2D; 4] {
    [
        Point2D::new(cx + radius, cy),
        Point2D::new(cx, cy + radius),
        Point2D::new(cx - radius, cy),
        Point2D::new(cx, cy - radius),
    ]
}

fn normalize_angle(a: f64) -> f64 {
    let mut a = a % TWO_PI;
    if a < 0.0 {
        a += TWO_PI;
    }
    a
}

fn angle_in_arc(angle: f64, start_angle: f64, end_angle: f64) -> bool {
    let span = (end_angle - start_angle).abs();
    if span >= TWO_PI - 1e-10 {
        return true;
    }
    let a = normalize_angle(angle);
    let sa = normalize_angle(start_angle);
    let ea = normalize_angle(end_angle);
    if sa <= ea {
        a >= sa && a <= ea
    } else {
        a >= sa || a <= ea
    }
}

pub fn arc_quadrant_points(
    cx: f64,
    cy: f64,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Vec<Point2D> {
    QUADRANT_ANGLES
        .iter()
        .filter(|&&qa| angle_in_arc(qa, start_angle, end_angle))
        .map(|&qa| Point2D::new(cx + radius * qa.cos(), cy + radius * qa.sin()))
        .collect()
}

pub fn ellipse_quadrant_points(
    cx: f64,
    cy: f64,
    semi_major: f64,
    semi_minor: f64,
    rotation: f64,
) -> [Point2D; 4] {
    let cos_r = rotation.cos();
    let sin_r = rotation.sin();
    let local = [
        (semi_major, 0.0),
        (-semi_major, 0.0),
        (0.0, semi_minor),
        (0.0, -semi_minor),
    ];
    [
        Point2D::new(
            cx + local[0].0 * cos_r - local[0].1 * sin_r,
            cy + local[0].0 * sin_r + local[0].1 * cos_r,
        ),
        Point2D::new(
            cx + local[1].0 * cos_r - local[1].1 * sin_r,
            cy + local[1].0 * sin_r + local[1].1 * cos_r,
        ),
        Point2D::new(
            cx + local[2].0 * cos_r - local[2].1 * sin_r,
            cy + local[2].0 * sin_r + local[2].1 * cos_r,
        ),
        Point2D::new(
            cx + local[3].0 * cos_r - local[3].1 * sin_r,
            cy + local[3].0 * sin_r + local[3].1 * cos_r,
        ),
    ]
}

#[derive(Debug, Clone, PartialEq)]
pub struct PerpendicularResult {
    pub x: f64,
    pub y: f64,
    pub valid: bool,
}

pub fn perpendicular_to_line(
    from: &Point2D,
    line_start: &Point2D,
    line_end: &Point2D,
) -> PerpendicularResult {
    let dx = line_end.x - line_start.x;
    let dy = line_end.y - line_start.y;
    let len_sq = dx * dx + dy * dy;

    if len_sq < tolerance::ZERO_LENGTH * tolerance::ZERO_LENGTH {
        return PerpendicularResult {
            x: line_start.x,
            y: line_start.y,
            valid: false,
        };
    }

    let t = ((from.x - line_start.x) * dx + (from.y - line_start.y) * dy) / len_sq;
    let t_clamped = t.clamp(0.0, 1.0);

    let foot_x = line_start.x + t_clamped * dx;
    let foot_y = line_start.y + t_clamped * dy;

    // Verify perpendicularity: dot product of (foot - from) and (line direction) should be ~0
    // If t was clamped, the foot is at an endpoint and may not be truly perpendicular
    let is_perpendicular = (t - t_clamped).abs() < tolerance::PARAMETER_EXTENSION;

    PerpendicularResult {
        x: foot_x,
        y: foot_y,
        valid: is_perpendicular,
    }
}

pub fn perpendicular_to_circle(
    from: &Point2D,
    center: &Point2D,
    radius: f64,
) -> Vec<PerpendicularResult> {
    let dx = center.x - from.x;
    let dy = center.y - from.y;
    let dist = (dx * dx + dy * dy).sqrt();

    if dist < tolerance::ZERO_LENGTH {
        return vec![];
    }

    let ux = dx / dist;
    let uy = dy / dist;

    // Two perpendicular points: near side and far side of circle from `from`
    vec![
        PerpendicularResult {
            x: center.x - ux * radius,
            y: center.y - uy * radius,
            valid: true,
        },
        PerpendicularResult {
            x: center.x + ux * radius,
            y: center.y + uy * radius,
            valid: true,
        },
    ]
}

pub fn perpendicular_to_arc(
    from: &Point2D,
    center: &Point2D,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Vec<PerpendicularResult> {
    let candidates = perpendicular_to_circle(from, center, radius);
    let two_pi = std::f64::consts::TAU;

    candidates
        .into_iter()
        .filter(|p| {
            let mut angle = (p.y - center.y).atan2(p.x - center.x);
            if angle < 0.0 {
                angle += two_pi;
            }
            let mut sa = start_angle % two_pi;
            let mut ea = end_angle % two_pi;
            if sa < 0.0 {
                sa += two_pi;
            }
            if ea < 0.0 {
                ea += two_pi;
            }
            if sa <= ea {
                angle >= sa && angle <= ea
            } else {
                angle >= sa || angle <= ea
            }
        })
        .collect()
}

#[derive(Debug, Clone, PartialEq)]
pub struct TangentResult {
    pub x: f64,
    pub y: f64,
}

/// Tangent points on a circle from an external point.
///
/// Returns 0/1/2 candidates:
/// - 0 if `from` is inside the circle (no tangent line exists),
/// - 1 if `from` lies on the circle (the tangent at the from-point itself),
/// - 2 if `from` is outside the circle (the two symmetric tangent points).
pub fn tangent_to_circle(from: &Point2D, center: &Point2D, radius: f64) -> Vec<TangentResult> {
    if !radius.is_finite() || radius <= tolerance::ZERO_LENGTH {
        return vec![];
    }
    let dx = from.x - center.x;
    let dy = from.y - center.y;
    let d_sq = dx * dx + dy * dy;
    let r_sq = radius * radius;

    // Inside circle: no tangent line passes through `from` and touches the circle.
    if d_sq < r_sq - tolerance::POINT_COINCIDENCE {
        return vec![];
    }

    let d = d_sq.sqrt();

    // On circle (within tolerance): the tangent line touches the circle at `from` itself.
    if (d - radius).abs() < tolerance::POINT_COINCIDENCE {
        return vec![TangentResult {
            x: from.x,
            y: from.y,
        }];
    }

    // Outside circle: two tangent points.
    // Derivation (place C at origin, P at (d, 0) WLOG):
    //   Local tangent points T are at (r²/d, ± r·sqrt(d²-r²)/d).
    // Re-expressed in world coords with v = P − C, |v| = d:
    //   T_± = C + (r²/d²)·v + (± r·sqrt(d²-r²)/d²)·perp(v)
    // where perp(v) = (−v.y, v.x).
    let inv_d_sq = 1.0 / d_sq;
    let h = (d_sq - r_sq).sqrt();
    let base_x = center.x + r_sq * dx * inv_d_sq;
    let base_y = center.y + r_sq * dy * inv_d_sq;
    let off_x = radius * h * dy * inv_d_sq;
    let off_y = radius * h * dx * inv_d_sq;

    vec![
        TangentResult {
            x: base_x - off_x,
            y: base_y + off_y,
        },
        TangentResult {
            x: base_x + off_x,
            y: base_y - off_y,
        },
    ]
}

/// Tangent points on an arc — same as circle, filtered by the arc's angular range.
pub fn tangent_to_arc(
    from: &Point2D,
    center: &Point2D,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Vec<TangentResult> {
    tangent_to_circle(from, center, radius)
        .into_iter()
        .filter(|t| {
            angle_in_arc(
                (t.y - center.y).atan2(t.x - center.x),
                start_angle,
                end_angle,
            )
        })
        .collect()
}

pub fn find_tangent_snap(
    cursor: &Point2D,
    from_point: Option<&Point2D>,
    geometry: &GeometryType,
    threshold: f64,
) -> Option<TangentResult> {
    let from = from_point?;
    let mut best: Option<TangentResult> = None;
    let mut best_dist = threshold;

    let mut check = |result: TangentResult| {
        let dx = cursor.x - result.x;
        let dy = cursor.y - result.y;
        let d = (dx * dx + dy * dy).sqrt();
        if d < best_dist {
            best_dist = d;
            best = Some(result);
        }
    };

    match geometry {
        GeometryType::Circle { center, radius } => {
            for t in tangent_to_circle(from, center, *radius) {
                check(t);
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            for t in tangent_to_arc(from, center, *radius, *start_angle, *end_angle) {
                check(t);
            }
        }
        _ => {}
    }

    best
}

/// Centroid of a closed polygon described by an ordered vertex list.
///
/// Uses the shoelace centroid formula:
///
///   A  = ½ · Σᵢ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)
///   Cx = (1/(6A)) · Σᵢ (xᵢ + xᵢ₊₁) · (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)
///   Cy = (1/(6A)) · Σᵢ (yᵢ + yᵢ₊₁) · (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)
///
/// Returns `None` for degenerate input (fewer than 3 vertices, or
/// total signed area below `tolerance::ZERO_LENGTH` — collinear points).
/// Vertex winding (CW vs CCW) flips the sign of A but cancels out in
/// the division, so the centroid is winding-independent.
pub fn geometric_center_of_polygon(vertices: &[Point2D]) -> Option<Point2D> {
    if vertices.len() < 3 {
        return None;
    }
    let n = vertices.len();
    let mut a2 = 0.0f64; // 2·A
    let mut cx = 0.0f64;
    let mut cy = 0.0f64;
    for i in 0..n {
        let p = &vertices[i];
        let q = &vertices[(i + 1) % n];
        let cross = p.x * q.y - q.x * p.y;
        a2 += cross;
        cx += (p.x + q.x) * cross;
        cy += (p.y + q.y) * cross;
    }
    if a2.abs() < tolerance::ZERO_LENGTH {
        return None;
    }
    let inv_6a = 1.0 / (3.0 * a2);
    Some(Point2D::new(cx * inv_6a, cy * inv_6a))
}

/// Top-level geometric-center snap — returns the centroid of a closed
/// shape if it lies within `threshold` of the cursor.
///
/// Per AutoCAD GCEN: applies to closed polylines, regions, hatches,
/// and trivially to circles / ellipses (center == centroid) and
/// rectangles (origin + half-extents). Open shapes return `None`.
pub fn find_geometric_center_snap(
    cursor: &Point2D,
    geometry: &GeometryType,
    threshold: f64,
) -> Option<Point2D> {
    let centroid = match geometry {
        GeometryType::Circle { center, .. } => Some(center.clone()),
        GeometryType::Ellipse { center, .. } => Some(center.clone()),
        GeometryType::Rectangle {
            origin,
            width,
            height,
            ..
        } => Some(Point2D::new(
            origin.x + width / 2.0,
            origin.y + height / 2.0,
        )),
        GeometryType::Polyline { vertices, closed } if *closed => {
            geometric_center_of_polygon(vertices)
        }
        _ => None,
    }?;
    let dx = cursor.x - centroid.x;
    let dy = cursor.y - centroid.y;
    if (dx * dx + dy * dy).sqrt() < threshold {
        Some(centroid)
    } else {
        None
    }
}

/// Projection of `cursor` onto the line `(line_start, line_end)` extended
/// beyond either endpoint. Returns `None` when:
/// - the line is degenerate (zero length), or
/// - the projection lies on the segment itself (parameter t in [0, 1] —
///   that is the on-segment perpendicular foot, not an extension).
///
/// Parametric form: any point on the line is `start + t·(end−start)`.
/// `t < 0` → projection beyond `start`; `t > 1` → projection beyond `end`.
/// Both belong to the line's extension and are valid Extension snap candidates.
pub fn extension_of_line(
    cursor: &Point2D,
    line_start: &Point2D,
    line_end: &Point2D,
) -> Option<Point2D> {
    let dx = line_end.x - line_start.x;
    let dy = line_end.y - line_start.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq < tolerance::ZERO_LENGTH * tolerance::ZERO_LENGTH {
        return None;
    }
    let t = ((cursor.x - line_start.x) * dx + (cursor.y - line_start.y) * dy) / len_sq;
    // Strictly outside [0, 1] — the on-segment foot is handled by perpendicular,
    // not Extension. Use POINT_COINCIDENCE to keep the segment endpoint behavior
    // (t == 0 or t == 1) under the perpendicular path.
    if (-tolerance::POINT_COINCIDENCE..=1.0 + tolerance::POINT_COINCIDENCE).contains(&t) {
        return None;
    }
    Some(Point2D::new(line_start.x + t * dx, line_start.y + t * dy))
}

/// Top-level extension snap. Currently applies to `Line` only; open polylines
/// could be supported by extending only the first and last segments (interior
/// segments have continuations rather than free ends), but that's a follow-up.
pub fn find_extension_snap(
    cursor: &Point2D,
    geometry: &GeometryType,
    threshold: f64,
) -> Option<Point2D> {
    let foot = match geometry {
        GeometryType::Line { start, end } => extension_of_line(cursor, start, end),
        _ => None,
    }?;
    let dx = cursor.x - foot.x;
    let dy = cursor.y - foot.y;
    if (dx * dx + dy * dy).sqrt() < threshold {
        Some(foot)
    } else {
        None
    }
}

pub fn find_perpendicular_snap(
    cursor: &Point2D,
    from_point: Option<&Point2D>,
    geometry: &GeometryType,
    threshold: f64,
) -> Option<PerpendicularResult> {
    let source = from_point.unwrap_or(cursor);
    let mut best: Option<PerpendicularResult> = None;
    let mut best_dist = threshold;

    let mut check = |result: PerpendicularResult| {
        if !result.valid {
            return;
        }
        let dx = cursor.x - result.x;
        let dy = cursor.y - result.y;
        let d = (dx * dx + dy * dy).sqrt();
        if d < best_dist {
            best_dist = d;
            best = Some(result);
        }
    };

    match geometry {
        GeometryType::Line { start, end } => {
            let result = perpendicular_to_line(source, start, end);
            check(result);
        }
        GeometryType::Circle { center, radius } => {
            for result in perpendicular_to_circle(source, center, *radius) {
                check(result);
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            for result in perpendicular_to_arc(source, center, *radius, *start_angle, *end_angle) {
                check(result);
            }
        }
        GeometryType::Polyline {
            vertices, closed, ..
        } => {
            let n = vertices.len();
            if n >= 2 {
                let limit = if *closed { n } else { n - 1 };
                for i in 0..limit {
                    let j = (i + 1) % n;
                    let result = perpendicular_to_line(source, &vertices[i], &vertices[j]);
                    check(result);
                }
            }
        }
        GeometryType::Rectangle {
            origin,
            width,
            height,
            ..
        } => {
            let corners = [
                Point2D::new(origin.x, origin.y),
                Point2D::new(origin.x + width, origin.y),
                Point2D::new(origin.x + width, origin.y + height),
                Point2D::new(origin.x, origin.y + height),
            ];
            for i in 0..4 {
                let j = (i + 1) % 4;
                let result = perpendicular_to_line(source, &corners[i], &corners[j]);
                check(result);
            }
        }
        _ => {}
    }

    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn perpendicular_foot_on_horizontal_line() {
        let from = Point2D::new(5.0, 3.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        let result = perpendicular_to_line(&from, &start, &end);
        assert!(result.valid);
        assert!((result.x - 5.0).abs() < 1e-9);
        assert!((result.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_foot_on_vertical_line() {
        let from = Point2D::new(3.0, 5.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(0.0, 10.0);
        let result = perpendicular_to_line(&from, &start, &end);
        assert!(result.valid);
        assert!((result.x - 0.0).abs() < 1e-9);
        assert!((result.y - 5.0).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_foot_on_diagonal_line() {
        let from = Point2D::new(0.0, 2.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(2.0, 2.0);
        let result = perpendicular_to_line(&from, &start, &end);
        assert!(result.valid);
        assert!((result.x - 1.0).abs() < 1e-9);
        assert!((result.y - 1.0).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_foot_clamped_to_start() {
        let from = Point2D::new(-5.0, 3.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        let result = perpendicular_to_line(&from, &start, &end);
        // t would be negative, clamped to 0 -> not truly perpendicular
        assert!(!result.valid);
        assert!((result.x - 0.0).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_to_circle_basic() {
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let radius = 5.0;
        let results = perpendicular_to_circle(&from, &center, radius);
        assert_eq!(results.len(), 2);
        // Near side: (5, 0)
        assert!((results[0].x - 5.0).abs() < 1e-9);
    }

    mod quadrant_tests {
        use super::*;

        const EPS: f64 = 1e-10;

        fn approx_eq(a: f64, b: f64) -> bool {
            (a - b).abs() < EPS
        }

        #[test]
        fn test_circle_quadrant_points() {
            let pts = circle_quadrant_points(0.0, 0.0, 5.0);
            assert!(approx_eq(pts[0].x, 5.0) && approx_eq(pts[0].y, 0.0));
            assert!(approx_eq(pts[1].x, 0.0) && approx_eq(pts[1].y, 5.0));
            assert!(approx_eq(pts[2].x, -5.0) && approx_eq(pts[2].y, 0.0));
            assert!(approx_eq(pts[3].x, 0.0) && approx_eq(pts[3].y, -5.0));
        }

        #[test]
        fn test_circle_quadrant_points_offset_center() {
            let pts = circle_quadrant_points(10.0, 20.0, 3.0);
            assert!(approx_eq(pts[0].x, 13.0) && approx_eq(pts[0].y, 20.0));
            assert!(approx_eq(pts[1].x, 10.0) && approx_eq(pts[1].y, 23.0));
            assert!(approx_eq(pts[2].x, 7.0) && approx_eq(pts[2].y, 20.0));
            assert!(approx_eq(pts[3].x, 10.0) && approx_eq(pts[3].y, 17.0));
        }

        #[test]
        fn test_arc_quadrant_all_in_range() {
            let pts = arc_quadrant_points(0.0, 0.0, 5.0, 0.0, TWO_PI);
            assert_eq!(pts.len(), 4);
        }

        #[test]
        fn test_arc_quadrant_first_quadrant_only() {
            let pts = arc_quadrant_points(0.0, 0.0, 5.0, 0.0, FRAC_PI_2);
            assert_eq!(pts.len(), 2);
            assert!(approx_eq(pts[0].x, 5.0) && approx_eq(pts[0].y, 0.0));
            assert!(approx_eq(pts[1].x, 0.0) && approx_eq(pts[1].y, 5.0));
        }

        #[test]
        fn test_arc_quadrant_wrapping_arc() {
            // Arc from 270deg to 90deg (wraps around 0)
            let pts = arc_quadrant_points(0.0, 0.0, 5.0, 3.0 * FRAC_PI_2, FRAC_PI_2);
            assert_eq!(pts.len(), 3);
        }

        #[test]
        fn test_arc_quadrant_no_points() {
            // Arc from 10deg to 80deg — no quadrant angles in this range
            let pts = arc_quadrant_points(0.0, 0.0, 5.0, 0.175, 1.396);
            assert_eq!(pts.len(), 0);
        }

        #[test]
        fn test_ellipse_quadrant_points_no_rotation() {
            let pts = ellipse_quadrant_points(0.0, 0.0, 10.0, 5.0, 0.0);
            assert!(approx_eq(pts[0].x, 10.0) && approx_eq(pts[0].y, 0.0));
            assert!(approx_eq(pts[1].x, -10.0) && approx_eq(pts[1].y, 0.0));
            assert!(approx_eq(pts[2].x, 0.0) && approx_eq(pts[2].y, 5.0));
            assert!(approx_eq(pts[3].x, 0.0) && approx_eq(pts[3].y, -5.0));
        }

        #[test]
        fn test_ellipse_quadrant_points_with_rotation() {
            let pts = ellipse_quadrant_points(0.0, 0.0, 10.0, 5.0, FRAC_PI_2);
            // Rotated 90deg: semi-major now points up, semi-minor points left
            assert!(approx_eq(pts[0].x, 0.0) && approx_eq(pts[0].y, 10.0));
            assert!(approx_eq(pts[1].x, 0.0) && approx_eq(pts[1].y, -10.0));
            assert!(approx_eq(pts[2].x, -5.0) && approx_eq(pts[2].y, 0.0));
            assert!(approx_eq(pts[3].x, 5.0) && approx_eq(pts[3].y, 0.0));
        }

        #[test]
        fn test_ellipse_quadrant_points_offset_center() {
            let pts = ellipse_quadrant_points(5.0, 5.0, 4.0, 2.0, 0.0);
            assert!(approx_eq(pts[0].x, 9.0) && approx_eq(pts[0].y, 5.0));
            assert!(approx_eq(pts[1].x, 1.0) && approx_eq(pts[1].y, 5.0));
            assert!(approx_eq(pts[2].x, 5.0) && approx_eq(pts[2].y, 7.0));
            assert!(approx_eq(pts[3].x, 5.0) && approx_eq(pts[3].y, 3.0));
        }
    }

    #[test]
    fn perpendicular_to_circle_diagonal() {
        let from = Point2D::new(10.0, 10.0);
        let center = Point2D::new(0.0, 0.0);
        let radius = 5.0;
        let results = perpendicular_to_circle(&from, &center, radius);
        assert_eq!(results.len(), 2);
        let expected_near = 5.0 / 2.0_f64.sqrt();
        assert!((results[0].x - expected_near).abs() < 1e-9);
        assert!((results[0].y - expected_near).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_to_arc_within_range() {
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let radius = 5.0;
        // Arc from -90deg to 90deg (right half)
        let start_angle = -std::f64::consts::FRAC_PI_2;
        let end_angle = std::f64::consts::FRAC_PI_2;
        let results = perpendicular_to_arc(&from, &center, radius, start_angle, end_angle);
        // Near point (5,0) is within arc range, far point (-5,0) is not
        assert_eq!(results.len(), 1);
        assert!((results[0].x - 5.0).abs() < 1e-9);
    }

    #[test]
    fn find_perpendicular_snap_on_line() {
        let cursor = Point2D::new(5.0, 0.5);
        let from = Point2D::new(5.0, 3.0);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        let result = find_perpendicular_snap(&cursor, Some(&from), &geom, 2.0);
        assert!(result.is_some());
        let r = result.unwrap();
        assert!((r.x - 5.0).abs() < 1e-9);
        assert!((r.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn find_perpendicular_snap_on_circle() {
        let cursor = Point2D::new(4.5, 0.0);
        let from = Point2D::new(10.0, 0.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        let result = find_perpendicular_snap(&cursor, Some(&from), &geom, 2.0);
        assert!(result.is_some());
        let r = result.unwrap();
        assert!((r.x - 5.0).abs() < 1e-9);
        assert!((r.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn perpendicular_from_point_on_line() {
        // From point is coincident with line - should still work
        let from = Point2D::new(5.0, 0.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        let result = perpendicular_to_line(&from, &start, &end);
        assert!(result.valid);
        assert!((result.x - 5.0).abs() < 1e-9);
        assert!((result.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn degenerate_line_returns_invalid() {
        let from = Point2D::new(5.0, 3.0);
        let start = Point2D::new(1.0, 1.0);
        let end = Point2D::new(1.0, 1.0);
        let result = perpendicular_to_line(&from, &start, &end);
        assert!(!result.valid);
    }

    // === Tangent ===

    #[test]
    fn tangent_to_circle_external_two_candidates() {
        // From (10, 0) to circle at origin r=5: tangent points are at (2.5, ±sqrt(75)/2)
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let results = tangent_to_circle(&from, &center, 5.0);
        assert_eq!(results.len(), 2);
        // Tangent points lie on the circle.
        for r in &results {
            let d = ((r.x - center.x).powi(2) + (r.y - center.y).powi(2)).sqrt();
            assert!((d - 5.0).abs() < 1e-9, "tangent point not on circle: d={d}");
        }
        // Tangent lines from `from` to each tangent point are perpendicular to the radius at the tangent point.
        for r in &results {
            let radial = (r.x - center.x, r.y - center.y);
            let tangent_dir = (from.x - r.x, from.y - r.y);
            let dot = radial.0 * tangent_dir.0 + radial.1 * tangent_dir.1;
            assert!(
                dot.abs() < 1e-9,
                "tangent not perpendicular to radius: dot={dot}"
            );
        }
        // Symmetric across the from-center axis (here: x-axis).
        assert!((results[0].y + results[1].y).abs() < 1e-9);
    }

    #[test]
    fn tangent_to_circle_inside_returns_empty() {
        let from = Point2D::new(2.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let results = tangent_to_circle(&from, &center, 5.0);
        assert!(results.is_empty());
    }

    #[test]
    fn tangent_to_circle_on_circle_returns_self() {
        let from = Point2D::new(5.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let results = tangent_to_circle(&from, &center, 5.0);
        assert_eq!(results.len(), 1);
        assert!((results[0].x - 5.0).abs() < 1e-9);
        assert!((results[0].y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn tangent_to_circle_invalid_radius_empty() {
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        assert!(tangent_to_circle(&from, &center, 0.0).is_empty());
        assert!(tangent_to_circle(&from, &center, -1.0).is_empty());
        assert!(tangent_to_circle(&from, &center, f64::NAN).is_empty());
    }

    #[test]
    fn tangent_to_circle_offset_center() {
        // From (15, 5) to circle at (5, 5) r=5: same geometry as origin case shifted by (5,5).
        let from = Point2D::new(15.0, 5.0);
        let center = Point2D::new(5.0, 5.0);
        let results = tangent_to_circle(&from, &center, 5.0);
        assert_eq!(results.len(), 2);
        // Tangent points: (5+2.5, 5±sqrt(75)/2) — symmetric across y=5.
        assert!(((results[0].y - 5.0) + (results[1].y - 5.0)).abs() < 1e-9);
    }

    #[test]
    fn tangent_to_arc_filters_by_range() {
        // Arc from -45deg to 45deg (right wedge). From (10, 0) outside.
        // Both tangent points should be at y=±sqrt(75)/2 ≈ ±4.33, inside the right wedge angular range.
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let radius = 5.0;
        let start_angle = -PI / 4.0;
        let end_angle = PI / 4.0;
        let results = tangent_to_arc(&from, &center, radius, start_angle, end_angle);
        // Both tangent points are at angles ±atan2(sqrt(75)/2, 2.5) ≈ ±60deg — outside ±45deg arc.
        assert_eq!(results.len(), 0);
    }

    #[test]
    fn tangent_to_arc_partial_match() {
        // Arc covering (0, 90deg) — only the +y tangent point falls in range.
        let from = Point2D::new(10.0, 0.0);
        let center = Point2D::new(0.0, 0.0);
        let radius = 5.0;
        let results = tangent_to_arc(&from, &center, radius, 0.0, PI / 2.0);
        assert_eq!(results.len(), 1);
        assert!(results[0].y > 0.0);
    }

    #[test]
    fn find_tangent_snap_picks_closest_to_cursor() {
        // From (10, 0), circle at origin r=5: tangents at (2.5, ±sqrt(75)/2) ≈ (2.5, ±4.33).
        // Cursor near (2.5, 4.0): pick the +y tangent.
        let cursor = Point2D::new(2.5, 4.0);
        let from = Point2D::new(10.0, 0.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        let result = find_tangent_snap(&cursor, Some(&from), &geom, 1.0);
        assert!(result.is_some());
        let r = result.unwrap();
        assert!(r.y > 0.0);
        assert!((r.x - 2.5).abs() < 0.01);
    }

    #[test]
    fn find_tangent_snap_requires_from_point() {
        let cursor = Point2D::new(2.5, 4.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        // Without a from-point, tangent is undefined → None.
        assert!(find_tangent_snap(&cursor, None, &geom, 1.0).is_none());
    }

    #[test]
    fn find_tangent_snap_outside_threshold_returns_none() {
        let cursor = Point2D::new(50.0, 50.0);
        let from = Point2D::new(10.0, 0.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        assert!(find_tangent_snap(&cursor, Some(&from), &geom, 1.0).is_none());
    }

    #[test]
    fn find_tangent_snap_non_circular_geometry_returns_none() {
        let cursor = Point2D::new(0.0, 0.0);
        let from = Point2D::new(10.0, 0.0);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        // Tangent only applies to circles/arcs.
        assert!(find_tangent_snap(&cursor, Some(&from), &geom, 1.0).is_none());
    }

    // === Perpendicular (existing) ===

    #[test]
    fn perpendicular_to_polyline() {
        let cursor = Point2D::new(1.0, 0.5);
        let from = Point2D::new(1.0, 3.0);
        let geom = GeometryType::Polyline {
            vertices: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(5.0, 0.0),
                Point2D::new(5.0, 5.0),
            ],
            closed: false,
        };
        let result = find_perpendicular_snap(&cursor, Some(&from), &geom, 2.0);
        assert!(result.is_some());
        let r = result.unwrap();
        assert!((r.x - 1.0).abs() < 1e-9);
        assert!((r.y - 0.0).abs() < 1e-9);
    }

    // === Geometric Center ===

    #[test]
    fn geometric_center_square() {
        // Unit square at origin → centroid (0.5, 0.5).
        let verts = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(1.0, 0.0),
            Point2D::new(1.0, 1.0),
            Point2D::new(0.0, 1.0),
        ];
        let c = geometric_center_of_polygon(&verts).unwrap();
        assert!((c.x - 0.5).abs() < 1e-9);
        assert!((c.y - 0.5).abs() < 1e-9);
    }

    #[test]
    fn geometric_center_winding_independent() {
        // Same square, reversed winding → same centroid.
        let cw = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(0.0, 1.0),
            Point2D::new(1.0, 1.0),
            Point2D::new(1.0, 0.0),
        ];
        let c = geometric_center_of_polygon(&cw).unwrap();
        assert!((c.x - 0.5).abs() < 1e-9);
        assert!((c.y - 0.5).abs() < 1e-9);
    }

    #[test]
    fn geometric_center_offset_rectangle() {
        // 2×4 rectangle at (10, 20) → centroid (11, 22).
        let verts = vec![
            Point2D::new(10.0, 20.0),
            Point2D::new(12.0, 20.0),
            Point2D::new(12.0, 24.0),
            Point2D::new(10.0, 24.0),
        ];
        let c = geometric_center_of_polygon(&verts).unwrap();
        assert!((c.x - 11.0).abs() < 1e-9);
        assert!((c.y - 22.0).abs() < 1e-9);
    }

    #[test]
    fn geometric_center_irregular_l_shape() {
        // L-shape: 3×3 square with a 1×1 bite removed at (2,2).
        // Vertices CCW:
        //   (0,0), (3,0), (3,2), (2,2), (2,3), (0,3).
        // Decompose into two rectangles:
        //   R1: (0,0)-(3,2), area=6, centroid (1.5, 1.0)
        //   R2: (0,2)-(2,3), area=2, centroid (1.0, 2.5)
        // Combined centroid: (1.5*6 + 1.0*2)/8 = 11/8 = 1.375
        //                    (1.0*6 + 2.5*2)/8 = 11/8 = 1.375
        let verts = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(3.0, 0.0),
            Point2D::new(3.0, 2.0),
            Point2D::new(2.0, 2.0),
            Point2D::new(2.0, 3.0),
            Point2D::new(0.0, 3.0),
        ];
        let c = geometric_center_of_polygon(&verts).unwrap();
        assert!((c.x - 1.375).abs() < 1e-9, "got cx={}", c.x);
        assert!((c.y - 1.375).abs() < 1e-9, "got cy={}", c.y);
    }

    #[test]
    fn geometric_center_too_few_vertices_returns_none() {
        assert!(geometric_center_of_polygon(&[]).is_none());
        assert!(geometric_center_of_polygon(&[Point2D::new(0.0, 0.0)]).is_none());
        assert!(
            geometric_center_of_polygon(&[Point2D::new(0.0, 0.0), Point2D::new(1.0, 0.0)])
                .is_none()
        );
    }

    #[test]
    fn geometric_center_collinear_returns_none() {
        // Three collinear points have zero signed area.
        let verts = vec![
            Point2D::new(0.0, 0.0),
            Point2D::new(1.0, 0.0),
            Point2D::new(2.0, 0.0),
        ];
        assert!(geometric_center_of_polygon(&verts).is_none());
    }

    #[test]
    fn find_geometric_center_snap_on_circle() {
        let cursor = Point2D::new(5.1, 5.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(5.0, 5.0),
            radius: 3.0,
        };
        let result = find_geometric_center_snap(&cursor, &geom, 2.0).unwrap();
        assert!((result.x - 5.0).abs() < 1e-9);
        assert!((result.y - 5.0).abs() < 1e-9);
    }

    #[test]
    fn find_geometric_center_snap_on_closed_polyline() {
        let cursor = Point2D::new(0.5, 0.5);
        let geom = GeometryType::Polyline {
            vertices: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(1.0, 0.0),
                Point2D::new(1.0, 1.0),
                Point2D::new(0.0, 1.0),
            ],
            closed: true,
        };
        let result = find_geometric_center_snap(&cursor, &geom, 1.0).unwrap();
        assert!((result.x - 0.5).abs() < 1e-9);
        assert!((result.y - 0.5).abs() < 1e-9);
    }

    #[test]
    fn find_geometric_center_snap_open_polyline_returns_none() {
        let cursor = Point2D::new(0.5, 0.5);
        let geom = GeometryType::Polyline {
            vertices: vec![
                Point2D::new(0.0, 0.0),
                Point2D::new(1.0, 0.0),
                Point2D::new(1.0, 1.0),
            ],
            closed: false,
        };
        assert!(find_geometric_center_snap(&cursor, &geom, 1.0).is_none());
    }

    #[test]
    fn find_geometric_center_snap_outside_threshold_returns_none() {
        let cursor = Point2D::new(50.0, 50.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 3.0,
        };
        assert!(find_geometric_center_snap(&cursor, &geom, 1.0).is_none());
    }

    #[test]
    fn find_geometric_center_snap_on_line_returns_none() {
        // Line is not a closed shape — no centroid concept under GCEN.
        let cursor = Point2D::new(5.0, 0.0);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        assert!(find_geometric_center_snap(&cursor, &geom, 5.0).is_none());
    }

    // === Extension ===

    #[test]
    fn extension_beyond_end_returns_foot() {
        // Horizontal line (0,0)-(10,0). Cursor at (12, 0.3) projects to t=1.2,
        // foot (12, 0) — beyond `end`.
        let cursor = Point2D::new(12.0, 0.3);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        let foot = extension_of_line(&cursor, &start, &end).unwrap();
        assert!((foot.x - 12.0).abs() < 1e-9);
        assert!((foot.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn extension_beyond_start_returns_foot() {
        // Cursor at (-3, 0.5) projects to t=-0.3, foot (-3, 0) — beyond `start`.
        let cursor = Point2D::new(-3.0, 0.5);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        let foot = extension_of_line(&cursor, &start, &end).unwrap();
        assert!((foot.x - (-3.0)).abs() < 1e-9);
        assert!((foot.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn extension_on_segment_returns_none() {
        // Cursor over segment (t in [0,1]) → on-segment foot, not extension.
        let cursor = Point2D::new(5.0, 0.5);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        assert!(extension_of_line(&cursor, &start, &end).is_none());
    }

    #[test]
    fn extension_at_endpoint_returns_none() {
        // Cursor exactly at the endpoint (t=1) is on segment, not extension —
        // the on-segment endpoint case is handled by the endpoint snap path.
        let cursor = Point2D::new(10.0, 0.0);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(10.0, 0.0);
        assert!(extension_of_line(&cursor, &start, &end).is_none());
    }

    #[test]
    fn extension_diagonal_line() {
        // Line (0,0)-(2,2), unit-direction (1/√2, 1/√2). Cursor (3, 3.1):
        //   t = ((3-0)·2 + (3.1-0)·2) / 8 = (6 + 6.2)/8 = 1.525 > 1 → extension
        //   foot = (0 + 1.525·2, 0 + 1.525·2) = (3.05, 3.05).
        let cursor = Point2D::new(3.0, 3.1);
        let start = Point2D::new(0.0, 0.0);
        let end = Point2D::new(2.0, 2.0);
        let foot = extension_of_line(&cursor, &start, &end).unwrap();
        assert!((foot.x - 3.05).abs() < 1e-9, "got x={}", foot.x);
        assert!((foot.y - 3.05).abs() < 1e-9, "got y={}", foot.y);
    }

    #[test]
    fn extension_degenerate_line_returns_none() {
        let cursor = Point2D::new(5.0, 5.0);
        let start = Point2D::new(1.0, 1.0);
        let end = Point2D::new(1.0, 1.0);
        assert!(extension_of_line(&cursor, &start, &end).is_none());
    }

    #[test]
    fn find_extension_snap_within_threshold() {
        let cursor = Point2D::new(12.0, 0.3);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        let foot = find_extension_snap(&cursor, &geom, 1.0).unwrap();
        assert!((foot.x - 12.0).abs() < 1e-9);
        assert!((foot.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn find_extension_snap_outside_threshold_returns_none() {
        // Cursor (12, 5) projects to (12, 0); perpendicular distance 5 > threshold 1.
        let cursor = Point2D::new(12.0, 5.0);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        assert!(find_extension_snap(&cursor, &geom, 1.0).is_none());
    }

    #[test]
    fn find_extension_snap_on_segment_returns_none() {
        // Cursor over segment is not an Extension hit even if perpendicular is small.
        let cursor = Point2D::new(5.0, 0.3);
        let geom = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };
        assert!(find_extension_snap(&cursor, &geom, 1.0).is_none());
    }

    #[test]
    fn find_extension_snap_non_line_geometry_returns_none() {
        // Extension only applies to lines (this PR). Other geometries return None
        // even if a corresponding extension concept might exist (arc tangent
        // continuation, polyline first/last segment) — those are follow-ups.
        let cursor = Point2D::new(12.0, 0.0);
        let geom = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        assert!(find_extension_snap(&cursor, &geom, 2.0).is_none());
    }
}
