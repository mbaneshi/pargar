import { BaseToolHandler } from './BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from './types';

/**
 * Base class for modify tools (Move, Copy, Rotate, Mirror, Scale).
 * Adds verb-noun selection phase: if no entities are pre-selected when
 * the tool activates, enters a "Select objects:" phase where clicks
 * pick entities and Enter confirms the selection set.
 */
export abstract class ModifyToolHandler extends BaseToolHandler {
  protected entityIds: string[] = [];
  private selecting = false;
  private pendingIds: Set<string> = new Set();

  protected abstract get toolName(): string;

  activate(ctx: import('./ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.entityIds = ctx.getSelectedIds();
    this.pendingIds = new Set();
    if (this.entityIds.length === 0) {
      this.selecting = true;
      this.setStatus(-1);
    } else {
      this.selecting = false;
    }
  }

  deactivate(): void {
    this.selecting = false;
    this.pendingIds.clear();
    super.deactivate();
  }

  onCoordinateInput(status: number, point: Vec2): void {
    if (this.selecting) {
      this.pickAtPoint(point);
      return;
    }
    this.onModifyInput(status, point);
  }

  onKeyDown(status: number, key: string, event?: KeyboardEvent): HandleResult {
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
    return this.onModifyKeyDown(status, key, event);
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
    if (this._status > 0) {
      this._status = this._status - 1;
    } else {
      this.ctx.cancelCurrentTool();
    }
  }

  onCommandInput(status: number, command: string): boolean {
    if (this.selecting) return false;
    return this.onModifyCommandInput(status, command);
  }

  getPrompt(): string {
    if (this.selecting) {
      const count = this.pendingIds.size;
      if (count === 0) return `${this.toolName} Select objects:`;
      return `${this.toolName} Select objects: ${count} found, press Enter to confirm`;
    }
    return this.getModifyPrompt();
  }

  getMouseHints(): MouseHints {
    if (this.selecting) {
      if (this.pendingIds.size > 0) {
        return { left: 'Add/remove object', right: 'Confirm selection' };
      }
      return { left: 'Select object', right: 'Cancel' };
    }
    return this.getModifyMouseHints();
  }

  /** Called by the shell when a drag-select completes during the selection phase. */
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
    this.setStatus(0);
  }

  // --- Abstract methods for subclasses ---

  protected abstract onModifyInput(status: number, point: Vec2): void;
  protected abstract getModifyPrompt(): string;
  protected abstract getModifyMouseHints(): MouseHints;

  protected onModifyKeyDown(_status: number, key: string, _event?: KeyboardEvent): HandleResult {
    if (key === 'Escape' && this._status > 0) {
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  protected onModifyCommandInput(_status: number, _command: string): boolean {
    return this.tryKeyword(this._status, _command);
  }
}
