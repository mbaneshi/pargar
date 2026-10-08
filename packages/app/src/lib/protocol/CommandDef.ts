import type { AppContext } from './AppContext';

export interface CommandDef {
  id: string;
  label: string;
  icon?: string;
  aliases: string[];
  category:
    | 'draw'
    | 'edit'
    | 'modify'
    | 'annotate'
    | 'view'
    | 'constrain'
    | 'layer'
    | 'select'
    | 'ui'
    | 'file';

  execute(ctx: AppContext, params?: Record<string, unknown>): Promise<void>;
  isAvailable?: (ctx: AppContext) => boolean;
  schema?: object;
}
