import type { NexusPlugin, PluginRegistry } from './types';

class PluginRegistryImpl implements PluginRegistry {
  plugins: NexusPlugin[] = [];

  register(plugin: NexusPlugin): void {
    if (this.plugins.some((p) => p.id === plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    this.plugins.push({ ...plugin });
  }

  unregister(id: string): void {
    const idx = this.plugins.findIndex((p) => p.id === id);
    if (idx === -1) {
      throw new Error(`Plugin "${id}" not found`);
    }
    this.plugins.splice(idx, 1);
  }

  getEnabled(): NexusPlugin[] {
    return this.plugins.filter((p) => p.enabled);
  }

  toggle(id: string): void {
    const plugin = this.plugins.find((p) => p.id === id);
    if (!plugin) {
      throw new Error(`Plugin "${id}" not found`);
    }
    plugin.enabled = !plugin.enabled;
  }
}

export const pluginRegistry = new PluginRegistryImpl();
