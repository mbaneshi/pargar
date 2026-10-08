import type { EntityId } from './types';

// --- Actor (mirrors Rust Actor enum) ---

export type Actor =
  | { type: 'user'; session_id: string }
  | { type: 'agent'; agent_id: string; model: string }
  | { type: 'system' };

// --- Event Envelope (mirrors Rust EventEnvelope) ---

export interface EventEnvelope {
  seq: number;
  timestamp_ms: number;
  actor: Actor;
  schema_version: number;
  prev_hash: string;
  payload: CadEvent;
}

// --- CadEvent (mirrors Rust CadEvent enum) ---

export enum CadEventType {
  EntityCreated = 'EntityCreated',
  EntityDeleted = 'EntityDeleted',
  EntityMoved = 'EntityMoved',
  EntityRotated = 'EntityRotated',
  EntityScaled = 'EntityScaled',
  EntityCopied = 'EntityCopied',
  EntityModified = 'EntityModified',
  EntityStyleChanged = 'EntityStyleChanged',
  TextStyleCreated = 'TextStyleCreated',
  TextStyleModified = 'TextStyleModified',
  TextStyleDeleted = 'TextStyleDeleted',
  CompoundEvent = 'CompoundEvent',
}

export interface CadEvent {
  type: CadEventType;
  id?: string;
  entityId?: EntityId;
  payload: unknown;
}

// --- CommandResult (mirrors Rust CommandResult) ---

export interface CommandResult {
  success: boolean;
  created_ids: string[];
  error?: string;
  measurement?: number;
  warnings?: string[];
}

// --- Command (mirrors Rust Command enum, serde tag = "type") ---
// All 84 variants from packages/kernel/src/commands.rs

export type Command =
  // Drawing — basic
  | { type: 'CreatePoint'; x: number; y: number; layer_id: string }
  | { type: 'CreateLine'; x1: number; y1: number; x2: number; y2: number; layer_id: string }
  | { type: 'CreateCircle'; cx: number; cy: number; radius: number; layer_id: string }
  | {
      type: 'CreateArc';
      cx: number;
      cy: number;
      radius: number;
      start_angle: number;
      end_angle: number;
      layer_id: string;
    }
  | {
      type: 'CreateRectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      layer_id: string;
    }
  | { type: 'CreatePolyline'; vertices: [number, number][]; closed: boolean; layer_id: string }
  | {
      type: 'CreateText';
      x: number;
      y: number;
      content: string;
      height: number;
      rotation: number;
      layer_id: string;
    }
  | {
      type: 'CreateEllipse';
      cx: number;
      cy: number;
      semi_major: number;
      semi_minor: number;
      rotation: number;
      layer_id: string;
    }
  | {
      type: 'CreateSpline';
      control_points: [number, number][];
      degree: number;
      closed: boolean;
      layer_id: string;
    }
  | {
      type: 'CreateConstructionLine';
      ox: number;
      oy: number;
      dx: number;
      dy: number;
      layer_id: string;
    }
  // Drawing — dimensions
  | {
      type: 'CreateDimension';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      offset: number;
      layer_id: string;
    }
  | {
      type: 'CreateAlignedDimension';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      offset: number;
      layer_id: string;
    }
  | {
      type: 'CreateAngularDimension';
      cx: number;
      cy: number;
      sx: number;
      sy: number;
      ex: number;
      ey: number;
      radius: number;
      layer_id: string;
    }
  | {
      type: 'CreateRadialDimension';
      cx: number;
      cy: number;
      px: number;
      py: number;
      layer_id: string;
    }
  | {
      type: 'CreateDiameterDimension';
      cx: number;
      cy: number;
      px: number;
      py: number;
      layer_id: string;
    }
  // Drawing — complex
  | {
      type: 'CreateHatch';
      boundary_ids: string[];
      pattern: string;
      scale: number;
      angle: number;
      layer_id: string;
    }
  | {
      type: 'CreateMText';
      x: number;
      y: number;
      content: string;
      width: number;
      height: number;
      rotation: number;
      layer_id: string;
    }
  | {
      type: 'CreateTable';
      x: number;
      y: number;
      rows: number;
      cols: number;
      row_height: number;
      col_widths: number[];
      cells: string[];
      layer_id: string;
    }
  | {
      type: 'CreateRevisionCloud';
      vertices: [number, number][];
      arc_length?: number;
      layer_id: string;
    }
  // Drawing — circle construction modes
  | {
      type: 'CreateCircle3P';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      x3: number;
      y3: number;
      layer_id: string;
    }
  | { type: 'CreateCircle2P'; x1: number; y1: number; x2: number; y2: number; layer_id: string }
  | {
      type: 'CreateCircleTtr';
      entity1_id: string;
      pick1_x: number;
      pick1_y: number;
      entity2_id: string;
      pick2_x: number;
      pick2_y: number;
      radius: number;
      layer_id: string;
    }
  // Editing — basic
  | { type: 'DeleteEntity'; id: string }
  | { type: 'MoveEntity'; id: string; dx: number; dy: number }
  | { type: 'RotateEntity'; id: string; cx: number; cy: number; angle: number }
  | { type: 'ScaleEntity'; id: string; cx: number; cy: number; factor: number }
  | { type: 'CopyEntity'; id: string }
  | { type: 'MirrorEntity'; id: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'OffsetEntity'; id: string; distance: number }
  | { type: 'OffsetEntityThrough'; id: string; through_x: number; through_y: number }
  | { type: 'TrimEntity'; id: string; boundary_id: string; pick_x: number; pick_y: number }
  | { type: 'ModifyGeometry'; id: string; geometry_json: string }
  // Editing — advanced
  | { type: 'Fillet'; id_a: string; id_b: string; radius: number }
  | { type: 'FilletPolyline'; id: string; radius: number }
  | { type: 'Chamfer'; id_a: string; id_b: string; dist_a: number; dist_b: number }
  | { type: 'Explode'; entity_id: string }
  | { type: 'ExtendEntity'; id: string; boundary_id: string }
  | { type: 'JoinEntities'; ids: string[] }
  | { type: 'Lengthen'; entity_id: string; mode: string; value: number; end: string }
  | { type: 'BreakAtPoint'; entity_id: string; px: number; py: number }
  | { type: 'Break'; entity_id: string; x1: number; y1: number; x2: number; y2: number }
  | { type: 'MatchProperties'; source_id: string; target_ids: string[] }
  // Blocks
  | { type: 'CreateBlock'; name: string; base_x: number; base_y: number; entity_ids: string[] }
  | {
      type: 'InsertBlock';
      block_id: string;
      x: number;
      y: number;
      rotation: number;
      scale_x: number;
      scale_y: number;
      layer_id: string;
    }
  | { type: 'ExplodeBlock'; entity_id: string }
  // Arrays
  | {
      type: 'ArrayRectangular';
      entity_ids: string[];
      rows: number;
      cols: number;
      row_spacing: number;
      col_spacing: number;
    }
  | {
      type: 'ArrayPolar';
      entity_ids: string[];
      center_x: number;
      center_y: number;
      count: number;
      angle: number;
      rotate_items: boolean;
    }
  // Layers
  | { type: 'CreateLayer'; name: string; color: string }
  | { type: 'DeleteLayer'; id: string }
  | { type: 'SetLayerVisible'; id: string; visible: boolean }
  | { type: 'SetLayerLocked'; id: string; locked: boolean }
  | { type: 'SetLayerColor'; id: string; color: string }
  | { type: 'RenameLayer'; id: string; name: string }
  | { type: 'SetEntityLayer'; entity_id: string; layer_id: string }
  | { type: 'SetLayerLinetype'; id: string; linetype?: string }
  | { type: 'SetLayerLineweight'; id: string; lineweight?: number }
  // Style
  | { type: 'SetEntityColor'; id: string; color?: string }
  | { type: 'SetEntityLinetype'; id: string; linetype?: string }
  | { type: 'SetEntityLineweight'; id: string; lineweight?: number }
  // Constraints
  | { type: 'AddConstraintHorizontal'; entity_id: string }
  | { type: 'AddConstraintVertical'; entity_id: string }
  | {
      type: 'AddConstraintCoincident';
      entity_a: string;
      point_a: number;
      entity_b: string;
      point_b: number;
    }
  | {
      type: 'AddConstraintDistance';
      entity_a: string;
      point_a: number;
      entity_b: string;
      point_b: number;
      distance: number;
    }
  | { type: 'AddConstraintFixed'; entity_id: string; point_index: number; x: number; y: number }
  | { type: 'AddConstraintParallel'; entity_a: string; entity_b: string }
  | { type: 'AddConstraintPerpendicular'; entity_a: string; entity_b: string }
  | { type: 'AddConstraintEqualLength'; entity_a: string; entity_b: string }
  | { type: 'AddConstraintTangent'; line_entity: string; circle_entity: string }
  | { type: 'AddConstraintConcentric'; entity_a: string; entity_b: string }
  | { type: 'AddConstraintSymmetric'; entity_id: string; axis_entity: string }
  | { type: 'RemoveConstraint'; id: string }
  | { type: 'AnalyzeDof' }
  // Measurement
  | { type: 'MeasureDistance'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'MeasureArea'; entity_id: string }
  // Text styles
  | {
      type: 'CreateTextStyle';
      name: string;
      font_family?: string;
      height?: number;
      width_factor?: number;
      oblique_angle?: number;
      is_bold?: boolean;
      is_italic?: boolean;
    }
  | {
      type: 'ModifyTextStyle';
      name: string;
      font_family?: string;
      height?: number;
      width_factor?: number;
      oblique_angle?: number;
      is_bold?: boolean;
      is_italic?: boolean;
    }
  | { type: 'DeleteTextStyle'; name: string }
  | { type: 'SetCurrentTextStyle'; name: string }
  // Sysvars
  | { type: 'SetSysvar'; name: string; value: number }
  | { type: 'GetSysvar'; name: string }
  // Undo/Redo
  | { type: 'Undo' }
  | { type: 'Redo' };
