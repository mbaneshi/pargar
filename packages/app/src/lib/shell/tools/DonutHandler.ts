import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class DonutHandler extends BaseToolHandler {
  readonly id = 'draw_donut';
  private innerRadius = 0.5;
  private outerRadius = 1.0;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.innerRadius = 0.5;
    this.outerRadius = 1.0;
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      // Center point — create donut with current radii
      this.ctx.executeCommand({
        type: 'CreateDonut',
        cx: point.x,
        cy: point.y,
        inner_radius: this.innerRadius,
        outer_radius: this.outerRadius,
        layer_id: this.ctx.activeLayerId,
      });
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const parts = command.trim().split(/[,\s]+/);
    if (parts.length === 2) {
      const inner = parseFloat(parts[0]);
      const outer = parseFloat(parts[1]);
      if (!isNaN(inner) && !isNaN(outer) && inner >= 0 && outer > 0 && outer > inner) {
        this.innerRadius = inner;
        this.outerRadius = outer;
        return true;
      }
    }
    return false;
  }

  onKeyDown(_status: number, key: string): HandleResult {
    if (key === 'Escape') {
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    return `DONUT Inner=${this.innerRadius}, Outer=${this.outerRadius}. Click to place or enter "inner,outer":`;
  }

  getMouseHints(): MouseHints {
    return { left: 'Place donut', right: 'Cancel' };
  }
}
