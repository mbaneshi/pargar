import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class LineHandler extends BaseToolHandler {
  readonly id = 'draw_line';
  private firstPoint: Vec2 | null = null;
  private chainCount = 0;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.firstPoint = null;
    this.chainCount = 0;
  }

  deactivate(): void {
    this.firstPoint = null;
    this.chainCount = 0;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.firstPoint = point;
      this.chainCount = 0;
      this.setStatus(1);
    } else {
      const start = this.points[this.points.length - 1];
      this.ctx.executeCommand({
        type: 'CreateLine',
        x1: start.x,
        y1: start.y,
        x2: point.x,
        y2: point.y,
        layer_id: this.ctx.activeLayerId,
      });
      this.points.push(point);
      this.chainCount++;
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const cmd = command.toLowerCase().trim();

    if ((cmd === 'close' || cmd === 'c') && this._status === 1 && this.chainCount >= 2) {
      this.close();
      return true;
    }

    if ((cmd === 'undo' || cmd === 'u') && this._status === 1) {
      if (this.points.length > 1) {
        this.ctx.undo();
        this.points.pop();
        this.chainCount = Math.max(0, this.chainCount - 1);
        this.ctx.renderer?.clearPreview();
      } else {
        this.setStatus(0);
        this.points = [];
        this.firstPoint = null;
        this.chainCount = 0;
        this.ctx.renderer?.clearPreview();
      }
      return true;
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.points = [];
      this.firstPoint = null;
      this.chainCount = 0;
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onRightClick(status: number): void {
    if (status > 0 && this.chainCount >= 1) {
      // Finish: just reset to idle
      this.setStatus(0);
      this.points = [];
      this.firstPoint = null;
      this.chainCount = 0;
      this.ctx.renderer?.clearPreview();
      this.ctx.cancelCurrentTool();
    } else if (status > 0) {
      this.setStatus(0);
      this.points = [];
      this.firstPoint = null;
      this.chainCount = 0;
      this.ctx.renderer?.clearPreview();
    } else {
      this.ctx.cancelCurrentTool();
    }
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1 || this.points.length === 0) return null;
    const last = this.points[this.points.length - 1];
    return {
      type: 'CreateLine',
      x1: last.x,
      y1: last.y,
      x2: cursor.x,
      y2: cursor.y,
      layer_id: this.ctx.activeLayerId,
    };
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    const cmds: string[] = [];
    if (this._status === 1) {
      if (this.chainCount >= 2) cmds.push('Close');
      cmds.push('Undo');
    }
    return cmds;
  }

  getPrompt(): string {
    if (this._status === 0) return 'Specify first point:';
    const cmds = this.getAvailableCommands();
    if (cmds.length > 0) {
      return `Specify next point or [${cmds.join('/')}]:`;
    }
    return 'Specify next point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Start point', right: 'Cancel' };
    return { left: 'Next point', right: 'Done' };
  }

  getPreviewGeometry(): PreviewEntity[] {
    if (this._status === 1 && this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      return [{ type: 'line', data: { x1: last.x, y1: last.y } }];
    }
    return [];
  }

  private close(): void {
    if (!this.firstPoint || this.points.length === 0) return;
    const last = this.points[this.points.length - 1];
    this.ctx.executeCommand({
      type: 'CreateLine',
      x1: last.x,
      y1: last.y,
      x2: this.firstPoint.x,
      y2: this.firstPoint.y,
      layer_id: this.ctx.activeLayerId,
    });
    this.setStatus(0);
    this.points = [];
    this.firstPoint = null;
    this.chainCount = 0;
    this.ctx.renderer?.clearPreview();
    this.ctx.cancelCurrentTool();
  }
}
