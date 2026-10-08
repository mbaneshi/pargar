import type { KernelBridge } from '../kernel-bridge.js';

export function stateTools(kernel: KernelBridge) {
  return [
    {
      name: 'undo',
      description: 'Undo the last operation',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => {
        if (!kernel.canUndo()) return { success: false, error: 'Nothing to undo' };
        kernel.undo();
        return { success: true, entity_count: kernel.entityCount() };
      },
    },
    {
      name: 'redo',
      description: 'Redo the last undone operation',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => {
        if (!kernel.canRedo()) return { success: false, error: 'Nothing to redo' };
        kernel.redo();
        return { success: true, entity_count: kernel.entityCount() };
      },
    },
    {
      name: 'get_layers',
      description: 'Get all layers in the drawing',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => {
        const layers = JSON.parse(kernel.getLayersJson());
        return { count: layers.length, layers };
      },
    },
    {
      name: 'get_drawing_info',
      description: 'Get drawing summary: entity count, layer count, bounds',
      inputSchema: { type: 'object' as const, properties: {} },
      handler: () => {
        const entities = JSON.parse(kernel.getEntitiesJson());
        const layers = JSON.parse(kernel.getLayersJson());
        return {
          entity_count: entities.length,
          layer_count: layers.length,
          can_undo: kernel.canUndo(),
          can_redo: kernel.canRedo(),
        };
      },
    },
  ];
}
