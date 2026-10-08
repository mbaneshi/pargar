import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class ExtendHandler extends BaseToolHandler {
  readonly id = 'modify_extend';
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
      if (hitId === this.boundaryId) return;
      this.ctx.executeCommand({
        type: 'ExtendEntity',
        id: hitId,
        boundary_id: this.boundaryId,
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
    if (this._status === 0) return 'EXTEND Select boundary edge:';
    return 'EXTEND Select entity to extend:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select boundary', right: 'Cancel' };
    return { left: 'Select entity to extend', right: 'Cancel' };
  }
}
