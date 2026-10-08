import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class ConstructionLineHandler extends BaseToolHandler {
  readonly id = 'draw_xline';

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const origin = this.points[0];
      this.ctx.executeCommand({
        type: 'CreateConstructionLine',
        ox: origin.x,
        oy: origin.y,
        dx: point.x - origin.x,
        dy: point.y - origin.y,
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
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    return {
      type: 'CreateLine',
      x1: this.points[0].x,
      y1: this.points[0].y,
      x2: cursor.x,
      y2: cursor.y,
      layer_id: this.ctx.activeLayerId,
    };
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'XLINE Specify origin point:';
    return 'XLINE Specify direction point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Origin point', right: 'Cancel' };
    return { left: 'Direction point', right: 'Cancel' };
  }
}
