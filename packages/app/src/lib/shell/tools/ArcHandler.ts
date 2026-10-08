import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class ArcHandler extends BaseToolHandler {
  readonly id = 'draw_arc';
  private radius = 0;
  private startAngle = 0;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.radius = 0;
    this.startAngle = 0;
  }

  deactivate(): void {
    this.radius = 0;
    this.startAngle = 0;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      // Center point
      this.points = [point];
      this.setStatus(1);
    } else if (this._status === 1) {
      // Start point — defines radius and start angle
      const center = this.points[0];
      this.radius = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
      this.startAngle = Math.atan2(point.y - center.y, point.x - center.x);
      this.points.push(point);
      this.setStatus(2);
    } else {
      // End point — defines end angle
      const center = this.points[0];
      const endAngle = Math.atan2(point.y - center.y, point.x - center.x);
      if (this.radius > 0.01) {
        this.ctx.executeCommand({
          type: 'CreateArc',
          cx: center.x,
          cy: center.y,
          radius: this.radius,
          start_angle: this.startAngle,
          end_angle: endAngle,
          layer_id: this.ctx.activeLayerId,
        });
      }
      this.reset();
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const cmd = command.toLowerCase().trim();
    if ((cmd === 'undo' || cmd === 'u') && this._status > 0) {
      if (this._status === 2) {
        this.points.pop();
        this.radius = 0;
        this.startAngle = 0;
        this.setStatus(1);
      } else {
        this.points = [];
        this.setStatus(0);
      }
      this.ctx.renderer?.clearPreview();
      return true;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.reset();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status === 1 && this.points.length > 0) {
      const center = this.points[0];
      return {
        type: 'CreateLine',
        x1: center.x,
        y1: center.y,
        x2: cursor.x,
        y2: cursor.y,
        layer_id: this.ctx.activeLayerId,
      };
    }
    if (this._status === 2 && this.points.length >= 1) {
      const center = this.points[0];
      const endAngle = Math.atan2(cursor.y - center.y, cursor.x - center.x);
      return {
        type: 'CreateArc',
        cx: center.x,
        cy: center.y,
        radius: this.radius,
        start_angle: this.startAngle,
        end_angle: endAngle,
        layer_id: this.ctx.activeLayerId,
      };
    }
    return null;
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status > 0) return ['Undo'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0) return 'ARC Specify center point:';
    if (this._status === 1) return 'ARC Specify start point [Undo]:';
    return 'ARC Specify end point [Undo]:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Center point', right: 'Cancel' };
    if (this._status === 1) return { left: 'Start point', right: 'Cancel' };
    return { left: 'End point', right: 'Cancel' };
  }

  getPreviewGeometry(): PreviewEntity[] {
    if (this._status === 2 && this.points.length >= 1) {
      const center = this.points[0];
      return [
        {
          type: 'arc',
          data: {
            cx: center.x,
            cy: center.y,
            radius: this.radius,
            startAngle: this.startAngle,
          },
        },
      ];
    }
    return [];
  }

  private reset(): void {
    this.setStatus(0);
    this.points = [];
    this.radius = 0;
    this.startAngle = 0;
    this.ctx.renderer?.clearPreview();
  }
}
