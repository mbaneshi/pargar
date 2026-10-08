import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class SplineHandler extends BaseToolHandler {
  readonly id = 'draw_spline';

  onCoordinateInput(_status: number, point: Vec2): void {
    this.points.push(point);
    this.setStatus(this.points.length);
  }

  onCommandInput(_status: number, command: string): boolean {
    const lower = command.trim().toLowerCase();
    if ((lower === 'close' || lower === 'c') && this.points.length >= 3) {
      this.finish(true);
      return true;
    }
    if ((lower === 'undo' || lower === 'u') && this.points.length > 0) {
      this.points.pop();
      this.setStatus(this.points.length);
      this.ctx.renderer?.clearPreview();
      if (this.points.length === 0) this.setStatus(0);
      return true;
    }
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.points = [];
      this.ctx.renderer?.clearPreview();
      return 'HANDLED';
    }
    if (key === 'Enter' && this.points.length >= 2) {
      this.finish(false);
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
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
    const cmds: string[] = [];
    if (this.points.length >= 3) cmds.push('Close');
    if (this.points.length > 0) cmds.push('Undo');
    return cmds;
  }

  getPrompt(): string {
    if (this.points.length === 0) return 'SPLINE Specify first control point:';
    return `SPLINE ${this.points.length} points, click next or Enter to finish [Close]:`;
  }

  getMouseHints(): MouseHints {
    if (this.points.length === 0) return { left: 'First point', right: 'Cancel' };
    return { left: 'Next point', right: 'Finish' };
  }

  private finish(closed: boolean): void {
    const control_points: [number, number][] = this.points.map((p) => [p.x, p.y]);
    this.ctx.executeCommand({
      type: 'CreateSpline',
      control_points,
      degree: 3,
      closed,
      layer_id: this.ctx.activeLayerId,
    });
    this.setStatus(0);
    this.points = [];
    this.ctx.renderer?.clearPreview();
    this.ctx.cancelCurrentTool();
  }
}
