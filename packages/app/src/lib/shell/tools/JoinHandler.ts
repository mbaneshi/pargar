import { BaseToolHandler } from '../BaseToolHandler';
import type { MouseHints } from '../types';

export class JoinHandler extends BaseToolHandler {
  readonly id = 'modify_join';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    const ids = ctx.getSelectedIds();
    if (ids.length >= 2) {
      ctx.executeCommand({ type: 'JoinEntities', ids });
      ctx.cancelCurrentTool();
    } else {
      this.setStatus(-1);
    }
  }

  onCoordinateInput(): void {}

  onPointerMove(): void {}

  getPrompt(): string {
    return 'JOIN Select 2+ lines/polylines first';
  }

  getMouseHints(): MouseHints {
    return { left: 'Select', right: 'Cancel' };
  }
}
