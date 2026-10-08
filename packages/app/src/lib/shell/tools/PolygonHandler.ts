import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class PolygonHandler extends BaseToolHandler {
  readonly id = 'draw_polygon';
  private sides = 6;
  private inscribed = true;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.sides = 6;
    this.inscribed = true;
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const center = this.points[0];
      const radius = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
      const rotation = Math.atan2(point.y - center.y, point.x - center.x);
      if (radius > 0.01) {
        this.ctx.executeCommand({
          type: 'CreatePolygon',
          cx: center.x,
          cy: center.y,
          radius,
          sides: this.sides,
          inscribed: this.inscribed,
          rotation,
          layer_id: this.ctx.activeLayerId,
        });
      }
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const cmd = command.trim().toLowerCase();
    if (cmd === 'i' || cmd === 'inscribed') {
      this.inscribed = true;
      return true;
    }
    if (cmd === 'c' || cmd === 'circumscribed') {
      this.inscribed = false;
      return true;
    }
    const n = parseInt(cmd, 10);
    if (!isNaN(n) && n >= 3 && n <= 1024 && this._status === 0) {
      this.sides = n;
      return true;
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
    if (this._status !== 1 || this.points.length === 0) return null;
    const center = this.points[0];
    const radius = Math.sqrt((cursor.x - center.x) ** 2 + (cursor.y - center.y) ** 2);
    const rotation = Math.atan2(cursor.y - center.y, cursor.x - center.x);
    return {
      type: 'CreatePolygon',
      cx: center.x,
      cy: center.y,
      radius,
      sides: this.sides,
      inscribed: this.inscribed,
      rotation,
      layer_id: this.ctx.activeLayerId,
    };
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status === 0) return ['Inscribed', 'Circumscribed'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0)
      return `POLYGON ${this.sides} sides, ${this.inscribed ? 'Inscribed' : 'Circumscribed'}. Enter sides or specify center [I/C]:`;
    return 'POLYGON Specify radius point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Center point', right: 'Cancel' };
    return { left: 'Radius point', right: 'Cancel' };
  }
}
