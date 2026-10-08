import { BaseToolHandler } from '../BaseToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from '../types';

export class CircleHandler extends BaseToolHandler {
  readonly id = 'draw_circle';
  private mode: 'center' | '3p' | '2p' | 'ttr' = 'center';
  private diameterMode = false;
  private ttrEntities: { id: string; pickX: number; pickY: number }[] = [];

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    this.mode = 'center';
    this.diameterMode = false;
    this.ttrEntities = [];

    this.registerKeyword(0, '3P', ['3p'], () => {
      this.mode = '3p';
      this.points = [];
      this.setStatus(0);
    });
    this.registerKeyword(0, '2P', ['2p'], () => {
      this.mode = '2p';
      this.points = [];
      this.setStatus(0);
    });
    this.registerKeyword(0, 'Ttr', ['ttr', 't'], () => {
      this.mode = 'ttr';
      this.ttrEntities = [];
      this.setStatus(0);
    });

    this.registerKeyword(1, 'Diameter', ['d', 'diameter'], () => {
      this.diameterMode = true;
    });
    this.registerKeyword(1, 'Radius', ['r', 'radius'], () => {
      this.diameterMode = false;
    });
  }

  deactivate(): void {
    this.mode = 'center';
    this.diameterMode = false;
    this.ttrEntities = [];
    super.deactivate();
  }

  onCoordinateInput(_status: number, point: Vec2): void {
    switch (this.mode) {
      case 'center':
        this._handleCenter(point);
        break;
      case '3p':
        this._handle3P(point);
        break;
      case '2p':
        this._handle2P(point);
        break;
      case 'ttr':
        this._handleTtr(point);
        break;
    }
  }

  private _handleCenter(point: Vec2): void {
    if (this._status === 0) {
      this.points = [point];
      this.setStatus(1);
    } else {
      const center = this.points[0];
      const dist = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
      const radius = this.diameterMode ? dist / 2 : dist;
      if (radius > 0.01) {
        this.ctx.executeCommand({
          type: 'CreateCircle',
          cx: center.x,
          cy: center.y,
          radius,
          layer_id: this.ctx.activeLayerId,
        });
      }
      this.reset();
    }
  }

  private _handle3P(point: Vec2): void {
    this.points = [...this.points, point];
    if (this.points.length === 1) {
      this.setStatus(1);
    } else if (this.points.length === 2) {
      this.setStatus(2);
    } else {
      const [p1, p2, p3] = this.points;
      this.ctx.executeCommand({
        type: 'CreateCircle3P',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        x3: p3.x,
        y3: p3.y,
        layer_id: this.ctx.activeLayerId,
      });
      this.reset();
    }
  }

  private _handle2P(point: Vec2): void {
    this.points = [...this.points, point];
    if (this.points.length === 1) {
      this.setStatus(1);
    } else {
      const [p1, p2] = this.points;
      this.ctx.executeCommand({
        type: 'CreateCircle2P',
        x1: p1.x,
        y1: p1.y,
        x2: p2.x,
        y2: p2.y,
        layer_id: this.ctx.activeLayerId,
      });
      this.reset();
    }
  }

  private _handleTtr(point: Vec2): void {
    const hitId = this.ctx.renderer?.hitTest(point.x, point.y);
    if (!hitId) return;

    this.ttrEntities = [...this.ttrEntities, { id: hitId, pickX: point.x, pickY: point.y }];
    if (this.ttrEntities.length === 1) {
      this.setStatus(1);
    } else if (this.ttrEntities.length >= 2) {
      this.setStatus(2);
    }
  }

  onCommandInput(_status: number, command: string): boolean {
    if (this.tryKeyword(this._status, command.trim())) return true;

    if (this.mode === 'center' && this._status === 1 && this.points.length > 0) {
      const r = parseFloat(command.trim());
      if (!isNaN(r) && r > 0.01) {
        const center = this.points[0];
        const radius = this.diameterMode ? r / 2 : r;
        this.ctx.executeCommand({
          type: 'CreateCircle',
          cx: center.x,
          cy: center.y,
          radius,
          layer_id: this.ctx.activeLayerId,
        });
        this.reset();
        return true;
      }
    }

    if (this.mode === 'ttr' && this._status === 2 && this.ttrEntities.length >= 2) {
      const r = parseFloat(command.trim());
      if (!isNaN(r) && r > 0.01) {
        const [e1, e2] = this.ttrEntities;
        this.ctx.executeCommand({
          type: 'CreateCircleTtr',
          entity1_id: e1.id,
          pick1_x: e1.pickX,
          pick1_y: e1.pickY,
          entity2_id: e2.id,
          pick2_x: e2.pickX,
          pick2_y: e2.pickY,
          radius: r,
          layer_id: this.ctx.activeLayerId,
        });
        this.reset();
        return true;
      }
    }

    return false;
  }

  onKeyDown(status: number, key: string): HandleResult {
    if (key === 'Escape' && status > 0) {
      this.reset();
      return 'HANDLED';
    }
    return 'PASS_THROUGH';
  }

  getPreviewCommand(cursor: Vec2): object | null {
    if (this.mode === 'center' && this._status === 1 && this.points.length > 0) {
      const center = this.points[0];
      const dist = Math.sqrt((cursor.x - center.x) ** 2 + (cursor.y - center.y) ** 2);
      const radius = this.diameterMode ? dist / 2 : dist;
      if (radius < 0.01) return null;
      return {
        type: 'CreateCircle',
        cx: center.x,
        cy: center.y,
        radius,
        layer_id: this.ctx.activeLayerId,
      };
    }
    return null;
  }

  onPointerMove(): void {}

  getAvailableCommands(): string[] {
    if (this.mode === 'center' && this._status === 1) {
      return [this.diameterMode ? 'Radius' : 'Diameter'];
    }
    if (this._status === 0) return ['3P', '2P', 'Ttr'];
    return [];
  }

  getPrompt(): string {
    switch (this.mode) {
      case 'center':
        if (this._status === 0)
          return 'Specify center point for circle or [3P/2P/Ttr (tan tan radius)]:';
        {
          const label = this.diameterMode ? 'diameter' : 'radius';
          const cmds = this.getAvailableCommands();
          return `Specify ${label} of circle or [${cmds.join('/')}]:`;
        }
      case '3p':
        if (this._status === 0) return 'Specify first point on circle:';
        if (this._status === 1) return 'Second point:';
        return 'Third point:';
      case '2p':
        if (this._status === 0) return "Specify first end point of circle's diameter:";
        return 'Second end point:';
      case 'ttr':
        if (this._status === 0) return 'Specify point on object for first tangent:';
        if (this._status === 1) return 'Specify point on object for second tangent:';
        return 'Specify radius of circle:';
    }
  }

  getMouseHints(): MouseHints {
    switch (this.mode) {
      case 'center':
        if (this._status === 0) return { left: 'Center point', right: 'Cancel' };
        return { left: 'Radius point', right: 'Cancel' };
      case '3p':
        if (this._status === 0) return { left: 'First point', right: 'Cancel' };
        if (this._status === 1) return { left: 'Second point', right: 'Cancel' };
        return { left: 'Third point', right: 'Cancel' };
      case '2p':
        if (this._status === 0) return { left: 'First diameter point', right: 'Cancel' };
        return { left: 'Second diameter point', right: 'Cancel' };
      case 'ttr':
        if (this._status === 0) return { left: 'Pick first tangent entity', right: 'Cancel' };
        if (this._status === 1) return { left: 'Pick second tangent entity', right: 'Cancel' };
        return { left: 'Enter radius', right: 'Cancel' };
    }
  }

  getPreviewGeometry(): PreviewEntity[] {
    if (this.mode === 'center' && this._status === 1 && this.points.length > 0) {
      return [{ type: 'circle', data: { cx: this.points[0].x, cy: this.points[0].y } }];
    }
    return [];
  }

  private reset(): void {
    this.mode = 'center';
    this.points = [];
    this.diameterMode = false;
    this.ttrEntities = [];
    this.setStatus(0);
    this.ctx.renderer?.clearPreview();
  }
}
