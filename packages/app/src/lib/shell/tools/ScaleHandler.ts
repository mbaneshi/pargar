import { ModifyToolHandler } from '../ModifyToolHandler';
import type { Vec2, MouseHints } from '../types';

export class ScaleHandler extends ModifyToolHandler {
  readonly id = 'modify_scale';
  protected get toolName() {
    return 'SCALE';
  }

  protected onModifyInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const dx = point.x - this.points[0].x;
      const dy = point.y - this.points[0].y;
      const factor = Math.sqrt(dx * dx + dy * dy) / 10;
      if (factor > 0) {
        for (const id of this.entityIds) {
          this.ctx.executeCommand({
            type: 'ScaleEntity',
            id,
            cx: this.points[0].x,
            cy: this.points[0].y,
            factor,
          });
        }
        this.ctx.cancelCurrentTool();
      }
    }
  }

  protected onModifyCommandInput(_status: number, command: string): boolean {
    if (this._status === 1 && this.points.length > 0) {
      const factor = parseFloat(command.trim());
      if (!isNaN(factor) && factor > 0) {
        for (const id of this.entityIds) {
          this.ctx.executeCommand({
            type: 'ScaleEntity',
            id,
            cx: this.points[0].x,
            cy: this.points[0].y,
            factor,
          });
        }
        this.ctx.cancelCurrentTool();
        return true;
      }
    }
    return false;
  }

  getPreviewCommand(cursor: Vec2): object | object[] | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    const dx = cursor.x - this.points[0].x;
    const dy = cursor.y - this.points[0].y;
    const factor = Math.sqrt(dx * dx + dy * dy) / 10;
    if (factor <= 0) return null;
    return this.entityIds.map((id) => ({
      type: 'ScaleEntity',
      id,
      cx: this.points[0].x,
      cy: this.points[0].y,
      factor,
    }));
  }

  onPointerMove(): void {}

  protected getModifyPrompt(): string {
    if (this._status === 0) return 'SCALE Specify base point:';
    return 'SCALE Specify scale factor or click reference:';
  }

  protected getModifyMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Base point', right: 'Cancel' };
    return { left: 'Scale reference', right: 'Cancel' };
  }
}
