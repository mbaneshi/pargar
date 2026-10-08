import { ModifyToolHandler } from '../ModifyToolHandler';
import type { Vec2, MouseHints } from '../types';

export class RotateHandler extends ModifyToolHandler {
  readonly id = 'modify_rotate';
  protected get toolName() {
    return 'ROTATE';
  }

  protected onModifyInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const angle = Math.atan2(point.y - this.points[0].y, point.x - this.points[0].x);
      for (const id of this.entityIds) {
        this.ctx.executeCommand({
          type: 'RotateEntity',
          id,
          cx: this.points[0].x,
          cy: this.points[0].y,
          angle,
        });
      }
      this.ctx.cancelCurrentTool();
    }
  }

  protected onModifyCommandInput(_status: number, command: string): boolean {
    if (this._status === 1 && this.points.length > 0) {
      const deg = parseFloat(command.trim());
      if (!isNaN(deg)) {
        const angle = (deg * Math.PI) / 180;
        for (const id of this.entityIds) {
          this.ctx.executeCommand({
            type: 'RotateEntity',
            id,
            cx: this.points[0].x,
            cy: this.points[0].y,
            angle,
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
    const angle = Math.atan2(cursor.y - this.points[0].y, cursor.x - this.points[0].x);
    return this.entityIds.map((id) => ({
      type: 'RotateEntity',
      id,
      cx: this.points[0].x,
      cy: this.points[0].y,
      angle,
    }));
  }

  onPointerMove(): void {}

  protected getModifyPrompt(): string {
    if (this._status === 0) return 'ROTATE Specify base point:';
    return 'ROTATE Specify rotation angle or click point:';
  }

  protected getModifyMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Base point', right: 'Cancel' };
    return { left: 'Angle point', right: 'Cancel' };
  }
}
