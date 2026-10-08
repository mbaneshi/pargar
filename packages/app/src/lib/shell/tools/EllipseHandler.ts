import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class EllipseHandler extends BaseToolHandler {
  readonly id = 'draw_ellipse';
  private rotation = 0;
  private semiMajor = 0;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.rotation = 0;
    this.semiMajor = 0;
  }

  deactivate(): void {
    this.rotation = 0;
    this.semiMajor = 0;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else if (this._status === 1) {
      const dx = point.x - this.points[0].x;
      const dy = point.y - this.points[0].y;
      this.semiMajor = Math.sqrt(dx * dx + dy * dy);
      this.rotation = Math.atan2(dy, dx);
      if (this.semiMajor < 0.01) return;
      this.points.push(point);
      this.setStatus(2);
    } else {
      const dx = point.x - this.points[0].x;
      const dy = point.y - this.points[0].y;
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const localY = Math.abs(dx * sin + dy * cos);
      const semiMinor = Math.max(localY, 0.01);
      this.ctx.executeCommand({
        type: 'CreateEllipse',
        cx: this.points[0].x,
        cy: this.points[0].y,
        semi_major: this.semiMajor,
        semi_minor: semiMinor,
        rotation: this.rotation,
        layer_id: this.ctx.activeLayerId,
      });
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
    }
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.points = [];
      this.semiMajor = 0;
      this.rotation = 0;
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status === 1 && this.points.length > 0) {
      return {
        type: 'CreateLine',
        x1: this.points[0].x,
        y1: this.points[0].y,
        x2: cursor.x,
        y2: cursor.y,
        layer_id: this.ctx.activeLayerId,
      };
    }
    if (this._status === 2 && this.points.length > 0) {
      const dx = cursor.x - this.points[0].x;
      const dy = cursor.y - this.points[0].y;
      const cos = Math.cos(-this.rotation);
      const sin = Math.sin(-this.rotation);
      const localY = Math.abs(dx * sin + dy * cos);
      const semiMinor = Math.max(localY, 0.01);
      return {
        type: 'CreateEllipse',
        cx: this.points[0].x,
        cy: this.points[0].y,
        semi_major: this.semiMajor,
        semi_minor: semiMinor,
        rotation: this.rotation,
        layer_id: this.ctx.activeLayerId,
      };
    }
    return null;
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'ELLIPSE Specify center point:';
    if (this._status === 1) return 'ELLIPSE Specify major axis endpoint:';
    return 'ELLIPSE Specify minor axis point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Center point', right: 'Cancel' };
    if (this._status === 1) return { left: 'Major axis endpoint', right: 'Cancel' };
    return { left: 'Minor axis point', right: 'Cancel' };
  }
}
