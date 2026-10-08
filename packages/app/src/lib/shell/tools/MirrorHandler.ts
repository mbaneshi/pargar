import { ModifyToolHandler } from '../ModifyToolHandler';
import type { Vec2, MouseHints } from '../types';

export class MirrorHandler extends ModifyToolHandler {
  readonly id = 'modify_mirror';
  protected get toolName() {
    return 'MIRROR';
  }

  protected onModifyInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      for (const id of this.entityIds) {
        this.ctx.executeCommand({
          type: 'MirrorEntity',
          id,
          x1: this.points[0].x,
          y1: this.points[0].y,
          x2: point.x,
          y2: point.y,
        });
      }
      this.ctx.cancelCurrentTool();
    }
  }

  getPreviewCommand(cursor: Vec2): object | object[] | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    return this.entityIds.map((id) => ({
      type: 'MirrorEntity',
      id,
      x1: this.points[0].x,
      y1: this.points[0].y,
      x2: cursor.x,
      y2: cursor.y,
    }));
  }

  onPointerMove(): void {}

  protected getModifyPrompt(): string {
    if (this._status === 0) return 'MIRROR Specify first point of mirror line:';
    return 'MIRROR Specify second point of mirror line:';
  }

  protected getModifyMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First mirror point', right: 'Cancel' };
    return { left: 'Second mirror point', right: 'Cancel' };
  }
}
