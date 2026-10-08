export interface NexusPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  commands?: Array<{
    id: string;
    label: string;
    execute: () => void;
  }>;
  ribbonItems?: Array<{
    tab: string;
    panel: string;
    items: Array<{ label: string; commandId: string }>;
  }>;
}

export interface PluginRegistry {
  plugins: NexusPlugin[];
  register(plugin: NexusPlugin): void;
  unregister(id: string): void;
  getEnabled(): NexusPlugin[];
  toggle(id: string): void;
}
