import type { ToolContext } from '../../ToolHandler';

export interface MockToolContext extends ToolContext {
  commands: object[];
  cancelled: boolean;
  selectedIds: string[];
  hitTestResult: string | null;
}

export function createMockContext(overrides?: Partial<MockToolContext>): MockToolContext {
  const ctx: MockToolContext = {
    commands: [],
    cancelled: false,
    selectedIds: [],
    hitTestResult: null,
    activeLayerId: 'default',
    renderer: {
      setPreview: () => {},
      clearPreview: () => {},
      hitTest: () => ctx.hitTestResult,
      getEntityById: () => null,
    },
    lastPoint: { x: 0, y: 0 },
    executeCommand: (cmd: object) => {
      ctx.commands.push(cmd);
      return { success: true, created_ids: [`id_${ctx.commands.length}`] };
    },
    undo: () => {
      ctx.commands.pop();
    },
    cancelCurrentTool: () => {
      ctx.cancelled = true;
    },
    getSelectedIds: () => ctx.selectedIds,
    getSysvar: () => 0,
    setSysvar: () => {},
    lastModifiers: { shift: false, ctrl: false },
    ...overrides,
  };
  return ctx;
}
