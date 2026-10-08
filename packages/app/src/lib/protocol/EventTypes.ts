export type EventSource =
  | { type: 'human'; userId?: string }
  | { type: 'agent'; agentId: string; model: string }
  | { type: 'system' };

export interface CommandExecutedEvent {
  commandId: string;
  label: string;
  params?: Record<string, unknown>;
  result: { success: boolean; created_ids?: string[]; error?: string };
  source: EventSource;
  timestamp: number;
  undoGroupId?: string;
}

export interface EventMap {
  'command.executed': CommandExecutedEvent;
  'command.failed': { commandId: string; error: string; source: EventSource };
  'tool.changed': { toolId: string; previousToolId: string };
  'selection.changed': { ids: string[]; previousIds: string[] };
  'viewport.changed': { type: 'zoom' | 'pan' | 'extents' };
  'layer.changed': { layerId: string; change: 'created' | 'deleted' | 'modified' };
  'mode.changed': { mode: string; enabled: boolean };
  'status.updated': { text: string };
  'entities.created': { ids: string[] };
  'entities.modified': { ids: string[] };
  'entities.deleted': { ids: string[] };
}
