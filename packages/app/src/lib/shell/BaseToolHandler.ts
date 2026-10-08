import type { ToolHandler, ToolContext } from './ToolHandler';
import type { Vec2, MouseHints, HandleResult, PreviewEntity } from './types';
import { WithinCommandUndoStack } from './WithinCommandUndoStack';
import { BatchPickHelper } from './BatchPickHelper';

interface KeywordEntry {
  display: string;
  match: string[];
  action: () => void;
}

export abstract class BaseToolHandler implements ToolHandler {
  abstract readonly id: string;
  protected _status = 0;
  protected points: Vec2[] = [];
  protected ctx!: ToolContext;
  private _keywords: Map<number, KeywordEntry[]> = new Map();
  protected undoStack = new WithinCommandUndoStack();
  protected batchPicker = new BatchPickHelper();

  pickMode = false;

  protected enterPickMode(): void {
    this.pickMode = true;
  }

  protected exitPickMode(): void {
    this.pickMode = false;
  }

  handlePickDragSelect?(ids: string[]): void;

  get status(): number {
    return this._status;
  }

  activate(ctx: ToolContext): void {
    this.ctx = ctx;
    this._status = 0;
    this.points = [];
    this._keywords.clear();
  }

  deactivate(): void {
    this.undoStack.clear();
    this.batchPicker.cancel();
    this.ctx?.renderer?.clearPreview();
  }

  suspend(): void {}
  resume(): void {}

  abstract onCoordinateInput(status: number, point: Vec2): void;
  abstract onPointerMove(status: number, point: Vec2, worldX: number, worldY: number): void;
  abstract getPrompt(): string;
  abstract getMouseHints(): MouseHints;

  onRightClick(status: number): void {
    if (status > 0) {
      this._status = status - 1;
    } else {
      this.ctx.cancelCurrentTool();
    }
  }

  onEscape(): HandleResult {
    this.ctx?.renderer?.clearPreview();
    if (this._status > 0) {
      this._status = 0;
      this.points = [];
      return 'HANDLED';
    }
    this.ctx.cancelCurrentTool();
    return 'HANDLED';
  }

  onKeyDown(_status: number, key: string, _event?: KeyboardEvent): HandleResult {
    if (key === 'Escape') return this.onEscape();
    return 'PASS_THROUGH';
  }

  onCommandInput(_status: number, command: string): boolean {
    return this.tryKeyword(this._status, command);
  }

  getAvailableCommands(): string[] {
    const entries = this._keywords.get(this._status);
    return entries?.map((e) => e.display) ?? [];
  }

  getLastPoint(): Vec2 | null {
    return this.points.length > 0 ? this.points[this.points.length - 1] : null;
  }

  getPreviewGeometry(): PreviewEntity[] {
    return [];
  }

  protected setStatus(status: number): void {
    this._status = status;
  }

  /** Auto-generate "[Option1/Option2/...]" from registered keywords for current status. */
  protected getKeywordBrackets(status?: number): string {
    const entries = this._keywords.get(status ?? this._status);
    if (!entries?.length) return '';
    return ' [' + entries.map((e) => e.display).join('/') + ']';
  }

  /**
   * Register a keyword option for a given handler state.
   * @param status - The handler status this keyword is valid in
   * @param display - Display name shown in prompt brackets and autocomplete (e.g. "Through")
   * @param match - All strings that trigger this keyword (e.g. ["t", "through"])
   * @param action - Callback to execute when the keyword is matched
   */
  protected registerKeyword(
    status: number,
    display: string,
    match: string[],
    action: () => void,
  ): void {
    if (!this._keywords.has(status)) this._keywords.set(status, []);
    this._keywords.get(status)!.push({ display, match: match.map((m) => m.toLowerCase()), action });
  }

  /**
   * Try matching input against registered keywords for the given status.
   * Returns true if a keyword matched and its action was executed.
   */
  protected tryKeyword(status: number, input: string): boolean {
    const entries = this._keywords.get(status);
    if (!entries) return false;
    const lower = input.toLowerCase();
    for (const entry of entries) {
      if (entry.match.includes(lower)) {
        entry.action();
        return true;
      }
    }
    return false;
  }
}
