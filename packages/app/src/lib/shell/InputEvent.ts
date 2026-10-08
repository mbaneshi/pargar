import type { Vec2 } from './types';

export type InputEvent =
  | {
      type: 'POINTER_DOWN';
      point: Vec2;
      worldX: number;
      worldY: number;
      button: 'left' | 'right' | 'middle';
      shiftKey: boolean;
      ctrlKey: boolean;
      raw?: PointerEvent;
    }
  | {
      type: 'POINTER_MOVE';
      point: Vec2;
      worldX: number;
      worldY: number;
      raw?: PointerEvent;
    }
  | {
      type: 'POINTER_UP';
      point: Vec2;
      worldX: number;
      worldY: number;
      button: 'left' | 'right' | 'middle';
      raw?: PointerEvent;
    }
  | { type: 'DRAG_START'; point: Vec2; worldX: number; worldY: number }
  | { type: 'DRAG_MOVE'; point: Vec2; worldX: number; worldY: number }
  | { type: 'DRAG_END'; start: Vec2; end: Vec2 }
  | {
      type: 'KEY_DOWN';
      key: string;
      code: string;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      metaKey: boolean;
      raw?: KeyboardEvent;
    }
  | { type: 'KEY_UP'; key: string; code: string; raw?: KeyboardEvent }
  | { type: 'COMMAND_TEXT'; text: string }
  | { type: 'COORDINATE'; point: Vec2 }
  | {
      type: 'WHEEL';
      deltaY: number;
      worldX: number;
      worldY: number;
      raw?: WheelEvent;
    };
