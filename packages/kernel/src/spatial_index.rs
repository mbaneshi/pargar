use crate::entity::{Entity, GeometryType};
use rstar::{primitives::Rectangle, PointDistance, RTree, AABB};

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

impl rstar::PointDistance for SpatialEntry {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        self.envelope.distance_2(point)
    }
}

pub struct SpatialIndex {
    tree: RTree<SpatialEntry>,
}

impl SpatialIndex {
    pub fn new() -> Self {
        SpatialIndex { tree: RTree::new() }
    }

    pub fn rebuild(&mut self, entities: &[Entity]) {
        let entries: Vec<SpatialEntry> = entities
            .iter()
            .map(|e| SpatialEntry {
                entity_id: e.id.clone(),
                envelope: entity_aabb(e),
            })
            .collect();
        self.tree = RTree::bulk_load(entries);
    }

    pub fn insert(&mut self, entity: &Entity) {
        self.tree.insert(SpatialEntry {
            entity_id: entity.id.clone(),
            envelope: entity_aabb(entity),
        });
    }

    pub fn remove(&mut self, entity_id: &str) {
        let mut entries = Vec::with_capacity(self.tree.size());
        for entry in self.tree.iter() {
            if entry.entity_id != entity_id {
                entries.push(entry.clone());
            }
        }
        self.tree = RTree::bulk_load(entries);
    }

    pub fn update(&mut self, entity: &Entity) {
        self.remove(&entity.id);
        self.insert(entity);
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

    #[allow(dead_code)]
    pub fn entity_count(&self) -> usize {
        self.tree.size()
    }
}

fn entity_aabb(entity: &Entity) -> AABB<[f64; 2]> {
    match &entity.geometry {
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
            // For text, dimensions, etc., use a point-sized AABB at their position
            let p = fallback_point(entity);
            AABB::from_corners([p.0, p.1], [p.0, p.1])
        }
    }
}

fn fallback_point(entity: &Entity) -> (f64, f64) {
    match &entity.geometry {
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
        _ => (0.0, 0.0),
    }
}

/// Linear scan for comparison benchmarking
#[allow(dead_code)]
pub fn linear_query_window(entities: &[Entity], min: [f64; 2], max: [f64; 2]) -> Vec<String> {
    entities
        .iter()
        .filter(|e| {
            let aabb = entity_aabb(e);
            let lower = aabb.lower();
            let upper = aabb.upper();
            lower[0] <= max[0] && upper[0] >= min[0] && lower[1] <= max[1] && upper[1] >= min[1]
        })
        .map(|e| e.id.clone())
        .collect()
}

#[allow(dead_code)]
pub fn linear_query_nearest(entities: &[Entity], point: [f64; 2], radius: f64) -> Option<String> {
    let mut best: Option<(f64, &str)> = None;
    for e in entities {
        let aabb = entity_aabb(e);
        let dist = Rectangle::from_aabb(aabb).distance_2(&point).sqrt();
        if dist <= radius && (best.is_none() || dist < best.unwrap().0) {
            best = Some((dist, &e.id));
        }
    }
    best.map(|(_, id)| id.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};
    use std::time::Instant;

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

    #[test]
    fn test_spatial_index_basic() {
        let entities = vec![
            make_line_entity("l1", 0.0, 0.0, 10.0, 10.0),
            make_line_entity("l2", 20.0, 20.0, 30.0, 30.0),
            make_circle_entity("c1", 50.0, 50.0, 5.0),
        ];

        let mut idx = SpatialIndex::new();
        idx.rebuild(&entities);

        assert_eq!(idx.entity_count(), 3);

        let results = idx.query_window([0.0, 0.0], [15.0, 15.0]);
        assert_eq!(results.len(), 1);
        assert!(results.contains(&"l1".to_string()));

        let results = idx.query_window([0.0, 0.0], [100.0, 100.0]);
        assert_eq!(results.len(), 3);

        let nearest = idx.query_nearest([0.0, 0.0], 1.0);
        assert_eq!(nearest, Some("l1".to_string()));

        let nearest = idx.query_nearest([100.0, 100.0], 1.0);
        assert!(nearest.is_none());
    }

    #[test]
    fn test_spatial_index_empty() {
        let mut idx = SpatialIndex::new();
        idx.rebuild(&[]);
        assert_eq!(idx.entity_count(), 0);
        assert!(idx.query_window([0.0, 0.0], [10.0, 10.0]).is_empty());
        assert!(idx.query_nearest([0.0, 0.0], 100.0).is_none());
    }

    fn make_polyline_entity(id: &str, vertices: Vec<(f64, f64)>) -> Entity {
        Entity {
            id: id.to_string(),
            geometry: GeometryType::Polyline {
                vertices: vertices
                    .into_iter()
                    .map(|(x, y)| Point2D::new(x, y))
                    .collect(),
                closed: false,
            },
            layer_id: "layer_0".to_string(),
            style: EntityStyle::default(),
            draw_order: 0,
        }
    }

    #[test]
    fn query_window_partial_overlap() {
        let entity = make_line_entity("l1", 5.0, 5.0, 15.0, 15.0);
        let mut idx = SpatialIndex::new();
        idx.rebuild(&[entity]);

        // Window overlaps entity's AABB
        let results = idx.query_window([0.0, 0.0], [10.0, 10.0]);
        assert_eq!(results.len(), 1);
        assert!(results.contains(&"l1".to_string()));

        // Window entirely outside
        let results = idx.query_window([20.0, 20.0], [30.0, 30.0]);
        assert!(results.is_empty());
    }

    #[test]
    fn rebuild_replaces_previous() {
        let entities = vec![
            make_line_entity("l1", 0.0, 0.0, 10.0, 10.0),
            make_line_entity("l2", 20.0, 20.0, 30.0, 30.0),
            make_circle_entity("c1", 50.0, 50.0, 5.0),
        ];
        let mut idx = SpatialIndex::new();
        idx.rebuild(&entities);
        assert_eq!(idx.entity_count(), 3);

        let single = vec![make_line_entity("l3", 0.0, 0.0, 1.0, 1.0)];
        idx.rebuild(&single);
        assert_eq!(idx.entity_count(), 1);
    }

    #[test]
    fn circle_aabb_correct() {
        let entity = make_circle_entity("c1", 50.0, 50.0, 5.0);
        let mut idx = SpatialIndex::new();
        idx.rebuild(&[entity]);

        // Window covers circle AABB (45..55)
        let results = idx.query_window([44.0, 44.0], [56.0, 56.0]);
        assert_eq!(results.len(), 1);

        // Window entirely outside
        let results = idx.query_window([56.0, 56.0], [60.0, 60.0]);
        assert!(results.is_empty());
    }

    #[test]
    fn polyline_aabb_correct() {
        let entity = make_polyline_entity("p1", vec![(0.0, 0.0), (10.0, 5.0), (5.0, 10.0)]);
        let mut idx = SpatialIndex::new();
        idx.rebuild(&[entity]);

        // Window covers bounding box (0..10, 0..10)
        let results = idx.query_window([-1.0, -1.0], [11.0, 11.0]);
        assert_eq!(results.len(), 1);

        // Window outside
        let results = idx.query_window([20.0, 20.0], [30.0, 30.0]);
        assert!(results.is_empty());
    }

    #[test]
    fn test_incremental_insert() {
        let mut idx = SpatialIndex::new();
        assert_eq!(idx.entity_count(), 0);

        let e1 = make_line_entity("l1", 0.0, 0.0, 10.0, 10.0);
        idx.insert(&e1);
        assert_eq!(idx.entity_count(), 1);

        let e2 = make_circle_entity("c1", 50.0, 50.0, 5.0);
        idx.insert(&e2);
        assert_eq!(idx.entity_count(), 2);

        let results = idx.query_window([0.0, 0.0], [15.0, 15.0]);
        assert_eq!(results.len(), 1);
        assert!(results.contains(&"l1".to_string()));
    }

    #[test]
    fn test_incremental_remove() {
        let entities = vec![
            make_line_entity("l1", 0.0, 0.0, 10.0, 10.0),
            make_line_entity("l2", 20.0, 20.0, 30.0, 30.0),
            make_circle_entity("c1", 50.0, 50.0, 5.0),
        ];
        let mut idx = SpatialIndex::new();
        idx.rebuild(&entities);
        assert_eq!(idx.entity_count(), 3);

        idx.remove("l2");
        assert_eq!(idx.entity_count(), 2);

        let results = idx.query_window([0.0, 0.0], [100.0, 100.0]);
        assert_eq!(results.len(), 2);
        assert!(!results.contains(&"l2".to_string()));
    }

    #[test]
    fn test_incremental_update() {
        let mut idx = SpatialIndex::new();
        let e1 = make_line_entity("l1", 0.0, 0.0, 10.0, 10.0);
        idx.insert(&e1);

        // l1 is at (0,0)-(10,10), should be found in this window
        let results = idx.query_window([0.0, 0.0], [5.0, 5.0]);
        assert_eq!(results.len(), 1);

        // Move l1 far away via update
        let e1_moved = make_line_entity("l1", 100.0, 100.0, 110.0, 110.0);
        idx.update(&e1_moved);
        assert_eq!(idx.entity_count(), 1);

        // Old location should be empty
        let results = idx.query_window([0.0, 0.0], [15.0, 15.0]);
        assert!(results.is_empty());

        // New location should have l1
        let results = idx.query_window([99.0, 99.0], [111.0, 111.0]);
        assert_eq!(results.len(), 1);
        assert!(results.contains(&"l1".to_string()));
    }

    #[test]
    fn test_remove_nonexistent() {
        let mut idx = SpatialIndex::new();
        let e1 = make_line_entity("l1", 0.0, 0.0, 10.0, 10.0);
        idx.insert(&e1);

        // Removing nonexistent entity should not crash or remove others
        idx.remove("nonexistent");
        assert_eq!(idx.entity_count(), 1);
    }

    #[test]
    fn bench_spatial_index_10k_entities() {
        let mut entities = Vec::with_capacity(10_000);
        for i in 0..5_000 {
            let x = (i as f64 * 7.3) % 1000.0;
            let y = (i as f64 * 13.7) % 1000.0;
            entities.push(make_line_entity(
                &format!("line_{i}"),
                x,
                y,
                x + 10.0,
                y + 10.0,
            ));
        }
        for i in 0..5_000 {
            let cx = (i as f64 * 11.1) % 1000.0;
            let cy = (i as f64 * 17.3) % 1000.0;
            entities.push(make_circle_entity(&format!("circle_{i}"), cx, cy, 5.0));
        }

        // Build R-tree
        let start = Instant::now();
        let mut idx = SpatialIndex::new();
        idx.rebuild(&entities);
        let build_time = start.elapsed();

        // Window queries (rstar)
        let start = Instant::now();
        let mut total_results = 0usize;
        for i in 0..1_000 {
            let x = (i as f64 * 3.7) % 900.0;
            let y = (i as f64 * 5.3) % 900.0;
            let results = idx.query_window([x, y], [x + 100.0, y + 100.0]);
            total_results += results.len();
        }
        let rstar_window_time = start.elapsed();

        // Window queries (linear)
        let start = Instant::now();
        let mut total_results_linear = 0usize;
        for i in 0..1_000 {
            let x = (i as f64 * 3.7) % 900.0;
            let y = (i as f64 * 5.3) % 900.0;
            let results = linear_query_window(&entities, [x, y], [x + 100.0, y + 100.0]);
            total_results_linear += results.len();
        }
        let linear_window_time = start.elapsed();

        // Nearest neighbor queries (rstar)
        let start = Instant::now();
        let mut nn_found = 0usize;
        for i in 0..1_000 {
            let x = (i as f64 * 3.7) % 1000.0;
            let y = (i as f64 * 5.3) % 1000.0;
            if idx.query_nearest([x, y], 50.0).is_some() {
                nn_found += 1;
            }
        }
        let rstar_nn_time = start.elapsed();

        // Nearest neighbor queries (linear)
        let start = Instant::now();
        let mut nn_found_linear = 0usize;
        for i in 0..1_000 {
            let x = (i as f64 * 3.7) % 1000.0;
            let y = (i as f64 * 5.3) % 1000.0;
            if linear_query_nearest(&entities, [x, y], 50.0).is_some() {
                nn_found_linear += 1;
            }
        }
        let linear_nn_time = start.elapsed();

        // Verify correctness: both should find the same results
        assert_eq!(total_results, total_results_linear);
        assert_eq!(nn_found, nn_found_linear);

        eprintln!("=== rstar Spatial Index Benchmark (10,000 entities) ===");
        eprintln!("R-tree build:            {:?}", build_time);
        eprintln!(
            "1000 window queries:     rstar={:?}, linear={:?}, speedup={:.1}x",
            rstar_window_time,
            linear_window_time,
            linear_window_time.as_nanos() as f64 / rstar_window_time.as_nanos() as f64
        );
        eprintln!(
            "1000 nearest queries:    rstar={:?}, linear={:?}, speedup={:.1}x",
            rstar_nn_time,
            linear_nn_time,
            linear_nn_time.as_nanos() as f64 / rstar_nn_time.as_nanos() as f64
        );
        eprintln!("Window query results:    {} total hits", total_results);
        eprintln!("Nearest query results:   {}/{} found", nn_found, 1000);
    }
}
