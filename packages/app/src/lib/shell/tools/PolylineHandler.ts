import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class PolylineHandler extends BaseToolHandler {
  readonly id = 'draw_polyline';

  onCoordinateInput(_status: number, point: Vec2): void {
    this.points.push(point);
    if (this._status === 0) {
      this.setStatus(1);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    const cmd = command.toLowerCase().trim();

    if ((cmd === 'close' || cmd === 'c') && this.points.length >= 3) {
      this.finish(true);
      return true;
    }

    if ((cmd === 'undo' || cmd === 'u') && this.points.length > 0) {
      this.points.pop();
      if (this.points.length === 0) {
        this.setStatus(0);
      }
      this.ctx.renderer?.clearPreview();
      return true;
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      if (this.points.length >= 2) {
        this.finish(false);
        return 'HANDLED';
      }
      this.reset();
      return 'HANDLED';
    }
    if (key === 'Enter' && this.points.length >= 2) {
      this.finish(false);
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onRightClick(status: number): void {
    if (this.points.length >= 2) {
      this.finish(false);
    } else if (status > 0) {
      this.reset();
    } else {
      this.ctx.cancelCurrentTool();
    }
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this.points.length === 0) return null;
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
    if (this._status === 0) return [];
    const cmds: string[] = [];
    if (this.points.length >= 3) cmds.push('Close');
    cmds.push('Undo');
    return cmds;
  }

  getPrompt(): string {
    if (this._status === 0) return 'PLINE Specify start point:';
    const cmds = this.getAvailableCommands();
    if (cmds.length > 0) {
      return `PLINE Specify next point [${cmds.join('/')}]:`;
    }
    return 'PLINE Specify next point:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First point', right: 'Cancel' };
    return { left: 'Next point', right: 'Finish' };
  }

  getPreviewGeometry(): PreviewEntity[] {
    if (this.points.length > 0) {
      return [
        {
          type: 'polyline',
          data: { vertices: this.points.map((p) => [p.x, p.y]) },
        },
      ];
    }
    return [];
  }

  private finish(closed: boolean): void {
    if (this.points.length < 2) return;
    const vertices: [number, number][] = this.points.map((p) => [p.x, p.y]);
    this.ctx.executeCommand({
      type: 'CreatePolyline',
      vertices,
      closed,
      layer_id: this.ctx.activeLayerId,
    });
    this.reset();
    this.ctx.cancelCurrentTool();
  }

  private reset(): void {
    this.setStatus(0);
    this.points = [];
    this.ctx.renderer?.clearPreview();
  }
}
