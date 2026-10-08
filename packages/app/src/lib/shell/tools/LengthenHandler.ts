import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

type LengthenMode = 'delta' | 'percent' | 'total';

export class LengthenHandler extends BaseToolHandler {
  readonly id = 'modify_lengthen';
  private mode: LengthenMode = 'delta';
  private value = 0;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.mode = 'delta';
    this.value = 0;
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    if (this._status !== 2) return;

    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    let whichEnd = 'end';
    try {
      const entityJson = (this.ctx as any)._app?.kernel?.get_entity_json?.(hitId);
      if (entityJson) {
        const entity = JSON.parse(entityJson);
        const geom = entity.geometry;
        if (geom?.Line) {
          const dStart = Math.hypot(point.x - geom.Line.start.x, point.y - geom.Line.start.y);
          const dEnd = Math.hypot(point.x - geom.Line.end.x, point.y - geom.Line.end.y);
          whichEnd = dStart < dEnd ? 'start' : 'end';
        } else if (geom?.Arc) {
          const arc = geom.Arc;
          const sx = arc.center.x + arc.radius * Math.cos(arc.start_angle);
          const sy = arc.center.y + arc.radius * Math.sin(arc.start_angle);
          const ex = arc.center.x + arc.radius * Math.cos(arc.end_angle);
          const ey = arc.center.y + arc.radius * Math.sin(arc.end_angle);
          const dStart = Math.hypot(point.x - sx, point.y - sy);
          const dEnd = Math.hypot(point.x - ex, point.y - ey);
          whichEnd = dStart < dEnd ? 'start' : 'end';
        }
      }
    } catch {
      // Fall back to 'end'
    }

    this.ctx.executeCommand({
      type: 'Lengthen',
      entity_id: hitId,
      mode: this.mode,
      value: this.value,
      end: whichEnd,
    });
  }

  onCommandInput(_status: number, command: string): boolean {
    const trimmed = command.trim().toLowerCase();

    if (this._status === 0) {
      if (trimmed === 'd' || trimmed === 'delta') {
        this.mode = 'delta';
        this.setStatus(1);
        return true;
      }
      if (trimmed === 'p' || trimmed === 'percent') {
        this.mode = 'percent';
        this.setStatus(1);
        return true;
      }
      if (trimmed === 't' || trimmed === 'total') {
        this.mode = 'total';
        this.setStatus(1);
        return true;
      }
      return false;
    }

    if (this._status === 1) {
      const val = parseFloat(trimmed);
      if (!isNaN(val)) {
        this.value = val;
        this.setStatus(2);
        return true;
      }
      return false;
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.value = 0;
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 2) return null;
    const hitId = this.ctx.renderer?.hitTest(cursor.x, cursor.y);
    if (!hitId) return null;
    return {
      type: 'Lengthen',
      entity_id: hitId,
      mode: this.mode,
      value: this.value,
      end: 'end',
    };
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this._status === 0) return ['Delta', 'Percent', 'Total'];
    return [];
  }

  getPrompt(): string {
    if (this._status === 0) return 'LENGTHEN Select mode [Delta/Percent/Total]:';
    if (this._status === 1) return `LENGTHEN (${this.mode}) Enter value:`;
    return `LENGTHEN (${this.mode} ${this.value}) Select entity near end:`;
  }

  getMouseHints(): MouseHints {
    if (this._status === 2) return { left: 'Select entity', right: 'Cancel' };
    return { left: 'Type value', right: 'Cancel' };
  }
}
