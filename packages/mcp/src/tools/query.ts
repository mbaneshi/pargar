import type { KernelBridge } from '../kernel-bridge.js';

export function queryTools(kernel: KernelBridge) {
  return [
    {
      name: 'get_entities',
      description:
        'Get all entities in the drawing. Returns JSON array of entities with id, geometry, layer_id, style.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
      },
      handler: () => {
        const json = kernel.getEntitiesJson();
        const entities = JSON.parse(json);
        return { count: entities.length, entities };
      },
    },
    {
      name: 'get_entity',
      description: 'Get a single entity by ID',
      inputSchema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', description: 'Entity ID' },
        },
        required: ['id'],
      },
      handler: (params: Record<string, unknown>) => {
        const entities = JSON.parse(kernel.getEntitiesJson());
        const entity = entities.find((e: { id: string }) => e.id === params.id);
        return entity ?? { error: `Entity ${params.id} not found` };
      },
    },
    {
      name: 'measure_distance',
      description: 'Measure distance between two points',
      inputSchema: {
        type: 'object' as const,
        properties: {
          x1: { type: 'number', description: 'Point 1 X' },
          y1: { type: 'number', description: 'Point 1 Y' },
          x2: { type: 'number', description: 'Point 2 X' },
          y2: { type: 'number', description: 'Point 2 Y' },
        },
        required: ['x1', 'y1', 'x2', 'y2'],
      },
      handler: (params: Record<string, unknown>) => {
        const result = kernel.executeCommand({
          type: 'MeasureDistance',
          x1: params.x1,
          y1: params.y1,
          x2: params.x2,
          y2: params.y2,
        });
        return { distance: result.measurement, ...result };
      },
    },
    {
      name: 'measure_area',
      description: 'Measure the area of a closed entity',
      inputSchema: {
        type: 'object' as const,
        properties: {
          entity_id: { type: 'string', description: 'Entity ID to measure' },
        },
        required: ['entity_id'],
      },
      handler: (params: Record<string, unknown>) => {
        const result = kernel.executeCommand({
          type: 'MeasureArea',
          entity_id: params.entity_id,
        });
        return { area: result.measurement, ...result };
      },
    },
  ];
}
