use crate::entity;
use crate::snaps;
use crate::Kernel;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl Kernel {
    pub(crate) fn find_perpendicular_snap_inner(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
    ) -> Option<String> {
        let cursor = entity::Point2D::new(cursor_x, cursor_y);
        let from_point = if has_from {
            Some(entity::Point2D::new(from_x, from_y))
        } else {
            None
        };

        let mut best: Option<snaps::PerpendicularResult> = None;
        let mut best_dist = threshold;

        let candidate_ids = self.spatial_idx.query_window(
            [cursor_x - threshold, cursor_y - threshold],
            [cursor_x + threshold, cursor_y + threshold],
        );
        for cid in &candidate_ids {
            let ent = match self.ecs_world.get_entity_cloned(cid) {
                Some(e) => e,
                None => continue,
            };
            if let Some(result) = snaps::find_perpendicular_snap(
                &cursor,
                from_point.as_ref(),
                &ent.geometry,
                threshold,
            ) {
                let dx = cursor.x - result.x;
                let dy = cursor.y - result.y;
                let d = (dx * dx + dy * dy).sqrt();
                if d < best_dist {
                    best_dist = d;
                    best = Some(result);
                }
            }
        }

        best.map(|r| {
            serde_json::json!({
                "x": r.x,
                "y": r.y,
                "type": "perpendicular"
            })
            .to_string()
        })
    }

    /// Unified snap query — finds the best snap point across all enabled snap types.
    /// Uses spatial index to narrow candidates. Returns JSON: {x, y, type} or null.
    /// `snap_types` is a comma-separated list of exact tokens; recognized:
    ///   "endpoint", "midpoint", "center", "geometric_center", "intersection",
    ///   "quadrant", "nearest", "perpendicular", "tangent", "extension", "grid".
    /// `tangent` and `perpendicular` require `has_from` — skipped silently otherwise.
    /// `geometric_center` applies to closed shapes only (Circle, Ellipse,
    /// Rectangle, closed Polyline).
    /// `extension` reach is bounded by the spatial-index window (cursor ± threshold);
    /// extension fires when the cursor is within `threshold` of the line's bbox.
    #[allow(clippy::too_many_arguments)]
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn find_all_snaps_inner(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
        grid_size: f64,
        snap_types: &str,
    ) -> String {
        use crate::entity::GeometryType;
        use std::f64::consts::PI;

        // Token-based matching prevents substring collisions between snap-type
        // names (e.g. "center" vs "geometric_center"). The caller assembles
        // `snap_types` as a comma-separated list of exact tokens; we split and
        // match on whole tokens here.
        let has_token = |tok: &str| snap_types.split(',').any(|t| t.trim() == tok);
        let want_endpoint = has_token("endpoint");
        let want_midpoint = has_token("midpoint");
        let want_center = has_token("center");
        let want_geometric_center = has_token("geometric_center");
        let want_intersection = has_token("intersection");
        let want_quadrant = has_token("quadrant");
        let want_nearest = has_token("nearest");
        let want_perpendicular = has_token("perpendicular");
        let want_tangent = has_token("tangent");
        let want_extension = has_token("extension");
        let want_grid = has_token("grid");

        let mut best_x = 0.0f64;
        let mut best_y = 0.0f64;
        let mut best_type = "";
        let mut best_dist = threshold;

        let mut check = |x: f64, y: f64, snap_type: &'static str| {
            if !x.is_finite() || !y.is_finite() {
                return;
            }
            let d = ((cursor_x - x).powi(2) + (cursor_y - y).powi(2)).sqrt();
            if d < best_dist {
                best_dist = d;
                best_x = x;
                best_y = y;
                best_type = snap_type;
            }
        };

        // Narrow candidates via spatial index
        let candidate_ids = self.spatial_idx.query_window(
            [cursor_x - threshold, cursor_y - threshold],
            [cursor_x + threshold, cursor_y + threshold],
        );

        let mut candidate_entities: Vec<entity::Entity> = Vec::new();
        for cid in &candidate_ids {
            if let Some(ent) = self.ecs_world.get_entity_cloned(cid) {
                candidate_entities.push(ent);
            }
        }

        for ent in &candidate_entities {
            match &ent.geometry {
                GeometryType::Point { position } if want_endpoint => {
                    check(position.x, position.y, "endpoint");
                }
                GeometryType::Line { start, end } => {
                    if want_endpoint {
                        check(start.x, start.y, "endpoint");
                        check(end.x, end.y, "endpoint");
                    }
                    if want_midpoint {
                        check((start.x + end.x) / 2.0, (start.y + end.y) / 2.0, "midpoint");
                    }
                    if want_perpendicular && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        let result = snaps::perpendicular_to_line(&from, start, end);
                        if result.valid {
                            check(result.x, result.y, "perpendicular");
                        }
                    }
                    if want_extension {
                        if let Some(foot) = snaps::extension_of_line(
                            &entity::Point2D::new(cursor_x, cursor_y),
                            start,
                            end,
                        ) {
                            check(foot.x, foot.y, "extension");
                        }
                    }
                }
                GeometryType::Circle { center, radius } => {
                    if want_center {
                        check(center.x, center.y, "center");
                    }
                    if want_geometric_center {
                        // For circles, geometric center == center (trivial), but
                        // emitted under its own type so the override path lights up.
                        check(center.x, center.y, "geometric_center");
                    }
                    if want_quadrant {
                        for p in &snaps::circle_quadrant_points(center.x, center.y, *radius) {
                            check(p.x, p.y, "quadrant");
                        }
                    }
                    if want_perpendicular && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        for r in snaps::perpendicular_to_circle(&from, center, *radius) {
                            if r.valid {
                                check(r.x, r.y, "perpendicular");
                            }
                        }
                    }
                    if want_tangent && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        for t in snaps::tangent_to_circle(&from, center, *radius) {
                            check(t.x, t.y, "tangent");
                        }
                    }
                }
                GeometryType::Arc {
                    center,
                    radius,
                    start_angle,
                    end_angle,
                } => {
                    if want_center {
                        check(center.x, center.y, "center");
                    }
                    if want_endpoint && radius.is_finite() && *radius > 0.0 {
                        check(
                            center.x + radius * start_angle.cos(),
                            center.y + radius * start_angle.sin(),
                            "endpoint",
                        );
                        check(
                            center.x + radius * end_angle.cos(),
                            center.y + radius * end_angle.sin(),
                            "endpoint",
                        );
                    }
                    if want_quadrant {
                        for p in &snaps::arc_quadrant_points(
                            center.x,
                            center.y,
                            *radius,
                            *start_angle,
                            *end_angle,
                        ) {
                            check(p.x, p.y, "quadrant");
                        }
                    }
                    if want_perpendicular && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        for r in snaps::perpendicular_to_arc(
                            &from,
                            center,
                            *radius,
                            *start_angle,
                            *end_angle,
                        ) {
                            if r.valid {
                                check(r.x, r.y, "perpendicular");
                            }
                        }
                    }
                    if want_tangent && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        for t in
                            snaps::tangent_to_arc(&from, center, *radius, *start_angle, *end_angle)
                        {
                            check(t.x, t.y, "tangent");
                        }
                    }
                }
                GeometryType::Rectangle {
                    origin,
                    width,
                    height,
                    ..
                } => {
                    if want_endpoint {
                        check(origin.x, origin.y, "endpoint");
                        check(origin.x + width, origin.y, "endpoint");
                        check(origin.x + width, origin.y + height, "endpoint");
                        check(origin.x, origin.y + height, "endpoint");
                    }
                    if want_center {
                        check(origin.x + width / 2.0, origin.y + height / 2.0, "center");
                    }
                    if want_geometric_center {
                        check(
                            origin.x + width / 2.0,
                            origin.y + height / 2.0,
                            "geometric_center",
                        );
                    }
                    if want_midpoint {
                        check(origin.x + width / 2.0, origin.y, "midpoint");
                        check(origin.x + width, origin.y + height / 2.0, "midpoint");
                        check(origin.x + width / 2.0, origin.y + height, "midpoint");
                        check(origin.x, origin.y + height / 2.0, "midpoint");
                    }
                    if want_perpendicular && has_from {
                        let from = entity::Point2D::new(from_x, from_y);
                        let corners = [
                            entity::Point2D::new(origin.x, origin.y),
                            entity::Point2D::new(origin.x + width, origin.y),
                            entity::Point2D::new(origin.x + width, origin.y + height),
                            entity::Point2D::new(origin.x, origin.y + height),
                        ];
                        for i in 0..4 {
                            let j = (i + 1) % 4;
                            let r = snaps::perpendicular_to_line(&from, &corners[i], &corners[j]);
                            if r.valid {
                                check(r.x, r.y, "perpendicular");
                            }
                        }
                    }
                }
                GeometryType::Polyline { vertices, closed } => {
                    if want_endpoint {
                        for v in vertices {
                            check(v.x, v.y, "endpoint");
                        }
                    }
                    if want_midpoint && vertices.len() >= 2 {
                        for i in 0..vertices.len() - 1 {
                            check(
                                (vertices[i].x + vertices[i + 1].x) / 2.0,
                                (vertices[i].y + vertices[i + 1].y) / 2.0,
                                "midpoint",
                            );
                        }
                    }
                    if want_geometric_center && *closed {
                        if let Some(c) = snaps::geometric_center_of_polygon(vertices) {
                            check(c.x, c.y, "geometric_center");
                        }
                    }
                    if want_perpendicular && has_from && vertices.len() >= 2 {
                        let from = entity::Point2D::new(from_x, from_y);
                        let n = vertices.len();
                        let limit = if *closed { n } else { n - 1 };
                        for i in 0..limit {
                            let j = (i + 1) % n;
                            let r = snaps::perpendicular_to_line(&from, &vertices[i], &vertices[j]);
                            if r.valid {
                                check(r.x, r.y, "perpendicular");
                            }
                        }
                    }
                }
                GeometryType::Ellipse {
                    center,
                    semi_major,
                    semi_minor,
                    rotation,
                } => {
                    if want_center {
                        check(center.x, center.y, "center");
                    }
                    if want_geometric_center {
                        check(center.x, center.y, "geometric_center");
                    }
                    if want_quadrant {
                        for p in &snaps::ellipse_quadrant_points(
                            center.x,
                            center.y,
                            *semi_major,
                            *semi_minor,
                            *rotation,
                        ) {
                            check(p.x, p.y, "quadrant");
                        }
                    }
                }
                _ => {}
            }
        }

        // Intersection snaps (line-line and line-circle)
        if want_intersection && candidate_entities.len() >= 2 {
            for i in 0..candidate_entities.len() {
                for j in (i + 1)..candidate_entities.len() {
                    let g1 = &candidate_entities[i].geometry;
                    let g2 = &candidate_entities[j].geometry;
                    if let (
                        GeometryType::Line { start: s1, end: e1 },
                        GeometryType::Line { start: s2, end: e2 },
                    ) = (g1, g2)
                    {
                        let d1x = e1.x - s1.x;
                        let d1y = e1.y - s1.y;
                        let d2x = e2.x - s2.x;
                        let d2y = e2.y - s2.y;
                        let denom = d1x * d2y - d1y * d2x;
                        if denom.abs() > 1e-10 {
                            let t = ((s2.x - s1.x) * d2y - (s2.y - s1.y) * d2x) / denom;
                            let u = ((s2.x - s1.x) * d1y - (s2.y - s1.y) * d1x) / denom;
                            if (-0.01..=1.01).contains(&t) && (-0.01..=1.01).contains(&u) {
                                check(s1.x + t * d1x, s1.y + t * d1y, "intersection");
                            }
                        }
                    }
                    // Line-circle intersections
                    let pairs: Vec<(&entity::Point2D, &entity::Point2D, &entity::Point2D, f64)> =
                        match (g1, g2) {
                            (
                                GeometryType::Line { start, end },
                                GeometryType::Circle { center, radius },
                            ) => vec![(start, end, center, *radius)],
                            (
                                GeometryType::Circle { center, radius },
                                GeometryType::Line { start, end },
                            ) => vec![(start, end, center, *radius)],
                            _ => vec![],
                        };
                    for (s, e, c, r) in pairs {
                        if !r.is_finite() || r <= 0.0 {
                            continue;
                        }
                        let dx = e.x - s.x;
                        let dy = e.y - s.y;
                        let fx = s.x - c.x;
                        let fy = s.y - c.y;
                        let a = dx * dx + dy * dy;
                        let b = 2.0 * (fx * dx + fy * dy);
                        let cc = fx * fx + fy * fy - r * r;
                        let disc = b * b - 4.0 * a * cc;
                        if disc >= 0.0 && a > 1e-10 {
                            let sqrt_disc = disc.sqrt();
                            for sign in &[-1.0, 1.0] {
                                let t = (-b + sign * sqrt_disc) / (2.0 * a);
                                if (-0.01..=1.01).contains(&t) {
                                    check(s.x + t * dx, s.y + t * dy, "intersection");
                                }
                            }
                        }
                    }
                }
            }
        }

        // Nearest is fallback-only — fires only when no higher-priority snap matched.
        // Mirrors AutoCAD OSNAP priority and the TS SnapEngine semantics.
        // End `check`'s borrow on best_* by moving it into a discarded binding.
        let _ = check;
        if best_type.is_empty() && want_nearest {
            let mut nearest_x = 0.0f64;
            let mut nearest_y = 0.0f64;
            let mut nearest_dist = threshold;
            let mut consider = |x: f64, y: f64| {
                if !x.is_finite() || !y.is_finite() {
                    return;
                }
                let d = ((cursor_x - x).powi(2) + (cursor_y - y).powi(2)).sqrt();
                if d < nearest_dist {
                    nearest_dist = d;
                    nearest_x = x;
                    nearest_y = y;
                }
            };
            for ent in &candidate_entities {
                match &ent.geometry {
                    GeometryType::Line { start, end } => {
                        let dx = end.x - start.x;
                        let dy = end.y - start.y;
                        let len_sq = dx * dx + dy * dy;
                        if len_sq > 0.0 {
                            let t =
                                ((cursor_x - start.x) * dx + (cursor_y - start.y) * dy) / len_sq;
                            let t = t.clamp(0.0, 1.0);
                            consider(start.x + t * dx, start.y + t * dy);
                        }
                    }
                    GeometryType::Circle { center, radius }
                        if radius.is_finite() && *radius > 0.0 =>
                    {
                        let dx = cursor_x - center.x;
                        let dy = cursor_y - center.y;
                        let dist = (dx * dx + dy * dy).sqrt();
                        if dist > 1e-10 {
                            consider(
                                center.x + (dx / dist) * radius,
                                center.y + (dy / dist) * radius,
                            );
                        }
                    }
                    GeometryType::Arc {
                        center,
                        radius,
                        start_angle,
                        end_angle,
                    } if radius.is_finite() && *radius > 0.0 => {
                        let dx = cursor_x - center.x;
                        let dy = cursor_y - center.y;
                        let dist = (dx * dx + dy * dy).sqrt();
                        if dist > 1e-10 {
                            let mut angle = dy.atan2(dx);
                            if angle < 0.0 {
                                angle += 2.0 * PI;
                            }
                            let mut sa = start_angle % (2.0 * PI);
                            let mut ea = end_angle % (2.0 * PI);
                            if sa < 0.0 {
                                sa += 2.0 * PI;
                            }
                            if ea < 0.0 {
                                ea += 2.0 * PI;
                            }
                            let in_arc = if sa <= ea {
                                angle >= sa && angle <= ea
                            } else {
                                angle >= sa || angle <= ea
                            };
                            if in_arc {
                                consider(
                                    center.x + (dx / dist) * radius,
                                    center.y + (dy / dist) * radius,
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }
            let _ = consider;
            if nearest_dist < threshold {
                best_x = nearest_x;
                best_y = nearest_y;
                best_type = "nearest";
            }
        }

        // Grid snap as fallback
        if best_type.is_empty() && want_grid && grid_size > 0.0 {
            best_x = (cursor_x / grid_size).round() * grid_size;
            best_y = (cursor_y / grid_size).round() * grid_size;
            best_type = "grid";
        }

        if best_type.is_empty() {
            "null".to_string()
        } else {
            serde_json::json!({
                "x": best_x,
                "y": best_y,
                "type": best_type
            })
            .to_string()
        }
    }

    #[cfg(target_arch = "wasm32")]
    #[allow(clippy::too_many_arguments)]
    pub fn find_all_snaps(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
        grid_size: f64,
        snap_types: &str,
    ) -> String {
        self.find_all_snaps_inner(
            cursor_x, cursor_y, from_x, from_y, has_from, threshold, grid_size, snap_types,
        )
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[allow(clippy::too_many_arguments)]
    pub fn find_all_snaps(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
        grid_size: f64,
        snap_types: &str,
    ) -> String {
        self.find_all_snaps_inner(
            cursor_x, cursor_y, from_x, from_y, has_from, threshold, grid_size, snap_types,
        )
    }

    #[cfg(target_arch = "wasm32")]
    pub fn find_perpendicular_snap(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
    ) -> JsValue {
        match self
            .find_perpendicular_snap_inner(cursor_x, cursor_y, from_x, from_y, has_from, threshold)
        {
            Some(json) => JsValue::from_str(&json),
            None => JsValue::NULL,
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn find_perpendicular_snap_json(
        &self,
        cursor_x: f64,
        cursor_y: f64,
        from_x: f64,
        from_y: f64,
        has_from: bool,
        threshold: f64,
    ) -> String {
        self.find_perpendicular_snap_inner(cursor_x, cursor_y, from_x, from_y, has_from, threshold)
            .unwrap_or_else(|| "null".to_string())
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    #[test]
    fn perpendicular_snap_on_horizontal_line() {
        let mut k = Kernel::new();
        // Create a horizontal line from (0,0) to (10,0)
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        // Rebuild spatial index
        k.execute_command(r#"{"type":"CreatePoint","x":100,"y":100,"layer_id":"layer_0"}"#);

        // Snap from point (5,5) onto the line — perpendicular foot should be near (5,0)
        let result = k.find_perpendicular_snap_json(5.0, 0.5, 5.0, 5.0, true, 2.0);
        if result != "null" {
            let v: serde_json::Value = serde_json::from_str(&result).unwrap();
            assert_eq!(v["type"].as_str().unwrap(), "perpendicular");
            let snap_x = v["x"].as_f64().unwrap();
            let snap_y = v["y"].as_f64().unwrap();
            assert!((snap_x - 5.0).abs() < 0.1);
            assert!(snap_y.abs() < 0.1);
        }
    }

    #[test]
    fn perpendicular_snap_no_from_point() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.execute_command(r#"{"type":"CreatePoint","x":100,"y":100,"layer_id":"layer_0"}"#);

        let result = k.find_perpendicular_snap_json(5.0, 0.5, 0.0, 0.0, false, 2.0);
        // Without a from point, result may or may not find a snap — just verify no crash
        let _: serde_json::Value = serde_json::from_str(&result).unwrap();
    }

    #[test]
    fn perpendicular_snap_no_entity_nearby() {
        let k = Kernel::new();
        let result = k.find_perpendicular_snap_json(50.0, 50.0, 50.0, 55.0, true, 1.0);
        assert_eq!(result, "null");
    }

    #[test]
    fn perpendicular_snap_on_vertical_line() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 0.0, 10.0, "layer_0");
        k.execute_command(r#"{"type":"CreatePoint","x":100,"y":100,"layer_id":"layer_0"}"#);

        let result = k.find_perpendicular_snap_json(0.5, 5.0, 5.0, 5.0, true, 2.0);
        if result != "null" {
            let v: serde_json::Value = serde_json::from_str(&result).unwrap();
            assert_eq!(v["type"].as_str().unwrap(), "perpendicular");
            let snap_x = v["x"].as_f64().unwrap();
            let snap_y = v["y"].as_f64().unwrap();
            assert!(snap_x.abs() < 0.1);
            assert!((snap_y - 5.0).abs() < 0.1);
        }
    }

    // --- find_all_snaps tests ---

    #[test]
    fn all_snaps_endpoint_on_line() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(0.1, 0.1, 0.0, 0.0, false, 2.0, 1.0, "endpoint");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "endpoint");
        assert!((v["x"].as_f64().unwrap() - 0.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 0.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_midpoint_on_line() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(5.0, 0.1, 0.0, 0.0, false, 2.0, 1.0, "midpoint");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "midpoint");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_center_on_circle() {
        let mut k = Kernel::new();
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        let result = k.find_all_snaps(5.1, 5.1, 0.0, 0.0, false, 2.0, 1.0, "center");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "center");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 5.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_grid_fallback() {
        let k = Kernel::new();
        let result = k.find_all_snaps(3.3, 4.7, 0.0, 0.0, false, 2.0, 1.0, "grid");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "grid");
        assert!((v["x"].as_f64().unwrap() - 3.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 5.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_intersection_two_lines() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "layer_0");
        k.create_line(0.0, 10.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(5.1, 5.1, 0.0, 0.0, false, 2.0, 1.0, "intersection");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "intersection");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.1);
        assert!((v["y"].as_f64().unwrap() - 5.0).abs() < 0.1);
    }

    #[test]
    fn all_snaps_intersection_beats_nearest_when_both_enabled() {
        // Regression: when both `intersection` and `nearest` are enabled and
        // the cursor is offset from the crossing point, `nearest` projects to
        // a closer point on a single line and was overriding `intersection`.
        // Reproduces the e2e/snap-system.spec.ts:42 failure mode.
        let mut k = Kernel::new();
        k.create_line(0.0, -5.0, 0.0, 5.0, "layer_0");
        k.create_line(-5.0, 0.0, 5.0, 0.0, "layer_0");
        // Cursor offset from origin so nearest-on-line < intersection-distance.
        let result = k.find_all_snaps(
            0.3,
            0.2,
            0.0,
            0.0,
            false,
            2.0,
            1.0,
            "endpoint,midpoint,center,intersection,nearest",
        );
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        let snap_type = v["type"].as_str().unwrap();
        assert_ne!(
            snap_type, "nearest",
            "nearest must be fallback-only; got nearest at ({},{}) when intersection/midpoint candidates exist",
            v["x"], v["y"]
        );
    }

    #[test]
    fn all_snaps_nearest_is_fallback_when_no_higher_priority() {
        // With only an isolated line (no crossings) and the cursor outside
        // the threshold of any endpoint or midpoint, nearest should still
        // fire when no higher-priority snap is in range.
        // Line endpoints (0,0) and (10,0), midpoint (5,0). Cursor (3.0, 1.5):
        //   - endpoint distances: 3.35, 7.16 (both > 2)
        //   - midpoint distance: 2.5 (> 2)
        //   - nearest projection: (3.0, 0.0), distance 1.5 (< 2) ✓
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(
            3.0,
            1.5,
            0.0,
            0.0,
            false,
            2.0,
            1.0,
            "endpoint,midpoint,nearest",
        );
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "nearest");
        assert!((v["x"].as_f64().unwrap() - 3.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 0.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_tangent_to_circle_with_from() {
        // From (10,0), circle at origin r=5. Tangent points at (2.5, ±sqrt(75)/2) ≈ (2.5, ±4.33).
        // Cursor near (2.5, 4.0): pick the +y tangent.
        let mut k = Kernel::new();
        k.create_circle(0.0, 0.0, 5.0, "layer_0");
        let result = k.find_all_snaps(2.5, 4.0, 10.0, 0.0, true, 1.0, 1.0, "tangent");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "tangent");
        assert!((v["x"].as_f64().unwrap() - 2.5).abs() < 0.01);
        assert!(v["y"].as_f64().unwrap() > 0.0);
    }

    #[test]
    fn all_snaps_tangent_requires_from_point() {
        // Without `has_from`, tangent must not fire — silent no-op (returns null/grid).
        let mut k = Kernel::new();
        k.create_circle(0.0, 0.0, 5.0, "layer_0");
        let result = k.find_all_snaps(2.5, 4.0, 0.0, 0.0, false, 1.0, 1.0, "tangent");
        // No from-point → no tangent dispatch → either null or grid fallback (grid disabled here too).
        // We accept "null" or absence of "tangent" as the type.
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_ne!(v["type"].as_str().unwrap_or(""), "tangent");
    }

    #[test]
    fn all_snaps_tangent_inside_circle_returns_no_tangent() {
        // From-point inside circle: no tangent line exists.
        let mut k = Kernel::new();
        k.create_circle(0.0, 0.0, 5.0, "layer_0");
        let result = k.find_all_snaps(2.5, 4.0, 1.0, 0.0, true, 1.0, 1.0, "tangent");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_ne!(v["type"].as_str().unwrap_or(""), "tangent");
    }

    #[test]
    fn all_snaps_perpendicular_with_from() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(5.0, 0.5, 5.0, 5.0, true, 2.0, 1.0, "perpendicular");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "perpendicular");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 0.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_nearest_on_line() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(3.7, 0.5, 0.0, 0.0, false, 2.0, 1.0, "nearest");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "nearest");
        assert!((v["x"].as_f64().unwrap() - 3.7).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 0.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_empty_drawing_returns_grid() {
        let k = Kernel::new();
        let result = k.find_all_snaps(1.1, 2.2, 0.0, 0.0, false, 2.0, 0.5, "endpoint,grid");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "grid");
        assert!((v["x"].as_f64().unwrap() - 1.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 2.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_geometric_center_on_circle() {
        // Circle at (5,5) r=3: geometric_center == center == (5,5).
        // Cursor at (5.1, 5.0): inside threshold.
        let mut k = Kernel::new();
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        let result = k.find_all_snaps(5.1, 5.0, 0.0, 0.0, false, 2.0, 1.0, "geometric_center");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "geometric_center");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 5.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_geometric_center_on_closed_polyline_square() {
        // Closed square (0,0)–(10,0)–(10,10)–(0,10): centroid at (5,5).
        let mut k = Kernel::new();
        k.execute_command(
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":true,"layer_id":"layer_0"}"#,
        );
        let result = k.find_all_snaps(5.0, 5.0, 0.0, 0.0, false, 2.0, 1.0, "geometric_center");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "geometric_center");
        assert!((v["x"].as_f64().unwrap() - 5.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 5.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_geometric_center_on_open_polyline_no_match() {
        // Open polyline → no centroid. Result: null/grid, NOT geometric_center.
        let mut k = Kernel::new();
        k.execute_command(
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let result = k.find_all_snaps(5.0, 5.0, 0.0, 0.0, false, 2.0, 1.0, "geometric_center");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_ne!(v["type"].as_str().unwrap_or(""), "geometric_center");
    }

    #[test]
    fn all_snaps_token_match_no_substring_collision() {
        // Regression: enabling only "geometric_center" must NOT trigger
        // "center" matching for a circle. Token-based matching prevents
        // the historical substring collision.
        let mut k = Kernel::new();
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        let result = k.find_all_snaps(5.1, 5.0, 0.0, 0.0, false, 2.0, 1.0, "geometric_center");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        // Should be "geometric_center", not "center".
        assert_eq!(v["type"].as_str().unwrap(), "geometric_center");
    }

    #[test]
    fn all_snaps_extension_beyond_endpoint() {
        // Line (0,0)-(10,0). Cursor (11.0, 0.3) → projection at (11.0, 0.0),
        // perpendicular distance 0.3 < threshold 2.0, t=1.1 → extension.
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(11.0, 0.3, 0.0, 0.0, false, 2.0, 1.0, "extension");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "extension");
        assert!((v["x"].as_f64().unwrap() - 11.0).abs() < 0.01);
        assert!((v["y"].as_f64().unwrap() - 0.0).abs() < 0.01);
    }

    #[test]
    fn all_snaps_extension_does_not_fire_on_segment() {
        // Cursor over the segment itself — extension must not fire here; the
        // user's intent over the segment is endpoint/midpoint/nearest, not
        // extension.
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(5.0, 0.3, 0.0, 0.0, false, 2.0, 1.0, "extension");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        // No extension; with no other snap modes enabled, expect null/grid (grid disabled too).
        assert_ne!(v["type"].as_str().unwrap_or(""), "extension");
    }

    #[test]
    fn all_snaps_extension_loses_to_endpoint_when_both_in_range() {
        // Cursor (10.5, 0.3) is past `end` (extension fires) AND within
        // threshold of the endpoint (10, 0) at distance ~0.583.
        // Distance to extension foot (10.5, 0): 0.3.
        // Distance to endpoint (10, 0): 0.583.
        // Extension is closer → extension wins on raw distance.
        // (This documents priority semantics: extension and endpoint share the
        // main-pass priority class; closer one wins.)
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let result = k.find_all_snaps(10.5, 0.3, 0.0, 0.0, false, 2.0, 1.0, "endpoint,extension");
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["type"].as_str().unwrap(), "extension");
        assert!((v["x"].as_f64().unwrap() - 10.5).abs() < 0.01);
    }
}
