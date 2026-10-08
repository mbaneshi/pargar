use crate::events::CadEvent;
use crate::world::NexusWorld;

pub(crate) fn apply_event(world: &mut NexusWorld, event: &CadEvent) {
    match event {
        CadEvent::EntityCreated { entity } => {
            world.insert_entity(entity.clone());
        }
        CadEvent::EntityDeleted { entity } => {
            world.remove_entity_returning(&entity.id);
        }
        CadEvent::EntityMoved { id, dx, dy, .. } => {
            world.translate_entity(id, *dx, *dy);
        }
        CadEvent::EntityRotated {
            id, cx, cy, angle, ..
        } => {
            world.rotate_entity(id, *cx, *cy, *angle);
        }
        CadEvent::EntityScaled {
            id, cx, cy, factor, ..
        } => {
            world.scale_entity(id, *cx, *cy, *factor);
        }
        CadEvent::EntityCopied { new_entity, .. } => {
            world.insert_entity(new_entity.clone());
        }
        CadEvent::EntityModified {
            id, new_geometry, ..
        } => {
            world.set_geometry(id, new_geometry.clone());
        }
        CadEvent::EntityStyleChanged { id, new_style, .. } => {
            world.set_style(id, new_style.clone());
        }
        CadEvent::TextStyleCreated { .. }
        | CadEvent::TextStyleModified { .. }
        | CadEvent::TextStyleDeleted { .. }
        | CadEvent::DimStyleCreated { .. }
        | CadEvent::DimStyleModified { .. }
        | CadEvent::DimStyleDeleted { .. }
        | CadEvent::MLeaderStyleCreated { .. }
        | CadEvent::MLeaderStyleModified { .. }
        | CadEvent::MLeaderStyleDeleted { .. }
        | CadEvent::TableStyleCreated { .. }
        | CadEvent::TableStyleModified { .. }
        | CadEvent::TableStyleDeleted { .. }
        | CadEvent::DwgPropsChanged { .. }
        | CadEvent::GroupCreated { .. }
        | CadEvent::GroupDeleted { .. }
        | CadEvent::GroupModified { .. }
        | CadEvent::NamedUcsCreated { .. }
        | CadEvent::NamedUcsDeleted { .. }
        | CadEvent::NamedUcsModified { .. }
        | CadEvent::NamedViewCreated { .. }
        | CadEvent::NamedViewDeleted { .. }
        | CadEvent::NamedViewModified { .. } => {}
        CadEvent::CompoundEvent { events } => {
            for sub in events {
                apply_event(world, sub);
            }
        }
    }
}

pub(crate) fn unapply_event(world: &mut NexusWorld, event: &CadEvent) {
    match event {
        CadEvent::EntityCreated { entity } => {
            world.remove_entity_returning(&entity.id);
        }
        CadEvent::EntityDeleted { entity } => {
            world.insert_entity(entity.clone());
        }
        CadEvent::EntityMoved {
            id, old_geometry, ..
        }
        | CadEvent::EntityRotated {
            id, old_geometry, ..
        }
        | CadEvent::EntityScaled {
            id, old_geometry, ..
        }
        | CadEvent::EntityModified {
            id, old_geometry, ..
        } => {
            world.set_geometry(id, old_geometry.clone());
        }
        CadEvent::EntityCopied { new_entity, .. } => {
            world.remove_entity_returning(&new_entity.id);
        }
        CadEvent::EntityStyleChanged { id, old_style, .. } => {
            world.set_style(id, old_style.clone());
        }
        CadEvent::TextStyleCreated { .. }
        | CadEvent::TextStyleModified { .. }
        | CadEvent::TextStyleDeleted { .. }
        | CadEvent::DimStyleCreated { .. }
        | CadEvent::DimStyleModified { .. }
        | CadEvent::DimStyleDeleted { .. }
        | CadEvent::MLeaderStyleCreated { .. }
        | CadEvent::MLeaderStyleModified { .. }
        | CadEvent::MLeaderStyleDeleted { .. }
        | CadEvent::TableStyleCreated { .. }
        | CadEvent::TableStyleModified { .. }
        | CadEvent::TableStyleDeleted { .. }
        | CadEvent::DwgPropsChanged { .. }
        | CadEvent::GroupCreated { .. }
        | CadEvent::GroupDeleted { .. }
        | CadEvent::GroupModified { .. }
        | CadEvent::NamedUcsCreated { .. }
        | CadEvent::NamedUcsDeleted { .. }
        | CadEvent::NamedUcsModified { .. }
        | CadEvent::NamedViewCreated { .. }
        | CadEvent::NamedViewDeleted { .. }
        | CadEvent::NamedViewModified { .. } => {}
        CadEvent::CompoundEvent { events } => {
            for sub in events.iter().rev() {
                unapply_event(world, sub);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};

    fn make_line_entity(id: &str, x1: f64, y1: f64, x2: f64, y2: f64) -> Entity {
        Entity {
            id: id.to_string(),
            geometry: GeometryType::Line {
                start: Point2D::new(x1, y1),
                end: Point2D::new(x2, y2),
            },
            layer_id: "layer_0".to_string(),
            style: EntityStyle::default(),
            draw_order: 0,
        }
    }

    fn geometry_json(world: &NexusWorld, id: &str) -> String {
        serde_json::to_string(&world.get_geometry(id).unwrap()).unwrap()
    }

    #[test]
    fn apply_create_then_unapply() {
        let mut world = NexusWorld::new();
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 0.0);
        let event = CadEvent::EntityCreated {
            entity: entity.clone(),
        };

        apply_event(&mut world, &event);
        assert_eq!(world.entity_count(), 1);
        assert!(world.get_geometry("e1").is_some());

        unapply_event(&mut world, &event);
        assert_eq!(world.entity_count(), 0);
        assert!(world.get_geometry("e1").is_none());
    }

    #[test]
    fn apply_move_then_unapply() {
        let mut world = NexusWorld::new();
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 0.0);
        world.insert_entity(entity.clone());

        let original_geo = geometry_json(&world, "e1");

        let move_event = CadEvent::EntityMoved {
            id: "e1".to_string(),
            dx: 5.0,
            dy: 3.0,
            old_geometry: entity.geometry.clone(),
        };

        apply_event(&mut world, &move_event);
        let moved_geo = geometry_json(&world, "e1");
        assert_ne!(original_geo, moved_geo);

        if let GeometryType::Line { start, end } = world.get_geometry("e1").unwrap() {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 3.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 3.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }

        unapply_event(&mut world, &move_event);
        let restored_geo = geometry_json(&world, "e1");
        assert_eq!(original_geo, restored_geo);
    }

    #[test]
    fn replay_from_scratch_matches_state() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 0.0);

        let create_event = CadEvent::EntityCreated {
            entity: entity.clone(),
        };
        let move_event = CadEvent::EntityMoved {
            id: "e1".to_string(),
            dx: 5.0,
            dy: 3.0,
            old_geometry: entity.geometry.clone(),
        };

        let mut world_a = NexusWorld::new();
        apply_event(&mut world_a, &create_event);
        apply_event(&mut world_a, &move_event);

        let mut world_b = NexusWorld::new();
        apply_event(&mut world_b, &create_event);
        apply_event(&mut world_b, &move_event);

        let geo_a = geometry_json(&world_a, "e1");
        let geo_b = geometry_json(&world_b, "e1");
        assert_eq!(geo_a, geo_b);
        assert_eq!(world_a.entity_count(), world_b.entity_count());
    }
}
