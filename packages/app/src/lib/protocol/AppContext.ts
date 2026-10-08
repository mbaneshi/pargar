import type { EventBus } from './EventBus';
import type { NexusKernel } from '../types/kernel';
import type { CadRenderer } from '@nexus/renderer';

export interface Point2D {
  x: number;
  y: number;
}

export interface CommandResult {
  success: boolean;
  created_ids: string[];
  error?: string;
  measurement?: { distance?: number; area?: number; angle?: number };
  warnings?: string[];
}

export interface LayerInfo {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

export interface AppContext {
  executeCommand(cmd: object): Promise<CommandResult>;
  syncView(): void;

  readonly kernel: NexusKernel;
  readonly renderer: CadRenderer;
  readonly cursorPoint: Point2D;
  readonly orthoMode: boolean;
  readonly snapEnabled: boolean;
  readonly activeLayerId: string;
  readonly lastPoint: Point2D;

  getOrthoPoint(from: Point2D, to: Point2D): Point2D;
  getLayers(): LayerInfo[];

  readonly selectedIds: ReadonlySet<string>;
  clearSelection(): void;
  toggleSelection(id: string): void;

  setStatusText(text: string): void;
  readonly eventBus: EventBus;
}
