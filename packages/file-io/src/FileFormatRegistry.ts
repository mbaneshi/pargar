import type { FileFormatAdapter } from '@nexus/core';

export class FileFormatRegistry {
  private adapters = new Map<string, FileFormatAdapter>();

  register(adapter: FileFormatAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Adapter already registered: ${adapter.id}`);
    }
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): FileFormatAdapter | undefined {
    return this.adapters.get(id);
  }

  getByExtension(ext: string): FileFormatAdapter | undefined {
    const normalized = ext.startsWith('.') ? ext.slice(1).toLowerCase() : ext.toLowerCase();
    for (const adapter of this.adapters.values()) {
      if (adapter.extensions.includes(normalized)) {
        return adapter;
      }
    }
    return undefined;
  }

  list(): FileFormatAdapter[] {
    return Array.from(this.adapters.values());
  }

  listImporters(): FileFormatAdapter[] {
    return this.list().filter((a) => a.capabilities.import);
  }

  listExporters(): FileFormatAdapter[] {
    return this.list().filter((a) => a.capabilities.export);
  }

  unregister(id: string): boolean {
    return this.adapters.delete(id);
  }
}
