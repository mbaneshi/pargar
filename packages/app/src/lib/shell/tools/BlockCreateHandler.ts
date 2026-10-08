import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class BlockCreateHandler extends BaseToolHandler {
  readonly id = 'create_block';
  private entityIds: string[] = [];
  private pendingIds: Set<string> = new Set();
  private selecting = false;
  private basePoint: Vec2 | null = null;
  private blockCounter = 1;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.entityIds = ctx.getSelectedIds();
    this.pendingIds = new Set();
    this.basePoint = null;
    if (this.entityIds.length === 0) {
      this.selecting = true;
      this.setStatus(0);
    } else {
      this.selecting = false;
      this.setStatus(1);
    }
  }

  deactivate(): void {
    this.selecting = false;
    this.pendingIds.clear();
    this.basePoint = null;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this.selecting) {
      this.pickAtPoint(point);
      return;
    }
    if (this._status === 1) {
      this.basePoint = point;
      this.setStatus(2);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this.selecting) return false;

    if (this._status === 2) {
      const name = command.trim() || `Block${this.blockCounter++}`;
      this.executeCreateBlock(name);
      return true;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (this.selecting) {
      if (key === 'Enter') {
        this.confirmSelection();
        return 'HANDLED';
      }
      if (key === 'Escape') {
        this.ctx.cancelCurrentTool();
        return 'HANDLED';
      }
      return 'HANDLED';
    }
    if (key === 'Enter' && this._status === 2) {
      const name = `Block${this.blockCounter++}`;
      this.executeCreateBlock(name);
      return 'HANDLED';
    }
    if (key === 'Escape') {
      return this.onEscape();
    }
    return 'PASS_THROUGH';
  }

  onRightClick(_status: number): void {
    if (this.selecting) {
      if (this.pendingIds.size > 0) {
        this.confirmSelection();
      } else {
        this.ctx.cancelCurrentTool();
      }
      return;
    }
    this.ctx.cancelCurrentTool();
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this.selecting) {
      const count = this.pendingIds.size;
      if (count === 0) return 'BLOCK Select entities to include in block:';
      return `BLOCK Select entities: ${count} found, press Enter to confirm`;
    }
    if (this._status === 1) return 'BLOCK Specify base point:';
    if (this._status === 2) return 'BLOCK Enter block name [Block]:';
    return 'BLOCK Select entities to include in block:';
  }

  getMouseHints(): MouseHints {
    if (this.selecting) {
      if (this.pendingIds.size > 0) {
        return { left: 'Add/remove object', right: 'Confirm selection' };
      }
      return { left: 'Select object', right: 'Cancel' };
    }
    if (this._status === 1) return { left: 'Base point', right: 'Cancel' };
    if (this._status === 2) return { left: 'Type name', right: 'Cancel' };
    return { left: 'Select object', right: 'Cancel' };
  }

  handleDragSelect(ids: string[]): boolean {
    if (!this.selecting) return false;
    for (const id of ids) {
      this.pendingIds.add(id);
    }
    this.highlightPending();
    return true;
  }

  private pickAtPoint(point: Vec2): void {
    const renderer = this.ctx.renderer;
    if (!renderer) return;
    const hitId = renderer.hitTest(point.x, point.y);
    if (hitId) {
      if (this.pendingIds.has(hitId)) {
        this.pendingIds.delete(hitId);
      } else {
        this.pendingIds.add(hitId);
      }
      this.highlightPending();
    }
  }

  private highlightPending(): void {
    const renderer = this.ctx.renderer;
    if (!renderer?.selectionManager) return;
    renderer.selectionManager.clear();
    for (const id of this.pendingIds) {
      renderer.selectionManager.select(id);
    }
    renderer.updateSelection();
    renderer.markDirty();
  }

  private confirmSelection(): void {
    if (this.pendingIds.size === 0) return;
    this.entityIds = Array.from(this.pendingIds);
    this.selecting = false;
    this.setStatus(1);
  }

  private executeCreateBlock(name: string): void {
    if (!this.basePoint || this.entityIds.length === 0) return;
    this.ctx.executeCommand({
      type: 'CreateBlock',
      name,
      base_x: this.basePoint.x,
      base_y: this.basePoint.y,
      entity_ids: this.entityIds,
    });
    this.ctx.setLastPoint(this.basePoint);
    this.ctx.cancelCurrentTool();
  }
}
