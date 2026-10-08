import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class AlignedDimensionHandler extends BaseToolHandler {
  readonly id = 'annotate_aligneddim';

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else if (this._status === 1) {
      this.points.push(point);
      this.setStatus(2);
    } else {
      const p1 = this.points[0];
      const p2 = this.points[1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      let offset = 3;
      if (len > 0.01) {
        offset = Math.abs(dx * (p1.y - point.y) - dy * (p1.x - point.x)) / len;
        if (offset < 1) offset = 3;
      }
      this.ctx.executeCommand({
        type: 'CreateAlignedDimension',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        offset,
        layer_id: this.ctx.activeLayerId,
      });
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this._status === 2) {
      const offset = parseFloat(command.trim());
      if (!isNaN(offset) && offset > 0) {
        this.ctx.executeCommand({
          type: 'CreateAlignedDimension',
          x1: this.points[0].x,
          y1: this.points[0].y,
          x2: this.points[1].x,
          y2: this.points[1].y,
          offset,
          layer_id: this.ctx.activeLayerId,
        });
        this.setStatus(0);
        this.points = [];
        this.ctx.renderer?.clearPreview();
        return true;
      }
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status >= 1 && this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      return {
        type: 'CreateLine',
        x1: last.x,
        y1: last.y,
        x2: cursor.x,
        y2: cursor.y,
        layer_id: this.ctx.activeLayerId,
      };
    }
    return null;
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'ALIGNED DIM Click first point:';
    if (this._status === 1) return 'ALIGNED DIM Click second point:';
    return 'ALIGNED DIM Click offset or type distance:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First point', right: 'Cancel' };
    if (this._status === 1) return { left: 'Second point', right: 'Cancel' };
    return { left: 'Offset position', right: 'Cancel' };
  }
}
