use crate::entity::{Entity, GeometryType, Point2D};
use crate::tolerance;
use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use tsify::Tsify;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum ConstraintType {
    /// Fix a point in place
    Fixed {
        entity_id: String,
        point_index: usize,
        position: Point2D,
    },
    /// Two points must coincide
    Coincident {
        entity_a: String,
        point_a: usize,
        entity_b: String,
        point_b: usize,
    },
    /// Line must be horizontal (dy = 0)
    Horizontal { entity_id: String },
    /// Line must be vertical (dx = 0)
    Vertical { entity_id: String },
    /// Fixed distance between two points
    Distance {
        entity_a: String,
        point_a: usize,
        entity_b: String,
        point_b: usize,
        distance: f64,
    },
    /// Two lines must be parallel
    Parallel { entity_a: String, entity_b: String },
    /// Two lines must be perpendicular
    Perpendicular { entity_a: String, entity_b: String },
    /// Two segments must have equal length
    EqualLength { entity_a: String, entity_b: String },
    /// Circle/arc must be tangent to a line
    Tangent {
        line_entity: String,
        circle_entity: String,
    },
    /// Two circles/arcs must share the same center
    Concentric { entity_a: String, entity_b: String },
    /// An entity must be symmetric about a line (mirror axis)
    Symmetric {
        entity_id: String,
        axis_entity: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Constraint {
    pub id: String,
    pub constraint_type: ConstraintType,
}

pub struct ConstraintSolver {
    constraints: Vec<Constraint>,
    next_id: u64,
    max_iterations: usize,
    tolerance: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct EntityDof {
    pub entity_id: String,
    pub total_dof: usize,
    pub constrained: usize,
    pub free: usize,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct DofResult {
    pub total_dof: usize,
    pub constrained_dof: usize,
    pub remaining_dof: usize,
    pub is_fully_constrained: bool,
    pub is_over_constrained: bool,
    pub per_entity: Vec<EntityDof>,
}

impl ConstraintSolver {
    pub fn new() -> Self {
        ConstraintSolver {
            constraints: Vec::new(),
            next_id: 1,
            max_iterations: 50,
            tolerance: tolerance::SOLVER_CONVERGENCE,
        }
    }

    pub fn add_constraint(&mut self, constraint_type: ConstraintType) -> String {
        let id = format!("con_{}", self.next_id);
        self.next_id += 1;
        self.constraints.push(Constraint {
            id: id.clone(),
            constraint_type,
        });
        id
    }

    pub fn remove_constraint(&mut self, id: &str) -> bool {
        let before = self.constraints.len();
        self.constraints.retain(|c| c.id != id);
        self.constraints.len() < before
    }

    pub fn get_constraints_json(&self) -> String {
        serde_json::to_string(&self.constraints).unwrap_or_default()
    }

    #[allow(dead_code)]
    #[allow(dead_code)]
    pub fn get_constraints(&self) -> &[Constraint] {
        &self.constraints
    }

    pub fn constraint_count(&self) -> usize {
        self.constraints.len()
    }

    pub fn constrained_entity_ids(&self) -> Vec<String> {
        let mut ids = std::collections::HashSet::new();
        for c in &self.constraints {
            for id in Self::constraint_entity_ids(&c.constraint_type) {
                ids.insert(id);
            }
        }
        ids.into_iter().collect()
    }

    fn get_point(entity: &Entity, index: usize) -> Option<Point2D> {
        match &entity.geometry {
            GeometryType::Line { start, end } => match index {
                0 => Some(start.clone()),
                1 => Some(end.clone()),
                _ => None,
            },
            GeometryType::Circle { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Arc { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Rectangle {
                origin,
                width,
                height,
                ..
            } => match index {
                0 => Some(origin.clone()),
                1 => Some(Point2D::new(origin.x + width, origin.y)),
                2 => Some(Point2D::new(origin.x + width, origin.y + height)),
                3 => Some(Point2D::new(origin.x, origin.y + height)),
                _ => None,
            },
            GeometryType::Polyline { vertices, .. } => vertices.get(index).cloned(),
            GeometryType::Text { position, .. } => match index {
                0 => Some(position.clone()),
                _ => None,
            },
            GeometryType::Dimension { start, end, .. } => match index {
                0 => Some(start.clone()),
                1 => Some(end.clone()),
                _ => None,
            },
            GeometryType::Ellipse { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Spline { control_points, .. } => control_points.get(index).cloned(),
            GeometryType::ConstructionLine { origin, .. } | GeometryType::Ray { origin, .. } => {
                match index {
                    0 => Some(origin.clone()),
                    _ => None,
                }
            }
            GeometryType::BlockRef { insertion, .. } => match index {
                0 => Some(insertion.clone()),
                _ => None,
            },
            GeometryType::AlignedDimension { start, end, .. } => match index {
                0 => Some(start.clone()),
                1 => Some(end.clone()),
                _ => None,
            },
            GeometryType::AngularDimension {
                center,
                start_ray,
                end_ray,
                ..
            } => match index {
                0 => Some(center.clone()),
                1 => Some(start_ray.clone()),
                2 => Some(end_ray.clone()),
                _ => None,
            },
            GeometryType::RadialDimension {
                center,
                point_on_arc,
                ..
            }
            | GeometryType::DiameterDimension {
                center,
                point_on_arc,
                ..
            } => match index {
                0 => Some(center.clone()),
                1 => Some(point_on_arc.clone()),
                _ => None,
            },
            GeometryType::Point { position } => match index {
                0 => Some(position.clone()),
                _ => None,
            },
            GeometryType::Hatch { .. } => None,
            GeometryType::MText { position, .. } => match index {
                0 => Some(position.clone()),
                _ => None,
            },
            GeometryType::Table { position, .. } => match index {
                0 => Some(position.clone()),
                _ => None,
            },
            GeometryType::RevisionCloud { boundary, .. } => boundary.get(index).cloned(),
            GeometryType::Leader { vertices, .. } | GeometryType::Wipeout { vertices } => {
                vertices.get(index).cloned()
            }
            GeometryType::EllipseArc { center, .. } => match index {
                0 => Some(center.clone()),
                _ => None,
            },
            GeometryType::Tolerance { position, .. } | GeometryType::AttDef { position, .. } => {
                match index {
                    0 => Some(position.clone()),
                    _ => None,
                }
            }
        }
    }

    pub fn set_point(entity: &mut Entity, index: usize, point: &Point2D) {
        match &mut entity.geometry {
            GeometryType::Line { start, end } => match index {
                0 => {
                    start.x = point.x;
                    start.y = point.y;
                }
                1 => {
                    end.x = point.x;
                    end.y = point.y;
                }
                _ => {}
            },
            GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => {
                if index == 0 {
                    center.x = point.x;
                    center.y = point.y;
                }
            }
            GeometryType::Rectangle { origin, .. } => {
                if index == 0 {
                    origin.x = point.x;
                    origin.y = point.y;
                }
            }
            GeometryType::Polyline { vertices, .. } => {
                if let Some(v) = vertices.get_mut(index) {
                    v.x = point.x;
                    v.y = point.y;
                }
            }
            GeometryType::Text { position, .. } => {
                if index == 0 {
                    position.x = point.x;
                    position.y = point.y;
                }
            }
            GeometryType::Dimension { start, end, .. } => match index {
                0 => {
                    start.x = point.x;
                    start.y = point.y;
                }
                1 => {
                    end.x = point.x;
                    end.y = point.y;
                }
                _ => {}
            },
            GeometryType::Ellipse { center, .. } => {
                if index == 0 {
                    center.x = point.x;
                    center.y = point.y;
                }
            }
            GeometryType::Spline { control_points, .. } => {
                if let Some(v) = control_points.get_mut(index) {
                    v.x = point.x;
                    v.y = point.y;
                }
            }
            GeometryType::ConstructionLine { origin, .. } | GeometryType::Ray { origin, .. } => {
                if index == 0 {
                    origin.x = point.x;
                    origin.y = point.y;
                }
            }
            GeometryType::BlockRef { insertion, .. } => {
                if index == 0 {
                    insertion.x = point.x;
                    insertion.y = point.y;
                }
            }
            GeometryType::AlignedDimension { start, end, .. } => match index {
                0 => {
                    start.x = point.x;
                    start.y = point.y;
                }
                1 => {
                    end.x = point.x;
                    end.y = point.y;
                }
                _ => {}
            },
            GeometryType::AngularDimension {
                center,
                start_ray,
                end_ray,
                ..
            } => match index {
                0 => {
                    center.x = point.x;
                    center.y = point.y;
                }
                1 => {
                    start_ray.x = point.x;
                    start_ray.y = point.y;
                }
                2 => {
                    end_ray.x = point.x;
                    end_ray.y = point.y;
                }
                _ => {}
            },
            GeometryType::RadialDimension {
                center,
                point_on_arc,
                ..
            }
            | GeometryType::DiameterDimension {
                center,
                point_on_arc,
                ..
            } => match index {
                0 => {
                    center.x = point.x;
                    center.y = point.y;
                }
                1 => {
                    point_on_arc.x = point.x;
                    point_on_arc.y = point.y;
                }
                _ => {}
            },
            GeometryType::Point { position } => {
                if index == 0 {
                    position.x = point.x;
                    position.y = point.y;
                }
            }
            GeometryType::Hatch { .. } => {}
            GeometryType::MText { position, .. } => {
                if index == 0 {
                    position.x = point.x;
                    position.y = point.y;
                }
            }
            GeometryType::Table { position, .. } => {
                if index == 0 {
                    position.x = point.x;
                    position.y = point.y;
                }
            }
            GeometryType::RevisionCloud { boundary, .. } => {
                if let Some(p) = boundary.get_mut(index) {
                    p.x = point.x;
                    p.y = point.y;
                }
            }
            GeometryType::Leader { vertices, .. } | GeometryType::Wipeout { vertices } => {
                if let Some(v) = vertices.get_mut(index) {
                    v.x = point.x;
                    v.y = point.y;
                }
            }
            GeometryType::EllipseArc { center, .. } => {
                if index == 0 {
                    center.x = point.x;
                    center.y = point.y;
                }
            }
            GeometryType::Tolerance { position, .. } | GeometryType::AttDef { position, .. } => {
                if index == 0 {
                    position.x = point.x;
                    position.y = point.y;
                }
            }
        }
    }

    fn line_length(entity: &Entity) -> Option<f64> {
        if let GeometryType::Line { start, end } = &entity.geometry {
            Some(start.distance_to(end))
        } else {
            None
        }
    }

    /// Solve all constraints iteratively. Returns true if converged.
    pub fn solve(&self, entities: &mut [Entity]) -> bool {
        for _iter in 0..self.max_iterations {
            let mut max_error = 0.0f64;

            for constraint in &self.constraints {
                let error = self.apply_constraint(&constraint.constraint_type, entities);
                max_error = max_error.max(error);
            }

            if max_error < self.tolerance {
                return true;
            }
        }
        false
    }

    fn apply_constraint(&self, ct: &ConstraintType, entities: &mut [Entity]) -> f64 {
        match ct {
            ConstraintType::Fixed {
                entity_id,
                point_index,
                position,
            } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let Some(current) = Self::get_point(entity, *point_index) {
                        let error = current.distance_to(position);
                        Self::set_point(entity, *point_index, position);
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Coincident {
                entity_a,
                point_a,
                entity_b,
                point_b,
            } => {
                let pa = entities
                    .iter()
                    .find(|e| e.id == *entity_a)
                    .and_then(|e| Self::get_point(e, *point_a));
                let pb = entities
                    .iter()
                    .find(|e| e.id == *entity_b)
                    .and_then(|e| Self::get_point(e, *point_b));

                if let (Some(pa), Some(pb)) = (pa, pb) {
                    let mid = Point2D::new((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0);
                    let error = pa.distance_to(&pb);

                    if let Some(ea) = entities.iter_mut().find(|e| e.id == *entity_a) {
                        Self::set_point(ea, *point_a, &mid);
                    }
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == *entity_b) {
                        Self::set_point(eb, *point_b, &mid);
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Horizontal { entity_id } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let GeometryType::Line { start, end } = &mut entity.geometry {
                        let mid_y = (start.y + end.y) / 2.0;
                        let error = (start.y - end.y).abs();
                        start.y = mid_y;
                        end.y = mid_y;
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Vertical { entity_id } => {
                if let Some(entity) = entities.iter_mut().find(|e| e.id == *entity_id) {
                    if let GeometryType::Line { start, end } = &mut entity.geometry {
                        let mid_x = (start.x + end.x) / 2.0;
                        let error = (start.x - end.x).abs();
                        start.x = mid_x;
                        end.x = mid_x;
                        return error;
                    }
                }
                0.0
            }

            ConstraintType::Distance {
                entity_a,
                point_a,
                entity_b,
                point_b,
                distance,
            } => {
                let pa = entities
                    .iter()
                    .find(|e| e.id == *entity_a)
                    .and_then(|e| Self::get_point(e, *point_a));
                let pb = entities
                    .iter()
                    .find(|e| e.id == *entity_b)
                    .and_then(|e| Self::get_point(e, *point_b));

                if let (Some(pa), Some(pb)) = (pa, pb) {
                    let current_dist = pa.distance_to(&pb);
                    if current_dist < tolerance::CONSTRAINT_ZERO_LENGTH {
                        return 0.0;
                    }
                    let error = (current_dist - distance).abs();
                    let factor = distance / current_dist;
                    let mid = Point2D::new((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0);
                    let new_a = Point2D::new(
                        mid.x + (pa.x - mid.x) * factor,
                        mid.y + (pa.y - mid.y) * factor,
                    );
                    let new_b = Point2D::new(
                        mid.x + (pb.x - mid.x) * factor,
                        mid.y + (pb.y - mid.y) * factor,
                    );

                    if let Some(ea) = entities.iter_mut().find(|e| e.id == *entity_a) {
                        Self::set_point(ea, *point_a, &new_a);
                    }
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == *entity_b) {
                        Self::set_point(eb, *point_b, &new_b);
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Parallel { entity_a, entity_b } => {
                let line_a = entities.iter().find(|e| e.id == *entity_a).and_then(|e| {
                    if let GeometryType::Line { start, end } = &e.geometry {
                        Some((start.clone(), end.clone()))
                    } else {
                        None
                    }
                });
                let line_b_id = entity_b.clone();

                if let Some((sa, ea)) = line_a {
                    let dir_a_x = ea.x - sa.x;
                    let dir_a_y = ea.y - sa.y;
                    let len_a = (dir_a_x * dir_a_x + dir_a_y * dir_a_y).sqrt();
                    if len_a < tolerance::CONSTRAINT_ZERO_LENGTH {
                        return 0.0;
                    }
                    let nx = dir_a_x / len_a;
                    let ny = dir_a_y / len_a;

                    if let Some(eb) = entities.iter_mut().find(|e| e.id == line_b_id) {
                        if let GeometryType::Line {
                            start: sb,
                            end: eb_end,
                        } = &mut eb.geometry
                        {
                            let dir_b_x = eb_end.x - sb.x;
                            let dir_b_y = eb_end.y - sb.y;
                            let len_b = (dir_b_x * dir_b_x + dir_b_y * dir_b_y).sqrt();
                            let dot = dir_b_x * nx + dir_b_y * ny;
                            let sign = if dot >= 0.0 { 1.0 } else { -1.0 };
                            let new_end_x = sb.x + sign * nx * len_b;
                            let new_end_y = sb.y + sign * ny * len_b;
                            let error = ((eb_end.x - new_end_x).powi(2)
                                + (eb_end.y - new_end_y).powi(2))
                            .sqrt();
                            eb_end.x = new_end_x;
                            eb_end.y = new_end_y;
                            return error;
                        }
                    }
                }
                0.0
            }

            ConstraintType::Perpendicular { entity_a, entity_b } => {
                let line_a = entities.iter().find(|e| e.id == *entity_a).and_then(|e| {
                    if let GeometryType::Line { start, end } = &e.geometry {
                        Some((start.clone(), end.clone()))
                    } else {
                        None
                    }
                });
                let line_b_id = entity_b.clone();

                if let Some((sa, ea)) = line_a {
                    let dir_a_x = ea.x - sa.x;
                    let dir_a_y = ea.y - sa.y;
                    let len_a = (dir_a_x * dir_a_x + dir_a_y * dir_a_y).sqrt();
                    if len_a < tolerance::CONSTRAINT_ZERO_LENGTH {
                        return 0.0;
                    }
                    let nx = -dir_a_y / len_a;
                    let ny = dir_a_x / len_a;

                    if let Some(eb) = entities.iter_mut().find(|e| e.id == line_b_id) {
                        if let GeometryType::Line {
                            start: sb,
                            end: eb_end,
                        } = &mut eb.geometry
                        {
                            let dir_b_x = eb_end.x - sb.x;
                            let dir_b_y = eb_end.y - sb.y;
                            let len_b = (dir_b_x * dir_b_x + dir_b_y * dir_b_y).sqrt();
                            let dot = dir_b_x * nx + dir_b_y * ny;
                            let sign = if dot >= 0.0 { 1.0 } else { -1.0 };
                            let new_end_x = sb.x + sign * nx * len_b;
                            let new_end_y = sb.y + sign * ny * len_b;
                            let error = ((eb_end.x - new_end_x).powi(2)
                                + (eb_end.y - new_end_y).powi(2))
                            .sqrt();
                            eb_end.x = new_end_x;
                            eb_end.y = new_end_y;
                            return error;
                        }
                    }
                }
                0.0
            }

            ConstraintType::EqualLength { entity_a, entity_b } => {
                let len_a = entities
                    .iter()
                    .find(|e| e.id == *entity_a)
                    .and_then(Self::line_length);
                let len_b_id = entity_b.clone();

                if let Some(la) = len_a {
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == len_b_id) {
                        if let GeometryType::Line { start, end } = &mut eb.geometry {
                            let dx = end.x - start.x;
                            let dy = end.y - start.y;
                            let lb = (dx * dx + dy * dy).sqrt();
                            if lb < tolerance::CONSTRAINT_ZERO_LENGTH {
                                return 0.0;
                            }
                            let error = (lb - la).abs();
                            let factor = la / lb;
                            let mx = (start.x + end.x) / 2.0;
                            let my = (start.y + end.y) / 2.0;
                            start.x = mx - dx * factor / 2.0;
                            start.y = my - dy * factor / 2.0;
                            end.x = mx + dx * factor / 2.0;
                            end.y = my + dy * factor / 2.0;
                            return error;
                        }
                    }
                }
                0.0
            }

            ConstraintType::Tangent {
                line_entity,
                circle_entity,
            } => {
                let line_data = entities
                    .iter()
                    .find(|e| e.id == *line_entity)
                    .and_then(|e| {
                        if let GeometryType::Line { start, end } = &e.geometry {
                            Some((start.clone(), end.clone()))
                        } else {
                            None
                        }
                    });
                let circle_data = entities
                    .iter()
                    .find(|e| e.id == *circle_entity)
                    .and_then(|e| match &e.geometry {
                        GeometryType::Circle { center, radius } => Some((center.clone(), *radius)),
                        GeometryType::Arc { center, radius, .. } => Some((center.clone(), *radius)),
                        _ => None,
                    });
                let circle_id = circle_entity.clone();

                if let (Some((ls, le)), Some((cc, r))) = (line_data, circle_data) {
                    let dx = le.x - ls.x;
                    let dy = le.y - ls.y;
                    let len = (dx * dx + dy * dy).sqrt();
                    if len < tolerance::CONSTRAINT_ZERO_LENGTH {
                        return 0.0;
                    }
                    // Unit normal to line (perpendicular)
                    let nx = -dy / len;
                    let ny = dx / len;
                    // Signed distance from circle center to line
                    let d = (cc.x - ls.x) * nx + (cc.y - ls.y) * ny;
                    // We want |d| = r. Move center along normal.
                    let target_d = if d >= 0.0 { r } else { -r };
                    let error = (d - target_d).abs();
                    let new_cx = cc.x + (target_d - d) * nx;
                    let new_cy = cc.y + (target_d - d) * ny;

                    if let Some(ec) = entities.iter_mut().find(|e| e.id == circle_id) {
                        Self::set_point(ec, 0, &Point2D::new(new_cx, new_cy));
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Concentric { entity_a, entity_b } => {
                let ca = entities
                    .iter()
                    .find(|e| e.id == *entity_a)
                    .and_then(|e| Self::get_point(e, 0));
                let cb = entities
                    .iter()
                    .find(|e| e.id == *entity_b)
                    .and_then(|e| Self::get_point(e, 0));

                if let (Some(ca), Some(cb)) = (ca, cb) {
                    let mid = Point2D::new((ca.x + cb.x) / 2.0, (ca.y + cb.y) / 2.0);
                    let error = ca.distance_to(&cb);

                    if let Some(ea) = entities.iter_mut().find(|e| e.id == *entity_a) {
                        Self::set_point(ea, 0, &mid);
                    }
                    if let Some(eb) = entities.iter_mut().find(|e| e.id == *entity_b) {
                        Self::set_point(eb, 0, &mid);
                    }
                    return error;
                }
                0.0
            }

            ConstraintType::Symmetric {
                entity_id,
                axis_entity,
            } => {
                let axis_data = entities
                    .iter()
                    .find(|e| e.id == *axis_entity)
                    .and_then(|e| {
                        if let GeometryType::Line { start, end } = &e.geometry {
                            Some((start.clone(), end.clone()))
                        } else {
                            None
                        }
                    });
                let ent_id = entity_id.clone();

                if let Some((as_, ae)) = axis_data {
                    let adx = ae.x - as_.x;
                    let ady = ae.y - as_.y;
                    let alen2 = adx * adx + ady * ady;
                    if alen2 < tolerance::CONSTRAINT_ZERO_LENGTH {
                        return 0.0;
                    }

                    // Reflect a point across the axis line
                    let reflect = |p: &Point2D| -> Point2D {
                        let dx = p.x - as_.x;
                        let dy = p.y - as_.y;
                        let t = (dx * adx + dy * ady) / alen2;
                        let foot_x = as_.x + t * adx;
                        let foot_y = as_.y + t * ady;
                        Point2D::new(2.0 * foot_x - p.x, 2.0 * foot_y - p.y)
                    };

                    if let Some(ent) = entities.iter().find(|e| e.id == ent_id) {
                        match &ent.geometry {
                            GeometryType::Line { start, end } => {
                                // Make line symmetric: each endpoint moves to midpoint
                                // between itself and the reflection of the other endpoint
                                let rs = reflect(start);
                                let re = reflect(end);
                                // For symmetry: start should equal reflect(end) and
                                // end should equal reflect(start).
                                // Move each halfway toward target.
                                let new_s =
                                    Point2D::new((start.x + re.x) / 2.0, (start.y + re.y) / 2.0);
                                let new_e =
                                    Point2D::new((end.x + rs.x) / 2.0, (end.y + rs.y) / 2.0);
                                let error = start.distance_to(&re).max(end.distance_to(&rs));

                                if let Some(ent_mut) = entities.iter_mut().find(|e| e.id == ent_id)
                                {
                                    Self::set_point(ent_mut, 0, &new_s);
                                    Self::set_point(ent_mut, 1, &new_e);
                                }
                                return error;
                            }
                            GeometryType::Circle { center, .. }
                            | GeometryType::Arc { center, .. } => {
                                // Center must lie on the axis
                                let rc = reflect(center);
                                let mid =
                                    Point2D::new((center.x + rc.x) / 2.0, (center.y + rc.y) / 2.0);
                                let error = center.distance_to(&rc);
                                if let Some(ent_mut) = entities.iter_mut().find(|e| e.id == ent_id)
                                {
                                    Self::set_point(ent_mut, 0, &mid);
                                }
                                return error;
                            }
                            GeometryType::Point { position } => {
                                let rp = reflect(position);
                                let mid = Point2D::new(
                                    (position.x + rp.x) / 2.0,
                                    (position.y + rp.y) / 2.0,
                                );
                                let error = position.distance_to(&rp);
                                if let Some(ent_mut) = entities.iter_mut().find(|e| e.id == ent_id)
                                {
                                    Self::set_point(ent_mut, 0, &mid);
                                }
                                return error;
                            }
                            _ => {}
                        }
                    }
                }
                0.0
            }
        }
    }

    pub fn remove_constraints_for_entity(&mut self, entity_id: &str) {
        self.constraints.retain(|c| match &c.constraint_type {
            ConstraintType::Fixed { entity_id: id, .. } => id != entity_id,
            ConstraintType::Coincident {
                entity_a, entity_b, ..
            } => entity_a != entity_id && entity_b != entity_id,
            ConstraintType::Horizontal { entity_id: id } => id != entity_id,
            ConstraintType::Vertical { entity_id: id } => id != entity_id,
            ConstraintType::Distance {
                entity_a, entity_b, ..
            } => entity_a != entity_id && entity_b != entity_id,
            ConstraintType::Parallel { entity_a, entity_b } => {
                entity_a != entity_id && entity_b != entity_id
            }
            ConstraintType::Perpendicular { entity_a, entity_b } => {
                entity_a != entity_id && entity_b != entity_id
            }
            ConstraintType::EqualLength { entity_a, entity_b } => {
                entity_a != entity_id && entity_b != entity_id
            }
            ConstraintType::Tangent {
                line_entity,
                circle_entity,
            } => line_entity != entity_id && circle_entity != entity_id,
            ConstraintType::Concentric { entity_a, entity_b } => {
                entity_a != entity_id && entity_b != entity_id
            }
            ConstraintType::Symmetric {
                entity_id: eid,
                axis_entity,
            } => eid != entity_id && axis_entity != entity_id,
        });
    }

    fn entity_dof(entity: &Entity) -> usize {
        match &entity.geometry {
            GeometryType::Line { .. } => 4,
            GeometryType::Circle { .. } => 3,
            GeometryType::Arc { .. } => 5,
            GeometryType::Point { .. } => 2,
            GeometryType::Rectangle { .. } => 5,
            _ => 0,
        }
    }

    fn constraint_dof_removal(ct: &ConstraintType) -> usize {
        match ct {
            ConstraintType::Fixed { .. } => 2,
            ConstraintType::Coincident { .. } => 2,
            ConstraintType::Horizontal { .. } => 1,
            ConstraintType::Vertical { .. } => 1,
            ConstraintType::Distance { .. } => 1,
            ConstraintType::Parallel { .. } => 1,
            ConstraintType::Perpendicular { .. } => 1,
            ConstraintType::EqualLength { .. } => 1,
            ConstraintType::Tangent { .. } => 1,
            ConstraintType::Concentric { .. } => 2,
            ConstraintType::Symmetric { .. } => 2,
        }
    }

    fn constraint_entity_ids(ct: &ConstraintType) -> Vec<String> {
        match ct {
            ConstraintType::Fixed { entity_id, .. } => vec![entity_id.clone()],
            ConstraintType::Coincident {
                entity_a, entity_b, ..
            } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::Horizontal { entity_id } => vec![entity_id.clone()],
            ConstraintType::Vertical { entity_id } => vec![entity_id.clone()],
            ConstraintType::Distance {
                entity_a, entity_b, ..
            } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::Parallel { entity_a, entity_b } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::Perpendicular { entity_a, entity_b } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::EqualLength { entity_a, entity_b } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::Tangent {
                line_entity,
                circle_entity,
            } => {
                vec![line_entity.clone(), circle_entity.clone()]
            }
            ConstraintType::Concentric { entity_a, entity_b } => {
                vec![entity_a.clone(), entity_b.clone()]
            }
            ConstraintType::Symmetric {
                entity_id,
                axis_entity,
            } => {
                vec![entity_id.clone(), axis_entity.clone()]
            }
        }
    }

    pub fn analyze_dof(&self, entities: &[Entity]) -> DofResult {
        use std::collections::HashMap;

        let mut per_entity_map: HashMap<String, (usize, usize)> = HashMap::new();
        let mut total_dof: usize = 0;

        for e in entities {
            let dof = Self::entity_dof(e);
            if dof > 0 {
                per_entity_map.insert(e.id.clone(), (dof, 0));
                total_dof += dof;
            }
        }

        let mut constrained_dof: usize = 0;

        for c in &self.constraints {
            let removal = Self::constraint_dof_removal(&c.constraint_type);
            constrained_dof += removal;
            let ids = Self::constraint_entity_ids(&c.constraint_type);
            // Distribute DOF removal evenly across involved entities
            for id in &ids {
                if let Some(entry) = per_entity_map.get_mut(id) {
                    entry.1 += removal;
                }
            }
        }

        let remaining_dof = total_dof.saturating_sub(constrained_dof);

        let per_entity: Vec<EntityDof> = per_entity_map
            .into_iter()
            .map(|(id, (total, constrained))| {
                let free = total.saturating_sub(constrained);
                EntityDof {
                    entity_id: id,
                    total_dof: total,
                    constrained,
                    free,
                }
            })
            .collect();

        DofResult {
            total_dof,
            constrained_dof,
            remaining_dof,
            is_fully_constrained: remaining_dof == 0 && constrained_dof == total_dof,
            is_over_constrained: constrained_dof > total_dof,
            per_entity,
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

    fn get_entity(k: &Kernel, id: &str) -> serde_json::Value {
        let json = k.get_entity_json(id);
        serde_json::from_str(&json).unwrap()
    }

    fn line_points(ent: &serde_json::Value) -> (f64, f64, f64, f64) {
        let line = &ent["geometry"]["Line"];
        let sx = line["start"]["x"].as_f64().unwrap();
        let sy = line["start"]["y"].as_f64().unwrap();
        let ex = line["end"]["x"].as_f64().unwrap();
        let ey = line["end"]["y"].as_f64().unwrap();
        (sx, sy, ex, ey)
    }

    // --- Tangent ---

    #[test]
    fn tangent_circle_to_horizontal_line() {
        let mut k = Kernel::new();
        // Line at y=0 from (0,0) to (10,0)
        let rl = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let line_id = rl["created_ids"][0].as_str().unwrap().to_string();
        // Circle at (5,5) r=3
        let rc = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":5.0,"cy":5.0,"radius":3.0,"layer_id":"layer_0"}"#,
        );
        let circle_id = rc["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"AddConstraintTangent","line_entity":"{}","circle_entity":"{}"}}"#,
            line_id, circle_id
        );
        let cr = exec(&mut k, &cmd);
        assert_eq!(cr["success"], true);
        k.solve_constraints();
        let ent = get_entity(&k, &circle_id);
        let cy = ent["geometry"]["Circle"]["center"]["y"].as_f64().unwrap();
        // Circle center should be at distance=radius from line y=0, so cy=3
        assert!(
            (cy - 3.0).abs() < 0.1,
            "tangent: center y should be ~3, got {cy}"
        );
    }

    #[test]
    fn tangent_circle_to_angled_line() {
        let mut k = Kernel::new();
        // Line from (0,0) to (10,10)
        let rl = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":10.0,"layer_id":"layer_0"}"#,
        );
        let line_id = rl["created_ids"][0].as_str().unwrap().to_string();
        // Circle at (5,0) r=2
        let rc = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":5.0,"cy":0.0,"radius":2.0,"layer_id":"layer_0"}"#,
        );
        let circle_id = rc["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"AddConstraintTangent","line_entity":"{}","circle_entity":"{}"}}"#,
            line_id, circle_id
        );
        exec(&mut k, &cmd);
        k.solve_constraints();
        let ent = get_entity(&k, &circle_id);
        let cx = ent["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        let cy = ent["geometry"]["Circle"]["center"]["y"].as_f64().unwrap();
        // Check distance from center to line equals radius
        // Line direction: (1,1)/sqrt(2), normal: (-1,1)/sqrt(2)
        let dist = ((cx - 0.0) * (-1.0 / 2.0f64.sqrt()) + (cy - 0.0) * (1.0 / 2.0f64.sqrt())).abs();
        assert!(
            (dist - 2.0).abs() < 0.1,
            "tangent: dist should be ~2, got {dist}"
        );
    }

    // --- Concentric ---

    #[test]
    fn concentric_aligns_circle_centers() {
        let mut k = Kernel::new();
        let ra = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0.0,"cy":0.0,"radius":5.0,"layer_id":"layer_0"}"#,
        );
        let id_a = ra["created_ids"][0].as_str().unwrap().to_string();
        let rb = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":3.0,"cy":4.0,"radius":2.0,"layer_id":"layer_0"}"#,
        );
        let id_b = rb["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"AddConstraintConcentric","entity_a":"{}","entity_b":"{}"}}"#,
            id_a, id_b
        );
        let cr = exec(&mut k, &cmd);
        assert_eq!(cr["success"], true);
        k.solve_constraints();
        let ent_a = get_entity(&k, &id_a);
        let ent_b = get_entity(&k, &id_b);
        let ax = ent_a["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        let ay = ent_a["geometry"]["Circle"]["center"]["y"].as_f64().unwrap();
        let bx = ent_b["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        let by = ent_b["geometry"]["Circle"]["center"]["y"].as_f64().unwrap();
        assert!((ax - bx).abs() < 0.1, "concentric x: {ax} vs {bx}");
        assert!((ay - by).abs() < 0.1, "concentric y: {ay} vs {by}");
    }

    #[test]
    fn concentric_arc_and_circle() {
        let mut k = Kernel::new();
        let ra = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":10.0,"cy":10.0,"radius":5.0,"start_angle":0.0,"end_angle":90.0,"layer_id":"layer_0"}"#,
        );
        let id_a = ra["created_ids"][0].as_str().unwrap().to_string();
        let rb = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":15.0,"cy":15.0,"radius":3.0,"layer_id":"layer_0"}"#,
        );
        let id_b = rb["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"AddConstraintConcentric","entity_a":"{}","entity_b":"{}"}}"#,
            id_a, id_b
        );
        exec(&mut k, &cmd);
        k.solve_constraints();
        let ent_a = get_entity(&k, &id_a);
        let ent_b = get_entity(&k, &id_b);
        let ax = ent_a["geometry"]["Arc"]["center"]["x"].as_f64().unwrap();
        let ay = ent_a["geometry"]["Arc"]["center"]["y"].as_f64().unwrap();
        let bx = ent_b["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        let by = ent_b["geometry"]["Circle"]["center"]["y"].as_f64().unwrap();
        assert!(
            (ax - bx).abs() < 0.1,
            "concentric arc+circle x: {ax} vs {bx}"
        );
        assert!(
            (ay - by).abs() < 0.1,
            "concentric arc+circle y: {ay} vs {by}"
        );
    }

    // --- Symmetric ---

    #[test]
    fn symmetric_line_about_y_axis() {
        let mut k = Kernel::new();
        // Line from (5,0) to (5,10)
        let rl = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5.0,"y1":0.0,"x2":5.0,"y2":10.0,"layer_id":"layer_0"}"#,
        );
        let line_id = rl["created_ids"][0].as_str().unwrap().to_string();
        // Axis: Y axis as a line from (0,-10) to (0,10)
        let ra = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":-10.0,"x2":0.0,"y2":10.0,"layer_id":"layer_0"}"#,
        );
        let axis_id = ra["created_ids"][0].as_str().unwrap().to_string();
        let cmd = format!(
            r#"{{"type":"AddConstraintSymmetric","entity_id":"{}","axis_entity":"{}"}}"#,
            line_id, axis_id
        );
        let cr = exec(&mut k, &cmd);
        assert_eq!(cr["success"], true);
        // Run solver multiple iterations
        for _ in 0..5 {
            k.solve_constraints();
        }
        let ent = get_entity(&k, &line_id);
        let (sx, _, ex, _) = line_points(&ent);
        // A line symmetric about the Y axis should have start.x == -end.x
        // or both endpoints at x=0
        // Since (5,0)+(5,10) reflected across y-axis is (-5,0)+(-5,10)
        // For symmetry: start = midpoint of (5,0) and reflected(end)=(-5,10) etc.
        // After convergence, both x coords should be ~0 (on the axis)
        assert!(
            sx.abs() < 0.5,
            "symmetric: start x should be near 0, got {sx}"
        );
        assert!(
            ex.abs() < 0.5,
            "symmetric: end x should be near 0, got {ex}"
        );
    }

    // --- DOF Analysis ---

    #[test]
    fn dof_unconstrained_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let _id = r["created_ids"][0].as_str().unwrap().to_string();
        let result = exec(&mut k, r#"{"type":"AnalyzeDof"}"#);
        assert_eq!(result["success"], true);
        let dof: serde_json::Value =
            serde_json::from_str(result["error"].as_str().unwrap()).unwrap();
        assert_eq!(
            dof["remaining_dof"], 4,
            "unconstrained line should have 4 DOF"
        );
        assert_eq!(dof["is_fully_constrained"], false);
    }

    #[test]
    fn dof_horizontal_line() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
                id
            ),
        );
        let result = exec(&mut k, r#"{"type":"AnalyzeDof"}"#);
        let dof: serde_json::Value =
            serde_json::from_str(result["error"].as_str().unwrap()).unwrap();
        assert_eq!(dof["remaining_dof"], 3, "horizontal line should have 3 DOF");
    }

    #[test]
    fn dof_fully_constrained() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        // Horizontal: -1 DOF
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
                id
            ),
        );
        // Fix start point: -2 DOF
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintFixed","entity_id":"{}","point_index":0,"x":0.0,"y":0.0}}"#,
                id
            ),
        );
        // Distance start->end = 10: -1 DOF → total 4 removed from 4 = 0
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintDistance","entity_a":"{}","point_a":0,"entity_b":"{}","point_b":1,"distance":10.0}}"#,
                id, id
            ),
        );
        let result = exec(&mut k, r#"{"type":"AnalyzeDof"}"#);
        let dof: serde_json::Value =
            serde_json::from_str(result["error"].as_str().unwrap()).unwrap();
        assert_eq!(dof["remaining_dof"], 0, "should be fully constrained");
        assert_eq!(dof["is_fully_constrained"], true);
    }

    #[test]
    fn dof_over_constrained() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":10.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let id = r["created_ids"][0].as_str().unwrap().to_string();
        // Fix start: -2
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintFixed","entity_id":"{}","point_index":0,"x":0.0,"y":0.0}}"#,
                id
            ),
        );
        // Fix end (using distance trick — fix as another Fixed): -2
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintFixed","entity_id":"{}","point_index":1,"x":10.0,"y":0.0}}"#,
                id
            ),
        );
        // Horizontal: -1 → total 5, but only 4 DOF → over-constrained
        exec(
            &mut k,
            &format!(
                r#"{{"type":"AddConstraintHorizontal","entity_id":"{}"}}"#,
                id
            ),
        );
        let result = exec(&mut k, r#"{"type":"AnalyzeDof"}"#);
        let dof: serde_json::Value =
            serde_json::from_str(result["error"].as_str().unwrap()).unwrap();
        assert_eq!(dof["is_over_constrained"], true);
    }

    #[test]
    fn dof_unconstrained_circle() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0.0,"cy":0.0,"radius":5.0,"layer_id":"layer_0"}"#,
        );
        let result = exec(&mut k, r#"{"type":"AnalyzeDof"}"#);
        let dof: serde_json::Value =
            serde_json::from_str(result["error"].as_str().unwrap()).unwrap();
        assert_eq!(
            dof["remaining_dof"], 3,
            "unconstrained circle should have 3 DOF"
        );
    }
}

impl crate::ports::ConstraintSolverPort for ConstraintSolver {
    fn add_constraint(&mut self, ct: ConstraintType) -> String {
        self.add_constraint(ct)
    }

    fn remove_constraint(&mut self, id: &str) -> bool {
        self.remove_constraint(id)
    }

    fn remove_constraints_for_entity(&mut self, entity_id: &str) {
        self.remove_constraints_for_entity(entity_id)
    }

    fn solve(&self, entities: &mut [Entity]) -> bool {
        self.solve(entities)
    }

    fn get_constraints_json(&self) -> String {
        self.get_constraints_json()
    }

    fn get_constraints(&self) -> Vec<Constraint> {
        self.constraints.clone()
    }

    fn constraint_count(&self) -> usize {
        self.constraint_count()
    }

    fn constrained_entity_ids(&self) -> Vec<String> {
        self.constrained_entity_ids()
    }

    fn analyze_dof(&self, entities: &[Entity]) -> DofResult {
        self.analyze_dof(entities)
    }
}
