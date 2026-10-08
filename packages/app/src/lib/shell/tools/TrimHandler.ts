import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class TrimHandler extends BaseToolHandler {
  readonly id = 'modify_trim';
  private boundaryId = '';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.boundaryId = '';
  }

  deactivate(): void {
    this.boundaryId = '';
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this._status === 0) {
      this.boundaryId = hitId;
      this.setStatus(1);
    } else {
      this.ctx.executeCommand({
        type: 'TrimEntity',
        id: hitId,
        boundary_id: this.boundaryId,
        pick_x: point.x,
        pick_y: point.y,
      });
    }
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.boundaryId = '';
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'TRIM Select cutting edge:';
    return 'TRIM Select entity to trim:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select cutting edge', right: 'Cancel' };
    return { left: 'Select entity to trim', right: 'Cancel' };
  }
}
