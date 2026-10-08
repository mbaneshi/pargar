import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class BlockInsertHandler extends BaseToolHandler {
  readonly id = 'insert_block';
  private blockName = '';
  private blockId = '';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.blockName = '';
    this.blockId = '';
  }

  deactivate(): void {
    this.blockName = '';
    this.blockId = '';
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 1) {
      const result = this.ctx.executeCommand({
        type: 'InsertBlock',
        block_id: this.blockId,
        x: point.x,
        y: point.y,
        rotation: 0,
        scale_x: 1,
        scale_y: 1,
        layer_id: this.ctx.activeLayerId,
      });
      if (result.success) {
        this.ctx.setLastPoint(point);
      }
      this.ctx.cancelCurrentTool();
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this._status === 0) {
      const name = command.trim();
      if (!name) return false;
      const resolved = this.resolveBlockByName(name);
      if (!resolved) {
        this.ctx.renderer?.markDirty?.();
        return true;
      }
      this.blockName = name;
      this.blockId = resolved;
      this.setStatus(1);
      return true;
    }
    return false;
  }

  onKeyDown(_status: number, key: string): HandleResult {
    if (key === 'Escape') {
      return this.onEscape();
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) {
      const names = this.getAvailableBlockNames();
      if (names.length > 0) {
        return `INSERT Block name to insert [${names.join(', ')}]:`;
      }
      return 'INSERT Block name to insert:';
    }
    return `INSERT Specify insertion point for "${this.blockName}":`;
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Type block name', right: 'Cancel' };
    return { left: 'Insertion point', right: 'Cancel' };
  }

  private resolveBlockByName(name: string): string | null {
    const blockDefs = this.ctx.renderer?.blockDefs as { id: string; name: string }[] | undefined;
    if (!blockDefs) return null;
    const match = blockDefs.find((b) => b.name.toLowerCase() === name.toLowerCase());
    return match?.id ?? null;
  }

  private getAvailableBlockNames(): string[] {
    const blockDefs = this.ctx.renderer?.blockDefs as { id: string; name: string }[] | undefined;
    if (!blockDefs) return [];
    return blockDefs.map((b) => b.name);
  }
}
