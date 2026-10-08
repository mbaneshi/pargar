use crate::commands::CommandResult;
use crate::entity::{Entity, EntityStyle, GeometryType, Point2D};
use crate::events::{CadEvent, EventStore};
use crate::tolerance;
use crate::world::NexusWorld;
use std::collections::HashSet;

pub(crate) fn mirror_point(p: &mut Point2D, x1: f64, y1: f64, x2: f64, y2: f64) {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let len_sq = dx * dx + dy * dy;
    if len_sq < tolerance::ZERO_LENGTH * tolerance::ZERO_LENGTH {
        return;
    }
    let t = ((p.x - x1) * dx + (p.y - y1) * dy) / len_sq;
    p.x = 2.0 * (x1 + t * dx) - p.x;
    p.y = 2.0 * (y1 + t * dy) - p.y;
}

pub(crate) fn mirror_geometry(geom: &mut GeometryType, x1: f64, y1: f64, x2: f64, y2: f64) {
    match geom {
        GeometryType::Line { start, end } => {
            mirror_point(start, x1, y1, x2, y2);
            mirror_point(end, x1, y1, x2, y2);
        }
        GeometryType::Circle { center, .. } => {
            mirror_point(center, x1, y1, x2, y2);
        }
        GeometryType::Arc {
            center,
            start_angle,
            end_angle,
            ..
        } => {
            mirror_point(center, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            let ns = 2.0 * line_angle - *end_angle;
            let ne = 2.0 * line_angle - *start_angle;
            *start_angle = ns;
            *end_angle = ne;
        }
        GeometryType::Polyline { vertices, .. } => {
            for v in vertices.iter_mut() {
                mirror_point(v, x1, y1, x2, y2);
            }
        }
        GeometryType::Rectangle {
            origin,
            width,
            height,
            rotation,
        } => {
            let mut center = Point2D::new(origin.x + *width / 2.0, origin.y + *height / 2.0);
            mirror_point(&mut center, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            *rotation = 2.0 * line_angle - *rotation;
            origin.x = center.x - *width / 2.0;
            origin.y = center.y - *height / 2.0;
        }
        GeometryType::Text {
            position, rotation, ..
        } => {
            mirror_point(position, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            *rotation = 2.0 * line_angle - *rotation;
        }
        GeometryType::Dimension { start, end, .. } => {
            mirror_point(start, x1, y1, x2, y2);
            mirror_point(end, x1, y1, x2, y2);
        }
        GeometryType::Ellipse {
            center, rotation, ..
        } => {
            mirror_point(center, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            *rotation = 2.0 * line_angle - *rotation;
        }
        GeometryType::Spline { control_points, .. } => {
            for p in control_points.iter_mut() {
                mirror_point(p, x1, y1, x2, y2);
            }
        }
        GeometryType::ConstructionLine { origin, direction }
        | GeometryType::Ray { origin, direction } => {
            mirror_point(origin, x1, y1, x2, y2);
            mirror_point(direction, x1, y1, x2, y2);
        }
        GeometryType::BlockRef {
            insertion,
            rotation,
            ..
        } => {
            mirror_point(insertion, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            *rotation = 2.0 * line_angle - *rotation;
        }
        GeometryType::AlignedDimension { start, end, .. } => {
            mirror_point(start, x1, y1, x2, y2);
            mirror_point(end, x1, y1, x2, y2);
        }
        GeometryType::AngularDimension {
            center,
            start_ray,
            end_ray,
            ..
        } => {
            mirror_point(center, x1, y1, x2, y2);
            mirror_point(start_ray, x1, y1, x2, y2);
            mirror_point(end_ray, x1, y1, x2, y2);
        }
        GeometryType::RadialDimension {
            center,
            point_on_arc,
            ..
        }
        | GeometryType::DiameterDimension {
            center,
            point_on_arc,
            ..
        } => {
            mirror_point(center, x1, y1, x2, y2);
            mirror_point(point_on_arc, x1, y1, x2, y2);
        }
        GeometryType::Point { position } => {
            mirror_point(position, x1, y1, x2, y2);
        }
        GeometryType::Hatch { .. } => {}
        GeometryType::MText {
            position, rotation, ..
        } => {
            mirror_point(position, x1, y1, x2, y2);
            let line_angle = (y2 - y1).atan2(x2 - x1);
            *rotation = 2.0 * line_angle - *rotation;
        }
        GeometryType::Table { position, .. } => {
            mirror_point(position, x1, y1, x2, y2);
        }
        GeometryType::RevisionCloud { boundary, .. } => {
            for p in boundary.iter_mut() {
                mirror_point(p, x1, y1, x2, y2);
            }
        }
        GeometryType::Leader { vertices, .. } | GeometryType::Wipeout { vertices } => {
            for v in vertices.iter_mut() {
                mirror_point(v, x1, y1, x2, y2);
            }
        }
        GeometryType::EllipseArc { center, .. } => {
            mirror_point(center, x1, y1, x2, y2);
        }
        GeometryType::Tolerance { position, .. } | GeometryType::AttDef { position, .. } => {
            mirror_point(position, x1, y1, x2, y2);
        }
    }
}

pub(crate) fn line_line_intersect(
    s1: &Point2D,
    e1: &Point2D,
    s2: &Point2D,
    e2: &Point2D,
) -> Option<Point2D> {
    let d1x = e1.x - s1.x;
    let d1y = e1.y - s1.y;
    let d2x = e2.x - s2.x;
    let d2y = e2.y - s2.y;
    let denom = d1x * d2y - d1y * d2x;
    if denom.abs() < tolerance::PARALLEL_DENOMINATOR {
        return None;
    }
    let t = ((s2.x - s1.x) * d2y - (s2.y - s1.y) * d2x) / denom;
    let u = ((s2.x - s1.x) * d1y - (s2.y - s1.y) * d1x) / denom;
    if (-tolerance::PARAMETER_EXTENSION..=1.0 + tolerance::PARAMETER_EXTENSION).contains(&t)
        && (-tolerance::PARAMETER_EXTENSION..=1.0 + tolerance::PARAMETER_EXTENSION).contains(&u)
    {
        Some(Point2D::new(s1.x + t * d1x, s1.y + t * d1y))
    } else {
        None
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn line_line_intersect_infinite(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    x3: f64,
    y3: f64,
    x4: f64,
    y4: f64,
) -> Option<(f64, f64)> {
    let dx1 = x2 - x1;
    let dy1 = y2 - y1;
    let dx2 = x4 - x3;
    let dy2 = y4 - y3;
    let denom = dx1 * dy2 - dy1 * dx2;
    if denom.abs() < 1e-10 {
        return None;
    }
    let t = ((x3 - x1) * dy2 - (y3 - y1) * dx2) / denom;
    Some((x1 + t * dx1, y1 + t * dy1))
}

pub(crate) fn nearest_polyline_param(vertices: &[Point2D], pt: &Point2D) -> (usize, f64) {
    let mut best_seg = 0;
    let mut best_t = 0.0;
    let mut best_dist = f64::MAX;

    for i in 0..vertices.len() - 1 {
        let ax = vertices[i].x;
        let ay = vertices[i].y;
        let bx = vertices[i + 1].x;
        let by = vertices[i + 1].y;
        let dx = bx - ax;
        let dy = by - ay;
        let len_sq = dx * dx + dy * dy;
        let t = if len_sq < 1e-20 {
            0.0
        } else {
            ((pt.x - ax) * dx + (pt.y - ay) * dy) / len_sq
        }
        .clamp(0.0, 1.0);
        let cx = ax + t * dx;
        let cy = ay + t * dy;
        let d = ((pt.x - cx).powi(2) + (pt.y - cy).powi(2)).sqrt();
        if d < best_dist {
            best_dist = d;
            best_seg = i;
            best_t = t;
        }
    }
    (best_seg, best_t)
}

pub(crate) fn offset_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    next_id: &mut u64,
    id: &str,
    distance: f64,
) -> Result<String, String> {
    let entity = world
        .get_entity_cloned(id)
        .ok_or_else(|| format!("Entity '{}' not found", id))?;

    let new_geometry = match &entity.geometry {
        GeometryType::Line { start, end } => {
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let len = (dx * dx + dy * dy).sqrt();
            if len < tolerance::ZERO_LENGTH {
                return Err("Cannot offset zero-length line".into());
            }
            let nx = -dy / len * distance;
            let ny = dx / len * distance;
            GeometryType::Line {
                start: Point2D::new(start.x + nx, start.y + ny),
                end: Point2D::new(end.x + nx, end.y + ny),
            }
        }
        GeometryType::Circle { center, radius } => {
            let new_radius = radius + distance;
            if new_radius <= 0.0 {
                return Err(format!(
                    "Offset distance {} would produce negative radius",
                    distance
                ));
            }
            GeometryType::Circle {
                center: center.clone(),
                radius: new_radius,
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            let new_radius = radius + distance;
            if new_radius <= 0.0 {
                return Err(format!(
                    "Offset distance {} would produce negative radius",
                    distance
                ));
            }
            GeometryType::Arc {
                center: center.clone(),
                radius: new_radius,
                start_angle: *start_angle,
                end_angle: *end_angle,
            }
        }
        GeometryType::Ellipse {
            center,
            semi_major,
            semi_minor,
            rotation,
        } => {
            let new_major = semi_major + distance;
            let new_minor = semi_minor + distance;
            if new_major <= 0.0 || new_minor <= 0.0 {
                return Err(format!(
                    "Offset distance {} would produce negative radius",
                    distance
                ));
            }
            GeometryType::Ellipse {
                center: center.clone(),
                semi_major: new_major,
                semi_minor: new_minor,
                rotation: *rotation,
            }
        }
        GeometryType::Rectangle {
            origin,
            width,
            height,
            rotation,
        } => {
            let abs_d = distance.abs();
            let sign = if distance >= 0.0 { 1.0 } else { -1.0 };
            let new_width = width + 2.0 * abs_d * sign;
            let new_height = height + 2.0 * abs_d * sign;
            if new_width <= 0.0 || new_height <= 0.0 {
                return Err(
                    "Offset distance too large — result has zero or negative dimensions".into(),
                );
            }
            let cos_r = rotation.cos();
            let sin_r = rotation.sin();
            let local_offset = -abs_d * sign;
            GeometryType::Rectangle {
                origin: Point2D::new(
                    origin.x + local_offset * cos_r - local_offset * sin_r,
                    origin.y + local_offset * sin_r + local_offset * cos_r,
                ),
                width: new_width,
                height: new_height,
                rotation: *rotation,
            }
        }
        GeometryType::Polyline { vertices, closed } => {
            if vertices.len() < 2 {
                return Err("Cannot offset polyline with fewer than 2 vertices".into());
            }
            let mut new_verts = Vec::new();
            for i in 0..vertices.len() {
                let prev = if i == 0 {
                    if *closed {
                        &vertices[vertices.len() - 1]
                    } else {
                        &vertices[0]
                    }
                } else {
                    &vertices[i - 1]
                };
                let curr = &vertices[i];
                let next = if i == vertices.len() - 1 {
                    if *closed {
                        &vertices[0]
                    } else {
                        &vertices[vertices.len() - 1]
                    }
                } else {
                    &vertices[i + 1]
                };
                let dx1 = curr.x - prev.x;
                let dy1 = curr.y - prev.y;
                let dx2 = next.x - curr.x;
                let dy2 = next.y - curr.y;
                let len1 = (dx1 * dx1 + dy1 * dy1).sqrt().max(tolerance::ZERO_LENGTH);
                let len2 = (dx2 * dx2 + dy2 * dy2).sqrt().max(tolerance::ZERO_LENGTH);
                let nx = (-dy1 / len1 + -dy2 / len2) / 2.0;
                let ny = (dx1 / len1 + dx2 / len2) / 2.0;
                let nlen = (nx * nx + ny * ny).sqrt().max(tolerance::ZERO_LENGTH);
                new_verts.push(Point2D::new(
                    curr.x + nx / nlen * distance,
                    curr.y + ny / nlen * distance,
                ));
            }
            GeometryType::Polyline {
                vertices: new_verts,
                closed: *closed,
            }
        }
        other => {
            return Err(format!(
                "Offset not supported for {:?}",
                std::mem::discriminant(other)
            ))
        }
    };

    let new_id = format!("ent_{}", *next_id);
    *next_id += 1;
    let new_entity = Entity {
        id: new_id.clone(),
        geometry: new_geometry,
        layer_id: entity.layer_id.clone(),
        style: entity.style.clone(),
        draw_order: 0,
    };
    event_store.push(CadEvent::EntityCreated {
        entity: new_entity.clone(),
    });
    last_created_id.replace(new_id.clone());
    world.insert_entity(new_entity);
    dirty_ids.insert(new_id.clone());
    Ok(new_id)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn mirror_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    next_id: &mut u64,
    id: &str,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
) -> String {
    if let Some(entity) = world.get_entity_cloned(id) {
        let mut new_geom = entity.geometry.clone();
        mirror_geometry(&mut new_geom, x1, y1, x2, y2);
        let new_id = format!("ent_{}", *next_id);
        *next_id += 1;
        let new_entity = Entity {
            id: new_id.clone(),
            geometry: new_geom,
            layer_id: entity.layer_id.clone(),
            style: entity.style.clone(),
            draw_order: 0,
        };
        event_store.push(CadEvent::EntityCreated {
            entity: new_entity.clone(),
        });
        last_created_id.replace(new_id.clone());
        world.insert_entity(new_entity);
        dirty_ids.insert(new_id.clone());
        new_id
    } else {
        String::new()
    }
}

pub(crate) fn trim_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    boundary_id: &str,
    pick_x: f64,
    pick_y: f64,
) -> bool {
    let entity = world.get_entity_cloned(id);
    let boundary = world.get_entity_cloned(boundary_id);
    if let (Some(ent), Some(bound)) = (entity, boundary) {
        if let (
            GeometryType::Line { start: s1, end: e1 },
            GeometryType::Line { start: s2, end: e2 },
        ) = (&ent.geometry, &bound.geometry)
        {
            if let Some(intersection) = line_line_intersect(s1, e1, s2, e2) {
                let pick = Point2D::new(pick_x, pick_y);
                let old_geometry = ent.geometry.clone();
                let new_geometry = if pick.distance_to(s1) < pick.distance_to(e1) {
                    GeometryType::Line {
                        start: intersection,
                        end: e1.clone(),
                    }
                } else {
                    GeometryType::Line {
                        start: s1.clone(),
                        end: intersection,
                    }
                };
                world.set_geometry(id, new_geometry.clone());
                event_store.push(CadEvent::EntityModified {
                    id: id.to_string(),
                    old_geometry,
                    new_geometry,
                });
                dirty_ids.insert(id.to_string());
                return true;
            }
        }
    }
    false
}

pub(crate) fn lengthen_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    mode: &str,
    value: f64,
    end: &str,
) -> bool {
    let old_geometry = match world.get_entity_cloned(id) {
        Some(e) => e.geometry.clone(),
        None => return false,
    };
    let new_geometry = match &old_geometry {
        GeometryType::Line {
            start,
            end: line_end,
        } => {
            let dx = line_end.x - start.x;
            let dy = line_end.y - start.y;
            let current_len = (dx * dx + dy * dy).sqrt();
            if current_len < tolerance::ZERO_LENGTH {
                return false;
            }
            let new_len = match mode {
                "delta" => current_len + value,
                "percent" => current_len * value / 100.0,
                "total" => value,
                _ => return false,
            };
            if new_len <= 0.0 {
                return false;
            }
            let ux = dx / current_len;
            let uy = dy / current_len;
            match end {
                "start" => {
                    let diff = new_len - current_len;
                    let new_start = Point2D::new(start.x - ux * diff, start.y - uy * diff);
                    GeometryType::Line {
                        start: new_start,
                        end: line_end.clone(),
                    }
                }
                _ => {
                    let new_end = Point2D::new(start.x + ux * new_len, start.y + uy * new_len);
                    GeometryType::Line {
                        start: start.clone(),
                        end: new_end,
                    }
                }
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            let sa = *start_angle;
            let mut ea = *end_angle;
            while ea <= sa {
                ea += std::f64::consts::TAU;
            }
            let current_arc_len = *radius * (ea - sa);
            if current_arc_len < tolerance::ZERO_LENGTH {
                return false;
            }
            let new_arc_len = match mode {
                "delta" => current_arc_len + value,
                "percent" => current_arc_len * value / 100.0,
                "total" => value,
                _ => return false,
            };
            if new_arc_len <= 0.0 {
                return false;
            }
            let new_angle_span = new_arc_len / *radius;
            match end {
                "start" => {
                    let new_sa = ea - new_angle_span;
                    GeometryType::Arc {
                        center: center.clone(),
                        radius: *radius,
                        start_angle: new_sa,
                        end_angle: ea,
                    }
                }
                _ => {
                    let new_ea = sa + new_angle_span;
                    GeometryType::Arc {
                        center: center.clone(),
                        radius: *radius,
                        start_angle: sa,
                        end_angle: new_ea,
                    }
                }
            }
        }
        _ => return false,
    };
    world.set_geometry(id, new_geometry.clone());
    event_store.push(CadEvent::EntityModified {
        id: id.to_string(),
        old_geometry,
        new_geometry,
    });
    dirty_ids.insert(id.to_string());
    true
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn break_at_point(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    entity_id: &str,
    px: f64,
    py: f64,
) -> CommandResult {
    let entity = match world.get_entity_cloned(entity_id) {
        Some(e) => e,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let pt = Point2D::new(px, py);
    let layer_id = entity.layer_id.clone();
    let style = entity.style.clone();

    let gen = |next: &mut u64| -> String {
        let id = format!("ent_{}", *next);
        *next += 1;
        id
    };

    match &entity.geometry {
        GeometryType::Line { start, end } => {
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let len_sq = dx * dx + dy * dy;
            if len_sq < 1e-20 {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Degenerate line".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }
            let t = ((pt.x - start.x) * dx + (pt.y - start.y) * dy) / len_sq;
            let t = t.clamp(0.01, 0.99);
            let mid = Point2D::new(start.x + t * dx, start.y + t * dy);

            let id1 = gen(next_id);
            let id2 = gen(next_id);
            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Line {
                    start: start.clone(),
                    end: mid.clone(),
                },
                layer_id: layer_id.clone(),
                style: style.clone(),
                draw_order: 0,
            };
            let e2 = Entity {
                id: id2.clone(),
                geometry: GeometryType::Line {
                    start: mid,
                    end: end.clone(),
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());
            world.insert_entity(e2.clone());
            dirty_ids.insert(id2.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                    CadEvent::EntityCreated { entity: e2 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1, id2],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            let angle = (pt.y - center.y).atan2(pt.x - center.x);
            let mut sa = *start_angle;
            let mut ea = *end_angle;
            while sa < 0.0 {
                sa += std::f64::consts::TAU;
            }
            while ea < sa {
                ea += std::f64::consts::TAU;
            }
            let mut a = angle;
            while a < sa {
                a += std::f64::consts::TAU;
            }
            if a > ea {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Point not on arc".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }

            let id1 = gen(next_id);
            let id2 = gen(next_id);
            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: *start_angle,
                    end_angle: angle,
                },
                layer_id: layer_id.clone(),
                style: style.clone(),
                draw_order: 0,
            };
            let e2 = Entity {
                id: id2.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: angle,
                    end_angle: *end_angle,
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());
            world.insert_entity(e2.clone());
            dirty_ids.insert(id2.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                    CadEvent::EntityCreated { entity: e2 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1, id2],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Circle { center, radius } => {
            let angle = (pt.y - center.y).atan2(pt.x - center.x);
            let id1 = gen(next_id);
            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: angle,
                    end_angle: angle + std::f64::consts::TAU,
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Polyline { vertices, .. } => {
            if vertices.len() < 2 {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Polyline too short".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }

            let (seg_idx, t) = nearest_polyline_param(vertices, &pt);

            let mut verts1 = vertices[..=seg_idx].to_vec();
            let split_pt = Point2D::new(
                vertices[seg_idx].x + t * (vertices[seg_idx + 1].x - vertices[seg_idx].x),
                vertices[seg_idx].y + t * (vertices[seg_idx + 1].y - vertices[seg_idx].y),
            );
            verts1.push(split_pt.clone());

            let mut verts2 = vec![split_pt];
            verts2.extend_from_slice(&vertices[seg_idx + 1..]);

            let id1 = gen(next_id);
            let id2 = gen(next_id);
            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Polyline {
                    vertices: verts1,
                    closed: false,
                },
                layer_id: layer_id.clone(),
                style: style.clone(),
                draw_order: 0,
            };
            let e2 = Entity {
                id: id2.clone(),
                geometry: GeometryType::Polyline {
                    vertices: verts2,
                    closed: false,
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());
            world.insert_entity(e2.clone());
            dirty_ids.insert(id2.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                    CadEvent::EntityCreated { entity: e2 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1, id2],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        _ => CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Break not supported for this entity type".into()),
            measurement: None,
            warnings: vec![],
        },
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn break_two_points(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    entity_id: &str,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
) -> CommandResult {
    let entity = match world.get_entity_cloned(entity_id) {
        Some(e) => e,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let p1 = Point2D::new(x1, y1);
    let p2 = Point2D::new(x2, y2);
    let layer_id = entity.layer_id.clone();
    let style = entity.style.clone();

    let gen = |next: &mut u64| -> String {
        let id = format!("ent_{}", *next);
        *next += 1;
        id
    };

    match &entity.geometry {
        GeometryType::Line { start, end } => {
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let len_sq = dx * dx + dy * dy;
            if len_sq < 1e-20 {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Degenerate line".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }
            let mut t1 = ((p1.x - start.x) * dx + (p1.y - start.y) * dy) / len_sq;
            let mut t2 = ((p2.x - start.x) * dx + (p2.y - start.y) * dy) / len_sq;
            if t1 > t2 {
                std::mem::swap(&mut t1, &mut t2);
            }
            t1 = t1.clamp(0.0, 1.0);
            t2 = t2.clamp(0.0, 1.0);

            let bp1 = Point2D::new(start.x + t1 * dx, start.y + t1 * dy);
            let bp2 = Point2D::new(start.x + t2 * dx, start.y + t2 * dy);

            let mut created = vec![];
            let mut events = vec![CadEvent::EntityDeleted {
                entity: entity.clone(),
            }];

            if t1 > 0.01 {
                let id = gen(next_id);
                let e = Entity {
                    id: id.clone(),
                    geometry: GeometryType::Line {
                        start: start.clone(),
                        end: bp1,
                    },
                    layer_id: layer_id.clone(),
                    style: style.clone(),
                    draw_order: 0,
                };
                world.insert_entity(e.clone());
                dirty_ids.insert(id.clone());
                events.push(CadEvent::EntityCreated { entity: e });
                created.push(id);
            }
            if t2 < 0.99 {
                let id = gen(next_id);
                let e = Entity {
                    id: id.clone(),
                    geometry: GeometryType::Line {
                        start: bp2,
                        end: end.clone(),
                    },
                    layer_id,
                    style,
                    draw_order: 0,
                };
                world.insert_entity(e.clone());
                dirty_ids.insert(id.clone());
                events.push(CadEvent::EntityCreated { entity: e });
                created.push(id);
            }

            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            event_store.push(CadEvent::CompoundEvent { events });

            CommandResult {
                success: true,
                created_ids: created,
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } => {
            let a1 = (p1.y - center.y).atan2(p1.x - center.x);
            let a2 = (p2.y - center.y).atan2(p2.x - center.x);

            let id1 = gen(next_id);
            let id2 = gen(next_id);

            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: *start_angle,
                    end_angle: a1,
                },
                layer_id: layer_id.clone(),
                style: style.clone(),
                draw_order: 0,
            };
            let e2 = Entity {
                id: id2.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: a2,
                    end_angle: *end_angle,
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());
            world.insert_entity(e2.clone());
            dirty_ids.insert(id2.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                    CadEvent::EntityCreated { entity: e2 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1, id2],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Circle { center, radius } => {
            let a1 = (p1.y - center.y).atan2(p1.x - center.x);
            let a2 = (p2.y - center.y).atan2(p2.x - center.x);

            let id1 = gen(next_id);
            let e1 = Entity {
                id: id1.clone(),
                geometry: GeometryType::Arc {
                    center: center.clone(),
                    radius: *radius,
                    start_angle: a2,
                    end_angle: a1,
                },
                layer_id,
                style,
                draw_order: 0,
            };

            let deleted_entity = entity.clone();
            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            world.insert_entity(e1.clone());
            dirty_ids.insert(id1.clone());

            event_store.push(CadEvent::CompoundEvent {
                events: vec![
                    CadEvent::EntityDeleted {
                        entity: deleted_entity,
                    },
                    CadEvent::EntityCreated { entity: e1 },
                ],
            });

            CommandResult {
                success: true,
                created_ids: vec![id1],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Polyline { vertices, .. } => {
            if vertices.len() < 2 {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Polyline too short".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }

            let (seg1, t1) = nearest_polyline_param(vertices, &p1);
            let (seg2, t2) = nearest_polyline_param(vertices, &p2);

            let (s1, st1, s2, st2) = if seg1 < seg2 || (seg1 == seg2 && t1 <= t2) {
                (seg1, t1, seg2, t2)
            } else {
                (seg2, t2, seg1, t1)
            };

            let split1 = Point2D::new(
                vertices[s1].x + st1 * (vertices[s1 + 1].x - vertices[s1].x),
                vertices[s1].y + st1 * (vertices[s1 + 1].y - vertices[s1].y),
            );
            let split2 = Point2D::new(
                vertices[s2].x + st2 * (vertices[s2 + 1].x - vertices[s2].x),
                vertices[s2].y + st2 * (vertices[s2 + 1].y - vertices[s2].y),
            );

            let mut verts1 = vertices[..=s1].to_vec();
            verts1.push(split1);

            let mut verts2 = vec![split2];
            verts2.extend_from_slice(&vertices[s2 + 1..]);

            let mut created = vec![];
            let mut events = vec![CadEvent::EntityDeleted {
                entity: entity.clone(),
            }];

            if verts1.len() >= 2 {
                let id = gen(next_id);
                let e = Entity {
                    id: id.clone(),
                    geometry: GeometryType::Polyline {
                        vertices: verts1,
                        closed: false,
                    },
                    layer_id: layer_id.clone(),
                    style: style.clone(),
                    draw_order: 0,
                };
                world.insert_entity(e.clone());
                dirty_ids.insert(id.clone());
                events.push(CadEvent::EntityCreated { entity: e });
                created.push(id);
            }
            if verts2.len() >= 2 {
                let id = gen(next_id);
                let e = Entity {
                    id: id.clone(),
                    geometry: GeometryType::Polyline {
                        vertices: verts2,
                        closed: false,
                    },
                    layer_id,
                    style,
                    draw_order: 0,
                };
                world.insert_entity(e.clone());
                dirty_ids.insert(id.clone());
                events.push(CadEvent::EntityCreated { entity: e });
                created.push(id);
            }

            world.remove_entity_returning(entity_id);
            deleted_ids.push(entity_id.to_string());
            event_store.push(CadEvent::CompoundEvent { events });

            CommandResult {
                success: true,
                created_ids: created,
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        _ => CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Break not supported for this entity type".into()),
            measurement: None,
            warnings: vec![],
        },
    }
}

pub(crate) fn fillet(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    id_a: &str,
    id_b: &str,
    radius: f64,
) -> CommandResult {
    let ent_a = world.get_entity_cloned(id_a);
    let ent_b = world.get_entity_cloned(id_b);
    let (ent_a, ent_b) = match (ent_a, ent_b) {
        (Some(a), Some(b)) => (a, b),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (sa, ea) = match &ent_a.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Fillet requires lines".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (sb, eb) = match &ent_b.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Fillet requires lines".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (ix, iy) =
        match line_line_intersect_infinite(sa.x, sa.y, ea.x, ea.y, sb.x, sb.y, eb.x, eb.y) {
            Some(p) => p,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Lines are parallel".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
    let ip = Point2D::new(ix, iy);
    let a_start_closer = sa.distance_to(&ip) <= ea.distance_to(&ip);
    let b_start_closer = sb.distance_to(&ip) <= eb.distance_to(&ip);

    if radius.abs() < 1e-10 {
        let old_a = ent_a.geometry.clone();
        let old_b = ent_b.geometry.clone();
        let new_a = if a_start_closer {
            GeometryType::Line {
                start: ip.clone(),
                end: ea,
            }
        } else {
            GeometryType::Line {
                start: sa,
                end: ip.clone(),
            }
        };
        let new_b = if b_start_closer {
            GeometryType::Line {
                start: ip.clone(),
                end: eb,
            }
        } else {
            GeometryType::Line {
                start: sb,
                end: ip.clone(),
            }
        };
        world.set_geometry(id_a, new_a.clone());
        world.set_geometry(id_b, new_b.clone());
        dirty_ids.insert(id_a.to_string());
        dirty_ids.insert(id_b.to_string());
        event_store.push(CadEvent::CompoundEvent {
            events: vec![
                CadEvent::EntityModified {
                    id: id_a.to_string(),
                    old_geometry: old_a,
                    new_geometry: new_a,
                },
                CadEvent::EntityModified {
                    id: id_b.to_string(),
                    old_geometry: old_b,
                    new_geometry: new_b,
                },
            ],
        });
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    } else {
        let dir_a = if a_start_closer {
            (ea.x - ix, ea.y - iy)
        } else {
            (sa.x - ix, sa.y - iy)
        };
        let dir_b = if b_start_closer {
            (eb.x - ix, eb.y - iy)
        } else {
            (sb.x - ix, sb.y - iy)
        };
        let len_a = (dir_a.0 * dir_a.0 + dir_a.1 * dir_a.1).sqrt();
        let len_b = (dir_b.0 * dir_b.0 + dir_b.1 * dir_b.1).sqrt();
        if len_a < 1e-10 || len_b < 1e-10 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Lines too short".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let ua = (dir_a.0 / len_a, dir_a.1 / len_a);
        let ub = (dir_b.0 / len_b, dir_b.1 / len_b);
        let bis = (ua.0 + ub.0, ua.1 + ub.1);
        let bis_len = (bis.0 * bis.0 + bis.1 * bis.1).sqrt();
        if bis_len < 1e-10 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Cannot compute fillet".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let half_angle = (ua.0 * ub.0 + ua.1 * ub.1).clamp(-1.0, 1.0).acos() / 2.0;
        if half_angle.abs() < 1e-10 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Lines nearly parallel".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let center_dist = radius / half_angle.sin();
        let bis_n = (bis.0 / bis_len, bis.1 / bis_len);
        let cx = ix + bis_n.0 * center_dist;
        let cy = iy + bis_n.1 * center_dist;
        let trim_dist = radius / half_angle.tan();
        let ta = Point2D::new(ix + ua.0 * trim_dist, iy + ua.1 * trim_dist);
        let tb = Point2D::new(ix + ub.0 * trim_dist, iy + ub.1 * trim_dist);
        let start_angle = (ta.y - cy).atan2(ta.x - cx);
        let end_angle = (tb.y - cy).atan2(tb.x - cx);

        let old_a = ent_a.geometry.clone();
        let old_b = ent_b.geometry.clone();
        let new_a = if a_start_closer {
            GeometryType::Line {
                start: ta.clone(),
                end: ea,
            }
        } else {
            GeometryType::Line {
                start: sa,
                end: ta.clone(),
            }
        };
        let new_b = if b_start_closer {
            GeometryType::Line {
                start: tb.clone(),
                end: eb,
            }
        } else {
            GeometryType::Line {
                start: sb,
                end: tb.clone(),
            }
        };
        world.set_geometry(id_a, new_a.clone());
        world.set_geometry(id_b, new_b.clone());
        dirty_ids.insert(id_a.to_string());
        dirty_ids.insert(id_b.to_string());

        let arc_id = format!("ent_{}", *next_id);
        *next_id += 1;
        let arc_entity = Entity {
            id: arc_id.clone(),
            geometry: GeometryType::Arc {
                center: Point2D::new(cx, cy),
                radius,
                start_angle,
                end_angle,
            },
            layer_id: ent_a.layer_id.clone(),
            style: EntityStyle::default(),
            draw_order: 0,
        };
        world.insert_entity(arc_entity.clone());
        dirty_ids.insert(arc_id.clone());

        event_store.push(CadEvent::CompoundEvent {
            events: vec![
                CadEvent::EntityModified {
                    id: id_a.to_string(),
                    old_geometry: old_a,
                    new_geometry: new_a,
                },
                CadEvent::EntityModified {
                    id: id_b.to_string(),
                    old_geometry: old_b,
                    new_geometry: new_b,
                },
                CadEvent::EntityCreated { entity: arc_entity },
            ],
        });
        CommandResult {
            success: true,
            created_ids: vec![arc_id],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn chamfer(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    id_a: &str,
    id_b: &str,
    dist_a: f64,
    dist_b: f64,
) -> CommandResult {
    let ent_a = world.get_entity_cloned(id_a);
    let ent_b = world.get_entity_cloned(id_b);
    let (ent_a, ent_b) = match (ent_a, ent_b) {
        (Some(a), Some(b)) => (a, b),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (sa, ea) = match &ent_a.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Chamfer requires lines".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (sb, eb) = match &ent_b.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Chamfer requires lines".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (ix, iy) =
        match line_line_intersect_infinite(sa.x, sa.y, ea.x, ea.y, sb.x, sb.y, eb.x, eb.y) {
            Some(p) => p,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Lines are parallel".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
    let ip = Point2D::new(ix, iy);
    let a_start_closer = sa.distance_to(&ip) <= ea.distance_to(&ip);
    let b_start_closer = sb.distance_to(&ip) <= eb.distance_to(&ip);

    let dir_a = if a_start_closer {
        (ea.x - ix, ea.y - iy)
    } else {
        (sa.x - ix, sa.y - iy)
    };
    let dir_b = if b_start_closer {
        (eb.x - ix, eb.y - iy)
    } else {
        (sb.x - ix, sb.y - iy)
    };
    let len_a = (dir_a.0 * dir_a.0 + dir_a.1 * dir_a.1).sqrt();
    let len_b = (dir_b.0 * dir_b.0 + dir_b.1 * dir_b.1).sqrt();
    if len_a < 1e-10 || len_b < 1e-10 {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Lines too short".into()),
            measurement: None,
            warnings: vec![],
        };
    }
    let ua = (dir_a.0 / len_a, dir_a.1 / len_a);
    let ub = (dir_b.0 / len_b, dir_b.1 / len_b);

    let ta = Point2D::new(ix + ua.0 * dist_a, iy + ua.1 * dist_a);
    let tb = Point2D::new(ix + ub.0 * dist_b, iy + ub.1 * dist_b);

    let old_a = ent_a.geometry.clone();
    let old_b = ent_b.geometry.clone();
    let new_a = if a_start_closer {
        GeometryType::Line {
            start: ta.clone(),
            end: ea,
        }
    } else {
        GeometryType::Line {
            start: sa,
            end: ta.clone(),
        }
    };
    let new_b = if b_start_closer {
        GeometryType::Line {
            start: tb.clone(),
            end: eb,
        }
    } else {
        GeometryType::Line {
            start: sb,
            end: tb.clone(),
        }
    };
    world.set_geometry(id_a, new_a.clone());
    world.set_geometry(id_b, new_b.clone());
    dirty_ids.insert(id_a.to_string());
    dirty_ids.insert(id_b.to_string());

    let chamfer_id = format!("ent_{}", *next_id);
    *next_id += 1;
    let chamfer_entity = Entity {
        id: chamfer_id.clone(),
        geometry: GeometryType::Line { start: ta, end: tb },
        layer_id: ent_a.layer_id.clone(),
        style: EntityStyle::default(),
        draw_order: 0,
    };
    world.insert_entity(chamfer_entity.clone());
    dirty_ids.insert(chamfer_id.clone());

    event_store.push(CadEvent::CompoundEvent {
        events: vec![
            CadEvent::EntityModified {
                id: id_a.to_string(),
                old_geometry: old_a,
                new_geometry: new_a,
            },
            CadEvent::EntityModified {
                id: id_b.to_string(),
                old_geometry: old_b,
                new_geometry: new_b,
            },
            CadEvent::EntityCreated {
                entity: chamfer_entity,
            },
        ],
    });
    CommandResult {
        success: true,
        created_ids: vec![chamfer_id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

pub(crate) fn explode(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    block_defs: &[crate::entity::BlockDef],
    entity_id: &str,
) -> CommandResult {
    let ent = match world.get_entity_cloned(entity_id) {
        Some(e) => e,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };

    let gen = |next: &mut u64| -> String {
        let id = format!("ent_{}", *next);
        *next += 1;
        id
    };

    match &ent.geometry {
        GeometryType::BlockRef {
            block_id,
            insertion,
            rotation,
            scale_x,
            ..
        } => {
            let block_ents = match block_defs.iter().find(|b| b.id == *block_id) {
                Some(bd) => bd.entities.clone(),
                None => {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Block def not found".into()),
                        measurement: None,
                        warnings: vec![],
                    }
                }
            };
            let mut compound = Vec::new();
            let mut created_ids = Vec::new();
            for be in &block_ents {
                let new_id = gen(next_id);
                let mut geom = be.geometry.clone();
                geom.scale(0.0, 0.0, *scale_x);
                geom.rotate(0.0, 0.0, *rotation);
                geom.translate(insertion.x, insertion.y);
                let new_entity = Entity {
                    id: new_id.clone(),
                    geometry: geom,
                    layer_id: ent.layer_id.clone(),
                    style: EntityStyle::default(),
                    draw_order: 0,
                };
                world.insert_entity(new_entity.clone());
                dirty_ids.insert(new_id.clone());
                compound.push(CadEvent::EntityCreated { entity: new_entity });
                created_ids.push(new_id);
            }
            if let Some(deleted) = world.remove_entity_returning(entity_id) {
                deleted_ids.push(entity_id.to_string());
                compound.push(CadEvent::EntityDeleted { entity: deleted });
            }
            event_store.push(CadEvent::CompoundEvent { events: compound });
            CommandResult {
                success: true,
                created_ids,
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Polyline { vertices, closed } => {
            if vertices.len() < 2 {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Polyline too short".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }
            let mut compound = Vec::new();
            let mut created_ids = Vec::new();
            let segment_count = if *closed {
                vertices.len()
            } else {
                vertices.len() - 1
            };
            for i in 0..segment_count {
                let start = vertices[i].clone();
                let end = vertices[(i + 1) % vertices.len()].clone();
                let new_id = gen(next_id);
                let new_entity = Entity {
                    id: new_id.clone(),
                    geometry: GeometryType::Line { start, end },
                    layer_id: ent.layer_id.clone(),
                    style: ent.style.clone(),
                    draw_order: 0,
                };
                world.insert_entity(new_entity.clone());
                dirty_ids.insert(new_id.clone());
                compound.push(CadEvent::EntityCreated { entity: new_entity });
                created_ids.push(new_id);
            }
            if let Some(deleted) = world.remove_entity_returning(entity_id) {
                deleted_ids.push(entity_id.to_string());
                compound.push(CadEvent::EntityDeleted { entity: deleted });
            }
            event_store.push(CadEvent::CompoundEvent { events: compound });
            CommandResult {
                success: true,
                created_ids,
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        GeometryType::Rectangle {
            origin,
            width,
            height,
            rotation,
        } => {
            let (w, h, rot) = (*width, *height, *rotation);
            let corners = if rot.abs() < 1e-10 {
                vec![
                    Point2D::new(origin.x, origin.y),
                    Point2D::new(origin.x + w, origin.y),
                    Point2D::new(origin.x + w, origin.y + h),
                    Point2D::new(origin.x, origin.y + h),
                ]
            } else {
                let cos = rot.cos();
                let sin = rot.sin();
                let cx = origin.x + w / 2.0;
                let cy = origin.y + h / 2.0;
                let raw = vec![
                    (origin.x, origin.y),
                    (origin.x + w, origin.y),
                    (origin.x + w, origin.y + h),
                    (origin.x, origin.y + h),
                ];
                raw.into_iter()
                    .map(|(px, py)| {
                        let dx = px - cx;
                        let dy = py - cy;
                        Point2D::new(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos)
                    })
                    .collect()
            };
            let mut compound = Vec::new();
            let mut created_ids = Vec::new();
            for i in 0..4 {
                let start = corners[i].clone();
                let end = corners[(i + 1) % 4].clone();
                let new_id = gen(next_id);
                let new_entity = Entity {
                    id: new_id.clone(),
                    geometry: GeometryType::Line { start, end },
                    layer_id: ent.layer_id.clone(),
                    style: ent.style.clone(),
                    draw_order: 0,
                };
                world.insert_entity(new_entity.clone());
                dirty_ids.insert(new_id.clone());
                compound.push(CadEvent::EntityCreated { entity: new_entity });
                created_ids.push(new_id);
            }
            if let Some(deleted) = world.remove_entity_returning(entity_id) {
                deleted_ids.push(entity_id.to_string());
                compound.push(CadEvent::EntityDeleted { entity: deleted });
            }
            event_store.push(CadEvent::CompoundEvent { events: compound });
            CommandResult {
                success: true,
                created_ids,
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
        _ => CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Cannot explode this entity type".into()),
            measurement: None,
            warnings: vec![],
        },
    }
}

pub(crate) fn extend_entity(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    id: &str,
    boundary_id: &str,
) -> CommandResult {
    let target = world.get_entity_cloned(id);
    let boundary = world.get_entity_cloned(boundary_id);
    let (target, boundary) = match (target, boundary) {
        (Some(t), Some(b)) => (t, b),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (ts, te) = match &target.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Extend requires a line".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (bs, be) = match &boundary.geometry {
        GeometryType::Line { start, end } => (start.clone(), end.clone()),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Boundary must be a line".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };
    let (ix, iy) =
        match line_line_intersect_infinite(ts.x, ts.y, te.x, te.y, bs.x, bs.y, be.x, be.y) {
            Some(p) => p,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Lines are parallel".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
    let ip = Point2D::new(ix, iy);
    let b_len = bs.distance_to(&be);
    let d1 = bs.distance_to(&ip);
    let d2 = be.distance_to(&ip);
    if d1 > b_len * 1.01 + 0.01 || d2 > b_len * 1.01 + 0.01 {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Intersection not on boundary".into()),
            measurement: None,
            warnings: vec![],
        };
    }
    let old_geom = target.geometry.clone();
    let start_closer = ts.distance_to(&ip) < te.distance_to(&ip);
    let new_geom = if start_closer {
        GeometryType::Line { start: ip, end: te }
    } else {
        GeometryType::Line { start: ts, end: ip }
    };
    world.set_geometry(id, new_geom.clone());
    dirty_ids.insert(id.to_string());
    event_store.push(CadEvent::EntityModified {
        id: id.to_string(),
        old_geometry: old_geom,
        new_geometry: new_geom,
    });
    CommandResult {
        success: true,
        created_ids: vec![],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn offset_entity_through(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    last_created_id: &mut Option<String>,
    next_id: &mut u64,
    id: &str,
    through_x: f64,
    through_y: f64,
) -> Result<String, String> {
    let entity = world
        .get_entity_cloned(id)
        .ok_or_else(|| format!("Entity '{}' not found", id))?;

    let distance = match &entity.geometry {
        GeometryType::Line { start, end } => {
            let dx = end.x - start.x;
            let dy = end.y - start.y;
            let len = (dx * dx + dy * dy).sqrt();
            if len < tolerance::ZERO_LENGTH {
                return Err("Cannot offset zero-length line".into());
            }
            let cross = (through_x - start.x) * dy - (through_y - start.y) * dx;
            cross / len
        }
        GeometryType::Circle { center, radius } => {
            let dx = through_x - center.x;
            let dy = through_y - center.y;
            let dist_to_center = (dx * dx + dy * dy).sqrt();
            dist_to_center - radius
        }
        GeometryType::Arc { center, radius, .. } => {
            let dx = through_x - center.x;
            let dy = through_y - center.y;
            let dist_to_center = (dx * dx + dy * dy).sqrt();
            dist_to_center - radius
        }
        GeometryType::Ellipse {
            center, semi_major, ..
        } => {
            let dx = through_x - center.x;
            let dy = through_y - center.y;
            let dist_to_center = (dx * dx + dy * dy).sqrt();
            dist_to_center - semi_major
        }
        GeometryType::Polyline { vertices, .. } => {
            if vertices.len() < 2 {
                return Err("Cannot offset polyline with fewer than 2 vertices".into());
            }
            let (seg_idx, _t) =
                nearest_polyline_param(vertices, &Point2D::new(through_x, through_y));
            let s = &vertices[seg_idx];
            let e = &vertices[seg_idx + 1];
            let dx = e.x - s.x;
            let dy = e.y - s.y;
            let len = (dx * dx + dy * dy).sqrt();
            if len < tolerance::ZERO_LENGTH {
                return Err("Cannot offset zero-length line".into());
            }
            let cross = (through_x - s.x) * dy - (through_y - s.y) * dx;
            cross / len
        }
        GeometryType::Rectangle {
            origin,
            width,
            height,
            rotation,
        } => {
            let cos_r = rotation.cos();
            let sin_r = rotation.sin();
            let cx = origin.x + (width / 2.0) * cos_r - (height / 2.0) * sin_r;
            let cy = origin.y + (width / 2.0) * sin_r + (height / 2.0) * cos_r;
            let dx = through_x - cx;
            let dy = through_y - cy;
            let dist_to_center = (dx * dx + dy * dy).sqrt();
            let half_diag = ((width / 2.0).powi(2) + (height / 2.0).powi(2)).sqrt();
            dist_to_center - half_diag
        }
        other => {
            return Err(format!(
                "Offset not supported for {:?}",
                std::mem::discriminant(other)
            ))
        }
    };

    offset_entity(
        world,
        event_store,
        dirty_ids,
        last_created_id,
        next_id,
        id,
        distance,
    )
}

pub(crate) fn fillet_polyline(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    next_id: &mut u64,
    id: &str,
    radius: f64,
) -> CommandResult {
    let entity = match world.get_entity_cloned(id) {
        Some(e) => e,
        None => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Entity not found".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };

    let (vertices, closed) = match &entity.geometry {
        GeometryType::Polyline { vertices, closed } => (vertices.clone(), *closed),
        _ => {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("FilletPolyline requires a polyline".into()),
                measurement: None,
                warnings: vec![],
            }
        }
    };

    if vertices.len() < 3 {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Polyline needs at least 3 vertices".into()),
            measurement: None,
            warnings: vec![],
        };
    }

    if radius.abs() < tolerance::ZERO_LENGTH {
        // Zero radius: no-op
        return CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        };
    }

    let corner_count = if closed {
        vertices.len()
    } else {
        vertices.len() - 2
    };
    let mut new_vertices: Vec<Point2D> = Vec::new();
    let mut arc_entities: Vec<Entity> = Vec::new();
    let mut compound_events: Vec<CadEvent> = Vec::new();

    // For each corner, compute the fillet
    if !closed {
        new_vertices.push(vertices[0].clone());
    }

    for ci in 0..corner_count {
        let (i_prev, i_curr, i_next) = if closed {
            let prev = if ci == 0 { vertices.len() - 1 } else { ci - 1 };
            let next = (ci + 1) % vertices.len();
            (prev, ci, next)
        } else {
            (ci, ci + 1, ci + 2)
        };

        let prev = &vertices[i_prev];
        let curr = &vertices[i_curr];
        let next = &vertices[i_next];

        // Direction vectors from corner to adjacent vertices
        let dir_a = (prev.x - curr.x, prev.y - curr.y);
        let dir_b = (next.x - curr.x, next.y - curr.y);
        let len_a = (dir_a.0 * dir_a.0 + dir_a.1 * dir_a.1).sqrt();
        let len_b = (dir_b.0 * dir_b.0 + dir_b.1 * dir_b.1).sqrt();

        if len_a < tolerance::ZERO_LENGTH || len_b < tolerance::ZERO_LENGTH {
            new_vertices.push(curr.clone());
            continue;
        }

        let ua = (dir_a.0 / len_a, dir_a.1 / len_a);
        let ub = (dir_b.0 / len_b, dir_b.1 / len_b);

        let dot = ua.0 * ub.0 + ua.1 * ub.1;
        let half_angle = dot.clamp(-1.0, 1.0).acos() / 2.0;

        if half_angle.abs() < tolerance::ZERO_LENGTH
            || (std::f64::consts::PI - half_angle * 2.0).abs() < tolerance::ZERO_LENGTH
        {
            // Nearly parallel or 180 degrees - skip fillet
            new_vertices.push(curr.clone());
            continue;
        }

        let trim_dist = radius / half_angle.tan();

        // Check if fillet fits within the available segment lengths
        if trim_dist > len_a || trim_dist > len_b {
            // Fillet too large, skip
            new_vertices.push(curr.clone());
            continue;
        }

        let ta = Point2D::new(curr.x + ua.0 * trim_dist, curr.y + ua.1 * trim_dist);
        let tb = Point2D::new(curr.x + ub.0 * trim_dist, curr.y + ub.1 * trim_dist);

        // Bisector direction for arc center
        let bis = (ua.0 + ub.0, ua.1 + ub.1);
        let bis_len = (bis.0 * bis.0 + bis.1 * bis.1).sqrt();
        if bis_len < tolerance::ZERO_LENGTH {
            new_vertices.push(curr.clone());
            continue;
        }
        let center_dist = radius / half_angle.sin();
        let bis_n = (bis.0 / bis_len, bis.1 / bis_len);
        let cx = curr.x + bis_n.0 * center_dist;
        let cy = curr.y + bis_n.1 * center_dist;

        let start_angle = (ta.y - cy).atan2(ta.x - cx);
        let end_angle = (tb.y - cy).atan2(tb.x - cx);

        // Add trim point on prev-side
        new_vertices.push(ta.clone());
        // Add trim point on next-side
        new_vertices.push(tb.clone());

        // Create arc entity
        let arc_id = format!("ent_{}", *next_id);
        *next_id += 1;
        let arc_entity = Entity {
            id: arc_id.clone(),
            geometry: GeometryType::Arc {
                center: Point2D::new(cx, cy),
                radius,
                start_angle,
                end_angle,
            },
            layer_id: entity.layer_id.clone(),
            style: EntityStyle::default(),
            draw_order: 0,
        };
        arc_entities.push(arc_entity);
    }

    if !closed {
        new_vertices.push(vertices[vertices.len() - 1].clone());
    }

    // Modify the polyline
    let old_geometry = entity.geometry.clone();
    let new_geometry = GeometryType::Polyline {
        vertices: new_vertices,
        closed,
    };

    compound_events.push(CadEvent::EntityModified {
        id: id.to_string(),
        old_geometry,
        new_geometry: new_geometry.clone(),
    });

    world.set_geometry(id, new_geometry);
    dirty_ids.insert(id.to_string());

    let mut created_ids = Vec::new();
    for arc in arc_entities {
        let aid = arc.id.clone();
        compound_events.push(CadEvent::EntityCreated {
            entity: arc.clone(),
        });
        world.insert_entity(arc);
        dirty_ids.insert(aid.clone());
        created_ids.push(aid);
    }

    event_store.push(CadEvent::CompoundEvent {
        events: compound_events,
    });

    CommandResult {
        success: true,
        created_ids,
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

pub(crate) fn join_entities(
    world: &mut NexusWorld,
    event_store: &mut EventStore,
    dirty_ids: &mut HashSet<String>,
    deleted_ids: &mut Vec<String>,
    next_id: &mut u64,
    ids: &[String],
) -> CommandResult {
    if ids.len() < 2 {
        return CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Need at least 2 entities".into()),
            measurement: None,
            warnings: vec![],
        };
    }
    let mut segments: Vec<(String, Vec<Point2D>)> = Vec::new();
    for id in ids {
        if let Some(ent) = world.get_entity_cloned(id.as_str()) {
            match &ent.geometry {
                GeometryType::Line { start, end } => {
                    segments.push((id.clone(), vec![start.clone(), end.clone()]))
                }
                GeometryType::Polyline { vertices, .. } => {
                    segments.push((id.clone(), vertices.clone()))
                }
                _ => {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Join requires lines/polylines".into()),
                        measurement: None,
                        warnings: vec![],
                    }
                }
            }
        }
    }
    let mut ordered: Vec<Point2D> = segments[0].1.clone();
    let mut used = vec![false; segments.len()];
    used[0] = true;
    let tol = 1e-6;
    loop {
        let mut found = false;
        for i in 0..segments.len() {
            if used[i] {
                continue;
            }
            let pts = &segments[i].1;
            let last = ordered.last().unwrap();
            let first = ordered.first().unwrap();
            if last.distance_to(&pts[0]) < tol {
                ordered.extend_from_slice(&pts[1..]);
                used[i] = true;
                found = true;
            } else if last.distance_to(pts.last().unwrap()) < tol {
                let mut rev = pts.clone();
                rev.reverse();
                ordered.extend_from_slice(&rev[1..]);
                used[i] = true;
                found = true;
            } else if first.distance_to(pts.last().unwrap()) < tol {
                let mut new_pts = pts.clone();
                new_pts.pop();
                new_pts.append(&mut ordered);
                ordered = new_pts;
                used[i] = true;
                found = true;
            } else if first.distance_to(&pts[0]) < tol {
                let mut rev = pts.clone();
                rev.reverse();
                rev.pop();
                rev.append(&mut ordered);
                ordered = rev;
                used[i] = true;
                found = true;
            }
            if found {
                break;
            }
        }
        if !found {
            break;
        }
    }
    let closed = ordered.len() >= 3
        && ordered
            .first()
            .unwrap()
            .distance_to(ordered.last().unwrap())
            < tol;
    if closed {
        ordered.pop();
    }

    let mut compound_events = Vec::new();
    let layer_id = world
        .get_entity_cloned(&ids[0])
        .map(|e| e.layer_id.clone())
        .unwrap_or("default".into());
    for id in ids {
        if let Some(ent) = world.remove_entity_returning(id.as_str()) {
            compound_events.push(CadEvent::EntityDeleted { entity: ent });
            deleted_ids.push(id.clone());
        }
    }
    let new_id = format!("ent_{}", *next_id);
    *next_id += 1;
    let new_entity = Entity {
        id: new_id.clone(),
        geometry: GeometryType::Polyline {
            vertices: ordered,
            closed,
        },
        layer_id,
        style: EntityStyle::default(),
        draw_order: 0,
    };
    compound_events.push(CadEvent::EntityCreated {
        entity: new_entity.clone(),
    });
    world.insert_entity(new_entity);
    dirty_ids.insert(new_id.clone());
    event_store.push(CadEvent::CompoundEvent {
        events: compound_events,
    });
    CommandResult {
        success: true,
        created_ids: vec![new_id],
        error: None,
        measurement: None,
        warnings: vec![],
    }
}

#[cfg(test)]
mod tests {
    use crate::Kernel;

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    fn entity_json(k: &Kernel, id: &str) -> serde_json::Value {
        let s = k.get_entity_json(id);
        serde_json::from_str(&s).unwrap()
    }

    // --- OffsetEntity ---

    #[test]
    fn offset_line_creates_parallel_copy() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":5}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 1);
    }

    #[test]
    fn offset_line_negative_distance() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":-3}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn offset_circle_increases_radius() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":3}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let new_radius = ej["geometry"]["Circle"]["radius"].as_f64().unwrap();
        assert!((new_radius - 8.0).abs() < 1e-9);
    }

    #[test]
    fn offset_circle_negative_collapses_to_zero_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        // offset by -10 would make radius -5, which should fail
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":-10}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn offset_polyline() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":2}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn offset_nonexistent_entity_fails() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_999","distance":5}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn offset_rotated_rectangle_45deg() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":8,"layer_id":"layer_0"}"#,
        );
        let angle_45 = std::f64::consts::FRAC_PI_4;
        let cmd = format!(
            r#"{{"type":"RotateEntity","id":"ent_1","cx":5,"cy":4,"angle":{}}}"#,
            angle_45
        );
        exec(&mut k, &cmd);
        let orig_ej = entity_json(&k, "ent_1");
        let orig_rect = &orig_ej["geometry"]["Rectangle"];
        let orig_ox = orig_rect["origin"]["x"].as_f64().unwrap();
        let orig_oy = orig_rect["origin"]["y"].as_f64().unwrap();
        let rot = orig_rect["rotation"].as_f64().unwrap();
        assert!((rot - angle_45).abs() < 0.01);

        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":2}"#,
        );
        assert_eq!(r["success"], true);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let rect = &ej["geometry"]["Rectangle"];
        let ox = rect["origin"]["x"].as_f64().unwrap();
        let oy = rect["origin"]["y"].as_f64().unwrap();

        let cos_r = rot.cos();
        let sin_r = rot.sin();
        let expected_ox = orig_ox + (-2.0) * cos_r - (-2.0) * sin_r;
        let expected_oy = orig_oy + (-2.0) * sin_r + (-2.0) * cos_r;
        assert!(
            (ox - expected_ox).abs() < 0.01,
            "Origin X: expected {}, got {}",
            expected_ox,
            ox
        );
        assert!(
            (oy - expected_oy).abs() < 0.01,
            "Origin Y: expected {}, got {}",
            expected_oy,
            oy
        );
        let new_w = rect["width"].as_f64().unwrap();
        let new_h = rect["height"].as_f64().unwrap();
        assert!((new_w - 14.0).abs() < 0.01);
        assert!((new_h - 12.0).abs() < 0.01);
    }

    #[test]
    fn offset_rotated_rectangle_90deg() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":8,"layer_id":"layer_0"}"#,
        );
        let angle_90 = std::f64::consts::FRAC_PI_2;
        let cmd = format!(
            r#"{{"type":"RotateEntity","id":"ent_1","cx":5,"cy":4,"angle":{}}}"#,
            angle_90
        );
        exec(&mut k, &cmd);
        let orig_ej = entity_json(&k, "ent_1");
        let orig_rect = &orig_ej["geometry"]["Rectangle"];
        let orig_ox = orig_rect["origin"]["x"].as_f64().unwrap();
        let orig_oy = orig_rect["origin"]["y"].as_f64().unwrap();

        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":2}"#,
        );
        assert_eq!(r["success"], true);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let rect = &ej["geometry"]["Rectangle"];
        let ox = rect["origin"]["x"].as_f64().unwrap();
        let oy = rect["origin"]["y"].as_f64().unwrap();

        let expected_ox = orig_ox + 2.0;
        let expected_oy = orig_oy + (-2.0);
        assert!(
            (ox - expected_ox).abs() < 0.01,
            "Origin X: expected {}, got {}",
            expected_ox,
            ox
        );
        assert!(
            (oy - expected_oy).abs() < 0.01,
            "Origin Y: expected {}, got {}",
            expected_oy,
            oy
        );
    }

    #[test]
    fn offset_negative_rotated_rectangle() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":8,"layer_id":"layer_0"}"#,
        );
        let angle_45 = std::f64::consts::FRAC_PI_4;
        let cmd = format!(
            r#"{{"type":"RotateEntity","id":"ent_1","cx":5,"cy":4,"angle":{}}}"#,
            angle_45
        );
        exec(&mut k, &cmd);

        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntity","id":"ent_1","distance":-2}"#,
        );
        assert_eq!(r["success"], true);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let rect = &ej["geometry"]["Rectangle"];
        let new_w = rect["width"].as_f64().unwrap();
        let new_h = rect["height"].as_f64().unwrap();
        assert!((new_w - 6.0).abs() < 0.01);
        assert!((new_h - 4.0).abs() < 0.01);
    }

    // --- TrimEntity ---

    #[test]
    fn trim_line_at_intersection() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":5,"y2":10,"layer_id":"layer_0"}"#,
        );
        // pick right side of horizontal line
        let r = exec(
            &mut k,
            r#"{"type":"TrimEntity","id":"ent_1","boundary_id":"ent_2","pick_x":8,"pick_y":5}"#,
        );
        assert_eq!(r["success"], true);
    }

    #[test]
    fn trim_line_left_side() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":5,"y2":10,"layer_id":"layer_0"}"#,
        );
        // pick left side
        let r = exec(
            &mut k,
            r#"{"type":"TrimEntity","id":"ent_1","boundary_id":"ent_2","pick_x":2,"pick_y":5}"#,
        );
        assert_eq!(r["success"], true);
    }

    #[test]
    fn trim_non_intersecting_lines_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"TrimEntity","id":"ent_1","boundary_id":"ent_2","pick_x":2,"pick_y":0}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- ExtendEntity ---

    #[test]
    fn extend_line_to_boundary() {
        let mut k = Kernel::new();
        // Short line that doesn't reach the boundary
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":3,"y2":0,"layer_id":"layer_0"}"#,
        );
        // Vertical boundary at x=5
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":-5,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ExtendEntity","id":"ent_1","boundary_id":"ent_2"}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_1");
        let ex = ej["geometry"]["Line"]["end"]["x"].as_f64().unwrap();
        assert!((ex - 5.0).abs() < 1e-9);
    }

    #[test]
    fn extend_parallel_lines_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":3,"x2":5,"y2":3,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"ExtendEntity","id":"ent_1","boundary_id":"ent_2"}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- Fillet ---

    #[test]
    fn fillet_two_lines_creates_arc() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":0,"y2":10,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Fillet","id_a":"ent_1","id_b":"ent_2","radius":2}"#,
        );
        assert_eq!(r["success"], true);
        // Arc should be created
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(k.entity_count(), 3); // 2 trimmed lines + 1 arc
    }

    #[test]
    fn fillet_radius_zero_sharp_corner() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":5,"y2":10,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Fillet","id_a":"ent_1","id_b":"ent_2","radius":0}"#,
        );
        assert_eq!(r["success"], true);
        // No arc created
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 0);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn fillet_parallel_lines_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Fillet","id_a":"ent_1","id_b":"ent_2","radius":2}"#,
        );
        assert_eq!(r["success"], false);
    }

    #[test]
    fn fillet_nonexistent_entity_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Fillet","id_a":"ent_1","id_b":"ent_999","radius":2}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- Chamfer ---

    #[test]
    fn chamfer_two_lines_creates_chamfer_line() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":0,"y2":10,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Chamfer","id_a":"ent_1","id_b":"ent_2","dist_a":2,"dist_b":3}"#,
        );
        assert_eq!(r["success"], true);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(k.entity_count(), 3); // 2 trimmed lines + 1 chamfer line
    }

    #[test]
    fn chamfer_parallel_lines_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Chamfer","id_a":"ent_1","id_b":"ent_2","dist_a":2,"dist_b":2}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- Explode ---

    #[test]
    fn explode_polyline_into_lines() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"Explode","entity_id":"ent_1"}"#);
        assert_eq!(r["success"], true);
        // 4 vertices open polyline = 3 segments
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 3);
        assert_eq!(k.entity_count(), 3);
    }

    #[test]
    fn explode_closed_polyline_into_lines() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":true,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"Explode","entity_id":"ent_1"}"#);
        assert_eq!(r["success"], true);
        // 4 vertices closed = 4 segments
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 4);
        assert_eq!(k.entity_count(), 4);
    }

    #[test]
    fn explode_rectangle_into_four_lines() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":5,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"Explode","entity_id":"ent_1"}"#);
        assert_eq!(r["success"], true);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 4);
    }

    #[test]
    fn explode_line_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"Explode","entity_id":"ent_1"}"#);
        assert_eq!(r["success"], false);
    }

    // --- MirrorEntity ---

    #[test]
    fn mirror_line_across_x_axis() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":3,"x2":5,"y2":3,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MirrorEntity","id":"ent_1","x1":0,"y1":0,"x2":10,"y2":0}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let sy = ej["geometry"]["Line"]["start"]["y"].as_f64().unwrap();
        assert!((sy - (-3.0)).abs() < 1e-9);
    }

    #[test]
    fn mirror_circle_across_y_axis() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":5,"cy":0,"radius":2,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MirrorEntity","id":"ent_1","x1":0,"y1":0,"x2":0,"y2":10}"#,
        );
        assert_eq!(r["success"], true);
        let new_id = r["created_ids"][0].as_str().unwrap().to_string();
        let ej = entity_json(&k, &new_id);
        let cx = ej["geometry"]["Circle"]["center"]["x"].as_f64().unwrap();
        assert!((cx - (-5.0)).abs() < 1e-9);
    }

    // --- LengthenEntity ---

    #[test]
    fn lengthen_delta_extends_end() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Lengthen","entity_id":"ent_1","mode":"delta","value":5,"end":"end"}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_1");
        let ex = ej["geometry"]["Line"]["end"]["x"].as_f64().unwrap();
        assert!((ex - 15.0).abs() < 1e-9);
    }

    #[test]
    fn lengthen_total_sets_length() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Lengthen","entity_id":"ent_1","mode":"total","value":20,"end":"end"}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_1");
        let ex = ej["geometry"]["Line"]["end"]["x"].as_f64().unwrap();
        assert!((ex - 20.0).abs() < 1e-9);
    }

    #[test]
    fn lengthen_percent_doubles_length() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Lengthen","entity_id":"ent_1","mode":"percent","value":200,"end":"end"}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_1");
        let ex = ej["geometry"]["Line"]["end"]["x"].as_f64().unwrap();
        assert!((ex - 20.0).abs() < 1e-9);
    }

    #[test]
    fn lengthen_delta_start_end() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Lengthen","entity_id":"ent_1","mode":"delta","value":5,"end":"start"}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_1");
        let sx = ej["geometry"]["Line"]["start"]["x"].as_f64().unwrap();
        assert!((sx - (-5.0)).abs() < 1e-9);
    }

    #[test]
    fn lengthen_invalid_mode_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Lengthen","entity_id":"ent_1","mode":"bogus","value":5,"end":"end"}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- BreakAtPoint ---

    #[test]
    fn break_at_point_splits_line_into_two() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"BreakAtPoint","entity_id":"ent_1","px":5,"py":0}"#,
        );
        assert_eq!(r["success"], true);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 2);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn break_at_point_on_arc() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":5,"start_angle":0,"end_angle":3.14159,"layer_id":"layer_0"}"#,
        );
        // break point on the arc at angle ~1.0 rad
        let px = 5.0_f64 * 1.0_f64.cos();
        let py = 5.0_f64 * 1.0_f64.sin();
        let cmd = format!(
            r#"{{"type":"BreakAtPoint","entity_id":"ent_1","px":{},"py":{}}}"#,
            px, py
        );
        let r = exec(&mut k, &cmd);
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn break_at_point_nonexistent_fails() {
        let mut k = Kernel::new();
        let r = exec(
            &mut k,
            r#"{"type":"BreakAtPoint","entity_id":"ent_999","px":5,"py":0}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- Break (two points) ---

    #[test]
    fn break_two_points_removes_middle_segment() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"Break","entity_id":"ent_1","x1":3,"y1":0,"x2":7,"y2":0}"#,
        );
        assert_eq!(r["success"], true);
        // two segments remain
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 2);
    }

    // --- JoinEntities ---

    #[test]
    fn join_two_collinear_lines() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"JoinEntities","ids":["ent_1","ent_2"]}"#);
        assert_eq!(r["success"], true);
        let ids = r["created_ids"].as_array().unwrap();
        assert_eq!(ids.len(), 1);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn join_three_connected_lines() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":10,"y1":0,"x2":15,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"JoinEntities","ids":["ent_1","ent_2","ent_3"]}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn join_single_entity_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(&mut k, r#"{"type":"JoinEntities","ids":["ent_1"]}"#);
        assert_eq!(r["success"], false);
    }

    // --- MatchProperties ---

    #[test]
    fn match_properties_copies_color() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":5,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r##"{"type":"SetEntityColor","id":"ent_1","color":"#ff0000"}"##,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MatchProperties","source_id":"ent_1","target_ids":["ent_2"]}"#,
        );
        assert_eq!(r["success"], true);
        let ej = entity_json(&k, "ent_2");
        let color = ej["style"]["color"].as_str().unwrap_or("");
        assert_eq!(color, "#ff0000");
    }

    #[test]
    fn match_properties_nonexistent_source_fails() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":5,"y2":0,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"MatchProperties","source_id":"ent_999","target_ids":["ent_1"]}"#,
        );
        assert_eq!(r["success"], false);
    }

    // --- FilletPolyline ---

    #[test]
    fn fillet_polyline_with_radius() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        let r = exec(
            &mut k,
            r#"{"type":"FilletPolyline","id":"ent_1","radius":2}"#,
        );
        assert_eq!(r["success"], true);
        // At least one arc should be created
        let ids = r["created_ids"].as_array().unwrap();
        assert!(!ids.is_empty());
    }

    // --- OffsetEntityThrough ---

    #[test]
    fn offset_through_point_creates_copy() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        // through point 3 units above
        let r = exec(
            &mut k,
            r#"{"type":"OffsetEntityThrough","id":"ent_1","through_x":5,"through_y":3}"#,
        );
        assert_eq!(r["success"], true);
        assert_eq!(k.entity_count(), 2);
    }
}
