mod apply;
mod blocks;
mod commands;
pub mod components;
mod constraint_ops;
mod constraints;
mod create;
mod dim_styles;
mod dimensions;
mod dispatch;
mod drawing;
mod dwg_props;
mod editing;
mod entity;
mod events;
mod geometry_intersections;
mod geometry_ops;
mod groups;
mod layers;
mod mleader_styles;
mod named_ucs;
mod named_views;
mod ports;
mod snap_queries;
pub mod snaps;
mod solver_ezpz;
pub(crate) mod spatial_index;
mod styles;
pub mod systems;
pub mod sysvars;
mod table_styles;
mod text_styles;
pub mod tolerance;
mod undo;
pub mod units;
mod validation;
pub mod world;

use commands::{Command, CommandResult};
use entity::{
    BlockDef, DimStyle, DwgProps, Entity, Group, Layer, MLeaderStyle, NamedUcs, NamedView,
    TableStyle, TextStyle,
};
use events::{CadEvent, EventStore};
use spatial_index::SpatialIndex;
use std::collections::{HashMap, HashSet};

#[allow(unused_imports)]
use tracing::instrument;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(start)]
pub fn init() {
    console_error_panic_hook::set_once();
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn init_tracing(level: &str) {
    use tracing_subscriber::prelude::*;

    let level_filter = match level {
        "debug" => tracing::Level::DEBUG,
        "warn" => tracing::Level::WARN,
        "error" => tracing::Level::ERROR,
        _ => tracing::Level::INFO,
    };

    use tracing_subscriber::fmt::format::Pretty;

    let fmt_layer = tracing_web::MakeWebConsoleWriter::new();

    tracing_subscriber::registry()
        .with(tracing_subscriber::filter::LevelFilter::from_level(
            level_filter,
        ))
        .with(tracing_web::performance_layer().with_details_from_fields(Pretty::default()))
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(fmt_layer)
                .without_time(),
        )
        .init();
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[allow(unused_macros)]
macro_rules! console_log {
    ($($t:tt)*) => {
        #[cfg(target_arch = "wasm32")]
        log(&format_args!($($t)*).to_string())
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
pub struct Kernel {
    pub(crate) ecs_world: world::NexusWorld,
    pub(crate) layers: Vec<Layer>,
    pub(crate) block_defs: Vec<BlockDef>,
    pub(crate) event_store: EventStore,
    pub(crate) constraint_solver: Box<dyn ports::ConstraintSolverPort>,
    pub(crate) next_id: u64,
    pub(crate) next_layer_id: u64,
    pub(crate) dirty_ids: HashSet<String>,
    pub(crate) deleted_ids: Vec<String>,
    pub(crate) last_created_id: Option<String>,
    pub(crate) sysvars: HashMap<String, sysvars::SysvarValue>,
    pub(crate) units: units::DrawingUnits,
    pub(crate) text_styles: HashMap<String, TextStyle>,
    pub(crate) current_text_style: String,
    pub(crate) dim_styles: HashMap<String, DimStyle>,
    pub(crate) current_dim_style: String,
    pub(crate) mleader_styles: HashMap<String, MLeaderStyle>,
    pub(crate) current_mleader_style: String,
    pub(crate) table_styles: HashMap<String, TableStyle>,
    pub(crate) current_table_style: String,
    pub(crate) dwg_props: DwgProps,
    pub(crate) groups: HashMap<String, Group>,
    pub(crate) next_anon_group: u64,
    pub(crate) named_ucs: HashMap<String, NamedUcs>,
    pub(crate) current_ucs: String,
    pub(crate) named_views: HashMap<String, NamedView>,
    pub(crate) spatial_idx: SpatialIndex,
    pub(crate) ltscale: f64,
}

impl Default for Kernel {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
impl Kernel {
    #[cfg_attr(target_arch = "wasm32", wasm_bindgen(constructor))]
    pub fn new() -> Kernel {
        Kernel {
            ecs_world: world::NexusWorld::new(),
            layers: vec![Layer {
                id: "layer_0".to_string(),
                name: "0".to_string(),
                color: "#ffffff".to_string(),
                visible: true,
                locked: false,
                linetype: None,
                lineweight: None,
            }],
            block_defs: Vec::new(),
            event_store: EventStore::new(),
            constraint_solver: Box::new(constraints::ConstraintSolver::new()),
            next_id: 1,
            next_layer_id: 1,
            dirty_ids: HashSet::new(),
            deleted_ids: Vec::new(),
            last_created_id: None,
            sysvars: sysvars::default_registry(),
            units: units::DrawingUnits::default(),
            text_styles: {
                let mut m = HashMap::new();
                m.insert("Standard".to_string(), TextStyle::standard());
                m
            },
            current_text_style: "Standard".to_string(),
            dim_styles: {
                let mut m = HashMap::new();
                m.insert("Standard".to_string(), DimStyle::standard());
                m
            },
            current_dim_style: "Standard".to_string(),
            mleader_styles: {
                let mut m = HashMap::new();
                m.insert("Standard".to_string(), MLeaderStyle::standard());
                m
            },
            current_mleader_style: "Standard".to_string(),
            table_styles: {
                let mut m = HashMap::new();
                m.insert("Standard".to_string(), TableStyle::standard());
                m
            },
            current_table_style: "Standard".to_string(),
            dwg_props: DwgProps::default(),
            groups: HashMap::new(),
            next_anon_group: 1,
            named_ucs: HashMap::new(),
            current_ucs: "World".to_string(),
            named_views: HashMap::new(),
            spatial_idx: SpatialIndex::new(),
            ltscale: 1.0,
        }
    }

    pub(crate) fn gen_id(&mut self) -> String {
        let id = format!("ent_{}", self.next_id);
        self.next_id += 1;
        id
    }

    fn rebuild_spatial_index(&mut self) {
        let all = self.ecs_world.cache_values_cloned();
        self.spatial_idx.rebuild(&all);
    }

    pub fn query_spatial_window(&self, min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> String {
        let ids = self
            .spatial_idx
            .query_window([min_x, min_y], [max_x, max_y]);
        serde_json::to_string(&ids).unwrap_or_default()
    }

    pub fn query_spatial_nearest(&self, x: f64, y: f64, radius: f64) -> String {
        let result = self.spatial_idx.query_nearest([x, y], radius);
        serde_json::to_string(&result).unwrap_or_default()
    }

    pub(crate) fn add_entity(&mut self, entity: Entity) -> String {
        if Self::is_degenerate(&entity.geometry) {
            return String::new();
        }
        let id = entity.id.clone();
        self.event_store.push(CadEvent::EntityCreated {
            entity: entity.clone(),
        });
        self.last_created_id = Some(id.clone());
        self.ecs_world.insert_entity(entity);
        self.dirty_ids.insert(id.clone());
        if let Some(ent) = self.ecs_world.get_entity_cloned(&id) {
            self.spatial_idx.insert(&ent);
        }

        id
    }

    fn is_degenerate(geometry: &entity::GeometryType) -> bool {
        match geometry {
            entity::GeometryType::Line { start, end } => {
                start.distance_to(end) < tolerance::ZERO_LENGTH
            }
            entity::GeometryType::Circle { radius, .. } => *radius < tolerance::ZERO_LENGTH,
            entity::GeometryType::Arc {
                radius,
                start_angle,
                end_angle,
                ..
            } => {
                *radius < tolerance::ZERO_LENGTH
                    || (end_angle - start_angle).abs() < tolerance::ZERO_LENGTH
            }
            entity::GeometryType::Rectangle { width, height, .. } => {
                width.abs() < tolerance::ZERO_LENGTH || height.abs() < tolerance::ZERO_LENGTH
            }
            entity::GeometryType::Polyline { vertices, .. } => vertices.len() < 2,
            _ => false,
        }
    }

    // --- Edit operations ---

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn delete_entity(&mut self, id: &str) -> bool {
        let ok = editing::delete_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.deleted_ids,
            &mut *self.constraint_solver,
            id,
        );
        if ok {
            self.spatial_idx.remove(id);
        }
        ok
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn move_entity(&mut self, id: &str, dx: f64, dy: f64) -> bool {
        let ok = editing::move_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            dx,
            dy,
        );
        if ok {
            self.solve_constraints_inner();
            if let Some(ent) = self.ecs_world.get_entity_cloned(id) {
                self.spatial_idx.update(&ent);
            }
        }
        ok
    }

    pub fn rotate_entity(&mut self, id: &str, cx: f64, cy: f64, angle: f64) -> bool {
        let ok = editing::rotate_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            cx,
            cy,
            angle,
        );
        if ok {
            self.solve_constraints_inner();
            if let Some(ent) = self.ecs_world.get_entity_cloned(id) {
                self.spatial_idx.update(&ent);
            }
        }
        ok
    }

    pub fn scale_entity(&mut self, id: &str, cx: f64, cy: f64, factor: f64) -> bool {
        let ok = editing::scale_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            cx,
            cy,
            factor,
        );
        if ok {
            self.solve_constraints_inner();
            if let Some(ent) = self.ecs_world.get_entity_cloned(id) {
                self.spatial_idx.update(&ent);
            }
        }
        ok
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn copy_entity(&mut self, id: &str) -> String {
        let new_id = self.gen_id();
        editing::copy_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            new_id,
        )
    }

    // --- Blocks ---

    pub fn get_block_defs_json(&self) -> String {
        blocks::get_block_defs_json(&self.block_defs)
    }

    pub(crate) fn create_block_cmd(
        &mut self,
        name: &str,
        base_x: f64,
        base_y: f64,
        entity_ids: &[String],
    ) -> CommandResult {
        blocks::create_block_cmd(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            &mut self.last_created_id,
            &mut self.block_defs,
            name,
            base_x,
            base_y,
            entity_ids,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn insert_block_cmd(
        &mut self,
        block_id: &str,
        x: f64,
        y: f64,
        rotation: f64,
        scale_x: f64,
        scale_y: f64,
        layer_id: &str,
    ) -> CommandResult {
        blocks::insert_block_cmd(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.next_id,
            &mut self.last_created_id,
            &self.block_defs,
            block_id,
            x,
            y,
            rotation,
            scale_x,
            scale_y,
            layer_id,
        )
    }

    pub(crate) fn explode_block_cmd(&mut self, entity_id: &str) -> CommandResult {
        blocks::explode_block_cmd(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            &mut self.last_created_id,
            &self.block_defs,
            entity_id,
        )
    }

    // --- Measurement ---

    pub(crate) fn measure_distance_cmd(&self, x1: f64, y1: f64, x2: f64, y2: f64) -> CommandResult {
        dimensions::measure_distance_cmd(x1, y1, x2, y2)
    }

    pub(crate) fn measure_area_cmd(&self, entity_id: &str) -> CommandResult {
        dimensions::measure_area_cmd(&self.ecs_world, entity_id)
    }

    // --- Hatch/MText/Table ---

    pub(crate) fn create_hatch_cmd(
        &mut self,
        boundary_ids: Vec<String>,
        pattern: &str,
        scale: f64,
        angle: f64,
        layer_id: &str,
    ) -> CommandResult {
        let id = self.gen_id();
        drawing::create_hatch_cmd(
            id,
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.last_created_id,
            boundary_ids,
            pattern,
            scale,
            angle,
            layer_id,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_mtext_cmd(
        &mut self,
        x: f64,
        y: f64,
        content: &str,
        width: f64,
        height: f64,
        rotation: f64,
        layer_id: &str,
    ) -> CommandResult {
        let id = self.gen_id();
        drawing::create_mtext_cmd(
            id,
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.last_created_id,
            x,
            y,
            content,
            width,
            height,
            rotation,
            layer_id,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn create_table_cmd(
        &mut self,
        x: f64,
        y: f64,
        rows: u32,
        cols: u32,
        row_height: f64,
        col_widths: Vec<f64>,
        cells: Vec<String>,
        layer_id: &str,
    ) -> CommandResult {
        let id = self.gen_id();
        let current_style = self.current_table_style.clone();
        drawing::create_table_cmd(
            id,
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.last_created_id,
            x,
            y,
            rows,
            cols,
            row_height,
            col_widths,
            cells,
            layer_id,
            &current_style,
        )
    }

    // --- Geometry editing ---

    pub fn update_entity_geometry(&mut self, id: &str, geometry_json: &str) -> bool {
        let ok = editing::update_entity_geometry(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            geometry_json,
        );
        if ok {
            self.solve_constraints_inner();
        }
        ok
    }

    pub fn lengthen_entity(&mut self, id: &str, mode: &str, value: f64, end: &str) -> bool {
        geometry_ops::lengthen_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            mode,
            value,
            end,
        )
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn offset_entity(&mut self, id: &str, distance: f64) -> Result<String, String> {
        geometry_ops::offset_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.last_created_id,
            &mut self.next_id,
            id,
            distance,
        )
    }

    pub fn mirror_entity(&mut self, id: &str, x1: f64, y1: f64, x2: f64, y2: f64) -> String {
        geometry_ops::mirror_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.last_created_id,
            &mut self.next_id,
            id,
            x1,
            y1,
            x2,
            y2,
        )
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn trim_entity(&mut self, id: &str, boundary_id: &str, pick_x: f64, pick_y: f64) -> bool {
        geometry_ops::trim_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            boundary_id,
            pick_x,
            pick_y,
        )
    }

    // --- Break ---

    pub(crate) fn break_at_point(&mut self, entity_id: &str, px: f64, py: f64) -> CommandResult {
        geometry_ops::break_at_point(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            entity_id,
            px,
            py,
        )
    }

    pub(crate) fn break_two_points(
        &mut self,
        entity_id: &str,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    ) -> CommandResult {
        geometry_ops::break_two_points(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            entity_id,
            x1,
            y1,
            x2,
            y2,
        )
    }

    // --- Undo/Redo ---

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn undo(&mut self) -> bool {
        if let Some(event) = self.event_store.undo().cloned() {
            undo::apply_undo_event(
                &mut self.ecs_world,
                &mut self.dirty_ids,
                &mut self.deleted_ids,
                &event,
            );
            self.rebuild_spatial_index();
            true
        } else {
            false
        }
    }

    #[cfg_attr(not(target_arch = "wasm32"), instrument(skip_all))]
    pub fn redo(&mut self) -> bool {
        if let Some(event) = self.event_store.redo().cloned() {
            undo::apply_redo_event(
                &mut self.ecs_world,
                &mut self.dirty_ids,
                &mut self.deleted_ids,
                &event,
            );
            self.rebuild_spatial_index();
            true
        } else {
            false
        }
    }

    pub fn can_undo(&self) -> bool {
        self.event_store.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.event_store.can_redo()
    }

    pub fn event_count(&self) -> usize {
        self.event_store.event_count()
    }

    pub fn get_events_json(&self, from_seq: u32) -> String {
        let events: Vec<_> = self
            .event_store
            .events
            .iter()
            .filter(|e| e.seq >= from_seq as u64)
            .collect();
        serde_json::to_string(&events).unwrap_or_else(|_| "[]".to_string())
    }

    pub fn get_undo_stack_json(&self) -> String {
        let info = serde_json::json!({
            "total": self.event_store.event_count(),
            "cursor": self.event_store.undo_depth(),
            "can_undo": self.event_store.can_undo(),
            "can_redo": self.event_store.can_redo(),
        });
        serde_json::to_string(&info).unwrap_or_else(|_| "{}".to_string())
    }

    pub(crate) fn solve_constraints_inner(&mut self) -> bool {
        let ids = self.constraint_solver.constrained_entity_ids();
        if ids.is_empty() {
            return false;
        }
        let mut constrained: Vec<Entity> = ids
            .iter()
            .filter_map(|id| self.ecs_world.get_entity_cloned(id))
            .collect();

        // Primary solver: ezpz (handles Fixed, Coincident, Horizontal, Vertical,
        // Distance, Parallel, Perpendicular, EqualLength)
        let all_constraints = self.constraint_solver.get_constraints();
        let ezpz_result = solver_ezpz::solve_with_ezpz(&constrained, &all_constraints);
        if ezpz_result.converged {
            for (entity_id, point_index, x, y) in &ezpz_result.positions {
                if let Some(entity) = constrained.iter_mut().find(|e| e.id == *entity_id) {
                    constraints::ConstraintSolver::set_point(
                        entity,
                        *point_index,
                        &entity::Point2D::new(*x, *y),
                    );
                }
            }
        }

        // Fallback: native Gauss-Seidel for constraint types ezpz skips
        // (Tangent, Concentric, Symmetric)
        let has_native_only = all_constraints.iter().any(|c| {
            matches!(
                c.constraint_type,
                constraints::ConstraintType::Tangent { .. }
                    | constraints::ConstraintType::Concentric { .. }
                    | constraints::ConstraintType::Symmetric { .. }
            )
        });
        if has_native_only {
            self.constraint_solver.solve(&mut constrained);
        }

        for entity in constrained {
            self.ecs_world.set_geometry(&entity.id, entity.geometry);
            self.dirty_ids.insert(entity.id);
        }
        ezpz_result.converged
    }

    // --- Array ---

    pub(crate) fn array_rectangular(
        &mut self,
        entity_ids: &[String],
        rows: u32,
        cols: u32,
        row_spacing: f64,
        col_spacing: f64,
    ) -> CommandResult {
        blocks::array_rectangular(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.next_id,
            &mut self.last_created_id,
            entity_ids,
            rows,
            cols,
            row_spacing,
            col_spacing,
        )
    }

    pub(crate) fn array_polar(
        &mut self,
        entity_ids: &[String],
        center_x: f64,
        center_y: f64,
        count: u32,
        total_angle: f64,
        rotate_items: bool,
    ) -> CommandResult {
        blocks::array_polar(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.next_id,
            &mut self.last_created_id,
            entity_ids,
            center_x,
            center_y,
            count,
            total_angle,
            rotate_items,
        )
    }

    // --- Advanced editing ---

    pub(crate) fn fillet(&mut self, id_a: &str, id_b: &str, radius: f64) -> CommandResult {
        geometry_ops::fillet(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.next_id,
            id_a,
            id_b,
            radius,
        )
    }

    pub(crate) fn chamfer(
        &mut self,
        id_a: &str,
        id_b: &str,
        dist_a: f64,
        dist_b: f64,
    ) -> CommandResult {
        geometry_ops::chamfer(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.next_id,
            id_a,
            id_b,
            dist_a,
            dist_b,
        )
    }

    pub(crate) fn explode(&mut self, entity_id: &str) -> CommandResult {
        geometry_ops::explode(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            &self.block_defs,
            entity_id,
        )
    }

    pub(crate) fn extend_entity(&mut self, id: &str, boundary_id: &str) -> CommandResult {
        geometry_ops::extend_entity(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            id,
            boundary_id,
        )
    }

    pub(crate) fn join_entities(&mut self, ids: &[String]) -> CommandResult {
        geometry_ops::join_entities(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            &mut self.deleted_ids,
            &mut self.next_id,
            ids,
        )
    }

    // --- Layer operations ---

    pub fn create_layer(&mut self, name: &str, color: &str) -> String {
        layers::create_layer(&mut self.layers, &mut self.next_layer_id, name, color)
    }

    pub fn get_layers_json(&self) -> String {
        layers::get_layers_json(&self.layers)
    }

    pub fn set_layer_visible(&mut self, layer_id: &str, visible: bool) -> bool {
        layers::set_layer_visible(&mut self.layers, layer_id, visible)
    }

    pub fn set_layer_locked(&mut self, layer_id: &str, locked: bool) -> bool {
        layers::set_layer_locked(&mut self.layers, layer_id, locked)
    }

    pub fn set_layer_color(&mut self, layer_id: &str, color: &str) -> bool {
        layers::set_layer_color(&mut self.layers, layer_id, color)
    }

    pub fn rename_layer(&mut self, layer_id: &str, name: &str) -> bool {
        layers::rename_layer(&mut self.layers, layer_id, name)
    }

    pub fn delete_layer(&mut self, layer_id: &str) -> bool {
        layers::delete_layer(&mut self.layers, &mut self.ecs_world, layer_id)
    }

    pub fn set_entity_layer(&mut self, entity_id: &str, layer_id: &str) -> bool {
        layers::set_entity_layer(
            &mut self.ecs_world,
            &self.layers,
            &mut self.dirty_ids,
            entity_id,
            layer_id,
        )
    }

    pub(crate) fn match_properties_cmd(
        &mut self,
        source_id: &str,
        target_ids: &[String],
    ) -> CommandResult {
        styles::match_properties_cmd(
            &mut self.ecs_world,
            &mut self.event_store,
            &mut self.dirty_ids,
            source_id,
            target_ids,
        )
    }

    pub fn get_visible_entities_json(&self) -> String {
        layers::get_visible_entities_json(&self.ecs_world, &self.layers)
    }

    // --- Query ---

    pub fn get_entities_json(&self) -> String {
        self.ecs_world.to_entities_json()
    }

    pub fn get_entity_json(&self, id: &str) -> String {
        self.ecs_world
            .to_entity(id)
            .map(|e| serde_json::to_string(&e).unwrap_or_default())
            .unwrap_or_default()
    }

    pub fn entity_count(&self) -> usize {
        self.ecs_world.entity_count()
    }

    /// Legacy `f64` accessor. Returns the stored value coerced to `f64`
    /// (Float passthrough; Int widens; String/Point2d collapse to 0.0).
    /// Kept for back-compat with the WASM ABI and the pre-S4 sysvars.
    pub fn get_sysvar(&self, name: &str) -> f64 {
        self.sysvars
            .get(name)
            .map(sysvars::SysvarValue::as_f64)
            .unwrap_or(0.0)
    }

    /// Legacy `f64` setter. Writes the value as `SysvarValue::Float`.
    /// New code should prefer `set_sysvar_typed_json`.
    pub fn set_sysvar(&mut self, name: &str, value: f64) {
        self.sysvars
            .insert(name.to_string(), sysvars::SysvarValue::Float(value));
    }

    /// Returns the entire sysvar registry as JSON, including non-Float entries.
    /// Shape: `{"OSMODE": {"Int": 4133}, "FILLETRAD": {"Float": 0.0}, …}`.
    /// Pre-S4 entries (8 floats) are still serialised as `{"Float": <n>}`.
    pub fn get_sysvars_json(&self) -> String {
        serde_json::to_string(&self.sysvars).unwrap_or_default()
    }

    /// Returns one sysvar's typed value as JSON (`null` if missing).
    /// Shape: `{"Int": 4133}` / `{"Float": 1.0}` / `{"String": "ByLayer"}` /
    /// `{"Point2d": {"x": 0.5, "y": 0.5}}`.
    pub fn get_sysvar_typed_json(&self, name: &str) -> String {
        match self.sysvars.get(name) {
            Some(v) => serde_json::to_string(v).unwrap_or_else(|_| "null".into()),
            None => "null".into(),
        }
    }

    /// Sets a sysvar from a JSON-encoded `SysvarValue`. Returns `false` on
    /// parse failure; the registry is left untouched in that case.
    pub fn set_sysvar_typed_json(&mut self, name: &str, value_json: &str) -> bool {
        match serde_json::from_str::<sysvars::SysvarValue>(value_json) {
            Ok(v) => {
                self.sysvars.insert(name.to_string(), v);
                true
            }
            Err(_) => false,
        }
    }

    pub fn get_units_json(&self) -> String {
        serde_json::to_string(&self.units).unwrap_or_default()
    }

    pub fn set_units_json(&mut self, json: &str) -> bool {
        match serde_json::from_str::<units::DrawingUnits>(json) {
            Ok(u) => {
                self.units = u;
                true
            }
            Err(_) => false,
        }
    }

    pub fn format_linear(&self, value: f64) -> String {
        units::format_linear(value, &self.units)
    }

    pub fn format_angular(&self, value_radians: f64) -> String {
        units::format_angular(value_radians, &self.units)
    }

    pub fn flush_changes(&mut self) -> String {
        let visible_layer_ids: HashSet<&str> = self
            .layers
            .iter()
            .filter(|l| l.visible)
            .map(|l| l.id.as_str())
            .collect();
        let mut upserted: Vec<Entity> = Vec::new();
        self.ecs_world.for_each_entity(|e| {
            if self.dirty_ids.contains(&e.id) && visible_layer_ids.contains(e.layer_id.as_str()) {
                upserted.push(e.clone());
            }
        });
        let result = serde_json::json!({
            "upserted": upserted,
            "deleted": &self.deleted_ids,
        });
        self.dirty_ids.clear();
        self.deleted_ids.clear();
        serde_json::to_string(&result).unwrap_or_default()
    }

    pub fn get_last_created_entity_json(&self) -> String {
        self.last_created_id
            .as_ref()
            .and_then(|id| self.ecs_world.to_entity(id))
            .map(|e| serde_json::to_string(&e).unwrap_or_default())
            .unwrap_or_default()
    }

    pub fn has_changes(&self) -> bool {
        !self.dirty_ids.is_empty() || !self.deleted_ids.is_empty()
    }

    pub fn preview_command(&self, command_json: &str) -> String {
        let cmd = match serde_json::from_str::<Command>(command_json) {
            Ok(c) => c,
            Err(_) => {
                return serde_json::json!({
                    "success": false,
                    "preview_entities": []
                })
                .to_string();
            }
        };

        let ref_ids = cmd.referenced_entity_ids();
        let ref_strs: Vec<&str> = ref_ids.iter().map(|s| s.as_str()).collect();
        let scratch_world = if ref_strs.is_empty() {
            world::NexusWorld::new()
        } else {
            self.ecs_world.clone_with_entities(&ref_strs)
        };

        let mut scratch = Kernel {
            ecs_world: scratch_world,
            layers: self.layers.clone(),
            block_defs: self.block_defs.clone(),
            event_store: EventStore::new(),
            constraint_solver: Box::new(constraints::ConstraintSolver::new()),
            next_id: self.next_id,
            next_layer_id: self.next_layer_id,
            dirty_ids: HashSet::new(),
            deleted_ids: Vec::new(),
            last_created_id: None,
            sysvars: self.sysvars.clone(),
            units: self.units.clone(),
            text_styles: self.text_styles.clone(),
            current_text_style: self.current_text_style.clone(),
            dim_styles: self.dim_styles.clone(),
            current_dim_style: self.current_dim_style.clone(),
            mleader_styles: self.mleader_styles.clone(),
            current_mleader_style: self.current_mleader_style.clone(),
            table_styles: self.table_styles.clone(),
            current_table_style: self.current_table_style.clone(),
            dwg_props: self.dwg_props.clone(),
            groups: self.groups.clone(),
            next_anon_group: self.next_anon_group,
            named_ucs: self.named_ucs.clone(),
            current_ucs: self.current_ucs.clone(),
            named_views: self.named_views.clone(),
            spatial_idx: SpatialIndex::new(),
            ltscale: self.ltscale,
        };

        let result = dispatch::execute(&mut scratch, cmd);

        if !result.success {
            return serde_json::json!({
                "success": false,
                "preview_entities": []
            })
            .to_string();
        }

        let mut preview_entities: Vec<serde_json::Value> = Vec::new();
        let mut seen: HashSet<String> = HashSet::new();

        for id in &result.created_ids {
            if seen.insert(id.clone()) {
                if let Some(entity) = scratch.ecs_world.to_entity(id) {
                    preview_entities.push(serde_json::json!({
                        "id": entity.id,
                        "geometry": entity.geometry,
                    }));
                }
            }
        }
        for id in &scratch.dirty_ids {
            if seen.insert(id.clone()) {
                if let Some(entity) = scratch.ecs_world.to_entity(id) {
                    preview_entities.push(serde_json::json!({
                        "id": entity.id,
                        "geometry": entity.geometry,
                    }));
                }
            }
        }

        serde_json::json!({
            "success": true,
            "preview_entities": preview_entities,
        })
        .to_string()
    }

    pub fn execute_command(&mut self, command_json: &str) -> String {
        match serde_json::from_str::<Command>(command_json) {
            Ok(cmd) => {
                let result = self.execute(cmd);
                if !self.dirty_ids.is_empty() {
                    self.rebuild_spatial_index();
                }

                serde_json::to_string(&result).unwrap_or_default()
            }
            Err(e) => serde_json::to_string(&CommandResult {
                success: false,
                created_ids: vec![],
                error: Some(format!("Invalid command: {}", e)),
                measurement: None,
                warnings: vec![],
            })
            .unwrap_or_default(),
        }
    }
}

impl Kernel {
    fn execute(&mut self, command: Command) -> CommandResult {
        dispatch::execute(self, command)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_and_count() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.create_circle(5.0, 5.0, 3.0, "default");
        k.create_rectangle(0.0, 0.0, 20.0, 10.0, "default");
        assert_eq!(k.entity_count(), 3);
    }

    #[test]
    fn test_undo_create() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert_eq!(k.entity_count(), 1);
        assert!(k.undo());
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn test_redo_create() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.undo();
        assert_eq!(k.entity_count(), 0);
        assert!(k.redo());
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_undo_delete() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.delete_entity(&id);
        assert_eq!(k.entity_count(), 0);
        k.undo();
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_undo_move() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.move_entity(&id, 5.0, 5.0);
        k.undo();
        let json = k.get_entity_json(&id);
        assert!(json.contains("\"x\":0.0"));
    }

    #[test]
    fn test_copy_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        let copy_id = k.copy_entity(&id);
        assert_eq!(k.entity_count(), 2);
        assert_ne!(id, copy_id);
    }

    #[test]
    fn test_undo_branching() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        k.create_circle(5.0, 5.0, 3.0, "default");
        assert_eq!(k.entity_count(), 2);
        k.undo();
        assert_eq!(k.entity_count(), 1);
        k.create_rectangle(0.0, 0.0, 5.0, 5.0, "default");
        assert_eq!(k.entity_count(), 2);
        assert!(!k.can_redo());
    }

    #[test]
    fn test_rotate_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "default");
        k.rotate_entity(&id, 0.0, 0.0, std::f64::consts::FRAC_PI_2);
        let json = k.get_entity_json(&id);
        assert!(json.contains("\"y\":10.0") || json.contains("\"y\":9.99"));
    }

    #[test]
    fn test_scale_entity() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "default");
        k.scale_entity(&id, 0.0, 0.0, 2.0);
        let json = k.get_entity_json(&id);
        assert!(json.contains("10.0"));
    }

    #[test]
    fn test_create_arc() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 0.0, std::f64::consts::FRAC_PI_2, "default");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Arc"));
    }

    #[test]
    fn test_create_line() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert_eq!(k.entity_count(), 1);
        assert!(id.starts_with("ent_"));
    }

    #[test]
    fn test_move_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert!(k.move_entity(&id, 5.0, 5.0));
    }

    #[test]
    fn test_delete_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "default");
        assert!(k.delete_entity(&id));
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn test_horizontal_constraint() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 5.0, "default");
        k.add_constraint_horizontal(&id);
        let json = k.get_entity_json(&id);
        let entity: serde_json::Value = serde_json::from_str(&json).unwrap();
        let start_y = entity["geometry"]["Line"]["start"]["y"].as_f64().unwrap();
        let end_y = entity["geometry"]["Line"]["end"]["y"].as_f64().unwrap();
        assert!((start_y - end_y).abs() < 0.01);
    }

    #[test]
    fn test_vertical_constraint() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 5.0, 10.0, "default");
        k.add_constraint_vertical(&id);
        let json = k.get_entity_json(&id);
        let entity: serde_json::Value = serde_json::from_str(&json).unwrap();
        let start_x = entity["geometry"]["Line"]["start"]["x"].as_f64().unwrap();
        let end_x = entity["geometry"]["Line"]["end"]["x"].as_f64().unwrap();
        assert!((start_x - end_x).abs() < 0.01);
    }

    #[test]
    fn test_constraint_count() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 5.0, "default");
        k.add_constraint_horizontal(&id);
        assert_eq!(k.constraint_count(), 1);
    }

    #[test]
    fn test_delete_entity_removes_constraints() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 5.0, "default");
        k.add_constraint_horizontal(&id);
        assert_eq!(k.constraint_count(), 1);
        k.delete_entity(&id);
        assert_eq!(k.constraint_count(), 0);
    }

    #[test]
    fn test_create_layer() {
        let mut k = Kernel::new();
        let id = k.create_layer("Building", "#ff0000");
        assert!(id.starts_with("layer_"));
        let json = k.get_layers_json();
        assert!(json.contains("Building"));
    }

    #[test]
    fn test_layer_visibility() {
        let mut k = Kernel::new();
        let layer_id = k.create_layer("Hidden", "#00ff00");
        k.create_line(0.0, 0.0, 10.0, 10.0, &layer_id);
        k.create_line(0.0, 0.0, 5.0, 5.0, "layer_0");

        assert_eq!(k.entity_count(), 2);

        k.set_layer_visible(&layer_id, false);
        let visible_json = k.get_visible_entities_json();
        let visible_entities: Vec<serde_json::Value> = serde_json::from_str(&visible_json).unwrap();
        assert_eq!(visible_entities.len(), 1);
    }

    #[test]
    fn test_delete_layer_moves_entities() {
        let mut k = Kernel::new();
        let layer_id = k.create_layer("Temp", "#0000ff");
        k.create_line(0.0, 0.0, 10.0, 10.0, &layer_id);
        k.delete_layer(&layer_id);
        let json = k.get_entities_json();
        assert!(json.contains("layer_0"));
    }

    #[test]
    fn test_cannot_delete_default_layer() {
        let mut k = Kernel::new();
        assert!(!k.delete_layer("layer_0"));
    }

    #[test]
    fn test_flush_changes() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "layer_0");
        let changes = k.flush_changes();
        assert!(changes.contains(&id));
        assert!(changes.contains("upserted"));
        // After flush, no more changes
        let changes2 = k.flush_changes();
        assert!(changes2.contains("\"upserted\":[]"));
    }

    #[test]
    fn has_changes_after_create() {
        let mut k = Kernel::new();
        assert!(!k.has_changes());
        k.execute_command(
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        assert!(k.has_changes());
    }

    #[test]
    fn flush_changes_returns_dirty_ids() {
        let mut k = Kernel::new();
        k.execute_command(
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":10,"layer_id":"layer_0"}"#,
        );
        let json = k.flush_changes();
        let changes: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert!(!changes["upserted"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_flush_changes_delete() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 10.0, "layer_0");
        k.flush_changes(); // clear
        k.delete_entity(&id);
        let changes = k.flush_changes();
        assert!(changes.contains(&id));
        assert!(changes.contains("deleted"));
    }

    #[test]
    fn test_set_entity_layer() {
        let mut k = Kernel::new();
        let layer_id = k.create_layer("Walls", "#ff0000");
        let ent_id = k.create_line(0.0, 0.0, 10.0, 10.0, "layer_0");
        assert!(k.set_entity_layer(&ent_id, &layer_id));
        let json = k.get_entity_json(&ent_id);
        assert!(json.contains(&layer_id));
    }

    #[test]
    fn test_update_entity_geometry() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let new_geom = r#"{"Line":{"start":{"x":0.0,"y":0.0},"end":{"x":20.0,"y":0.0}}}"#;
        assert!(k.update_entity_geometry(&id, new_geom));
        let json = k.get_entity_json(&id);
        assert!(json.contains("20.0"));
        k.undo();
        let json2 = k.get_entity_json(&id);
        assert!(json2.contains("10.0"));
    }

    #[test]
    fn test_offset_line() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let new_id = k.offset_entity(&id, 5.0).expect("offset should succeed");
        assert!(!new_id.is_empty());
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn test_mirror_entity() {
        let mut k = Kernel::new();
        let id = k.create_line(1.0, 1.0, 5.0, 1.0, "layer_0");
        let new_id = k.mirror_entity(&id, 0.0, 0.0, 10.0, 0.0);
        assert!(!new_id.is_empty());
        assert_eq!(k.entity_count(), 2);
        let json = k.get_entity_json(&new_id);
        assert!(json.contains("-1.0"));
    }

    #[test]
    fn test_trim_entity() {
        let mut k = Kernel::new();
        let h_id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let v_id = k.create_line(5.0, -5.0, 5.0, 5.0, "layer_0");
        assert!(k.trim_entity(&h_id, &v_id, 8.0, 0.0));
        let json = k.get_entity_json(&h_id);
        assert!(!json.contains("10.0"));
    }

    #[test]
    fn test_command_json_roundtrip() {
        let cmd = commands::Command::CreateLine {
            x1: 0.0,
            y1: 0.0,
            x2: 10.0,
            y2: 5.0,
            layer_id: "layer_0".to_string(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: commands::Command = serde_json::from_str(&json).unwrap();
        match parsed {
            commands::Command::CreateLine { x2, y2, .. } => {
                assert_eq!(x2, 10.0);
                assert_eq!(y2, 5.0);
            }
            _ => panic!("Wrong variant"),
        }
    }

    #[test]
    fn test_execute_command_create_line() {
        let mut k = Kernel::new();
        let json = r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":5,"layer_id":"layer_0"}"#;
        let result_json = k.execute_command(json);
        let result: commands::CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(result.success);
        assert_eq!(result.created_ids.len(), 1);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_execute_command_undo_redo() {
        let mut k = Kernel::new();
        k.execute_command(
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.entity_count(), 1);
        k.execute_command(r#"{"type":"Undo"}"#);
        assert_eq!(k.entity_count(), 0);
        k.execute_command(r#"{"type":"Redo"}"#);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_execute_command_invalid_json() {
        let mut k = Kernel::new();
        let result_json = k.execute_command("not json");
        let result: commands::CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(!result.success);
        assert!(result.error.is_some());
    }

    #[test]
    fn test_execute_command_layer_ops() {
        let mut k = Kernel::new();
        let result_json =
            k.execute_command(r##"{"type":"CreateLayer","name":"Walls","color":"#ff0000"}"##);
        let result: commands::CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(result.success);
        assert_eq!(result.created_ids.len(), 1);
    }

    #[test]
    fn test_create_text() {
        let mut k = Kernel::new();
        let id = k.create_text(10.0, 20.0, "Hello", 2.5, 0.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Text"));
        assert!(json.contains("Hello"));
    }

    #[test]
    fn test_create_dimension() {
        let mut k = Kernel::new();
        let id = k.create_dimension(0.0, 0.0, 10.0, 0.0, 3.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Dimension"));
    }

    #[test]
    fn test_text_command_json() {
        let mut k = Kernel::new();
        let result = k.execute_command(r#"{"type":"CreateText","x":5,"y":10,"content":"LOT 1","height":2.5,"rotation":0,"layer_id":"layer_0"}"#);
        let r: commands::CommandResult = serde_json::from_str(&result).unwrap();
        assert!(r.success);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_dimension_command_json() {
        let mut k = Kernel::new();
        let result = k.execute_command(r#"{"type":"CreateDimension","x1":0,"y1":0,"x2":10,"y2":0,"offset":3,"layer_id":"layer_0"}"#);
        let r: commands::CommandResult = serde_json::from_str(&result).unwrap();
        assert!(r.success);
    }

    #[test]
    fn test_chamfer() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let id_b = k.create_line(0.0, 0.0, 0.0, 10.0, "layer_0");
        let r = k.chamfer(&id_a, &id_b, 3.0, 4.0);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 1);
        assert_eq!(k.entity_count(), 3);
        let chamfer_json = k.get_entity_json(&r.created_ids[0]);
        assert!(chamfer_json.contains("Line"));
    }

    #[test]
    fn test_explode_polyline() {
        let mut k = Kernel::new();
        let result = k.execute_command(r#"{"type":"CreatePolyline","vertices":[[0,0],[10,0],[10,10],[0,10]],"closed":false,"layer_id":"layer_0"}"#);
        let r: commands::CommandResult = serde_json::from_str(&result).unwrap();
        assert!(r.success);
        let poly_id = &r.created_ids[0];
        let r2 = k.explode(poly_id);
        assert!(r2.success);
        assert_eq!(r2.created_ids.len(), 3);
        assert_eq!(k.entity_count(), 3);
    }

    #[test]
    fn test_explode_rectangle() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 10.0, 5.0, "layer_0");
        let r = k.explode(&id);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 4);
        assert_eq!(k.entity_count(), 4);
        let first_json = k.get_entity_json(&r.created_ids[0]);
        assert!(first_json.contains("Line"));
    }

    #[test]
    fn test_create_point() {
        let mut k = Kernel::new();
        let id = k.create_point(5.0, 10.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Point"));
        assert!(json.contains("5"));
        assert!(json.contains("10"));
    }

    #[test]
    fn test_point_undo_redo() {
        let mut k = Kernel::new();
        k.create_point(1.0, 2.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        assert!(k.undo());
        assert_eq!(k.entity_count(), 0);
        assert!(k.redo());
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_create_revision_cloud() {
        let mut k = Kernel::new();
        let coords = "[0,0,10,0,10,10,0,10]";
        let id = k.create_revision_cloud(coords, 0.5, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let json = k.get_entity_json(&id);
        assert!(json.contains("RevisionCloud"));
        assert!(json.contains("arc_length"));
    }

    #[test]
    fn test_revision_cloud_via_command() {
        let mut k = Kernel::new();
        let result_json = k.execute_command(
            r#"{"type":"CreateRevisionCloud","vertices":[[0,0],[10,0],[10,10],[0,10]],"arc_length":0.5,"layer_id":"layer_0"}"#,
        );
        let result: CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(result.success);
        assert_eq!(result.created_ids.len(), 1);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_revision_cloud_undo_redo() {
        let mut k = Kernel::new();
        k.create_revision_cloud("[0,0,10,0,10,10,0,10]", 0.5, "layer_0");
        assert_eq!(k.entity_count(), 1);
        assert!(k.undo());
        assert_eq!(k.entity_count(), 0);
        assert!(k.redo());
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_revision_cloud_default_arc_length() {
        let mut k = Kernel::new();
        let result_json = k.execute_command(
            r#"{"type":"CreateRevisionCloud","vertices":[[0,0],[10,0],[10,10]],"layer_id":"layer_0"}"#,
        );
        let result: CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(result.success);
        let json = k.get_entity_json(&result.created_ids[0]);
        assert!(json.contains("0.5"));
    }

    #[test]
    fn test_point_via_command() {
        let mut k = Kernel::new();
        let result_json =
            k.execute_command(r#"{"type":"CreatePoint","x":3.0,"y":4.0,"layer_id":"layer_0"}"#);
        let result: CommandResult = serde_json::from_str(&result_json).unwrap();
        assert!(result.success);
        assert_eq!(result.created_ids.len(), 1);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_point_move() {
        let mut k = Kernel::new();
        let id = k.create_point(5.0, 10.0, "layer_0");
        k.move_entity(&id, 3.0, -2.0);
        let json = k.get_entity_json(&id);
        assert!(json.contains("8")); // 5 + 3
    }

    #[test]
    fn test_match_properties() {
        let mut k = Kernel::new();
        let layer_id = k.create_layer("Red", "#ff0000");
        let src = k.create_line(0.0, 0.0, 10.0, 10.0, &layer_id);
        let cmd_json = serde_json::to_string(&Command::SetEntityColor {
            id: src.clone(),
            color: Some("#00ff00".to_string()),
        })
        .unwrap();
        let _ = k.execute_command(&cmd_json);
        let cmd_json2 = serde_json::to_string(&Command::SetEntityLinetype {
            id: src.clone(),
            linetype: Some("DASHED".to_string()),
        })
        .unwrap();
        let _ = k.execute_command(&cmd_json2);
        let cmd_json3 = serde_json::to_string(&Command::SetEntityLineweight {
            id: src.clone(),
            lineweight: Some(0.5),
        })
        .unwrap();
        let _ = k.execute_command(&cmd_json3);

        let tgt = k.create_line(20.0, 20.0, 30.0, 30.0, "layer_0");

        let match_cmd = serde_json::to_string(&Command::MatchProperties {
            source_id: src.clone(),
            target_ids: vec![tgt.clone()],
        })
        .unwrap();
        let result: CommandResult = serde_json::from_str(&k.execute_command(&match_cmd)).unwrap();
        assert!(result.success);

        let tgt_json = k.get_entity_json(&tgt);
        assert!(tgt_json.contains("#00ff00"));
        assert!(tgt_json.contains("DASHED"));
        assert!(tgt_json.contains("0.5"));
        assert!(tgt_json.contains(&layer_id));
    }

    #[test]
    fn test_lengthen_line_delta_end() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let ok = k.lengthen_entity(&id, "delta", 5.0, "end");
        assert!(ok);
        let json = k.get_entity_json(&id);
        assert!(json.contains("15.0"));
    }

    #[test]
    fn test_lengthen_line_delta_start() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let ok = k.lengthen_entity(&id, "delta", 5.0, "start");
        assert!(ok);
        let json = k.get_entity_json(&id);
        assert!(json.contains("-5.0"));
    }

    #[test]
    fn test_lengthen_line_percent() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let ok = k.lengthen_entity(&id, "percent", 200.0, "end");
        assert!(ok);
        let json = k.get_entity_json(&id);
        assert!(json.contains("20.0"));
    }

    #[test]
    fn test_lengthen_line_total() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let ok = k.lengthen_entity(&id, "total", 20.0, "end");
        assert!(ok);
        let json = k.get_entity_json(&id);
        assert!(json.contains("20.0"));
    }

    #[test]
    fn test_lengthen_arc() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 0.0, std::f64::consts::FRAC_PI_2, "layer_0");
        let arc_len = 5.0 * std::f64::consts::FRAC_PI_2;
        let ok = k.lengthen_entity(&id, "total", arc_len * 2.0, "end");
        assert!(ok);
        let json = k.get_entity_json(&id);
        assert!(json.contains("Arc"));
    }

    #[test]
    fn test_lengthen_undo() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.lengthen_entity(&id, "delta", 5.0, "end");
        let json_after = k.get_entity_json(&id);
        assert!(json_after.contains("15.0"));
        k.undo();
        let json_undone = k.get_entity_json(&id);
        assert!(json_undone.contains("\"x\":10.0"));
    }

    #[test]
    fn test_lengthen_invalid_mode() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let ok = k.lengthen_entity(&id, "invalid", 5.0, "end");
        assert!(!ok);
    }

    #[test]
    fn test_lengthen_circle_fails() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "layer_0");
        let ok = k.lengthen_entity(&id, "delta", 5.0, "end");
        assert!(!ok);
    }

    #[test]
    fn test_break_line_at_midpoint() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let r = k.break_at_point(&id, 5.0, 0.0);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 2);
        assert_eq!(k.entity_count(), 2);
        let j1 = k.get_entity_json(&r.created_ids[0]);
        let j2 = k.get_entity_json(&r.created_ids[1]);
        assert!(j1.contains("Line"));
        assert!(j2.contains("Line"));
    }

    #[test]
    fn test_break_arc_at_point() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 5.0, 0.0, std::f64::consts::PI, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let r = k.break_at_point(&id, 0.0, 5.0);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 2);
        assert_eq!(k.entity_count(), 2);
        let j1 = k.get_entity_json(&r.created_ids[0]);
        let j2 = k.get_entity_json(&r.created_ids[1]);
        assert!(j1.contains("Arc"));
        assert!(j2.contains("Arc"));
    }

    #[test]
    fn test_break_circle_to_arc() {
        let mut k = Kernel::new();
        let id = k.create_circle(0.0, 0.0, 5.0, "layer_0");
        assert_eq!(k.entity_count(), 1);
        let r = k.break_at_point(&id, 5.0, 0.0);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 1);
        assert_eq!(k.entity_count(), 1);
        let j = k.get_entity_json(&r.created_ids[0]);
        assert!(j.contains("Arc"));
    }

    #[test]
    fn test_break_line_two_points() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let r = k.break_two_points(&id, 3.0, 0.0, 7.0, 0.0);
        assert!(r.success);
        assert_eq!(r.created_ids.len(), 2);
        assert_eq!(k.entity_count(), 2);
    }

    #[test]
    fn test_break_undo_restores() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let r = k.break_at_point(&id, 5.0, 0.0);
        assert!(r.success);
        assert_eq!(k.entity_count(), 2);
        let ok = k.undo();
        assert!(ok);
        assert_eq!(k.entity_count(), 1);
    }

    #[test]
    fn test_default_text_style_exists() {
        let k = Kernel::new();
        assert!(k.text_styles.contains_key("Standard"));
        assert_eq!(k.current_text_style, "Standard");
        let json = k.get_text_styles_json();
        assert!(json.contains("Standard"));
    }

    #[test]
    fn test_create_text_style() {
        let mut k = Kernel::new();
        let r = k.execute_command(
            r#"{"type":"CreateTextStyle","name":"Title","font_family":"Arial","height":5.0}"#,
        );
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(result.success);
        assert!(k.text_styles.contains_key("Title"));
        let style = k.text_styles.get("Title").unwrap();
        assert_eq!(style.font_family, "Arial");
        assert_eq!(style.height, 5.0);
        assert_eq!(style.width_factor, 1.0);
    }

    #[test]
    fn test_create_duplicate_text_style_fails() {
        let mut k = Kernel::new();
        let r = k.execute_command(r#"{"type":"CreateTextStyle","name":"Standard"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(!result.success);
    }

    #[test]
    fn test_modify_text_style() {
        let mut k = Kernel::new();
        let r = k.execute_command(r#"{"type":"ModifyTextStyle","name":"Standard","font_family":"monospace","height":3.0,"is_bold":true}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(result.success);
        let style = k.text_styles.get("Standard").unwrap();
        assert_eq!(style.font_family, "monospace");
        assert_eq!(style.height, 3.0);
        assert!(style.is_bold);
    }

    #[test]
    fn test_delete_text_style() {
        let mut k = Kernel::new();
        k.execute_command(r#"{"type":"CreateTextStyle","name":"ToDelete"}"#);
        assert!(k.text_styles.contains_key("ToDelete"));
        let r = k.execute_command(r#"{"type":"DeleteTextStyle","name":"ToDelete"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(result.success);
        assert!(!k.text_styles.contains_key("ToDelete"));
    }

    #[test]
    fn test_delete_standard_fails() {
        let mut k = Kernel::new();
        let r = k.execute_command(r#"{"type":"DeleteTextStyle","name":"Standard"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(!result.success);
    }

    #[test]
    fn test_delete_in_use_text_style_fails() {
        let mut k = Kernel::new();
        k.execute_command(r#"{"type":"CreateTextStyle","name":"InUse"}"#);
        // Create a text entity using this style
        let id = k.create_text(0.0, 0.0, "test", 2.5, 0.0, "layer_0");
        // Manually set the style_name
        if let Some(mut geo) = k.ecs_world.get_geometry(&id) {
            if let entity::GeometryType::Text { style_name, .. } = &mut geo {
                *style_name = Some("InUse".to_string());
                k.ecs_world.set_geometry(&id, geo);
            }
        }
        let r = k.execute_command(r#"{"type":"DeleteTextStyle","name":"InUse"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(!result.success);
    }

    #[test]
    fn test_set_current_text_style() {
        let mut k = Kernel::new();
        k.execute_command(r#"{"type":"CreateTextStyle","name":"Header"}"#);
        let r = k.execute_command(r#"{"type":"SetCurrentTextStyle","name":"Header"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(result.success);
        assert_eq!(k.current_text_style, "Header");
    }

    #[test]
    fn test_set_current_nonexistent_fails() {
        let mut k = Kernel::new();
        let r = k.execute_command(r#"{"type":"SetCurrentTextStyle","name":"Nope"}"#);
        let result: CommandResult = serde_json::from_str(&r).unwrap();
        assert!(!result.success);
    }

    #[test]
    fn test_text_style_applied_to_text() {
        let mut k = Kernel::new();
        k.execute_command(r#"{"type":"CreateTextStyle","name":"Annotate","font_family":"Arial","height":4.0,"width_factor":0.8,"oblique_angle":15.0}"#);
        let style = k.text_styles.get("Annotate").unwrap();
        assert_eq!(style.font_family, "Arial");
        assert_eq!(style.height, 4.0);
        assert!((style.width_factor - 0.8).abs() < 0.001);
        assert!((style.oblique_angle - 15.0).abs() < 0.001);
    }

    #[test]
    fn spatial_index_rebuilds_after_create() {
        let mut k = Kernel::new();
        assert_eq!(k.spatial_idx.entity_count(), 0);
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        assert_eq!(k.spatial_idx.entity_count(), 1);
        k.create_circle(50.0, 50.0, 5.0, "layer_0");
        assert_eq!(k.spatial_idx.entity_count(), 2);
        let id = k.create_rectangle(100.0, 100.0, 10.0, 10.0, "layer_0");
        assert_eq!(k.spatial_idx.entity_count(), 3);
        k.delete_entity(&id);
        assert_eq!(k.spatial_idx.entity_count(), 2);
    }

    #[test]
    fn get_events_json_returns_events() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        let json = k.get_events_json(0);
        let events: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["seq"].as_u64().unwrap(), 0);
        assert_eq!(events[1]["seq"].as_u64().unwrap(), 1);
    }

    #[test]
    fn get_events_json_with_offset() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        let json = k.get_events_json(1);
        let events: Vec<serde_json::Value> = serde_json::from_str(&json).unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["seq"].as_u64().unwrap(), 1);
    }

    #[test]
    fn get_undo_stack_json_returns_cursor_info() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.create_circle(5.0, 5.0, 3.0, "layer_0");
        k.undo();
        let json = k.get_undo_stack_json();
        let info: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(info["total"].as_u64().unwrap(), 2);
        assert_eq!(info["cursor"].as_u64().unwrap(), 1);
        assert!(info["can_undo"].as_bool().unwrap());
        assert!(info["can_redo"].as_bool().unwrap());
    }

    #[test]
    fn spatial_index_query_window_filters() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        k.create_circle(50.0, 50.0, 5.0, "layer_0");
        k.create_rectangle(100.0, 100.0, 10.0, 10.0, "layer_0");

        // Window that only overlaps the line
        let result_json = k.query_spatial_window(-1.0, -1.0, 11.0, 1.0);
        let ids: Vec<String> = serde_json::from_str(&result_json).unwrap();
        assert_eq!(ids.len(), 1);

        // Window that covers everything
        let result_json = k.query_spatial_window(-10.0, -10.0, 200.0, 200.0);
        let ids: Vec<String> = serde_json::from_str(&result_json).unwrap();
        assert_eq!(ids.len(), 3);

        // Nearest to origin with large radius — finds the line
        let nearest_json = k.query_spatial_nearest(0.0, 0.0, 100.0);
        let nearest: Option<String> = serde_json::from_str(&nearest_json).unwrap();
        assert!(nearest.is_some());

        // Nearest with zero radius at a point far from everything — finds nothing
        let nearest_json = k.query_spatial_nearest(500.0, 500.0, 1.0);
        let nearest: Option<String> = serde_json::from_str(&nearest_json).unwrap();
        assert!(nearest.is_none());
    }

    #[test]
    fn zero_length_line_rejected_by_add_entity() {
        let mut k = Kernel::new();
        let result_json = k.execute_command(
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":0.0,"y2":0.0,"layer_id":"layer_0"}"#,
        );
        let result: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let created = result["created_ids"].as_array().unwrap();
        assert!(
            created.is_empty() || created[0].as_str() == Some(""),
            "Expected degenerate zero-length line to be rejected, got: {}",
            result_json
        );
    }

    #[test]
    fn valid_line_has_no_warnings() {
        let mut k = Kernel::new();
        let result_json = k.execute_command(
            r#"{"type":"CreateLine","x1":0.0,"y1":0.0,"x2":100.0,"y2":50.0,"layer_id":"layer_0"}"#,
        );
        let result: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let warnings = result["warnings"].as_array();
        assert!(
            warnings.map(|w| w.is_empty()).unwrap_or(true),
            "Expected no warnings for valid line, got: {}",
            result_json
        );
    }

    #[test]
    fn zero_radius_circle_rejected_by_add_entity() {
        let mut k = Kernel::new();
        let result_json = k.execute_command(
            r#"{"type":"CreateCircle","cx":0.0,"cy":0.0,"radius":0.0,"layer_id":"layer_0"}"#,
        );
        let result: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        let created = result["created_ids"].as_array().unwrap();
        assert!(
            created.is_empty() || created[0].as_str() == Some(""),
            "Expected degenerate zero-radius circle to be rejected, got: {}",
            result_json
        );
    }

    #[test]
    fn snap_uses_spatial_index() {
        let mut k = Kernel::new();
        for i in 0..100 {
            let x = (i as f64) * 10.0;
            k.execute_command(&format!(
                r#"{{"type":"CreateLine","x1":{},"y1":0,"x2":{},"y2":10,"layer_id":"layer_0"}}"#,
                x, x
            ));
        }
        let cursor = entity::Point2D::new(50.0, 5.0);
        let from = entity::Point2D::new(50.0, 0.0);
        let threshold = 20.0;
        let candidate_ids = k.spatial_idx.query_window(
            [cursor.x - threshold, cursor.y - threshold],
            [cursor.x + threshold, cursor.y + threshold],
        );
        let mut found = false;
        for cid in &candidate_ids {
            if let Some(ent) = k.ecs_world.to_entity(cid) {
                if snaps::find_perpendicular_snap(&cursor, Some(&from), &ent.geometry, threshold)
                    .is_some()
                {
                    found = true;
                    break;
                }
            }
        }
        assert!(found, "spatial index query should find the line at x=50");
    }

    // ── K6: validate_entity extended tests ──────────────────────────────────

    #[test]
    fn validate_zero_length_line_rejected() {
        let mut k = Kernel::new();
        let id = k.create_line(5.0, 5.0, 5.0, 5.0, "layer_0");
        assert!(
            id.is_empty(),
            "Expected zero-length line to be rejected, got id: {:?}",
            id
        );
    }

    #[test]
    fn validate_degenerate_polyline_rejected() {
        let mut k = Kernel::new();
        let id = k.create_polyline("[0,0]", false, "layer_0");
        assert!(
            id.is_empty(),
            "Expected degenerate polyline to be rejected, got id: {:?}",
            id
        );
    }

    #[test]
    fn validate_zero_dimension_rectangle_rejected() {
        let mut k = Kernel::new();
        let eid = k.gen_id();
        let result = k.add_entity(entity::Entity {
            id: eid.clone(),
            geometry: entity::GeometryType::Rectangle {
                origin: entity::Point2D::new(0.0, 0.0),
                width: 0.0,
                height: 5.0,
                rotation: 0.0,
            },
            layer_id: "layer_0".to_string(),
            style: Default::default(),
            draw_order: 0,
        });
        assert!(
            result.is_empty(),
            "Expected zero-width rectangle to be rejected, got id: {:?}",
            result
        );
    }

    #[test]
    fn validate_spline_degree_exceeds_points() {
        let mut k = Kernel::new();
        let eid = k.gen_id();
        k.add_entity(entity::Entity {
            id: eid.clone(),
            geometry: entity::GeometryType::Spline {
                control_points: vec![
                    entity::Point2D::new(0.0, 0.0),
                    entity::Point2D::new(1.0, 1.0),
                ],
                degree: 3,
                closed: false,
            },
            layer_id: "layer_0".to_string(),
            style: Default::default(),
            draw_order: 0,
        });
        let warnings = k.validate_entity(&eid);
        assert!(
            warnings.iter().any(|w| w.contains("degree")),
            "Expected degree warning, got: {:?}",
            warnings
        );
    }

    #[test]
    fn validate_empty_text() {
        let mut k = Kernel::new();
        let eid = k.gen_id();
        k.add_entity(entity::Entity {
            id: eid.clone(),
            geometry: entity::GeometryType::Text {
                position: entity::Point2D::new(0.0, 0.0),
                content: String::new(),
                height: 2.5,
                rotation: 0.0,
                style_name: None,
            },
            layer_id: "layer_0".to_string(),
            style: Default::default(),
            draw_order: 0,
        });
        let warnings = k.validate_entity(&eid);
        assert!(
            warnings.iter().any(|w| w.contains("Empty text")),
            "Expected empty text warning, got: {:?}",
            warnings
        );
    }

    #[test]
    fn validate_ellipse_semi_minor_exceeds_major() {
        let mut k = Kernel::new();
        let eid = k.gen_id();
        k.add_entity(entity::Entity {
            id: eid.clone(),
            geometry: entity::GeometryType::Ellipse {
                center: entity::Point2D::new(0.0, 0.0),
                semi_major: 3.0,
                semi_minor: 5.0,
                rotation: 0.0,
            },
            layer_id: "layer_0".to_string(),
            style: Default::default(),
            draw_order: 0,
        });
        let warnings = k.validate_entity(&eid);
        assert!(
            warnings.iter().any(|w| w.contains("semi-minor exceeds")),
            "Expected semi-minor exceeds warning, got: {:?}",
            warnings
        );
    }

    #[test]
    fn validate_valid_entities_no_warnings() {
        let mut k = Kernel::new();
        let line_id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let circle_id = k.create_circle(0.0, 0.0, 5.0, "layer_0");
        assert!(
            k.validate_entity(&line_id).is_empty(),
            "Valid line should have no warnings"
        );
        assert!(
            k.validate_entity(&circle_id).is_empty(),
            "Valid circle should have no warnings"
        );
    }

    // ── K8: offset Arc/Ellipse/Rectangle tests ─────────────────────────────

    #[test]
    fn test_offset_arc() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 10.0, 0.0, std::f64::consts::PI, "layer_0");
        let new_id = k
            .offset_entity(&id, 3.0)
            .expect("offset arc should succeed");
        let json = k.get_entity_json(&new_id);
        assert!(json.contains("13.0"), "Expected radius 13, got: {}", json);
    }

    #[test]
    fn test_offset_arc_negative_radius_fails() {
        let mut k = Kernel::new();
        let id = k.create_arc(0.0, 0.0, 2.0, 0.0, std::f64::consts::PI, "layer_0");
        let result = k.offset_entity(&id, -5.0);
        assert!(result.is_err(), "Expected Err for negative radius offset");
        assert!(
            result.unwrap_err().contains("negative radius"),
            "Error should mention negative radius"
        );
    }

    #[test]
    fn test_offset_rectangle() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 10.0, 6.0, "layer_0");
        let new_id = k
            .offset_entity(&id, 2.0)
            .expect("offset rectangle should succeed");
        let json = k.get_entity_json(&new_id);
        assert!(json.contains("14.0"), "Expected width 14, got: {}", json);
    }

    #[test]
    fn test_offset_ellipse() {
        let mut k = Kernel::new();
        let id = k.create_ellipse(0.0, 0.0, 10.0, 5.0, 0.0, "layer_0");
        let new_id = k
            .offset_entity(&id, 2.0)
            .expect("offset ellipse should succeed");
        let json = k.get_entity_json(&new_id);
        assert!(
            json.contains("12.0"),
            "Expected semi_major 12, got: {}",
            json
        );
    }

    #[test]
    fn test_offset_unsupported_type_returns_error() {
        let mut k = Kernel::new();
        let id = k.create_point(5.0, 5.0, "layer_0");
        let result = k.offset_entity(&id, 2.0);
        assert!(result.is_err(), "Expected Err for unsupported type");
        assert!(
            result.unwrap_err().contains("not supported"),
            "Error should mention 'not supported'"
        );
    }

    #[test]
    fn offset_rectangle_creates_larger_rectangle() {
        let mut k = Kernel::new();
        let id = k.create_rectangle(0.0, 0.0, 10.0, 8.0, "layer_0");
        let result = k.offset_entity(&id, 2.0);
        assert!(
            result.is_ok(),
            "Offset rectangle should succeed: {:?}",
            result
        );
        let new_id = result.unwrap();
        assert!(!new_id.is_empty());
        let ent = k.ecs_world.to_entity(&new_id).unwrap();
        match &ent.geometry {
            entity::GeometryType::Rectangle {
                origin,
                width,
                height,
                ..
            } => {
                assert!(
                    (width - 14.0).abs() < 0.01,
                    "Width should be 14, got {}",
                    width
                );
                assert!(
                    (height - 12.0).abs() < 0.01,
                    "Height should be 12, got {}",
                    height
                );
                assert!(
                    (origin.x - (-2.0)).abs() < 0.01,
                    "Origin x should be -2, got {}",
                    origin.x
                );
                assert!(
                    (origin.y - (-2.0)).abs() < 0.01,
                    "Origin y should be -2, got {}",
                    origin.y
                );
            }
            other => panic!("Expected Rectangle, got {:?}", other),
        }
    }

    #[test]
    fn fillet_radius_zero_trims_lines_to_intersection() {
        let mut k = Kernel::new();
        let id_a = k.create_line(0.0, 0.0, 10.0, 5.0, "layer_0");
        let id_b = k.create_line(10.0, 0.0, 0.0, 5.0, "layer_0");
        let result = k.fillet(&id_a, &id_b, 0.0);
        assert!(result.success, "Fillet r=0 should succeed");
        let ent_a = k.ecs_world.to_entity(&id_a).unwrap();
        let ent_b = k.ecs_world.to_entity(&id_b).unwrap();
        match (&ent_a.geometry, &ent_b.geometry) {
            (
                entity::GeometryType::Line { start: sa, end: ea },
                entity::GeometryType::Line { start: sb, end: eb },
            ) => {
                let ix = 5.0;
                let iy = 2.5;
                let a_has_ip = ((sa.x - ix).abs() < 0.1 && (sa.y - iy).abs() < 0.1)
                    || ((ea.x - ix).abs() < 0.1 && (ea.y - iy).abs() < 0.1);
                let b_has_ip = ((sb.x - ix).abs() < 0.1 && (sb.y - iy).abs() < 0.1)
                    || ((eb.x - ix).abs() < 0.1 && (eb.y - iy).abs() < 0.1);
                assert!(
                    a_has_ip,
                    "Line A should have endpoint at intersection (5, 2.5), got {:?}-{:?}",
                    sa, ea
                );
                assert!(
                    b_has_ip,
                    "Line B should have endpoint at intersection (5, 2.5), got {:?}-{:?}",
                    sb, eb
                );
            }
            _ => panic!("Expected two lines"),
        }
    }

    fn exec(k: &mut Kernel, json: &str) -> serde_json::Value {
        let r = k.execute_command(json);
        serde_json::from_str(&r).unwrap()
    }

    #[test]
    fn ecs_world_stays_in_sync_with_entities() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":0,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"CreateCircle","cx":5,"cy":5,"radius":3,"layer_id":"layer_0"}"#,
        );
        assert_eq!(k.ecs_world.entity_count(), k.entity_count());

        exec(
            &mut k,
            r#"{"type":"MoveEntity","id":"ent_1","dx":5,"dy":5}"#,
        );

        let hm_json = k.get_entities_json();
        let ecs_json = k.ecs_world.to_entities_json();
        let mut hm_val: Vec<serde_json::Value> = serde_json::from_str(&hm_json).unwrap();
        let mut ecs_val: Vec<serde_json::Value> = serde_json::from_str(&ecs_json).unwrap();
        hm_val.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
        ecs_val.sort_by(|a, b| a["id"].as_str().cmp(&b["id"].as_str()));
        assert_eq!(hm_val, ecs_val);

        exec(&mut k, r#"{"type":"DeleteEntity","id":"ent_1"}"#);
        assert_eq!(k.ecs_world.entity_count(), k.entity_count());
        assert_eq!(k.ecs_world.entity_count(), 1);

        exec(&mut k, r#"{"type":"Undo"}"#);
        assert_eq!(k.ecs_world.entity_count(), k.entity_count());
        assert_eq!(k.ecs_world.entity_count(), 2);

        exec(&mut k, r#"{"type":"Redo"}"#);
        assert_eq!(k.ecs_world.entity_count(), k.entity_count());
        assert_eq!(k.ecs_world.entity_count(), 1);
    }

    #[test]
    fn ecs_world_sync_through_copy_and_mirror() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":5,"y1":1,"x2":10,"y2":1,"layer_id":"layer_0"}"#,
        );
        exec(&mut k, r#"{"type":"CopyEntity","id":"ent_1"}"#);
        assert_eq!(k.ecs_world.entity_count(), 2);

        exec(
            &mut k,
            r#"{"type":"MirrorEntity","id":"ent_1","x1":0,"y1":0,"x2":0,"y2":10}"#,
        );
        assert_eq!(k.ecs_world.entity_count(), 3);
        assert_eq!(k.ecs_world.entity_count(), k.entity_count());
    }

    #[test]
    fn ecs_world_sync_through_constraints() {
        let mut k = Kernel::new();
        exec(
            &mut k,
            r#"{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":5,"layer_id":"layer_0"}"#,
        );
        exec(
            &mut k,
            r#"{"type":"AddConstraintHorizontal","entity_id":"ent_1"}"#,
        );
        let hm_json = k.get_entities_json();
        let ecs_json = k.ecs_world.to_entities_json();
        let hm_val: Vec<serde_json::Value> = serde_json::from_str(&hm_json).unwrap();
        let ecs_val: Vec<serde_json::Value> = serde_json::from_str(&ecs_json).unwrap();
        assert_eq!(hm_val[0]["geometry"], ecs_val[0]["geometry"]);
    }

    #[test]
    fn undo_syncs_hecs_world() {
        let mut k = Kernel::new();
        k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        assert_eq!(k.ecs_world.entity_count(), 1);

        k.undo();
        assert_eq!(
            k.ecs_world.entity_count(),
            0,
            "hecs world should have 0 entities after undo"
        );

        k.redo();
        assert_eq!(
            k.ecs_world.entity_count(),
            1,
            "hecs world should have 1 entity after redo"
        );
    }

    #[test]
    fn test_preview_command_create_line() {
        let k = Kernel::new();
        let result_json = k.preview_command(
            &serde_json::json!({
                "type": "CreateLine",
                "x1": 0.0, "y1": 0.0, "x2": 10.0, "y2": 5.0,
                "layer_id": "layer_0"
            })
            .to_string(),
        );
        let parsed: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        assert_eq!(parsed["success"], true);
        assert_eq!(parsed["preview_entities"].as_array().unwrap().len(), 1);
        // Original kernel unchanged
        assert_eq!(k.entity_count(), 0);
    }

    #[test]
    fn test_preview_command_offset() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");
        let count_before = k.entity_count();

        let result_json = k.preview_command(
            &serde_json::json!({
                "type": "OffsetEntity",
                "id": id,
                "distance": 5.0
            })
            .to_string(),
        );
        let parsed: serde_json::Value = serde_json::from_str(&result_json).unwrap();
        assert_eq!(parsed["success"], true);
        assert!(!parsed["preview_entities"].as_array().unwrap().is_empty());
        // Original kernel unchanged
        assert_eq!(k.entity_count(), count_before);
    }

    #[test]
    fn test_preview_command_does_not_mutate() {
        let mut k = Kernel::new();
        let id = k.create_line(0.0, 0.0, 10.0, 0.0, "layer_0");

        // Preview a move — should NOT change entity position
        k.preview_command(
            &serde_json::json!({
                "type": "MoveEntity",
                "id": id,
                "dx": 100.0, "dy": 100.0
            })
            .to_string(),
        );

        // Verify entity still at original position
        let entity_json = k.get_entity_json(&id);
        let entity: serde_json::Value = serde_json::from_str(&entity_json).unwrap();
        assert_eq!(entity["geometry"]["Line"]["start"]["x"], 0.0);
        assert_eq!(entity["geometry"]["Line"]["end"]["x"], 10.0);
    }
}
