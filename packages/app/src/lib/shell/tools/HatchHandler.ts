import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class HatchHandler extends BaseToolHandler {
  readonly id = 'draw_hatch';
  private boundaryIds: string[] = [];
  private pattern = 'SOLID';
  private scale = 1.0;
  private angle = 0;
  private settingsPhase: 'pattern' | 'scale' | 'angle' | null = null;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.boundaryIds = [];
    this.pattern = 'SOLID';
    this.scale = 1.0;
    this.angle = 0;
    this.settingsPhase = null;

    this.registerKeyword(0, 'Settings', ['s', 'settings'], () => {
      this.settingsPhase = 'pattern';
      this.setStatus(10);
    });
  }

  deactivate(): void {
    this.boundaryIds = [];
    this.settingsPhase = null;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this.settingsPhase) return;

    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this.boundaryIds.includes(hitId)) {
      this.boundaryIds = this.boundaryIds.filter((id) => id !== hitId);
      this.ctx.renderer?.unhighlight(hitId);
    } else {
      this.boundaryIds = [...this.boundaryIds, hitId];
      this.ctx.renderer?.highlight(hitId);
    }
    this.setStatus(1);
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this.tryKeyword(this._status, command.trim())) return true;

    if (this.settingsPhase === 'pattern') {
      this.pattern = command.trim().toUpperCase() || 'SOLID';
      this.settingsPhase = 'scale';
      this.setStatus(11);
      return true;
    }

    if (this.settingsPhase === 'scale') {
      const s = parseFloat(command.trim());
      if (!isNaN(s) && s > 0) this.scale = s;
      this.settingsPhase = 'angle';
      this.setStatus(12);
      return true;
    }

    if (this.settingsPhase === 'angle') {
      const a = parseFloat(command.trim());
      if (!isNaN(a)) this.angle = a;
      this.settingsPhase = null;
      this.setStatus(this.boundaryIds.length > 0 ? 1 : 0);
      return true;
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Enter' && this.boundaryIds.length > 0 && !this.settingsPhase) {
      this.executeHatch();
      return 'HANDLED';
    }
    if (key === 'Escape') {
      if (this.settingsPhase) {
        this.settingsPhase = null;
        this.setStatus(this.boundaryIds.length > 0 ? 1 : 0);
        return 'HANDLED';
      }
      this.clearHighlights();
      return this.onEscape();
    }
    return 'PASS_THROUGH';
  }

  onPointerMove(_status: number, _point: Vec2): void {}

  getPrompt(): string {
    if (this.settingsPhase === 'pattern') {
      return `Enter pattern name <${this.pattern}>:`;
    }
    if (this.settingsPhase === 'scale') {
      return `Enter pattern scale <${this.scale}>:`;
    }
    if (this.settingsPhase === 'angle') {
      return `Enter pattern angle <${this.angle}>:`;
    }
    if (this.boundaryIds.length === 0) {
      return 'Select boundary entities or [Settings]:';
    }
    return `${this.boundaryIds.length} selected. Pick more, Enter to accept, or [Settings]:`;
  }

  getMouseHints(): MouseHints {
    if (this.settingsPhase) {
      return { left: 'Enter value', right: 'Cancel settings' };
    }
    if (this.boundaryIds.length === 0) {
      return { left: 'Pick boundary entity', right: 'Cancel' };
    }
    return { left: 'Pick more / Enter to accept', right: 'Cancel' };
  }

  getAvailableCommands(): string[] {
    if (this.settingsPhase) return [];
    return ['Settings'];
  }

  getPreviewGeometry(): PreviewEntity[] {
    return [];
  }

  private executeHatch(): void {
    this.ctx.executeCommand({
      type: 'CreateHatch',
      boundary_ids: this.boundaryIds,
      pattern: this.pattern,
      scale: this.scale,
      angle: this.angle,
      layer_id: this.ctx.activeLayerId,
    });
    this.clearHighlights();
    this.reset();
  }

  private clearHighlights(): void {
    for (const id of this.boundaryIds) {
      this.ctx.renderer?.unhighlight(id);
    }
  }

  private reset(): void {
    this.boundaryIds = [];
    this.settingsPhase = null;
    this.setStatus(0);
    this.ctx.renderer?.clearPreview();
  }
}
