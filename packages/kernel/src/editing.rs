use crate::entity::{Entity, GeometryType};
use crate::events::{CadEvent, EventStore};
use crate::ports::ConstraintSolverPort;
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn delete_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    deleted_ids: &mut Vec<String>,
    constraint_solver: &mut dyn ConstraintSolverPort,
    id: &str,
) -> bool {
    if let Some(entity) = world.remove_entity_returning(id) {
        deleted_ids.push(id.to_string());
        event_store.push(CadEvent::EntityDeleted { entity });
        constraint_solver.remove_constraints_for_entity(id);
        true
    } else {
        false
    }
}

pub(crate) fn move_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    dx: f64,
    dy: f64,
) -> bool {
    if let Some(old_geometry) = world.get_geometry(id) {
        world.translate_entity(id, dx, dy);
        event_store.push(CadEvent::EntityMoved {
            id: id.to_string(),
            dx,
            dy,
            old_geometry,
        });
        dirty_ids.insert(id.to_string());
        true
    } else {
        false
    }
}

pub(crate) fn rotate_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    cx: f64,
    cy: f64,
    angle: f64,
) -> bool {
    if let Some(old_geometry) = world.get_geometry(id) {
        world.rotate_entity(id, cx, cy, angle);
        event_store.push(CadEvent::EntityRotated {
            id: id.to_string(),
            cx,
            cy,
            angle,
            old_geometry,
        });
        dirty_ids.insert(id.to_string());
        true
    } else {
        false
    }
}

pub(crate) fn scale_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    cx: f64,
    cy: f64,
    factor: f64,
) -> bool {
    if let Some(old_geometry) = world.get_geometry(id) {
        world.scale_entity(id, cx, cy, factor);
        event_store.push(CadEvent::EntityScaled {
            id: id.to_string(),
            cx,
            cy,
            factor,
            old_geometry,
        });
        dirty_ids.insert(id.to_string());
        true
    } else {
        false
    }
}

pub(crate) fn copy_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    new_id: String,
) -> String {
    if let Some(entity) = world.get_entity_cloned(id) {
        let new_entity = Entity {
            id: new_id.clone(),
            geometry: entity.geometry.clone(),
            layer_id: entity.layer_id.clone(),
            style: entity.style.clone(),
            draw_order: 0,
        };
        event_store.push(CadEvent::EntityCopied {
            original_id: id.to_string(),
            new_entity: new_entity.clone(),
        });
        world.insert_entity(new_entity);
        dirty_ids.insert(new_id.clone());
        new_id
    } else {
        String::new()
    }
}

pub(crate) fn update_entity_geometry(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    geometry_json: &str,
) -> bool {
    if let Some(old_geometry) = world.get_geometry(id) {
        if let Ok(new_geometry) = serde_json::from_str::<GeometryType>(geometry_json) {
            world.set_geometry(id, new_geometry.clone());
            event_store.push(CadEvent::EntityModified {
                id: id.to_string(),
                old_geometry,
                new_geometry,
            });
            dirty_ids.insert(id.to_string());
            true
        } else {
            false
        }
    } else {
        false
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
    fn delete_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.entity_count(), 1);
        let r = exec(&mut k, r#"{"type":"DeleteEntity","id":"ent_1"}"#);
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn delete_nonexistent() {
        let mut k = Kernel::new();
        let r = exec(&mut k, r#"{"type":"DeleteEntity","id":"ent_999"}"#);
        assert_eq!(r["success"], false);
        assert!(r["error"].is_string());
    }

    #[test]
    fn delete_multiple_entities_sequentially() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":3,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.entity_count(), 2);
        exec(&mut k, r#"{"type":"DeleteEntity","id":"ent_1"}"#);
        assert_eq!(k.entity_count(), 1);
        exec(&mut k, r#"{"type":"DeleteEntity","id":"ent_2"}"#);
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn move_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MoveEntity","id":"ent_1","dx":5,"dy":5}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let line = &ents[0]["geometry"]["Line"];
        assert!((line["start"]["x"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((line["start"]["y"].as_f64().unwrap() - 5.0).abs() < 1e-9);
        assert!((line["end"]["x"].as_f64().unwrap() - 15.0).abs() < 1e-9);
    }

    #[test]
    fn move_nonexistent() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"MoveEntity","id":"ent_999","dx":5,"dy":5}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn move_by_zero() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":3,"y1":4,"x2":8,"y2":4,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MoveEntity","id":"ent_1","dx":0,"dy":0}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let line = &ents[0]["geometry"]["Line"];
        assert!((line["start"]["x"].as_f64().unwrap() - 3.0).abs() < 1e-9);
        assert!((line["start"]["y"].as_f64().unwrap() - 4.0).abs() < 1e-9);
    }

    #[test]
    fn rotate_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":10,"y1":0,"x2":20,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"RotateEntity","id":"ent_1","cx":0,"cy":0,"angle":1.5707963267948966}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let line = &ents[0]["geometry"]["Line"];
        // After 90-degree rotation around origin, (10,0) -> (0,10)
        assert!((line["start"]["x"].as_f64().unwrap()).abs() < 1e-6);
        assert!((line["start"]["y"].as_f64().unwrap() - 10.0).abs() < 1e-6);
    }

    #[test]
    fn rotate_nonexistent() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"RotateEntity","id":"ent_999","cx":0,"cy":0,"angle":1.0}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn scale_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ScaleEntity","id":"ent_1","cx":0,"cy":0,"factor":2}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let radius = ents[0]["geometry"]["Circle"]["radius"].as_f64().unwrap();
        assert!((radius - 10.0).abs() < 1e-9);
    }

    #[test]
    fn scale_by_one_identity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":3,"cy":4,"radius":7,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ScaleEntity","id":"ent_1","cx":0,"cy":0,"factor":1}"#,
        );
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let radius = ents[0]["geometry"]["Circle"]["radius"].as_f64().unwrap();
        assert!((radius - 7.0).abs() < 1e-9);
    }

    #[test]
    fn scale_nonexistent() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"ScaleEntity","id":"ent_999","cx":0,"cy":0,"factor":2}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn copy_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"CopyEntity","id":"ent_1"}"#);
        assert_eq!(r["success"], true);
        assert_eq!(r["created_ids"].as_array().unwrap().len(), 1);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn copy_nonexistent() {
        let mut k = Kernel::new();
        let r = exec(&mut k, r#"{"type":"CopyEntity","id":"ent_999"}"#);
        assert_eq!(r["success"], false);
    }

    #[test]
    fn mirror_entity() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":1,"x2":10,"y2":1,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MirrorEntity","id":"ent_1","x1":0,"y1":0,"x2":0,"y2":10}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
        let mirrored_id = r["created_ids"][0].as_str().unwrap().to_string();
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let mirrored = ents
            .iter()
            .find(|e| e["id"].as_str().unwrap() == mirrored_id)
            .unwrap();
        let start_x = mirrored["geometry"]["Line"]["start"]["x"].as_f64().unwrap();
        // Mirroring x=5 across Y-axis (x=0 line) gives x=-5
        assert!((start_x - (-5.0)).abs() < 1e-6);
    }

    #[test]
    fn update_entity_geometry() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let new_geom = r#"{"Line":{"start":{"x":1.0,"y":2.0},"end":{"x":11.0,"y":2.0}}}"#;
        let cmd = format!(
            r#"{{"type":"ModifyGeometry","id":"ent_1","geometry_json":{}}}"#,
            serde_json::to_string(new_geom).unwrap()
        );
        let r = exec(&mut k, &cmd);
        assert_eq!(r["success"], true);
        let entities = k.get_entities_json();
        let ents: Vec<serde_json::Value> = serde_json::from_str(&entities).unwrap();
        let line = &ents[0]["geometry"]["Line"];
        assert!((line["start"]["x"].as_f64().unwrap() - 1.0).abs() < 1e-9);
        assert!((line["start"]["y"].as_f64().unwrap() - 2.0).abs() < 1e-9);
    }
}
