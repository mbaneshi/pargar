import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InteractionShell } from '../InteractionShell.svelte';
import { CommandRegistry } from '../../commands/CommandRegistry';
import type { ToolHandler, ToolContext } from '../ToolHandler';
import type { Vec2, MouseHints, HandleResult } from '../types';

// Minimal mock AppState
function createMockApp() {
  return {
    kernel: null,
    renderer: null,
    statusText: '',
    mouseHints: { left: '', right: '' },
    lastPoint: { x: 0, y: 0 },
    cursorX: 0,
    cursorY: 0,
    snapX: 0,
    snapY: 0,
    hasSnap: false,
    snapType: '',
    snapEnabled: false,
    gridEnabled: true,
    gridSnapEnabled: true,
    orthoMode: false,
    dynInputEnabled: true,
    activeLayerId: 'layer_0',
    layerManagerOpen: false,
    textStyleManagerOpen: false,
    dimStyleManagerOpen: false,
    mleaderStyleManagerOpen: false,
    tableStyleManagerOpen: false,
    drawingPropertiesOpen: false,
    canUndo: false,
    canRedo: false,
    clipboard: [],
    commandHistory: [] as string[],
    projectName: 'test',
    entityCount: 0,
    autoSaveStatus: '',
    tools: { activeTool: null, activeToolId: 'select' },
    selection: {
      getSelectedIds: () => [],
      clear: vi.fn(),
      select: vi.fn(),
      toggle: vi.fn(),
      selectMultiple: vi.fn(),
    },
    executeCommand: vi.fn(() => ({ success: true, created_ids: [] })),
    syncView: vi.fn(),
    pushCommandHistory: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    deleteSelected: vi.fn(),
    copySelected: vi.fn(),
    cutSelected: vi.fn(),
    pasteClipboard: vi.fn(),
    handleSave: vi.fn(),
    getOrthoPoint: (from: Vec2, to: Vec2) => {
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      return dx >= dy ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
    },
    get cursorPoint() {
      return this.hasSnap ? { x: this.snapX, y: this.snapY } : { x: this.cursorX, y: this.cursorY };
    },
  } as any;
}

// Simple test tool handler
class TestToolHandler implements ToolHandler {
  readonly id = 'test_tool';
  private _status = 0;
  points: Vec2[] = [];
  commands: string[] = [];
  activated = false;
  deactivated = false;
  private ctx!: ToolContext;

  get status() {
    return this._status;
  }

  activate(ctx: ToolContext) {
    this.ctx = ctx;
    this._status = 0;
    this.points = [];
    this.activated = true;
  }

  deactivate() {
    this.deactivated = true;
  }

  suspend() {}
  resume() {}

  onCoordinateInput(_status: number, point: Vec2) {
    this.points.push(point);
    this._status = 1;
  }

  onCommandInput(_status: number, command: string): boolean {
    if (command === 'close' && this._status === 1 && this.points.length >= 3) {
      this.commands.push('close');
      this._status = 0;
      this.ctx.cancelCurrentTool();
      return true;
    }
    if (command === 'undo') {
      this.commands.push('undo');
      this.points.pop();
      if (this.points.length === 0) this._status = 0;
      return true;
    }
    return false;
  }

  onKeyDown(_status: number, _key: string): HandleResult {
    return 'PASS_THROUGH';
  }

  onPointerMove() {}

  onRightClick(status: number) {
    if (status > 0) {
      this._status = 0;
    } else {
      this.ctx.cancelCurrentTool();
    }
  }

  getAvailableCommands(): string[] {
    if (this._status === 1 && this.points.length >= 3) return ['Close', 'Undo'];
    if (this._status === 1) return ['Undo'];
    return [];
  }

  getPrompt(): string {
    return this._status === 0 ? 'TEST Specify first point:' : 'TEST Specify next point:';
  }

  getMouseHints(): MouseHints {
    return this._status === 0
      ? { left: 'First point', right: 'Cancel' }
      : { left: 'Next point', right: 'Back' };
  }

  getLastPoint(): Vec2 | null {
    return this.points.length > 0 ? this.points[this.points.length - 1] : null;
  }
}

describe('InteractionShell', () => {
  let shell: InteractionShell;
  let registry: CommandRegistry;
  let app: any;

  beforeEach(() => {
    registry = new CommandRegistry();
    app = createMockApp();
    shell = new InteractionShell({ commandRegistry: registry, app });
  });

  it('starts in IDLE mode', () => {
    expect(shell.mode).toBe('IDLE');
    expect(shell.activeToolId).toBeNull();
    expect(shell.prompt).toBe('Command:');
  });

  it('COMMAND_TEXT with tool name → TOOL_ACTIVE', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.mode).toBe('TOOL_ACTIVE');
    expect(shell.activeToolId).toBe('tt');
  });

  it('Escape during TOOL_ACTIVE → IDLE', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.mode).toBe('TOOL_ACTIVE');

    shell.handleInput({
      type: 'KEY_DOWN',
      key: 'Escape',
      code: 'Escape',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(shell.mode).toBe('IDLE');
    expect(shell.activeToolId).toBeNull();
  });

  it('tool sub-command "close" is claimed by tool, not global', () => {
    const testHandler = new TestToolHandler();
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => testHandler,
    });

    // Also register a "close" command globally
    registry.register({
      id: 'close_cmd',
      label: 'Close File',
      aliases: ['close'],
      category: 'edit',
      execute: vi.fn(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.mode).toBe('TOOL_ACTIVE');

    // Feed 3 points so "close" becomes available
    shell.handleInput({ type: 'COORDINATE', point: { x: 0, y: 0 } });
    shell.handleInput({ type: 'COORDINATE', point: { x: 10, y: 0 } });
    shell.handleInput({ type: 'COORDINATE', point: { x: 10, y: 10 } });

    // Now type "close" — should be handled by tool, NOT global
    shell.handleInput({ type: 'COMMAND_TEXT', text: 'close' });

    // Tool should have handled it (and cancelled itself)
    const closeCmd = registry.resolve('close_cmd');
    expect(closeCmd?.execute).not.toHaveBeenCalled();
  });

  it('coordinate input feeds to active tool', () => {
    const testHandler = new TestToolHandler();
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => testHandler,
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    shell.handleInput({ type: 'COORDINATE', point: { x: 5, y: 10 } });

    const handler = shell.getActiveHandler() as TestToolHandler;
    expect(handler.points).toEqual([{ x: 5, y: 10 }]);
    expect(handler.status).toBe(1);
  });

  it('POINTER_DOWN left click feeds coordinate to tool', () => {
    const testHandler = new TestToolHandler();
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => testHandler,
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    shell.handleInput({
      type: 'POINTER_DOWN',
      point: { x: 20, y: 30 },
      worldX: 20,
      worldY: 30,
      button: 'left',
      shiftKey: false,
      ctrlKey: false,
    });

    const handler = shell.getActiveHandler() as TestToolHandler;
    expect(handler.points).toEqual([{ x: 20, y: 30 }]);
  });

  it('right click at status 0 cancels tool', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.mode).toBe('TOOL_ACTIVE');

    shell.handleInput({
      type: 'POINTER_DOWN',
      point: { x: 0, y: 0 },
      worldX: 0,
      worldY: 0,
      button: 'right',
      shiftKey: false,
      ctrlKey: false,
    });

    expect(shell.mode).toBe('IDLE');
  });

  it('selection click in IDLE selects entity', () => {
    app.renderer = {
      hitTest: vi.fn(() => 'entity_1'),
      selectionManager: {
        clear: vi.fn(),
        select: vi.fn(),
        getSelectedIds: vi.fn(() => []),
      },
      updateSelection: vi.fn(),
      markDirty: vi.fn(),
    };

    shell.handleInput({
      type: 'POINTER_DOWN',
      point: { x: 10, y: 10 },
      worldX: 10,
      worldY: 10,
      button: 'left',
      shiftKey: false,
      ctrlKey: false,
    });

    expect(shell.selection.has('entity_1')).toBe(true);
    expect(shell.selection.count).toBe(1);
  });

  it('click on empty deselects all', () => {
    app.renderer = {
      hitTest: vi.fn(() => null),
      getGripAtPoint: vi.fn(() => null),
      selectionManager: {
        clear: vi.fn(),
        select: vi.fn(),
        getSelectedIds: vi.fn(() => []),
      },
      updateSelection: vi.fn(),
      markDirty: vi.fn(),
    };

    shell.selection.select('e1');
    expect(shell.selection.count).toBe(1);

    shell.handleInput({
      type: 'POINTER_DOWN',
      point: { x: 100, y: 100 },
      worldX: 100,
      worldY: 100,
      button: 'left',
      shiftKey: false,
      ctrlKey: false,
    });

    expect(shell.selection.isEmpty()).toBe(true);
  });

  it('Ctrl+Z triggers undo', () => {
    shell.handleInput({
      type: 'KEY_DOWN',
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });
    expect(app.undo).toHaveBeenCalled();
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    shell.handleInput({
      type: 'KEY_DOWN',
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
    });
    expect(app.redo).toHaveBeenCalled();
  });

  it('Delete key deletes selected entities', () => {
    shell.selection.select('e1');

    shell.handleInput({
      type: 'KEY_DOWN',
      key: 'Delete',
      code: 'Delete',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    });

    expect(app.executeCommand).toHaveBeenCalledWith({ type: 'DeleteEntity', id: 'e1' });
    expect(shell.selection.isEmpty()).toBe(true);
  });

  it('DRAG_END in IDLE triggers rect selection', () => {
    const selectByRectIds = ['e1', 'e2'];
    app.renderer = {
      selectByRect: vi.fn(() => selectByRectIds),
      selectionManager: {
        clear: vi.fn(),
        select: vi.fn(),
        getSelectedIds: vi.fn(() => []),
      },
      updateSelection: vi.fn(),
      markDirty: vi.fn(),
    };
    shell.updateDeps();

    shell.handleInput({
      type: 'DRAG_END',
      start: { x: 0, y: 0 },
      end: { x: 50, y: 50 },
    });

    expect(shell.selection.count).toBe(2);
  });

  it('prompt updates when tool activates', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    expect(shell.prompt).toBe('Command:');
    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.prompt).toBe('TEST Specify first point:');
  });

  it('availableCommands updates with tool state', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.availableCommands).toEqual([]);

    // After first point, "Undo" becomes available
    shell.handleInput({ type: 'COORDINATE', point: { x: 0, y: 0 } });
    expect(shell.availableCommands).toContain('Undo');
  });

  it('executeCommand works for AI agents', () => {
    const executeFn = vi.fn();
    registry.register({
      id: 'draw_line',
      label: 'Line',
      aliases: ['line'],
      category: 'draw',
      execute: executeFn,
    });

    const result = shell.executeCommand('draw_line', { x1: 0, y1: 0, x2: 10, y2: 5 });
    expect(result.success).toBe(true);
    expect(executeFn).toHaveBeenCalledWith({ x1: 0, y1: 0, x2: 10, y2: 5 });
  });

  it('unknown command returns error', () => {
    const result = shell.executeCommand('nonexistent', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('nonexistent');
  });

  // --- Phase 4: Command execute/invoke split ---

  it('execute() returns result from CommandDef', () => {
    registry.register({
      id: 'draw_line',
      label: 'Line',
      aliases: ['line'],
      category: 'draw',
      execute: () => ({ success: true, created_ids: ['id_1'] }),
    });

    const result = shell.executeCommand('draw_line', { x1: 0, y1: 0, x2: 10, y2: 0 });
    expect(result.success).toBe(true);
    expect(result.created_ids).toEqual(['id_1']);
  });

  it('transparent flag is accessible on CommandDef', () => {
    registry.register({
      id: 'zoom_in',
      label: 'Zoom In',
      aliases: ['zi'],
      category: 'view',
      transparent: true,
      execute: vi.fn(),
    });

    const cmd = registry.resolve('zoom_in');
    expect(cmd?.transparent).toBe(true);
  });

  // --- Phase 6: Transparent commands ---

  it('transparent command during tool does not cancel tool', () => {
    const zoomFn = vi.fn();
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });
    registry.register({
      id: 'zoom_in',
      label: 'Zoom In',
      aliases: ['zi'],
      category: 'view',
      transparent: true,
      execute: zoomFn,
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    expect(shell.mode).toBe('TOOL_ACTIVE');

    // Execute transparent command
    shell.handleInput({ type: 'COMMAND_TEXT', text: 'zi' });

    // Tool should still be active
    expect(shell.mode).toBe('TOOL_ACTIVE');
    expect(shell.getActiveHandler()).not.toBeNull();
    expect(zoomFn).toHaveBeenCalled();
  });

  it('transparent command in IDLE just executes normally', () => {
    const zoomFn = vi.fn();
    registry.register({
      id: 'zoom_in',
      label: 'Zoom In',
      aliases: ['zi'],
      category: 'view',
      transparent: true,
      execute: zoomFn,
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'zi' });
    expect(zoomFn).toHaveBeenCalled();
    expect(shell.mode).toBe('IDLE');
  });

  // --- Phase 7: Context menu ---

  it('getContextMenuItems returns tool sub-commands when tool active', () => {
    registry.register({
      id: 'test_tool',
      label: 'Test',
      aliases: ['tt'],
      category: 'draw',
      execute: () => {},
      invoke: () => new TestToolHandler(),
    });

    shell.handleInput({ type: 'COMMAND_TEXT', text: 'tt' });
    shell.handleInput({ type: 'COORDINATE', point: { x: 0, y: 0 } });
    shell.handleInput({ type: 'COORDINATE', point: { x: 10, y: 0 } });
    shell.handleInput({ type: 'COORDINATE', point: { x: 10, y: 10 } });

    const items = shell.getContextMenuItems();
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Close');
    expect(labels).toContain('Undo');
    expect(labels).toContain('Cancel');
  });

  it('getContextMenuItems returns edit commands when selection exists', () => {
    shell.selection.select('e1');
    const items = shell.getContextMenuItems();
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Move');
    expect(labels).toContain('Copy');
    expect(labels).toContain('Delete');
  });

  it('getContextMenuItems returns general commands when idle + no selection', () => {
    const items = shell.getContextMenuItems();
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Undo');
    expect(labels).toContain('Redo');
    expect(labels).toContain('Zoom Extents');
    expect(labels).toContain('Select All');
  });

  // --- Phase 7: Selection gates ---

  it('selection gate blocks selection of locked entities', () => {
    shell.selection.installGate({
      canSelect: (id: string) => id !== 'locked_entity',
      reason: 'Entity is on a locked layer',
    });

    shell.selection.select('locked_entity');
    expect(shell.selection.has('locked_entity')).toBe(false);

    shell.selection.select('unlocked_entity');
    expect(shell.selection.has('unlocked_entity')).toBe(true);
  });

  it('removing gate allows selection again', () => {
    shell.selection.installGate({
      canSelect: (id: string) => id !== 'locked_entity',
      reason: 'Entity is on a locked layer',
    });

    shell.selection.select('locked_entity');
    expect(shell.selection.has('locked_entity')).toBe(false);

    shell.selection.removeGate();
    shell.selection.select('locked_entity');
    expect(shell.selection.has('locked_entity')).toBe(true);
  });
});
