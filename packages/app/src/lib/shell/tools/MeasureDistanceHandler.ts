import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class MeasureDistanceHandler extends BaseToolHandler {
  readonly id = 'annotate_measuredist';

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      this.ctx.executeCommand({
        type: 'MeasureDistance',
        x1: this.points[0].x,
        y1: this.points[0].y,
        x2: point.x,
        y2: point.y,
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
    if (this._status === 0) return 'MEASURE Click first point:';
    return 'MEASURE Click second point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First point', right: 'Cancel' };
    return { left: 'Second point', right: 'Cancel' };
  }
}
