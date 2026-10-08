import type { ToolHandler } from '../../ToolHandler';
import { createMockContext, type MockToolContext } from './mockToolContext';

export function setupHandler<T extends ToolHandler>(
  HandlerClass: new () => T,
  overrides?: Partial<MockToolContext>,
): { handler: T; ctx: MockToolContext } {
  const ctx = createMockContext(overrides);
  const handler = new HandlerClass();
  handler.activate(ctx);
  return { handler, ctx };
}

export function inputPoint(handler: ToolHandler, x: number, y: number): void {
  handler.onCoordinateInput(handler.status, { x, y });
}

export function inputCommand(handler: ToolHandler, cmd: string): boolean {
  return handler.onCommandInput(handler.status, cmd);
}

export function pressEscape(handler: ToolHandler): void {
  handler.onKeyDown(handler.status, 'Escape');
}

export function rightClick(handler: ToolHandler): void {
  handler.onRightClick(handler.status);
}

export function lastCommand(ctx: MockToolContext): object {
  return ctx.commands[ctx.commands.length - 1];
}
