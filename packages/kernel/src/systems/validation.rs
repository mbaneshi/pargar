use crate::entity::GeometryType;
use crate::tolerance;
use crate::world::NexusWorld;

pub fn validate_geometry(geom: &GeometryType) -> Vec<String> {
    let mut warnings = Vec::new();
    match geom {
        GeometryType::Line { start, end } if start.distance_to(end) < tolerance::ZERO_LENGTH => {
            warnings.push("Zero-length line: start and end points are coincident".to_string());
        }
        GeometryType::Circle { radius, .. } if *radius < tolerance::ZERO_LENGTH => {
            warnings.push("Zero-radius circle: radius is below minimum threshold".to_string());
        }
        GeometryType::Arc {
            radius,
            start_angle,
            end_angle,
            ..
        } => {
            if *radius < tolerance::ZERO_LENGTH {
                warnings.push("Zero-radius arc: radius is below minimum threshold".to_string());
            }
            let sweep = (end_angle - start_angle).abs();
            if sweep < tolerance::ZERO_LENGTH {
                warnings.push("Zero-sweep arc: start and end angles are coincident".to_string());
            }
        }
        GeometryType::Polyline { vertices, .. } if vertices.len() < 2 => {
            warnings.push("Degenerate polyline: fewer than 2 vertices".to_string());
        }
        GeometryType::Rectangle { width, height, .. } => {
            if width.abs() < tolerance::ZERO_LENGTH {
                warnings.push("Zero-width rectangle".to_string());
            }
            if height.abs() < tolerance::ZERO_LENGTH {
                warnings.push("Zero-height rectangle".to_string());
            }
        }
        GeometryType::Ellipse {
            semi_major,
            semi_minor,
            ..
        } => {
            if *semi_major < tolerance::ZERO_LENGTH {
                warnings.push("Zero-length semi-major axis".to_string());
            }
            if *semi_minor < tolerance::ZERO_LENGTH {
                warnings.push("Zero-length semi-minor axis".to_string());
            }
            if *semi_minor > *semi_major + tolerance::ZERO_LENGTH {
                warnings.push("Invalid ellipse: semi-minor exceeds semi-major".to_string());
            }
        }
        GeometryType::Spline {
            control_points,
            degree,
            ..
        } => {
            if control_points.len() < 2 {
                warnings.push("Degenerate spline: fewer than 2 control points".to_string());
            }
            if *degree == 0 {
                warnings.push("Invalid spline: degree is 0".to_string());
            }
            if (*degree as usize) >= control_points.len() {
                warnings.push(
                    "Invalid spline: degree exceeds number of control points minus 1".to_string(),
                );
            }
        }
        GeometryType::Text {
            content, height, ..
        }
        | GeometryType::MText {
            content, height, ..
        } => {
            if content.is_empty() {
                warnings.push("Empty text content".to_string());
            }
            if *height < tolerance::ZERO_LENGTH {
                warnings.push("Zero-height text".to_string());
            }
        }
        GeometryType::ConstructionLine { direction, .. } => {
            let len = (direction.x * direction.x + direction.y * direction.y).sqrt();
            if len < tolerance::ZERO_LENGTH {
                warnings.push("Zero-length construction line direction vector".to_string());
            }
        }
        GeometryType::Hatch {
            boundary_ids,
            scale,
            ..
        } => {
            if boundary_ids.is_empty() {
                warnings.push("Hatch has no boundary entities".to_string());
            }
            if *scale < tolerance::ZERO_LENGTH {
                warnings.push("Zero-scale hatch pattern".to_string());
            }
        }
        GeometryType::RevisionCloud {
            boundary,
            arc_length,
        } => {
            if boundary.len() < 3 {
                warnings
                    .push("Degenerate revision cloud: fewer than 3 boundary points".to_string());
            }
            if *arc_length < tolerance::ZERO_LENGTH {
                warnings.push("Zero arc-length revision cloud".to_string());
            }
        }
        GeometryType::Table {
            rows,
            cols,
            col_widths,
            ..
        } => {
            if *rows == 0 || *cols == 0 {
                warnings.push("Zero-dimension table: rows or cols is 0".to_string());
            }
            if col_widths.len() != *cols as usize {
                warnings.push("Table col_widths length does not match cols".to_string());
            }
        }
        GeometryType::AngularDimension { radius, .. } if *radius < tolerance::ZERO_LENGTH => {
            warnings.push("Zero-radius angular dimension".to_string());
        }
        _ => {}
    }
    warnings
}

pub fn validate_entity(world: &NexusWorld, id: &str) -> Vec<String> {
    let Some(geo) = world.get_geometry(id) else {
        return vec![];
    };
    validate_geometry(&geo)
}

pub fn validate_all(world: &NexusWorld) -> Vec<(String, Vec<String>)> {
    let ids: Vec<String> = world.iter_entity_ids().cloned().collect();
    let mut results = Vec::new();
    for id in ids {
        let warnings = validate_entity(world, &id);
        if !warnings.is_empty() {
            results.push((id, warnings));
        }
    }
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{EntityStyle, Point2D};

    fn default_style() -> EntityStyle {
        EntityStyle::default()
    }

    #[test]
    fn valid_line() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(0.0, 0.0),
                end: Point2D::new(10.0, 0.0),
            },
            "l",
            default_style(),
        );
        assert!(validate_entity(&w, &id).is_empty());
    }

    #[test]
    fn zero_length_line() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(5.0, 5.0),
                end: Point2D::new(5.0, 5.0),
            },
            "l",
            default_style(),
        );
        let warnings = validate_entity(&w, &id);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("Zero-length line"));
    }

    #[test]
    fn zero_radius_circle() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(0.0, 0.0),
                radius: 0.0,
            },
            "l",
            default_style(),
        );
        let warnings = validate_entity(&w, &id);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("Zero-radius circle"));
    }

    #[test]
    fn zero_sweep_arc() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Arc {
                center: Point2D::new(0.0, 0.0),
                radius: 5.0,
                start_angle: 1.0,
                end_angle: 1.0,
            },
            "l",
            default_style(),
        );
        let warnings = validate_entity(&w, &id);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("Zero-sweep arc"));
    }

    #[test]
    fn degenerate_polyline() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Polyline {
                vertices: vec![Point2D::new(0.0, 0.0)],
                closed: false,
            },
            "l",
            default_style(),
        );
        let warnings = validate_entity(&w, &id);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("Degenerate polyline"));
    }

    #[test]
    fn valid_rectangle() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Rectangle {
                origin: Point2D::new(0.0, 0.0),
                width: 10.0,
                height: 5.0,
                rotation: 0.0,
            },
            "l",
            default_style(),
        );
        assert!(validate_entity(&w, &id).is_empty());
    }

    #[test]
    fn zero_width_rectangle() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Rectangle {
                origin: Point2D::new(0.0, 0.0),
                width: 0.0,
                height: 5.0,
                rotation: 0.0,
            },
            "l",
            default_style(),
        );
        let warnings = validate_entity(&w, &id);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].contains("Zero-width rectangle"));
    }

    #[test]
    fn validate_all_multiple() {
        let mut w = NexusWorld::new();
        // Valid line
        w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(0.0, 0.0),
                end: Point2D::new(10.0, 0.0),
            },
            "l",
            default_style(),
        );
        // Valid circle
        w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(5.0, 5.0),
                radius: 3.0,
            },
            "l",
            default_style(),
        );
        // Invalid: zero-radius circle
        w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(0.0, 0.0),
                radius: 0.0,
            },
            "l",
            default_style(),
        );

        let results = validate_all(&w);
        assert_eq!(results.len(), 1);
        assert!(results[0].1[0].contains("Zero-radius circle"));
    }

    #[test]
    fn parity_with_kernel() {
        use crate::Kernel;

        // Kernel now rejects degenerate entities — verify rejection
        let mut k = Kernel::new();
        let kid = k.create_line(5.0, 5.0, 5.0, 5.0, "layer_0");
        assert!(kid.is_empty(), "Kernel should reject zero-length line");

        // NexusWorld validation still detects degenerate entities
        let mut w = NexusWorld::new();
        let wid = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(5.0, 5.0),
                end: Point2D::new(5.0, 5.0),
            },
            "layer_0",
            default_style(),
        );
        let w_warnings = validate_entity(&w, &wid);
        assert!(
            !w_warnings.is_empty(),
            "NexusWorld should detect zero-length line"
        );
    }
}
