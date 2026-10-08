/**
 * TypeScript interfaces generated from Rust kernel types via tsify.
 * These mirror the WASM-exported types and replace `kernel: any` usage.
 */

// --- entity.rs ---

export interface Point2D {
  x: number;
  y: number;
}

export type GeometryType =
  | { Line: { start: Point2D; end: Point2D } }
  | { Circle: { center: Point2D; radius: number } }
  | { Arc: { center: Point2D; radius: number; start_angle: number; end_angle: number } }
  | { Polyline: { vertices: Point2D[]; closed: boolean } }
  | { Rectangle: { origin: Point2D; width: number; height: number; rotation: number } }
  | {
      Text: {
        position: Point2D;
        content: string;
        height: number;
        rotation: number;
        style_name?: string;
      };
    }
  | { Dimension: { start: Point2D; end: Point2D; offset: number; text_override?: string } }
  | { Ellipse: { center: Point2D; semi_major: number; semi_minor: number; rotation: number } }
  | { Spline: { control_points: Point2D[]; degree: number; closed: boolean } }
  | { Point: { position: Point2D } }
  | { ConstructionLine: { origin: Point2D; direction: Point2D } }
  | {
      BlockRef: {
        block_id: string;
        insertion: Point2D;
        rotation: number;
        scale_x: number;
        scale_y: number;
      };
    }
  | { AlignedDimension: { start: Point2D; end: Point2D; offset: number; text_override?: string } }
  | {
      AngularDimension: {
        center: Point2D;
        start_ray: Point2D;
        end_ray: Point2D;
        radius: number;
        text_override?: string;
      };
    }
  | { RadialDimension: { center: Point2D; point_on_arc: Point2D; text_override?: string } }
  | { DiameterDimension: { center: Point2D; point_on_arc: Point2D; text_override?: string } }
  | { Hatch: { boundary_ids: string[]; pattern: string; scale: number; angle: number } }
  | {
      MText: {
        position: Point2D;
        content: string;
        width: number;
        height: number;
        rotation: number;
        style_name?: string;
      };
    }
  | {
      Table: {
        position: Point2D;
        rows: number;
        cols: number;
        row_height: number;
        col_widths: number[];
        cells: string[];
      };
    }
  | { RevisionCloud: { boundary: Point2D[]; arc_length: number } };

export interface TextStyle {
  name: string;
  font_family: string;
  height: number;
  width_factor: number;
  oblique_angle: number;
  is_bold: boolean;
  is_italic: boolean;
}

export interface EntityStyle {
  color?: string;
  linetype?: string;
  lineweight?: number;
}

export interface Entity {
  id: string;
  geometry: GeometryType;
  layer_id: string;
  style: EntityStyle;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  linetype?: string;
  lineweight?: number;
}

export interface BlockDef {
  id: string;
  name: string;
  base_point: Point2D;
  entities: Entity[];
}

// --- commands.rs ---

export interface CommandResult {
  success: boolean;
  created_ids: string[];
  error?: string;
  measurement?: number;
}

// --- sysvars.rs ---

export type SysvarValue =
  | { Int: number }
  | { Float: number }
  | { String: string }
  | { Point2d: { x: number; y: number } };

// --- events.rs ---

export type Actor =
  | { User: { session_id: string } }
  | { Agent: { agent_id: string; model: string } }
  | 'System';

export type CadEvent =
  | { EntityCreated: { entity: Entity } }
  | { EntityDeleted: { entity: Entity } }
  | { EntityMoved: { id: string; dx: number; dy: number; old_geometry: GeometryType } }
  | {
      EntityRotated: {
        id: string;
        cx: number;
        cy: number;
        angle: number;
        old_geometry: GeometryType;
      };
    }
  | {
      EntityScaled: {
        id: string;
        cx: number;
        cy: number;
        factor: number;
        old_geometry: GeometryType;
      };
    }
  | { EntityCopied: { original_id: string; new_entity: Entity } }
  | { EntityModified: { id: string; old_geometry: GeometryType; new_geometry: GeometryType } }
  | { EntityStyleChanged: { id: string; old_style: EntityStyle; new_style: EntityStyle } }
  | { TextStyleCreated: { style: TextStyle } }
  | { TextStyleModified: { old_style: TextStyle; new_style: TextStyle } }
  | { TextStyleDeleted: { style: TextStyle } }
  | { CompoundEvent: { events: CadEvent[] } };

export interface EventEnvelope {
  seq: number;
  timestamp_ms: number;
  actor: Actor;
  schema_version: number;
  payload: CadEvent;
}

// --- constraints.rs ---

export type ConstraintType =
  | { Fixed: { entity_id: string; point_index: number; position: Point2D } }
  | { Coincident: { entity_a: string; point_a: number; entity_b: string; point_b: number } }
  | { Horizontal: { entity_id: string } }
  | { Vertical: { entity_id: string } }
  | {
      Distance: {
        entity_a: string;
        point_a: number;
        entity_b: string;
        point_b: number;
        distance: number;
      };
    }
  | { Parallel: { entity_a: string; entity_b: string } }
  | { Perpendicular: { entity_a: string; entity_b: string } }
  | { EqualLength: { entity_a: string; entity_b: string } };

export interface Constraint {
  id: string;
  constraint_type: ConstraintType;
}

// --- units.rs ---

export type LinearUnit = 'Decimal' | 'Engineering' | 'Architectural' | 'Fractional' | 'Scientific';
export type AngularUnit = 'DecimalDegrees' | 'DMS' | 'Grads' | 'Radians';

export interface DrawingUnits {
  linear_type: LinearUnit;
  linear_precision: number;
  angular_type: AngularUnit;
  angular_precision: number;
  insertion_scale: number;
}

// --- Kernel WASM class interface ---

export interface NexusKernel {
  // Drawing
  create_point(x: number, y: number, layer_id: string): string;
  create_line(x1: number, y1: number, x2: number, y2: number, layer_id: string): string;
  create_circle(cx: number, cy: number, radius: number, layer_id: string): string;
  create_arc(
    cx: number,
    cy: number,
    radius: number,
    start_angle: number,
    end_angle: number,
    layer_id: string,
  ): string;
  create_rectangle(x: number, y: number, width: number, height: number, layer_id: string): string;
  create_polyline(coords_json: string, closed: boolean, layer_id: string): string;
  create_text(
    x: number,
    y: number,
    content: string,
    height: number,
    rotation: number,
    layer_id: string,
  ): string;
  create_dimension(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    offset: number,
    layer_id: string,
  ): string;
  create_ellipse(
    cx: number,
    cy: number,
    semi_major: number,
    semi_minor: number,
    rotation: number,
    layer_id: string,
  ): string;
  create_spline(
    control_points_json: string,
    degree: number,
    closed: boolean,
    layer_id: string,
  ): string;
  create_construction_line(
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    layer_id: string,
  ): string;
  create_aligned_dimension(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    offset: number,
    layer_id: string,
  ): string;
  create_angular_dimension(
    cx: number,
    cy: number,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    radius: number,
    layer_id: string,
  ): string;
  create_radial_dimension(cx: number, cy: number, px: number, py: number, layer_id: string): string;
  create_diameter_dimension(
    cx: number,
    cy: number,
    px: number,
    py: number,
    layer_id: string,
  ): string;

  // Editing
  delete_entity(id: string): boolean;
  move_entity(id: string, dx: number, dy: number): boolean;
  rotate_entity(id: string, cx: number, cy: number, angle: number): boolean;
  scale_entity(id: string, cx: number, cy: number, factor: number): boolean;
  copy_entity(id: string): string;
  update_entity_geometry(id: string, geometry_json: string): boolean;
  lengthen_entity(id: string, mode: string, value: number, end: string): boolean;
  offset_entity(id: string, distance: number): string;
  mirror_entity(id: string, x1: number, y1: number, x2: number, y2: number): string;
  trim_entity(id: string, boundary_id: string, pick_x: number, pick_y: number): boolean;

  // Undo/Redo
  undo(): boolean;
  redo(): boolean;
  can_undo(): boolean;
  can_redo(): boolean;
  event_count(): number;

  // Layers
  create_layer(name: string, color: string): string;
  get_layers_json(): string;
  set_layer_visible(layer_id: string, visible: boolean): boolean;
  set_layer_locked(layer_id: string, locked: boolean): boolean;
  set_layer_color(layer_id: string, color: string): boolean;
  rename_layer(layer_id: string, name: string): boolean;
  delete_layer(layer_id: string): boolean;
  set_entity_layer(entity_id: string, layer_id: string): boolean;

  // Constraints
  add_constraint_horizontal(entity_id: string): string;
  add_constraint_vertical(entity_id: string): string;
  add_constraint_coincident(
    entity_a: string,
    point_a: number,
    entity_b: string,
    point_b: number,
  ): string;
  add_constraint_distance(
    entity_a: string,
    point_a: number,
    entity_b: string,
    point_b: number,
    distance: number,
  ): string;
  add_constraint_fixed(entity_id: string, point_index: number, x: number, y: number): string;
  add_constraint_parallel(entity_a: string, entity_b: string): string;
  add_constraint_perpendicular(entity_a: string, entity_b: string): string;
  remove_constraint(id: string): boolean;
  get_constraints_json(): string;
  constraint_count(): number;
  solve_constraints(): boolean;

  // Query
  get_entities_json(): string;
  get_entity_json(id: string): string;
  get_visible_entities_json(): string;
  get_block_defs_json(): string;
  get_last_created_entity_json(): string;
  entity_count(): number;
  flush_changes(): string;
  has_changes(): boolean;

  // Command dispatch
  execute_command(command_json: string): string;
  preview_command(command_json: string): string;

  // Sysvars
  get_sysvar(name: string): number;
  set_sysvar(name: string, value: number): void;
  get_sysvars_json(): string;
  get_sysvar_typed_json(name: string): string;
  set_sysvar_typed_json(name: string, value_json: string): boolean;

  // Units
  get_units_json(): string;
  set_units_json(json: string): boolean;
  format_linear(value: number): string;
  format_angular(value_radians: number): string;

  // Text Styles
  get_text_styles_json(): string;
  get_current_text_style(): string;

  // Dimension Styles
  get_dim_styles_json(): string;
  get_current_dim_style(): string;

  // MLeader Styles
  get_mleader_styles_json(): string;
  get_current_mleader_style(): string;

  // Table Styles
  get_table_styles_json(): string;
  get_current_table_style(): string;

  // Drawing properties (DWGPROPS)
  get_dwg_props_json(): string;

  // Linetype scale
  get_ltscale(): { success: boolean; measurement?: number };

  // Groups
  get_groups_json(): string;

  // Named UCS
  get_named_ucs_json(): string;
  get_current_ucs(): string;

  // Named views
  get_named_views_json(): string;

  // Snaps
  find_perpendicular_snap(
    cursor_x: number,
    cursor_y: number,
    from_x: number,
    from_y: number,
    has_from: boolean,
    threshold: number,
  ): unknown;

  find_all_snaps(
    cursor_x: number,
    cursor_y: number,
    from_x: number,
    from_y: number,
    has_from: boolean,
    threshold: number,
    grid_size: number,
    snap_types: string,
  ): string;
}
