use crate::entity::GeometryType;
use crate::world::NexusWorld;
use rstar::{PointDistance, RTree, AABB};

#[derive(Debug, Clone)]
struct SpatialEntry {
    entity_id: String,
    envelope: AABB<[f64; 2]>,
}

impl rstar::RTreeObject for SpatialEntry {
    type Envelope = AABB<[f64; 2]>;

    fn envelope(&self) -> Self::Envelope {
        self.envelope
    }
}

impl PointDistance for SpatialEntry {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        self.envelope.distance_2(point)
    }
}

pub fn geometry_aabb(geom: &GeometryType) -> AABB<[f64; 2]> {
    match geom {
        GeometryType::Line { start, end } => {
            let min_x = start.x.min(end.x);
            let min_y = start.y.min(end.y);
            let max_x = start.x.max(end.x);
            let max_y = start.y.max(end.y);
            AABB::from_corners([min_x, min_y], [max_x, max_y])
        }
        GeometryType::Circle { center, radius } => AABB::from_corners(
            [center.x - radius, center.y - radius],
            [center.x + radius, center.y + radius],
        ),
        GeometryType::Arc { center, radius, .. } => AABB::from_corners(
            [center.x - radius, center.y - radius],
            [center.x + radius, center.y + radius],
        ),
        GeometryType::Rectangle {
            origin,
            width,
            height,
            ..
        } => AABB::from_corners([origin.x, origin.y], [origin.x + width, origin.y + height]),
        GeometryType::Polyline { vertices, .. } => {
            if vertices.is_empty() {
                return AABB::from_corners([0.0, 0.0], [0.0, 0.0]);
            }
            let mut min_x = f64::MAX;
            let mut min_y = f64::MAX;
            let mut max_x = f64::MIN;
            let mut max_y = f64::MIN;
            for v in vertices {
                min_x = min_x.min(v.x);
                min_y = min_y.min(v.y);
                max_x = max_x.max(v.x);
                max_y = max_y.max(v.y);
            }
            AABB::from_corners([min_x, min_y], [max_x, max_y])
        }
        GeometryType::Ellipse {
            center,
            semi_major,
            semi_minor,
            ..
        } => AABB::from_corners(
            [center.x - semi_major, center.y - semi_minor],
            [center.x + semi_major, center.y + semi_minor],
        ),
        _ => {
            let p = geometry_fallback_point(geom);
            AABB::from_corners([p.0, p.1], [p.0, p.1])
        }
    }
}

fn geometry_fallback_point(geom: &GeometryType) -> (f64, f64) {
    match geom {
        GeometryType::Text { position, .. } => (position.x, position.y),
        GeometryType::Dimension { start, .. } => (start.x, start.y),
        GeometryType::ConstructionLine { origin, .. } => (origin.x, origin.y),
        GeometryType::BlockRef { insertion, .. } => (insertion.x, insertion.y),
        GeometryType::MText { position, .. } => (position.x, position.y),
        GeometryType::Table { position, .. } => (position.x, position.y),
        GeometryType::Spline { control_points, .. } => {
            if let Some(p) = control_points.first() {
                (p.x, p.y)
            } else {
                (0.0, 0.0)
            }
        }
        GeometryType::Hatch { .. } => (0.0, 0.0),
        GeometryType::AlignedDimension { start, .. } => (start.x, start.y),
        GeometryType::AngularDimension { center, .. } => (center.x, center.y),
        GeometryType::RadialDimension { center, .. } => (center.x, center.y),
        GeometryType::DiameterDimension { center, .. } => (center.x, center.y),
        GeometryType::Point { position } => (position.x, position.y),
        GeometryType::RevisionCloud { boundary, .. } => {
            if let Some(p) = boundary.first() {
                (p.x, p.y)
            } else {
                (0.0, 0.0)
            }
        }
        _ => (0.0, 0.0),
    }
}

pub struct WorldSpatialIndex {
    tree: RTree<SpatialEntry>,
}

impl WorldSpatialIndex {
    pub fn rebuild(world: &NexusWorld) -> Self {
        let entries: Vec<SpatialEntry> = world
            .iter_entity_ids()
            .filter_map(|id| {
                let geo = world.get_geometry(id)?;
                Some(SpatialEntry {
                    entity_id: id.clone(),
                    envelope: geometry_aabb(&geo),
                })
            })
            .collect();
        Self {
            tree: RTree::bulk_load(entries),
        }
    }

    pub fn query_window(&self, min: [f64; 2], max: [f64; 2]) -> Vec<String> {
        let query_rect = AABB::from_corners(min, max);
        self.tree
            .locate_in_envelope_intersecting(&query_rect)
            .map(|e| e.entity_id.clone())
            .collect()
    }

    pub fn query_nearest(&self, point: [f64; 2], radius: f64) -> Option<String> {
        self.tree
            .nearest_neighbor(&point)
            .filter(|e| e.distance_2(&point).sqrt() <= radius)
            .map(|e| e.entity_id.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{EntityStyle, Point2D};

    fn default_style() -> EntityStyle {
        EntityStyle::default()
    }

    #[test]
    fn rebuild_from_world() {
        let mut w = NexusWorld::new();
        w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(0.0, 0.0),
                end: Point2D::new(10.0, 0.0),
            },
            "l",
            default_style(),
        );
        w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(5.0, 5.0),
                radius: 2.0,
            },
            "l",
            default_style(),
        );
        w.spawn_entity(
            GeometryType::Point {
                position: Point2D::new(20.0, 20.0),
            },
            "l",
            default_style(),
        );

        let idx = WorldSpatialIndex::rebuild(&w);
        // Query a large window that contains all
        let results = idx.query_window([-100.0, -100.0], [100.0, 100.0]);
        assert_eq!(results.len(), 3);
    }

    #[test]
    fn window_query_filters() {
        let mut w = NexusWorld::new();
        let id1 = w.spawn_entity(
            GeometryType::Line {
                start: Point2D::new(0.0, 0.0),
                end: Point2D::new(5.0, 0.0),
            },
            "l",
            default_style(),
        );
        let _id2 = w.spawn_entity(
            GeometryType::Circle {
                center: Point2D::new(100.0, 100.0),
                radius: 1.0,
            },
            "l",
            default_style(),
        );
        let id3 = w.spawn_entity(
            GeometryType::Point {
                position: Point2D::new(3.0, 3.0),
            },
            "l",
            default_style(),
        );

        let idx = WorldSpatialIndex::rebuild(&w);
        // Window around origin area only
        let results = idx.query_window([-1.0, -1.0], [6.0, 6.0]);
        assert!(results.contains(&id1));
        assert!(results.contains(&id3));
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn nearest_query() {
        let mut w = NexusWorld::new();
        let id1 = w.spawn_entity(
            GeometryType::Point {
                position: Point2D::new(1.0, 1.0),
            },
            "l",
            default_style(),
        );
        w.spawn_entity(
            GeometryType::Point {
                position: Point2D::new(100.0, 100.0),
            },
            "l",
            default_style(),
        );

        let idx = WorldSpatialIndex::rebuild(&w);
        let nearest = idx.query_nearest([0.0, 0.0], 10.0);
        assert_eq!(nearest, Some(id1));
    }

    #[test]
    fn empty_world() {
        let w = NexusWorld::new();
        let idx = WorldSpatialIndex::rebuild(&w);
        let results = idx.query_window([-100.0, -100.0], [100.0, 100.0]);
        assert!(results.is_empty());
        let nearest = idx.query_nearest([0.0, 0.0], 10.0);
        assert!(nearest.is_none());
    }

    #[test]
    fn matches_existing_spatial_index() {
        use crate::entity::Entity;
        use crate::spatial_index::SpatialIndex;

        let entities = vec![
            Entity {
                id: "ent_1".to_string(),
                geometry: GeometryType::Line {
                    start: Point2D::new(0.0, 0.0),
                    end: Point2D::new(10.0, 5.0),
                },
                layer_id: "l".to_string(),
                style: default_style(),
                draw_order: 0,
            },
            Entity {
                id: "ent_2".to_string(),
                geometry: GeometryType::Circle {
                    center: Point2D::new(50.0, 50.0),
                    radius: 5.0,
                },
                layer_id: "l".to_string(),
                style: default_style(),
                draw_order: 0,
            },
            Entity {
                id: "ent_3".to_string(),
                geometry: GeometryType::Rectangle {
                    origin: Point2D::new(-10.0, -10.0),
                    width: 20.0,
                    height: 20.0,
                    rotation: 0.0,
                },
                layer_id: "l".to_string(),
                style: default_style(),
                draw_order: 0,
            },
        ];

        // Build old-style SpatialIndex
        let mut old_idx = SpatialIndex::new();
        old_idx.rebuild(&entities);

        // Build new WorldSpatialIndex from NexusWorld
        let mut w = NexusWorld::new();
        let json = serde_json::to_string(&entities).unwrap();
        w.from_entities_json(&json).unwrap();
        let new_idx = WorldSpatialIndex::rebuild(&w);

        // Compare window queries
        let old_results = {
            let mut r = old_idx.query_window([-20.0, -20.0], [20.0, 20.0]);
            r.sort();
            r
        };
        let new_results = {
            let mut r = new_idx.query_window([-20.0, -20.0], [20.0, 20.0]);
            r.sort();
            r
        };
        assert_eq!(old_results, new_results);

        // Compare nearest -- query far from all entities so there's a clear winner
        let old_nearest = old_idx.query_nearest([48.0, 50.0], 100.0);
        let new_nearest = new_idx.query_nearest([48.0, 50.0], 100.0);
        assert_eq!(old_nearest, new_nearest);
    }
}
