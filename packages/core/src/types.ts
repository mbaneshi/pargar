export type EntityId = string & { readonly __brand: 'EntityId' };

export interface Point2D {
  x: number;
  y: number;
}

export enum EntityType {
  Line = 'Line',
  Circle = 'Circle',
  Arc = 'Arc',
  Polyline = 'Polyline',
  Rectangle = 'Rectangle',
  Text = 'Text',
  Dimension = 'Dimension',
  Ellipse = 'Ellipse',
  Spline = 'Spline',
  Point = 'Point',
  ConstructionLine = 'ConstructionLine',
  BlockRef = 'BlockRef',
  AlignedDimension = 'AlignedDimension',
  AngularDimension = 'AngularDimension',
  RadialDimension = 'RadialDimension',
  DiameterDimension = 'DiameterDimension',
  Hatch = 'Hatch',
  MText = 'MText',
  Table = 'Table',
  RevisionCloud = 'RevisionCloud',
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

export interface EntityStyle {
  color?: string;
  linetype?: string;
  lineweight?: number;
}

export interface BaseEntity {
  id: EntityId;
  type: EntityType;
  layerId: string;
  style?: EntityStyle;
}

export interface LineEntity extends BaseEntity {
  type: EntityType.Line;
  start: Point2D;
  end: Point2D;
}

export interface CircleEntity extends BaseEntity {
  type: EntityType.Circle;
  center: Point2D;
  radius: number;
}

export interface ArcEntity extends BaseEntity {
  type: EntityType.Arc;
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface PolylineEntity extends BaseEntity {
  type: EntityType.Polyline;
  vertices: Point2D[];
  closed: boolean;
}

export interface RectangleEntity extends BaseEntity {
  type: EntityType.Rectangle;
  origin: Point2D;
  width: number;
  height: number;
  rotation: number;
}

export interface TextEntity extends BaseEntity {
  type: EntityType.Text;
  position: Point2D;
  content: string;
  height: number;
  rotation: number;
  styleName?: string;
}

export interface DimensionEntity extends BaseEntity {
  type: EntityType.Dimension;
  start: Point2D;
  end: Point2D;
  offset: number;
  textOverride?: string;
}

export interface EllipseEntity extends BaseEntity {
  type: EntityType.Ellipse;
  center: Point2D;
  semiMajor: number;
  semiMinor: number;
  rotation: number;
}

export interface SplineEntity extends BaseEntity {
  type: EntityType.Spline;
  controlPoints: Point2D[];
  degree: number;
  closed: boolean;
}

export interface PointEntity extends BaseEntity {
  type: EntityType.Point;
  position: Point2D;
}

export interface ConstructionLineEntity extends BaseEntity {
  type: EntityType.ConstructionLine;
  origin: Point2D;
  direction: Point2D;
}

export interface BlockRefEntity extends BaseEntity {
  type: EntityType.BlockRef;
  blockId: string;
  insertion: Point2D;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface AlignedDimensionEntity extends BaseEntity {
  type: EntityType.AlignedDimension;
  start: Point2D;
  end: Point2D;
  offset: number;
  textOverride?: string;
}

export interface AngularDimensionEntity extends BaseEntity {
  type: EntityType.AngularDimension;
  center: Point2D;
  startRay: Point2D;
  endRay: Point2D;
  radius: number;
  textOverride?: string;
}

export interface RadialDimensionEntity extends BaseEntity {
  type: EntityType.RadialDimension;
  center: Point2D;
  pointOnArc: Point2D;
  textOverride?: string;
}

export interface DiameterDimensionEntity extends BaseEntity {
  type: EntityType.DiameterDimension;
  center: Point2D;
  pointOnArc: Point2D;
  textOverride?: string;
}

export interface HatchEntity extends BaseEntity {
  type: EntityType.Hatch;
  boundaryIds: string[];
  pattern: string;
  scale: number;
  angle: number;
}

export interface MTextEntity extends BaseEntity {
  type: EntityType.MText;
  position: Point2D;
  content: string;
  width: number;
  height: number;
  rotation: number;
  styleName?: string;
}

export interface TableEntity extends BaseEntity {
  type: EntityType.Table;
  position: Point2D;
  rows: number;
  cols: number;
  rowHeight: number;
  colWidths: number[];
  cells: string[];
}

export interface RevisionCloudEntity extends BaseEntity {
  type: EntityType.RevisionCloud;
  boundary: Point2D[];
  arcLength: number;
}

export type CadEntity =
  | LineEntity
  | CircleEntity
  | ArcEntity
  | PolylineEntity
  | RectangleEntity
  | TextEntity
  | DimensionEntity
  | EllipseEntity
  | SplineEntity
  | PointEntity
  | ConstructionLineEntity
  | BlockRefEntity
  | AlignedDimensionEntity
  | AngularDimensionEntity
  | RadialDimensionEntity
  | DiameterDimensionEntity
  | HatchEntity
  | MTextEntity
  | TableEntity
  | RevisionCloudEntity;
