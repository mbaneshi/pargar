import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class ChamferHandler extends BaseToolHandler {
  readonly id = 'modify_chamfer';
  private distA = 0;
  private distB = 0;
  private firstId = '';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.distA = 0;
    this.distB = 0;
    this.firstId = '';
  }

  deactivate(): void {
    this.distA = 0;
    this.distB = 0;
    this.firstId = '';
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this._status === 0) {
      this.firstId = hitId;
      this.setStatus(1);
    } else if (this._status === 1) {
      this.ctx.executeCommand({
        type: 'Chamfer',
        id_a: this.firstId,
        id_b: hitId,
        dist_a: this.distA,
        dist_b: this.distB,
      });
      this.firstId = '';
      this.setStatus(0);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this._status === 0) {
      const parts = command.trim().split(/[,\s]+/);
      if (parts.length >= 2) {
        const a = parseFloat(parts[0]);
        const b = parseFloat(parts[1]);
        if (!isNaN(a) && !isNaN(b) && a >= 0 && b >= 0) {
          this.distA = a;
          this.distB = b;
          return true;
        }
      } else if (parts.length === 1) {
        const d = parseFloat(parts[0]);
        if (!isNaN(d) && d >= 0) {
          this.distA = d;
          this.distB = d;
          return true;
        }
      }
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.firstId = '';
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1 || !this.firstId) return null;
    const hitId = this.ctx.renderer?.hitTest(cursor.x, cursor.y);
    if (!hitId || hitId === this.firstId) return null;
    return {
      type: 'Chamfer',
      id_a: this.firstId,
      id_b: hitId,
      dist_a: this.distA,
      dist_b: this.distB,
    };
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status === 0) return ['Distance'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0)
      return `CHAMFER D1=${this.distA}, D2=${this.distB}, select first entity [Distance]:`;
    return 'CHAMFER Select second entity:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select first entity', right: 'Cancel' };
    return { left: 'Select second entity', right: 'Cancel' };
  }
}
