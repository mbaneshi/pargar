import { BaseToolHandler } from '../BaseToolHandler';
import type { MouseHints } from '../types';

export class DeleteHandler extends BaseToolHandler {
  readonly id = 'modify_delete';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    const ids = ctx.getSelectedIds();
    if (ids.length > 0) {
      for (const id of ids) {
        ctx.executeCommand({ type: 'DeleteEntity', id });
      }
      ctx.cancelCurrentTool();
    } else {
      this.setStatus(-1);
    }
  }

  onCoordinateInput(): void {}

  onPointerMove(): void {}

  getPrompt(): string {
    return 'DELETE Select entities first';
  }

  getMouseHints(): MouseHints {
    return { left: 'Select', right: 'Cancel' };
  }
}
