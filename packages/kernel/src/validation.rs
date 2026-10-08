use crate::entity;
use crate::tolerance;
use crate::Kernel;

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    #[allow(clippy::collapsible_match)]
    pub(crate) fn validate_entity(&self, id: &str) -> Vec<String> {
        let Some(entity) = self.ecs_world.get_entity_cloned(id) else {
            return vec![];
        };
        let mut warnings = Vec::new();
        match &entity.geometry {
            entity::GeometryType::Line { start, end } => {
                if start.distance_to(end) < tolerance::ZERO_LENGTH {
                    warnings
                        .push("Zero-length line: start and end points are coincident".to_string());
                }
            }
            entity::GeometryType::Circle { radius, .. } => {
                if *radius < tolerance::ZERO_LENGTH {
                    warnings
                        .push("Zero-radius circle: radius is below minimum threshold".to_string());
                }
            }
            entity::GeometryType::Arc {
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
                    warnings
                        .push("Zero-sweep arc: start and end angles are coincident".to_string());
                }
            }
            entity::GeometryType::Polyline { vertices, .. } => {
                if vertices.len() < 2 {
                    warnings.push("Degenerate polyline: fewer than 2 vertices".to_string());
                }
            }
            entity::GeometryType::Rectangle { width, height, .. } => {
                if width.abs() < tolerance::ZERO_LENGTH {
                    warnings.push("Zero-width rectangle".to_string());
                }
                if height.abs() < tolerance::ZERO_LENGTH {
                    warnings.push("Zero-height rectangle".to_string());
                }
            }
            entity::GeometryType::Ellipse {
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
            entity::GeometryType::Spline {
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
                        "Invalid spline: degree exceeds number of control points minus 1"
                            .to_string(),
                    );
                }
            }
            entity::GeometryType::Text {
                content, height, ..
            }
            | entity::GeometryType::MText {
                content, height, ..
            } => {
                if content.is_empty() {
                    warnings.push("Empty text content".to_string());
                }
                if *height < tolerance::ZERO_LENGTH {
                    warnings.push("Zero-height text".to_string());
                }
            }
            entity::GeometryType::ConstructionLine { direction, .. } => {
                let len = (direction.x * direction.x + direction.y * direction.y).sqrt();
                if len < tolerance::ZERO_LENGTH {
                    warnings.push("Zero-length construction line direction vector".to_string());
                }
            }
            entity::GeometryType::Hatch {
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
            entity::GeometryType::RevisionCloud {
                boundary,
                arc_length,
            } => {
                if boundary.len() < 3 {
                    warnings.push(
                        "Degenerate revision cloud: fewer than 3 boundary points".to_string(),
                    );
                }
                if *arc_length < tolerance::ZERO_LENGTH {
                    warnings.push("Zero arc-length revision cloud".to_string());
                }
            }
            entity::GeometryType::Table {
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
            entity::GeometryType::BlockRef { block_id, .. } => {
                if !self.block_defs.iter().any(|b| b.id == *block_id) {
                    warnings.push(format!("BlockRef references unknown block '{}'", block_id));
                }
            }
            entity::GeometryType::AngularDimension { radius, .. } => {
                if *radius < tolerance::ZERO_LENGTH {
                    warnings.push("Zero-radius angular dimension".to_string());
                }
            }
            _ => {}
        }
        warnings
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    // --- Valid entities produce no warnings ---

    #[test]
    fn validate_valid_line() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_circle() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_arc() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 0.0, 1.57, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_rectangle() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 10.0, 5.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_ellipse() {
        let mut k = Kernel::new();
        let id = k.create_ellipse(0.0, 0.0, 8.0, 4.0, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_polyline() {
        let mut k = Kernel::new();
        let id = k.create_polyline("[0,0,10,0,10,10]", false, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_text() {
        let mut k = Kernel::new();
        let id = k.create_text(0.0, 0.0, "Hello", 2.5, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    #[test]
    fn validate_valid_construction_line() {
        let mut k = Kernel::new();
        let id = k.create_construction_line(0.0, 0.0, 1.0, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.is_empty());
    }

    // --- Degenerate entities rejected at creation (return empty string) ---

    #[test]
    fn degenerate_zero_length_line_rejected() {
        let mut k = Kernel::new();
        let id = k.create_line(5.0, 5.0, 5.0, 5.0, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_zero_radius_circle_rejected() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 0.0, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_zero_radius_arc_rejected() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 0.0, 0.0, 1.57, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_zero_sweep_arc_rejected() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 1.0, 1.0, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_zero_width_rectangle_rejected() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 0.0, 5.0, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_zero_height_rectangle_rejected() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 10.0, 0.0, "layer_0");
        assert!(id.is_empty());
    }

    #[test]
    fn degenerate_single_vertex_polyline_rejected() {
        let mut k = Kernel::new();
        let id = k.create_polyline("[5,5]", false, "layer_0");
        assert!(id.is_empty());
    }

    // --- Entities that pass is_degenerate but have validate_entity warnings ---

    #[test]
    fn validate_zero_semi_major_ellipse() {
        let mut k = Kernel::new();
        let id = k.create_ellipse(0.0, 0.0, 0.0, 0.0, 0.0, "layer_0");
        // Ellipse is not rejected by is_degenerate, so id is valid
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.iter().any(|w| w.contains("semi-major")));
    }

    #[test]
    fn validate_semi_minor_exceeds_major() {
        let mut k = Kernel::new();
        let id = k.create_ellipse(0.0, 0.0, 3.0, 10.0, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings
            .iter()
            .any(|w| w.contains("semi-minor exceeds semi-major")));
    }

    #[test]
    fn validate_empty_text() {
        let mut k = Kernel::new();
        let id = k.create_text(0.0, 0.0, "", 2.5, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.iter().any(|w| w.contains("Empty text")));
    }

    #[test]
    fn validate_zero_height_text() {
        let mut k = Kernel::new();
        let id = k.create_text(0.0, 0.0, "Hello", 0.0, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings.iter().any(|w| w.contains("Zero-height text")));
    }

    #[test]
    fn validate_zero_direction_construction_line() {
        let mut k = Kernel::new();
        let id = k.create_construction_line(0.0, 0.0, 0.0, 0.0, "layer_0");
        assert!(!id.is_empty());
        let warnings = k.validate_entity(&id);
        assert!(warnings
            .iter()
            .any(|w| w.contains("Zero-length construction line")));
    }

    #[test]
    fn validate_nonexistent_entity() {
        let k = Kernel::new();
        let warnings = k.validate_entity("nonexistent");
        assert!(warnings.is_empty());
    }
}
