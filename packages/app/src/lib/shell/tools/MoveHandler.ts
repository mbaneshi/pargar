import { ModifyToolHandler } from '../ModifyToolHandler';
import type { Vec2, MouseHints } from '../types';

export class MoveHandler extends ModifyToolHandler {
  readonly id = 'modify_move';
  protected get toolName() {
    return 'MOVE';
  }

  protected onModifyInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const dx = point.x - this.points[0].x;
      const dy = point.y - this.points[0].y;
      for (const id of this.entityIds) {
        this.ctx.executeCommand({ type: 'MoveEntity', id, dx, dy });
      }
      this.ctx.cancelCurrentTool();
    }
  }

  getPreviewCommand(cursor: Vec2): object | object[] | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    const dx = cursor.x - this.points[0].x;
    const dy = cursor.y - this.points[0].y;
    return this.entityIds.map((id) => ({
      type: 'MoveEntity',
      id,
      dx,
      dy,
    }));
  }

  onPointerMove(): void {}

  protected getModifyPrompt(): string {
    if (this._status === 0) return 'MOVE Specify base point:';
    return 'MOVE Specify second point of displacement:';
  }

  protected getModifyMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Base point', right: 'Cancel' };
    return { left: 'Displacement point', right: 'Cancel' };
  }
}
