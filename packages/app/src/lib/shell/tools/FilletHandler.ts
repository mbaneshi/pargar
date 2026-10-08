import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

export class FilletHandler extends BaseToolHandler {
  readonly id = 'modify_fillet';
  private radius = 0;
  private firstId = '';
  private trimMode = true;
  private multipleMode = false;

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.radius = ctx.getSysvar('FILLETRAD');
    this.trimMode = ctx.getSysvar('TRIMMODE') !== 0;
    this.firstId = '';
    this.multipleMode = false;

    // Status 0 keywords
    this.registerKeyword(0, 'Undo', ['u', 'undo'], () => {
      const entry = this.undoStack.pop();
      if (entry) this.ctx.executeCommand({ type: 'Undo' });
    });
    this.registerKeyword(0, 'Polyline', ['p', 'polyline'], () => {
      this.setStatus(4);
    });
    this.registerKeyword(0, 'Radius', ['r', 'radius'], () => {
      this.setStatus(3);
    });
    this.registerKeyword(0, 'Trim', ['t', 'trim'], () => {
      this.setStatus(5);
    });
    this.registerKeyword(0, 'Multiple', ['m', 'multiple'], () => {
      this.multipleMode = true;
    });
  }

  deactivate(): void {
    this.radius = 0;
    this.firstId = '';
    this.trimMode = true;
    this.multipleMode = false;
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    if (this._status === 0) {
      this.firstId = hitId;
      this.setStatus(1);
    } else if (this._status === 1) {
      this.ctx.executeCommand({
        type: 'Fillet',
        id_a: this.firstId,
        id_b: hitId,
        radius: this.radius,
      });
      this.undoStack.push('Fillet', [this.firstId, hitId]);
      this.firstId = '';
      if (this.multipleMode) {
        this.setStatus(0);
      } else {
        this.setStatus(0);
        this.ctx.cancelCurrentTool();
      }
    } else if (this._status === 4) {
      this.ctx.executeCommand({
        type: 'FilletPolyline',
        id: hitId,
        radius: this.radius,
      });
      this.undoStack.push('FilletPolyline', [hitId]);
      this.setStatus(0);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this._status === 0) {
      const trimmed = command.trim();
      const r = parseFloat(trimmed);
      if (!isNaN(r) && r >= 0) {
        this.radius = r;
        this.ctx.setSysvar('FILLETRAD', r);
        return true;
      }
      return this.tryKeyword(0, command);
    }

    if (this._status === 3) {
      const trimmed = command.trim();
      if (trimmed === '') {
        this.setStatus(0);
        return true;
      }
      const r = parseFloat(trimmed);
      if (!isNaN(r) && r >= 0) {
        this.radius = r;
        this.ctx.setSysvar('FILLETRAD', r);
        this.setStatus(0);
        return true;
      }
      return false;
    }

    if (this._status === 5) {
      const trimmed = command.trim().toLowerCase();
      if (trimmed === 't' || trimmed === 'trim') {
        this.trimMode = true;
        this.ctx.setSysvar('TRIMMODE', 1);
        this.setStatus(0);
        return true;
      }
      if (trimmed === 'n' || trimmed === 'no' || trimmed === 'notrim') {
        this.trimMode = false;
        this.ctx.setSysvar('TRIMMODE', 0);
        this.setStatus(0);
        return true;
      }
      return false;
    }

    return this.tryKeyword(this._status, command);
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.setStatus(0);
      this.firstId = '';
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this._status !== 1 || !this.firstId) return null;
    const hitId = this.ctx.renderer?.hitTest(cursor.x, cursor.y);
    if (!hitId || hitId === this.firstId) return null;
    return { type: 'Fillet', id_a: this.firstId, id_b: hitId, radius: this.radius };
  }

  onPointerMove(): void {}

  getPrompt(): string {
    if (this._status === 0) {
      return `Current settings: Mode = ${this.trimMode ? 'TRIM' : 'NO TRIM'}, Radius = ${this.radius}\nSelect first object or [Undo/Polyline/Radius/Trim/Multiple]:`;
    }
    if (this._status === 1) {
      return 'Select second object or shift-select to apply corner or [Radius]:';
    }
    if (this._status === 3) {
      return `Specify fillet radius <${this.radius}>:`;
    }
    if (this._status === 4) {
      return 'Select 2D polyline:';
    }
    if (this._status === 5) {
      return `Enter Trim mode option [Trim/No trim] <${this.trimMode ? 'Trim' : 'No trim'}>:`;
    }
    return '';
  }

  getMouseHints(): MouseHints {
    if (this._status === 0) return { left: 'Select first entity', right: 'Cancel' };
    if (this._status === 4) return { left: 'Select polyline', right: 'Cancel' };
    return { left: 'Select second entity', right: 'Cancel' };
  }
}
