use crate::apply::{apply_event, unapply_event};
use crate::events::CadEvent;
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn apply_undo_event(
    world: &mut NexusWorld,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    event: &CadEvent,
) {
    collect_affected_ids(event, dirty_ids, deleted_ids, true);
    unapply_event(world, event);
}

pub(crate) fn apply_redo_event(
    world: &mut NexusWorld,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    event: &CadEvent,
) {
    collect_affected_ids(event, dirty_ids, deleted_ids, false);
    apply_event(world, event);
}

fn collect_affected_ids(
    event: &CadEvent,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    is_undo: bool,
) {
    match event {
        CadEvent::EntityCreated { entity } => {
            if is_undo {
                deleted_ids.push(entity.id.clone());
            } else {
                dirty_ids.insert(entity.id.clone());
            }
        }
        CadEvent::EntityDeleted { entity } => {
            if is_undo {
                dirty_ids.insert(entity.id.clone());
            } else {
                deleted_ids.push(entity.id.clone());
            }
        }
        CadEvent::EntityMoved { id, .. }
        | CadEvent::EntityRotated { id, .. }
        | CadEvent::EntityScaled { id, .. }
        | CadEvent::EntityModified { id, .. }
        | CadEvent::EntityStyleChanged { id, .. } => {
            dirty_ids.insert(id.clone());
        }
        CadEvent::EntityCopied { new_entity, .. } => {
            if is_undo {
                deleted_ids.push(new_entity.id.clone());
            } else {
                dirty_ids.insert(new_entity.id.clone());
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
        CadEvent::CompoundEvent { events } => {
            let iter: Box<dyn Iterator<Item = &CadEvent>> = if is_undo {
                Box::new(events.iter().rev())
            } else {
                Box::new(events.iter())
            };
            for sub in iter {
                collect_affected_ids(sub, dirty_ids, deleted_ids, is_undo);
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

    fn make_world_and_sets() -> (NexusWorld, HashSet<String>, Vec<String>) {
        (NexusWorld::new(), HashSet::new(), Vec::new())
    }

    #[test]
    fn undo_entity_created_removes() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(entity.clone());

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityCreated { entity },
        );

        assert_eq!(world.entity_count(), 0);
        assert!(deleted.contains(&"e1".to_string()));
    }

    #[test]
    fn redo_entity_created_reinserts() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();

        apply_redo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityCreated {
                entity: entity.clone(),
            },
        );

        assert_eq!(world.entity_count(), 1);
        assert!(dirty.contains("e1"));
    }

    #[test]
    fn undo_entity_deleted_restores() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityDeleted {
                entity: entity.clone(),
            },
        );

        assert_eq!(world.entity_count(), 1);
        assert!(dirty.contains("e1"));
    }

    #[test]
    fn redo_entity_deleted_removes() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(entity.clone());

        apply_redo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityDeleted { entity },
        );

        assert_eq!(world.entity_count(), 0);
        assert!(deleted.contains(&"e1".to_string()));
    }

    #[test]
    fn undo_entity_moved_restores_geometry() {
        let moved = make_line_entity("e1", 5.0, 5.0, 15.0, 15.0);
        let old_geometry = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 10.0),
        };
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(moved);

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityMoved {
                id: "e1".to_string(),
                dx: 5.0,
                dy: 5.0,
                old_geometry,
            },
        );

        let geo = world.get_geometry("e1").unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert_eq!((start.x, start.y, end.x, end.y), (0.0, 0.0, 10.0, 10.0));
        } else {
            panic!("expected Line");
        }
        assert!(dirty.contains("e1"));
    }

    #[test]
    fn redo_entity_moved_translates() {
        let entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let old_geometry = entity.geometry.clone();
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(entity);

        apply_redo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityMoved {
                id: "e1".to_string(),
                dx: 5.0,
                dy: 3.0,
                old_geometry,
            },
        );

        let geo = world.get_geometry("e1").unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 3.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 13.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn undo_compound_reverses_order() {
        let e1 = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let e2 = make_line_entity("e2", 20.0, 20.0, 30.0, 30.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(e1.clone());
        world.insert_entity(e2.clone());

        let compound = CadEvent::CompoundEvent {
            events: vec![
                CadEvent::EntityCreated { entity: e1 },
                CadEvent::EntityCreated { entity: e2 },
            ],
        };

        apply_undo_event(&mut world, &mut dirty, &mut deleted, &compound);
        assert_eq!(world.entity_count(), 0);
        assert_eq!(deleted.len(), 2);
    }

    #[test]
    fn undo_missing_entity_no_panic() {
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityMoved {
                id: "nonexistent".to_string(),
                dx: 5.0,
                dy: 5.0,
                old_geometry: GeometryType::Line {
                    start: Point2D::new(0.0, 0.0),
                    end: Point2D::new(10.0, 10.0),
                },
            },
        );

        assert!(dirty.contains("nonexistent"));
        assert_eq!(world.entity_count(), 0);
    }

    #[test]
    fn undo_entity_style_changed() {
        let mut entity = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let new_style = EntityStyle {
            color: Some("red".to_string()),
            linetype: None,
            lineweight: None,
        };
        entity.style = new_style.clone();
        let old_style = EntityStyle::default();

        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(entity);

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityStyleChanged {
                id: "e1".to_string(),
                old_style: old_style.clone(),
                new_style,
            },
        );

        let ent = world.get_entity_cloned("e1").unwrap();
        assert!(ent.style.color.is_none());
    }

    #[test]
    fn undo_entity_copied_removes_copy() {
        let original = make_line_entity("e1", 0.0, 0.0, 10.0, 10.0);
        let copy = make_line_entity("e2", 0.0, 0.0, 10.0, 10.0);
        let (mut world, mut dirty, mut deleted) = make_world_and_sets();
        world.insert_entity(original);
        world.insert_entity(copy.clone());

        apply_undo_event(
            &mut world,
            &mut dirty,
            &mut deleted,
            &CadEvent::EntityCopied {
                original_id: "e1".to_string(),
                new_entity: copy,
            },
        );

        assert!(world.contains("e1"));
        assert!(!world.contains("e2"));
        assert!(deleted.contains(&"e2".to_string()));
    }
}
