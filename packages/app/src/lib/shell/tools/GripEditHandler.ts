import { BaseToolHandler } from '../BaseToolHandler';
import type { ToolContext } from '../ToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';
import type { GripHit, GeometryType, Point2D } from '@nexus/renderer';

export type GripMode = 'stretch' | 'move' | 'rotate' | 'scale' | 'mirror';

const GRIP_MODES: GripMode[] = ['stretch', 'move', 'rotate', 'scale', 'mirror'];

export class GripEditHandler extends BaseToolHandler {
  readonly id = 'grip_edit';
  private gripHit: GripHit;
  private entityId: string;
  private basePoint: Vec2;
  private mode: GripMode = 'stretch';

  constructor(gripHit: GripHit) {
    super();
    this.gripHit = gripHit;
    this.entityId = gripHit.entityId;
    this.basePoint = { x: gripHit.point.x, y: gripHit.point.y };
  }

  activate(ctx: ToolContext): void {
    super.activate(ctx);
    this.points = [this.basePoint];
    this.setStatus(1);
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    switch (this.mode) {
      case 'stretch':
        this.executeStretch(point);
        break;
      case 'move':
        this.executeMove(point);
        break;
      case 'rotate':
        this.executeRotate(point);
        break;
      case 'scale':
        this.executeScale(point);
        break;
      case 'mirror':
        this.executeMirror(point);
        break;
    }
    this.ctx.cancelCurrentTool();
  }

  onKeyDown(_status: number, key: string): HandleResult {
    if (key === ' ') {
      this.cycleMode();
      return 'HANDLED';
    }
    if (key === 'Escape') {
      this.ctx.renderer?.clearPreview();
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(_status: number, point: Vec2): void {
    if (this._status !== 1) return;

    // Stretch mode: use existing manual geometry computation
    if (this.mode === 'stretch') {
      const previewGeom = this.computeStretchGeometry(point);
      if (previewGeom && this.ctx.renderer?.setPreviewGeometry) {
        this.ctx.renderer.setPreviewGeometry(previewGeom);
      }
    }
    // Other modes (move/rotate/scale/mirror): handled by shell via getPreviewCommand
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1) return null;
    // Stretch mode uses manual geometry computation (entity-specific vertex movement)
    if (this.mode === 'stretch') return null;

    switch (this.mode) {
      case 'move': {
        const dx = cursor.x - this.basePoint.x;
        const dy = cursor.y - this.basePoint.y;
        return { type: 'MoveEntity', id: this.entityId, dx, dy };
      }
      case 'rotate': {
        const angle = Math.atan2(cursor.y - this.basePoint.y, cursor.x - this.basePoint.x);
        return {
          type: 'RotateEntity',
          id: this.entityId,
          cx: this.basePoint.x,
          cy: this.basePoint.y,
          angle,
        };
      }
      case 'scale': {
        const dx = cursor.x - this.basePoint.x;
        const dy = cursor.y - this.basePoint.y;
        const factor = Math.sqrt(dx * dx + dy * dy) / 10;
        if (factor <= 0) return null;
        return {
          type: 'ScaleEntity',
          id: this.entityId,
          cx: this.basePoint.x,
          cy: this.basePoint.y,
          factor,
        };
      }
      case 'mirror':
        return {
          type: 'MirrorEntity',
          id: this.entityId,
          x1: this.basePoint.x,
          y1: this.basePoint.y,
          x2: cursor.x,
          y2: cursor.y,
        };
    }
    return null;
  }

  getPrompt(): string {
    const label = `** ${this.mode.toUpperCase()} **`;
    switch (this.mode) {
      case 'stretch':
        return `${label} Specify stretch point or [Base point/Copy/Undo/eXit]:`;
      case 'move':
        return `${label} Specify move point or [Base point/Copy/Undo/eXit]:`;
      case 'rotate':
        return `${label} Specify rotation angle or [Base point/Copy/Undo/eXit]:`;
      case 'scale':
        return `${label} Specify scale factor or [Base point/Copy/Undo/eXit]:`;
      case 'mirror':
        return `${label} Specify second point of mirror line or [Base point/Copy/Undo/eXit]:`;
    }
  }

  getMouseHints(): MouseHints {
    return { left: 'Specify point', right: 'Cancel' };
  }

  private cycleMode(): void {
    const idx = GRIP_MODES.indexOf(this.mode);
    this.mode = GRIP_MODES[(idx + 1) % GRIP_MODES.length];
  }

  private computeStretchGeometry(point: Vec2): GeometryType | null {
    const entity = this.ctx.renderer?.getEntityById(this.entityId);
    if (!entity) return null;

    const g = entity.geometry;
    const gi = this.gripHit.gripIndex;

    if (g.Line) {
      const line = { ...g.Line, start: { ...g.Line.start }, end: { ...g.Line.end } };
      if (gi === 0) {
        line.start = { x: point.x, y: point.y };
      } else if (gi === 1) {
        line.end = { x: point.x, y: point.y };
      } else {
        const dx = point.x - this.basePoint.x;
        const dy = point.y - this.basePoint.y;
        line.start.x += dx;
        line.start.y += dy;
        line.end.x += dx;
        line.end.y += dy;
      }
      return { Line: line };
    } else if (g.Circle) {
      const circle = { ...g.Circle, center: { ...g.Circle.center } };
      if (gi === 0) {
        circle.center = { x: point.x, y: point.y };
      } else {
        const dx = point.x - circle.center.x;
        const dy = point.y - circle.center.y;
        circle.radius = Math.sqrt(dx * dx + dy * dy);
      }
      return { Circle: circle };
    } else if (g.Arc) {
      const arc = { ...g.Arc, center: { ...g.Arc.center } };
      if (gi === 0) {
        arc.center = { x: point.x, y: point.y };
      } else if (gi === 1) {
        arc.start_angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
        arc.radius = Math.sqrt((point.x - arc.center.x) ** 2 + (point.y - arc.center.y) ** 2);
      } else {
        arc.end_angle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
        arc.radius = Math.sqrt((point.x - arc.center.x) ** 2 + (point.y - arc.center.y) ** 2);
      }
      return { Arc: arc };
    } else if (g.Rectangle) {
      const rect = { ...g.Rectangle, origin: { ...g.Rectangle.origin } };
      const o = rect.origin;
      const w = rect.width;
      const h = rect.height;
      if (gi === 0) {
        rect.width = o.x + w - point.x;
        rect.height = o.y + h - point.y;
        rect.origin = { x: point.x, y: point.y };
      } else if (gi === 1) {
        rect.width = point.x - o.x;
      } else if (gi === 2) {
        rect.width = point.x - o.x;
        rect.height = point.y - o.y;
      } else if (gi === 3) {
        rect.height = point.y - o.y;
      } else {
        const cx = o.x + w / 2;
        const cy = o.y + h / 2;
        rect.origin.x += point.x - cx;
        rect.origin.y += point.y - cy;
      }
      return { Rectangle: rect };
    } else if (g.Polyline) {
      const poly = {
        ...g.Polyline,
        vertices: g.Polyline.vertices.map((v: Point2D) => ({ ...v })),
      };
      if (gi < poly.vertices.length) {
        poly.vertices[gi] = { x: point.x, y: point.y };
      }
      return { Polyline: poly };
    } else if (g.Ellipse) {
      const ellipse = { ...g.Ellipse, center: { ...g.Ellipse.center } };
      if (gi === 0) {
        ellipse.center = { x: point.x, y: point.y };
      } else if (gi <= 2) {
        const dx = point.x - ellipse.center.x;
        const dy = point.y - ellipse.center.y;
        ellipse.semi_major = Math.sqrt(dx * dx + dy * dy);
      } else {
        const dx = point.x - ellipse.center.x;
        const dy = point.y - ellipse.center.y;
        ellipse.semi_minor = Math.sqrt(dx * dx + dy * dy);
      }
      return { Ellipse: ellipse };
    } else if (g.Spline) {
      const spline = {
        ...g.Spline,
        control_points: g.Spline.control_points.map((p: Point2D) => ({ ...p })),
      };
      if (gi < spline.control_points.length) {
        spline.control_points[gi] = { x: point.x, y: point.y };
      }
      return { Spline: spline };
    } else if (g.Text) {
      return { Text: { ...g.Text, position: { x: point.x, y: point.y } } };
    } else if (g.MText) {
      return { MText: { ...g.MText, position: { x: point.x, y: point.y } } };
    } else if (g.Point) {
      return { Point: { position: { x: point.x, y: point.y } } };
    } else if (g.ConstructionLine) {
      return { ConstructionLine: { ...g.ConstructionLine, origin: { x: point.x, y: point.y } } };
    }

    return null;
  }

  private computeMoveGeometry(point: Vec2): GeometryType | null {
    const entity = this.ctx.renderer?.getEntityById(this.entityId);
    if (!entity) return null;

    const dx = point.x - this.basePoint.x;
    const dy = point.y - this.basePoint.y;
    const g = entity.geometry;

    if (g.Line) {
      return {
        Line: {
          start: { x: g.Line.start.x + dx, y: g.Line.start.y + dy },
          end: { x: g.Line.end.x + dx, y: g.Line.end.y + dy },
        },
      };
    } else if (g.Circle) {
      return {
        Circle: {
          center: { x: g.Circle.center.x + dx, y: g.Circle.center.y + dy },
          radius: g.Circle.radius,
        },
      };
    } else if (g.Arc) {
      return {
        Arc: {
          center: { x: g.Arc.center.x + dx, y: g.Arc.center.y + dy },
          radius: g.Arc.radius,
          start_angle: g.Arc.start_angle,
          end_angle: g.Arc.end_angle,
        },
      };
    } else if (g.Rectangle) {
      return {
        Rectangle: {
          origin: { x: g.Rectangle.origin.x + dx, y: g.Rectangle.origin.y + dy },
          width: g.Rectangle.width,
          height: g.Rectangle.height,
          rotation: g.Rectangle.rotation,
        },
      };
    } else if (g.Polyline) {
      return {
        Polyline: {
          vertices: g.Polyline.vertices.map((v: Point2D) => ({ x: v.x + dx, y: v.y + dy })),
          closed: g.Polyline.closed,
        },
      };
    }

    return null;
  }

  private computeRotateGeometry(point: Vec2): GeometryType | null {
    const entity = this.ctx.renderer?.getEntityById(this.entityId);
    if (!entity) return null;

    const angle = Math.atan2(point.y - this.basePoint.y, point.x - this.basePoint.x);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const bp = this.basePoint;
    const g = entity.geometry;

    const rotatePoint = (p: Vec2): Vec2 => {
      const dx = p.x - bp.x;
      const dy = p.y - bp.y;
      return { x: bp.x + dx * cos - dy * sin, y: bp.y + dx * sin + dy * cos };
    };

    if (g.Line) {
      return {
        Line: {
          start: rotatePoint(g.Line.start),
          end: rotatePoint(g.Line.end),
        },
      };
    } else if (g.Circle) {
      return {
        Circle: {
          center: rotatePoint(g.Circle.center),
          radius: g.Circle.radius,
        },
      };
    } else if (g.Arc) {
      return {
        Arc: {
          center: rotatePoint(g.Arc.center),
          radius: g.Arc.radius,
          start_angle: g.Arc.start_angle + angle,
          end_angle: g.Arc.end_angle + angle,
        },
      };
    } else if (g.Rectangle) {
      return {
        Rectangle: {
          origin: rotatePoint(g.Rectangle.origin),
          width: g.Rectangle.width,
          height: g.Rectangle.height,
          rotation: (g.Rectangle.rotation || 0) + angle,
        },
      };
    } else if (g.Polyline) {
      return {
        Polyline: {
          vertices: g.Polyline.vertices.map((v: Point2D) => rotatePoint(v)),
          closed: g.Polyline.closed,
        },
      };
    }

    return null;
  }

  private computeScaleGeometry(point: Vec2): GeometryType | null {
    const entity = this.ctx.renderer?.getEntityById(this.entityId);
    if (!entity) return null;

    const dx = point.x - this.basePoint.x;
    const dy = point.y - this.basePoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = Math.max(0.01, dist / 10);
    const bp = this.basePoint;
    const g = entity.geometry;

    const scalePoint = (p: Vec2): Vec2 => ({
      x: bp.x + (p.x - bp.x) * factor,
      y: bp.y + (p.y - bp.y) * factor,
    });

    if (g.Line) {
      return {
        Line: {
          start: scalePoint(g.Line.start),
          end: scalePoint(g.Line.end),
        },
      };
    } else if (g.Circle) {
      return {
        Circle: {
          center: scalePoint(g.Circle.center),
          radius: g.Circle.radius * factor,
        },
      };
    } else if (g.Arc) {
      return {
        Arc: {
          center: scalePoint(g.Arc.center),
          radius: g.Arc.radius * factor,
          start_angle: g.Arc.start_angle,
          end_angle: g.Arc.end_angle,
        },
      };
    } else if (g.Rectangle) {
      return {
        Rectangle: {
          origin: scalePoint(g.Rectangle.origin),
          width: g.Rectangle.width * factor,
          height: g.Rectangle.height * factor,
          rotation: g.Rectangle.rotation,
        },
      };
    } else if (g.Polyline) {
      return {
        Polyline: {
          vertices: g.Polyline.vertices.map((v: Point2D) => scalePoint(v)),
          closed: g.Polyline.closed,
        },
      };
    }

    return null;
  }

  private computeMirrorGeometry(point: Vec2): GeometryType | null {
    const entity = this.ctx.renderer?.getEntityById(this.entityId);
    if (!entity) return null;

    const bp = this.basePoint;
    const ldx = point.x - bp.x;
    const ldy = point.y - bp.y;
    const lenSq = ldx * ldx + ldy * ldy;
    if (lenSq < 1e-12) return null;

    const g = entity.geometry;

    const mirrorPoint = (p: Vec2): Vec2 => {
      const vx = p.x - bp.x;
      const vy = p.y - bp.y;
      const dot = (vx * ldx + vy * ldy) / lenSq;
      return {
        x: bp.x + 2 * dot * ldx - vx,
        y: bp.y + 2 * dot * ldy - vy,
      };
    };

    if (g.Line) {
      return {
        Line: {
          start: mirrorPoint(g.Line.start),
          end: mirrorPoint(g.Line.end),
        },
      };
    } else if (g.Circle) {
      return {
        Circle: {
          center: mirrorPoint(g.Circle.center),
          radius: g.Circle.radius,
        },
      };
    } else if (g.Arc) {
      const newCenter = mirrorPoint(g.Arc.center);
      const mirrorAngle = Math.atan2(ldy, ldx);
      const newStart = 2 * mirrorAngle - g.Arc.end_angle;
      const newEnd = 2 * mirrorAngle - g.Arc.start_angle;
      return {
        Arc: {
          center: newCenter,
          radius: g.Arc.radius,
          start_angle: newStart,
          end_angle: newEnd,
        },
      };
    } else if (g.Rectangle) {
      const o = g.Rectangle.origin;
      const w = g.Rectangle.width;
      const h = g.Rectangle.height;
      const corners = [
        { x: o.x, y: o.y },
        { x: o.x + w, y: o.y },
        { x: o.x + w, y: o.y + h },
        { x: o.x, y: o.y + h },
      ];
      const mirrored = corners.map(mirrorPoint);
      return {
        Polyline: {
          vertices: mirrored,
          closed: true,
        },
      };
    } else if (g.Polyline) {
      return {
        Polyline: {
          vertices: g.Polyline.vertices.map((v: Point2D) => mirrorPoint(v)),
          closed: g.Polyline.closed,
        },
      };
    }

    return null;
  }

  private executeStretch(point: Vec2): void {
    const newGeom = this.computeStretchGeometry(point);
    if (newGeom) {
      this.ctx.executeCommand({
        type: 'ModifyGeometry',
        id: this.entityId,
        geometry_json: JSON.stringify(newGeom),
      });
    }
  }

  private executeMove(point: Vec2): void {
    const dx = point.x - this.basePoint.x;
    const dy = point.y - this.basePoint.y;
    this.ctx.executeCommand({ type: 'MoveEntity', id: this.entityId, dx, dy });
  }

  private executeRotate(point: Vec2): void {
    const angle = Math.atan2(point.y - this.basePoint.y, point.x - this.basePoint.x);
    this.ctx.executeCommand({
      type: 'RotateEntity',
      id: this.entityId,
      cx: this.basePoint.x,
      cy: this.basePoint.y,
      angle,
    });
  }

  private executeScale(point: Vec2): void {
    const dx = point.x - this.basePoint.x;
    const dy = point.y - this.basePoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const factor = Math.max(0.01, dist / 10);
    this.ctx.executeCommand({
      type: 'ScaleEntity',
      id: this.entityId,
      cx: this.basePoint.x,
      cy: this.basePoint.y,
      factor,
    });
  }

  private executeMirror(point: Vec2): void {
    this.ctx.executeCommand({
      type: 'MirrorEntity',
      id: this.entityId,
      x1: this.basePoint.x,
      y1: this.basePoint.y,
      x2: point.x,
      y2: point.y,
    });
  }
}
