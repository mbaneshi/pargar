use crate::commands::CommandResult;
use crate::drawing;
use crate::entity;
use crate::entity::{Entity, GeometryType};
use crate::geometry_intersections;
use crate::tolerance;
use crate::Kernel;

#[cfg(not(target_arch = "wasm32"))]
use tracing::instrument;

/// Stamp the kernel's current_dim_style onto a newly-constructed dimension entity.
/// Called from every dimension-create path so newly created dimensions inherit
/// the active style (matches AutoCAD's "current DIMSTYLE on insert" behavior).
fn apply_current_dim_style(entity: &mut Entity, current: &str) {
    let style = Some(current.to_string());
    match &mut entity.geometry {
        GeometryType::Dimension { style_name, .. }
        | GeometryType::AlignedDimension { style_name, .. }
        | GeometryType::AngularDimension { style_name, .. }
        | GeometryType::RadialDimension { style_name, .. }
        | GeometryType::DiameterDimension { style_name, .. } => {
            *style_name = style;
        }
        _ => {}
    }
}

/// Stamp the kernel's current_mleader_style onto a newly-constructed leader entity.
fn apply_current_mleader_style(entity: &mut Entity, current: &str) {
    if let GeometryType::Leader { style_name, .. } = &mut entity.geometry {
        *style_name = Some(current.to_string());
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen)]
impl Kernel {
    pub fn create_point(&mut self, x: f64, y: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = drawing::new_point(id, x, y, layer_id);
        self.add_entity(entity)
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn create_line(&mut self, x1: f64, y1: f64, x2: f64, y2: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = drawing::new_line(id, x1, y1, x2, y2, layer_id);
        self.add_entity(entity)
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn create_circle(&mut self, cx: f64, cy: f64, radius: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = drawing::new_circle(id, cx, cy, radius, layer_id);
        self.add_entity(entity)
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn create_arc(
        &mut self,
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_arc(id, cx, cy, radius, start_angle, end_angle, layer_id);
        self.add_entity(entity)
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn create_rectangle(
        &mut self,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_rectangle(id, x, y, width, height, layer_id);
        self.add_entity(entity)
    }

    pub fn create_polyline(&mut self, coords_json: &str, closed: bool, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = drawing::new_polyline(id, coords_json, closed, layer_id);
        self.add_entity(entity)
    }

    pub fn create_revision_cloud(
        &mut self,
        coords_json: &str,
        arc_length: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
        let boundary: Vec<entity::Point2D> = coords
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| entity::Point2D::new(c[0], c[1]))
            .collect();
        let entity = drawing::new_revision_cloud(id, boundary, arc_length, layer_id);
        self.add_entity(entity)
    }

    pub fn create_text(
        &mut self,
        x: f64,
        y: f64,
        content: &str,
        height: f64,
        rotation: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_text(id, x, y, content, height, rotation, layer_id);
        self.add_entity(entity)
    }

    pub fn create_dimension(
        &mut self,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        offset: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let mut entity = drawing::new_dimension(id, x1, y1, x2, y2, offset, layer_id);
        apply_current_dim_style(&mut entity, &self.current_dim_style);
        self.add_entity(entity)
    }

    pub fn create_ellipse(
        &mut self,
        cx: f64,
        cy: f64,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_ellipse(id, cx, cy, semi_major, semi_minor, rotation, layer_id);
        self.add_entity(entity)
    }

    pub fn create_spline(
        &mut self,
        control_points_json: &str,
        degree: u8,
        closed: bool,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_spline(id, control_points_json, degree, closed, layer_id);
        self.add_entity(entity)
    }

    pub fn create_construction_line(
        &mut self,
        ox: f64,
        oy: f64,
        dx: f64,
        dy: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let entity = drawing::new_construction_line(id, ox, oy, dx, dy, layer_id);
        self.add_entity(entity)
    }

    pub fn create_aligned_dimension(
        &mut self,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        offset: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let mut entity = drawing::new_aligned_dimension(id, x1, y1, x2, y2, offset, layer_id);
        apply_current_dim_style(&mut entity, &self.current_dim_style);
        self.add_entity(entity)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_angular_dimension(
        &mut self,
        cx: f64,
        cy: f64,
        sx: f64,
        sy: f64,
        ex: f64,
        ey: f64,
        radius: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let mut entity =
            drawing::new_angular_dimension(id, cx, cy, sx, sy, ex, ey, radius, layer_id);
        apply_current_dim_style(&mut entity, &self.current_dim_style);
        self.add_entity(entity)
    }

    pub fn create_radial_dimension(
        &mut self,
        cx: f64,
        cy: f64,
        px: f64,
        py: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let mut entity = drawing::new_radial_dimension(id, cx, cy, px, py, layer_id);
        apply_current_dim_style(&mut entity, &self.current_dim_style);
        self.add_entity(entity)
    }

    pub fn create_diameter_dimension(
        &mut self,
        cx: f64,
        cy: f64,
        px: f64,
        py: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let mut entity = drawing::new_diameter_dimension(id, cx, cy, px, py, layer_id);
        apply_current_dim_style(&mut entity, &self.current_dim_style);
        self.add_entity(entity)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_polygon(
        &mut self,
        cx: f64,
        cy: f64,
        radius: f64,
        sides: u32,
        inscribed: bool,
        rotation: f64,
        layer_id: &str,
    ) -> CommandResult {
        use std::f64::consts::PI;
        if sides < 3 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Polygon requires at least 3 sides".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let r = if inscribed {
            radius
        } else {
            // circumscribed: radius is apothem, convert to circumradius
            radius / (PI / sides as f64).cos()
        };
        let vertices: Vec<(f64, f64)> = (0..sides)
            .map(|i| {
                let angle = rotation + 2.0 * PI * i as f64 / sides as f64;
                (cx + r * angle.cos(), cy + r * angle.sin())
            })
            .collect();
        let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
        let json = serde_json::to_string(&coords).unwrap_or_default();
        let id = self.create_polyline(&json, true, layer_id);
        CommandResult {
            success: true,
            created_ids: vec![id],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn create_ray(&mut self, ox: f64, oy: f64, dx: f64, dy: f64, layer_id: &str) -> String {
        let id = self.gen_id();
        let entity = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::Ray {
                origin: entity::Point2D::new(ox, oy),
                direction: entity::Point2D::new(dx, dy),
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        self.add_entity(entity)
    }

    pub fn create_donut(
        &mut self,
        cx: f64,
        cy: f64,
        inner_radius: f64,
        outer_radius: f64,
        layer_id: &str,
    ) -> CommandResult {
        if inner_radius < 0.0 || outer_radius <= 0.0 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Donut requires positive radii".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        // AutoCAD donuts are wide polylines. We approximate with two concentric circles
        // as closed polylines (outer CW, inner CCW). For v0.1, create as two circles.
        let mut created = vec![];
        let outer_id = self.create_circle(cx, cy, outer_radius, layer_id);
        created.push(outer_id);
        if inner_radius > 0.0 {
            let inner_id = self.create_circle(cx, cy, inner_radius, layer_id);
            created.push(inner_id);
        }
        CommandResult {
            success: true,
            created_ids: created,
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn set_draw_order(&mut self, id: &str, order: i32) -> CommandResult {
        if self.ecs_world.set_draw_order(id, order) {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Entity not found: {id}")),
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn adjust_draw_order(&mut self, id: &str, delta: i32) -> CommandResult {
        let current = self.ecs_world.get_draw_order(id);
        let new_order = current.saturating_add(delta);
        if self.ecs_world.set_draw_order(id, new_order) {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Entity not found: {id}")),
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn create_leader(
        &mut self,
        coords_json: &str,
        text: &str,
        arrow_size: f64,
        text_height: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
        let pts: Vec<entity::Point2D> = coords
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| entity::Point2D::new(c[0], c[1]))
            .collect();
        let mut ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::Leader {
                vertices: pts,
                text: text.to_string(),
                arrow_size,
                text_height,
                style_name: None,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        apply_current_mleader_style(&mut ent, &self.current_mleader_style);
        self.add_entity(ent)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_ellipse_arc(
        &mut self,
        cx: f64,
        cy: f64,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
        start_angle: f64,
        end_angle: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::EllipseArc {
                center: entity::Point2D::new(cx, cy),
                semi_major,
                semi_minor,
                rotation,
                start_angle,
                end_angle,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        self.add_entity(ent)
    }

    pub fn create_mline(
        &mut self,
        coords_json: &str,
        offsets_json: &str,
        layer_id: &str,
    ) -> CommandResult {
        let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
        let offsets: Vec<f64> = serde_json::from_str(offsets_json).unwrap_or_default();
        let pts: Vec<entity::Point2D> = coords
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| entity::Point2D::new(c[0], c[1]))
            .collect();
        if pts.len() < 2 || offsets.is_empty() {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Need at least 2 points and 1 offset".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let mut created = vec![];
        for &offset in &offsets {
            let mut offset_pts: Vec<(f64, f64)> = Vec::new();
            for i in 0..pts.len() {
                let (dx, dy) = if i + 1 < pts.len() {
                    let seg_dx = pts[i + 1].x - pts[i].x;
                    let seg_dy = pts[i + 1].y - pts[i].y;
                    let len = (seg_dx * seg_dx + seg_dy * seg_dy).sqrt();
                    if len > 1e-12 {
                        (-seg_dy / len * offset, seg_dx / len * offset)
                    } else {
                        (0.0, 0.0)
                    }
                } else {
                    let seg_dx = pts[i].x - pts[i - 1].x;
                    let seg_dy = pts[i].y - pts[i - 1].y;
                    let len = (seg_dx * seg_dx + seg_dy * seg_dy).sqrt();
                    if len > 1e-12 {
                        (-seg_dy / len * offset, seg_dx / len * offset)
                    } else {
                        (0.0, 0.0)
                    }
                };
                offset_pts.push((pts[i].x + dx, pts[i].y + dy));
            }
            let line_coords: Vec<f64> = offset_pts.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
            let json = serde_json::to_string(&line_coords).unwrap_or_default();
            let id = self.create_polyline(&json, false, layer_id);
            created.push(id);
        }
        CommandResult {
            success: true,
            created_ids: created,
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn create_wipeout(&mut self, coords_json: &str, layer_id: &str) -> String {
        let id = self.gen_id();
        let coords: Vec<f64> = serde_json::from_str(coords_json).unwrap_or_default();
        let vertices: Vec<entity::Point2D> = coords
            .chunks(2)
            .filter(|c| c.len() == 2)
            .map(|c| entity::Point2D::new(c[0], c[1]))
            .collect();
        let ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::Wipeout { vertices },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: i32::MAX - 1,
        };
        self.add_entity(ent)
    }

    pub fn overkill(&mut self, ids_json: &str, tolerance: f64) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        let mut removed = 0u32;
        let entities: Vec<entity::Entity> = ids
            .iter()
            .filter_map(|id| self.ecs_world.get_entity_cloned(id))
            .collect();
        let mut to_delete: Vec<String> = Vec::new();
        for i in 0..entities.len() {
            if to_delete.contains(&entities[i].id) {
                continue;
            }
            for j in (i + 1)..entities.len() {
                if to_delete.contains(&entities[j].id) {
                    continue;
                }
                if Self::geometries_overlap(&entities[i].geometry, &entities[j].geometry, tolerance)
                {
                    to_delete.push(entities[j].id.clone());
                    removed += 1;
                }
            }
        }
        for id in &to_delete {
            self.delete_entity(id);
        }
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![format!("Removed {removed} overlapping entities")],
        }
    }

    fn geometries_overlap(a: &entity::GeometryType, b: &entity::GeometryType, tol: f64) -> bool {
        match (a, b) {
            (
                entity::GeometryType::Line { start: s1, end: e1 },
                entity::GeometryType::Line { start: s2, end: e2 },
            ) => {
                (s1.distance_to(s2) < tol && e1.distance_to(e2) < tol)
                    || (s1.distance_to(e2) < tol && e1.distance_to(s2) < tol)
            }
            (
                entity::GeometryType::Circle {
                    center: c1,
                    radius: r1,
                },
                entity::GeometryType::Circle {
                    center: c2,
                    radius: r2,
                },
            ) => c1.distance_to(c2) < tol && (r1 - r2).abs() < tol,
            (
                entity::GeometryType::Point { position: p1 },
                entity::GeometryType::Point { position: p2 },
            ) => p1.distance_to(p2) < tol,
            _ => false,
        }
    }

    pub fn set_ltscale(&mut self, scale: f64) -> CommandResult {
        self.ltscale = scale;
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: Some(scale),
            warnings: vec![],
        }
    }

    pub fn get_ltscale(&self) -> CommandResult {
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: Some(self.ltscale),
            warnings: vec![],
        }
    }

    pub fn create_ordinate_dimension(
        &mut self,
        feature_x: f64,
        feature_y: f64,
        leader_end_x: f64,
        leader_end_y: f64,
        use_x_datum: bool,
        layer_id: &str,
    ) -> String {
        let value = if use_x_datum { feature_x } else { feature_y };
        let id = self.gen_id();
        let mut ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::Dimension {
                start: entity::Point2D::new(feature_x, feature_y),
                end: entity::Point2D::new(leader_end_x, leader_end_y),
                offset: 0.0,
                text_override: Some(format!("{value:.4}")),
                style_name: None,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        apply_current_dim_style(&mut ent, &self.current_dim_style);
        self.add_entity(ent)
    }

    pub fn mass_properties(&self, entity_id: &str) -> CommandResult {
        let entity = match self.ecs_world.get_entity_cloned(entity_id) {
            Some(e) => e,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Entity not found: {entity_id}")),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
        let (area, cx, cy) = match &entity.geometry {
            entity::GeometryType::Circle { center, radius } => {
                let a = std::f64::consts::PI * radius * radius;
                (a, center.x, center.y)
            }
            entity::GeometryType::Rectangle {
                origin,
                width,
                height,
                ..
            } => {
                let a = width * height;
                (a, origin.x + width / 2.0, origin.y + height / 2.0)
            }
            entity::GeometryType::Polyline {
                vertices, closed, ..
            } if *closed && vertices.len() >= 3 => {
                let n = vertices.len();
                let mut area = 0.0_f64;
                let mut cx_sum = 0.0_f64;
                let mut cy_sum = 0.0_f64;
                for i in 0..n {
                    let j = (i + 1) % n;
                    let cross = vertices[i].x * vertices[j].y - vertices[j].x * vertices[i].y;
                    area += cross;
                    cx_sum += (vertices[i].x + vertices[j].x) * cross;
                    cy_sum += (vertices[i].y + vertices[j].y) * cross;
                }
                area /= 2.0;
                let a = area.abs();
                if a > 1e-12 {
                    (a, cx_sum / (6.0 * area), cy_sum / (6.0 * area))
                } else {
                    (0.0, 0.0, 0.0)
                }
            }
            _ => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Entity has no area (not a closed shape)".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: Some(area),
            warnings: vec![format!("Area = {area:.6}, Centroid = ({cx:.6}, {cy:.6})")],
        }
    }

    pub fn create_tolerance(
        &mut self,
        x: f64,
        y: f64,
        content: &str,
        height: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::Tolerance {
                position: entity::Point2D::new(x, y),
                content: content.to_string(),
                height,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        self.add_entity(ent)
    }

    pub fn write_block(&self, block_name: &str, file_path: &str) -> CommandResult {
        let block = self.block_defs.iter().find(|b| b.name == block_name);
        match block {
            Some(b) => {
                let json = serde_json::to_string(b).unwrap_or_default();
                match std::fs::write(file_path, &json) {
                    Ok(_) => CommandResult {
                        success: true,
                        created_ids: vec![],
                        error: None,
                        measurement: None,
                        warnings: vec![format!("Wrote block to {file_path}")],
                    },
                    Err(e) => CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some(format!("Write failed: {e}")),
                        measurement: None,
                        warnings: vec![],
                    },
                }
            }
            None => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Block not found: {block_name}")),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_attdef(
        &mut self,
        x: f64,
        y: f64,
        tag: &str,
        prompt: &str,
        default_value: &str,
        height: f64,
        layer_id: &str,
    ) -> String {
        let id = self.gen_id();
        let ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::AttDef {
                position: entity::Point2D::new(x, y),
                tag: tag.to_string(),
                prompt: prompt.to_string(),
                default_value: default_value.to_string(),
                height,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        self.add_entity(ent)
    }

    pub fn attach_xref(
        &mut self,
        _file_path: &str,
        x: f64,
        y: f64,
        scale: f64,
        layer_id: &str,
    ) -> CommandResult {
        // XREF: Create a block reference placeholder. Full file linking deferred to file system integration.
        let id = self.gen_id();
        let ent = entity::Entity {
            id: id.clone(),
            geometry: entity::GeometryType::BlockRef {
                block_id: format!("xref:{_file_path}"),
                insertion: entity::Point2D::new(x, y),
                rotation: 0.0,
                scale_x: scale,
                scale_y: scale,
            },
            layer_id: layer_id.to_string(),
            style: entity::EntityStyle::default(),
            draw_order: 0,
        };
        self.add_entity(ent);
        CommandResult {
            success: true,
            created_ids: vec![id],
            error: None,
            measurement: None,
            warnings: vec!["XREF attached as block reference (file linking pending)".to_string()],
        }
    }

    pub fn bedit_enter(&mut self, block_id: &str) -> CommandResult {
        if self.block_defs.iter().any(|b| b.id == block_id) {
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![format!("Entered block editor for {block_id}")],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Block not found: {block_id}")),
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn bedit_exit(&self) -> CommandResult {
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec!["Exited block editor".into()],
        }
    }

    pub fn plot_to_pdf(
        &self,
        file_path: &str,
        _paper_width: f64,
        _paper_height: f64,
        _scale: f64,
    ) -> CommandResult {
        // Kernel exports drawing data as JSON. Actual PDF rendering is handled by @nexus/file-io in TypeScript.
        let entities_json = self.ecs_world.to_entities_json();
        let layers_json = crate::layers::get_layers_json(&self.layers);
        let data = format!("{{\"entities\":{entities_json},\"layers\":{layers_json},\"paper_width\":{_paper_width},\"paper_height\":{_paper_height},\"scale\":{_scale}}}");
        match std::fs::write(file_path, &data) {
            Ok(_) => CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![format!(
                    "Plot data saved to {file_path} (use file-io for PDF conversion)"
                )],
            },
            Err(e) => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Write failed: {e}")),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub fn save_drawing(&self, file_path: &str) -> CommandResult {
        let entities_json = self.ecs_world.to_entities_json();
        let layers_json = crate::layers::get_layers_json(&self.layers);
        let data = format!("{{\"entities\":{entities_json},\"layers\":{layers_json}}}");
        match std::fs::write(file_path, &data) {
            Ok(_) => CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![format!("Saved to {file_path}")],
            },
            Err(e) => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Save failed: {e}")),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub fn open_drawing(&mut self, file_path: &str) -> CommandResult {
        match std::fs::read_to_string(file_path) {
            Ok(data) => {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                    if let Some(entities) = parsed.get("entities") {
                        let entities_str = entities.to_string();
                        if let Err(e) = self.ecs_world.from_entities_json(&entities_str) {
                            return CommandResult {
                                success: false,
                                created_ids: vec![],
                                error: Some(e),
                                measurement: None,
                                warnings: vec![],
                            };
                        }
                    }
                    let count = self.ecs_world.entity_count();
                    CommandResult {
                        success: true,
                        created_ids: vec![],
                        error: None,
                        measurement: Some(count as f64),
                        warnings: vec![format!("Loaded {count} entities from {file_path}")],
                    }
                } else {
                    CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Invalid JSON".into()),
                        measurement: None,
                        warnings: vec![],
                    }
                }
            }
            Err(e) => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Open failed: {e}")),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub fn create_region(&mut self, ids_json: &str, layer_id: &str) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        let mut all_vertices: Vec<(f64, f64)> = Vec::new();

        for id in &ids {
            if let Some(e) = self.ecs_world.get_entity_cloned(id) {
                let pts: Vec<(f64, f64)> = match &e.geometry {
                    entity::GeometryType::Circle { center, radius } => {
                        let n = 36;
                        (0..n)
                            .map(|i| {
                                let a = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
                                (center.x + radius * a.cos(), center.y + radius * a.sin())
                            })
                            .collect()
                    }
                    entity::GeometryType::Rectangle {
                        origin,
                        width,
                        height,
                        ..
                    } => vec![
                        (origin.x, origin.y),
                        (origin.x + width, origin.y),
                        (origin.x + width, origin.y + height),
                        (origin.x, origin.y + height),
                    ],
                    entity::GeometryType::Polyline {
                        vertices, closed, ..
                    } if *closed => vertices.iter().map(|v| (v.x, v.y)).collect(),
                    _ => continue,
                };
                all_vertices.extend(pts);
            }
        }

        if all_vertices.is_empty() {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("No valid closed boundaries found".into()),
                measurement: None,
                warnings: vec![],
            };
        }

        let coords: Vec<f64> = all_vertices
            .iter()
            .flat_map(|(x, y)| vec![*x, *y])
            .collect();
        let json = serde_json::to_string(&coords).unwrap_or_default();
        let new_id = self.create_polyline(&json, true, layer_id);
        CommandResult {
            success: true,
            created_ids: vec![new_id],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::collapsible_if, clippy::collapsible_match)]
    pub fn detect_boundary(&mut self, x: f64, y: f64, layer_id: &str) -> CommandResult {
        // Simplified boundary detection: find the smallest closed entity containing the point.
        // Full boundary detection (walking intersecting edges) is deferred to a future release.
        let entities = self.ecs_world.cache_values_cloned();
        let pt = entity::Point2D::new(x, y);

        let mut best_id: Option<String> = None;
        let mut best_area = f64::MAX;

        for e in &entities {
            match &e.geometry {
                entity::GeometryType::Circle { center, radius } => {
                    let dist = center.distance_to(&pt);
                    if dist <= *radius {
                        let area = std::f64::consts::PI * radius * radius;
                        if area < best_area {
                            best_area = area;
                            best_id = Some(e.id.clone());
                        }
                    }
                }
                entity::GeometryType::Rectangle {
                    origin,
                    width,
                    height,
                    ..
                } => {
                    if x >= origin.x
                        && x <= origin.x + width
                        && y >= origin.y
                        && y <= origin.y + height
                    {
                        let area = width * height;
                        if area < best_area {
                            best_area = area;
                            best_id = Some(e.id.clone());
                        }
                    }
                }
                entity::GeometryType::Polyline {
                    vertices, closed, ..
                } if *closed && vertices.len() >= 3 => {
                    // Point-in-polygon test (ray casting)
                    let mut inside = false;
                    let n = vertices.len();
                    let mut j = n - 1;
                    for i in 0..n {
                        let vi = &vertices[i];
                        let vj = &vertices[j];
                        if ((vi.y > y) != (vj.y > y))
                            && (x < (vj.x - vi.x) * (y - vi.y) / (vj.y - vi.y) + vi.x)
                        {
                            inside = !inside;
                        }
                        j = i;
                    }
                    if inside {
                        // Approximate area using shoelace formula
                        let mut area = 0.0_f64;
                        let mut j2 = n - 1;
                        for i2 in 0..n {
                            area += (vertices[j2].x + vertices[i2].x)
                                * (vertices[j2].y - vertices[i2].y);
                            j2 = i2;
                        }
                        let area = area.abs() / 2.0;
                        if area < best_area {
                            best_area = area;
                            best_id = Some(e.id.clone());
                        }
                    }
                }
                _ => {}
            }
        }

        match best_id {
            Some(id) => {
                // Create a new polyline boundary from the found entity
                let boundary_entity = self.ecs_world.get_entity_cloned(&id);
                let vertices: Vec<(f64, f64)> = match boundary_entity.as_ref().map(|e| &e.geometry)
                {
                    Some(entity::GeometryType::Circle { center, radius }) => {
                        let n = 36;
                        (0..n)
                            .map(|i| {
                                let a = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
                                (center.x + radius * a.cos(), center.y + radius * a.sin())
                            })
                            .collect()
                    }
                    Some(entity::GeometryType::Rectangle {
                        origin,
                        width,
                        height,
                        ..
                    }) => {
                        vec![
                            (origin.x, origin.y),
                            (origin.x + width, origin.y),
                            (origin.x + width, origin.y + height),
                            (origin.x, origin.y + height),
                        ]
                    }
                    Some(entity::GeometryType::Polyline { vertices, .. }) => {
                        vertices.iter().map(|v| (v.x, v.y)).collect()
                    }
                    _ => vec![],
                };

                if vertices.is_empty() {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Could not extract boundary vertices".into()),
                        measurement: None,
                        warnings: vec![],
                    };
                }

                let coords: Vec<f64> = vertices.iter().flat_map(|(x, y)| vec![*x, *y]).collect();
                let json = serde_json::to_string(&coords).unwrap_or_default();
                let new_id = self.create_polyline(&json, true, layer_id);
                CommandResult {
                    success: true,
                    created_ids: vec![new_id],
                    error: None,
                    measurement: Some(best_area),
                    warnings: vec![format!("Boundary detected from entity {id}")],
                }
            }
            None => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("No closed boundary found at the specified point".into()),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub fn auto_constrain(&mut self, ids_json: &str, tolerance: f64) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        let mut applied = 0u32;
        let tol = if tolerance > 0.0 { tolerance } else { 1.0 };

        // Collect line entities for analysis
        let mut lines: Vec<(String, entity::Point2D, entity::Point2D)> = Vec::new();
        for id in &ids {
            if let Some(e) = self.ecs_world.get_entity_cloned(id) {
                if let entity::GeometryType::Line { start, end } = &e.geometry {
                    lines.push((id.clone(), start.clone(), end.clone()));
                }
            }
        }

        use crate::constraints::ConstraintType;

        // Detect near-horizontal lines
        for (id, start, end) in &lines {
            let dy = (end.y - start.y).abs();
            let dx = (end.x - start.x).abs();
            if dx > tol && dy < tol && dy > 1e-12 {
                self.constraint_solver
                    .add_constraint(ConstraintType::Horizontal {
                        entity_id: id.clone(),
                    });
                applied += 1;
            }
        }

        // Detect near-vertical lines
        for (id, start, end) in &lines {
            let dy = (end.y - start.y).abs();
            let dx = (end.x - start.x).abs();
            if dy > tol && dx < tol && dx > 1e-12 {
                self.constraint_solver
                    .add_constraint(ConstraintType::Vertical {
                        entity_id: id.clone(),
                    });
                applied += 1;
            }
        }

        // Detect coincident endpoints
        for i in 0..lines.len() {
            for j in (i + 1)..lines.len() {
                let pts_i = [&lines[i].1, &lines[i].2];
                let pts_j = [&lines[j].1, &lines[j].2];
                for (pi_idx, pi) in pts_i.iter().enumerate() {
                    for (pj_idx, pj) in pts_j.iter().enumerate() {
                        let dist = pi.distance_to(pj);
                        if dist < tol && dist > 1e-12 {
                            self.constraint_solver
                                .add_constraint(ConstraintType::Coincident {
                                    entity_a: lines[i].0.clone(),
                                    point_a: pi_idx,
                                    entity_b: lines[j].0.clone(),
                                    point_b: pj_idx,
                                });
                            applied += 1;
                        }
                    }
                }
            }
        }

        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: Some(applied as f64),
            warnings: vec![format!("Applied {applied} constraints")],
        }
    }

    #[allow(
        clippy::too_many_arguments,
        clippy::collapsible_match,
        clippy::collapsible_if
    )]
    pub fn stretch_entities(
        &mut self,
        ids_json: &str,
        wx1: f64,
        wy1: f64,
        wx2: f64,
        wy2: f64,
        dx: f64,
        dy: f64,
    ) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        let min_x = wx1.min(wx2);
        let max_x = wx1.max(wx2);
        let min_y = wy1.min(wy2);
        let max_y = wy1.max(wy2);

        let point_inside = |p: &entity::Point2D| -> bool {
            p.x >= min_x && p.x <= max_x && p.y >= min_y && p.y <= max_y
        };

        for id in &ids {
            self.ecs_world.modify_entity_geometry(id, |geo| match geo {
                entity::GeometryType::Line { start, end } => {
                    if point_inside(start) {
                        start.x += dx;
                        start.y += dy;
                    }
                    if point_inside(end) {
                        end.x += dx;
                        end.y += dy;
                    }
                }
                entity::GeometryType::Polyline { vertices, .. } => {
                    for v in vertices.iter_mut() {
                        if point_inside(v) {
                            v.x += dx;
                            v.y += dy;
                        }
                    }
                }
                entity::GeometryType::Circle { center, .. }
                | entity::GeometryType::Arc { center, .. }
                | entity::GeometryType::Ellipse { center, .. } => {
                    if point_inside(center) {
                        center.x += dx;
                        center.y += dy;
                    }
                }
                entity::GeometryType::Rectangle { origin, .. } => {
                    if point_inside(origin) {
                        origin.x += dx;
                        origin.y += dy;
                    }
                }
                entity::GeometryType::Text { position, .. }
                | entity::GeometryType::MText { position, .. }
                | entity::GeometryType::Table { position, .. } => {
                    if point_inside(position) {
                        position.x += dx;
                        position.y += dy;
                    }
                }
                entity::GeometryType::Spline { control_points, .. } => {
                    for cp in control_points.iter_mut() {
                        if point_inside(cp) {
                            cp.x += dx;
                            cp.y += dy;
                        }
                    }
                }
                entity::GeometryType::Point { position } => {
                    if point_inside(position) {
                        position.x += dx;
                        position.y += dy;
                    }
                }
                entity::GeometryType::ConstructionLine { origin, .. }
                | entity::GeometryType::Ray { origin, .. } => {
                    if point_inside(origin) {
                        origin.x += dx;
                        origin.y += dy;
                    }
                }
                entity::GeometryType::Dimension { start, end, .. }
                | entity::GeometryType::AlignedDimension { start, end, .. } => {
                    if point_inside(start) {
                        start.x += dx;
                        start.y += dy;
                    }
                    if point_inside(end) {
                        end.x += dx;
                        end.y += dy;
                    }
                }
                entity::GeometryType::Leader { vertices, .. }
                | entity::GeometryType::RevisionCloud {
                    boundary: vertices, ..
                } => {
                    for v in vertices.iter_mut() {
                        if point_inside(v) {
                            v.x += dx;
                            v.y += dy;
                        }
                    }
                }
                _ => {}
            });
            self.dirty_ids.insert(id.clone());
        }
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn array_path(
        &mut self,
        ids_json: &str,
        path_id: &str,
        count: u32,
        align_to_path: bool,
    ) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        let path_entity = match self.ecs_world.get_entity_cloned(path_id) {
            Some(e) => e,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Path entity not found: {path_id}")),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };

        let path_pts: Vec<entity::Point2D> = match &path_entity.geometry {
            entity::GeometryType::Line { start, end } => vec![start.clone(), end.clone()],
            entity::GeometryType::Polyline { vertices, .. } => vertices.clone(),
            _ => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Path must be a line or polyline".into()),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };

        if path_pts.len() < 2 || count < 2 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Need at least 2 path points and count >= 2".into()),
                measurement: None,
                warnings: vec![],
            };
        }

        // Compute cumulative arc lengths
        let mut cum_lengths = vec![0.0_f64];
        for i in 1..path_pts.len() {
            let seg_len = path_pts[i - 1].distance_to(&path_pts[i]);
            cum_lengths.push(cum_lengths[i - 1] + seg_len);
        }
        let total_length = *cum_lengths.last().unwrap();
        if total_length < 1e-12 {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Path has zero length".into()),
                measurement: None,
                warnings: vec![],
            };
        }

        let spacing = total_length / (count - 1) as f64;
        let mut created_ids = vec![];

        for i in 1..count {
            let target_dist = spacing * i as f64;
            let mut seg_idx = 0;
            for (j, len) in cum_lengths.iter().enumerate().skip(1) {
                if *len >= target_dist {
                    seg_idx = j - 1;
                    break;
                }
            }
            let seg_start = &path_pts[seg_idx];
            let seg_end = &path_pts[seg_idx + 1];
            let seg_len = cum_lengths[seg_idx + 1] - cum_lengths[seg_idx];
            let t = if seg_len > 1e-12 {
                (target_dist - cum_lengths[seg_idx]) / seg_len
            } else {
                0.0
            };
            let px = seg_start.x + t * (seg_end.x - seg_start.x);
            let py = seg_start.y + t * (seg_end.y - seg_start.y);
            let angle = if align_to_path {
                (seg_end.y - seg_start.y).atan2(seg_end.x - seg_start.x)
            } else {
                0.0
            };

            let base = &path_pts[0];
            let ddx = px - base.x;
            let ddy = py - base.y;

            for src_id in &ids {
                let new_id = self.copy_entity(src_id);
                if !new_id.is_empty() {
                    if align_to_path && angle.abs() > 1e-12 {
                        self.ecs_world.rotate_entity(&new_id, base.x, base.y, angle);
                    }
                    self.ecs_world.translate_entity(&new_id, ddx, ddy);
                    self.dirty_ids.insert(new_id.clone());
                    created_ids.push(new_id);
                }
            }
        }

        CommandResult {
            success: true,
            created_ids,
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn dim_continue(
        &mut self,
        prev_dim_id: &str,
        x: f64,
        y: f64,
        layer_id: &str,
    ) -> CommandResult {
        let prev = self.ecs_world.get_entity_cloned(prev_dim_id);
        let (start_x, start_y, offset) = match prev {
            Some(e) => match &e.geometry {
                entity::GeometryType::Dimension { end, offset, .. }
                | entity::GeometryType::AlignedDimension { end, offset, .. } => {
                    (end.x, end.y, *offset)
                }
                _ => {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Referenced entity is not a dimension".into()),
                        measurement: None,
                        warnings: vec![],
                    };
                }
            },
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Dimension not found: {prev_dim_id}")),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let id = self.create_dimension(start_x, start_y, x, y, offset, layer_id);
        CommandResult {
            success: true,
            created_ids: vec![id],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn dim_baseline(
        &mut self,
        base_dim_id: &str,
        x: f64,
        y: f64,
        offset_increment: f64,
        layer_id: &str,
    ) -> CommandResult {
        let base = self.ecs_world.get_entity_cloned(base_dim_id);
        let (start_x, start_y, base_offset) = match base {
            Some(e) => match &e.geometry {
                entity::GeometryType::Dimension { start, offset, .. }
                | entity::GeometryType::AlignedDimension { start, offset, .. } => {
                    (start.x, start.y, *offset)
                }
                _ => {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Referenced entity is not a dimension".into()),
                        measurement: None,
                        warnings: vec![],
                    };
                }
            },
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some(format!("Dimension not found: {base_dim_id}")),
                    measurement: None,
                    warnings: vec![],
                };
            }
        };
        let new_offset = base_offset + offset_increment;
        let id = self.create_dimension(start_x, start_y, x, y, new_offset, layer_id);
        CommandResult {
            success: true,
            created_ids: vec![id],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn align_entities(
        &mut self,
        ids_json: &str,
        src1_x: f64,
        src1_y: f64,
        dst1_x: f64,
        dst1_y: f64,
        src2_x: Option<f64>,
        src2_y: Option<f64>,
        dst2_x: Option<f64>,
        dst2_y: Option<f64>,
    ) -> CommandResult {
        let ids: Vec<String> = serde_json::from_str(ids_json).unwrap_or_default();
        match (src2_x, src2_y, dst2_x, dst2_y) {
            (Some(s2x), Some(s2y), Some(d2x), Some(d2y)) => {
                // 2-point align: translate + rotate + scale
                let src_dx = s2x - src1_x;
                let src_dy = s2y - src1_y;
                let dst_dx = d2x - dst1_x;
                let dst_dy = d2y - dst1_y;
                let src_len = (src_dx * src_dx + src_dy * src_dy).sqrt();
                let dst_len = (dst_dx * dst_dx + dst_dy * dst_dy).sqrt();
                if src_len < 1e-12 {
                    return CommandResult {
                        success: false,
                        created_ids: vec![],
                        error: Some("Source points are coincident".into()),
                        measurement: None,
                        warnings: vec![],
                    };
                }
                let scale = dst_len / src_len;
                let src_angle = src_dy.atan2(src_dx);
                let dst_angle = dst_dy.atan2(dst_dx);
                let rotation = dst_angle - src_angle;

                for id in &ids {
                    // Translate so src1 → origin
                    self.ecs_world.translate_entity(id, -src1_x, -src1_y);
                    // Scale around origin
                    self.ecs_world.scale_entity(id, 0.0, 0.0, scale);
                    // Rotate around origin
                    self.ecs_world.rotate_entity(id, 0.0, 0.0, rotation);
                    // Translate to dst1
                    self.ecs_world.translate_entity(id, dst1_x, dst1_y);
                    self.dirty_ids.insert(id.clone());
                }
            }
            _ => {
                // 1-point align: translate only
                let dx = dst1_x - src1_x;
                let dy = dst1_y - src1_y;
                for id in &ids {
                    self.ecs_world.translate_entity(id, dx, dy);
                    self.dirty_ids.insert(id.clone());
                }
            }
        }
        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: vec![],
        }
    }

    pub fn purge_unused(&mut self) -> CommandResult {
        let all_entities = self.ecs_world.cache_values_cloned();
        let mut used_layers: std::collections::HashSet<String> = std::collections::HashSet::new();
        for e in &all_entities {
            used_layers.insert(e.layer_id.clone());
        }
        used_layers.insert("layer_0".to_string());

        let before = self.layers.len();
        self.layers.retain(|l| used_layers.contains(&l.id));
        let purged_count = before - self.layers.len();

        CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: None,
            warnings: if purged_count == 0 {
                vec!["Nothing to purge".into()]
            } else {
                vec![format!("Purged {purged_count} unused layers")]
            },
        }
    }

    pub fn pedit_close(&mut self, id: &str) -> CommandResult {
        let ok = self.ecs_world.modify_entity_geometry(id, |geo| {
            if let entity::GeometryType::Polyline { closed, .. } = geo {
                *closed = true;
            }
        });
        if ok {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Entity not found or not a polyline: {id}")),
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn pedit_open(&mut self, id: &str) -> CommandResult {
        let ok = self.ecs_world.modify_entity_geometry(id, |geo| {
            if let entity::GeometryType::Polyline { closed, .. } = geo {
                *closed = false;
            }
        });
        if ok {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        } else {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Entity not found or not a polyline: {id}")),
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn pedit_add_vertex(
        &mut self,
        id: &str,
        after_index: usize,
        x: f64,
        y: f64,
    ) -> CommandResult {
        let mut error_msg = None;
        let ok = self.ecs_world.modify_entity_geometry(id, |geo| {
            if let entity::GeometryType::Polyline { vertices, .. } = geo {
                let insert_at = (after_index + 1).min(vertices.len());
                vertices.insert(insert_at, entity::Point2D::new(x, y));
            } else {
                error_msg = Some("Not a polyline".to_string());
            }
        });
        if !ok {
            error_msg = Some(format!("Entity not found: {id}"));
        }
        if let Some(err) = error_msg {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(err),
                measurement: None,
                warnings: vec![],
            }
        } else {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn pedit_delete_vertex(&mut self, id: &str, vertex_index: usize) -> CommandResult {
        let mut error_msg = None;
        let ok = self.ecs_world.modify_entity_geometry(id, |geo| {
            if let entity::GeometryType::Polyline { vertices, .. } = geo {
                if vertex_index < vertices.len() && vertices.len() > 2 {
                    vertices.remove(vertex_index);
                } else if vertices.len() <= 2 {
                    error_msg =
                        Some("Cannot delete: polyline must have at least 2 vertices".into());
                } else {
                    error_msg = Some(format!("Vertex index {vertex_index} out of range"));
                }
            } else {
                error_msg = Some("Not a polyline".to_string());
            }
        });
        if !ok {
            error_msg = Some(format!("Entity not found: {id}"));
        }
        if let Some(err) = error_msg {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(err),
                measurement: None,
                warnings: vec![],
            }
        } else {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
        }
    }

    pub fn pedit_move_vertex(
        &mut self,
        id: &str,
        vertex_index: usize,
        x: f64,
        y: f64,
    ) -> CommandResult {
        let mut error_msg = None;
        let ok = self.ecs_world.modify_entity_geometry(id, |geo| {
            if let entity::GeometryType::Polyline { vertices, .. } = geo {
                if vertex_index < vertices.len() {
                    vertices[vertex_index] = entity::Point2D::new(x, y);
                } else {
                    error_msg = Some(format!("Vertex index {vertex_index} out of range"));
                }
            } else {
                error_msg = Some("Not a polyline".to_string());
            }
        });
        if !ok {
            error_msg = Some(format!("Entity not found: {id}"));
        }
        if let Some(err) = error_msg {
            CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(err),
                measurement: None,
                warnings: vec![],
            }
        } else {
            self.dirty_ids.insert(id.to_string());
            CommandResult {
                success: true,
                created_ids: vec![],
                error: None,
                measurement: None,
                warnings: vec![],
            }
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

    // --- CreateLine ---
    #[test]
    fn create_line_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_line_zero_length() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":5,"x2":5,"y2":5,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        // Entity is created but warnings should flag zero-length
        assert!(!v["created_ids"].as_array().unwrap().is_empty());
    }

    // --- CreateCircle ---
    #[test]
    fn create_circle_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_circle_zero_radius() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert!(!v["created_ids"].as_array().unwrap().is_empty());
    }

    #[test]
    fn create_circle_negative_radius() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":-3,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateArc ---
    #[test]
    fn create_arc_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":5,"start_angle":0,"end_angle":1.5708,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_arc_zero_radius() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":0,"start_angle":0,"end_angle":1.5708,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn create_arc_same_angles() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateArc","cx":0,"cy":0,"radius":5,"start_angle":1.0,"end_angle":1.0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateRectangle ---
    #[test]
    fn create_rectangle_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":5,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_rectangle_zero_width() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":0,"height":5,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn create_rectangle_zero_height() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRectangle","x":0,"y":0,"width":10,"height":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreatePoint ---
    #[test]
    fn create_point_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreatePoint","x":5,"y":10,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreatePolyline ---
    #[test]
    fn create_polyline_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10]],"closed":false,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_polyline_closed() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":true,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    #[test]
    fn create_polyline_single_vertex() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreatePolyline","vertices":[[0,0]],"closed":false,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateEllipse ---
    #[test]
    fn create_ellipse_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateEllipse","cx":0,"cy":0,"semi_major":8,"semi_minor":4,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_ellipse_zero_axes() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateEllipse","cx":0,"cy":0,"semi_major":0,"semi_minor":0,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateSpline ---
    #[test]
    fn create_spline_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateSpline","control_points":[[0,0],[5,5],[10,0]],"degree":2,"closed":false,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_spline_closed() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateSpline","control_points":[[0,0],[5,5],[10,0],[5,-5]],"degree":2,"closed":true,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateText ---
    #[test]
    fn create_text_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateText","x":1,"y":2,"content":"Hello","height":2.5,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_text_empty_content() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateText","x":0,"y":0,"content":"","height":2.5,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateMText ---
    #[test]
    fn create_mtext_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateMText","x":0,"y":0,"content":"Multi","width":20,"height":2.5,"rotation":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreateConstructionLine ---
    #[test]
    fn create_construction_line_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateConstructionLine","ox":0,"oy":0,"dx":1,"dy":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_construction_line_zero_direction() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateConstructionLine","ox":0,"oy":0,"dx":0,"dy":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateRevisionCloud ---
    #[test]
    fn create_revision_cloud_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRevisionCloud","vertices":[[0,0],[10,0],[10,10],[0,10]],"arc_length":0.5,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn create_revision_cloud_no_arc_length() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRevisionCloud","vertices":[[0,0],[10,0],[10,10]],"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
    }

    // --- CreateDimension ---
    #[test]
    fn create_dimension_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":2,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreateAlignedDimension ---
    #[test]
    fn create_aligned_dimension_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateAlignedDimension","x1":0,"y1":0,"x2":10,"y2":5,"offset":2,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreateAngularDimension ---
    #[test]
    fn create_angular_dimension_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateAngularDimension","cx":0,"cy":0,"sx":10,"sy":0,"ex":0,"ey":10,"radius":8,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreateRadialDimension ---
    #[test]
    fn create_radial_dimension_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateRadialDimension","cx":0,"cy":0,"px":5,"py":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- CreateDiameterDimension ---
    #[test]
    fn create_diameter_dimension_valid() {
        let mut k = Kernel::new();
        let v = exec(
            &mut k,
            r#"{"type":"CreateDiameterDimension","cx":0,"cy":0,"px":5,"py":0,"layer_id":"layer_0"}"#,
        );
        assert!(v["success"].as_bool().unwrap());
        assert_eq!(v["created_ids"].as_array().unwrap().len(), 1);
    }

    // --- Entity count after multiple creates ---
    #[test]
    fn multiple_creates_increments_count() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":1,"y2":1,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":0,"cy":0,"radius":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreatePoint","x":1,"y":1,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.entity_count(), 3);
    }
}

impl Kernel {
    #[allow(clippy::too_many_arguments)]
    pub fn create_circle_3p(
        &mut self,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        x3: f64,
        y3: f64,
        layer_id: &str,
    ) -> CommandResult {
        let p1 = entity::Point2D::new(x1, y1);
        let p2 = entity::Point2D::new(x2, y2);
        let p3 = entity::Point2D::new(x3, y3);
        match geometry_intersections::circumscribed_circle(&p1, &p2, &p3) {
            Some((center, radius)) => {
                let id = self.create_circle(center.x, center.y, radius, layer_id);
                let warnings = self.validate_entity(&id);
                CommandResult {
                    success: true,
                    created_ids: vec![id],
                    error: None,
                    measurement: None,
                    warnings,
                }
            }
            None => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Points are collinear".into()),
                measurement: None,
                warnings: vec![],
            },
        }
    }

    pub fn create_circle_2p(
        &mut self,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        layer_id: &str,
    ) -> CommandResult {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist < tolerance::ZERO_LENGTH {
            return CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("Points are coincident".into()),
                measurement: None,
                warnings: vec![],
            };
        }
        let cx = (x1 + x2) / 2.0;
        let cy = (y1 + y2) / 2.0;
        let radius = dist / 2.0;
        let id = self.create_circle(cx, cy, radius, layer_id);
        let warnings = self.validate_entity(&id);
        CommandResult {
            success: true,
            created_ids: vec![id],
            error: None,
            measurement: None,
            warnings,
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_circle_ttr(
        &mut self,
        entity1_id: &str,
        pick1_x: f64,
        pick1_y: f64,
        entity2_id: &str,
        pick2_x: f64,
        pick2_y: f64,
        radius: f64,
        layer_id: &str,
    ) -> CommandResult {
        use crate::geometry_intersections::*;

        let ent1 = match self.ecs_world.get_entity_cloned(entity1_id) {
            Some(e) => e,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Entity 1 not found".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
        let ent2 = match self.ecs_world.get_entity_cloned(entity2_id) {
            Some(e) => e,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Entity 2 not found".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };

        enum Geom {
            Line(entity::Point2D, entity::Point2D),
            Circle(entity::Point2D, f64),
        }
        let extract = |ent: &entity::Entity| -> Option<Geom> {
            match &ent.geometry {
                entity::GeometryType::Line { start, end } => {
                    Some(Geom::Line(start.clone(), end.clone()))
                }
                entity::GeometryType::Circle { center, radius } => {
                    Some(Geom::Circle(center.clone(), *radius))
                }
                entity::GeometryType::Arc { center, radius, .. } => {
                    Some(Geom::Circle(center.clone(), *radius))
                }
                _ => None,
            }
        };

        let g1 = match extract(&ent1) {
            Some(g) => g,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Unsupported geometry type for entity 1".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };
        let g2 = match extract(&ent2) {
            Some(g) => g,
            None => {
                return CommandResult {
                    success: false,
                    created_ids: vec![],
                    error: Some("Unsupported geometry type for entity 2".into()),
                    measurement: None,
                    warnings: vec![],
                }
            }
        };

        let candidates = match (&g1, &g2) {
            (Geom::Line(s1, e1), Geom::Line(s2, e2)) => {
                tangent_circle_line_line(s1, e1, s2, e2, radius)
            }
            (Geom::Line(ls, le), Geom::Circle(cc, cr)) => {
                tangent_circle_line_circle(ls, le, cc, *cr, radius)
            }
            (Geom::Circle(cc, cr), Geom::Line(ls, le)) => {
                tangent_circle_line_circle(ls, le, cc, *cr, radius)
            }
            (Geom::Circle(c1, r1), Geom::Circle(c2, r2)) => {
                tangent_circle_circle_circle(c1, *r1, c2, *r2, radius)
            }
        };

        let pick_mid = entity::Point2D::new((pick1_x + pick2_x) / 2.0, (pick1_y + pick2_y) / 2.0);

        match pick_side_for_tangent(&candidates, &pick_mid) {
            Some((center, r)) => {
                let id = self.create_circle(center.x, center.y, r, layer_id);
                let warnings = self.validate_entity(&id);
                CommandResult {
                    success: true,
                    created_ids: vec![id],
                    error: None,
                    measurement: None,
                    warnings,
                }
            }
            None => CommandResult {
                success: false,
                created_ids: vec![],
                error: Some("No tangent circle solution found".into()),
                measurement: None,
                warnings: vec![],
            },
        }
    }
}
