use std::collections::HashMap;

use crate::components::{
    BIMProperties, DrawOrder, EntityName, Geometry, GeometryData, LayerRef, Style,
};
use crate::entity::{Entity, EntityStyle};

pub struct NexusWorld {
    world: hecs::World,
    id_map: HashMap<String, hecs::Entity>,
    reverse_map: HashMap<hecs::Entity, String>,
    next_id: u64,
    cache: HashMap<String, Entity>,
}

impl Default for NexusWorld {
    fn default() -> Self {
        Self::new()
    }
}

impl NexusWorld {
    pub fn new() -> Self {
        Self {
            world: hecs::World::new(),
            id_map: HashMap::new(),
            reverse_map: HashMap::new(),
            next_id: 1,
            cache: HashMap::new(),
        }
    }

    fn gen_id(&mut self) -> String {
        let id = format!("ent_{}", self.next_id);
        self.next_id += 1;
        id
    }

    pub fn spawn_entity(
        &mut self,
        geometry: GeometryData,
        layer: &str,
        style: EntityStyle,
    ) -> String {
        let string_id = self.gen_id();
        let entity = self.world.spawn((
            EntityName(string_id.clone()),
            Geometry(geometry),
            LayerRef(layer.to_string()),
            Style(style),
            DrawOrder(0),
        ));
        self.id_map.insert(string_id.clone(), entity);
        self.reverse_map.insert(entity, string_id.clone());

        string_id
    }

    pub fn spawn_entity_with_bim(
        &mut self,
        geometry: GeometryData,
        layer: &str,
        style: EntityStyle,
        bim: BIMProperties,
    ) -> String {
        let string_id = self.gen_id();
        let entity = self.world.spawn((
            EntityName(string_id.clone()),
            Geometry(geometry),
            LayerRef(layer.to_string()),
            Style(style),
            DrawOrder(0),
            bim,
        ));
        self.id_map.insert(string_id.clone(), entity);
        self.reverse_map.insert(entity, string_id.clone());

        string_id
    }

    pub fn despawn_entity(&mut self, id: &str) -> bool {
        if let Some(entity) = self.id_map.remove(id) {
            self.reverse_map.remove(&entity);

            self.world.despawn(entity).is_ok()
        } else {
            false
        }
    }

    pub fn get_geometry(&self, id: &str) -> Option<GeometryData> {
        let entity = self.id_map.get(id)?;
        let geo = self.world.get::<&Geometry>(*entity).ok()?;
        Some(geo.0.clone())
    }

    pub fn get_geometry_mut(&mut self, id: &str) -> Option<hecs::RefMut<'_, Geometry>> {
        let entity = self.id_map.get(id)?;
        self.world.get::<&mut Geometry>(*entity).ok()
    }

    pub fn entity_count(&self) -> usize {
        self.id_map.len()
    }

    pub fn iter_entity_ids(&self) -> impl Iterator<Item = &String> {
        self.id_map.keys()
    }

    pub fn has_component<T: hecs::Component>(&self, id: &str) -> bool {
        if let Some(entity) = self.id_map.get(id) {
            self.world.get::<&T>(*entity).is_ok()
        } else {
            false
        }
    }

    pub fn get_component<T: hecs::Component + Clone>(&self, id: &str) -> Option<T> {
        let entity = self.id_map.get(id)?;
        let comp = self.world.get::<&T>(*entity).ok()?;
        Some((*comp).clone())
    }

    pub fn to_entities_json(&self) -> String {
        let mut entities: Vec<Entity> = Vec::with_capacity(self.id_map.len());
        for (string_id, &hecs_entity) in &self.id_map {
            let geo = self.world.get::<&Geometry>(hecs_entity).ok();
            let layer = self.world.get::<&LayerRef>(hecs_entity).ok();
            let style = self.world.get::<&Style>(hecs_entity).ok();
            if let (Some(geo), Some(layer), Some(style)) = (geo, layer, style) {
                let order = self
                    .world
                    .get::<&DrawOrder>(hecs_entity)
                    .map(|d| d.0)
                    .unwrap_or(0);
                entities.push(Entity {
                    id: string_id.clone(),
                    geometry: geo.0.clone(),
                    layer_id: layer.0.clone(),
                    style: style.0.clone(),
                    draw_order: order,
                });
            }
        }
        entities.sort_by(|a, b| a.id.cmp(&b.id));
        serde_json::to_string(&entities).unwrap_or_default()
    }

    pub fn from_entities_json(&mut self, json: &str) -> Result<(), String> {
        let entities: Vec<Entity> =
            serde_json::from_str(json).map_err(|e| format!("JSON parse error: {}", e))?;
        for ent in entities {
            let hecs_entity = self.world.spawn((
                EntityName(ent.id.clone()),
                Geometry(ent.geometry),
                LayerRef(ent.layer_id),
                Style(ent.style),
                DrawOrder(ent.draw_order),
            ));
            self.id_map.insert(ent.id.clone(), hecs_entity);
            self.reverse_map.insert(hecs_entity, ent.id);
        }
        Ok(())
    }

    pub fn translate_entity(&mut self, id: &str, dx: f64, dy: f64) -> bool {
        let entity = match self.id_map.get(id) {
            Some(&e) => e,
            None => return false,
        };
        if let Ok(mut geo) = self.world.get::<&mut Geometry>(entity) {
            geo.0.translate(dx, dy);
            let updated = geo.0.clone();
            if let Some(cached) = self.cache.get_mut(id) {
                cached.geometry = updated;
            }
            true
        } else {
            false
        }
    }

    pub fn rotate_entity(&mut self, id: &str, cx: f64, cy: f64, angle: f64) -> bool {
        let entity = match self.id_map.get(id) {
            Some(&e) => e,
            None => return false,
        };
        if let Ok(mut geo) = self.world.get::<&mut Geometry>(entity) {
            geo.0.rotate(cx, cy, angle);
            let updated = geo.0.clone();
            if let Some(cached) = self.cache.get_mut(id) {
                cached.geometry = updated;
            }
            true
        } else {
            false
        }
    }

    pub fn scale_entity(&mut self, id: &str, cx: f64, cy: f64, factor: f64) -> bool {
        let entity = match self.id_map.get(id) {
            Some(&e) => e,
            None => return false,
        };
        if let Ok(mut geo) = self.world.get::<&mut Geometry>(entity) {
            geo.0.scale(cx, cy, factor);
            let updated = geo.0.clone();
            if let Some(cached) = self.cache.get_mut(id) {
                cached.geometry = updated;
            }
            true
        } else {
            false
        }
    }

    pub fn copy_entity(&mut self, id: &str) -> Option<String> {
        let geo = self.get_geometry(id)?;
        let layer = self.get_component::<LayerRef>(id)?;
        let style = self.get_component::<Style>(id)?;
        Some(self.spawn_entity(geo, &layer.0, style.0))
    }

    pub fn get_layer(&self, id: &str) -> Option<String> {
        let layer = self.get_component::<LayerRef>(id)?;
        Some(layer.0)
    }

    pub fn set_layer(&mut self, id: &str, layer: &str) -> bool {
        if let Some(&hecs_entity) = self.id_map.get(id) {
            if let Ok(mut layer_ref) = self.world.get::<&mut LayerRef>(hecs_entity) {
                layer_ref.0 = layer.to_string();
                if let Some(cached) = self.cache.get_mut(id) {
                    cached.layer_id = layer.to_string();
                }
                return true;
            }
        }
        false
    }

    pub fn get_style(&self, id: &str) -> Option<EntityStyle> {
        let style = self.get_component::<Style>(id)?;
        Some(style.0)
    }

    pub fn set_style(&mut self, id: &str, style: EntityStyle) -> bool {
        if let Some(&hecs_entity) = self.id_map.get(id) {
            if let Ok(mut s) = self.world.get::<&mut Style>(hecs_entity) {
                s.0 = style.clone();
                if let Some(cached) = self.cache.get_mut(id) {
                    cached.style = style;
                }
                return true;
            }
        }
        false
    }

    pub fn set_draw_order(&mut self, id: &str, order: i32) -> bool {
        if let Some(&hecs_entity) = self.id_map.get(id) {
            if let Ok(mut d) = self.world.get::<&mut DrawOrder>(hecs_entity) {
                d.0 = order;
                if let Some(cached) = self.cache.get_mut(id) {
                    cached.draw_order = order;
                }
                return true;
            }
        }
        false
    }

    pub fn get_draw_order(&self, id: &str) -> i32 {
        if let Some(&hecs_entity) = self.id_map.get(id) {
            if let Ok(d) = self.world.get::<&DrawOrder>(hecs_entity) {
                return d.0;
            }
        }
        0
    }

    pub fn spawn_entity_with_id(
        &mut self,
        id: &str,
        geometry: GeometryData,
        layer: &str,
        style: EntityStyle,
    ) -> String {
        let string_id = id.to_string();
        let entity = self.world.spawn((
            EntityName(string_id.clone()),
            Geometry(geometry),
            LayerRef(layer.to_string()),
            Style(style),
            DrawOrder(0),
        ));
        self.id_map.insert(string_id.clone(), entity);
        self.reverse_map.insert(entity, string_id.clone());

        string_id
    }

    pub fn set_geometry(&mut self, id: &str, geometry: GeometryData) -> bool {
        let entity = match self.id_map.get(id) {
            Some(&e) => e,
            None => return false,
        };
        if let Ok(mut geo) = self.world.get::<&mut Geometry>(entity) {
            geo.0 = geometry.clone();
            if let Some(cached) = self.cache.get_mut(id) {
                cached.geometry = geometry;
            }
            true
        } else {
            false
        }
    }

    pub fn to_entity(&self, id: &str) -> Option<Entity> {
        let &hecs_entity = self.id_map.get(id)?;
        let geo = self.world.get::<&Geometry>(hecs_entity).ok()?;
        let layer = self.world.get::<&LayerRef>(hecs_entity).ok()?;
        let style = self.world.get::<&Style>(hecs_entity).ok()?;
        let order = self
            .world
            .get::<&DrawOrder>(hecs_entity)
            .map(|d| d.0)
            .unwrap_or(0);
        Some(Entity {
            id: id.to_string(),
            geometry: geo.0.clone(),
            layer_id: layer.0.clone(),
            style: style.0.clone(),
            draw_order: order,
        })
    }

    pub fn to_entities_map(&self) -> HashMap<String, Entity> {
        let mut map = HashMap::with_capacity(self.id_map.len());
        for (string_id, &hecs_entity) in &self.id_map {
            let geo = self.world.get::<&Geometry>(hecs_entity).ok();
            let layer = self.world.get::<&LayerRef>(hecs_entity).ok();
            let style = self.world.get::<&Style>(hecs_entity).ok();
            if let (Some(geo), Some(layer), Some(style)) = (geo, layer, style) {
                let order = self
                    .world
                    .get::<&DrawOrder>(hecs_entity)
                    .map(|d| d.0)
                    .unwrap_or(0);
                map.insert(
                    string_id.clone(),
                    Entity {
                        id: string_id.clone(),
                        geometry: geo.0.clone(),
                        layer_id: layer.0.clone(),
                        style: style.0.clone(),
                        draw_order: order,
                    },
                );
            }
        }
        map
    }

    pub fn sync_from_map(&mut self, entities: &HashMap<String, Entity>) {
        let current_ids: Vec<String> = self.id_map.keys().cloned().collect();
        for id in &current_ids {
            if !entities.contains_key(id) {
                self.despawn_entity(id);
            }
        }
        for (id, entity) in entities {
            if self.id_map.contains_key(id) {
                self.set_geometry(id, entity.geometry.clone());
                self.set_layer(id, &entity.layer_id);
                self.set_style(id, entity.style.clone());
            } else {
                self.spawn_entity_with_id(
                    id,
                    entity.geometry.clone(),
                    &entity.layer_id,
                    entity.style.clone(),
                );
            }
        }
    }

    pub fn for_each_entity<F: FnMut(&Entity)>(&self, mut f: F) {
        for (string_id, &hecs_entity) in &self.id_map {
            let geo = self.world.get::<&Geometry>(hecs_entity).ok();
            let layer = self.world.get::<&LayerRef>(hecs_entity).ok();
            let style = self.world.get::<&Style>(hecs_entity).ok();
            if let (Some(geo), Some(layer), Some(style)) = (geo, layer, style) {
                let order = self
                    .world
                    .get::<&DrawOrder>(hecs_entity)
                    .map(|d| d.0)
                    .unwrap_or(0);
                let entity = Entity {
                    id: string_id.clone(),
                    geometry: geo.0.clone(),
                    layer_id: layer.0.clone(),
                    style: style.0.clone(),
                    draw_order: order,
                };
                f(&entity);
            }
        }
    }

    pub fn for_each_entity_mut<F: FnMut(&str, &mut GeometryData, &mut String, &mut EntityStyle)>(
        &mut self,
        mut f: F,
    ) {
        let ids: Vec<(String, hecs::Entity)> =
            self.id_map.iter().map(|(k, &v)| (k.clone(), v)).collect();
        for (string_id, hecs_entity) in ids {
            let geo = self.world.get::<&mut Geometry>(hecs_entity).ok();
            let layer = self.world.get::<&mut LayerRef>(hecs_entity).ok();
            let style = self.world.get::<&mut Style>(hecs_entity).ok();
            if let (Some(mut geo), Some(mut layer), Some(mut style)) = (geo, layer, style) {
                f(&string_id, &mut geo.0, &mut layer.0, &mut style.0);
            }
        }
    }

    pub fn modify_entity_geometry<F: FnOnce(&mut GeometryData)>(&mut self, id: &str, f: F) -> bool {
        let entity = match self.id_map.get(id) {
            Some(&e) => e,
            None => return false,
        };
        if let Ok(mut geo) = self.world.get::<&mut Geometry>(entity) {
            f(&mut geo.0);
            true
        } else {
            false
        }
    }

    pub fn contains(&self, id: &str) -> bool {
        self.id_map.contains_key(id)
    }

    pub fn entity_ids(&self) -> Vec<String> {
        self.id_map.keys().cloned().collect()
    }

    pub fn remove_entity_returning(&mut self, id: &str) -> Option<Entity> {
        let entity = self.to_entity(id)?;
        self.despawn_entity(id);
        self.cache.remove(id);
        Some(entity)
    }

    pub fn get_entity_cloned(&self, id: &str) -> Option<Entity> {
        self.to_entity(id)
    }

    pub fn insert_entity(&mut self, entity: Entity) {
        let id = entity.id.clone();
        self.spawn_entity_with_id(
            &id,
            entity.geometry.clone(),
            &entity.layer_id,
            entity.style.clone(),
        );
        self.cache.insert(id, entity);
    }

    /// Create a new NexusWorld containing clones of only the specified entities.
    /// Used by preview_command to avoid cloning the entire ECS world.
    pub fn clone_with_entities(&self, ids: &[&str]) -> NexusWorld {
        let mut clone = NexusWorld::new();
        for id in ids {
            if let Some(entity) = self.to_entity(id) {
                clone.insert_entity(entity);
            }
        }
        clone
    }

    pub fn cache_values_cloned(&self) -> Vec<Entity> {
        if self.id_map.is_empty() {
            return Vec::new();
        }
        let mut result = Vec::with_capacity(self.id_map.len());
        for (string_id, &hecs_entity) in &self.id_map {
            let geo = self.world.get::<&Geometry>(hecs_entity).ok();
            let layer = self.world.get::<&LayerRef>(hecs_entity).ok();
            let style = self.world.get::<&Style>(hecs_entity).ok();
            if let (Some(geo), Some(layer), Some(style)) = (geo, layer, style) {
                let order = self
                    .world
                    .get::<&DrawOrder>(hecs_entity)
                    .map(|d| d.0)
                    .unwrap_or(0);
                result.push(Entity {
                    id: string_id.clone(),
                    geometry: geo.0.clone(),
                    layer_id: layer.0.clone(),
                    style: style.0.clone(),
                    draw_order: order,
                });
            }
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{EntityStyle, GeometryType, Point2D};

    fn line_geometry(x1: f64, y1: f64, x2: f64, y2: f64) -> GeometryData {
        GeometryType::Line {
            start: Point2D::new(x1, y1),
            end: Point2D::new(x2, y2),
        }
    }

    fn default_style() -> EntityStyle {
        EntityStyle::default()
    }

    #[test]
    fn spawn_and_query_entity() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            line_geometry(0.0, 0.0, 10.0, 10.0),
            "layer_0",
            default_style(),
        );

        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 0.0).abs() < 1e-9);
            assert!((end.x - 10.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }

        assert!(w.has_component::<LayerRef>(&id));
        assert!(w.has_component::<Style>(&id));
    }

    #[test]
    fn spawn_returns_string_id() {
        let mut w = NexusWorld::new();
        let id1 = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        let id2 = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        assert_eq!(id1, "ent_1");
        assert_eq!(id2, "ent_2");
    }

    #[test]
    fn despawn_entity() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        assert_eq!(w.entity_count(), 1);
        assert!(w.despawn_entity(&id));
        assert_eq!(w.entity_count(), 0);
    }

    #[test]
    fn query_by_string_id() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            line_geometry(1.0, 2.0, 3.0, 4.0),
            "layer_0",
            default_style(),
        );
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 1.0).abs() < 1e-9);
            assert!((start.y - 2.0).abs() < 1e-9);
            assert!((end.x - 3.0).abs() < 1e-9);
            assert!((end.y - 4.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn entity_count() {
        let mut w = NexusWorld::new();
        w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        assert_eq!(w.entity_count(), 3);
        let ids: Vec<String> = w.iter_entity_ids().cloned().collect();
        w.despawn_entity(&ids[0]);
        assert_eq!(w.entity_count(), 2);
    }

    #[test]
    fn iterate_all_entities() {
        let mut w = NexusWorld::new();
        for i in 0..5 {
            w.spawn_entity(
                line_geometry(i as f64, 0.0, i as f64 + 1.0, 1.0),
                "l",
                default_style(),
            );
        }
        let ids: Vec<String> = w.iter_entity_ids().cloned().collect();
        assert_eq!(ids.len(), 5);
        let unique: std::collections::HashSet<_> = ids.iter().collect();
        assert_eq!(unique.len(), 5);
    }

    #[test]
    fn get_geometry_component() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(5.0, 10.0, 15.0, 20.0), "l", default_style());
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 10.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 20.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn modify_geometry_in_place() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 10.0, 10.0), "l", default_style());

        {
            let mut geo = w.get_geometry_mut(&id).unwrap();
            geo.0.translate(5.0, 5.0);
        }

        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 5.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 15.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn multiple_archetypes() {
        use crate::components::BIMProperties;

        let mut w = NexusWorld::new();
        let id1 = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        let id2 = w.spawn_entity_with_bim(
            line_geometry(2.0, 2.0, 3.0, 3.0),
            "l",
            default_style(),
            BIMProperties {
                ifc_class: "IfcWall".to_string(),
            },
        );

        assert!(w.get_geometry(&id1).is_some());
        assert!(w.get_geometry(&id2).is_some());

        assert!(!w.has_component::<BIMProperties>(&id1));
        assert!(w.has_component::<BIMProperties>(&id2));

        let bim = w.get_component::<BIMProperties>(&id2).unwrap();
        assert_eq!(bim.ifc_class, "IfcWall");
    }

    #[test]
    fn scale_test_10k_entities() {
        let mut w = NexusWorld::new();
        for i in 0..10_000 {
            w.spawn_entity(
                line_geometry(i as f64, 0.0, i as f64 + 1.0, 1.0),
                "l",
                default_style(),
            );
        }
        assert_eq!(w.entity_count(), 10_000);

        let mut count = 0u64;
        for id in w.iter_entity_ids() {
            if w.get_geometry(id).is_some() {
                count += 1;
            }
        }
        assert_eq!(count, 10_000);
    }

    #[test]
    fn spawn_entity_has_entity_name() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        let name = w
            .get_component::<crate::components::EntityName>(&id)
            .unwrap();
        assert_eq!(name.0, id);
    }

    #[test]
    fn to_entities_json_format() {
        let mut w = NexusWorld::new();
        w.spawn_entity(
            line_geometry(0.0, 0.0, 10.0, 0.0),
            "layer_0",
            default_style(),
        );
        let json = w.to_entities_json();
        let val: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap();
        assert_eq!(val.len(), 1);
        assert!(val[0]["geometry"]["Line"].is_object());
        assert!((val[0]["geometry"]["Line"]["start"]["x"].as_f64().unwrap()).abs() < 1e-9);
        assert!((val[0]["geometry"]["Line"]["end"]["x"].as_f64().unwrap() - 10.0).abs() < 1e-9);
        assert_eq!(val[0]["layer_id"].as_str().unwrap(), "layer_0");
        assert!(val[0]["id"].is_string());
    }

    #[test]
    fn from_entities_json_roundtrip() {
        let json = r#"[
            {"id":"ent_1","geometry":{"Line":{"start":{"x":0,"y":0},"end":{"x":10,"y":0}}},"layer_id":"layer_0","style":{}},
            {"id":"ent_2","geometry":{"Circle":{"center":{"x":5,"y":5},"radius":3}},"layer_id":"layer_0","style":{}}
        ]"#;
        let mut w = NexusWorld::new();
        w.from_entities_json(json).unwrap();
        assert_eq!(w.entity_count(), 2);
        let geo1 = w.get_geometry("ent_1").unwrap();
        if let GeometryType::Line { start, end } = geo1 {
            assert!((start.x).abs() < 1e-9);
            assert!((end.x - 10.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
        let geo2 = w.get_geometry("ent_2").unwrap();
        if let GeometryType::Circle { center, radius } = geo2 {
            assert!((center.x - 5.0).abs() < 1e-9);
            assert!((radius - 3.0).abs() < 1e-9);
        } else {
            panic!("expected Circle");
        }
    }

    #[test]
    fn serialization_roundtrip_all_types() {
        let mut w1 = NexusWorld::new();
        w1.spawn_entity(line_geometry(0.0, 0.0, 10.0, 0.0), "l", default_style());
        w1.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(5.0, 5.0),
                radius: 3.0,
            },
            "l",
            default_style(),
        );
        w1.spawn_entity(
            GeometryType::Arc {
                center: Point2D::new(0.0, 0.0),
                radius: 5.0,
                start_angle: 0.0,
                end_angle: 1.0,
            },
            "l",
            default_style(),
        );
        w1.spawn_entity(
            GeometryType::Rectangle {
                origin: Point2D::new(0.0, 0.0),
                width: 10.0,
                height: 5.0,
                rotation: 0.0,
            },
            "l",
            default_style(),
        );
        w1.spawn_entity(
            GeometryType::Point {
                position: Point2D::new(7.0, 8.0),
            },
            "l",
            default_style(),
        );
        w1.spawn_entity(
            GeometryType::Polyline {
                vertices: vec![
                    Point2D::new(0.0, 0.0),
                    Point2D::new(1.0, 1.0),
                    Point2D::new(2.0, 0.0),
                ],
                closed: false,
            },
            "l",
            default_style(),
        );

        let json = w1.to_entities_json();
        let mut w2 = NexusWorld::new();
        w2.from_entities_json(&json).unwrap();
        assert_eq!(w2.entity_count(), 6);

        // Verify each entity's geometry type
        for id in w1.iter_entity_ids() {
            assert!(w2.get_geometry(id).is_some(), "missing entity {}", id);
        }
    }

    #[test]
    fn translate_entity_world() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 10.0, 0.0), "l", default_style());
        assert!(w.translate_entity(&id, 5.0, 5.0));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 5.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 5.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn rotate_entity_world() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(10.0, 0.0, 20.0, 0.0), "l", default_style());
        assert!(w.rotate_entity(&id, 0.0, 0.0, std::f64::consts::FRAC_PI_2));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x).abs() < 1e-6);
            assert!((start.y - 10.0).abs() < 1e-6);
            assert!((end.x).abs() < 1e-6);
            assert!((end.y - 20.0).abs() < 1e-6);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn scale_entity_world() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(0.0, 0.0),
                radius: 5.0,
            },
            "l",
            default_style(),
        );
        assert!(w.scale_entity(&id, 0.0, 0.0, 2.0));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Circle { radius, .. } = geo {
            assert!((radius - 10.0).abs() < 1e-9);
        } else {
            panic!("expected Circle");
        }
    }

    #[test]
    fn copy_entity_world() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 10.0, 0.0), "l", default_style());
        let new_id = w.copy_entity(&id).unwrap();
        assert_eq!(w.entity_count(), 2);
        assert_ne!(id, new_id);
        let geo1 = w.get_geometry(&id).unwrap();
        let geo2 = w.get_geometry(&new_id).unwrap();
        let json1 = serde_json::to_string(&geo1).unwrap();
        let json2 = serde_json::to_string(&geo2).unwrap();
        assert_eq!(json1, json2);
    }

    #[test]
    fn translate_nonexistent_returns_false() {
        let mut w = NexusWorld::new();
        assert!(!w.translate_entity("ent_999", 5.0, 5.0));
    }

    #[test]
    fn get_set_layer() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            line_geometry(0.0, 0.0, 1.0, 1.0),
            "layer_0",
            default_style(),
        );
        assert_eq!(w.get_layer(&id).unwrap(), "layer_0");
        assert!(w.set_layer(&id, "walls"));
        assert_eq!(w.get_layer(&id).unwrap(), "walls");
    }

    #[test]
    fn get_set_style() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        let style = w.get_style(&id).unwrap();
        assert!(style.color.is_none());
        let new_style = EntityStyle {
            color: Some("#ff0000".into()),
            linetype: None,
            lineweight: None,
        };
        assert!(w.set_style(&id, new_style));
        let updated = w.get_style(&id).unwrap();
        assert_eq!(updated.color.as_deref(), Some("#ff0000"));
    }

    #[test]
    fn json_parity_with_current_kernel() {
        use crate::Kernel;
        let mut k = Kernel::new();
        let _k_id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let k_json = k.get_entities_json();

        let mut w = NexusWorld::new();
        w.spawn_entity(
            line_geometry(0.0, 0.0, 10.0, 0.0),
            "layer_0",
            default_style(),
        );
        let w_json = w.to_entities_json();

        let k_val: Vec<serde_json::Value> = serde_json::from_str(&k_json).unwrap();
        let w_val: Vec<serde_json::Value> = serde_json::from_str(&w_json).unwrap();

        assert_eq!(k_val.len(), w_val.len());
        assert!(k_val[0]["geometry"]["Line"].is_object());
        assert!(w_val[0]["geometry"]["Line"].is_object());
        assert_eq!(
            k_val[0]["geometry"]["Line"]["start"],
            w_val[0]["geometry"]["Line"]["start"]
        );
        assert_eq!(
            k_val[0]["geometry"]["Line"]["end"],
            w_val[0]["geometry"]["Line"]["end"]
        );
        assert_eq!(k_val[0]["layer_id"], w_val[0]["layer_id"]);
    }

    #[test]
    fn spawn_entity_with_id_uses_given_id() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity_with_id(
            "custom_1",
            line_geometry(0.0, 0.0, 10.0, 0.0),
            "l",
            default_style(),
        );
        assert_eq!(id, "custom_1");
        assert_eq!(w.entity_count(), 1);
        assert!(w.get_geometry("custom_1").is_some());
    }

    #[test]
    fn spawn_entity_with_id_doesnt_affect_counter() {
        let mut w = NexusWorld::new();
        w.spawn_entity_with_id(
            "custom",
            line_geometry(0.0, 0.0, 1.0, 1.0),
            "l",
            default_style(),
        );
        let auto_id = w.spawn_entity(line_geometry(0.0, 0.0, 2.0, 2.0), "l", default_style());
        assert_eq!(auto_id, "ent_1");
    }

    #[test]
    fn set_geometry_replaces() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(line_geometry(0.0, 0.0, 10.0, 0.0), "l", default_style());
        let circle = GeometryType::Circle {
            center: Point2D::new(5.0, 5.0),
            radius: 3.0,
        };
        assert!(w.set_geometry(&id, circle));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Circle { center, radius } = geo {
            assert!((center.x - 5.0).abs() < 1e-9);
            assert!((radius - 3.0).abs() < 1e-9);
        } else {
            panic!("expected Circle");
        }
    }

    #[test]
    fn set_geometry_nonexistent_returns_false() {
        let mut w = NexusWorld::new();
        assert!(!w.set_geometry("ent_999", line_geometry(0.0, 0.0, 1.0, 1.0)));
    }

    #[test]
    fn remove_entity_returns_it() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            line_geometry(0.0, 0.0, 10.0, 0.0),
            "layer_0",
            default_style(),
        );
        let removed = w.remove_entity_returning(&id);
        assert!(removed.is_some());
        assert_eq!(w.entity_count(), 0);
        let ent = removed.unwrap();
        assert_eq!(ent.id, id);
    }

    #[test]
    fn remove_nonexistent_returns_none() {
        let mut w = NexusWorld::new();
        assert!(w.remove_entity_returning("ent_999").is_none());
    }

    #[test]
    fn get_entity_cloned_returns_full_entity() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            line_geometry(1.0, 2.0, 3.0, 4.0),
            "layer_0",
            default_style(),
        );
        let ent = w.get_entity_cloned(&id);
        assert!(ent.is_some());
        let ent = ent.unwrap();
        assert_eq!(ent.id, id);
        assert_eq!(ent.layer_id, "layer_0");
    }

    #[test]
    fn insert_entity_preserves_id() {
        let mut w = NexusWorld::new();
        let entity = Entity {
            id: "custom_42".to_string(),
            geometry: line_geometry(0.0, 0.0, 5.0, 5.0),
            layer_id: "layer_0".to_string(),
            style: default_style(),
            draw_order: 0,
        };
        w.insert_entity(entity);
        assert_eq!(w.entity_count(), 1);
        assert!(w.get_geometry("custom_42").is_some());
    }

    #[test]
    fn cache_values_cloned_returns_all() {
        let mut w = NexusWorld::new();
        w.spawn_entity(line_geometry(0.0, 0.0, 1.0, 1.0), "l", default_style());
        w.spawn_entity(line_geometry(2.0, 2.0, 3.0, 3.0), "l", default_style());
        let vals = w.cache_values_cloned();
        assert_eq!(vals.len(), 2);
    }

    #[test]
    fn test_clone_with_entities() {
        let mut world = NexusWorld::new();
        let id1 = world.spawn_entity(
            GeometryType::Line {
                start: Point2D { x: 0.0, y: 0.0 },
                end: Point2D { x: 10.0, y: 0.0 },
            },
            "layer_0",
            EntityStyle::default(),
        );
        let id2 = world.spawn_entity(
            GeometryType::Circle {
                center: Point2D { x: 5.0, y: 5.0 },
                radius: 3.0,
            },
            "layer_0",
            EntityStyle::default(),
        );

        let cloned = world.clone_with_entities(&[&id1]);
        assert_eq!(cloned.entity_count(), 1);
        assert!(cloned.get_entity_cloned(&id1).is_some());
        assert!(cloned.get_entity_cloned(&id2).is_none());
    }

    #[test]
    fn test_clone_with_entities_empty() {
        let mut world = NexusWorld::new();
        world.spawn_entity(
            GeometryType::Line {
                start: Point2D { x: 0.0, y: 0.0 },
                end: Point2D { x: 10.0, y: 0.0 },
            },
            "layer_0",
            EntityStyle::default(),
        );

        let cloned = world.clone_with_entities(&[]);
        assert_eq!(cloned.entity_count(), 0);
    }
}
