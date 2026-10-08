import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

/**
 * Merged TRIM + EXTEND handler — matches AutoCAD 2021+ behavior.
 *
 * Flow:
 *   State 0: "Select cutting edges ... Select objects or <select all>:"
 *            - Pick entities to add to boundary set
 *            - Enter/Space with no picks → use ALL entities as boundaries
 *            - Enter/Space with picks → confirm boundary set
 *   State 1: "Select object to trim or shift-select to extend or [Fence/Crossing/...]:"
 *            - Click → trim picked entity against boundaries
 *            - Shift+click → extend picked entity to nearest boundary
 *            - U → undo last trim/extend within this command
 *            - Enter/Esc → exit
 *
 * When invoked as EXTEND (via alias EX), Shift inverts to TRIM.
 */
export class TrimExtendHandler extends BaseToolHandler {
  readonly id: string;
  private boundaryIds: string[] = [];
  private useAllBoundaries = false;
  private recentOps: string[] = [];
  private invertedMode: boolean;

  constructor(mode: 'trim' | 'extend' = 'trim') {
    super();
    this.invertedMode = mode === 'extend';
    this.id = mode === 'extend' ? 'modify_extend' : 'modify_trim';
  }

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.boundaryIds = [];
    this.useAllBoundaries = false;
    this.recentOps = [];

    const kernel = (ctx as any)._app?.kernel;

    this.registerKeyword(1, 'Fence', ['f', 'fence'], () => {
      this.batchPicker.startFence(kernel, (ids: string[]) => {
        for (const id of ids) {
          const boundaryId = this.findBestBoundary(id);
          if (boundaryId) {
            const result = this.ctx.executeCommand({
              type: 'TrimEntity',
              id,
              boundary_id: boundaryId,
              pick_x: 0,
              pick_y: 0,
            });
            if (result.success) this.recentOps.push(id);
          }
        }
      });
    });

    this.registerKeyword(1, 'Crossing', ['c', 'crossing'], () => {
      this.batchPicker.startCrossing(kernel, (ids: string[]) => {
        for (const id of ids) {
          const boundaryId = this.findBestBoundary(id);
          if (boundaryId) {
            const result = this.ctx.executeCommand({
              type: 'TrimEntity',
              id,
              boundary_id: boundaryId,
              pick_x: 0,
              pick_y: 0,
            });
            if (result.success) this.recentOps.push(id);
          }
        }
      });
    });

    this.registerKeyword(1, 'Edge', ['e', 'edge'], () => {
      this.setStatus(2);
    });
    this.registerKeyword(1, 'eRase', ['r', 'erase'], () => {
      this.setStatus(3);
    });
  }

  deactivate(): void {
    this.boundaryIds = [];
    this.useAllBoundaries = false;
    this.recentOps = [];
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this.batchPicker.isActive()) {
      this.batchPicker.handleClick(point);
      return;
    }

    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this._status === 0) {
      if (!this.boundaryIds.includes(hitId)) {
        this.boundaryIds.push(hitId);
      }
      return;
    }

    if (this._status === 1) {
      const shiftHeld = this.ctx.lastModifiers?.shift ?? false;
      this.applyOperation(hitId, point, shiftHeld);
      return;
    }

    if (this._status === 3) {
      this.ctx.executeCommand({ type: 'DeleteEntity', id: hitId });
      return;
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const trimmed = command.trim().toLowerCase();

    if (this.batchPicker.isActive()) {
      if (trimmed === '') {
        this.batchPicker.finish();
        return true;
      }
      return false;
    }

    if (this._status === 0) {
      if (trimmed === '') {
        if (this.boundaryIds.length === 0) {
          this.useAllBoundaries = true;
        }
        this.setStatus(1);
        this.enterPickMode();
        return true;
      }
      return false;
    }

    if (this._status === 1) {
      if (trimmed === 'u' || trimmed === 'undo') {
        this.undoLastOp();
        return true;
      }
      if (trimmed === '') {
        this.ctx.cancelCurrentTool();
        return true;
      }
      return this.tryKeyword(1, trimmed);
    }

    if (this._status === 2) {
      if (trimmed === 'e' || trimmed === 'extend') {
        this.ctx.setSysvar('EDGEMODE', 1);
        this.setStatus(1);
        return true;
      }
      if (trimmed === 'n' || trimmed === 'no' || trimmed === 'noextend') {
        this.ctx.setSysvar('EDGEMODE', 0);
        this.setStatus(1);
        return true;
      }
      if (trimmed === '') {
        this.setStatus(1);
        return true;
      }
      return false;
    }

    if (this._status === 3) {
      if (trimmed === '') {
        this.setStatus(1);
        return true;
      }
      return false;
    }

    return false;
  }

  onKeyDown(status: number, key: string, _event?: KeyboardEvent): HandleResult {
    if (key === 'Escape' && status > 0) {
      if (status === 1) {
        this.ctx.cancelCurrentTool();
        return 'HANDLED';
      }
      this.setStatus(0);
      this.boundaryIds = [];
      this.useAllBoundaries = false;
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1) return null;
    if (this.batchPicker.isActive()) return null;
    const hitId = this.ctx.renderer?.hitTest(cursor.x, cursor.y);
    if (!hitId) return null;
    const shiftHeld = this.ctx.lastModifiers?.shift ?? false;
    const doExtend = this.invertedMode ? !shiftHeld : shiftHeld;
    const boundaryId = this.findBestBoundary(hitId);
    if (!boundaryId) return null;
    if (doExtend) {
      return { type: 'ExtendEntity', id: hitId, boundary_id: boundaryId };
    }
    return {
      type: 'TrimEntity',
      id: hitId,
      boundary_id: boundaryId,
      pick_x: cursor.x,
      pick_y: cursor.y,
    };
  }

  onPointerMove(): void {}

  handlePickDragSelect(ids: string[]): void {
    for (const id of ids) {
      const shiftHeld = this.ctx.lastModifiers?.shift ?? false;
      const doExtend = this.invertedMode ? !shiftHeld : shiftHeld;
      const boundaryId = this.findBestBoundary(id);
      if (!boundaryId) continue;
      if (doExtend) {
        const result = this.ctx.executeCommand({
          type: 'ExtendEntity',
          id,
          boundary_id: boundaryId,
        });
        if (result.success) this.recentOps.push(id);
      } else {
        const result = this.ctx.executeCommand({
          type: 'TrimEntity',
          id,
          boundary_id: boundaryId,
          pick_x: 0,
          pick_y: 0,
        });
        if (result.success) this.recentOps.push(id);
      }
    }
  }

  getPrompt(): string {
    if (this.batchPicker.isActive()) {
      return this.batchPicker.getPrompt();
    }
    if (this._status === 0) {
      const label = this.invertedMode ? 'EXTEND' : 'TRIM';
      const count = this.boundaryIds.length;
      if (count > 0) {
        return `${label} ${count} edge(s) selected. Select more or press Enter to confirm:`;
      }
      return `Select cutting edges ...\nSelect objects or <select all>:`;
    }
    if (this._status === 2) {
      return 'Enter an implied edge extension mode [Extend/No extend] <Extend>:';
    }
    if (this._status === 3) {
      return 'Select objects to erase or [Enter to return]:';
    }
    return 'Select object to trim or shift-select to extend or [Fence/Crossing/Project/Edge/eRase/Undo]:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select boundary', right: 'Cancel' };
    return { left: 'Trim', right: 'Done' };
  }

  private applyOperation(entityId: string, point: Vec2, shiftHeld: boolean): void {
    const doExtend = this.invertedMode ? !shiftHeld : shiftHeld;

    if (doExtend) {
      const boundaryId = this.findBestBoundary(entityId);
      if (!boundaryId) return;
      const result = this.ctx.executeCommand({
        type: 'ExtendEntity',
        id: entityId,
        boundary_id: boundaryId,
      });
      if (result.success) {
        this.recentOps.push(entityId);
      }
    } else {
      const boundaryId = this.findBestBoundary(entityId);
      if (!boundaryId) return;
      const result = this.ctx.executeCommand({
        type: 'TrimEntity',
        id: entityId,
        boundary_id: boundaryId,
        pick_x: point.x,
        pick_y: point.y,
      });
      if (result.success) {
        this.recentOps.push(entityId);
      }
    }
  }

  private findBestBoundary(entityId: string): string | null {
    if (this.useAllBoundaries) {
      // Use all visible entities as potential boundaries — pick the first
      // one that isn't the entity itself. The kernel will handle intersection testing.
      const allIds = this.ctx.renderer?.getAllEntityIds?.() as string[] | undefined;
      if (allIds) {
        for (const id of allIds) {
          if (id !== entityId) return id;
        }
      }
      // Fallback: if renderer doesn't have getAllEntityIds, use first boundary
      return this.boundaryIds[0] ?? null;
    }
    // Explicit boundaries: find first that isn't the entity itself
    for (const id of this.boundaryIds) {
      if (id !== entityId) return id;
    }
    return null;
  }

  private undoLastOp(): void {
    if (this.recentOps.length > 0) {
      this.recentOps.pop();
      // Undo in the kernel — the last event was the trim/extend
      this.ctx.executeCommand({ type: 'Undo' });
    }
  }
}
