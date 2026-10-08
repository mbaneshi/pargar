use serde::{Deserialize, Serialize};
#[cfg(target_arch = "wasm32")]
use tsify::Tsify;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Point2D {
    pub x: f64,
    pub y: f64,
}

impl Point2D {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point2D) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn translate(&mut self, dx: f64, dy: f64) {
        self.x += dx;
        self.y += dy;
    }

    pub fn rotate_around(&mut self, cx: f64, cy: f64, angle: f64) {
        let cos = angle.cos();
        let sin = angle.sin();
        let dx = self.x - cx;
        let dy = self.y - cy;
        self.x = cx + dx * cos - dy * sin;
        self.y = cy + dx * sin + dy * cos;
    }

    pub fn scale_around(&mut self, cx: f64, cy: f64, factor: f64) {
        self.x = cx + (self.x - cx) * factor;
        self.y = cy + (self.y - cy) * factor;
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub enum GeometryType {
    Line {
        start: Point2D,
        end: Point2D,
    },
    Circle {
        center: Point2D,
        radius: f64,
    },
    Arc {
        center: Point2D,
        radius: f64,
        start_angle: f64,
        end_angle: f64,
    },
    Polyline {
        vertices: Vec<Point2D>,
        closed: bool,
    },
    Rectangle {
        origin: Point2D,
        width: f64,
        height: f64,
        rotation: f64,
    },
    Text {
        position: Point2D,
        content: String,
        height: f64,
        rotation: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    Dimension {
        start: Point2D,
        end: Point2D,
        offset: f64,
        text_override: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    Ellipse {
        center: Point2D,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
    },
    Spline {
        control_points: Vec<Point2D>,
        degree: u8,
        closed: bool,
    },
    Point {
        position: Point2D,
    },
    ConstructionLine {
        origin: Point2D,
        direction: Point2D,
    },
    Ray {
        origin: Point2D,
        direction: Point2D,
    },
    BlockRef {
        block_id: String,
        insertion: Point2D,
        rotation: f64,
        scale_x: f64,
        scale_y: f64,
    },
    AlignedDimension {
        start: Point2D,
        end: Point2D,
        offset: f64,
        text_override: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    AngularDimension {
        center: Point2D,
        start_ray: Point2D,
        end_ray: Point2D,
        radius: f64,
        text_override: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    RadialDimension {
        center: Point2D,
        point_on_arc: Point2D,
        text_override: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    DiameterDimension {
        center: Point2D,
        point_on_arc: Point2D,
        text_override: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    Hatch {
        boundary_ids: Vec<String>,
        pattern: String,
        scale: f64,
        angle: f64,
    },
    MText {
        position: Point2D,
        content: String,
        width: f64,
        height: f64,
        rotation: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    Table {
        position: Point2D,
        rows: u32,
        cols: u32,
        row_height: f64,
        col_widths: Vec<f64>,
        cells: Vec<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    RevisionCloud {
        boundary: Vec<Point2D>,
        arc_length: f64,
    },
    Leader {
        vertices: Vec<Point2D>,
        text: String,
        arrow_size: f64,
        text_height: f64,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        style_name: Option<String>,
    },
    EllipseArc {
        center: Point2D,
        semi_major: f64,
        semi_minor: f64,
        rotation: f64,
        start_angle: f64,
        end_angle: f64,
    },
    Wipeout {
        vertices: Vec<Point2D>,
    },
    Tolerance {
        position: Point2D,
        content: String,
        height: f64,
    },
    AttDef {
        position: Point2D,
        tag: String,
        prompt: String,
        default_value: String,
        height: f64,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct BlockDef {
    pub id: String,
    pub name: String,
    pub base_point: Point2D,
    pub entities: Vec<Entity>,
}

impl GeometryType {
    pub fn translate(&mut self, dx: f64, dy: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.translate(dx, dy);
                end.translate(dx, dy);
            }
            GeometryType::Circle { center, .. } | GeometryType::Arc { center, .. } => {
                center.translate(dx, dy);
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.translate(dx, dy);
                }
            }
            GeometryType::Rectangle { origin, .. } => {
                origin.translate(dx, dy);
            }
            GeometryType::Text { position, .. } => {
                position.translate(dx, dy);
            }
            GeometryType::Dimension { start, end, .. } => {
                start.translate(dx, dy);
                end.translate(dx, dy);
            }
            GeometryType::Ellipse { center, .. } => {
                center.translate(dx, dy);
            }
            GeometryType::Spline { control_points, .. } => {
                for p in control_points.iter_mut() {
                    p.translate(dx, dy);
                }
            }
            GeometryType::Point { position } => {
                position.translate(dx, dy);
            }
            GeometryType::ConstructionLine { origin, .. } | GeometryType::Ray { origin, .. } => {
                origin.translate(dx, dy);
            }
            GeometryType::BlockRef { insertion, .. } => {
                insertion.translate(dx, dy);
            }
            GeometryType::Hatch { .. } => {}
            GeometryType::MText { position, .. } => {
                position.translate(dx, dy);
            }
            GeometryType::Table { position, .. } => {
                position.translate(dx, dy);
            }
            GeometryType::AlignedDimension { start, end, .. } => {
                start.translate(dx, dy);
                end.translate(dx, dy);
            }
            GeometryType::AngularDimension {
                center,
                start_ray,
                end_ray,
                ..
            } => {
                center.translate(dx, dy);
                start_ray.translate(dx, dy);
                end_ray.translate(dx, dy);
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
                center.translate(dx, dy);
                point_on_arc.translate(dx, dy);
            }
            GeometryType::RevisionCloud { boundary, .. } => {
                for p in boundary.iter_mut() {
                    p.translate(dx, dy);
                }
            }
            GeometryType::Leader { vertices, .. } | GeometryType::Wipeout { vertices } => {
                for v in vertices.iter_mut() {
                    v.translate(dx, dy);
                }
            }
            GeometryType::EllipseArc { center, .. } => {
                center.translate(dx, dy);
            }
            GeometryType::Tolerance { position, .. } | GeometryType::AttDef { position, .. } => {
                position.translate(dx, dy);
            }
        }
    }

    pub fn rotate(&mut self, cx: f64, cy: f64, angle: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.rotate_around(cx, cy, angle);
                end.rotate_around(cx, cy, angle);
            }
            GeometryType::Circle { center, .. } => {
                center.rotate_around(cx, cy, angle);
            }
            GeometryType::Arc {
                center,
                start_angle,
                end_angle,
                ..
            } => {
                center.rotate_around(cx, cy, angle);
                *start_angle += angle;
                *end_angle += angle;
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.rotate_around(cx, cy, angle);
                }
            }
            GeometryType::Rectangle {
                origin,
                rotation,
                width,
                height,
            } => {
                let ccx = origin.x + *width / 2.0;
                let ccy = origin.y + *height / 2.0;
                let mut center = Point2D::new(ccx, ccy);
                center.rotate_around(cx, cy, angle);
                origin.x = center.x - *width / 2.0;
                origin.y = center.y - *height / 2.0;
                *rotation += angle;
            }
            GeometryType::Text {
                position, rotation, ..
            } => {
                position.rotate_around(cx, cy, angle);
                *rotation += angle;
            }
            GeometryType::Dimension { start, end, .. } => {
                start.rotate_around(cx, cy, angle);
                end.rotate_around(cx, cy, angle);
            }
            GeometryType::Ellipse {
                center, rotation, ..
            } => {
                center.rotate_around(cx, cy, angle);
                *rotation += angle;
            }
            GeometryType::Spline { control_points, .. } => {
                for p in control_points.iter_mut() {
                    p.rotate_around(cx, cy, angle);
                }
            }
            GeometryType::Point { position } => {
                position.rotate_around(cx, cy, angle);
            }
            GeometryType::ConstructionLine { origin, direction }
            | GeometryType::Ray { origin, direction } => {
                origin.rotate_around(cx, cy, angle);
                direction.rotate_around(0.0, 0.0, angle);
            }
            GeometryType::BlockRef {
                insertion,
                rotation,
                ..
            } => {
                insertion.rotate_around(cx, cy, angle);
                *rotation += angle;
            }
            GeometryType::Hatch { .. } => {}
            GeometryType::MText {
                position, rotation, ..
            } => {
                position.rotate_around(cx, cy, angle);
                *rotation += angle;
            }
            GeometryType::Table { position, .. } => {
                position.rotate_around(cx, cy, angle);
            }
            GeometryType::AlignedDimension { start, end, .. } => {
                start.rotate_around(cx, cy, angle);
                end.rotate_around(cx, cy, angle);
            }
            GeometryType::AngularDimension {
                center,
                start_ray,
                end_ray,
                ..
            } => {
                center.rotate_around(cx, cy, angle);
                start_ray.rotate_around(cx, cy, angle);
                end_ray.rotate_around(cx, cy, angle);
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
                center.rotate_around(cx, cy, angle);
                point_on_arc.rotate_around(cx, cy, angle);
            }
            GeometryType::RevisionCloud { boundary, .. } => {
                for p in boundary.iter_mut() {
                    p.rotate_around(cx, cy, angle);
                }
            }
            GeometryType::Leader { vertices, .. } | GeometryType::Wipeout { vertices } => {
                for v in vertices.iter_mut() {
                    v.rotate_around(cx, cy, angle);
                }
            }
            GeometryType::EllipseArc {
                center, rotation, ..
            } => {
                center.rotate_around(cx, cy, angle);
                *rotation += angle;
            }
            GeometryType::Tolerance { position, .. } | GeometryType::AttDef { position, .. } => {
                position.rotate_around(cx, cy, angle);
            }
        }
    }

    pub fn scale(&mut self, cx: f64, cy: f64, factor: f64) {
        match self {
            GeometryType::Line { start, end } => {
                start.scale_around(cx, cy, factor);
                end.scale_around(cx, cy, factor);
            }
            GeometryType::Circle { center, radius } => {
                center.scale_around(cx, cy, factor);
                *radius *= factor;
            }
            GeometryType::Arc { center, radius, .. } => {
                center.scale_around(cx, cy, factor);
                *radius *= factor;
            }
            GeometryType::Polyline { vertices, .. } => {
                for v in vertices.iter_mut() {
                    v.scale_around(cx, cy, factor);
                }
            }
            GeometryType::Rectangle {
                origin,
                width,
                height,
                ..
            } => {
                origin.scale_around(cx, cy, factor);
                *width *= factor;
                *height *= factor;
            }
            GeometryType::Text {
                position, height, ..
            } => {
                position.scale_around(cx, cy, factor);
                *height *= factor;
            }
            GeometryType::Dimension {
                start, end, offset, ..
            } => {
                start.scale_around(cx, cy, factor);
                end.scale_around(cx, cy, factor);
                *offset *= factor;
            }
            GeometryType::Ellipse {
                center,
                semi_major,
                semi_minor,
                ..
            } => {
                center.scale_around(cx, cy, factor);
                *semi_major *= factor;
                *semi_minor *= factor;
            }
            GeometryType::Spline { control_points, .. } => {
                for p in control_points.iter_mut() {
                    p.scale_around(cx, cy, factor);
                }
            }
            GeometryType::Point { position } => {
                position.scale_around(cx, cy, factor);
            }
            GeometryType::ConstructionLine { origin, direction }
            | GeometryType::Ray { origin, direction } => {
                origin.scale_around(cx, cy, factor);
                direction.x *= factor;
                direction.y *= factor;
            }
            GeometryType::BlockRef {
                insertion,
                scale_x,
                scale_y,
                ..
            } => {
                insertion.scale_around(cx, cy, factor);
                *scale_x *= factor;
                *scale_y *= factor;
            }
            GeometryType::Hatch { .. } => {}
            GeometryType::MText {
                position,
                width,
                height,
                ..
            } => {
                position.scale_around(cx, cy, factor);
                *width *= factor;
                *height *= factor;
            }
            GeometryType::Table {
                position,
                row_height,
                col_widths,
                ..
            } => {
                position.scale_around(cx, cy, factor);
                *row_height *= factor;
                for w in col_widths.iter_mut() {
                    *w *= factor;
                }
            }
            GeometryType::AlignedDimension {
                start, end, offset, ..
            } => {
                start.scale_around(cx, cy, factor);
                end.scale_around(cx, cy, factor);
                *offset *= factor;
            }
            GeometryType::AngularDimension {
                center,
                start_ray,
                end_ray,
                radius,
                ..
            } => {
                center.scale_around(cx, cy, factor);
                start_ray.scale_around(cx, cy, factor);
                end_ray.scale_around(cx, cy, factor);
                *radius *= factor;
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
                center.scale_around(cx, cy, factor);
                point_on_arc.scale_around(cx, cy, factor);
            }
            GeometryType::RevisionCloud {
                boundary,
                arc_length,
            } => {
                for p in boundary.iter_mut() {
                    p.scale_around(cx, cy, factor);
                }
                *arc_length *= factor;
            }
            GeometryType::Leader {
                vertices,
                arrow_size,
                text_height,
                ..
            } => {
                for v in vertices.iter_mut() {
                    v.scale_around(cx, cy, factor);
                }
                *arrow_size *= factor;
                *text_height *= factor;
            }
            GeometryType::Wipeout { vertices } => {
                for v in vertices.iter_mut() {
                    v.scale_around(cx, cy, factor);
                }
            }
            GeometryType::EllipseArc {
                center,
                semi_major,
                semi_minor,
                ..
            } => {
                center.scale_around(cx, cy, factor);
                *semi_major *= factor;
                *semi_minor *= factor;
            }
            GeometryType::Tolerance {
                position, height, ..
            } => {
                position.scale_around(cx, cy, factor);
                *height *= factor;
            }
            GeometryType::AttDef {
                position, height, ..
            } => {
                position.scale_around(cx, cy, factor);
                *height *= factor;
            }
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct TextStyle {
    pub name: String,
    pub font_family: String,
    pub height: f64,
    pub width_factor: f64,
    pub oblique_angle: f64,
    pub is_bold: bool,
    pub is_italic: bool,
}

impl TextStyle {
    pub fn standard() -> Self {
        Self {
            name: "Standard".to_string(),
            font_family: "sans-serif".to_string(),
            height: 2.5,
            width_factor: 1.0,
            oblique_angle: 0.0,
            is_bold: false,
            is_italic: false,
        }
    }
}

/// Dimension style — controls appearance of dimension entities.
/// Field names follow AutoCAD DIMSTYLE conventions so users and AI agents
/// can use familiar terminology.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct DimStyle {
    pub name: String,
    /// Overall scale factor applied to dimension features (DIMSCALE).
    pub dimscale: f64,
    /// Text height (DIMTXT).
    pub dimtxt: f64,
    /// Arrow size (DIMASZ).
    pub dimasz: f64,
    /// Extension line offset from origin (DIMEXO).
    pub dimexo: f64,
    /// Extension line distance above the dimension line (DIMEXE).
    pub dimexe: f64,
    /// Gap between dimension line and text (DIMGAP).
    pub dimgap: f64,
    /// Text vertical placement: 0=center, 1=above, 2=below (DIMTAD).
    pub dimtad: i32,
    /// Text color override; None = ByBlock (DIMCLRT).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimclrt: Option<String>,
    /// Dimension line color override; None = ByBlock (DIMCLRD).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimclrd: Option<String>,
    /// Extension line color override; None = ByBlock (DIMCLRE).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dimclre: Option<String>,
    /// Text style name to use for dimension text (DIMTXSTY).
    pub dimtxsty: String,
}

impl DimStyle {
    pub fn standard() -> Self {
        Self {
            name: "Standard".to_string(),
            dimscale: 1.0,
            dimtxt: 2.5,
            dimasz: 2.5,
            dimexo: 0.625,
            dimexe: 1.25,
            dimgap: 0.625,
            dimtad: 1,
            dimclrt: None,
            dimclrd: None,
            dimclre: None,
            dimtxsty: "Standard".to_string(),
        }
    }
}

/// Multileader style — controls appearance of leader/multileader entities.
/// Field names mirror AutoCAD MLEADERSTYLE so users and AI agents can use
/// familiar terminology.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct MLeaderStyle {
    pub name: String,
    pub arrow_size: f64,
    pub text_height: f64,
    /// Name of the text style used for leader text.
    pub text_style_name: String,
    /// Length of the horizontal landing segment between leader and text.
    pub landing_distance: f64,
    /// Whether the landing segment is drawn.
    pub enable_landing: bool,
    /// Whether the dogleg (kink between vertical and horizontal) is drawn.
    pub enable_dogleg: bool,
    /// Color override; None = ByBlock.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

impl MLeaderStyle {
    pub fn standard() -> Self {
        Self {
            name: "Standard".to_string(),
            arrow_size: 2.5,
            text_height: 2.5,
            text_style_name: "Standard".to_string(),
            landing_distance: 8.0,
            enable_landing: true,
            enable_dogleg: true,
            color: None,
        }
    }
}

/// Table style — controls appearance of table entities.
/// Fields cover the most-used AutoCAD TABLESTYLE properties (title row,
/// header row, data row, borders).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct TableStyle {
    pub name: String,
    /// Text style name used for cells.
    pub text_style_name: String,
    /// Default text height for data rows.
    pub data_text_height: f64,
    /// Default text height for the header row.
    pub header_text_height: f64,
    /// Default text height for the title row.
    pub title_text_height: f64,
    /// Whether the table has a title row.
    pub has_title: bool,
    /// Whether the table has a header row.
    pub has_header: bool,
    /// Margin between cell content and cell border.
    pub cell_margin: f64,
    /// Border color override; None = ByBlock.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub border_color: Option<String>,
    /// Title row background fill color; None = none.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title_fill_color: Option<String>,
    /// Header row background fill color; None = none.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_fill_color: Option<String>,
}

impl TableStyle {
    pub fn standard() -> Self {
        Self {
            name: "Standard".to_string(),
            text_style_name: "Standard".to_string(),
            data_text_height: 2.5,
            header_text_height: 4.0,
            title_text_height: 6.0,
            has_title: true,
            has_header: true,
            cell_margin: 0.5,
            border_color: None,
            title_fill_color: None,
            header_fill_color: None,
        }
    }
}

/// Named group of entities (AutoCAD GROUP).
/// Groups bind a set of entity IDs by name. When the group is selectable,
/// selecting any member selects the whole group (PICKSTYLE behavior).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Group {
    pub name: String,
    /// Anonymous groups are auto-named *Anonymous_N (matches AutoCAD).
    pub anonymous: bool,
    /// When false, members can be selected individually (UNGROUP-on-pick).
    pub selectable: bool,
    pub entity_ids: Vec<String>,
}

/// Named User Coordinate System (AutoCAD UCS).
/// Stores an origin and X/Y axis directions in world space; the Z axis is
/// implicitly X × Y for 2D usage we treat the in-plane axes only.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct NamedUcs {
    pub name: String,
    pub origin: Point2D,
    /// X axis direction (will be normalized on save).
    pub x_axis: Point2D,
    /// Y axis direction (will be normalized on save).
    pub y_axis: Point2D,
}

/// Named view (AutoCAD VIEW).
/// Captures camera state — center, zoom, rotation — by name so the user
/// or an agent can jump back to a saved viewpoint. Future: per-view
/// layer state and UCS references.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct NamedView {
    pub name: String,
    pub center_x: f64,
    pub center_y: f64,
    pub zoom: f64,
    /// View rotation in radians (0 = north up).
    #[serde(default)]
    pub rotation: f64,
}

/// Drawing-level metadata (DWGPROPS in AutoCAD). One record per drawing —
/// title, subject, author, keywords, etc. Used for sheet title-block fields,
/// eTransmit packaging, plot stamps, and Sheet Set Manager binding.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct DwgProps {
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub title: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub subject: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub author: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub keywords: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub comments: String,
    /// Base path used to resolve relative hyperlinks within the drawing.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub hyperlink_base: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub last_saved_by: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct EntityStyle {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linetype: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lineweight: Option<f64>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Entity {
    pub id: String,
    pub geometry: GeometryType,
    pub layer_id: String,
    #[serde(default)]
    pub style: EntityStyle,
    #[serde(default)]
    pub draw_order: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[cfg_attr(target_arch = "wasm32", derive(Tsify))]
#[cfg_attr(target_arch = "wasm32", tsify(into_wasm_abi, from_wasm_abi))]
pub struct Layer {
    pub id: String,
    pub name: String,
    pub color: String,
    pub visible: bool,
    pub locked: bool,
    #[serde(default)]
    pub linetype: Option<String>,
    #[serde(default)]
    pub lineweight: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // Point2D tests

    #[test]
    fn point2d_new() {
        let p = Point2D::new(3.0, 7.0);
        assert!((p.x - 3.0).abs() < 1e-9);
        assert!((p.y - 7.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_distance_to() {
        let a = Point2D::new(0.0, 0.0);
        let b = Point2D::new(3.0, 4.0);
        assert!((a.distance_to(&b) - 5.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_distance_to_self() {
        let p = Point2D::new(42.0, -7.0);
        assert!(p.distance_to(&p.clone()).abs() < 1e-9);
    }

    #[test]
    fn point2d_translate() {
        let mut p = Point2D::new(1.0, 2.0);
        p.translate(3.0, 4.0);
        assert!((p.x - 4.0).abs() < 1e-9);
        assert!((p.y - 6.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_rotate_90() {
        let mut p = Point2D::new(1.0, 0.0);
        p.rotate_around(0.0, 0.0, std::f64::consts::FRAC_PI_2);
        assert!((p.x - 0.0).abs() < 1e-9);
        assert!((p.y - 1.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_rotate_offset() {
        let mut p = Point2D::new(2.0, 0.0);
        p.rotate_around(1.0, 0.0, std::f64::consts::PI);
        assert!((p.x - 0.0).abs() < 1e-9);
        assert!((p.y - 0.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_scale() {
        let mut p = Point2D::new(2.0, 4.0);
        p.scale_around(0.0, 0.0, 2.0);
        assert!((p.x - 4.0).abs() < 1e-9);
        assert!((p.y - 8.0).abs() < 1e-9);
    }

    #[test]
    fn point2d_scale_offset() {
        let mut p = Point2D::new(3.0, 3.0);
        p.scale_around(1.0, 1.0, 0.5);
        assert!((p.x - 2.0).abs() < 1e-9);
        assert!((p.y - 2.0).abs() < 1e-9);
    }

    // GeometryType translate tests

    #[test]
    fn geometry_translate_line() {
        let mut g = GeometryType::Line {
            start: Point2D::new(0.0, 0.0),
            end: Point2D::new(10.0, 10.0),
        };
        g.translate(5.0, 3.0);
        if let GeometryType::Line { start, end } = g {
            assert!((start.x - 5.0).abs() < 1e-9);
            assert!((start.y - 3.0).abs() < 1e-9);
            assert!((end.x - 15.0).abs() < 1e-9);
            assert!((end.y - 13.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_circle() {
        let mut g = GeometryType::Circle {
            center: Point2D::new(1.0, 2.0),
            radius: 5.0,
        };
        g.translate(3.0, 4.0);
        if let GeometryType::Circle { center, radius } = g {
            assert!((center.x - 4.0).abs() < 1e-9);
            assert!((center.y - 6.0).abs() < 1e-9);
            assert!((radius - 5.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_arc() {
        let mut g = GeometryType::Arc {
            center: Point2D::new(0.0, 0.0),
            radius: 3.0,
            start_angle: 0.0,
            end_angle: 1.0,
        };
        g.translate(1.0, 2.0);
        if let GeometryType::Arc {
            center,
            radius,
            start_angle,
            end_angle,
        } = g
        {
            assert!((center.x - 1.0).abs() < 1e-9);
            assert!((center.y - 2.0).abs() < 1e-9);
            assert!((radius - 3.0).abs() < 1e-9);
            assert!((start_angle - 0.0).abs() < 1e-9);
            assert!((end_angle - 1.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_polyline() {
        let mut g = GeometryType::Polyline {
            vertices: vec![Point2D::new(0.0, 0.0), Point2D::new(2.0, 2.0)],
            closed: true,
        };
        g.translate(1.0, 1.0);
        if let GeometryType::Polyline { vertices, closed } = g {
            assert!((vertices[0].x - 1.0).abs() < 1e-9);
            assert!((vertices[1].x - 3.0).abs() < 1e-9);
            assert!(closed);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_rectangle() {
        let mut g = GeometryType::Rectangle {
            origin: Point2D::new(1.0, 1.0),
            width: 10.0,
            height: 5.0,
            rotation: 0.0,
        };
        g.translate(2.0, 3.0);
        if let GeometryType::Rectangle {
            origin,
            width,
            height,
            rotation,
        } = g
        {
            assert!((origin.x - 3.0).abs() < 1e-9);
            assert!((origin.y - 4.0).abs() < 1e-9);
            assert!((width - 10.0).abs() < 1e-9);
            assert!((height - 5.0).abs() < 1e-9);
            assert!((rotation - 0.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_text() {
        let mut g = GeometryType::Text {
            position: Point2D::new(0.0, 0.0),
            content: "hello".to_string(),
            height: 2.5,
            rotation: 0.0,
            style_name: None,
        };
        g.translate(4.0, 5.0);
        if let GeometryType::Text {
            position,
            content,
            height,
            ..
        } = g
        {
            assert!((position.x - 4.0).abs() < 1e-9);
            assert!((position.y - 5.0).abs() < 1e-9);
            assert_eq!(content, "hello");
            assert!((height - 2.5).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_translate_point() {
        let mut g = GeometryType::Point {
            position: Point2D::new(1.0, 1.0),
        };
        g.translate(9.0, -1.0);
        if let GeometryType::Point { position } = g {
            assert!((position.x - 10.0).abs() < 1e-9);
            assert!((position.y - 0.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    // Rotate + Scale tests

    #[test]
    fn geometry_rotate_line_180() {
        let mut g = GeometryType::Line {
            start: Point2D::new(1.0, 0.0),
            end: Point2D::new(3.0, 0.0),
        };
        g.rotate(2.0, 0.0, std::f64::consts::PI);
        if let GeometryType::Line { start, end } = g {
            assert!((start.x - 3.0).abs() < 1e-9);
            assert!((start.y - 0.0).abs() < 1e-9);
            assert!((end.x - 1.0).abs() < 1e-9);
            assert!((end.y - 0.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_scale_circle_2x() {
        let mut g = GeometryType::Circle {
            center: Point2D::new(0.0, 0.0),
            radius: 3.0,
        };
        g.scale(0.0, 0.0, 2.0);
        if let GeometryType::Circle { radius, .. } = g {
            assert!((radius - 6.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn geometry_scale_ellipse_3x() {
        let mut g = GeometryType::Ellipse {
            center: Point2D::new(0.0, 0.0),
            semi_major: 4.0,
            semi_minor: 2.0,
            rotation: 0.0,
        };
        g.scale(0.0, 0.0, 3.0);
        if let GeometryType::Ellipse {
            semi_major,
            semi_minor,
            ..
        } = g
        {
            assert!((semi_major - 12.0).abs() < 1e-9);
            assert!((semi_minor - 6.0).abs() < 1e-9);
        } else {
            panic!("wrong variant");
        }
    }

    // Serialization test

    #[test]
    fn entity_line_json_roundtrip() {
        let entity = Entity {
            id: "e1".to_string(),
            geometry: GeometryType::Line {
                start: Point2D::new(1.0, 2.0),
                end: Point2D::new(3.0, 4.0),
            },
            layer_id: "layer_0".to_string(),
            style: EntityStyle::default(),
            draw_order: 0,
        };
        let json = serde_json::to_string(&entity).unwrap();
        let decoded: Entity = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.id, "e1");
        assert_eq!(decoded.layer_id, "layer_0");
        if let GeometryType::Line { start, end } = decoded.geometry {
            assert!((start.x - 1.0).abs() < 1e-9);
            assert!((start.y - 2.0).abs() < 1e-9);
            assert!((end.x - 3.0).abs() < 1e-9);
            assert!((end.y - 4.0).abs() < 1e-9);
        } else {
            panic!("wrong variant after roundtrip");
        }
    }
}
