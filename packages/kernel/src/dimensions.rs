use crate::commands::CommandResult;
use crate::entity::{GeometryType, Point2D};
use crate::world::NexusWorld;

pub(crate) fn measure_distance_cmd(x1: f64, y1: f64, x2: f64, y2: f64) -> CommandResult {
    let d = Point2D::new(x1, y1).distance_to(&Point2D::new(x2, y2));
    CommandResult {
        success: true,
        created_ids: vec![],
        error: None,
        measurement: Some(d),
        warnings: vec![],
    }
}

pub(crate) fn measure_area_cmd(world: &NexusWorld, entity_id: &str) -> CommandResult {
    if let Some(entity) = world.get_entity_cloned(entity_id) {
        let area = match &entity.geometry {
            GeometryType::Rectangle { width, height, .. } => Some((width * height).abs()),
            GeometryType::Polyline { vertices, closed } if *closed && vertices.len() >= 3 => {
                let n = vertices.len();
                let mut a = 0.0;
                for i in 0..n {
                    let j = (i + 1) % n;
                    a += vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
                }
                Some((a / 2.0).abs())
            }
            GeometryType::Circle { radius, .. } => Some(std::f64::consts::PI * radius * radius),
            GeometryType::Ellipse {
                semi_major,
                semi_minor,
                ..
            } => Some(std::f64::consts::PI * semi_major * semi_minor),
            _ => None,
        };
        CommandResult {
            success: area.is_some(),
            created_ids: vec![],
            error: if area.is_none() {
                Some("Cannot measure area".into())
            } else {
                None
            },
            measurement: area,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Entity not found".into()),
            measurement: None,
            warnings: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    // --- MeasureDistance ---

    #[test]
    fn measure_distance_3_4_5_triangle() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MeasureDistance","x1":0.0,"y1":0.0,"x2":3.0,"y2":4.0}"#,
        );
        assert_eq!(r["success"], true);
        let dist = r["measurement"].as_f64().unwrap();
        assert!((dist - 5.0).abs() < 1e-9, "expected 5.0, got {dist}");
    }

    #[test]
    fn measure_distance_same_point_is_zero() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MeasureDistance","x1":5.0,"y1":5.0,"x2":5.0,"y2":5.0}"#,
        );
        assert_eq!(r["success"], true);
        let dist = r["measurement"].as_f64().unwrap();
        assert!(dist < 1e-9, "expected 0, got {dist}");
    }

    #[test]
    fn measure_distance_horizontal_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MeasureDistance","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0}"#,
        );
        let dist = r["measurement"].as_f64().unwrap();
        assert!((dist - 10.0).abs() < 1e-9, "expected 10.0, got {dist}");
    }

    #[test]
    fn measure_distance_negative_coords() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MeasureDistance","x1":-3.0,"y1":-4.0,"x2":0.0,"y2":0.0}"#,
        );
        let dist = r["measurement"].as_f64().unwrap();
        assert!((dist - 5.0).abs() < 1e-9, "expected 5.0, got {dist}");
    }

    // --- MeasureArea: Rectangle ---

    #[test]
    fn measure_area_rectangle_10x5() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0.0,"y":0.0,"width":10.0,"height":5.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(mr["success"], true);
        let area = mr["measurement"].as_f64().unwrap();
        assert!((area - 50.0).abs() < 1e-9, "expected 50.0, got {area}");
    }

    #[test]
    fn measure_area_rectangle_unit_square() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0.0,"y":0.0,"width":1.0,"height":1.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        let area = mr["measurement"].as_f64().unwrap();
        assert!((area - 1.0).abs() < 1e-9, "expected 1.0, got {area}");
    }

    // --- MeasureArea: Circle ---

    #[test]
    fn measure_area_circle_radius_5() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0.0,"cy":0.0,"radius":5.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(mr["success"], true);
        let area = mr["measurement"].as_f64().unwrap();
        let expected = std::f64::consts::PI * 25.0;
        assert!(
            (area - expected).abs() < 0.1,
            "expected {expected}, got {area}"
        );
    }

    // --- MeasureArea: Closed Polyline ---

    #[test]
    fn measure_area_closed_polyline_triangle() {
        let mut k = Kernel::new();
        // Right triangle: (0,0), (6,0), (0,8) → area = 0.5 * 6 * 8 = 24
        let r = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0.0,0.0],[6.0,0.0],[0.0,8.0]],"closed":true,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(mr["success"], true);
        let area = mr["measurement"].as_f64().unwrap();
        assert!((area - 24.0).abs() < 0.01, "expected 24.0, got {area}");
    }

    #[test]
    fn measure_area_open_polyline_returns_error() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0.0,0.0],[6.0,0.0],[0.0,8.0]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(
            mr["success"], false,
            "open polyline should fail area measurement"
        );
        assert!(mr["error"].as_str().is_some());
    }

    // --- MeasureArea: Ellipse ---

    #[test]
    fn measure_area_ellipse() {
        let mut k = Kernel::new();
        // semi_major=5, semi_minor=3 → area = π * 5 * 3 ≈ 47.12
        let r = exec(
            &mut k,
            r#"{"type":"CreateEllipse","cx":0.0,"cy":0.0,"semi_major":5.0,"semi_minor":3.0,"rotation":0.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(mr["success"], true);
        let area = mr["measurement"].as_f64().unwrap();
        let expected = std::f64::consts::PI * 5.0 * 3.0;
        assert!(
            (area - expected).abs() < 0.1,
            "expected {expected}, got {area}"
        );
    }

    // --- MeasureArea: Error cases ---

    #[test]
    fn measure_area_nonexistent_entity_returns_error() {
        let mut k = Kernel::new();
        let mr = exec(&mut k, r#"{"type":"MeasureArea","entity_id":"ent_999"}"#);
        assert_eq!(mr["success"], false);
        assert!(mr["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn measure_area_line_returns_error() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(r#"{{"type":"MeasureArea","entity_id":"{}"}}"#, id);
        let mr = exec(&mut k, &cmd);
        assert_eq!(mr["success"], false, "line has no area");
        assert!(mr["error"].as_str().is_some());
    }
}
