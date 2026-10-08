use crate::events::CadEvent;
use crate::world::NexusWorld;

pub fn apply_undo(world: &mut NexusWorld, event: &CadEvent) {
    match event {
        CadEvent::EntityCreated { entity } => {
            world.despawn_entity(&entity.id);
        }
        CadEvent::EntityDeleted { entity } => {
            world.spawn_entity_with_id(
                &entity.id,
                entity.geometry.clone(),
                &entity.layer_id,
                entity.style.clone(),
            );
        }
        CadEvent::EntityMoved {
            id, old_geometry, ..
        } => {
            world.set_geometry(id, old_geometry.clone());
        }
        CadEvent::EntityRotated {
            id, old_geometry, ..
        } => {
            world.set_geometry(id, old_geometry.clone());
        }
        CadEvent::EntityScaled {
            id, old_geometry, ..
        } => {
            world.set_geometry(id, old_geometry.clone());
        }
        CadEvent::EntityCopied { new_entity, .. } => {
            world.despawn_entity(&new_entity.id);
        }
        CadEvent::EntityModified {
            id, old_geometry, ..
        } => {
            world.set_geometry(id, old_geometry.clone());
        }
        CadEvent::EntityStyleChanged { id, old_style, .. } => {
            world.set_style(id, old_style.clone());
        }
        CadEvent::CompoundEvent { events } => {
            for sub in events.iter().rev() {
                apply_undo(world, sub);
            }
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
    }
}

pub fn apply_redo(world: &mut NexusWorld, event: &CadEvent) {
    match event {
        CadEvent::EntityCreated { entity } => {
            world.spawn_entity_with_id(
                &entity.id,
                entity.geometry.clone(),
                &entity.layer_id,
                entity.style.clone(),
            );
        }
        CadEvent::EntityDeleted { entity } => {
            world.despawn_entity(&entity.id);
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
            world.spawn_entity_with_id(
                &new_entity.id,
                new_entity.geometry.clone(),
                &new_entity.layer_id,
                new_entity.style.clone(),
            );
        }
        CadEvent::EntityModified {
            id, new_geometry, ..
        } => {
            world.set_geometry(id, new_geometry.clone());
        }
        CadEvent::EntityStyleChanged { id, new_style, .. } => {
            world.set_style(id, new_style.clone());
        }
        CadEvent::CompoundEvent { events } => {
            for sub in events.iter() {
                apply_redo(world, sub);
            }
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
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};
    use crate::undo::{apply_redo_event, apply_undo_event};
    use std::collections::HashSet;

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

    fn make_circle_entity(id: &str, cx: f64, cy: f64, r: f64) -> Entity {
        Entity {
            id: id.to_string(),
            geometry: GeometryType::Circle {
                center: Point2D::new(cx, cy),
                radius: r,
            },
            layer_id: "layer_0".to_string(),
            style: EntityStyle::default(),
            draw_order: 0,
        }
    }

    fn line_start_end(geo: &GeometryType) -> (f64, f64, f64, f64) {
        match geo {
            GeometryType::Line { start, end } => (start.x, start.y, end.x, end.y),
            _ => panic!("expected Line geometry"),
        }
    }

    fn spawn_line_in_world(
        w: &mut NexusWorld,
        id: &str,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    ) -> String {
        w.spawn_entity_with_id(
            id,
            GeometryType::Line {
                start: Point2D::new(x1, y1),
                end: Point2D::new(x2, y2),
            },
            "layer_0",
            EntityStyle::default(),
        )
    }

    #[test]
    fn undo_entity_created_removes() {
        let mut w = NexusWorld::new();
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        spawn_line_in_world(&mut w, "e1", 0.0, 0.0, 10.0, 10.0);
        assert_eq!(w.entity_count(), 1);

        apply_undo(&mut w, &CadEvent::EntityCreated { entity });
        assert_eq!(w.entity_count(), 0);
        assert!(w.get_geometry("e1").is_none());
    }

    #[test]
    fn redo_entity_created_restores() {
        let mut w = NexusWorld::new();
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);

        apply_redo(&mut w, &CadEvent::EntityCreated { entity });
        assert_eq!(w.entity_count(), 1);
        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1).abs() < 1e-9);
        assert!((y1).abs() < 1e-9);
        assert!((x2 - 10.0).abs() < 1e-9);
        assert!((y2 - 10.0).abs() < 1e-9);
    }

    #[test]
    fn undo_entity_deleted_restores() {
        let mut w = NexusWorld::new();
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);

        apply_undo(
            &mut w,
            &CadEvent::EntityDeleted {
                entity: entity.clone(),
            },
        );
        assert_eq!(w.entity_count(), 1);
        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1).abs() < 1e-9);
        assert!((y1).abs() < 1e-9);
        assert!((x2 - 10.0).abs() < 1e-9);
        assert!((y2 - 10.0).abs() < 1e-9);
    }

    #[test]
    fn undo_entity_moved_restores_position() {
        let mut w = NexusWorld::new();
        spawn_line_in_world(&mut w, "e1", 5.0, 5.0, 15.0, 5.0);

        let old_geometry = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };

        apply_undo(
            &mut w,
            &CadEvent::EntityMoved {
                id: "e1".to_string(),
                dx: 5.0,
                dy: 5.0,
                old_geometry,
            },
        );

        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1).abs() < 1e-9);
        assert!((y1).abs() < 1e-9);
        assert!((x2 - 10.0).abs() < 1e-9);
        assert!((y2).abs() < 1e-9);
    }

    #[test]
    fn redo_entity_moved_applies_translation() {
        let mut w = NexusWorld::new();
        spawn_line_in_world(&mut w, "e1", 0.0, 0.0, 10.0, 0.0);

        let old_geometry = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 0.0),
        };

        apply_redo(
            &mut w,
            &CadEvent::EntityMoved {
                id: "e1".to_string(),
                dx: 5.0,
                dy: 5.0,
                old_geometry,
            },
        );

        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1 - 5.0).abs() < 1e-9);
        assert!((y1 - 5.0).abs() < 1e-9);
        assert!((x2 - 15.0).abs() < 1e-9);
        assert!((y2 - 5.0).abs() < 1e-9);
    }

    #[test]
    fn undo_entity_copied_removes_copy() {
        let mut w = NexusWorld::new();
        spawn_line_in_world(&mut w, "e1", 0.0, 0.0, 10.0, 10.0);
        let copy = make_line_entity("e2", 0.0, 0.0, 10.0, 10.0);
        spawn_line_in_world(&mut w, "e2", 0.0, 0.0, 10.0, 10.0);
        assert_eq!(w.entity_count(), 2);

        apply_undo(
            &mut w,
            &CadEvent::EntityCopied {
                original_id: "e1".to_string(),
                new_entity: copy,
            },
        );

        assert_eq!(w.entity_count(), 1);
        assert!(w.get_geometry("e1").is_some());
        assert!(w.get_geometry("e2").is_none());
    }

    #[test]
    fn undo_entity_modified_restores_old_geometry() {
        let mut w = NexusWorld::new();
        w.spawn_entity_with_id(
            "e1",
            GeometryType::Circle {
                center: Point2D::new(0.0, 0.0),
                radius: 10.0,
            },
            "layer_0",
            EntityStyle::default(),
        );

        let old_geometry = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 5.0,
        };
        let new_geometry = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 10.0,
        };

        apply_undo(
            &mut w,
            &CadEvent::EntityModified {
                id: "e1".to_string(),
                old_geometry,
                new_geometry,
            },
        );

        let geo = w.get_geometry("e1").unwrap();
        if let GeometryType::Circle { radius, .. } = geo {
            assert!((radius - 5.0).abs() < 1e-9);
        } else {
            panic!("expected Circle");
        }
    }

    #[test]
    fn undo_entity_style_changed() {
        let mut w = NexusWorld::new();
        let new_style = EntityStyle {
            color: Some("red".to_string()),
            linetype: None,
            lineweight: None,
        };
        w.spawn_entity_with_id(
            "e1",
            GeometryType::Line {
                start: Point2D::new(0.0, 0.0),
                end: Point2D::new(10.0, 0.0),
            },
            "layer_0",
            new_style.clone(),
        );

        let old_style = EntityStyle::default();

        apply_undo(
            &mut w,
            &CadEvent::EntityStyleChanged {
                id: "e1".to_string(),
                old_style: old_style.clone(),
                new_style,
            },
        );

        let style = w.get_style("e1").unwrap();
        assert!(style.color.is_none());
    }

    #[test]
    fn undo_compound_reverses_order() {
        let mut w = NexusWorld::new();
        let e1 = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let e2 = make_line_entity("e2", 20.0, 20.0, 30.0, 30.0);
        spawn_line_in_world(&mut w, "e1", 0.0, 0.0, 10.0, 10.0);
        spawn_line_in_world(&mut w, "e2", 20.0, 20.0, 30.0, 30.0);
        assert_eq!(w.entity_count(), 2);

        let compound = CadEvent::CompoundEvent {
            events: vec![
                CadEvent::EntityCreated { entity: e1 },
                CadEvent::EntityCreated { entity: e2 },
            ],
        };

        apply_undo(&mut w, &compound);
        assert_eq!(w.entity_count(), 0);
    }

    #[test]
    fn full_create_undo_redo_cycle() {
        let mut w = NexusWorld::new();
        let entity = make_line_entity("e1", 1.0, 2.0, 3.0, 4.0);

        // Create
        apply_redo(
            &mut w,
            &CadEvent::EntityCreated {
                entity: entity.clone(),
            },
        );
        assert_eq!(w.entity_count(), 1);
        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1 - 1.0).abs() < 1e-9);
        assert!((y1 - 2.0).abs() < 1e-9);
        assert!((x2 - 3.0).abs() < 1e-9);
        assert!((y2 - 4.0).abs() < 1e-9);

        // Undo
        apply_undo(
            &mut w,
            &CadEvent::EntityCreated {
                entity: entity.clone(),
            },
        );
        assert_eq!(w.entity_count(), 0);

        // Redo
        apply_redo(&mut w, &CadEvent::EntityCreated { entity });
        assert_eq!(w.entity_count(), 1);
        let geo = w.get_geometry("e1").unwrap();
        let (x1, y1, x2, y2) = line_start_end(&geo);
        assert!((x1 - 1.0).abs() < 1e-9);
        assert!((y1 - 2.0).abs() < 1e-9);
        assert!((x2 - 3.0).abs() < 1e-9);
        assert!((y2 - 4.0).abs() < 1e-9);
    }

    #[test]
    fn undo_redo_event_roundtrip() {
        // Test that apply_redo_event + apply_undo_event produces the same result as apply_redo/apply_undo
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

        // --- apply_redo_event / apply_undo_event path ---
        let mut w1 = NexusWorld::new();
        let mut dirty = HashSet::new();
        let mut deleted = Vec::new();
        apply_redo_event(&mut w1, &mut dirty, &mut deleted, &create_event);
        apply_redo_event(&mut w1, &mut dirty, &mut deleted, &move_event);
        dirty.clear();
        deleted.clear();
        apply_undo_event(&mut w1, &mut dirty, &mut deleted, &move_event);
        let geo1 = w1.get_geometry("e1").unwrap();

        // --- apply_redo / apply_undo path ---
        let mut w2 = NexusWorld::new();
        apply_redo(&mut w2, &create_event);
        apply_redo(&mut w2, &move_event);
        apply_undo(&mut w2, &move_event);
        let geo2 = w2.get_geometry("e1").unwrap();

        // Compare
        let json1 = serde_json::to_string(&geo1).unwrap();
        let json2 = serde_json::to_string(&geo2).unwrap();
        assert_eq!(json1, json2);
    }
}
