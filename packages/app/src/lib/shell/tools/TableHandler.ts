import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class TableHandler extends BaseToolHandler {
  readonly id = 'draw_table';
  private rows = 5;
  private cols = 3;

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.ctx.setLastPoint(point);
      this.setStatus(1);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const trimmed = command.trim();
    if (this._status === 1) {
      if (trimmed === '') {
        this.setStatus(2);
        return true;
      }
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n > 0) {
        this.rows = n;
        this.setStatus(2);
        return true;
      }
      return false;
    }
    if (this._status === 2) {
      if (trimmed === '') {
        this.executeTable();
        return true;
      }
      const n = parseInt(trimmed, 10);
      if (!isNaN(n) && n > 0) {
        this.cols = n;
        this.executeTable();
        return true;
      }
      return false;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape') return this.onEscape();
    if (key === 'Enter' && status === 1) {
      this.setStatus(2);
      return 'HANDLED';
    }
    if (key === 'Enter' && status === 2) {
      this.executeTable();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'TABLE Specify insertion point:';
    if (this._status === 1) return `TABLE Number of rows [${this.rows}]:`;
    return `TABLE Number of columns [${this.cols}]:`;
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Insertion point', right: 'Cancel' };
    if (this._status === 1) return { left: 'Enter rows', right: 'Cancel' };
    return { left: 'Enter columns', right: 'Cancel' };
  }

  private executeTable(): void {
    const pt = this.points[0];
    const colWidths = Array(this.cols).fill(3.0);
    const cells = Array(this.rows * this.cols).fill('');
    this.ctx.executeCommand({
      type: 'CreateTable',
      x: pt.x,
      y: pt.y,
      rows: this.rows,
      cols: this.cols,
      row_height: 1.0,
      col_widths: colWidths,
      cells,
      layer_id: this.ctx.activeLayerId,
    });
    this.rows = 5;
    this.cols = 3;
    this.setStatus(0);
    this.points = [];
  }
}
