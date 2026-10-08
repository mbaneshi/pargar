use crate::entity::Layer;
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn create_layer(
    layers: &mut Vec<Layer>,
    next_layer_id: &mut u64,
    name: &str,
    color: &str,
) -> String {
    let id = format!("layer_{}", *next_layer_id);
    *next_layer_id += 1;
    layers.push(Layer {
        id: id.clone(),
        name: name.to_string(),
        color: color.to_string(),
        visible: true,
        locked: false,
        linetype: None,
        lineweight: None,
    });
    id
}

pub(crate) fn get_layers_json(layers: &[Layer]) -> String {
    serde_json::to_string(layers).unwrap_or_default()
}

pub(crate) fn set_layer_visible(layers: &mut [Layer], layer_id: &str, visible: bool) -> bool {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == layer_id) {
        layer.visible = visible;
        true
    } else {
        false
    }
}

pub(crate) fn set_layer_locked(layers: &mut [Layer], layer_id: &str, locked: bool) -> bool {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == layer_id) {
        layer.locked = locked;
        true
    } else {
        false
    }
}

pub(crate) fn set_layer_color(layers: &mut [Layer], layer_id: &str, color: &str) -> bool {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == layer_id) {
        layer.color = color.to_string();
        true
    } else {
        false
    }
}

pub(crate) fn rename_layer(layers: &mut [Layer], layer_id: &str, name: &str) -> bool {
    if let Some(layer) = layers.iter_mut().find(|l| l.id == layer_id) {
        layer.name = name.to_string();
        true
    } else {
        false
    }
}

pub(crate) fn delete_layer(
    layers: &mut Vec<Layer>,
    world: &mut NexusWorld,
    layer_id: &str,
) -> bool {
    if layer_id == "layer_0" {
        return false;
    }
    let ids: Vec<String> = world.entity_ids();
    for id in &ids {
        if world.get_layer(id).as_deref() == Some(layer_id) {
            world.set_layer(id, "layer_0");
        }
    }
    layers.retain(|l| l.id != layer_id);
    true
}

pub(crate) fn set_entity_layer(
    world: &mut NexusWorld,
    layers: &[Layer],
    dirty_ids: &mut HashSet<String>,
    entity_id: &str,
    layer_id: &str,
) -> bool {
    if !layers.iter().any(|l| l.id == layer_id) {
        return false;
    }
    if world.contains(entity_id) {
        world.set_layer(entity_id, layer_id);
        dirty_ids.insert(entity_id.to_string());
        true
    } else {
        false
    }
}

pub(crate) fn get_visible_entities_json(world: &NexusWorld, layers: &[Layer]) -> String {
    let visible_layer_ids: HashSet<&str> = layers
        .iter()
        .filter(|l| l.visible)
        .map(|l| l.id.as_str())
        .collect();
    let mut visible = Vec::new();
    world.for_each_entity(|e| {
        if visible_layer_ids.contains(e.layer_id.as_str()) {
            visible.push(e.clone());
        }
    });
    serde_json::to_string(&visible).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    #[test]
    fn create_layer_via_command() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Walls","color":"#ff0000"}"##,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
        let layer_id = v["created_ids"][0].as_str().unwrap();
        assert!(layer_id.starts_with("layer_"));
    }

    #[test]
    fn set_layer_visible() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Hidden","color":"#00ff00"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetLayerVisible","id":"{}","visible":false}}"#,
            layer_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_visible_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerVisible","id":"layer_999","visible":false}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_locked() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Locked","color":"#0000ff"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetLayerLocked","id":"{}","locked":true}}"#,
            layer_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_locked_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetLayerLocked","id":"layer_999","locked":true}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_color() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Colored","color":"#ff0000"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r##"{{"type":"SetLayerColor","id":"{}","color":"#00ff00"}}"##,
            layer_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_layer_color_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"SetLayerColor","id":"layer_999","color":"#00ff00"}"##,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn rename_layer() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Old","color":"#ff0000"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"RenameLayer","id":"{}","name":"New"}}"#,
            layer_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(v2["success"].as_bool().unwrap());
        let layers_json = k.get_layers_json();
        assert!(layers_json.contains("New"));
        assert!(!layers_json.contains("\"Old\""));
    }

    #[test]
    fn rename_layer_nonexistent() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"RenameLayer","id":"layer_999","name":"New"}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn delete_layer_moves_entities_to_layer_0() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Temp","color":"#0000ff"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"{}"}}"#,
            layer_id
        );
        exec(&mut k, &cmd);
        let del_cmd = format!(r#"{{"type":"DeleteLayer","id":"{}"}}"#, layer_id);
        let v2 = exec(&mut k, &del_cmd);
        assert!(v2["success"].as_bool().unwrap());
        let entities = k.get_entities_json();
        assert!(entities.contains("layer_0"));
    }

    #[test]
    fn cannot_delete_layer_0() {
        let mut k = Kernel::new();
        let v = exec(&mut k, r#"{"type":"DeleteLayer","id":"layer_0"}"#);
        assert!(!v["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_layer() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r##"{"type":"CreateLayer","name":"Target","color":"#ff0000"}"##,
        );
        let layer_id = v["created_ids"][0].as_str().unwrap().to_string();
        let v2 = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v2["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityLayer","entity_id":"{}","layer_id":"{}"}}"#,
            ent_id, layer_id
        );
        let v3 = exec(&mut k, &cmd);
        assert!(v3["success"].as_bool().unwrap());
        let ent_json = k.get_entity_json(&ent_id);
        assert!(ent_json.contains(&layer_id));
    }

    #[test]
    fn set_entity_layer_nonexistent_layer() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let ent_id = v["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"SetEntityLayer","entity_id":"{}","layer_id":"layer_999"}}"#,
            ent_id
        );
        let v2 = exec(&mut k, &cmd);
        assert!(!v2["success"].as_bool().unwrap());
    }

    #[test]
    fn set_entity_layer_nonexistent_entity() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"SetEntityLayer","entity_id":"ent_999","layer_id":"layer_0"}"#,
        );
        assert!(!v["success"].as_bool().unwrap());
    }
}
