use crate::commands::CommandResult;
use crate::entity::Layer;
use crate::events::{CadEvent, EventStore};
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn match_properties_cmd(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    source_id: &str,
    target_ids: &[String],
) -> CommandResult {
    let source = match world.get_entity_cloned(source_id) {
        Some(e) => e,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Source entity not found".to_string()),
                measurement: None,
                warnings: vec![],
            };
        }
    };
    let src_layer = source.layer_id.clone();
    let src_style = source.style.clone();

    let mut sub_events: Vec<CadEvent> = Vec::new();

    for tid in target_ids {
        if let Some(target) = world.get_entity_cloned(tid) {
            let old_style = target.style.clone();
            let new_style = src_style.clone();

            if target.layer_id != src_layer {
                world.set_layer(tid, &src_layer);
            }
            world.set_style(tid, new_style.clone());

            if old_style.color != new_style.color
                || old_style.linetype != new_style.linetype
                || old_style.lineweight != new_style.lineweight
            {
                sub_events.push(CadEvent::EntityStyleChanged {
                    id: tid.clone(),
                    old_style,
                    new_style,
                });
            }

            dirty_ids.insert(tid.clone());
        }
    }

    if !sub_events.is_empty() {
        if sub_events.len() == 1 {
            event_store.push(sub_events.into_iter().next().unwrap());
        } else {
            event_store.push(CadEvent::CompoundEvent { events: sub_events });
        }
    }

    CommandResult {
        success: true,
        created_ids: vec![],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

pub(crate) fn set_entity_color(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: String,
    color: Option<String>,
) -> CommandResult {
    if let Some(entity) = world.get_entity_cloned(&id) {
        let old_style = entity.style.clone();
        let mut new_style = old_style.clone();
        new_style.color = color;
        world.set_style(&id, new_style.clone());
        event_store.push(CadEvent::EntityStyleChanged {
            id: id.clone(),
            old_style,
            new_style,
        });
        dirty_ids.insert(id);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Entity not found".to_string()),
            measurement: None,
            warnings: vec![],
        }
    }
}

pub(crate) fn set_entity_linetype(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: String,
    linetype: Option<String>,
) -> CommandResult {
    if let Some(entity) = world.get_entity_cloned(&id) {
        let old_style = entity.style.clone();
        let mut new_style = old_style.clone();
        new_style.linetype = linetype;
        world.set_style(&id, new_style.clone());
        event_store.push(CadEvent::EntityStyleChanged {
            id: id.clone(),
            old_style,
            new_style,
        });
        dirty_ids.insert(id);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Entity not found".to_string()),
            measurement: None,
            warnings: vec![],
        }
    }
}

pub(crate) fn set_entity_lineweight(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: String,
    lineweight: Option<f64>,
) -> CommandResult {
    if let Some(entity) = world.get_entity_cloned(&id) {
        let old_style = entity.style.clone();
        let mut new_style = old_style.clone();
        new_style.lineweight = lineweight;
        world.set_style(&id, new_style.clone());
        event_store.push(CadEvent::EntityStyleChanged {
            id: id.clone(),
            old_style,
            new_style,
        });
        dirty_ids.insert(id);
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Entity not found".to_string()),
            measurement: None,
            warnings: vec![],
        }
    }
}

pub(crate) fn set_layer_linetype(
    layers: &mut [Layer],
    id: &str,
    linetype: Option<String>,
) -> CommandResult {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == id) {
        layer.linetype = linetype;
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Layer not found".to_string()),
            measurement: None,
            warnings: vec![],
        }
    }
}

pub(crate) fn set_layer_lineweight(
    layers: &mut [Layer],
    id: &str,
    lineweight: Option<f64>,
) -> CommandResult {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == id) {
        layer.lineweight = lineweight;
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Layer not found".to_string()),
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

    #[test]
    fn set_entity_color_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r##"{{"type":"SetEntityColor","id":"{}","color":"#ff0000"}}"##,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_color_none() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityColor","id":"{}","color":null}}"#,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_color_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"SetEntityColor","id":"ent_999","color":"#ff0000"}"##,
        );
        assert!(!v["success"].as_bool().unwrap());
        assert!(v["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn set_entity_linetype_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityLinetype","id":"{}","linetype":"DASHED"}}"#,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_linetype_none() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityLinetype","id":"{}","linetype":null}}"#,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_linetype_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetEntityLinetype","id":"ent_999","linetype":"DASHED"}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_lineweight_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityLineweight","id":"{}","lineweight":0.5}}"#,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_lineweight_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetEntityLineweight","id":"ent_999","lineweight":0.5}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn match_properties_copies_style() {
        let mut k = Kernel::new();
        // Create source with a color
        let v1 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let src_id = v1["created_ids"][0].as_str().unwrap().to_string();
        let color_cmd = format!(
            r##"{{"type":"SetEntityColor","id":"{}","color":"#ff0000"}}"##,
            src_id
        );
        exec(&mut k, &color_cmd);

        // Create target
        let v2 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        let tgt_id = v2["created_ids"][0].as_str().unwrap().to_string();

        // Match properties
        let cmd = format!(
            r#"{{"type":"MatchProperties","source_id":"{}","target_ids":["{}"]}}"#,
            src_id, tgt_id
        );
        let v3 = exec(&mut k, &cmd);
        assert!(v3["success"].as_bool().unwrap());

        // Verify target got the color
        let ent_json = k.get_entity_json(&tgt_id);
        assert!(ent_json.contains("#ff0000") || ent_json.contains("ff0000"));
    }

    #[test]
    fn match_properties_nonexistent_source() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        let tgt_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"MatchProperties","source_id":"ent_999","target_ids":["{}"]}}"#,
            tgt_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(!v2["success"].as_bool().unwrap());
        assert!(v2["error"].as_str().unwrap().contains("not found"));
    }

    #[test]
    fn match_properties_multiple_targets() {
        let mut k = Kernel::new();
        let v1 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let src_id = v1["created_ids"][0].as_str().unwrap().to_string();
        let color_cmd = format!(
            r##"{{"type":"SetEntityColor","id":"{}","color":"#00ff00"}}"##,
            src_id
        );
        exec(&mut k, &color_cmd);

        let v2 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":1,"y1":1,"x2":2,"y2":2,"layer_id":"layer_0"}"#,
        );
        let tgt1 = v2["created_ids"][0].as_str().unwrap().to_string();
        let v3 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":3,"y1":3,"x2":4,"y2":4,"layer_id":"layer_0"}"#,
        );
        let tgt2 = v3["created_ids"][0].as_str().unwrap().to_string();

        let cmd = format!(
            r#"{{"type":"MatchProperties","source_id":"{}","target_ids":["{}","{}"]}}"#,
            src_id, tgt1, tgt2
        );
        let v4 = exec(&mut k, &cmd);
        assert!(v4["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_linetype_via_command() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerLinetype","id":"layer_0","linetype":"DASHED"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_linetype_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerLinetype","id":"layer_999","linetype":"DASHED"}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_lineweight_via_command() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerLineweight","id":"layer_0","lineweight":0.5}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_lineweight_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerLineweight","id":"layer_999","lineweight":0.5}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }
}
