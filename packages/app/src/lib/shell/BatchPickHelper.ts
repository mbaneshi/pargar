import type { Vec2 } from './types';

export class BatchPickHelper {
  private mode: 'fence' | 'crossing' | null = null;
  private _points: Vec2[] = [];
  private onComplete: ((ids: string[]) => void) | null = null;
  private kernelRef: {
    query_spatial_window: (x1: number, y1: number, x2: number, y2: number) => string;
  } | null = null;

  startFence(
    kernel: { query_spatial_window: (x1: number, y1: number, x2: number, y2: number) => string },
    onComplete: (ids: string[]) => void,
  ): void {
    this.mode = 'fence';
    this._points = [];
    this.onComplete = onComplete;
    this.kernelRef = kernel;
  }

  startCrossing(
    kernel: { query_spatial_window: (x1: number, y1: number, x2: number, y2: number) => string },
    onComplete: (ids: string[]) => void,
  ): void {
    this.mode = 'crossing';
    this._points = [];
    this.onComplete = onComplete;
    this.kernelRef = kernel;
  }

  handleClick(point: Vec2): boolean {
    if (!this.mode) return false;
    this._points.push(point);
    if (this.mode === 'crossing' && this._points.length === 2) {
      this.finish();
    }
    return true;
  }

  finish(): void {
    if (!this.mode || !this.kernelRef || !this.onComplete) return;
    let ids: string[] = [];
    if (this.mode === 'crossing' && this._points.length === 2) {
      const p1 = this._points[0];
      const p2 = this._points[1];
      const minX = Math.min(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxX = Math.max(p1.x, p2.x);
      const maxY = Math.max(p1.y, p2.y);
      try {
        ids = JSON.parse(this.kernelRef.query_spatial_window(minX, minY, maxX, maxY));
      } catch {
        ids = [];
      }
    }
    if (this.mode === 'fence' && this._points.length >= 2) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of this._points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      try {
        ids = JSON.parse(this.kernelRef.query_spatial_window(minX, minY, maxX, maxY));
      } catch {
        ids = [];
      }
    }
    const cb = this.onComplete;
    this.reset();
    cb(ids);
  }

  isActive(): boolean {
    return this.mode !== null;
  }

  cancel(): void {
    this.reset();
  }

  get points(): Vec2[] {
    return this._points;
  }

  getPrompt(): string {
    if (this.mode === 'fence') {
      return this._points.length === 0
        ? 'First fence point:'
        : `Next fence point or [Enter to finish] (${this._points.length} points):`;
    }
    if (this.mode === 'crossing') {
      return this._points.length === 0 ? 'Specify first corner:' : 'Specify opposite corner:';
    }
    return '';
  }

  private reset(): void {
    this.mode = null;
    this._points = [];
    this.onComplete = null;
    this.kernelRef = null;
  }
}
