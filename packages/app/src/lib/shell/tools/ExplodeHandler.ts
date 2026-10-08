import { BaseToolHandler } from '../BaseToolHandler';
import type { MouseHints } from '../types';

export class ExplodeHandler extends BaseToolHandler {
  readonly id = 'modify_explode';

  activate(ctx: import('../ToolHandler').ToolContext): void {
    super.activate(ctx);
    const ids = ctx.getSelectedIds();
    if (ids.length > 0) {
      for (const id of ids) {
        ctx.executeCommand({ type: 'Explode', entity_id: id });
      }
      ctx.cancelCurrentTool();
    } else {
      this.setStatus(-1);
    }
  }

  onCoordinateInput(): void {}

  onPointerMove(): void {}

  getPrompt(): string {
    return 'EXPLODE Select entities first';
  }

  getMouseHints(): MouseHints {
    return { left: 'Select', right: 'Cancel' };
  }
}
