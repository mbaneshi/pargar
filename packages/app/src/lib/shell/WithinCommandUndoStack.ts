export class WithinCommandUndoStack {
  private stack: { commandType: string; entityIds: string[] }[] = [];

  push(commandType: string, entityIds: string[]): void {
    this.stack.push({ commandType, entityIds });
  }

  pop(): { commandType: string; entityIds: string[] } | null {
    return this.stack.pop() ?? null;
  }

  clear(): void {
    this.stack = [];
  }

  get depth(): number {
    return this.stack.length;
  }
}
