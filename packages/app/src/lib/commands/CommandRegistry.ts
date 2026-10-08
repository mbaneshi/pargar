import type { ToolHandler } from '../shell/ToolHandler';
import { createLogger } from '@nexus/logger';

const log = createLogger('app:commands');

export type CommandResult = { success: boolean; created_ids: string[]; error?: string };

export interface CommandDef {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  aliases: string[];
  category: 'draw' | 'modify' | 'annotate' | 'view' | 'edit' | 'select';
  isActive?: () => boolean;
  execute: (params: Record<string, unknown>) => CommandResult | void;
  invoke?: () => ToolHandler;
  schema?: object;
  transparent?: boolean;
}

export class CommandRegistry {
  private commands = new Map<string, CommandDef>();
  private aliases = new Map<string, string>();

  register(def: CommandDef): void {
    this.commands.set(def.id, def);
    for (const alias of def.aliases) {
      this.aliases.set(alias.toLowerCase(), def.id);
    }
  }

  get(idOrAlias: string): CommandDef | undefined {
    const lower = idOrAlias.toLowerCase();
    const direct = this.commands.get(lower);
    if (direct) return direct;
    const resolved = this.aliases.get(lower);
    if (resolved) return this.commands.get(resolved);
    return undefined;
  }

  getByCategory(category: string): CommandDef[] {
    const result: CommandDef[] = [];
    for (const def of this.commands.values()) {
      if (def.category === category) result.push(def);
    }
    return result;
  }

  getAll(): CommandDef[] {
    return Array.from(this.commands.values());
  }

  resolve(input: string): CommandDef | undefined {
    const lower = input.toLowerCase().trim();
    const byId = this.commands.get(lower);
    if (byId) {
      log.debug('command resolved by id', { input: lower, command: byId.id });
      return byId;
    }
    const byAlias = this.aliases.get(lower);
    if (byAlias) {
      const def = this.commands.get(byAlias);
      log.debug('command resolved by alias', { input: lower, alias: byAlias, command: def?.id });
      return def;
    }
    log.warn('command not found', { input: lower });
    return undefined;
  }

  /** Get the canonical (longest) alias for a command, used for activeToolId */
  canonicalAlias(idOrAlias: string): string {
    const def = this.resolve(idOrAlias);
    if (!def) return idOrAlias;
    // Return the longest alias — this matches what Toolbar uses (e.g. 'line', 'circle')
    return def.aliases.reduce((a, b) => (b.length > a.length ? b : a), def.aliases[0] ?? def.id);
  }

  getShortcutLabel(id: string): string {
    const def = this.commands.get(id);
    if (!def || def.aliases.length === 0) return '';
    return def.aliases.reduce((a, b) => (a.length <= b.length ? a : b)).toUpperCase();
  }

  getAllAliases(): string[] {
    const result: string[] = [];
    for (const def of this.commands.values()) {
      result.push(def.id);
      result.push(...def.aliases);
    }
    return result;
  }
}

export const commandRegistry = new CommandRegistry();
