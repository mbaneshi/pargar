use crate::entity::{Entity, GeometryType, Point2D};
use crate::tolerance::{PARALLEL_DENOMINATOR, PARAMETER_EXTENSION, POINT_COINCIDENCE, ZERO_LENGTH};
use std::f64::consts::PI;

#[allow(dead_code)]
pub(crate) fn line_line_intersection(
    p1: &Point2D,
    p2: &Point2D,
    p3: &Point2D,
    p4: &Point2D,
) -> Option<Point2D> {
    let dx1 = p2.x - p1.x;
    let dy1 = p2.y - p1.y;
    let dx2 = p4.x - p3.x;
    let dy2 = p4.y - p3.y;

    let denom = dx1 * dy2 - dy1 * dx2;
    if denom.abs() < PARALLEL_DENOMINATOR {
        return None;
    }

    let dx3 = p3.x - p1.x;
    let dy3 = p3.y - p1.y;
    let t = (dx3 * dy2 - dy3 * dx2) / denom;
    let u = (dx3 * dy1 - dy3 * dx1) / denom;

    if !(-PARAMETER_EXTENSION..=1.0 + PARAMETER_EXTENSION).contains(&t) {
        return None;
    }
    if !(-PARAMETER_EXTENSION..=1.0 + PARAMETER_EXTENSION).contains(&u) {
        return None;
    }

    Some(Point2D::new(p1.x + t * dx1, p1.y + t * dy1))
}

pub(crate) fn line_line_intersection_infinite(
    p1: &Point2D,
    p2: &Point2D,
    p3: &Point2D,
    p4: &Point2D,
) -> Option<Point2D> {
    let dx1 = p2.x - p1.x;
    let dy1 = p2.y - p1.y;
    let dx2 = p4.x - p3.x;
    let dy2 = p4.y - p3.y;

    let denom = dx1 * dy2 - dy1 * dx2;
    if denom.abs() < PARALLEL_DENOMINATOR {
        return None;
    }

    let dx3 = p3.x - p1.x;
    let dy3 = p3.y - p1.y;
    let t = (dx3 * dy2 - dy3 * dx2) / denom;

    Some(Point2D::new(p1.x + t * dx1, p1.y + t * dy1))
}

/// Intersects an **infinite** line (defined by two points) with a circle.
/// The line extends beyond p1/p2 in both directions — no segment clamping.
/// This is intentional: callers (e.g. `tangent_circle_line_circle`) operate
/// on offset lines that are conceptually infinite.
pub(crate) fn line_circle_intersection(
    p1: &Point2D,
    p2: &Point2D,
    center: &Point2D,
    radius: f64,
) -> Vec<Point2D> {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let fx = p1.x - center.x;
    let fy = p1.y - center.y;

    let a = dx * dx + dy * dy;
    if a < ZERO_LENGTH {
        return vec![];
    }

    let b = 2.0 * (fx * dx + fy * dy);
    let c = fx * fx + fy * fy - radius * radius;
    let discriminant = b * b - 4.0 * a * c;

    // Scale the discriminant check by a^2 so that the tolerance is geometry-independent.
    let scaled_disc = if a.abs() > ZERO_LENGTH {
        discriminant / (a * a)
    } else {
        discriminant
    };

    if scaled_disc < -POINT_COINCIDENCE {
        return vec![];
    }

    let mut results = Vec::new();
    if scaled_disc.abs() < POINT_COINCIDENCE {
        let t = -b / (2.0 * a);
        results.push(Point2D::new(p1.x + t * dx, p1.y + t * dy));
    } else {
        let sqrt_d = discriminant.sqrt();
        for sign in [-1.0, 1.0] {
            let t = (-b + sign * sqrt_d) / (2.0 * a);
            results.push(Point2D::new(p1.x + t * dx, p1.y + t * dy));
        }
    }
    results
}

#[allow(dead_code)]
pub(crate) fn line_arc_intersection(
    p1: &Point2D,
    p2: &Point2D,
    center: &Point2D,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
) -> Vec<Point2D> {
    let circle_hits = line_circle_intersection(p1, p2, center, radius);
    circle_hits
        .into_iter()
        .filter(|pt| point_in_arc_range(pt, center, start_angle, end_angle))
        .collect()
}

pub(crate) fn circle_circle_intersection(
    c1: &Point2D,
    r1: f64,
    c2: &Point2D,
    r2: f64,
) -> Vec<Point2D> {
    let d = c1.distance_to(c2);

    if d < ZERO_LENGTH {
        return vec![];
    }
    if d > r1 + r2 + POINT_COINCIDENCE {
        return vec![];
    }
    if d < (r1 - r2).abs() - POINT_COINCIDENCE {
        return vec![];
    }

    let a = (r1 * r1 - r2 * r2 + d * d) / (2.0 * d);
    let h_sq = r1 * r1 - a * a;

    let mx = c1.x + a * (c2.x - c1.x) / d;
    let my = c1.y + a * (c2.y - c1.y) / d;

    if h_sq < ZERO_LENGTH {
        return vec![Point2D::new(mx, my)];
    }

    let h = h_sq.sqrt();
    let rx = -(c2.y - c1.y) * h / d;
    let ry = (c2.x - c1.x) * h / d;

    vec![
        Point2D::new(mx + rx, my + ry),
        Point2D::new(mx - rx, my - ry),
    ]
}

#[allow(dead_code)]
fn point_in_arc_range(pt: &Point2D, center: &Point2D, start_angle: f64, end_angle: f64) -> bool {
    let angle = (pt.y - center.y).atan2(pt.x - center.x);
    let normalize = |a: f64| -> f64 {
        let mut a = a % (2.0 * PI);
        if a < 0.0 {
            a += 2.0 * PI;
        }
        a
    };
    let a = normalize(angle);
    let s = normalize(start_angle);
    let e = normalize(end_angle);

    if s <= e {
        a >= s - POINT_COINCIDENCE && a <= e + POINT_COINCIDENCE
    } else {
        a >= s - POINT_COINCIDENCE || a <= e + POINT_COINCIDENCE
    }
}

#[allow(dead_code)]
pub(crate) fn point_to_line_distance(point: &Point2D, p1: &Point2D, p2: &Point2D) -> f64 {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len = (dx * dx + dy * dy).sqrt();
    if len < ZERO_LENGTH {
        return point.distance_to(p1);
    }
    ((point.x - p1.x) * dy - (point.y - p1.y) * dx).abs() / len
}

pub(crate) fn circumscribed_circle(
    p1: &Point2D,
    p2: &Point2D,
    p3: &Point2D,
) -> Option<(Point2D, f64)> {
    let ax = p1.x;
    let ay = p1.y;
    let bx = p2.x;
    let by = p2.y;
    let cx = p3.x;
    let cy = p3.y;

    let d = 2.0 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if d.abs() < PARALLEL_DENOMINATOR {
        return None;
    }

    let ux = ((ax * ax + ay * ay) * (by - cy)
        + (bx * bx + by * by) * (cy - ay)
        + (cx * cx + cy * cy) * (ay - by))
        / d;
    let uy = ((ax * ax + ay * ay) * (cx - bx)
        + (bx * bx + by * by) * (ax - cx)
        + (cx * cx + cy * cy) * (bx - ax))
        / d;

    let center = Point2D::new(ux, uy);
    let radius = center.distance_to(p1);
    Some((center, radius))
}

pub(crate) fn tangent_circle_line_line(
    l1s: &Point2D,
    l1e: &Point2D,
    l2s: &Point2D,
    l2e: &Point2D,
    radius: f64,
) -> Vec<(Point2D, f64)> {
    let offsets1 = offset_line(l1s, l1e, radius);
    let offsets2 = offset_line(l2s, l2e, radius);

    let mut results = Vec::new();
    for (a1, a2) in &offsets1 {
        for (b1, b2) in &offsets2 {
            if let Some(pt) = line_line_intersection_infinite(a1, a2, b1, b2) {
                results.push((pt, radius));
            }
        }
    }
    results
}

pub(crate) fn tangent_circle_line_circle(
    ls: &Point2D,
    le: &Point2D,
    cc: &Point2D,
    cr: f64,
    fr: f64,
) -> Vec<(Point2D, f64)> {
    let line_offsets = offset_line(ls, le, fr);
    let mut results = Vec::new();

    for sign in [-1.0, 1.0] {
        let adjusted_r = cr + sign * fr;
        if adjusted_r < -POINT_COINCIDENCE {
            continue;
        }
        let r = adjusted_r.abs();
        for (a1, a2) in &line_offsets {
            let hits = line_circle_intersection(a1, a2, cc, r);
            for pt in hits {
                results.push((pt, fr));
            }
        }
    }
    results
}

pub(crate) fn tangent_circle_circle_circle(
    c1: &Point2D,
    r1: f64,
    c2: &Point2D,
    r2: f64,
    fr: f64,
) -> Vec<(Point2D, f64)> {
    let mut results = Vec::new();
    for s1 in [-1.0, 1.0] {
        for s2 in [-1.0, 1.0] {
            let adj_r1 = r1 + s1 * fr;
            let adj_r2 = r2 + s2 * fr;
            if adj_r1 < -POINT_COINCIDENCE || adj_r2 < -POINT_COINCIDENCE {
                continue;
            }
            let hits = circle_circle_intersection(c1, adj_r1.abs(), c2, adj_r2.abs());
            for pt in hits {
                results.push((pt, fr));
            }
        }
    }
    results
}

pub(crate) fn pick_side_for_tangent(
    candidates: &[(Point2D, f64)],
    pick_point: &Point2D,
) -> Option<(Point2D, f64)> {
    candidates
        .iter()
        .min_by(|a, b| {
            let da = a.0.distance_to(pick_point);
            let db = b.0.distance_to(pick_point);
            da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(p, r)| (p.clone(), *r))
}

#[allow(dead_code)]
pub(crate) fn closest_point_on_entity(point: &Point2D, entity: &Entity) -> Point2D {
    match &entity.geometry {
        GeometryType::Line { start, end } => closest_point_on_segment(point, start, end),
        GeometryType::Circle { center, radius } => {
            let d = point.distance_to(center);
            if d < ZERO_LENGTH {
                return Point2D::new(center.x + radius, center.y);
            }
            let ratio = radius / d;
            Point2D::new(
                center.x + (point.x - center.x) * ratio,
                center.y + (point.y - center.y) * ratio,
            )
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            let d = point.distance_to(center);
            let angle = (point.y - center.y).atan2(point.x - center.x);
            if d < ZERO_LENGTH
                || !point_in_arc_range(
                    &Point2D::new(center.x + angle.cos(), center.y + angle.sin()),
                    center,
                    *start_angle,
                    *end_angle,
                )
            {
                // Return whichever arc endpoint is closer
                let sp = Point2D::new(
                    center.x + radius * start_angle.cos(),
                    center.y + radius * start_angle.sin(),
                );
                let ep = Point2D::new(
                    center.x + radius * end_angle.cos(),
                    center.y + radius * end_angle.sin(),
                );
                if point.distance_to(&sp) <= point.distance_to(&ep) {
                    sp
                } else {
                    ep
                }
            } else {
                let ratio = radius / d;
                Point2D::new(
                    center.x + (point.x - center.x) * ratio,
                    center.y + (point.y - center.y) * ratio,
                )
            }
        }
        _ => {
            // Fallback: return the point itself (no projection available)
            point.clone()
        }
    }
}

// --- helpers ---

fn offset_line(p1: &Point2D, p2: &Point2D, dist: f64) -> Vec<(Point2D, Point2D)> {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len = (dx * dx + dy * dy).sqrt();
    if len < ZERO_LENGTH {
        return vec![];
    }
    let nx = -dy / len * dist;
    let ny = dx / len * dist;
    vec![
        (
            Point2D::new(p1.x + nx, p1.y + ny),
            Point2D::new(p2.x + nx, p2.y + ny),
        ),
        (
            Point2D::new(p1.x - nx, p1.y - ny),
            Point2D::new(p2.x - nx, p2.y - ny),
        ),
    ]
}

#[allow(dead_code)]
fn closest_point_on_segment(point: &Point2D, p1: &Point2D, p2: &Point2D) -> Point2D {
    let dx = p2.x - p1.x;
    let dy = p2.y - p1.y;
    let len_sq = dx * dx + dy * dy;
    if len_sq < ZERO_LENGTH * ZERO_LENGTH {
        return p1.clone();
    }
    let t = ((point.x - p1.x) * dx + (point.y - p1.y) * dy) / len_sq;
    let t = t.clamp(0.0, 1.0);
    Point2D::new(p1.x + t * dx, p1.y + t * dy)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pt(x: f64, y: f64) -> Point2D {
        Point2D::new(x, y)
    }

    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-6
    }

    #[test]
    fn line_line_crossing() {
        let r = line_line_intersection(&pt(0.0, 0.0), &pt(2.0, 2.0), &pt(0.0, 2.0), &pt(2.0, 0.0));
        let p = r.unwrap();
        assert!(approx_eq(p.x, 1.0) && approx_eq(p.y, 1.0));
    }

    #[test]
    fn line_line_parallel() {
        let r = line_line_intersection(&pt(0.0, 0.0), &pt(1.0, 0.0), &pt(0.0, 1.0), &pt(1.0, 1.0));
        assert!(r.is_none());
    }

    #[test]
    fn line_line_no_segment_intersection() {
        // Segments don't overlap even though infinite lines would
        let r = line_line_intersection(&pt(0.0, 0.0), &pt(1.0, 0.0), &pt(2.0, -1.0), &pt(2.0, 1.0));
        assert!(r.is_none());
    }

    #[test]
    fn line_line_infinite_beyond_segments() {
        let r = line_line_intersection_infinite(
            &pt(0.0, 0.0),
            &pt(1.0, 0.0),
            &pt(5.0, -1.0),
            &pt(5.0, 1.0),
        );
        let p = r.unwrap();
        assert!(approx_eq(p.x, 5.0) && approx_eq(p.y, 0.0));
    }

    #[test]
    fn line_circle_secant() {
        let hits = line_circle_intersection(&pt(-2.0, 0.0), &pt(2.0, 0.0), &pt(0.0, 0.0), 1.0);
        assert_eq!(hits.len(), 2);
        let mut xs: Vec<f64> = hits.iter().map(|p| p.x).collect();
        xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
        assert!(approx_eq(xs[0], -1.0), "x0={}", xs[0]);
        assert!(approx_eq(xs[1], 1.0), "x1={}", xs[1]);
        assert!(approx_eq(hits[0].y, 0.0));
        assert!(approx_eq(hits[1].y, 0.0));
    }

    #[test]
    fn line_circle_miss() {
        let hits = line_circle_intersection(&pt(-2.0, 5.0), &pt(2.0, 5.0), &pt(0.0, 0.0), 1.0);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn circle_circle_two_points() {
        let hits = circle_circle_intersection(&pt(0.0, 0.0), 1.0, &pt(1.0, 0.0), 1.0);
        assert_eq!(hits.len(), 2);
        // Both points should have x=0.5, y=±sqrt(3)/2
        let expected_x = 0.5;
        let expected_y = (3.0_f64).sqrt() / 2.0;
        for p in &hits {
            assert!(approx_eq(p.x, expected_x), "x={}", p.x);
            assert!(approx_eq(p.y.abs(), expected_y), "y={}", p.y);
        }
        // The two points should be on opposite sides
        assert!(hits[0].y * hits[1].y < 0.0, "points should straddle x-axis");
    }

    #[test]
    fn circle_circle_tangent() {
        let hits = circle_circle_intersection(&pt(0.0, 0.0), 1.0, &pt(2.0, 0.0), 1.0);
        assert_eq!(hits.len(), 1);
        assert!(approx_eq(hits[0].x, 1.0) && approx_eq(hits[0].y, 0.0));
    }

    #[test]
    fn circle_circle_no_intersection() {
        let hits = circle_circle_intersection(&pt(0.0, 0.0), 1.0, &pt(5.0, 0.0), 1.0);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn circle_circle_concentric() {
        let hits = circle_circle_intersection(&pt(0.0, 0.0), 1.0, &pt(0.0, 0.0), 2.0);
        assert_eq!(hits.len(), 0);
    }

    #[test]
    fn circumscribed_circle_equilateral() {
        let s = 2.0;
        let p1 = pt(0.0, 0.0);
        let p2 = pt(s, 0.0);
        let p3 = pt(s / 2.0, s * (3.0_f64).sqrt() / 2.0);
        let (center, radius) = circumscribed_circle(&p1, &p2, &p3).unwrap();
        assert!(approx_eq(center.x, 1.0));
        assert!(approx_eq(radius, center.distance_to(&p1)));
    }

    #[test]
    fn circumscribed_circle_collinear() {
        let r = circumscribed_circle(&pt(0.0, 0.0), &pt(1.0, 0.0), &pt(2.0, 0.0));
        assert!(r.is_none());
    }

    #[test]
    fn point_to_line_perpendicular() {
        let d = point_to_line_distance(&pt(1.0, 3.0), &pt(0.0, 0.0), &pt(2.0, 0.0));
        assert!(approx_eq(d, 3.0));
    }

    #[test]
    fn tangent_circle_line_line_perpendicular() {
        // Two perpendicular lines through origin, fillet radius 1
        let l1s = pt(-5.0, 0.0);
        let l1e = pt(5.0, 0.0);
        let l2s = pt(0.0, -5.0);
        let l2e = pt(0.0, 5.0);
        let radius = 1.0;
        let results = tangent_circle_line_line(&l1s, &l1e, &l2s, &l2e, radius);
        assert_eq!(results.len(), 4);
        for (center, r) in &results {
            assert!(approx_eq(*r, radius));
            let d1 = point_to_line_distance(center, &l1s, &l1e);
            let d2 = point_to_line_distance(center, &l2s, &l2e);
            assert!(approx_eq(d1, radius), "d1={} should be {}", d1, radius);
            assert!(approx_eq(d2, radius), "d2={} should be {}", d2, radius);
        }
    }

    #[test]
    fn pick_side_closest() {
        let candidates = vec![
            (pt(1.0, 1.0), 1.0),
            (pt(-1.0, -1.0), 1.0),
            (pt(1.0, -1.0), 1.0),
            (pt(-1.0, 1.0), 1.0),
        ];
        let pick = pt(0.9, 0.9);
        let (center, _) = pick_side_for_tangent(&candidates, &pick).unwrap();
        assert!(approx_eq(center.x, 1.0) && approx_eq(center.y, 1.0));
    }

    #[test]
    fn line_circle_tangent() {
        // Horizontal line y=1 is tangent to unit circle at (0,1)
        let hits = line_circle_intersection(&pt(-2.0, 1.0), &pt(2.0, 1.0), &pt(0.0, 0.0), 1.0);
        assert_eq!(hits.len(), 1, "tangent should produce exactly 1 point");
        assert!(approx_eq(hits[0].x, 0.0), "x={}", hits[0].x);
        assert!(approx_eq(hits[0].y, 1.0), "y={}", hits[0].y);
    }

    #[test]
    fn closest_point_on_line_perpendicular() {
        let entity = Entity {
            id: "test-line".to_string(),
            geometry: GeometryType::Line {
                start: pt(0.0, 0.0),
                end: pt(10.0, 0.0),
            },
            layer_id: "0".to_string(),
            style: Default::default(),
            draw_order: 0,
        };
        let query = pt(5.0, 3.0);
        let closest = closest_point_on_entity(&query, &entity);
        assert!(approx_eq(closest.x, 5.0), "x={}", closest.x);
        assert!(approx_eq(closest.y, 0.0), "y={}", closest.y);
    }

    #[test]
    fn closest_point_on_circle_circumference() {
        let entity = Entity {
            id: "test-circle".to_string(),
            geometry: GeometryType::Circle {
                center: pt(0.0, 0.0),
                radius: 5.0,
            },
            layer_id: "0".to_string(),
            style: Default::default(),
            draw_order: 0,
        };
        // Point at (10, 0) — closest should be (5, 0) on circumference
        let closest = closest_point_on_entity(&pt(10.0, 0.0), &entity);
        assert!(approx_eq(closest.x, 5.0), "x={}", closest.x);
        assert!(approx_eq(closest.y, 0.0), "y={}", closest.y);

        // Point at (3, 4) — direction is (3,4)/5, closest is (3,4)
        let closest2 = closest_point_on_entity(&pt(6.0, 8.0), &entity);
        assert!(approx_eq(closest2.x, 3.0), "x={}", closest2.x);
        assert!(approx_eq(closest2.y, 4.0), "y={}", closest2.y);
    }

    #[test]
    fn line_arc_within_range() {
        // Arc from 0 to PI/2, radius 1, centered at origin
        let hits = line_arc_intersection(
            &pt(-2.0, 0.5),
            &pt(2.0, 0.5),
            &pt(0.0, 0.0),
            1.0,
            0.0,
            PI / 2.0,
        );
        // The line y=0.5 intersects the unit circle at x=±sqrt(0.75)
        // Only the positive-x one is in [0, PI/2]
        assert_eq!(hits.len(), 1);
        assert!(hits[0].x > 0.0);
    }
}
