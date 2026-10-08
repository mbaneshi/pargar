use crate::commands::CommandResult;
use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};
use crate::events::{CadEvent, EventStore};
use std::collections::HashSet;

pub(crate) fn new_point(id: String, x: f64, y: f64, layer_id: &str) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Point {
            position: Point2D::new(x, y),
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_line(id: String, x1: f64, y1: f64, x2: f64, y2: f64, layer_id: &str) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Line {
            start: Point2D::new(x1, y1),
            end: Point2D::new(x2, y2),
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_circle(id: String, cx: f64, cy: f64, radius: f64, layer_id: &str) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Circle {
            center: Point2D::new(cx, cy),
            radius,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_arc(
    id: String,
    cx: f64,
    cy: f64,
    radius: f64,
    start_angle: f64,
    end_angle: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Arc {
            center: Point2D::new(cx, cy),
            radius,
            start_angle,
            end_angle,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_rectangle(
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Rectangle {
            origin: Point2D::new(x, y),
            width,
            height,
            rotation: 0.0,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_polyline(id: String, coords_json: &str, closed: bool, layer_id: &str) -> Entity {
    let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
    let vertices: Vec<Point2D> = coords
        .chunks(2)
        .filter(|c| c.len() == 2)
        .map(|c| Point2D::new(c[0], c[1]))
        .collect();
    Entity {
        id,
        geometry: GeometryType::Polyline { vertices, closed },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_text(
    id: String,
    x: f64,
    y: f64,
    content: &str,
    height: f64,
    rotation: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Text {
            position: Point2D::new(x, y),
            content: content.to_string(),
            height,
            rotation,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_dimension(
    id: String,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    offset: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Dimension {
            start: Point2D::new(x1, y1),
            end: Point2D::new(x2, y2),
            offset,
            text_override: None,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_ellipse(
    id: String,
    cx: f64,
    cy: f64,
    semi_major: f64,
    semi_minor: f64,
    rotation: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::Ellipse {
            center: Point2D::new(cx, cy),
            semi_major,
            semi_minor,
            rotation,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_spline(
    id: String,
    control_points_json: &str,
    degree: u8,
    closed: bool,
    layer_id: &str,
) -> Entity {
    let points: Vec<(f64, f64)> = serde_json::from_str(control_points_json).unwrap_or_default();
    let control_points: Vec<Point2D> = points
        .into_iter()
        .map(|(x, y)| Point2D::new(x, y))
        .collect();
    Entity {
        id,
        geometry: GeometryType::Spline {
            control_points,
            degree,
            closed,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_construction_line(
    id: String,
    ox: f64,
    oy: f64,
    dx: f64,
    dy: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::ConstructionLine {
            origin: Point2D::new(ox, oy),
            direction: Point2D::new(dx, dy),
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_aligned_dimension(
    id: String,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    offset: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::AlignedDimension {
            start: Point2D::new(x1, y1),
            end: Point2D::new(x2, y2),
            offset,
            text_override: None,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn new_angular_dimension(
    id: String,
    cx: f64,
    cy: f64,
    sx: f64,
    sy: f64,
    ex: f64,
    ey: f64,
    radius: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::AngularDimension {
            center: Point2D::new(cx, cy),
            start_ray: Point2D::new(sx, sy),
            end_ray: Point2D::new(ex, ey),
            radius,
            text_override: None,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_radial_dimension(
    id: String,
    cx: f64,
    cy: f64,
    px: f64,
    py: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::RadialDimension {
            center: Point2D::new(cx, cy),
            point_on_arc: Point2D::new(px, py),
            text_override: None,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_revision_cloud(
    id: String,
    boundary: Vec<Point2D>,
    arc_length: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::RevisionCloud {
            boundary,
            arc_length,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

pub(crate) fn new_diameter_dimension(
    id: String,
    cx: f64,
    cy: f64,
    px: f64,
    py: f64,
    layer_id: &str,
) -> Entity {
    Entity {
        id,
        geometry: GeometryType::DiameterDimension {
            center: Point2D::new(cx, cy),
            point_on_arc: Point2D::new(px, py),
            text_override: None,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn create_hatch_cmd(
    id: String,
    world: &mut crate::world::NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    boundary_ids: Vec<String>,
    pattern: &str,
    scale: f64,
    angle: f64,
    layer_id: &str,
) -> CommandResult {
    let entity = Entity {
        id: id.clone(),
        geometry: GeometryType::Hatch {
            boundary_ids,
            pattern: pattern.to_string(),
            scale,
            angle,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    };
    event_store.push(CadEvent::EntityCreated {
        entity: entity.clone(),
    });
    last_created_id.replace(id.clone());
    world.insert_entity(entity);
    dirty_ids.insert(id.clone());
    CommandResult {
        success: true,
        created_ids: vec![id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn create_mtext_cmd(
    id: String,
    world: &mut crate::world::NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    x: f64,
    y: f64,
    content: &str,
    width: f64,
    height: f64,
    rotation: f64,
    layer_id: &str,
) -> CommandResult {
    let entity = Entity {
        id: id.clone(),
        geometry: GeometryType::MText {
            position: Point2D::new(x, y),
            content: content.to_string(),
            width,
            height,
            rotation,
            style_name: None,
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    };
    event_store.push(CadEvent::EntityCreated {
        entity: entity.clone(),
    });
    last_created_id.replace(id.clone());
    world.insert_entity(entity);
    dirty_ids.insert(id.clone());
    CommandResult {
        success: true,
        created_ids: vec![id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn create_table_cmd(
    id: String,
    world: &mut crate::world::NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    x: f64,
    y: f64,
    rows: u32,
    cols: u32,
    row_height: f64,
    col_widths: Vec<f64>,
    cells: Vec<String>,
    layer_id: &str,
    current_table_style: &str,
) -> CommandResult {
    let entity = Entity {
        id: id.clone(),
        geometry: GeometryType::Table {
            position: Point2D::new(x, y),
            rows,
            cols,
            row_height,
            col_widths,
            cells,
            style_name: Some(current_table_style.to_string()),
        },
        layer_id: layer_id.to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    };
    event_store.push(CadEvent::EntityCreated {
        entity: entity.clone(),
    });
    last_created_id.replace(id.clone());
    world.insert_entity(entity);
    dirty_ids.insert(id.clone());
    CommandResult {
        success: true,
        created_ids: vec![id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    #[test]
    fn create_point() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePoint","x":5,"y":10,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let pos = &ents[0]["geometry"]["Point"]["position"];
        assert!((pos["x"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((pos["y"].as_f64().unwrap() - 10.0).abs() < 1e-9);
    }

    #[test]
    fn create_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        assert!(ents[0]["geometry"]["Line"].is_object());
        assert!((ents[0]["geometry"]["Line"]["end"]["x"].as_f64().unwrap() - 10.0).abs() < 1e-9);
    }

    #[test]
    fn create_circle() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":3,"cy":4,"radius":7,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let circle = &ents[0]["geometry"]["Circle"];
        assert!((circle["radius"].as_f64().unwrap() - 7.0).abs() < 1e-9);
        assert!((circle["center"]["x"].as_f64().unwrap() - 3.0).abs() < 1e-9);
        assert!((circle["center"]["y"].as_f64().unwrap() - 4.0).abs() < 1e-9);
    }

    #[test]
    fn create_arc() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":5,"start_angle":0,"end_angle":1.5707963267948966,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let arc = &ents[0]["geometry"]["Arc"];
        assert!((arc["radius"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((arc["start_angle"].as_f64().unwrap()).abs() < 1e-9);
    }

    #[test]
    fn create_rectangle() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":1,"y":2,"width":10,"height":5,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let rect = &ents[0]["geometry"]["Rectangle"];
        assert!((rect["width"].as_f64().unwrap() - 10.0).abs() < 1e-9);
        assert!((rect["height"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((rect["origin"]["x"].as_f64().unwrap() - 1.0).abs() < 1e-9);
    }

    #[test]
    fn create_polyline_closed() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":true,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let poly = &ents[0]["geometry"]["Polyline"];
        assert_eq!(poly["vertices"].as_array().unwrap().len(), 4);
        assert_eq!(poly["closed"].as_bool().unwrap(), true);
    }

    #[test]
    fn create_polyline_open() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[5,5],[10,0]],"closed":false,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let poly = &ents[0]["geometry"]["Polyline"];
        assert_eq!(poly["closed"].as_bool().unwrap(), false);
        assert_eq!(poly["vertices"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn create_text() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateText","x":5,"y":10,"content":"LOT 1","height":2.5,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let text = &ents[0]["geometry"]["Text"];
        assert_eq!(text["content"].as_str().unwrap(), "LOT 1");
        assert!((text["height"].as_f64().unwrap() - 2.5).abs() < 1e-9);
    }

    #[test]
    fn create_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":3,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let dim = &ents[0]["geometry"]["Dimension"];
        assert!((dim["offset"].as_f64().unwrap() - 3.0).abs() < 1e-9);
        assert!((dim["end"]["x"].as_f64().unwrap() - 10.0).abs() < 1e-9);
    }

    #[test]
    fn create_ellipse() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateEllipse","cx":0,"cy":0,"semi_major":8,"semi_minor":4,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let ellipse = &ents[0]["geometry"]["Ellipse"];
        assert!((ellipse["semi_major"].as_f64().unwrap() - 8.0).abs() < 1e-9);
        assert!((ellipse["semi_minor"].as_f64().unwrap() - 4.0).abs() < 1e-9);
    }

    #[test]
    fn create_spline() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateSpline","control_points":[[0,0],[5,10],[10,0],[15,10]],"degree":3,"closed":false,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let spline = &ents[0]["geometry"]["Spline"];
        assert_eq!(spline["control_points"].as_array().unwrap().len(), 4);
        assert_eq!(spline["degree"].as_u64().unwrap(), 3);
        assert_eq!(spline["closed"].as_bool().unwrap(), false);
    }

    #[test]
    fn create_construction_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateConstructionLine","ox":0,"oy":0,"dx":1,"dy":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let cl = &ents[0]["geometry"]["ConstructionLine"];
        assert!((cl["direction"]["x"].as_f64().unwrap() - 1.0).abs() < 1e-9);
        assert!((cl["direction"]["y"].as_f64().unwrap()).abs() < 1e-9);
    }

    #[test]
    fn create_aligned_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateAlignedDimension","x1":0,"y1":0,"x2":3,"y2":4,"offset":1,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let dim = &ents[0]["geometry"]["AlignedDimension"];
        assert!((dim["offset"].as_f64().unwrap() - 1.0).abs() < 1e-9);
        assert!((dim["end"]["x"].as_f64().unwrap() - 3.0).abs() < 1e-9);
    }

    #[test]
    fn create_angular_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateAngularDimension","cx":0,"cy":0,"sx":10,"sy":0,"ex":0,"ey":10,"radius":5,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let dim = &ents[0]["geometry"]["AngularDimension"];
        assert!((dim["radius"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((dim["start_ray"]["x"].as_f64().unwrap() - 10.0).abs() < 1e-9);
    }

    #[test]
    fn create_radial_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRadialDimension","cx":0,"cy":0,"px":5,"py":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let dim = &ents[0]["geometry"]["RadialDimension"];
        assert!((dim["point_on_arc"]["x"].as_f64().unwrap() - 5.0).abs() < 1e-9);
    }

    #[test]
    fn create_diameter_dimension() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateDiameterDimension","cx":0,"cy":0,"px":6,"py":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let dim = &ents[0]["geometry"]["DiameterDimension"];
        assert!((dim["point_on_arc"]["x"].as_f64().unwrap() - 6.0).abs() < 1e-9);
    }

    #[test]
    fn create_hatch() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"CreateHatch","boundary_ids":["ent_1"],"pattern":"ANSI31","scale":1.0,"angle":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let hatch_ent = ents
            .iter()
            .find(|e| e["geometry"]["Hatch"].is_object())
            .unwrap();
        assert_eq!(
            hatch_ent["geometry"]["Hatch"]["pattern"].as_str().unwrap(),
            "ANSI31"
        );
    }

    #[test]
    fn create_mtext() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateMText","x":0,"y":0,"content":"Notes here","width":50,"height":3,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let mtext = &ents[0]["geometry"]["MText"];
        assert_eq!(mtext["content"].as_str().unwrap(), "Notes here");
        assert!((mtext["width"].as_f64().unwrap() - 50.0).abs() < 1e-9);
    }

    #[test]
    fn create_table() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateTable","x":0,"y":0,"rows":2,"cols":3,"row_height":5,"col_widths":[10,10,10],"cells":["A","B","C","D","E","F"],"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let table = &ents[0]["geometry"]["Table"];
        assert_eq!(table["rows"].as_u64().unwrap(), 2);
        assert_eq!(table["cols"].as_u64().unwrap(), 3);
        assert_eq!(table["cells"].as_array().unwrap().len(), 6);
    }

    #[test]
    fn create_revision_cloud() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateRevisionCloud","vertices":[[0,0],[10,0],[10,10],[0,10]],"arc_length":0.5,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let cloud = &ents[0]["geometry"]["RevisionCloud"];
        assert!((cloud["arc_length"].as_f64().unwrap() - 0.5).abs() < 1e-9);
        assert_eq!(cloud["boundary"].as_array().unwrap().len(), 4);
    }

    #[test]
    fn entity_layer_id_is_preserved() {
        let mut k = Kernel::new();
        let layer_r = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Walls","color":"#ff0000"}"##,
        );
        let layer_id = layer_r["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":5,"layer_id":"{}"}}"#,
            layer_id
        );
        let r = exec(&mut k, &cmd);
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        assert_eq!(ents[0]["layer_id"].as_str().unwrap(), layer_id);
    }
}
