import type { UIChannel } from './UIEventBus';

const COMMAND_CHANNEL_MAP: Record<string, UIChannel[]> = {
  // Drawing — all create new entities
  CreatePoint: ['entities:created'],
  CreateLine: ['entities:created'],
  CreateCircle: ['entities:created'],
  CreateArc: ['entities:created'],
  CreateRectangle: ['entities:created'],
  CreatePolyline: ['entities:created'],
  CreateText: ['entities:created'],
  CreateDimension: ['entities:created'],
  CreateEllipse: ['entities:created'],
  CreateSpline: ['entities:created'],
  CreateConstructionLine: ['entities:created'],
  CreateRevisionCloud: ['entities:created'],
  CreateHatch: ['entities:created'],
  CreateMText: ['entities:created'],
  CreateTable: ['entities:created'],
  CreateAlignedDimension: ['entities:created'],
  CreateAngularDimension: ['entities:created'],
  CreateRadialDimension: ['entities:created'],
  CreateDiameterDimension: ['entities:created'],
  CreateCircle3P: ['entities:created'],
  CreateCircle2P: ['entities:created'],
  CreateCircleTtr: ['entities:created'],
  InsertBlock: ['entities:created'],

  // Editing — modify existing entities
  MoveEntity: ['entities:modified'],
  RotateEntity: ['entities:modified'],
  ScaleEntity: ['entities:modified'],
  ModifyGeometry: ['entities:modified'],
  Lengthen: ['entities:modified'],
  Fillet: ['entities:modified', 'entities:created'],
  Chamfer: ['entities:modified', 'entities:created'],
  TrimEntity: ['entities:modified'],
  ExtendEntity: ['entities:modified'],
  FilletPolyline: ['entities:modified'],
  MatchProperties: ['entities:modified'],
  SetEntityColor: ['entities:modified'],
  SetEntityLinetype: ['entities:modified'],
  SetEntityLineweight: ['entities:modified'],
  SetEntityLayer: ['entities:modified'],

  // Copy/Mirror/Offset/Array — create new entities
  CopyEntity: ['entities:created'],
  MirrorEntity: ['entities:created'],
  OffsetEntity: ['entities:created'],
  OffsetEntityThrough: ['entities:created'],
  ArrayRectangular: ['entities:created'],
  ArrayPolar: ['entities:created'],

  // Delete
  DeleteEntity: ['entities:deleted'],

  // Explode — deletes original, creates new
  Explode: ['entities:deleted', 'entities:created'],
  ExplodeBlock: ['entities:deleted', 'entities:created'],

  // Break — modifies and possibly creates
  Break: ['entities:modified', 'entities:created'],
  BreakAtPoint: ['entities:modified', 'entities:created'],

  // Join — modifies and deletes
  JoinEntities: ['entities:modified', 'entities:deleted'],

  // Layers
  CreateLayer: ['layers:changed'],
  DeleteLayer: ['layers:changed'],
  SetLayerVisible: ['layers:changed'],
  SetLayerLocked: ['layers:changed'],
  SetLayerColor: ['layers:changed'],
  RenameLayer: ['layers:changed'],
  SetLayerLinetype: ['layers:changed'],
  SetLayerLineweight: ['layers:changed'],

  // Blocks
  CreateBlock: ['entities:modified'],

  // Constraints
  AddConstraintHorizontal: ['constraints:changed'],
  AddConstraintVertical: ['constraints:changed'],
  AddConstraintCoincident: ['constraints:changed'],
  AddConstraintDistance: ['constraints:changed'],
  AddConstraintFixed: ['constraints:changed'],
  AddConstraintParallel: ['constraints:changed'],
  AddConstraintPerpendicular: ['constraints:changed'],
  AddConstraintEqualLength: ['constraints:changed'],
  RemoveConstraint: ['constraints:changed'],

  // Text styles
  CreateTextStyle: ['textstyles:changed'],
  ModifyTextStyle: ['textstyles:changed'],
  DeleteTextStyle: ['textstyles:changed'],
  SetCurrentTextStyle: ['textstyles:changed'],

  // Units
  SetUnits: ['units:changed'],

  // Undo/Redo — could affect anything, sync all entity views
  Undo: ['entities:created', 'entities:modified', 'entities:deleted', 'layers:changed'],
  Redo: ['entities:created', 'entities:modified', 'entities:deleted', 'layers:changed'],
};

const DEFAULT_CHANNELS: UIChannel[] = ['entities:modified'];

export function resolveChannels(command: { type: string }): UIChannel[] {
  return COMMAND_CHANNEL_MAP[command.type] ?? DEFAULT_CHANNELS;
}
