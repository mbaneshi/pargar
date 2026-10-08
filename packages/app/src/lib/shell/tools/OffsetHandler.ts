import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';
import type { Entity } from '../../types/kernel';

export class OffsetHandler extends BaseToolHandler {
  readonly id = 'modify_offset';
  private distance = 0;
  private throughMode = false;
  private targetId: string | null = null;
  private recentIds: string[] = [];

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.distance = ctx.getSysvar('OFFSETDIST');
    this.throughMode = this.distance < 0;
    this.targetId = null;
    this.recentIds = [];

    // Keywords for distance prompt (status 0)
    this.registerKeyword(0, 'Through', ['t', 'through'], () => {
      this.throughMode = true;
      this.setStatus(1); // Skip distance input, go straight to entity selection
    });
    this.registerKeyword(0, 'Erase', ['e', 'erase'], () => {
      // Toggle OFFSETERASE
      const current = this.ctx.getSysvar('OFFSETERASE');
      this.ctx.setSysvar('OFFSETERASE', current ? 0 : 1);
    });
    this.registerKeyword(0, 'Layer', ['l', 'layer'], () => {
      // Toggle OFFSETLAYER (0=current, 1=source)
      const current = this.ctx.getSysvar('OFFSETLAYER');
      this.ctx.setSysvar('OFFSETLAYER', current ? 0 : 1);
    });

    // Keywords for object-selection prompt (status 1)
    this.registerKeyword(1, 'Exit', ['x', 'exit'], () => {
      this.ctx.cancelCurrentTool();
    });
    this.registerKeyword(1, 'Undo', ['u', 'undo'], () => {
      if (this.recentIds.length > 0) {
        this.recentIds.pop();
        this.ctx.executeCommand({ type: 'Undo' });
      }
    });

    // Keywords for side-pick prompt (status 2)
    this.registerKeyword(2, 'Exit', ['x', 'exit'], () => {
      this.ctx.cancelCurrentTool();
    });
    this.registerKeyword(2, 'Multiple', ['m', 'multiple'], () => {
      // Multiple: keep same source for next side picks (already loops by default)
    });
    this.registerKeyword(2, 'Undo', ['u', 'undo'], () => {
      if (this.recentIds.length > 0) {
        this.recentIds.pop();
        this.ctx.executeCommand({ type: 'Undo' });
        this.setStatus(1);
      }
    });
  }

  deactivate(): void {
    this.distance = 0;
    this.throughMode = false;
    this.targetId = null;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 1) {
      const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
      if (hitId) {
        this.targetId = hitId;
        this.setStatus(2);
      }
      return;
    }
    if (this._status === 2 && this.targetId) {
      if (this.throughMode) {
        const result = this.ctx.executeCommand({
          type: 'OffsetEntityThrough',
          id: this.targetId,
          through_x: point.x,
          through_y: point.y,
        });
        if (result.success && result.created_ids.length > 0) {
          this.recentIds.push(result.created_ids[0]);
        }
      } else {
        const entity = this.ctx.renderer?.getEntityById?.(this.targetId) as Entity | null;
        const sign = computeOffsetSign(entity, point);
        const result = this.ctx.executeCommand({
          type: 'OffsetEntity',
          id: this.targetId,
          distance: this.distance * sign,
        });
        if (result.success && result.created_ids[0]) {
          this.recentIds.push(result.created_ids[0]);
        }
      }
      this.targetId = null;
      this.setStatus(1);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this.tryKeyword(this._status, command)) return true;
    if (this._status === 0) {
      const trimmed = command.trim();
      if (trimmed === '' && this.distance > 0) {
        this.setStatus(1);
        return true;
      }
      const dist = parseFloat(trimmed);
      if (!isNaN(dist) && dist > 0) {
        this.distance = dist;
        this.ctx.setSysvar('OFFSETDIST', dist);
        this.setStatus(1);
        return true;
      }
    }
    if (this._status === 1 && command.trim() === '') {
      this.ctx.cancelCurrentTool();
      return true;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.distance = 0;
      this.targetId = null;
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onRightClick(status: number): void {
    if (status === 2) {
      this.targetId = null;
    }
    super.onRightClick(status);
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 2 || !this.targetId) return null;
    if (this.throughMode) {
      return {
        type: 'OffsetEntityThrough',
        id: this.targetId,
        through_x: cursor.x,
        through_y: cursor.y,
      };
    }
    const entity = this.ctx.renderer?.getEntityById?.(this.targetId) as any;
    const sign = computeOffsetSign(entity, cursor);
    return { type: 'OffsetEntity', id: this.targetId, distance: this.distance * sign };
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) {
      const def = this.distance > 0 ? ` <${this.distance}>` : '';
      return `Specify offset distance or${this.getKeywordBrackets(0)}${def}:`;
    }
    if (this._status === 1)
      return `Select object to offset or${this.getKeywordBrackets(1)} <Exit>:`;
    if (this._status === 2) {
      return this.throughMode
        ? 'Specify through point:'
        : `Specify point on side to offset or${this.getKeywordBrackets(2)} <Exit>:`;
    }
    return '';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Type distance', right: 'Cancel' };
    if (this._status === 1) return { left: 'Select entity', right: 'Cancel' };
    return { left: 'Click side', right: 'Back' };
  }
}

// Determine which side of the source geometry the user clicked, returning
// +1 for the positive-normal side (kernel's default) or -1 for the opposite.
// Known v1 limitation: polylines and other geometries fall back to +1.
function computeOffsetSign(entity: Entity | null, click: Vec2): number {
  if (!entity) return 1;
  const g = entity.geometry;
  if ('Line' in g) {
    const { start, end } = g.Line;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return 1;
    // Normal matching kernel's offset formula: n = (-dy, dx) / len.
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const d = (click.x - mx) * nx + (click.y - my) * ny;
    return d >= 0 ? 1 : -1;
  }
  if ('Circle' in g) {
    const { center, radius } = g.Circle;
    const d = Math.hypot(click.x - center.x, click.y - center.y);
    return d >= radius ? 1 : -1;
  }
  return 1;
}
