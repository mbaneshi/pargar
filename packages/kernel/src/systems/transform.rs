use crate::geometry_ops::mirror_geometry;
use crate::world::NexusWorld;

pub fn mirror_entity(world: &mut NexusWorld, id: &str, x1: f64, y1: f64, x2: f64, y2: f64) -> bool {
    if let Some(mut geo) = world.get_geometry_mut(id) {
        mirror_geometry(&mut geo.0, x1, y1, x2, y2);
        true
    } else {
        false
    }
}

pub fn mirror_and_copy(
    world: &mut NexusWorld,
    id: &str,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
) -> Option<String> {
    let new_id = world.copy_entity(id)?;
    if mirror_entity(world, &new_id, x1, y1, x2, y2) {
        Some(new_id)
    } else {
        world.despawn_entity(&new_id);
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{EntityStyle, GeometryType, Point2D};

    fn default_style() -> EntityStyle {
        EntityStyle::default()
    }

    #[test]
    fn mirror_line_across_y_axis() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(5.0, 1.0),
                end: Point2D::new(10.0, 1.0),
            },
            "l",
            default_style(),
        );
        // Mirror across Y axis: line from (0,0) to (0,1)
        assert!(mirror_entity(&mut w, &id, 0.0, 0.0, 0.0, 1.0));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = geo {
            assert!((start.x - (-5.0)).abs() < 1e-9);
            assert!((start.y - 1.0).abs() < 1e-9);
            assert!((end.x - (-10.0)).abs() < 1e-9);
            assert!((end.y - 1.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn mirror_circle() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(5.0, 3.0),
                radius: 2.0,
            },
            "l",
            default_style(),
        );
        // Mirror across Y axis
        assert!(mirror_entity(&mut w, &id, 0.0, 0.0, 0.0, 1.0));
        let geo = w.get_geometry(&id).unwrap();
        if let GeometryType::Circle { center, radius } = geo {
            assert!((center.x - (-5.0)).abs() < 1e-9);
            assert!((center.y - 3.0).abs() < 1e-9);
            assert!((radius - 2.0).abs() < 1e-9);
        } else {
            panic!("expected Circle");
        }
    }

    #[test]
    fn mirror_and_copy_creates_new() {
        let mut w = NexusWorld::new();
        let id = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(5.0, 1.0),
                end: Point2D::new(10.0, 1.0),
            },
            "l",
            default_style(),
        );
        let new_id = mirror_and_copy(&mut w, &id, 0.0, 0.0, 0.0, 1.0).unwrap();
        assert_ne!(id, new_id);
        assert_eq!(w.entity_count(), 2);

        // Original unchanged
        let orig = w.get_geometry(&id).unwrap();
        if let GeometryType::Line { start, end } = orig {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((end.x - 10.0).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }

        // Copy is mirrored
        let copy = w.get_geometry(&new_id).unwrap();
        if let GeometryType::Line { start, end } = copy {
            assert!((start.x - (-5.0)).abs() < 1e-9);
            assert!((end.x - (-10.0)).abs() < 1e-9);
        } else {
            panic!("expected Line");
        }
    }

    #[test]
    fn mirror_nonexistent() {
        let mut w = NexusWorld::new();
        assert!(!mirror_entity(&mut w, "ent_999", 0.0, 0.0, 0.0, 1.0));
    }
}
