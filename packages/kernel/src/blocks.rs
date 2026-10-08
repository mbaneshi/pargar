use crate::commands::CommandResult;
use crate::entity::{BlockDef, Entity, EntityStyle, GeometryType, Point2D};
use crate::events::{CadEvent, EventStore};
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn get_block_defs_json(block_defs: &[BlockDef]) -> String {
    serde_json::to_string(block_defs).unwrap_or_default()
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn create_block_cmd(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    last_created_id: &mut Option<String>,
    block_defs: &mut Vec<BlockDef>,
    name: &str,
    base_x: f64,
    base_y: f64,
    entity_ids: &[String],
) -> CommandResult {
    let base_point = Point2D::new(base_x, base_y);
    let mut block_entities: Vec<Entity> = Vec::new();
    for eid in entity_ids {
        if let Some(e) = world.get_entity_cloned(eid.as_str()) {
            let mut cloned = e;
            cloned.geometry.translate(-base_x, -base_y);
            block_entities.push(cloned);
        }
    }
    if block_entities.is_empty() {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("No entities found".into()),
            measurement: None,
            warnings: vec![],
        };
    }
    let block_id = format!("blk_{}", *next_id);
    *next_id += 1;
    block_defs.push(BlockDef {
        id: block_id.clone(),
        name: name.to_string(),
        base_point: base_point.clone(),
        entities: block_entities,
    });

    let mut compound = Vec::new();
    for eid in entity_ids {
        if let Some(entity) = world.remove_entity_returning(eid.as_str()) {
            deleted_ids.push(eid.clone());
            compound.push(CadEvent::EntityDeleted { entity });
        }
    }
    let ref_id = format!("ent_{}", *next_id);
    *next_id += 1;
    let ref_entity = Entity {
        id: ref_id.clone(),
        geometry: GeometryType::BlockRef {
            block_id: block_id.clone(),
            insertion: base_point,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
        },
        layer_id: "default".to_string(),
        style: EntityStyle::default(),
        draw_order: 0,
    };
    world.insert_entity(ref_entity.clone());
    dirty_ids.insert(ref_id.clone());
    last_created_id.replace(ref_id.clone());
    compound.push(CadEvent::EntityCreated { entity: ref_entity });
    event_store.push(CadEvent::CompoundEvent { events: compound });
    CommandResult {
        success: true,
        created_ids: vec![block_id, ref_id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn insert_block_cmd(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    last_created_id: &mut Option<String>,
    block_defs: &[BlockDef],
    block_id: &str,
    x: f64,
    y: f64,
    rotation: f64,
    scale_x: f64,
    scale_y: f64,
    layer_id: &str,
) -> CommandResult {
    if !block_defs.iter().any(|b| b.id == block_id) {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Block not found".into()),
            measurement: None,
            warnings: vec![],
        };
    }
    let id = format!("ent_{}", *next_id);
    *next_id += 1;
    let entity = Entity {
        id: id.clone(),
        geometry: GeometryType::BlockRef {
            block_id: block_id.to_string(),
            insertion: Point2D::new(x, y),
            rotation,
            scale_x,
            scale_y,
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
pub(crate) fn explode_block_cmd(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    last_created_id: &mut Option<String>,
    block_defs: &[BlockDef],
    entity_id: &str,
) -> CommandResult {
    let ref_data = world.get_entity_cloned(entity_id).and_then(|e| {
        if let GeometryType::BlockRef {
            block_id,
            insertion,
            rotation,
            scale_x,
            scale_y,
        } = &e.geometry
        {
            Some((
                block_id.clone(),
                insertion.clone(),
                *rotation,
                *scale_x,
                *scale_y,
                e.layer_id.clone(),
            ))
        } else {
            None
        }
    });
    let (block_id, insertion, rotation, scale_x, _scale_y, layer_id) = match ref_data {
        Some(d) => d,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Not a block ref".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let block_ents = match block_defs.iter().find(|b| b.id == block_id) {
        Some(bd) => bd.entities.clone(),
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Block def not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let mut compound = Vec::new();
    let mut created_ids = Vec::new();
    for be in &block_ents {
        let new_id = format!("ent_{}", *next_id);
        *next_id += 1;
        let mut geom = be.geometry.clone();
        geom.scale(0.0, 0.0, scale_x);
        geom.rotate(0.0, 0.0, rotation);
        geom.translate(insertion.x, insertion.y);
        let new_entity = Entity {
            id: new_id.clone(),
            geometry: geom,
            layer_id: layer_id.clone(),
            style: EntityStyle::default(),
            draw_order: 0,
        };
        world.insert_entity(new_entity.clone());
        dirty_ids.insert(new_id.clone());
        last_created_id.replace(new_id.clone());
        compound.push(CadEvent::EntityCreated { entity: new_entity });
        created_ids.push(new_id);
    }
    if let Some(deleted) = world.remove_entity_returning(entity_id) {
        deleted_ids.push(entity_id.to_string());
        compound.push(CadEvent::EntityDeleted { entity: deleted });
    }
    event_store.push(CadEvent::CompoundEvent { events: compound });
    CommandResult {
        success: true,
        created_ids,
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn array_rectangular(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    last_created_id: &mut Option<String>,
    entity_ids: &[String],
    rows: u32,
    cols: u32,
    row_spacing: f64,
    col_spacing: f64,
) -> CommandResult {
    let mut compound = Vec::new();
    let mut created = Vec::new();
    for eid in entity_ids {
        if let Some(src) = world.get_entity_cloned(eid.as_str()) {
            for r in 0..rows {
                for c in 0..cols {
                    if r == 0 && c == 0 {
                        continue;
                    }
                    let new_id = format!("ent_{}", *next_id);
                    *next_id += 1;
                    let mut geom = src.geometry.clone();
                    geom.translate(c as f64 * col_spacing, r as f64 * row_spacing);
                    let new_ent = Entity {
                        id: new_id.clone(),
                        geometry: geom,
                        layer_id: src.layer_id.clone(),
                        style: src.style.clone(),
                        draw_order: 0,
                    };
                    world.insert_entity(new_ent.clone());
                    dirty_ids.insert(new_id.clone());
                    last_created_id.replace(new_id.clone());
                    compound.push(CadEvent::EntityCreated { entity: new_ent });
                    created.push(new_id);
                }
            }
        }
    }
    event_store.push(CadEvent::CompoundEvent { events: compound });
    CommandResult {
        success: true,
        created_ids: created,
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn array_polar(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    last_created_id: &mut Option<String>,
    entity_ids: &[String],
    center_x: f64,
    center_y: f64,
    count: u32,
    total_angle: f64,
    _rotate_items: bool,
) -> CommandResult {
    let mut compound = Vec::new();
    let mut created = Vec::new();
    let angle_step = if count > 1 {
        total_angle.to_radians() / count as f64
    } else {
        0.0
    };
    for eid in entity_ids {
        if let Some(src) = world.get_entity_cloned(eid.as_str()) {
            for i in 1..count {
                let new_id = format!("ent_{}", *next_id);
                *next_id += 1;
                let mut geom = src.geometry.clone();
                let angle = angle_step * i as f64;
                geom.rotate(center_x, center_y, angle);
                let new_ent = Entity {
                    id: new_id.clone(),
                    geometry: geom,
                    layer_id: src.layer_id.clone(),
                    style: src.style.clone(),
                    draw_order: 0,
                };
                world.insert_entity(new_ent.clone());
                dirty_ids.insert(new_id.clone());
                last_created_id.replace(new_id.clone());
                compound.push(CadEvent::EntityCreated { entity: new_ent });
                created.push(new_id);
            }
        }
    }
    event_store.push(CadEvent::CompoundEvent { events: compound });
    CommandResult {
        success: true,
        created_ids: created,
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

    fn entity_json(k: &Kernel, id: &str) -> serde_json::Value {
        let s = k.get_entity_json(id);
        serde_json::from_str(&s).unwrap()
    }

    // --- CreateBlock + InsertBlock ---

    #[test]
    fn create_block_from_entities() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"corner","base_x":0,"base_y":0,"entity_ids":["ent_1","ent_2"]}"#,
        );
        assert_eq!(r["success"], true);
        // original entities replaced by a single BlockRef
        assert_eq!(k.entity_count(), 1);
        // two ids returned: block_def id + ref entity id
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn create_block_empty_entity_ids_fails() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"empty","base_x":0,"base_y":0,"entity_ids":[]}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn insert_block_creates_block_ref() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let cr = exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"sym","base_x":0,"base_y":0,"entity_ids":["ent_1"]}"#,
        );
        let block_id = cr["created_ids"][0].as_str().unwrap().to_string();
        let before = k.entity_count();
        let cmd = format!(
            r#"{{"type":"InsertBlock","block_id":"{}","x":10,"y":10,"rotation":0,"scale_x":1,"scale_y":1,"layer_id":"layer_0"}}"#,
            block_id
        );
        let r = exec(&mut k, &cmd);
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), before + 1);
    }

    #[test]
    fn insert_nonexistent_block_fails() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"InsertBlock","block_id":"blk_999","x":0,"y":0,"rotation":0,"scale_x":1,"scale_y":1,"layer_id":"layer_0"}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn insert_block_multiple_times() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let cr = exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"bolt","base_x":0,"base_y":0,"entity_ids":["ent_1"]}"#,
        );
        let block_id = cr["created_ids"][0].as_str().unwrap().to_string();
        let cmd1 = format!(
            r#"{{"type":"InsertBlock","block_id":"{}","x":10,"y":0,"rotation":0,"scale_x":1,"scale_y":1,"layer_id":"layer_0"}}"#,
            block_id
        );
        let cmd2 = format!(
            r#"{{"type":"InsertBlock","block_id":"{}","x":20,"y":0,"rotation":0,"scale_x":1,"scale_y":1,"layer_id":"layer_0"}}"#,
            block_id
        );
        exec(&mut k, &cmd1);
        exec(&mut k, &cmd2);
        // original ref + 2 inserts = 3 block refs
        assert_eq!(k.entity_count(), 3);
    }

    // --- ExplodeBlock ---

    #[test]
    fn explode_block_ref_creates_primitives() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":0,"y2":5,"layer_id":"layer_0"}"#,
        );
        let cr = exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"bracket","base_x":0,"base_y":0,"entity_ids":["ent_1","ent_2"]}"#,
        );
        // created_ids[1] is the block ref entity
        let ref_id = cr["created_ids"][1].as_str().unwrap().to_string();
        assert_eq!(k.entity_count(), 1); // just the ref
        let r = exec(
            &mut k,
            &format!(r#"{{"type":"ExplodeBlock","entity_id":"{}"}}"#, ref_id),
        );
        assert_eq!(r["success"], true);
        // ref replaced by the 2 original lines
        assert_eq!(k.entity_count(), 2);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn explode_non_block_entity_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"ExplodeBlock","entity_id":"ent_1"}"#);
        assert_eq!(r["success"], false);
    }

    // --- GetBlockDefs ---

    #[test]
    fn get_block_defs_empty_initially() {
        let k = Kernel::new();
        let json = k.get_block_defs_json();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(v.as_array().unwrap().is_empty());
    }

    #[test]
    fn get_block_defs_after_create() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateBlock","name":"myblock","base_x":0,"base_y":0,"entity_ids":["ent_1"]}"#,
        );
        let json = k.get_block_defs_json();
        let v: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(v.as_array().unwrap().len(), 1);
        assert_eq!(v[0]["name"], "myblock");
    }

    // --- ArrayRectangular ---

    #[test]
    fn array_rectangular_3x2_creates_five_copies() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":1,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayRectangular","entity_ids":["ent_1"],"rows":3,"cols":2,"row_spacing":5,"col_spacing":10}"#,
        );
        assert_eq!(r["success"], true);
        // 3x2=6 total, original stays + 5 new
        assert_eq!(k.entity_count(), 6);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 5);
    }

    #[test]
    fn array_rectangular_1x1_creates_no_copies() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayRectangular","entity_ids":["ent_1"],"rows":1,"cols":1,"row_spacing":5,"col_spacing":10}"#,
        );
        assert_eq!(r["success"], true);
        // no copies at (0,0) position
        assert_eq!(k.entity_count(), 1);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn array_rectangular_copies_are_offset_correctly() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":1,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayRectangular","entity_ids":["ent_1"],"rows":1,"cols":3,"row_spacing":0,"col_spacing":5}"#,
        );
        assert_eq!(r["success"], true);
        // check second copy center is at x=5
        let new_id2 = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id2);
        let cx = ej["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        assert!((cx - 5.0).abs() < 1e-9);
    }

    // --- ArrayPolar ---

    #[test]
    fn array_polar_4_count_full_circle() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayPolar","entity_ids":["ent_1"],"center_x":0,"center_y":0,"count":4,"angle":360,"rotate_items":false}"#,
        );
        assert_eq!(r["success"], true);
        // original + 3 copies
        assert_eq!(k.entity_count(), 4);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 3);
    }

    #[test]
    fn array_polar_count_1_creates_no_copies() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayPolar","entity_ids":["ent_1"],"center_x":0,"center_y":0,"count":1,"angle":360,"rotate_items":false}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn array_polar_partial_angle() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ArrayPolar","entity_ids":["ent_1"],"center_x":0,"center_y":0,"count":3,"angle":90,"rotate_items":false}"#,
        );
        assert_eq!(r["success"], true);
        // original + 2 copies (at 30 and 60 deg of 90 total)
        assert_eq!(k.entity_count(), 3);
    }
}
