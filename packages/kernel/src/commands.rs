use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use tsify::Tsify;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct CommandResult {
    pub success: bool,
    pub created_ids: Vec<String>,
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub measurement: Option<f64>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
#[serde(tag = "type")]
pub enum Command {
    // Drawing
    CreatePoint {
        x: f64,
        y: f64,
        layer_id: String,
    },
    CreateLine {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        layer_id: String,
    },
    CreateCircle {
        cx: f64,
        cy: f64,
        radius: f64,
        layer_id: String,
    },
    CreateArc {
        cx: f64,
        cy: f64,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
        layer_id: String,
    },
    CreateRectangle {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        layer_id: String,
    },
    CreatePolyline {
        vertices: Vec<(f64, f64)>,
        closed: bool,
        layer_id: String,
    },
    // Editing
    DeleteEntity {
        id: String,
    },
    MoveEntity {
        id: String,
        dx: f64,
        dy: f64,
    },
    RotateEntity {
        id: String,
        cx: f64,
        cy: f64,
        angle: f64,
    },
    ScaleEntity {
        id: String,
        cx: f64,
        cy: f64,
        factor: f64,
    },
    CopyEntity {
        id: String,
    },
    MirrorEntity {
        id: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    OffsetEntity {
        id: String,
        distance: f64,
    },
    TrimEntity {
        id: String,
        boundary_id: String,
        pick_x: f64,
        pick_y: f64,
    },
    ModifyGeometry {
        id: String,
        geometry_json: String,
    },
    // Layers
    CreateLayer {
        name: String,
        color: String,
    },
    DeleteLayer {
        id: String,
    },
    SetLayerVisible {
        id: String,
        visible: bool,
    },
    SetLayerLocked {
        id: String,
        locked: bool,
    },
    SetLayerColor {
        id: String,
        color: String,
    },
    RenameLayer {
        id: String,
        name: String,
    },
    SetEntityLayer {
        entity_id: String,
        layer_id: String,
    },
    // Constraints
    AddConstraintHorizontal {
        entity_id: String,
    },
    AddConstraintVertical {
        entity_id: String,
    },
    AddConstraintCoincident {
        entity_a: String,
        point_a: usize,
        entity_b: String,
        point_b: usize,
    },
    AddConstraintDistance {
        entity_a: String,
        point_a: usize,
        entity_b: String,
        point_b: usize,
        distance: f64,
    },
    AddConstraintFixed {
        entity_id: String,
        point_index: usize,
        x: f64,
        y: f64,
    },
    AddConstraintParallel {
        entity_a: String,
        entity_b: String,
    },
    AddConstraintPerpendicular {
        entity_a: String,
        entity_b: String,
    },
    RemoveConstraint {
        id: String,
    },
    // Text & Dimensions
    CreateText {
        x: f64,
        y: f64,
        content: String,
        height: f64,
        rotation: f64,
        layer_id: String,
    },
    CreateDimension {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        offset: f64,
        layer_id: String,
    },
    // Blocks
    CreateBlock {
        name: String,
        base_x: f64,
        base_y: f64,
        entity_ids: Vec<String>,
    },
    InsertBlock {
        block_id: String,
        x: f64,
        y: f64,
        rotation: f64,
        scale_x: f64,
        scale_y: f64,
        layer_id: String,
    },
    ExplodeBlock {
        entity_id: String,
    },
    // Dimension types
    CreateAlignedDimension {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        offset: f64,
        layer_id: String,
    },
    CreateAngularDimension {
        cx: f64,
        cy: f64,
        sx: f64,
        sy: f64,
        ex: f64,
        ey: f64,
        radius: f64,
        layer_id: String,
    },
    CreateRadialDimension {
        cx: f64,
        cy: f64,
        px: f64,
        py: f64,
        layer_id: String,
    },
    CreateDiameterDimension {
        cx: f64,
        cy: f64,
        px: f64,
        py: f64,
        layer_id: String,
    },
    // Measurement
    MeasureDistance {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    MeasureArea {
        entity_id: String,
    },
    // New geometry
    CreateEllipse {
        cx: f64,
        cy: f64,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
        layer_id: String,
    },
    CreateSpline {
        control_points: Vec<(f64, f64)>,
        degree: u8,
        closed: bool,
        layer_id: String,
    },
    CreateConstructionLine {
        ox: f64,
        oy: f64,
        dx: f64,
        dy: f64,
        layer_id: String,
    },
    // Array
    ArrayRectangular {
        entity_ids: Vec<String>,
        rows: u32,
        cols: u32,
        row_spacing: f64,
        col_spacing: f64,
    },
    ArrayPolar {
        entity_ids: Vec<String>,
        center_x: f64,
        center_y: f64,
        count: u32,
        angle: f64,
        rotate_items: bool,
    },
    // Constraints — additional
    AddConstraintEqualLength {
        entity_a: String,
        entity_b: String,
    },
    AddConstraintTangent {
        line_entity: String,
        circle_entity: String,
    },
    AddConstraintConcentric {
        entity_a: String,
        entity_b: String,
    },
    AddConstraintSymmetric {
        entity_id: String,
        axis_entity: String,
    },
    AnalyzeDof,
    // Editing — advanced
    Fillet {
        id_a: String,
        id_b: String,
        radius: f64,
    },
    Chamfer {
        id_a: String,
        id_b: String,
        dist_a: f64,
        dist_b: f64,
    },
    Explode {
        entity_id: String,
    },
    ExtendEntity {
        id: String,
        boundary_id: String,
    },
    JoinEntities {
        ids: Vec<String>,
    },
    // Style
    SetEntityColor {
        id: String,
        color: Option<String>,
    },
    SetEntityLinetype {
        id: String,
        linetype: Option<String>,
    },
    SetEntityLineweight {
        id: String,
        lineweight: Option<f64>,
    },
    SetLayerLinetype {
        id: String,
        linetype: Option<String>,
    },
    SetLayerLineweight {
        id: String,
        lineweight: Option<f64>,
    },
    // Hatch/MText/Table
    CreateHatch {
        boundary_ids: Vec<String>,
        pattern: String,
        scale: f64,
        angle: f64,
        layer_id: String,
    },
    CreateMText {
        x: f64,
        y: f64,
        content: String,
        width: f64,
        height: f64,
        rotation: f64,
        layer_id: String,
    },
    CreateTable {
        x: f64,
        y: f64,
        rows: u32,
        cols: u32,
        row_height: f64,
        col_widths: Vec<f64>,
        cells: Vec<String>,
        layer_id: String,
    },
    // Property transfer
    MatchProperties {
        source_id: String,
        target_ids: Vec<String>,
    },
    // Lengthen
    Lengthen {
        entity_id: String,
        mode: String,
        value: f64,
        end: String,
    },
    // Break
    BreakAtPoint {
        entity_id: String,
        px: f64,
        py: f64,
    },
    Break {
        entity_id: String,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
    },
    // Revision Cloud
    CreateRevisionCloud {
        vertices: Vec<(f64, f64)>,
        arc_length: Option<f64>,
        layer_id: String,
    },
    // Text styles
    CreateTextStyle {
        name: String,
        font_family: Option<String>,
        height: Option<f64>,
        width_factor: Option<f64>,
        oblique_angle: Option<f64>,
        is_bold: Option<bool>,
        is_italic: Option<bool>,
    },
    ModifyTextStyle {
        name: String,
        font_family: Option<String>,
        height: Option<f64>,
        width_factor: Option<f64>,
        oblique_angle: Option<f64>,
        is_bold: Option<bool>,
        is_italic: Option<bool>,
    },
    DeleteTextStyle {
        name: String,
    },
    SetCurrentTextStyle {
        name: String,
    },
    // Dimension styles
    CreateDimStyle {
        name: String,
        dimscale: Option<f64>,
        dimtxt: Option<f64>,
        dimasz: Option<f64>,
        dimexo: Option<f64>,
        dimexe: Option<f64>,
        dimgap: Option<f64>,
        dimtad: Option<i32>,
        dimclrt: Option<String>,
        dimclrd: Option<String>,
        dimclre: Option<String>,
        dimtxsty: Option<String>,
    },
    ModifyDimStyle {
        name: String,
        dimscale: Option<f64>,
        dimtxt: Option<f64>,
        dimasz: Option<f64>,
        dimexo: Option<f64>,
        dimexe: Option<f64>,
        dimgap: Option<f64>,
        dimtad: Option<i32>,
        dimclrt: Option<String>,
        dimclrd: Option<String>,
        dimclre: Option<String>,
        dimtxsty: Option<String>,
    },
    DeleteDimStyle {
        name: String,
    },
    SetCurrentDimStyle {
        name: String,
    },
    // MLeader styles
    CreateMLeaderStyle {
        name: String,
        arrow_size: Option<f64>,
        text_height: Option<f64>,
        text_style_name: Option<String>,
        landing_distance: Option<f64>,
        enable_landing: Option<bool>,
        enable_dogleg: Option<bool>,
        color: Option<String>,
    },
    ModifyMLeaderStyle {
        name: String,
        arrow_size: Option<f64>,
        text_height: Option<f64>,
        text_style_name: Option<String>,
        landing_distance: Option<f64>,
        enable_landing: Option<bool>,
        enable_dogleg: Option<bool>,
        color: Option<String>,
    },
    DeleteMLeaderStyle {
        name: String,
    },
    SetCurrentMLeaderStyle {
        name: String,
    },
    // Table styles
    CreateTableStyle {
        name: String,
        text_style_name: Option<String>,
        data_text_height: Option<f64>,
        header_text_height: Option<f64>,
        title_text_height: Option<f64>,
        has_title: Option<bool>,
        has_header: Option<bool>,
        cell_margin: Option<f64>,
        border_color: Option<String>,
        title_fill_color: Option<String>,
        header_fill_color: Option<String>,
    },
    ModifyTableStyle {
        name: String,
        text_style_name: Option<String>,
        data_text_height: Option<f64>,
        header_text_height: Option<f64>,
        title_text_height: Option<f64>,
        has_title: Option<bool>,
        has_header: Option<bool>,
        cell_margin: Option<f64>,
        border_color: Option<String>,
        title_fill_color: Option<String>,
        header_fill_color: Option<String>,
    },
    DeleteTableStyle {
        name: String,
    },
    SetCurrentTableStyle {
        name: String,
    },
    // Drawing properties (DWGPROPS)
    SetDwgProps {
        title: Option<String>,
        subject: Option<String>,
        author: Option<String>,
        keywords: Option<String>,
        comments: Option<String>,
        hyperlink_base: Option<String>,
        last_saved_by: Option<String>,
    },
    // Groups (AutoCAD GROUP / UNGROUP)
    CreateGroup {
        /// Optional name. None = auto-generate anonymous *AnonymousN.
        name: Option<String>,
        entity_ids: Vec<String>,
        #[serde(default)]
        selectable: Option<bool>,
    },
    DeleteGroup {
        name: String,
    },
    RenameGroup {
        old_name: String,
        new_name: String,
    },
    AddToGroup {
        name: String,
        entity_ids: Vec<String>,
    },
    RemoveFromGroup {
        name: String,
        entity_ids: Vec<String>,
    },
    SetGroupSelectable {
        name: String,
        selectable: bool,
    },
    // Named UCS
    SaveUcs {
        name: String,
        origin_x: f64,
        origin_y: f64,
        x_axis_x: f64,
        x_axis_y: f64,
        y_axis_x: f64,
        y_axis_y: f64,
    },
    DeleteUcs {
        name: String,
    },
    SetCurrentUcs {
        name: String,
    },
    // Named views (AutoCAD VIEW)
    SaveNamedView {
        name: String,
        center_x: f64,
        center_y: f64,
        zoom: f64,
        #[serde(default)]
        rotation: Option<f64>,
    },
    DeleteNamedView {
        name: String,
    },
    RenameNamedView {
        old_name: String,
        new_name: String,
    },
    // Circle construction modes
    CreateCircle3P {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        x3: f64,
        y3: f64,
        layer_id: String,
    },
    CreateCircle2P {
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        layer_id: String,
    },
    CreateCircleTtr {
        entity1_id: String,
        pick1_x: f64,
        pick1_y: f64,
        entity2_id: String,
        pick2_x: f64,
        pick2_y: f64,
        radius: f64,
        layer_id: String,
    },
    // Fillet polyline
    FilletPolyline {
        id: String,
        radius: f64,
    },
    // Offset through point
    OffsetEntityThrough {
        id: String,
        through_x: f64,
        through_y: f64,
    },
    // Ellipse arc
    CreateEllipseArc {
        cx: f64,
        cy: f64,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
        start_angle: f64,
        end_angle: f64,
        layer_id: String,
    },
    // Multi-line (parallel offset lines)
    CreateMline {
        vertices: Vec<(f64, f64)>,
        offsets: Vec<f64>,
        layer_id: String,
    },
    // Wipeout (opaque masking area)
    CreateWipeout {
        vertices: Vec<(f64, f64)>,
        layer_id: String,
    },
    // Overkill — remove overlapping geometry
    Overkill {
        ids: Vec<String>,
        tolerance: f64,
    },
    // Global linetype scale
    SetLtscale {
        scale: f64,
    },
    GetLtscale,
    // Ordinate dimension
    CreateOrdinateDimension {
        feature_x: f64,
        feature_y: f64,
        leader_end_x: f64,
        leader_end_y: f64,
        use_x_datum: bool,
        layer_id: String,
    },
    // Mass properties query
    MassProperties {
        entity_id: String,
    },
    // Tolerance (GD&T feature control frame)
    CreateTolerance {
        x: f64,
        y: f64,
        content: String,
        height: f64,
        layer_id: String,
    },
    // Write block to file
    WriteBlock {
        block_name: String,
        file_path: String,
    },
    // Block attribute definition
    CreateAttdef {
        x: f64,
        y: f64,
        tag: String,
        prompt: String,
        default_value: String,
        height: f64,
        layer_id: String,
    },
    // External reference
    AttachXref {
        file_path: String,
        x: f64,
        y: f64,
        scale: f64,
        layer_id: String,
    },
    // Block editor
    BeditEnter {
        block_id: String,
    },
    BeditExit,
    // Constraint bar toggle
    ToggleConstraintBar,
    // Plot/Print to PDF
    PlotToPdf {
        file_path: String,
        paper_width: f64,
        paper_height: f64,
        scale: f64,
    },
    // File operations
    SaveDrawing {
        file_path: String,
    },
    OpenDrawing {
        file_path: String,
    },
    // Boundary detection — find closed region at a point
    DetectBoundary {
        x: f64,
        y: f64,
        layer_id: String,
    },
    // Region — create 2D region from closed entity boundaries
    CreateRegion {
        boundary_ids: Vec<String>,
        layer_id: String,
    },
    // Auto-constrain — detect and apply geometric constraints
    AutoConstrain {
        ids: Vec<String>,
        tolerance: f64,
    },
    // Stretch — move vertices inside crossing window by displacement
    StretchEntities {
        ids: Vec<String>,
        window_x1: f64,
        window_y1: f64,
        window_x2: f64,
        window_y2: f64,
        dx: f64,
        dy: f64,
    },
    // Array along path
    ArrayPath {
        entity_ids: Vec<String>,
        path_id: String,
        count: u32,
        align_to_path: bool,
    },
    // Dimension continue (chain from previous dimension)
    DimContinue {
        prev_dim_id: String,
        x: f64,
        y: f64,
        layer_id: String,
    },
    // Dimension baseline (stacked from shared baseline)
    DimBaseline {
        base_dim_id: String,
        x: f64,
        y: f64,
        offset_increment: f64,
        layer_id: String,
    },
    // Align entities by point pairs
    AlignEntities {
        ids: Vec<String>,
        src1_x: f64,
        src1_y: f64,
        dst1_x: f64,
        dst1_y: f64,
        src2_x: Option<f64>,
        src2_y: Option<f64>,
        dst2_x: Option<f64>,
        dst2_y: Option<f64>,
    },
    // Purge unused layers, blocks, text styles
    PurgeUnused,
    // Regular polygon
    CreatePolygon {
        cx: f64,
        cy: f64,
        radius: f64,
        sides: u32,
        inscribed: bool,
        rotation: f64,
        layer_id: String,
    },
    // Half-infinite ray
    CreateRay {
        ox: f64,
        oy: f64,
        dx: f64,
        dy: f64,
        layer_id: String,
    },
    // Donut (filled ring)
    CreateDonut {
        cx: f64,
        cy: f64,
        inner_radius: f64,
        outer_radius: f64,
        layer_id: String,
    },
    // Leader annotation
    CreateLeader {
        vertices: Vec<(f64, f64)>,
        text: String,
        arrow_size: f64,
        text_height: f64,
        layer_id: String,
    },
    // PEDIT — polyline editing
    PeditClose {
        id: String,
    },
    PeditOpen {
        id: String,
    },
    PeditAddVertex {
        id: String,
        after_index: u32,
        x: f64,
        y: f64,
    },
    PeditDeleteVertex {
        id: String,
        vertex_index: u32,
    },
    PeditMoveVertex {
        id: String,
        vertex_index: u32,
        x: f64,
        y: f64,
    },
    // Draw order
    SendToBack {
        id: String,
    },
    BringToFront {
        id: String,
    },
    SendBackward {
        id: String,
    },
    BringForward {
        id: String,
    },
    // Point coordinate query
    QueryPoint {
        x: f64,
        y: f64,
    },
    // Undo/Redo
    Undo,
    Redo,
    // Sysvars
    SetSysvar {
        name: String,
        value: f64,
    },
    GetSysvar {
        name: String,
    },
    /// Typed sysvar setter. `value_json` is a JSON-encoded
    /// `sysvars::SysvarValue` (e.g. `{"Int":4133}`, `{"String":"ByLayer"}`,
    /// `{"Point2d":{"x":0.5,"y":0.5}}`). Use this for sysvars whose canonical
    /// AutoCAD type is not `f64`. The legacy `SetSysvar { value: f64 }`
    /// continues to handle Float-typed sysvars unchanged.
    SetSysvarTyped {
        name: String,
        value_json: String,
    },
    /// Returns the typed sysvar value via `CommandResult.warnings[0]`
    /// as JSON. Existing CommandResult has no string field — warnings carry
    /// the JSON payload so the WASM ABI is not widened.
    GetSysvarTyped {
        name: String,
    },
    // Units
    SetUnits {
        linear_type: Option<String>,
        linear_precision: Option<u8>,
        angular_type: Option<String>,
        angular_precision: Option<u8>,
        insertion_scale: Option<f64>,
    },
    GetUnits,
}

impl Command {
    /// Returns entity IDs referenced by this command (for preview cloning).
    /// Creation commands return empty (no entities to clone).
    pub fn referenced_entity_ids(&self) -> Vec<String> {
        match self {
            // Single entity modify
            Command::DeleteEntity { id }
            | Command::MoveEntity { id, .. }
            | Command::RotateEntity { id, .. }
            | Command::ScaleEntity { id, .. }
            | Command::CopyEntity { id }
            | Command::MirrorEntity { id, .. }
            | Command::OffsetEntity { id, .. }
            | Command::ModifyGeometry { id, .. }
            | Command::SetEntityColor { id, .. }
            | Command::SetEntityLinetype { id, .. }
            | Command::SetEntityLineweight { id, .. } => vec![id.clone()],

            // Single entity (different field name)
            Command::SetEntityLayer { entity_id, .. }
            | Command::AddConstraintHorizontal { entity_id }
            | Command::AddConstraintVertical { entity_id }
            | Command::AddConstraintFixed { entity_id, .. }
            | Command::Explode { entity_id }
            | Command::ExplodeBlock { entity_id }
            | Command::MeasureArea { entity_id }
            | Command::Lengthen { entity_id, .. }
            | Command::BreakAtPoint { entity_id, .. }
            | Command::Break { entity_id, .. } => vec![entity_id.clone()],

            // Two entities
            Command::Fillet { id_a, id_b, .. } | Command::Chamfer { id_a, id_b, .. } => {
                vec![id_a.clone(), id_b.clone()]
            }

            Command::TrimEntity {
                id, boundary_id, ..
            }
            | Command::ExtendEntity { id, boundary_id } => vec![id.clone(), boundary_id.clone()],

            Command::AddConstraintCoincident {
                entity_a, entity_b, ..
            }
            | Command::AddConstraintDistance {
                entity_a, entity_b, ..
            }
            | Command::AddConstraintParallel { entity_a, entity_b }
            | Command::AddConstraintPerpendicular { entity_a, entity_b }
            | Command::AddConstraintEqualLength { entity_a, entity_b }
            | Command::AddConstraintConcentric { entity_a, entity_b } => {
                vec![entity_a.clone(), entity_b.clone()]
            }

            Command::AddConstraintTangent {
                line_entity,
                circle_entity,
            } => {
                vec![line_entity.clone(), circle_entity.clone()]
            }

            Command::AddConstraintSymmetric {
                entity_id,
                axis_entity,
            } => {
                vec![entity_id.clone(), axis_entity.clone()]
            }

            Command::CreateCircleTtr {
                entity1_id,
                entity2_id,
                ..
            } => {
                vec![entity1_id.clone(), entity2_id.clone()]
            }

            // Single entity (yet another field name)
            Command::OffsetEntityThrough { id, .. } | Command::FilletPolyline { id, .. } => {
                vec![id.clone()]
            }

            // Multi entity
            Command::ArrayRectangular { entity_ids, .. }
            | Command::ArrayPolar { entity_ids, .. } => entity_ids.clone(),

            Command::JoinEntities { ids } => ids.clone(),

            Command::MatchProperties {
                source_id,
                target_ids,
            } => {
                let mut result = vec![source_id.clone()];
                result.extend(target_ids.iter().cloned());
                result
            }

            Command::CreateBlock { entity_ids, .. } => entity_ids.clone(),

            Command::CreateHatch { boundary_ids, .. } => boundary_ids.clone(),

            // Creation commands, layer commands, text style commands, system commands
            // — no entity references
            _ => vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serde_round_trip_create_line() {
        let cmd = Command::CreateLine {
            x1: 0.0,
            y1: 0.0,
            x2: 10.0,
            y2: 10.0,
            layer_id: "layer_0".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreateLine {
            x1,
            y1,
            x2,
            y2,
            layer_id,
        } = parsed
        {
            assert_eq!(x1, 0.0);
            assert_eq!(y2, 10.0);
            assert_eq!(layer_id, "layer_0");
        } else {
            panic!("Expected CreateLine");
        }
    }

    #[test]
    fn serde_round_trip_create_circle() {
        let cmd = Command::CreateCircle {
            cx: 5.0,
            cy: 3.0,
            radius: 7.0,
            layer_id: "layer_0".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreateCircle { cx, cy, radius, .. } = parsed {
            assert_eq!(cx, 5.0);
            assert_eq!(cy, 3.0);
            assert_eq!(radius, 7.0);
        } else {
            panic!("Expected CreateCircle");
        }
    }

    #[test]
    fn serde_round_trip_create_arc() {
        let cmd = Command::CreateArc {
            cx: 0.0,
            cy: 0.0,
            radius: 5.0,
            start_angle: 0.0,
            end_angle: 1.57,
            layer_id: "layer_0".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreateArc {
            radius,
            start_angle,
            end_angle,
            ..
        } = parsed
        {
            assert_eq!(radius, 5.0);
            assert_eq!(start_angle, 0.0);
            assert!((end_angle - 1.57).abs() < 1e-10);
        } else {
            panic!("Expected CreateArc");
        }
    }

    #[test]
    fn serde_round_trip_delete_entity() {
        let cmd = Command::DeleteEntity {
            id: "ent_42".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::DeleteEntity { id } = parsed {
            assert_eq!(id, "ent_42");
        } else {
            panic!("Expected DeleteEntity");
        }
    }

    #[test]
    fn serde_round_trip_move_entity() {
        let cmd = Command::MoveEntity {
            id: "ent_1".into(),
            dx: 5.0,
            dy: -3.0,
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::MoveEntity { id, dx, dy } = parsed {
            assert_eq!(id, "ent_1");
            assert_eq!(dx, 5.0);
            assert_eq!(dy, -3.0);
        } else {
            panic!("Expected MoveEntity");
        }
    }

    #[test]
    fn serde_round_trip_create_layer() {
        let cmd = Command::CreateLayer {
            name: "Walls".into(),
            color: "#ff0000".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreateLayer { name, color } = parsed {
            assert_eq!(name, "Walls");
            assert_eq!(color, "#ff0000");
        } else {
            panic!("Expected CreateLayer");
        }
    }

    #[test]
    fn serde_round_trip_create_polyline() {
        let cmd = Command::CreatePolyline {
            vertices: vec![(0.0, 0.0), (1.0, 2.0), (3.0, 4.0)],
            closed: true,
            layer_id: "layer_0".into(),
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreatePolyline {
            vertices, closed, ..
        } = parsed
        {
            assert_eq!(vertices.len(), 3);
            assert!(closed);
        } else {
            panic!("Expected CreatePolyline");
        }
    }

    #[test]
    fn serde_round_trip_undo_redo() {
        for cmd in [Command::Undo, Command::Redo] {
            let json = serde_json::to_string(&cmd).unwrap();
            let _parsed: Command = serde_json::from_str(&json).unwrap();
        }
    }

    #[test]
    fn serde_round_trip_create_text_style() {
        let cmd = Command::CreateTextStyle {
            name: "Custom".into(),
            font_family: Some("Arial".into()),
            height: Some(3.0),
            width_factor: None,
            oblique_angle: None,
            is_bold: Some(true),
            is_italic: None,
        };
        let json = serde_json::to_string(&cmd).unwrap();
        let parsed: Command = serde_json::from_str(&json).unwrap();
        if let Command::CreateTextStyle {
            name,
            font_family,
            height,
            is_bold,
            ..
        } = parsed
        {
            assert_eq!(name, "Custom");
            assert_eq!(font_family, Some("Arial".into()));
            assert_eq!(height, Some(3.0));
            assert_eq!(is_bold, Some(true));
        } else {
            panic!("Expected CreateTextStyle");
        }
    }

    #[test]
    fn command_result_success_serialization() {
        let result = CommandResult {
            success: true,
            created_ids: vec!["ent_1".into()],
            error: None,
            measurement: None,
            warnings: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("ent_1"));
        // warnings should be skipped when empty
        assert!(!json.contains("warnings"));
    }

    #[test]
    fn command_result_error_serialization() {
        let result = CommandResult {
            success: false,
            created_ids: vec![],
            error: Some("Something failed".into()),
            measurement: None,
            warnings: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":false"));
        assert!(json.contains("Something failed"));
    }

    #[test]
    fn command_result_with_measurement() {
        let result = CommandResult {
            success: true,
            created_ids: vec![],
            error: None,
            measurement: Some(42.5),
            warnings: vec![],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("42.5"));
    }

    #[test]
    fn command_result_with_warnings() {
        let result = CommandResult {
            success: true,
            created_ids: vec!["ent_1".into()],
            error: None,
            measurement: None,
            warnings: vec!["Zero-length line".into()],
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Zero-length line"));
    }

    #[test]
    fn command_result_round_trip() {
        let result = CommandResult {
            success: true,
            created_ids: vec!["ent_1".into(), "ent_2".into()],
            error: None,
            measurement: Some(100.0),
            warnings: vec!["warn".into()],
        };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: CommandResult = serde_json::from_str(&json).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.created_ids.len(), 2);
        assert_eq!(parsed.measurement, Some(100.0));
        assert_eq!(parsed.warnings, vec!["warn"]);
    }

    #[test]
    fn serde_tagged_type_field() {
        let json = r#"{"type":"CreatePoint","x":1,"y":2,"layer_id":"layer_0"}"#;
        let cmd: Command = serde_json::from_str(json).unwrap();
        if let Command::CreatePoint { x, y, .. } = cmd {
            assert_eq!(x, 1.0);
            assert_eq!(y, 2.0);
        } else {
            panic!("Expected CreatePoint");
        }
    }

    #[test]
    fn invalid_json_fails_gracefully() {
        let result = serde_json::from_str::<Command>("not json");
        assert!(result.is_err());
    }

    #[test]
    fn unknown_type_fails() {
        let result = serde_json::from_str::<Command>(r#"{"type":"FooBar"}"#);
        assert!(result.is_err());
    }

    #[test]
    fn test_referenced_entity_ids_single() {
        let cmd = Command::OffsetEntity {
            id: "ent_1".into(),
            distance: 5.0,
        };
        assert_eq!(cmd.referenced_entity_ids(), vec!["ent_1"]);
    }

    #[test]
    fn test_referenced_entity_ids_two() {
        let cmd = Command::Fillet {
            id_a: "ent_1".into(),
            id_b: "ent_2".into(),
            radius: 1.0,
        };
        let ids = cmd.referenced_entity_ids();
        assert_eq!(ids, vec!["ent_1", "ent_2"]);
    }

    #[test]
    fn test_referenced_entity_ids_creation() {
        let cmd = Command::CreateLine {
            x1: 0.0,
            y1: 0.0,
            x2: 10.0,
            y2: 0.0,
            layer_id: "layer_0".into(),
        };
        assert!(cmd.referenced_entity_ids().is_empty());
    }

    #[test]
    fn test_referenced_entity_ids_multi() {
        let cmd = Command::ArrayRectangular {
            entity_ids: vec!["a".into(), "b".into(), "c".into()],
            rows: 2,
            cols: 2,
            row_spacing: 10.0,
            col_spacing: 10.0,
        };
        assert_eq!(cmd.referenced_entity_ids(), vec!["a", "b", "c"]);
    }
}
