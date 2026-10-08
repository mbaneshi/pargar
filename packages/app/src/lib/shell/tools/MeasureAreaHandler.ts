import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class MeasureAreaHandler extends BaseToolHandler {
  readonly id = 'annotate_measurearea';

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (hitId) {
      this.ctx.executeCommand({
        type: 'MeasureArea',
        entity_id: hitId,
      });
    }
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    return 'AREA Click closed polyline or rectangle:';
  }

  getMouseHints(): MouseHints {
    return { left: 'Select entity', right: 'Cancel' };
  }
}
