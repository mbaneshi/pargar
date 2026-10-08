import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export type MTextEditorRequest = {
  x: number;
  y: number;
  worldX: number;
  worldY: number;
  width: number;
  onSave: (content: string) => void;
  onCancel: () => void;
} | null;

export class MTextHandler extends BaseToolHandler {
  readonly id = 'draw_mtext';
  private editorCallback: ((req: MTextEditorRequest) => void) | null = null;
  private defaultWidth = 10;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
  }

  deactivate(): void {
    this.editorCallback?.(null);
    super.deactivate();
  }

  setEditorCallback(cb: (req: MTextEditorRequest) => void): void {
    this.editorCallback = cb;
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.openEditor(point);
    }
  }

  private openEditor(point: Vec2): void {
    const screenPos = this.ctx.renderer?.worldToScreen(point.x, point.y);
    const sx = screenPos?.x ?? 100;
    const sy = screenPos?.y ?? 100;

    this.setStatus(1);

    if (this.editorCallback) {
      this.editorCallback({
        x: sx,
        y: sy,
        worldX: point.x,
        worldY: point.y,
        width: this.defaultWidth,
        onSave: (content: string) => {
          this.createMText(point, content);
          this.editorCallback?.(null);
        },
        onCancel: () => {
          this.editorCallback?.(null);
          this.setStatus(0);
          this.points = [];
        },
      });
    }
  }

  private createMText(point: Vec2, content: string): void {
    this.ctx.executeCommand({
      type: 'CreateMText',
      x: point.x,
      y: point.y,
      content,
      width: this.defaultWidth,
      height: 2.5,
      rotation: 0,
      layer_id: this.ctx.activeLayerId,
    });
    this.setStatus(0);
    this.points = [];
  }

  onCommandInput(_status: number, _command: string): boolean {
    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape') {
      if (status === 1) {
        this.editorCallback?.(null);
      }
      return this.onEscape();
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) return 'MTEXT Specify insertion point:';
    return 'MTEXT Enter text in editor...';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Insertion point', right: 'Cancel' };
    return { left: 'Editing text', right: 'Cancel' };
  }
}
