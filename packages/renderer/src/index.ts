export { CadRenderer } from './CadRenderer.js';
export { SnapEngine } from './SnapEngine.js';
export { SelectionManager } from './SelectionManager.js';
export type { GripHit } from './SelectionManager.js';
export type {
  RenderableEntity,
  RendererEntity,
  GeometryType,
  Point2D,
  EntityStyle,
  BlockDef,
  TextStyleDef,
  FlushChanges,
} from './CadRenderer.js';
export type { SnapPoint, SnapConfig } from './SnapEngine.js';
export { nextPow2, clipLineToBBox, pointToSegmentDist } from './renderUtils.js';
export { LineBatcher } from './LineBatcher.js';
export { GripPool } from './GripPool.js';
