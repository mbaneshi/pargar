import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class MatchPropHandler extends BaseToolHandler {
  readonly id = 'modify_matchprop';
  private sourceId: string | null = null;
  private targetIds: string[] = [];

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.sourceId = null;
    this.targetIds = [];
  }

  deactivate(): void {
    this.sourceId = null;
    this.targetIds = [];
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this._status === 0) {
      this.sourceId = hitId;
      this.setStatus(1);
    } else {
      if (hitId === this.sourceId) return;
      if (!this.targetIds.includes(hitId)) {
        this.targetIds.push(hitId);
      }
    }
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' || key === 'Enter') {
      if (this._status === 1 && this.sourceId && this.targetIds.length > 0) {
        this.ctx.executeCommand({
          type: 'MatchProperties',
          source_id: this.sourceId,
          target_ids: this.targetIds,
        });
      }
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'MATCHPROP Select source object:';
    return `MATCHPROP Select targets (${this.targetIds.length} selected), Enter to apply:`;
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select source', right: 'Cancel' };
    return { left: 'Select target', right: 'Apply & finish' };
  }
}
