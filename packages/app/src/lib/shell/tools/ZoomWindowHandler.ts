import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class ZoomWindowHandler extends BaseToolHandler {
  readonly id = 'zoom_window';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    ctx.renderer?.startZoomWindow();
  }

  deactivate(): void {
    this.ctx?.renderer?.cancelZoomWindow();
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const renderer = this.ctx.renderer;
    if (!renderer) return;

    if (this._status === 0) {
      renderer.handleZoomWindowClick(point.x, point.y);
      this.points = [point];
      this.setStatus(1);
    } else {
      renderer.handleZoomWindowClick(point.x, point.y);
      this.ctx.cancelCurrentTool();
    }
  }

  onKeyDown(_status: number, key: string): HandleResult {
    if (key === 'Escape') {
      this.ctx.renderer?.cancelZoomWindow();
      this.ctx.cancelCurrentTool();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(_status: number, _point: Vec2): void {}

  getPrompt(): string {
    if (this._status === 0) return 'ZW Specify first corner:';
    return 'ZW Specify opposite corner:';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'First corner', right: 'Cancel' };
    return { left: 'Opposite corner', right: 'Cancel' };
  }
}
