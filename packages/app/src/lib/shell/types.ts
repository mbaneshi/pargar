export interface Vec2 {
  x: number;
  y: number;
}

export interface MouseHints {
  left: string;
  right: string;
}

export type HandleResult = 'HANDLED' | 'PASS_THROUGH';

export interface PreviewEntity {
  type: 'line' | 'circle' | 'arc' | 'rectangle' | 'polyline';
  data: Record<string, unknown>;
}
