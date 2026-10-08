import * as THREE from 'three';
import { SnapEngine, type SnapPoint } from './SnapEngine.js';
import { SelectionManager } from './SelectionManager.js';
import { LineBatcher } from './LineBatcher.js';
import { GripPool } from './GripPool.js';
import { nextPow2, clipLineToBBox } from './renderUtils.js';
import { buildWipeoutMesh } from './wipeoutGeometry.js';
import { createLogger } from '@nexus/logger';

const log = createLogger('renderer');

export interface Point2D {
  x: number;
  y: number;
}

export interface EntityStyle {
  color?: string;
  linetype?: string;
  lineweight?: number;
}

export interface BlockDef {
  id: string;
  name: string;
  base_point: Point2D;
  entities: RendererEntity[];
}

export interface TextStyleDef {
  name: string;
  font_family: string;
  height: number;
  width_factor: number;
  oblique_angle: number;
  is_bold: boolean;
  is_italic: boolean;
}

export interface DimStyleDef {
  name: string;
  dimscale: number;
  dimtxt: number;
  dimasz: number;
  dimexo: number;
  dimexe: number;
  dimgap: number;
  dimtad: number;
  dimclrt?: string | null;
  dimclrd?: string | null;
  dimclre?: string | null;
  dimtxsty: string;
}

export interface MLeaderStyleDef {
  name: string;
  arrow_size: number;
  text_height: number;
  text_style_name: string;
  landing_distance: number;
  enable_landing: boolean;
  enable_dogleg: boolean;
  color?: string | null;
}

export interface TableStyleDef {
  name: string;
  text_style_name: string;
  data_text_height: number;
  header_text_height: number;
  title_text_height: number;
  has_title: boolean;
  has_header: boolean;
  cell_margin: number;
  border_color?: string | null;
  title_fill_color?: string | null;
  header_fill_color?: string | null;
}

// Geometry is a tagged object from the kernel (e.g. { Line: { start, end } }).
// The renderer accesses variants via property checks (g.Line, g.Circle, etc.)
// so we use Record<string, any> here. Strict discriminated union types live
// in @nexus/core for future typed usage.
export type GeometryType = Record<string, any>;

// Variant names emitted by the kernel's GeometryType enum. Source of truth:
// packages/kernel/src/entity.rs. The renderer dispatch does NOT consult this
// set — it exists solely so warnUnknownGeometryVariant can distinguish a
// kernel that grew a new entity type from a known variant that legitimately
// produced no object due to insufficient data. Keep in sync with entity.rs;
// the warn-once telemetry below is the early-warning system that catches
// drift when it doesn't.
const KNOWN_GEOMETRY_VARIANTS: ReadonlySet<string> = new Set([
  'Line',
  'Circle',
  'Arc',
  'Polyline',
  'Rectangle',
  'Text',
  'Dimension',
  'Ellipse',
  'Spline',
  'Point',
  'ConstructionLine',
  'Ray',
  'BlockRef',
  'AlignedDimension',
  'AngularDimension',
  'RadialDimension',
  'DiameterDimension',
  'Hatch',
  'MText',
  'Table',
  'RevisionCloud',
  'Leader',
  'EllipseArc',
  'Wipeout',
  'Tolerance',
  'AttDef',
]);

const warnedUnknownVariants = new Set<string>();

/** Test-only: reset the warn-once session state. */
export function __resetUnknownVariantWarnings(): void {
  warnedUnknownVariants.clear();
}

/**
 * Emit a structured warning the first time per session the kernel sends a
 * GeometryType variant the renderer has no branch for. Subsequent occurrences
 * of the same variant — even across many frames or many entities — are
 * silent. Variants already in KNOWN_GEOMETRY_VARIANTS are ignored entirely
 * (they may produce no object for data-validity reasons unrelated to the
 * dispatch coverage this telemetry guards).
 */
export function warnUnknownGeometryVariant(geom: GeometryType): void {
  const variant = Object.keys(geom)[0];
  if (!variant) return;
  if (KNOWN_GEOMETRY_VARIANTS.has(variant)) return;
  if (warnedUnknownVariants.has(variant)) return;
  warnedUnknownVariants.add(variant);
  log.warn('renderer.unknown_geometry_variant', { variant });
}

export interface RendererEntity {
  id: string;
  geometry: GeometryType;
  layer_id?: string;
  style?: EntityStyle;
  color?: string;
  linetype?: string;
  layerId?: string;
  draw_order?: number;
}

export interface RenderableEntity {
  id: string;
  type: string;
  geometry: GeometryType;
  layerId: string;
  color?: string;
  draw_order?: number;
}

export interface FlushChanges {
  upserted: RendererEntity[];
  deleted: string[];
}

export class CadRenderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private gridHelper: THREE.Group;
  private entityMeshes: Map<string, THREE.Object3D> = new Map();

  private viewCenter = { x: 0, y: 0 };
  private zoom = 50;
  private container: HTMLElement;
  private width = 0;
  private height = 0;

  private viewHistory: Array<{ x: number; y: number; zoom: number }> = [];
  private _viewHistoryIndex = -1;
  private readonly MAX_VIEW_HISTORY = 20;
  private isRestoringView = false;
  private panStartState: { x: number; y: number; zoom: number } | null = null;

  private isPanning = false;
  private suppressClick = false;
  private lastMouse = { x: 0, y: 0 };

  public cursorWorld = { x: 0, y: 0 };

  public onCursorMove?: (x: number, y: number) => void;
  public onCursorScreen?: (screenX: number, screenY: number) => void;
  public onClick?: (worldX: number, worldY: number, shiftKey: boolean) => void;
  public onDragStart?: (worldX: number, worldY: number) => void;
  public onDragMove?: (worldX: number, worldY: number) => void;
  public onDragEnd?: (
    startWorld: { x: number; y: number },
    endWorld: { x: number; y: number },
  ) => void;

  public snapEngine: SnapEngine;
  public selectionManager: SelectionManager;
  private lineBatcher: LineBatcher;
  private gripPool: GripPool;
  private previewObject: THREE.Object3D | null = null;
  private snapIndicator: THREE.Group | null = null;
  private cachedEntities: RendererEntity[] = [];
  private materialCache: Map<string, THREE.Material> = new Map();
  private lastLayerColors: Map<string, string> = new Map();
  private hoveredEntityId: string | null = null;
  private hoverMaterial: THREE.LineBasicMaterial;
  private dragStartScreen: { x: number; y: number } | null = null;
  private dragStartWorld: { x: number; y: number } | null = null;
  private isDragging = false;
  private selectionRectObject: THREE.Group | null = null;
  private polarGuideObject: THREE.Line | null = null;
  private trackingGuideObjects: THREE.Line[] = [];
  public crosshairGroup: THREE.Group | null = null;
  public crosshairVisible: boolean = false;
  public crosshairCursorSize: number = 0.05;
  private dirty = true;
  private rafId: number | null = null;
  private currentGridStep: number = 0;
  public textStyles: Map<string, TextStyleDef> = new Map();
  public dimStyles: Map<string, DimStyleDef> = new Map();
  public mleaderStyles: Map<string, MLeaderStyleDef> = new Map();
  public tableStyles: Map<string, TableStyleDef> = new Map();
  public blockDefs: BlockDef[] = [];

  /** Global linetype scale (LTSCALE). Multiplies all dashed-pattern sizes. */
  public ltscale: number = 1.0;

  public setLtscale(scale: number): void {
    if (scale <= 0 || !Number.isFinite(scale) || scale === this.ltscale) return;
    this.ltscale = scale;
    this.materialCache.clear();
    this.markDirty();
  }

  /**
   * Resolve a dimension's effective text height in world units.
   * If the dimension has an explicit style_name and that style exists, use
   * dimtxt × dimscale (matches AutoCAD DIMSTYLE behavior). Otherwise fall
   * back to the legacy offset-proportional heuristic — keeps existing
   * untyped dimensions visually unchanged.
   */
  private resolveDimTextHeight(styleName: string | undefined | null, fallback: number): number {
    if (!styleName) return fallback;
    const ds = this.dimStyles.get(styleName);
    if (!ds) return fallback;
    return ds.dimtxt * ds.dimscale;
  }

  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnClickHandler: (e: MouseEvent) => void;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement) {
    this.container = container;
    this.width = container.clientWidth;
    this.height = container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e1e);

    this.snapEngine = new SnapEngine();
    this.selectionManager = new SelectionManager(this.scene);
    this.lineBatcher = new LineBatcher(this.scene);
    this.gripPool = new GripPool(this.scene);
    this.hoverMaterial = new THREE.LineBasicMaterial({ color: 0x4488ff });

    const aspect = this.width / this.height;
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect,
      this.zoom * aspect,
      this.zoom,
      -this.zoom,
      -1000,
      1000,
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.currentGridStep = this.getGridStep();
    this.gridHelper = this.createGrid();
    this.scene.add(this.gridHelper);

    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnClickHandler = this.onClickHandler.bind(this);

    this.renderer.domElement.addEventListener('wheel', this.boundOnWheel);
    this.renderer.domElement.addEventListener('mousedown', this.boundOnMouseDown);
    this.renderer.domElement.addEventListener('mousemove', this.boundOnMouseMove);
    this.renderer.domElement.addEventListener('mouseup', this.boundOnMouseUp);
    this.renderer.domElement.addEventListener('click', this.boundOnClickHandler);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(container);

    this.startRenderLoop();
    log.info('renderer initialized');
  }

  private startRenderLoop() {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      if (this.dirty) {
        this.renderer.render(this.scene, this.camera);
        this.dirty = false;
      }
    };
    loop();
  }

  private createGrid(): THREE.Group {
    const group = new THREE.Group();
    const gridSize = 1000;
    const step = this.getGridStep();

    const minorPositions: number[] = [];
    const majorPositions: number[] = [];

    for (let i = -gridSize; i <= gridSize; i += step) {
      const isMajor = Math.abs(i % (step * 5)) < 0.001;
      const target = isMajor ? majorPositions : minorPositions;
      // Vertical line
      target.push(i, -gridSize, 0, i, gridSize, 0);
      // Horizontal line
      target.push(-gridSize, i, 0, gridSize, i, 0);
    }

    if (minorPositions.length > 0) {
      const minorGeo = new THREE.BufferGeometry();
      minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorPositions, 3));
      group.add(new THREE.LineSegments(minorGeo, new THREE.LineBasicMaterial({ color: 0x2a2a2a })));
    }

    if (majorPositions.length > 0) {
      const majorGeo = new THREE.BufferGeometry();
      majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPositions, 3));
      group.add(new THREE.LineSegments(majorGeo, new THREE.LineBasicMaterial({ color: 0x333333 })));
    }

    // Axis lines (2 draw calls)
    const axisPositions = new Float32Array([
      -gridSize,
      0,
      0,
      gridSize,
      0,
      0, // X axis
      0,
      -gridSize,
      0,
      0,
      gridSize,
      0, // Y axis
    ]);
    const xGeo = new THREE.BufferGeometry();
    xGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(axisPositions.subarray(0, 6), 3),
    );
    group.add(new THREE.LineSegments(xGeo, new THREE.LineBasicMaterial({ color: 0x4a2020 })));

    const yGeo = new THREE.BufferGeometry();
    yGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(axisPositions.subarray(6, 12), 3),
    );
    group.add(new THREE.LineSegments(yGeo, new THREE.LineBasicMaterial({ color: 0x204a20 })));

    return group;
  }

  private getGridStep(): number {
    if (this.zoom > 500) return 100;
    if (this.zoom > 200) return 50;
    if (this.zoom > 100) return 10;
    if (this.zoom > 50) return 5;
    if (this.zoom > 20) return 2;
    if (this.zoom > 5) return 1;
    return 0.5;
  }

  private updateCamera() {
    const aspect = this.width / this.height;
    this.camera.left = this.viewCenter.x - this.zoom * aspect;
    this.camera.right = this.viewCenter.x + this.zoom * aspect;
    this.camera.top = this.viewCenter.y + this.zoom;
    this.camera.bottom = this.viewCenter.y - this.zoom;
    this.camera.updateProjectionMatrix();
    if (this.crosshairVisible) this.updateCrosshair();
  }

  public defaultCursor = 'none';

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const aspect = this.width / this.height;
    const ndcX = (worldX - this.viewCenter.x) / (this.zoom * aspect);
    const ndcY = (worldY - this.viewCenter.y) / this.zoom;
    return {
      x: ((ndcX + 1) / 2) * this.width,
      y: ((1 - ndcY) / 2) * this.height,
    };
  }

  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((screenX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((screenY - rect.top) / rect.height) * 2 + 1;
    const aspect = this.width / this.height;
    return {
      x: this.viewCenter.x + ndcX * this.zoom * aspect,
      y: this.viewCenter.y + ndcY * this.zoom,
    };
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    this.pushViewState();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    const before = this.screenToWorld(e.clientX, e.clientY);
    this.zoom *= zoomFactor;
    this.zoom = Math.max(1, Math.min(10000, this.zoom));
    this.updateCamera();
    const after = this.screenToWorld(e.clientX, e.clientY);

    this.viewCenter.x += before.x - after.x;
    this.viewCenter.y += before.y - after.y;
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  private rebuildGridIfNeeded() {
    const newStep = this.getGridStep();
    if (newStep !== this.currentGridStep) {
      this.scene.remove(this.gridHelper);
      this.disposeObject(this.gridHelper);
      this.currentGridStep = newStep;
      this.gridHelper = this.createGrid();
      this.scene.add(this.gridHelper);
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      this.isPanning = true;
      this.panStartState = { x: this.viewCenter.x, y: this.viewCenter.y, zoom: this.zoom };
      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if (e.button === 0 && !e.shiftKey) {
      this.dragStartScreen = { x: e.clientX, y: e.clientY };
      this.dragStartWorld = this.screenToWorld(e.clientX, e.clientY);
    }
  }

  private onMouseMove(e: MouseEvent) {
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.cursorWorld = world;
    this.onCursorMove?.(world.x, world.y);

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.onCursorScreen?.(e.clientX - rect.left, e.clientY - rect.top);

    if (this.crosshairVisible) this.updateCrosshair();

    if (this.dragStartScreen && !this.isPanning) {
      const dx = e.clientX - this.dragStartScreen.x;
      const dy = e.clientY - this.dragStartScreen.y;
      if (!this.isDragging && Math.sqrt(dx * dx + dy * dy) > 5) {
        this.isDragging = true;
        this.onDragStart?.(this.dragStartWorld!.x, this.dragStartWorld!.y);
      }
      if (this.isDragging) {
        this.updateSelectionRect(this.dragStartWorld!, world);
        this.onDragMove?.(world.x, world.y);
      }
    }

    if (!this.isPanning && !this.isDragging) {
      const prevHover = this.hoveredEntityId;
      this.updateHover(world.x, world.y);
      if (this.hoveredEntityId !== prevHover) {
        this.markDirty();
      }
    }

    if (this.isPanning) {
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      const aspect = this.width / this.height;

      this.viewCenter.x -= (dx / this.width) * 2 * this.zoom * aspect;
      this.viewCenter.y += (dy / this.height) * 2 * this.zoom;

      this.lastMouse = { x: e.clientX, y: e.clientY };
      this.updateCamera();
      this.markDirty();
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (this.isPanning) {
      this.isPanning = false;
      this.renderer.domElement.style.cursor = this.defaultCursor;
      if (this.panStartState) {
        const moved =
          this.panStartState.x !== this.viewCenter.x || this.panStartState.y !== this.viewCenter.y;
        if (moved) {
          const saved = { ...this.panStartState };
          const current = { x: this.viewCenter.x, y: this.viewCenter.y, zoom: this.zoom };
          this.viewCenter = { x: saved.x, y: saved.y };
          this.zoom = saved.zoom;
          this.pushViewState();
          this.viewCenter = { x: current.x, y: current.y };
          this.zoom = current.zoom;
          this.updateCamera();
        }
        this.panStartState = null;
      }
    }
    if (this.isDragging && this.dragStartWorld) {
      const endWorld = this.screenToWorld(e.clientX, e.clientY);
      this.clearSelectionRect();
      this.onDragEnd?.(this.dragStartWorld, endWorld);
      this.suppressClick = true;
    }
    this.dragStartScreen = null;
    this.dragStartWorld = null;
    this.isDragging = false;
  }

  private onClickHandler(e: MouseEvent) {
    if (this.isDragging || this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.onClick?.(world.x, world.y, e.shiftKey);
  }

  private updateSelectionRect(start: { x: number; y: number }, end: { x: number; y: number }) {
    this.clearSelectionRect();

    const isWindow = end.x > start.x;
    const group = new THREE.Group();

    const fillColor = isWindow ? 0x3399ff : 0x33ff66;
    const borderColor = isWindow ? 0x3399ff : 0x33ff66;

    const shape = new THREE.Shape();
    shape.moveTo(start.x, start.y);
    shape.lineTo(end.x, start.y);
    shape.lineTo(end.x, end.y);
    shape.lineTo(start.x, end.y);
    shape.lineTo(start.x, start.y);

    const fillGeo = new THREE.ShapeGeometry(shape);
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: 0.15,
      depthTest: false,
    });
    const fillMesh = new THREE.Mesh(fillGeo, fillMat);
    fillMesh.position.z = 0.5;
    group.add(fillMesh);

    const borderPts = [
      new THREE.Vector3(start.x, start.y, 0.6),
      new THREE.Vector3(end.x, start.y, 0.6),
      new THREE.Vector3(end.x, end.y, 0.6),
      new THREE.Vector3(start.x, end.y, 0.6),
      new THREE.Vector3(start.x, start.y, 0.6),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    let borderLine: THREE.Line;
    if (isWindow) {
      borderLine = new THREE.Line(borderGeo, new THREE.LineBasicMaterial({ color: borderColor }));
    } else {
      const dashMat = new THREE.LineDashedMaterial({
        color: borderColor,
        dashSize: this.zoom * 0.015,
        gapSize: this.zoom * 0.008,
      });
      borderLine = new THREE.Line(borderGeo, dashMat);
      borderLine.computeLineDistances();
    }
    group.add(borderLine);

    this.selectionRectObject = group;
    this.scene.add(group);
    this.markDirty();
  }

  private clearSelectionRect() {
    if (this.selectionRectObject) {
      this.scene.remove(this.selectionRectObject);
      this.disposeObject(this.selectionRectObject);
      this.selectionRectObject = null;
    }
  }

  private onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.updateCamera();
    this.markDirty();
  }

  private static readonly LINETYPE_PATTERNS: Record<string, { dashSize: number; gapSize: number }> =
    {
      DASHED: { dashSize: 4, gapSize: 2 },
      CENTER: { dashSize: 6, gapSize: 1.5 },
      HIDDEN: { dashSize: 2, gapSize: 1 },
      DOT: { dashSize: 0.5, gapSize: 1 },
      DASHDOT: { dashSize: 4, gapSize: 1 },
    };

  private getMaterial(colorHex: string, linetype?: string, lineweight?: number): THREE.Material {
    const lt = linetype?.toUpperCase() || 'CONTINUOUS';
    const lw = lineweight || 1;
    const key = `${colorHex}|${lt}|${lw}|${this.ltscale}`;
    const cached = this.materialCache.get(key);
    if (cached) return cached;
    const pattern = CadRenderer.LINETYPE_PATTERNS[lt];
    let mat: THREE.Material;
    if (pattern) {
      mat = new THREE.LineDashedMaterial({
        color: new THREE.Color(colorHex),
        // LTSCALE applies globally; matches AutoCAD behavior.
        dashSize: pattern.dashSize * this.ltscale,
        gapSize: pattern.gapSize * this.ltscale,
        linewidth: lw,
      });
    } else {
      mat = new THREE.LineBasicMaterial({ color: new THREE.Color(colorHex), linewidth: lw });
    }
    this.materialCache.set(key, mat);
    return mat;
  }

  private resolveEntityStyle(
    entity: RendererEntity,
    layerColors: Map<string, string>,
    layerLinetypes?: Map<string, string>,
  ): { color: string; linetype?: string; lineweight?: number } {
    const layerId = entity.layer_id || entity.layerId || '';
    const layerColor = layerColors.get(layerId) || '#ffffff';
    const layerLinetype = layerLinetypes?.get(layerId);
    const style = entity.style || {};
    return {
      color: style.color || entity.color || layerColor || '#ffffff',
      linetype: style.linetype || entity.linetype || layerLinetype || undefined,
      lineweight: style.lineweight || undefined,
    };
  }

  private createEntityObject(
    entity: RendererEntity,
    layerColors: Map<string, string>,
  ): THREE.Object3D | null {
    const resolved = this.resolveEntityStyle(entity, layerColors);
    const material = this.getMaterial(resolved.color, resolved.linetype, resolved.lineweight);
    const geom = entity.geometry;

    let object: THREE.Object3D | null = null;

    if (geom.Line) {
      const { start, end } = geom.Line;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, 0),
        new THREE.Vector3(end.x, end.y, 0),
      ]);
      object = new THREE.Line(geo, material);
    } else if (geom.Circle) {
      const { center, radius } = geom.Circle;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        0,
        Math.PI * 2,
        false,
        0,
      );
      const points = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      );
      object = new THREE.Line(geo, material);
    } else if (geom.Arc) {
      const { center, radius, start_angle, end_angle } = geom.Arc;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        start_angle,
        end_angle,
        false,
        0,
      );
      const points = curve.getPoints(64);
      const geo = new THREE.BufferGeometry().setFromPoints(
        points.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      );
      object = new THREE.Line(geo, material);
    } else if (geom.Polyline) {
      const { vertices, closed } = geom.Polyline;
      const pts = vertices.map((v: Point2D) => new THREE.Vector3(v.x, v.y, 0));
      if (closed && pts.length > 0) pts.push(pts[0].clone());
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      object = new THREE.Line(geo, material);
    } else if (geom.Rectangle) {
      const { origin, width, height, rotation } = geom.Rectangle;
      const pts = [
        new THREE.Vector3(origin.x, origin.y, 0),
        new THREE.Vector3(origin.x + width, origin.y, 0),
        new THREE.Vector3(origin.x + width, origin.y + height, 0),
        new THREE.Vector3(origin.x, origin.y + height, 0),
        new THREE.Vector3(origin.x, origin.y, 0),
      ];
      if (rotation !== 0) {
        const cx = origin.x + width / 2;
        const cy = origin.y + height / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        for (const p of pts) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          p.x = cx + dx * cos - dy * sin;
          p.y = cy + dx * sin + dy * cos;
        }
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      object = new THREE.Line(geo, material);
    } else if (geom.Text) {
      const { position, content, height: textHeight, rotation, style_name } = geom.Text;
      const ts = style_name ? this.textStyles.get(style_name) : undefined;
      const fontFamily = ts?.font_family ?? 'sans-serif';
      const widthFactor = ts?.width_factor ?? 1.0;
      const obliqueAngle = ts?.oblique_angle ?? 0;
      const isBold = ts?.is_bold ?? false;
      const isItalic = ts?.is_italic ?? false;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fontSize = Math.max(64, Math.round(128 * dpr));
      const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      ctx.font = fontStyle;
      const metrics = ctx.measureText(content);
      canvas.width = nextPow2(Math.ceil(metrics.width * widthFactor) + 4);
      canvas.height = nextPow2(fontSize + 8);
      ctx.font = fontStyle;
      ctx.fillStyle = resolved.color;
      ctx.textBaseline = 'bottom';
      if (obliqueAngle !== 0 || widthFactor !== 1.0) {
        ctx.save();
        ctx.transform(widthFactor, 0, Math.tan((obliqueAngle * Math.PI) / 180), 1, 0, 0);
        ctx.fillText(content, 2, canvas.height - 4);
        ctx.restore();
      } else {
        ctx.fillText(content, 2, canvas.height - 4);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMat);
      const texAspect = (metrics.width * widthFactor + 4) / (fontSize + 8);
      sprite.scale.set(textHeight * texAspect, textHeight, 1);
      if (rotation !== 0) {
        const group = new THREE.Group();
        group.position.set(position.x, position.y, 0);
        group.rotation.z = rotation;
        sprite.position.set((textHeight * texAspect) / 2, textHeight / 2, 0.1);
        group.add(sprite);
        object = group;
      } else {
        sprite.position.set(
          position.x + (textHeight * texAspect) / 2,
          position.y + textHeight / 2,
          0.1,
        );
        object = sprite;
      }
    } else if (geom.MText) {
      const {
        position,
        content,
        width: mtextWidth,
        height: mtextHeight,
        rotation: mtextRotation,
        style_name,
      } = geom.MText;
      const lines_arr = (content || '').split('\\n');
      const lineCount = Math.max(lines_arr.length, 1);
      const lineHeight = mtextHeight > 0 ? mtextHeight / lineCount : 2.5;
      const canvas = document.createElement('canvas');
      const ctx2 = canvas.getContext('2d')!;
      const dpr2 = Math.min(window.devicePixelRatio || 1, 2);
      const fontSize = Math.max(48, Math.round(96 * dpr2));
      ctx2.font = `${fontSize}px ${style_name || 'sans-serif'}`;
      let maxLineWidth = 0;
      for (const line of lines_arr) {
        const w = ctx2.measureText(line).width;
        if (w > maxLineWidth) maxLineWidth = w;
      }
      canvas.width = nextPow2(Math.max(Math.ceil(maxLineWidth) + 8, 64));
      canvas.height = nextPow2(Math.max(fontSize * lineCount + 8, 64));
      ctx2.font = `${fontSize}px ${style_name || 'sans-serif'}`;
      ctx2.fillStyle = resolved.color;
      ctx2.textBaseline = 'top';
      for (let i = 0; i < lines_arr.length; i++) {
        ctx2.fillText(lines_arr[i], 4, 4 + i * fontSize);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(spriteMat);
      const aspect = canvas.width / canvas.height;
      const spriteHeight = mtextHeight > 0 ? mtextHeight : lineCount * lineHeight;
      sprite.scale.set(spriteHeight * aspect, spriteHeight, 1);
      sprite.position.set(
        position.x + (spriteHeight * aspect) / 2,
        position.y - spriteHeight / 2,
        0.1,
      );
      if (mtextRotation && Math.abs(mtextRotation) > 1e-9) {
        const group = new THREE.Group();
        group.add(sprite);
        group.position.set(position.x, position.y, 0);
        sprite.position.set((spriteHeight * aspect) / 2, -spriteHeight / 2, 0.1);
        group.rotation.z = mtextRotation;
        object = group;
      } else {
        object = sprite;
      }
      void mtextWidth;
    } else if (geom.Table) {
      const { position, rows, cols, row_height, col_widths, cells, style_name } = geom.Table;
      const tableStyle = style_name ? this.tableStyles.get(style_name) : undefined;
      const totalWidth = col_widths.reduce((sum: number, w: number) => sum + w, 0);
      const totalHeight = rows * row_height;
      const canvas = document.createElement('canvas');
      const sc = 20;
      canvas.width = Math.ceil(totalWidth * sc) + 2;
      canvas.height = Math.ceil(totalHeight * sc) + 2;
      const ctx2 = canvas.getContext('2d')!;
      // Background
      ctx2.fillStyle = '#1a1a2e';
      ctx2.fillRect(0, 0, canvas.width, canvas.height);
      // Header / title fills (when a style overrides)
      if (tableStyle?.has_header && tableStyle.header_fill_color) {
        ctx2.fillStyle = tableStyle.header_fill_color;
        const headerRow = tableStyle.has_title ? 1 : 0;
        ctx2.fillRect(0, headerRow * row_height * sc, totalWidth * sc, row_height * sc);
      }
      if (tableStyle?.has_title && tableStyle.title_fill_color) {
        ctx2.fillStyle = tableStyle.title_fill_color;
        ctx2.fillRect(0, 0, totalWidth * sc, row_height * sc);
      }
      // Borders
      ctx2.strokeStyle = tableStyle?.border_color ?? resolved.color;
      ctx2.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        const y = r * row_height * sc;
        ctx2.beginPath();
        ctx2.moveTo(0, y);
        ctx2.lineTo(totalWidth * sc, y);
        ctx2.stroke();
      }
      let xAcc = 0;
      for (let c = 0; c <= cols; c++) {
        const x = xAcc * sc;
        ctx2.beginPath();
        ctx2.moveTo(x, 0);
        ctx2.lineTo(x, totalHeight * sc);
        ctx2.stroke();
        if (c < cols) xAcc += col_widths[c] || 1;
      }
      // Cell text — pick the right text height per row when a style is set.
      ctx2.fillStyle = resolved.color;
      ctx2.textBaseline = 'middle';
      // Margin between cell content and border (TABLESTYLE.cell_margin in world units).
      const margin = tableStyle ? tableStyle.cell_margin * sc : 4;
      for (let r = 0; r < rows; r++) {
        let cx = 0;
        // Determine which "tier" this row is (title / header / data) when a
        // table style is set so each tier renders at its own text height.
        let rowTextHeight = row_height * 0.6;
        if (tableStyle) {
          const titleRows = tableStyle.has_title ? 1 : 0;
          const headerRows = tableStyle.has_header ? 1 : 0;
          if (r < titleRows) rowTextHeight = tableStyle.title_text_height;
          else if (r < titleRows + headerRows) rowTextHeight = tableStyle.header_text_height;
          else rowTextHeight = tableStyle.data_text_height;
        }
        const fs = Math.max(8, Math.floor(rowTextHeight * sc));
        ctx2.font = `${fs}px sans-serif`;
        for (let c = 0; c < cols; c++) {
          const cellIdx = r * cols + c;
          const text = cells[cellIdx] || '';
          const cellWidth = (col_widths[c] || 1) * sc;
          ctx2.fillText(text, cx + margin, (r + 0.5) * row_height * sc, cellWidth - 2 * margin);
          cx += cellWidth;
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const spriteMat = new THREE.SpriteMaterial({ map: tex });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(totalWidth, totalHeight, 1);
      sprite.position.set(position.x + totalWidth / 2, position.y - totalHeight / 2, 0.1);
      object = sprite;
    } else if (geom.Dimension) {
      const { start, end, offset, text_override, style_name } = geom.Dimension;
      const ddx = end.x - start.x;
      const ddy = end.y - start.y;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len > 1e-9) {
        const nx = (-ddy / len) * offset;
        const ny = (ddx / len) * offset;
        const group = new THREE.Group();
        const dimGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x + nx, start.y + ny, 0),
          new THREE.Vector3(end.x + nx, end.y + ny, 0),
        ]);
        group.add(new THREE.Line(dimGeo, material));
        const ext1 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x, start.y, 0),
          new THREE.Vector3(start.x + nx, start.y + ny, 0),
        ]);
        group.add(new THREE.Line(ext1, material));
        const ext2 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(end.x, end.y, 0),
          new THREE.Vector3(end.x + nx, end.y + ny, 0),
        ]);
        group.add(new THREE.Line(ext2, material));
        const dimText = text_override || len.toFixed(2);
        const canvas = document.createElement('canvas');
        const ctx2 = canvas.getContext('2d')!;
        const fs = 48;
        ctx2.font = `${fs}px sans-serif`;
        const tw = Math.ceil(ctx2.measureText(dimText).width) + 4;
        canvas.width = tw;
        canvas.height = fs + 8;
        ctx2.font = `${fs}px sans-serif`;
        ctx2.fillStyle = resolved.color;
        ctx2.textBaseline = 'bottom';
        ctx2.fillText(dimText, 2, canvas.height - 4);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sm = new THREE.SpriteMaterial({ map: tex });
        const sp = new THREE.Sprite(sm);
        const th = this.resolveDimTextHeight(style_name, Math.abs(offset) * 0.4);
        const ta = canvas.width / canvas.height;
        sp.scale.set(th * ta, th, 1);
        sp.position.set((start.x + end.x) / 2 + nx, (start.y + end.y) / 2 + ny, 0.1);
        group.add(sp);
        object = group;
      }
    } else if (geom.AlignedDimension) {
      const { start, end, offset, text_override, style_name } = geom.AlignedDimension;
      const ddx = end.x - start.x;
      const ddy = end.y - start.y;
      const len = Math.sqrt(ddx * ddx + ddy * ddy);
      if (len > 1e-9) {
        const nx = (-ddy / len) * offset;
        const ny = (ddx / len) * offset;
        const group = new THREE.Group();
        const dimGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x + nx, start.y + ny, 0),
          new THREE.Vector3(end.x + nx, end.y + ny, 0),
        ]);
        group.add(new THREE.Line(dimGeo, material));
        const ext1 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(start.x, start.y, 0),
          new THREE.Vector3(start.x + nx, start.y + ny, 0),
        ]);
        group.add(new THREE.Line(ext1, material));
        const ext2 = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(end.x, end.y, 0),
          new THREE.Vector3(end.x + nx, end.y + ny, 0),
        ]);
        group.add(new THREE.Line(ext2, material));
        const dimText = text_override || len.toFixed(2);
        const canvas = document.createElement('canvas');
        const ctx2 = canvas.getContext('2d')!;
        const fs = 48;
        ctx2.font = `${fs}px sans-serif`;
        const tw = Math.ceil(ctx2.measureText(dimText).width) + 4;
        canvas.width = tw;
        canvas.height = fs + 8;
        ctx2.font = `${fs}px sans-serif`;
        ctx2.fillStyle = resolved.color;
        ctx2.textBaseline = 'bottom';
        ctx2.fillText(dimText, 2, canvas.height - 4);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sm = new THREE.SpriteMaterial({ map: tex });
        const sp = new THREE.Sprite(sm);
        const th = this.resolveDimTextHeight(style_name, Math.abs(offset) * 0.4);
        const ta = canvas.width / canvas.height;
        sp.scale.set(th * ta, th, 1);
        sp.position.set((start.x + end.x) / 2 + nx, (start.y + end.y) / 2 + ny, 0.1);
        group.add(sp);
        object = group;
      }
    } else if (geom.RadialDimension) {
      const { center, point_on_arc, text_override: radText, style_name } = geom.RadialDimension;
      const rdx = point_on_arc.x - center.x;
      const rdy = point_on_arc.y - center.y;
      const radius = Math.sqrt(rdx * rdx + rdy * rdy);
      if (radius > 1e-9) {
        const group = new THREE.Group();
        const leaderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(center.x, center.y, 0),
          new THREE.Vector3(point_on_arc.x, point_on_arc.y, 0),
        ]);
        group.add(new THREE.Line(leaderGeo, material));
        const dimText = radText || `R${radius.toFixed(2)}`;
        const canvas = document.createElement('canvas');
        const ctx2 = canvas.getContext('2d')!;
        const fs = 48;
        ctx2.font = `${fs}px sans-serif`;
        const tw = Math.ceil(ctx2.measureText(dimText).width) + 4;
        canvas.width = tw;
        canvas.height = fs + 8;
        ctx2.font = `${fs}px sans-serif`;
        ctx2.fillStyle = resolved.color;
        ctx2.textBaseline = 'bottom';
        ctx2.fillText(dimText, 2, canvas.height - 4);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sm = new THREE.SpriteMaterial({ map: tex });
        const sp = new THREE.Sprite(sm);
        const th = this.resolveDimTextHeight(style_name, radius * 0.15);
        const ta = canvas.width / canvas.height;
        sp.scale.set(th * ta, th, 1);
        sp.position.set((center.x + point_on_arc.x) / 2, (center.y + point_on_arc.y) / 2, 0.1);
        group.add(sp);
        object = group;
      }
    } else if (geom.DiameterDimension) {
      const { center, point_on_arc, text_override: diaText, style_name } = geom.DiameterDimension;
      const ddx2 = point_on_arc.x - center.x;
      const ddy2 = point_on_arc.y - center.y;
      const radius = Math.sqrt(ddx2 * ddx2 + ddy2 * ddy2);
      if (radius > 1e-9) {
        const opposite = { x: center.x - ddx2, y: center.y - ddy2 };
        const group = new THREE.Group();
        const leaderGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(opposite.x, opposite.y, 0),
          new THREE.Vector3(point_on_arc.x, point_on_arc.y, 0),
        ]);
        group.add(new THREE.Line(leaderGeo, material));
        const dimText = diaText || `\u2300${(radius * 2).toFixed(2)}`;
        const canvas = document.createElement('canvas');
        const ctx2 = canvas.getContext('2d')!;
        const fs = 48;
        ctx2.font = `${fs}px sans-serif`;
        const tw = Math.ceil(ctx2.measureText(dimText).width) + 4;
        canvas.width = tw;
        canvas.height = fs + 8;
        ctx2.font = `${fs}px sans-serif`;
        ctx2.fillStyle = resolved.color;
        ctx2.textBaseline = 'bottom';
        ctx2.fillText(dimText, 2, canvas.height - 4);
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        const sm = new THREE.SpriteMaterial({ map: tex });
        const sp = new THREE.Sprite(sm);
        const th = this.resolveDimTextHeight(style_name, radius * 0.15);
        const ta = canvas.width / canvas.height;
        sp.scale.set(th * ta, th, 1);
        sp.position.set(center.x, center.y, 0.1);
        group.add(sp);
        object = group;
      }
    } else if (geom.AngularDimension) {
      const {
        center,
        start_ray,
        end_ray,
        radius: angRadius,
        text_override: angText,
        style_name,
      } = geom.AngularDimension;
      const startAngle = Math.atan2(start_ray.y - center.y, start_ray.x - center.x);
      const endAngle = Math.atan2(end_ray.y - center.y, end_ray.x - center.x);
      let sweep = endAngle - startAngle;
      if (sweep < 0) sweep += Math.PI * 2;
      const group = new THREE.Group();
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        angRadius,
        angRadius,
        startAngle,
        startAngle + sweep,
        false,
        0,
      );
      const arcPts = curve.getPoints(64);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(
        arcPts.map((p) => new THREE.Vector3(p.x, p.y, 0)),
      );
      group.add(new THREE.Line(arcGeo, material));
      const ext1Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(center.x, center.y, 0),
        new THREE.Vector3(
          center.x + Math.cos(startAngle) * angRadius,
          center.y + Math.sin(startAngle) * angRadius,
          0,
        ),
      ]);
      group.add(new THREE.Line(ext1Geo, material));
      const ext2Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(center.x, center.y, 0),
        new THREE.Vector3(
          center.x + Math.cos(startAngle + sweep) * angRadius,
          center.y + Math.sin(startAngle + sweep) * angRadius,
          0,
        ),
      ]);
      group.add(new THREE.Line(ext2Geo, material));
      const degrees = (sweep * 180) / Math.PI;
      const dimText = angText || `${degrees.toFixed(1)}\u00B0`;
      const midAngle = startAngle + sweep / 2;
      const canvas = document.createElement('canvas');
      const ctx2 = canvas.getContext('2d')!;
      const fs = 48;
      ctx2.font = `${fs}px sans-serif`;
      const tw = Math.ceil(ctx2.measureText(dimText).width) + 4;
      canvas.width = tw;
      canvas.height = fs + 8;
      ctx2.font = `${fs}px sans-serif`;
      ctx2.fillStyle = resolved.color;
      ctx2.textBaseline = 'bottom';
      ctx2.fillText(dimText, 2, canvas.height - 4);
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearFilter;
      const sm = new THREE.SpriteMaterial({ map: tex });
      const sp = new THREE.Sprite(sm);
      const th = this.resolveDimTextHeight(style_name, angRadius * 0.15);
      const ta = canvas.width / canvas.height;
      sp.scale.set(th * ta, th, 1);
      sp.position.set(
        center.x + Math.cos(midAngle) * angRadius,
        center.y + Math.sin(midAngle) * angRadius,
        0.1,
      );
      group.add(sp);
      object = group;
    } else if (geom.Hatch) {
      const { boundary_ids, pattern, scale: hatchScale, angle: hatchAngle } = geom.Hatch;
      const group = new THREE.Group();
      // Collect boundary points from referenced entities
      const boundaryPts: THREE.Vector3[] = [];
      for (const bid of boundary_ids) {
        const bMesh = this.entityMeshes.get(bid);
        if (bMesh) {
          const box = new THREE.Box3().setFromObject(bMesh);
          if (!box.isEmpty()) {
            boundaryPts.push(box.min.clone());
            boundaryPts.push(box.max.clone());
          }
        }
      }
      if (boundaryPts.length >= 2) {
        const bbox = new THREE.Box3().setFromPoints(boundaryPts);
        const bMin = bbox.min;
        const bMax = bbox.max;
        const spacing = (hatchScale || 1.0) * 2.0;
        const diag = Math.sqrt((bMax.x - bMin.x) ** 2 + (bMax.y - bMin.y) ** 2);
        const cx = (bMin.x + bMax.x) / 2;
        const cy = (bMin.y + bMax.y) / 2;
        const hatchMat = material.clone() as THREE.LineBasicMaterial;
        hatchMat.opacity = 0.4;
        hatchMat.transparent = true;

        const addHatchLines = (angle: number, sp: number) => {
          const c = Math.cos(angle);
          const s = Math.sin(angle);
          const n = Math.ceil(diag / sp);
          for (let i = -n; i <= n; i++) {
            const off = i * sp;
            const ox = s * off;
            const oy = -c * off;
            const pts = clipLineToBBox(
              cx + ox - c * diag,
              cy + oy - s * diag,
              cx + ox + c * diag,
              cy + oy + s * diag,
              bMin.x,
              bMin.y,
              bMax.x,
              bMax.y,
            );
            if (pts) {
              const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(pts[0], pts[1], -0.05),
                new THREE.Vector3(pts[2], pts[3], -0.05),
              ]);
              group.add(new THREE.Line(lineGeo, hatchMat));
            }
          }
        };

        const p = (pattern || '').toUpperCase();
        const baseAngle = hatchAngle || 0;
        if (p === 'CROSS' || p === 'HATCH' || p === 'ANSI37') {
          addHatchLines(baseAngle, spacing);
          addHatchLines(baseAngle + Math.PI / 2, spacing);
        } else if (p === 'DOTS') {
          const dotMat = new THREE.PointsMaterial({
            color: (material as THREE.LineBasicMaterial).color,
            size: 2,
            sizeAttenuation: false,
            opacity: 0.4,
            transparent: true,
          });
          const dotPts: THREE.Vector3[] = [];
          const n = Math.ceil(diag / spacing);
          for (let i = -n; i <= n; i++) {
            for (let j = -n; j <= n; j++) {
              const x = cx + i * spacing;
              const y = cy + j * spacing;
              if (x >= bMin.x && x <= bMax.x && y >= bMin.y && y <= bMax.y) {
                dotPts.push(new THREE.Vector3(x, y, -0.05));
              }
            }
          }
          if (dotPts.length > 0) {
            const dotGeo = new THREE.BufferGeometry().setFromPoints(dotPts);
            group.add(new THREE.Points(dotGeo, dotMat));
          }
        } else {
          addHatchLines(baseAngle, spacing);
        }
      }
      if (group.children.length > 0) object = group;
    } else if (geom.BlockRef) {
      const { block_id, insertion, rotation: blockRot, scale_x, scale_y } = geom.BlockRef;
      const group = new THREE.Group();

      const blockDef = this.blockDefs.find((bd) => bd.id === block_id);
      if (blockDef && blockDef.entities) {
        for (const subEntity of blockDef.entities) {
          const subObj = this.createEntityObject(subEntity, layerColors);
          if (subObj) group.add(subObj);
        }
      }

      group.scale.set(scale_x || 1, scale_y || 1, 1);
      group.rotation.z = blockRot || 0;
      group.position.set(insertion.x, insertion.y, 0);
      object = group;
    }

    if (geom.Ellipse) {
      const { center, semi_major, semi_minor, rotation: rot } = geom.Ellipse;
      const curve = new THREE.EllipseCurve(0, 0, semi_major, semi_minor, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(64);
      const cos = Math.cos(rot),
        sin = Math.sin(rot);
      const worldPts = pts.map(
        (p: THREE.Vector2) =>
          new THREE.Vector3(center.x + p.x * cos - p.y * sin, center.y + p.x * sin + p.y * cos, 0),
      );
      const geo = new THREE.BufferGeometry().setFromPoints(worldPts);
      object = new THREE.Line(geo, material);
    } else if (geom.Spline) {
      const { control_points, closed } = geom.Spline;
      if (control_points.length >= 2) {
        const pts3 = control_points.map((p: Point2D) => new THREE.Vector3(p.x, p.y, 0));
        const curve = new THREE.CatmullRomCurve3(pts3, closed, 'catmullrom', 0.5);
        const samples = curve.getPoints(control_points.length * 20);
        const geo = new THREE.BufferGeometry().setFromPoints(samples);
        object = new THREE.Line(geo, material);
      }
    } else if (geom.Point) {
      const { position } = geom.Point;
      const size = 0.3;
      const group = new THREE.Group();
      const hGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position.x - size, position.y, 0),
        new THREE.Vector3(position.x + size, position.y, 0),
      ]);
      group.add(new THREE.Line(hGeo, material));
      const vGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position.x, position.y - size, 0),
        new THREE.Vector3(position.x, position.y + size, 0),
      ]);
      group.add(new THREE.Line(vGeo, material));
      const d1Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position.x - size * 0.7, position.y - size * 0.7, 0),
        new THREE.Vector3(position.x + size * 0.7, position.y + size * 0.7, 0),
      ]);
      group.add(new THREE.Line(d1Geo, material));
      const d2Geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(position.x - size * 0.7, position.y + size * 0.7, 0),
        new THREE.Vector3(position.x + size * 0.7, position.y - size * 0.7, 0),
      ]);
      group.add(new THREE.Line(d2Geo, material));
      object = group;
    } else if (geom.Leader) {
      const {
        vertices,
        text: leaderText,
        arrow_size: leaderArrow,
        text_height: leaderTextH,
        style_name: leaderStyleName,
      } = geom.Leader;
      if (vertices && vertices.length >= 2) {
        // Resolve effective arrow size, text height, landing length, color
        // from the named MLeaderStyle when present; otherwise fall back to
        // the per-leader fields baked at create time.
        const ms = leaderStyleName ? this.mleaderStyles.get(leaderStyleName) : undefined;
        const arrow = ms?.arrow_size ?? leaderArrow ?? 2.5;
        const txtH = ms?.text_height ?? leaderTextH ?? 2.5;
        const landingLen = ms?.landing_distance ?? 8.0;
        const enableLanding = ms?.enable_landing ?? true;
        const leaderColor = ms?.color ?? null;
        const leaderMaterial = leaderColor
          ? this.getMaterial(leaderColor, undefined, undefined)
          : material;

        const group = new THREE.Group();
        // Path polyline through all vertices.
        const pathPts = vertices.map(
          (p: { x: number; y: number }) => new THREE.Vector3(p.x, p.y, 0),
        );
        // Optional horizontal landing extending from the last path vertex.
        const lastIdx = vertices.length - 1;
        const tip = vertices[lastIdx];
        let textAnchor = { x: tip.x, y: tip.y };
        if (enableLanding && landingLen > 0) {
          const prev = vertices[lastIdx - 1];
          const dx = tip.x - prev.x;
          const sign = dx >= 0 ? 1 : -1;
          textAnchor = { x: tip.x + sign * landingLen, y: tip.y };
          pathPts.push(new THREE.Vector3(textAnchor.x, textAnchor.y, 0));
        }
        const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPts);
        group.add(new THREE.Line(pathGeo, leaderMaterial));

        // Arrow at the first vertex, pointing along the first segment.
        const a = vertices[0];
        const b = vertices[1];
        const adx = b.x - a.x;
        const ady = b.y - a.y;
        const aLen = Math.sqrt(adx * adx + ady * ady);
        if (aLen > 1e-9 && arrow > 0) {
          const ux = adx / aLen;
          const uy = ady / aLen;
          // Perpendicular for the arrow base half-width.
          const px = -uy * arrow * 0.4;
          const py = ux * arrow * 0.4;
          const baseX = a.x + ux * arrow;
          const baseY = a.y + uy * arrow;
          const arrowGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(a.x, a.y, 0),
            new THREE.Vector3(baseX + px, baseY + py, 0),
            new THREE.Vector3(baseX - px, baseY - py, 0),
            new THREE.Vector3(a.x, a.y, 0),
          ]);
          group.add(new THREE.Line(arrowGeo, leaderMaterial));
        }

        // Text sprite at the (possibly extended) text anchor.
        if (leaderText) {
          const canvas = document.createElement('canvas');
          const ctx2 = canvas.getContext('2d')!;
          const fs = 48;
          ctx2.font = `${fs}px sans-serif`;
          const tw = Math.ceil(ctx2.measureText(leaderText).width) + 4;
          canvas.width = tw;
          canvas.height = fs + 8;
          ctx2.font = `${fs}px sans-serif`;
          ctx2.fillStyle = leaderColor ?? resolved.color;
          ctx2.textBaseline = 'bottom';
          ctx2.fillText(leaderText, 2, canvas.height - 4);
          const tex = new THREE.CanvasTexture(canvas);
          tex.minFilter = THREE.LinearFilter;
          const sm = new THREE.SpriteMaterial({ map: tex });
          const sp = new THREE.Sprite(sm);
          const ta = canvas.width / canvas.height;
          sp.scale.set(txtH * ta, txtH, 1);
          sp.position.set(textAnchor.x + (txtH * ta) / 2, textAnchor.y + txtH * 0.5, 0.1);
          group.add(sp);
        }
        object = group;
      }
    } else if (geom.RevisionCloud) {
      const { boundary, arc_length } = geom.RevisionCloud;
      if (boundary.length >= 2) {
        const group = new THREE.Group();
        const n = boundary.length;
        for (let i = 0; i < n; i++) {
          const p1 = boundary[i];
          const p2 = boundary[(i + 1) % n];
          const edgeDx = p2.x - p1.x;
          const edgeDy = p2.y - p1.y;
          const edgeLen = Math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
          if (edgeLen < 1e-9) continue;
          const segCount = Math.max(1, Math.round(edgeLen / arc_length));
          const segLen = edgeLen / segCount;
          const ux = edgeDx / edgeLen;
          const uy = edgeDy / edgeLen;
          const nx = -uy;
          const ny = ux;
          for (let s = 0; s < segCount; s++) {
            const sx = p1.x + ux * segLen * s;
            const sy = p1.y + uy * segLen * s;
            const ex = p1.x + ux * segLen * (s + 1);
            const ey = p1.y + uy * segLen * (s + 1);
            const bulge = segLen * 0.3 * (s % 2 === 0 ? 1 : -1);
            const pts: THREE.Vector3[] = [];
            const arcSegs = 8;
            for (let t = 0; t <= arcSegs; t++) {
              const frac = t / arcSegs;
              const lx = sx + (ex - sx) * frac;
              const ly = sy + (ey - sy) * frac;
              const bump = Math.sin(frac * Math.PI) * bulge;
              pts.push(new THREE.Vector3(lx + nx * bump, ly + ny * bump, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            group.add(new THREE.Line(geo, material));
          }
        }
        object = group;
      }
    } else if (geom.ConstructionLine) {
      const { origin, direction } = geom.ConstructionLine;
      const len = 100000;
      const mag = Math.sqrt(direction.x * direction.x + direction.y * direction.y) || 1;
      const nx = direction.x / mag,
        ny = direction.y / mag;
      const p1 = new THREE.Vector3(origin.x - nx * len, origin.y - ny * len, 0);
      const p2 = new THREE.Vector3(origin.x + nx * len, origin.y + ny * len, 0);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const xlineMat = new THREE.LineDashedMaterial({
        color: new THREE.Color(resolved.color),
        dashSize: 2,
        gapSize: 1,
      });
      const line = new THREE.Line(geo, xlineMat);
      line.computeLineDistances();
      object = line;
    } else if (geom.Wipeout) {
      const { vertices } = geom.Wipeout;
      object = buildWipeoutMesh(vertices);
    }

    if (!object) {
      warnUnknownGeometryVariant(geom);
    }

    if (object) {
      object.userData.entityId = entity.id;
      object.renderOrder = entity.draw_order ?? 0;
      // Dashed materials require computeLineDistances
      if (resolved.linetype && resolved.linetype.toUpperCase() !== 'CONTINUOUS') {
        object.traverse((child) => {
          if (child instanceof THREE.Line) {
            child.computeLineDistances();
          }
        });
      }
    }

    return object;
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
      }
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }

  public syncEntities(
    entitiesJson: string,
    layerColors: Map<string, string>,
    blockDefsJson?: string,
  ) {
    let entities: RendererEntity[];
    try {
      entities = JSON.parse(entitiesJson);
    } catch {
      return;
    }

    if (blockDefsJson) {
      try {
        this.blockDefs = JSON.parse(blockDefsJson);
      } catch {
        // keep existing blockDefs on parse error
      }
    }

    const changedLayers = this.getChangedLayers(layerColors);
    const newIds = new Set(entities.map((e) => e.id));

    // Remove deleted entities
    for (const [id, obj] of this.entityMeshes) {
      if (!newIds.has(id)) {
        this.scene.remove(obj);
        this.disposeObject(obj);
        this.entityMeshes.delete(id);
      }
    }

    for (const entity of entities) {
      const layerId = entity.layer_id || entity.layerId || '';
      const needsRebuild = !this.entityMeshes.has(entity.id) || changedLayers.has(layerId);

      if (needsRebuild) {
        const existing = this.entityMeshes.get(entity.id);
        if (existing) {
          this.scene.remove(existing);
          this.disposeObject(existing);
        }
        const object = this.createEntityObject(entity, layerColors);
        if (object) {
          this.scene.add(object);
          this.entityMeshes.set(entity.id, object);
        } else {
          console.warn(
            '[syncEntities] createEntityObject returned null for',
            entity.id,
            'geometry:',
            JSON.stringify(entity.geometry).slice(0, 100),
          );
        }
      }
    }

    this.cachedEntities = entities;
    this.lastLayerColors = new Map(layerColors);
    this.hoveredEntityId = null;

    this.rebuildBatches(layerColors);
    this.updateSelection();
    this.markDirty();
  }

  public addSingleEntity(entity: RendererEntity, layerColors: Map<string, string>) {
    const obj = this.createEntityObject(entity, layerColors);
    if (obj) {
      this.scene.add(obj);
      this.entityMeshes.set(entity.id, obj);
      this.cachedEntities.push(entity);
    }
    this.lastLayerColors = new Map(layerColors);
  }

  public removeSingleEntity(entityId: string) {
    const obj = this.entityMeshes.get(entityId);
    if (obj) {
      this.scene.remove(obj);
      this.disposeObject(obj);
      this.entityMeshes.delete(entityId);
    }
    this.cachedEntities = this.cachedEntities.filter((e) => e.id !== entityId);
  }

  private getChangedLayers(layerColors: Map<string, string>): Set<string> {
    const changed = new Set<string>();
    for (const [id, color] of layerColors) {
      if (this.lastLayerColors.get(id) !== color) {
        changed.add(id);
      }
    }
    return changed;
  }

  public applyChanges(changesJson: string, layerColors: Map<string, string>) {
    let changes: FlushChanges;
    try {
      changes = JSON.parse(changesJson);
    } catch {
      return;
    }

    const changedLayers = this.getChangedLayers(layerColors);

    for (const id of changes.deleted) {
      this.removeSingleEntity(id);
    }

    for (const entity of changes.upserted) {
      const existing = this.entityMeshes.get(entity.id);
      if (existing) {
        this.scene.remove(existing);
        this.disposeObject(existing);
        this.entityMeshes.delete(entity.id);
        const idx = this.cachedEntities.findIndex((e) => e.id === entity.id);
        if (idx >= 0) this.cachedEntities[idx] = entity;
        else this.cachedEntities.push(entity);
      } else {
        this.cachedEntities.push(entity);
      }

      const obj = this.createEntityObject(entity, layerColors);
      if (obj) {
        this.scene.add(obj);
        this.entityMeshes.set(entity.id, obj);
      }
    }

    if (changedLayers.size > 0) {
      for (const entity of this.cachedEntities) {
        const layerId = entity.layer_id || entity.layerId || '';
        if (
          changedLayers.has(layerId) &&
          !changes.upserted.some((u: RendererEntity) => u.id === entity.id)
        ) {
          const existing = this.entityMeshes.get(entity.id);
          if (existing) {
            this.scene.remove(existing);
            this.disposeObject(existing);
          }
          const obj = this.createEntityObject(entity, layerColors);
          if (obj) {
            this.scene.add(obj);
            this.entityMeshes.set(entity.id, obj);
          }
        }
      }
    }

    this.lastLayerColors = new Map(layerColors);
  }

  public zoomIn(factor = 1.5) {
    this.pushViewState();
    this.zoom /= factor;
    this.zoom = Math.max(1, Math.min(10000, this.zoom));
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  public zoomOut(factor = 1.5) {
    this.pushViewState();
    this.zoom *= factor;
    this.zoom = Math.max(1, Math.min(10000, this.zoom));
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  public getZoom(): number {
    return this.zoom;
  }

  /**
   * Pixels per world unit at the current zoom level.
   *
   * `this.zoom` represents world units of *half* the viewport vertical extent
   * (locked by `getViewBounds()` and the pan-handler math). So the vertical
   * world-to-pixel scale is `canvasHeight / (2 * zoom)`. Any caller that needs
   * to convert a target pixel value (e.g. an aperture) into world units should
   * use this method rather than `getZoom()`, which has misleading semantics.
   */
  public getPixelsPerWorldUnit(): number {
    return this.height / (2 * this.zoom);
  }

  public getViewCenter(): { x: number; y: number } {
    return { x: this.viewCenter.x, y: this.viewCenter.y };
  }

  public getViewBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const aspect = this.width / this.height;
    return {
      minX: this.viewCenter.x - this.zoom * aspect,
      minY: this.viewCenter.y - this.zoom,
      maxX: this.viewCenter.x + this.zoom * aspect,
      maxY: this.viewCenter.y + this.zoom,
    };
  }

  public setViewState(x: number, y: number, zoom: number): void {
    this.pushViewState();
    this.viewCenter = { x, y };
    this.zoom = Math.max(1, Math.min(10000, zoom));
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  public zoomExtents() {
    if (this.entityMeshes.size === 0) return;
    this.pushViewState();

    const box = new THREE.Box3();
    for (const obj of this.entityMeshes.values()) {
      box.expandByObject(obj);
    }

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    this.viewCenter = { x: center.x, y: center.y };
    this.zoom = Math.max(size.x / 2, size.y / 2) * 1.2;
    this.zoom = Math.max(this.zoom, 5);

    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  public ensurePointVisible(worldX: number, worldY: number): void {
    const aspect = this.width / this.height;
    const margin = 0.8;
    const left = this.viewCenter.x - this.zoom * aspect * margin;
    const right = this.viewCenter.x + this.zoom * aspect * margin;
    const bottom = this.viewCenter.y - this.zoom * margin;
    const top = this.viewCenter.y + this.zoom * margin;

    if (worldX >= left && worldX <= right && worldY >= bottom && worldY <= top) {
      return;
    }

    this.viewCenter = { x: worldX, y: worldY };
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
  }

  private zoomWindowState: { active: boolean; start: { x: number; y: number } | null } = {
    active: false,
    start: null,
  };

  public startZoomWindow() {
    this.zoomWindowState = { active: true, start: null };
  }

  public isZoomWindowActive(): boolean {
    return this.zoomWindowState.active;
  }

  public handleZoomWindowClick(worldX: number, worldY: number) {
    if (!this.zoomWindowState.active) return;

    if (!this.zoomWindowState.start) {
      this.zoomWindowState.start = { x: worldX, y: worldY };
    } else {
      const s = this.zoomWindowState.start;
      const minX = Math.min(s.x, worldX);
      const maxX = Math.max(s.x, worldX);
      const minY = Math.min(s.y, worldY);
      const maxY = Math.max(s.y, worldY);

      const width = maxX - minX;
      const height = maxY - minY;

      if (width > 1e-6 && height > 1e-6) {
        this.pushViewState();
        this.viewCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        this.zoom = Math.max(width / 2, height / 2) * 1.1;
        this.zoom = Math.max(this.zoom, 1);
        this.updateCamera();
        this.rebuildGridIfNeeded();
        this.markDirty();
      }

      this.zoomWindowState = { active: false, start: null };
    }
  }

  public cancelZoomWindow() {
    this.zoomWindowState = { active: false, start: null };
  }

  private pushViewState() {
    if (this.isRestoringView) return;
    const current = { x: this.viewCenter.x, y: this.viewCenter.y, zoom: this.zoom };
    const last = this._viewHistoryIndex >= 0 ? this.viewHistory[this._viewHistoryIndex] : null;
    if (last && last.x === current.x && last.y === current.y && last.zoom === current.zoom) return;

    if (this._viewHistoryIndex < this.viewHistory.length - 1) {
      this.viewHistory.splice(this._viewHistoryIndex + 1);
    }
    this.viewHistory.push(current);
    if (this.viewHistory.length > this.MAX_VIEW_HISTORY) {
      this.viewHistory.shift();
    }
    this._viewHistoryIndex = this.viewHistory.length - 1;
  }

  private applyViewState(state: { x: number; y: number; zoom: number }) {
    this.isRestoringView = true;
    this.viewCenter = { x: state.x, y: state.y };
    this.zoom = state.zoom;
    this.updateCamera();
    this.rebuildGridIfNeeded();
    this.markDirty();
    this.isRestoringView = false;
  }

  public zoomPrevious() {
    if (!this.canZoomPrevious) return;
    if (this._viewHistoryIndex === this.viewHistory.length - 1) {
      this.pushViewState();
    }
    this._viewHistoryIndex--;
    this.applyViewState(this.viewHistory[this._viewHistoryIndex]);
  }

  public zoomNext() {
    if (!this.canZoomNext) return;
    this._viewHistoryIndex++;
    this.applyViewState(this.viewHistory[this._viewHistoryIndex]);
  }

  get canZoomPrevious(): boolean {
    return this._viewHistoryIndex > 0;
  }

  get canZoomNext(): boolean {
    return this._viewHistoryIndex < this.viewHistory.length - 1;
  }

  get viewHistoryIndex(): number {
    return this._viewHistoryIndex;
  }

  get viewHistoryLength(): number {
    return this.viewHistory.length;
  }

  public markDirty() {
    this.dirty = true;
  }

  /** @deprecated Use markDirty() instead */
  public render() {
    this.markDirty();
  }

  public getEntitiesForSnap(): RendererEntity[] {
    return this.cachedEntities;
  }

  public hitTest(worldX: number, worldY: number): string | null {
    const threshold = this.zoom * 0.02;
    const individual = this.selectionManager.hitTest(worldX, worldY, this.entityMeshes, threshold);
    if (individual) return individual;
    return this.lineBatcher.hitTest(worldX, worldY, threshold);
  }

  public selectByRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    mode: 'window' | 'crossing',
  ): string[] {
    const individual = this.selectionManager.selectByRect(
      x1,
      y1,
      x2,
      y2,
      mode,
      this.entityMeshes,
      this.cachedEntities,
    );
    const minX = Math.min(x1, x2),
      maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2),
      maxY = Math.max(y1, y2);
    const batched = this.lineBatcher.getEntityIdsInRect(minX, minY, maxX, maxY, mode);
    return [...new Set([...individual, ...batched])];
  }

  public getGripAtPoint(worldX: number, worldY: number) {
    const threshold = this.zoom * 0.015;
    return this.selectionManager.getGripAtPoint(worldX, worldY, this.cachedEntities, threshold);
  }

  public getEntityById(id: string): RendererEntity | null {
    return this.cachedEntities.find((e) => e.id === id) ?? null;
  }

  public updateHover(worldX: number, worldY: number) {
    const hitId = this.selectionManager.hitTest(
      worldX,
      worldY,
      this.entityMeshes,
      this.zoom * 0.02,
    );

    if (this.hoveredEntityId && this.hoveredEntityId !== hitId) {
      const prevObj = this.entityMeshes.get(this.hoveredEntityId);
      if (prevObj && !this.selectionManager.selectedIds.has(this.hoveredEntityId)) {
        prevObj.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Line && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        });
      }
    }

    if (hitId && !this.selectionManager.selectedIds.has(hitId)) {
      const obj = this.entityMeshes.get(hitId);
      if (obj) {
        obj.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Line) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material;
            }
            child.material = this.hoverMaterial;
          }
        });
      }
    }

    this.hoveredEntityId = hitId;
    this.renderer.domElement.style.cursor = hitId ? 'pointer' : this.defaultCursor;
  }

  public updateSelection() {
    if (this.hoveredEntityId) {
      const obj = this.entityMeshes.get(this.hoveredEntityId);
      if (obj) {
        obj.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Line && child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        });
      }
      this.hoveredEntityId = null;
    }
    this.selectionManager.updateVisuals(this.entityMeshes, this.cachedEntities, this.zoom);
    this.markDirty();
  }

  public setPreview(
    type: 'line' | 'circle' | 'rectangle' | 'move',
    firstPoint: { x: number; y: number },
    cursorPoint: { x: number; y: number },
  ) {
    this.clearPreviewObject();

    const dashColor = new THREE.Color(0xffff00);
    const material = new THREE.LineDashedMaterial({
      color: dashColor,
      dashSize: this.zoom * 0.01,
      gapSize: this.zoom * 0.005,
    });

    let geo: THREE.BufferGeometry | null = null;

    if (type === 'line' || type === 'move') {
      geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(firstPoint.x, firstPoint.y, 0.3),
        new THREE.Vector3(cursorPoint.x, cursorPoint.y, 0.3),
      ]);
    } else if (type === 'circle') {
      const dx = cursorPoint.x - firstPoint.x;
      const dy = cursorPoint.y - firstPoint.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      const curve = new THREE.EllipseCurve(
        firstPoint.x,
        firstPoint.y,
        radius,
        radius,
        0,
        Math.PI * 2,
        false,
        0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    } else if (type === 'rectangle') {
      const pts = [
        new THREE.Vector3(firstPoint.x, firstPoint.y, 0.3),
        new THREE.Vector3(cursorPoint.x, firstPoint.y, 0.3),
        new THREE.Vector3(cursorPoint.x, cursorPoint.y, 0.3),
        new THREE.Vector3(firstPoint.x, cursorPoint.y, 0.3),
        new THREE.Vector3(firstPoint.x, firstPoint.y, 0.3),
      ];
      geo = new THREE.BufferGeometry().setFromPoints(pts);
    }

    if (geo) {
      const line = new THREE.Line(geo, material);
      line.computeLineDistances();
      this.previewObject = line;
      this.scene.add(line);
      this.markDirty();
    }
  }

  private createSnapLabel(text: string, x: number, y: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 48;
    ctx.fillStyle = 'rgba(30,30,30,0.85)';
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 48, 6);
    ctx.fill();
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 24);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    const labelScale = this.zoom * 0.04;
    sprite.scale.set(labelScale * 4, labelScale, 1);
    sprite.position.set(x + this.zoom * 0.05, y - this.zoom * 0.03, 2);
    return sprite;
  }

  public setPreviewGeometry(geometry: GeometryType) {
    this.clearPreviewObject();

    const material = new THREE.LineDashedMaterial({
      color: 0xffff00,
      dashSize: this.zoom * 0.01,
      gapSize: this.zoom * 0.005,
    });

    let geo: THREE.BufferGeometry | null = null;

    if (geometry.Line) {
      const { start, end } = geometry.Line;
      geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, 0.3),
        new THREE.Vector3(end.x, end.y, 0.3),
      ]);
    } else if (geometry.Circle) {
      const { center, radius } = geometry.Circle;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        0,
        Math.PI * 2,
        false,
        0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    } else if (geometry.Arc) {
      const { center, radius, start_angle, end_angle } = geometry.Arc;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        start_angle,
        end_angle,
        false,
        0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    } else if (geometry.Rectangle) {
      const { origin, width, height, rotation } = geometry.Rectangle;
      const pts = [
        new THREE.Vector3(origin.x, origin.y, 0.3),
        new THREE.Vector3(origin.x + width, origin.y, 0.3),
        new THREE.Vector3(origin.x + width, origin.y + height, 0.3),
        new THREE.Vector3(origin.x, origin.y + height, 0.3),
        new THREE.Vector3(origin.x, origin.y, 0.3),
      ];
      if (rotation !== 0) {
        const cx = origin.x + width / 2;
        const cy = origin.y + height / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        for (const p of pts) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          p.x = cx + dx * cos - dy * sin;
          p.y = cy + dx * sin + dy * cos;
        }
      }
      geo = new THREE.BufferGeometry().setFromPoints(pts);
    } else if (geometry.Polyline) {
      const { vertices, closed } = geometry.Polyline;
      const pts = vertices.map((v: Point2D) => new THREE.Vector3(v.x, v.y, 0.3));
      if (closed && pts.length > 0) pts.push(pts[0].clone());
      geo = new THREE.BufferGeometry().setFromPoints(pts);
    }

    if (geo) {
      const line = new THREE.Line(geo, material);
      line.computeLineDistances();
      this.previewObject = line;
      this.scene.add(line);
      this.markDirty();
    }
  }

  public setPreviewEntities(entities: Array<{ id: string; geometry: GeometryType }>) {
    this.clearPreviewObject();

    if (entities.length === 0) return;

    // Solid yellow preview line. LineDashedMaterial with zoom-scaled dashSize
    // collapses to sub-pixel invisibility at typical zoom levels and is fragile
    // across GPUs. Solid translucent yellow is robust and visually identical
    // to AutoCAD's rubber-band feedback. depthTest:false keeps preview on top
    // of the grid even at the same z-plane.
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });

    const group = new THREE.Group();

    for (const ent of entities) {
      const obj = this.buildPreviewGeometry(ent.geometry, material);
      if (obj) group.add(obj);
    }

    if (group.children.length > 0) {
      this.previewObject = group;
      this.scene.add(group);
      this.markDirty();
    }
  }

  private buildPreviewGeometry(
    geometry: GeometryType,
    material: THREE.Material,
  ): THREE.Object3D | null {
    let geo: THREE.BufferGeometry | null = null;

    if (geometry.Line) {
      const { start, end } = geometry.Line;
      geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(start.x, start.y, 0.3),
        new THREE.Vector3(end.x, end.y, 0.3),
      ]);
    } else if (geometry.Circle) {
      const { center, radius } = geometry.Circle;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        0,
        Math.PI * 2,
        false,
        0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    } else if (geometry.Arc) {
      const { center, radius, start_angle, end_angle } = geometry.Arc;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        radius,
        radius,
        start_angle,
        end_angle,
        false,
        0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    } else if (geometry.Rectangle) {
      const { origin, width, height, rotation } = geometry.Rectangle;
      const pts = [
        new THREE.Vector3(origin.x, origin.y, 0.3),
        new THREE.Vector3(origin.x + width, origin.y, 0.3),
        new THREE.Vector3(origin.x + width, origin.y + height, 0.3),
        new THREE.Vector3(origin.x, origin.y + height, 0.3),
        new THREE.Vector3(origin.x, origin.y, 0.3),
      ];
      if (rotation && rotation !== 0) {
        const cx = origin.x + width / 2;
        const cy = origin.y + height / 2;
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        for (const p of pts) {
          const dx = p.x - cx;
          const dy = p.y - cy;
          p.x = cx + dx * cos - dy * sin;
          p.y = cy + dx * sin + dy * cos;
        }
      }
      geo = new THREE.BufferGeometry().setFromPoints(pts);
    } else if (geometry.Polyline) {
      const { vertices, closed } = geometry.Polyline;
      const pts = vertices.map((v: { x: number; y: number }) => new THREE.Vector3(v.x, v.y, 0.3));
      if (closed && pts.length > 0) pts.push(pts[0].clone());
      geo = new THREE.BufferGeometry().setFromPoints(pts);
    } else if (geometry.Ellipse) {
      const { center, semi_major, semi_minor, rotation } = geometry.Ellipse;
      const curve = new THREE.EllipseCurve(
        center.x,
        center.y,
        semi_major,
        semi_minor,
        0,
        Math.PI * 2,
        false,
        rotation || 0,
      );
      const pts = curve.getPoints(64);
      geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p) => new THREE.Vector3(p.x, p.y, 0.3)),
      );
    }

    if (!geo) return null;
    const line = new THREE.Line(geo, material);
    return line;
  }

  public lastSnap: SnapPoint | null = null;

  public setSnapIndicator(snapPoint: SnapPoint | null) {
    this.lastSnap = snapPoint;
    this.clearSnapIndicator();

    if (!snapPoint || snapPoint.type === 'grid') return;

    const group = new THREE.Group();
    const size = this.zoom * 0.015;
    const yellow = 0xffff00;
    const green = 0x00ff00;

    if (snapPoint.type === 'endpoint') {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, -size, 0),
        new THREE.Vector3(size, -size, 0),
        new THREE.Vector3(size, size, 0),
        new THREE.Vector3(-size, size, 0),
        new THREE.Vector3(-size, -size, 0),
      ]);
      const marker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: yellow }));
      marker.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(marker);
    } else if (snapPoint.type === 'midpoint') {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, size, 0),
        new THREE.Vector3(size, -size, 0),
        new THREE.Vector3(-size, -size, 0),
        new THREE.Vector3(0, size, 0),
      ]);
      const marker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: yellow }));
      marker.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(marker);
    } else if (snapPoint.type === 'center') {
      const curve = new THREE.EllipseCurve(0, 0, size, size, 0, Math.PI * 2, false, 0);
      const pts = curve.getPoints(32);
      const geo = new THREE.BufferGeometry().setFromPoints(
        pts.map((p: THREE.Vector2) => new THREE.Vector3(p.x, p.y, 0)),
      );
      const marker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: yellow }));
      marker.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(marker);
    } else if (snapPoint.type === 'intersection') {
      const mat = new THREE.LineBasicMaterial({ color: yellow });
      const g1 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, -size, 0),
        new THREE.Vector3(size, size, 0),
      ]);
      const g2 = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, size, 0),
        new THREE.Vector3(size, -size, 0),
      ]);
      const l1 = new THREE.Line(g1, mat);
      l1.position.set(snapPoint.x, snapPoint.y, 2);
      const l2 = new THREE.Line(g2, mat);
      l2.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(l1, l2);
    } else if (snapPoint.type === 'quadrant') {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, size, 0),
        new THREE.Vector3(size, 0, 0),
        new THREE.Vector3(0, -size, 0),
        new THREE.Vector3(-size, 0, 0),
        new THREE.Vector3(0, size, 0),
      ]);
      const marker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: yellow }));
      marker.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(marker);
    } else if (snapPoint.type === 'nearest') {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-size, -size, 0),
        new THREE.Vector3(size, -size, 0),
        new THREE.Vector3(size, size, 0),
        new THREE.Vector3(-size, size, 0),
        new THREE.Vector3(-size, -size, 0),
      ]);
      const marker = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: green }));
      marker.position.set(snapPoint.x, snapPoint.y, 2);
      group.add(marker);
    }

    const labelNames: Record<string, string> = {
      endpoint: 'Endpoint',
      midpoint: 'Midpoint',
      center: 'Center',
      intersection: 'Intersection',
      quadrant: 'Quadrant',
      nearest: 'Nearest',
    };
    if (labelNames[snapPoint.type]) {
      group.add(this.createSnapLabel(labelNames[snapPoint.type], snapPoint.x, snapPoint.y));
    }

    this.snapIndicator = group;
    this.scene.add(group);
    this.markDirty();
  }

  public setPolarGuide(from: { x: number; y: number } | null, to: { x: number; y: number } | null) {
    if (this.polarGuideObject) {
      this.scene.remove(this.polarGuideObject);
      this.disposeObject(this.polarGuideObject);
      this.polarGuideObject = null;
    }
    if (from && to) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1e-10) return;
      const extend = this.zoom * 4;
      const nx = dx / len;
      const ny = dy / len;
      const farX = from.x + nx * extend;
      const farY = from.y + ny * extend;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(from.x, from.y, 0.4),
        new THREE.Vector3(farX, farY, 0.4),
      ]);
      const mat = new THREE.LineDashedMaterial({
        color: 0x00cc00,
        dashSize: this.zoom * 0.015,
        gapSize: this.zoom * 0.008,
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      this.polarGuideObject = line;
      this.scene.add(line);
      this.markDirty();
    }
  }

  public setTrackingGuides(guides: { from: { x: number; y: number }; horizontal: boolean }[]) {
    for (const obj of this.trackingGuideObjects) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.trackingGuideObjects = [];

    if (guides.length === 0) return;

    const extend = this.zoom * 4;
    const mat = new THREE.LineDashedMaterial({
      color: 0x00aacc,
      dashSize: this.zoom * 0.015,
      gapSize: this.zoom * 0.008,
    });

    for (const g of guides) {
      const pts = g.horizontal
        ? [
            new THREE.Vector3(g.from.x - extend, g.from.y, 0.4),
            new THREE.Vector3(g.from.x + extend, g.from.y, 0.4),
          ]
        : [
            new THREE.Vector3(g.from.x, g.from.y - extend, 0.4),
            new THREE.Vector3(g.from.x, g.from.y + extend, 0.4),
          ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, mat.clone());
      line.computeLineDistances();
      this.trackingGuideObjects.push(line);
      this.scene.add(line);
    }
    this.markDirty();
  }

  public clearPreview() {
    this.clearPreviewObject();
    this.clearSnapIndicator();
    this.clearPolarGuide();
    this.clearTrackingGuides();
    this.markDirty();
  }

  public setCrosshairVisible(visible: boolean) {
    this.crosshairVisible = visible;
    if (visible) this.updateCrosshair();
    else this.clearCrosshair();
  }

  public setCursorSize(size: number) {
    this.crosshairCursorSize = Math.max(0.01, Math.min(1.0, size));
    if (this.crosshairVisible) this.updateCrosshair();
  }

  private clearCrosshair() {
    if (this.crosshairGroup) {
      this.scene.remove(this.crosshairGroup);
      this.disposeObject(this.crosshairGroup);
      this.crosshairGroup = null;
      this.markDirty();
    }
  }

  private updateCrosshair() {
    this.clearCrosshair();
    if (!this.crosshairVisible) return;

    const aspect = this.width / this.height;
    const halfHorizLen = this.zoom * aspect * this.crosshairCursorSize;
    const halfVertLen = this.zoom * this.crosshairCursorSize;
    const cx = this.cursorWorld.x;
    const cy = this.cursorWorld.y;
    const z = 0.5;

    const group = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
    });

    const hGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx - halfHorizLen, cy, z),
      new THREE.Vector3(cx + halfHorizLen, cy, z),
    ]);
    group.add(new THREE.Line(hGeo, mat));

    const vGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx, cy - halfVertLen, z),
      new THREE.Vector3(cx, cy + halfVertLen, z),
    ]);
    group.add(new THREE.Line(vGeo, mat));

    // 12px PICKBOX at intersection — one screen-pixel = 2*zoom/height world units.
    const pickboxWorld = (12 * 2 * this.zoom) / this.height;
    const half = pickboxWorld / 2;
    const boxGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx - half, cy - half, z),
      new THREE.Vector3(cx + half, cy - half, z),
      new THREE.Vector3(cx + half, cy + half, z),
      new THREE.Vector3(cx - half, cy + half, z),
      new THREE.Vector3(cx - half, cy - half, z),
    ]);
    group.add(new THREE.Line(boxGeo, mat));

    this.crosshairGroup = group;
    this.scene.add(group);
    this.markDirty();
  }

  private clearPreviewObject() {
    if (this.previewObject) {
      this.scene.remove(this.previewObject);
      this.disposeObject(this.previewObject);
      this.previewObject = null;
    }
  }

  private clearSnapIndicator() {
    if (this.snapIndicator) {
      this.scene.remove(this.snapIndicator);
      this.disposeObject(this.snapIndicator);
      this.snapIndicator = null;
    }
  }

  private clearPolarGuide() {
    if (this.polarGuideObject) {
      this.scene.remove(this.polarGuideObject);
      this.disposeObject(this.polarGuideObject);
      this.polarGuideObject = null;
    }
  }

  private clearTrackingGuides() {
    for (const obj of this.trackingGuideObjects) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.trackingGuideObjects = [];
  }

  private rebuildBatches(layerColors: Map<string, string>) {
    const batchEntries: { id: string; segments: number[]; materialKey: string }[] = [];

    for (const entity of this.cachedEntities) {
      if (this.selectionManager.selectedIds.has(entity.id)) continue;
      const style = this.resolveEntityStyle(entity, layerColors);
      const lt = (style.linetype || 'CONTINUOUS').toUpperCase();
      if (lt !== 'CONTINUOUS') continue;

      const segments = this.extractLineSegments(entity);
      if (segments.length === 0) continue;

      const color = style.color || '#ffffff';
      const lw = style.lineweight ?? 1;
      const materialKey = `${color}|CONTINUOUS|${lw}`;
      batchEntries.push({ id: entity.id, segments, materialKey });
    }

    this.lineBatcher.rebuild(batchEntries, (key) => {
      const cached = this.materialCache.get(key);
      if (cached) return cached;
      const [hex] = key.split('|');
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(hex) });
      this.materialCache.set(key, mat);
      return mat;
    });
  }

  private extractLineSegments(entity: RendererEntity): number[] {
    const geo = entity.geometry as Record<string, any>;
    const segs: number[] = [];

    if ('Line' in geo) {
      const { start, end } = geo.Line;
      segs.push(start.x, start.y, 0, end.x, end.y, 0);
    } else if ('Circle' in geo) {
      const { center, radius } = geo.Circle;
      const steps = 64;
      for (let i = 0; i < steps; i++) {
        const a1 = (i / steps) * Math.PI * 2;
        const a2 = ((i + 1) / steps) * Math.PI * 2;
        segs.push(
          center.x + radius * Math.cos(a1),
          center.y + radius * Math.sin(a1),
          0,
          center.x + radius * Math.cos(a2),
          center.y + radius * Math.sin(a2),
          0,
        );
      }
    } else if ('Arc' in geo) {
      const { center, radius, start_angle, end_angle } = geo.Arc;
      let span = end_angle - start_angle;
      if (span <= 0) span += Math.PI * 2;
      const steps = Math.max(16, Math.ceil(span * 10));
      for (let i = 0; i < steps; i++) {
        const a1 = start_angle + (i / steps) * span;
        const a2 = start_angle + ((i + 1) / steps) * span;
        segs.push(
          center.x + radius * Math.cos(a1),
          center.y + radius * Math.sin(a1),
          0,
          center.x + radius * Math.cos(a2),
          center.y + radius * Math.sin(a2),
          0,
        );
      }
    } else if ('Rectangle' in geo) {
      const { origin, width, height } = geo.Rectangle;
      const x = origin.x,
        y = origin.y;
      segs.push(x, y, 0, x + width, y, 0);
      segs.push(x + width, y, 0, x + width, y + height, 0);
      segs.push(x + width, y + height, 0, x, y + height, 0);
      segs.push(x, y + height, 0, x, y, 0);
    } else if ('Polyline' in geo) {
      const verts = geo.Polyline.vertices;
      if (verts && verts.length >= 2) {
        for (let i = 0; i < verts.length - 1; i++) {
          segs.push(verts[i].x, verts[i].y, 0, verts[i + 1].x, verts[i + 1].y, 0);
        }
        if (geo.Polyline.closed && verts.length >= 3) {
          segs.push(
            verts[verts.length - 1].x,
            verts[verts.length - 1].y,
            0,
            verts[0].x,
            verts[0].y,
            0,
          );
        }
      }
    }

    return segs;
  }

  public dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.selectionManager.clearVisuals();
    this.lineBatcher.clear();
    this.gripPool.dispose();
    this.clearPreview();
    this.clearPolarGuide();
    this.clearTrackingGuides();
    this.clearSelectionRect();
    for (const [_id, obj] of this.entityMeshes) {
      this.disposeObject(obj);
    }
    this.entityMeshes.clear();
    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();
    const el = this.renderer.domElement;
    el.removeEventListener('wheel', this.boundOnWheel);
    el.removeEventListener('mousedown', this.boundOnMouseDown);
    el.removeEventListener('mousemove', this.boundOnMouseMove);
    el.removeEventListener('mouseup', this.boundOnMouseUp);
    el.removeEventListener('click', this.boundOnClickHandler);
    this.resizeObserver.disconnect();

    this.renderer.dispose();
    el.remove();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
}
