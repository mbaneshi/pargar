import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class RevCloudHandler extends BaseToolHandler {
  readonly id = 'draw_revcloud';

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const p0 = this.points[0];
      const x = Math.min(p0.x, point.x);
      const y = Math.min(p0.y, point.y);
      const w = Math.abs(point.x - p0.x);
      const h = Math.abs(point.y - p0.y);
      if (w > 0.01 && h > 0.01) {
        const vertices: [number, number][] = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
        this.ctx.executeCommand({
          type: 'CreateRevisionCloud',
          vertices,
          arc_length: 0.5,
          layer_id: this.ctx.activeLayerId,
        });
      }
      this.reset();
    }
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.reset();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    const p0 = this.points[0];
    const x = Math.min(p0.x, cursor.x);
    const y = Math.min(p0.y, cursor.y);
    const w = Math.abs(cursor.x - p0.x);
    const h = Math.abs(cursor.y - p0.y);
    if (w < 0.01 || h < 0.01) return null;
    return { type: 'CreateRectangle', x, y, width: w, height: h, layer_id: this.ctx.activeLayerId };
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'REVCLOUD Specify first corner:';
    return 'REVCLOUD Specify opposite corner:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First corner', right: 'Cancel' };
    return { left: 'Opposite corner', right: 'Cancel' };
  }

  getPreviewGeometry(): PreviewEntity[] {
    if (this._status === 1 && this.points.length > 0) {
      return [{ type: 'rectangle', data: { x: this.points[0].x, y: this.points[0].y } }];
    }
    return [];
  }

  private reset(): void {
    this.setStatus(0);
    this.points = [];
    this.ctx.renderer?.clearPreview();
  }
}
