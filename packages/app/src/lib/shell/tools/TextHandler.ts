import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class TextHandler extends BaseToolHandler {
  readonly id = 'annotate_text';

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this._status === 1 && this.points.length > 0) {
      const content = command.trim();
      if (content) {
        this.ctx.executeCommand({
          type: 'CreateText',
          x: this.points[0].x,
          y: this.points[0].y,
          content,
          height: 2.5,
          rotation: 0,
          layer_id: this.ctx.activeLayerId,
        });
        this.setStatus(0);
        this.points = [];
        return true;
      }
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.points = [];
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'TEXT Click insertion point:';
    return 'TEXT Type text content:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Insertion point', right: 'Cancel' };
    return { left: 'Type text', right: 'Cancel' };
  }
}
