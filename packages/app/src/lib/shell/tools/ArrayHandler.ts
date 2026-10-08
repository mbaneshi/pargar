import { BaseToolHandler } from '../BaseToolHandler';
import type { MouseHints, HandleResult } from '../types';

export class ArrayHandler extends BaseToolHandler {
  readonly id = 'modify_array';
  private arrayType: 'rectangular' | 'polar' = 'rectangular';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.arrayType = 'rectangular';
  }

  onCoordinateInput(): void {}

  onCommandInput(_status: number, command: string): boolean {
    const lower = command.trim().toLowerCase();

    if (this._status === 0) {
      if (lower === 'r' || lower === 'rectangular') {
        this.arrayType = 'rectangular';
        this.setStatus(1);
        return true;
      }
      if (lower === 'p' || lower === 'polar') {
        this.arrayType = 'polar';
        this.setStatus(1);
        return true;
      }
      return false;
    }

    if (this._status === 1) {
      const parts = lower.split(/[\,\s]+/).map((s) => parseFloat(s.trim()));
      const ids = this.ctx.getSelectedIds();
      if (ids.length === 0) return false;

      if (this.arrayType === 'rectangular' && parts.length >= 4 && parts.every((v) => !isNaN(v))) {
        this.ctx.executeCommand({
          type: 'ArrayRectangular',
          entity_ids: ids,
          rows: Math.round(parts[0]),
          cols: Math.round(parts[1]),
          row_spacing: parts[2],
          col_spacing: parts[3],
        });
        this.ctx.cancelCurrentTool();
        return true;
      }

      if (this.arrayType === 'polar' && parts.length >= 4 && parts.every((v) => !isNaN(v))) {
        this.ctx.executeCommand({
          type: 'ArrayPolar',
          entity_ids: ids,
          center_x: parts[1],
          center_y: parts[2],
          count: Math.round(parts[0]),
          angle: parts[3],
          rotate_items: true,
        });
        this.ctx.cancelCurrentTool();
        return true;
      }
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status === 0) return ['Rectangular', 'Polar'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0) return 'ARRAY Type R (rectangular) or P (polar):';
    if (this.arrayType === 'rectangular') return 'ARRAY Type rows,cols,row_spacing,col_spacing:';
    return 'ARRAY Type count,center_x,center_y,angle:';
  }

  getMouseHints(): MouseHints {
    return { left: 'Type parameters', right: 'Cancel' };
  }
}
