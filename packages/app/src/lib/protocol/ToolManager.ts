import type { CommandDef } from './CommandDef';

export interface ToolManagerConfig {
  getCommandDef: (id: string) => CommandDef | undefined;
  resolveAlias: (input: string) => CommandDef | undefined;
}

export class ToolManager {
  private _activeToolId: string | null = null;
  private config: ToolManagerConfig;

  constructor(config: ToolManagerConfig) {
    this.config = config;
  }

  get activeToolId(): string | null {
    return this._activeToolId;
  }

  setTool(idOrAlias: string): boolean {
    const def = this.config.resolveAlias(idOrAlias);
    if (!def) return false;
    this._activeToolId = idOrAlias;
    return true;
  }

  clearTool(): void {
    this._activeToolId = null;
  }

  isToolActive(id: string): boolean {
    return this._activeToolId === id;
  }

  getActiveDef(): CommandDef | undefined {
    if (!this._activeToolId) return undefined;
    return this.config.resolveAlias(this._activeToolId);
  }
}
