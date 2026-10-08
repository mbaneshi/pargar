import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints } from '../types';

export class PointHandler extends BaseToolHandler {
  readonly id = 'draw_point';

  onCoordinateInput(_status: number, point: Vec2): void {
    this.ctx.executeCommand({
      type: 'CreatePoint',
      x: point.x,
      y: point.y,
      layer_id: this.ctx.activeLayerId,
    });
    // Stays at status 0 — repeats until Escape
  }

  onPointerMove(): void {
    // No preview for point tool
  }

  getPrompt(): string {
    return 'POINT Specify a point:';
  }

  getMouseHints(): MouseHints {
    return { left: 'Place point', right: 'Cancel' };
  }
}
