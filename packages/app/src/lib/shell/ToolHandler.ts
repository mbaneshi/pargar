import type { Vec2, MouseHints, HandleResult, PreviewEntity } from './types';
import type { CadRenderer } from '@nexus/renderer';

export interface ToolContext {
  executeCommand: (cmd: object) => { success: boolean; created_ids: string[] };
  activeLayerId: string;
  renderer: CadRenderer;
  lastPoint: Vec2;
  undo: () => void;
  cancelCurrentTool: () => void;
  getSelectedIds: () => string[];
  getSysvar: (name: string) => number;
  setSysvar: (name: string, value: number) => void;
  lastModifiers: { shift: boolean; ctrl: boolean };
}

export interface ToolHandler {
  readonly id: string;
  readonly status: number;

  activate(ctx: ToolContext): void;
  deactivate(): void;
  suspend(): void;
  resume(): void;

  onCoordinateInput(status: number, point: Vec2): void;
  onCommandInput(status: number, command: string): boolean;
  onKeyDown(status: number, key: string, event?: KeyboardEvent): HandleResult;
  onPointerMove(status: number, point: Vec2, worldX: number, worldY: number): void;
  onRightClick(status: number): void;

  getAvailableCommands(): string[];
  getPrompt(): string;
  getMouseHints(): MouseHints;
  getLastPoint(): Vec2 | null;
  getPreviewGeometry?(): PreviewEntity[];
  getPreviewCommand?(cursorPoint: Vec2): object | object[] | null;
}
