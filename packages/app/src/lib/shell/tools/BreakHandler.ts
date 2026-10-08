import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class BreakHandler extends BaseToolHandler {
  readonly id = 'modify_break';
  private entityId = '';
  private mode: 'two-point' | 'at-point' = 'two-point';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.entityId = '';
    this.mode = 'two-point';
  }

  deactivate(): void {
    this.entityId = '';
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);

    if (this._status === 0) {
      if (!hitId) return;
      this.entityId = hitId;
      this.points = [point];
      if (this.mode === 'at-point') {
        this.ctx.executeCommand({
          type: 'BreakAtPoint',
          entity_id: this.entityId,
          px: point.x,
          py: point.y,
        });
        this.entityId = '';
        this.points = [];
      } else {
        this.setStatus(1);
      }
    } else if (this._status === 1) {
      this.ctx.executeCommand({
        type: 'Break',
        entity_id: this.entityId,
        x1: this.points[0].x,
        y1: this.points[0].y,
        x2: point.x,
        y2: point.y,
      });
      this.setStatus(0);
      this.entityId = '';
      this.points = [];
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (command.trim().toLowerCase() === 'at' && this._status === 0) {
      this.mode = 'at-point';
      return true;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.entityId = '';
      this.points = [];
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status === 0) return ['AT'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0) {
      return this.mode === 'at-point'
        ? 'BREAK Select entity and break point:'
        : 'BREAK Select entity [AT]:';
    }
    return 'BREAK Specify second break point:';
  }

  getMouseHints(): MouseHints {
    return this._status === 0
      ? { left: 'Select entity', right: 'Cancel' }
      : { left: 'Break point', right: 'Cancel' };
  }
}
