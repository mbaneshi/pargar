import type { KernelBridge } from '../kernel-bridge.js';

export function editTools(kernel: KernelBridge) {
  return [
    {
      name: 'move_entities',
      description: 'Move entities by displacement',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to move' },
          dx: { type: 'number', description: 'X displacement' },
          dy: { type: 'number', description: 'Y displacement' },
        },
        required: ['ids', 'dx', 'dy'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const results = ids.map((id) =>
          kernel.executeCommand({ type: 'MoveEntity', id, dx: params.dx, dy: params.dy }),
        );
        return { success: results.every((r) => r.success), moved: ids.length };
      },
    },
    {
      name: 'copy_entities',
      description: 'Copy entities with displacement',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to copy' },
          dx: { type: 'number', description: 'X displacement' },
          dy: { type: 'number', description: 'Y displacement' },
        },
        required: ['ids', 'dx', 'dy'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const created: string[] = [];
        for (const id of ids) {
          const r = kernel.executeCommand({ type: 'CopyEntity', id });
          if (r.success && r.created_ids[0]) {
            kernel.executeCommand({
              type: 'MoveEntity',
              id: r.created_ids[0],
              dx: params.dx,
              dy: params.dy,
            });
            created.push(r.created_ids[0]);
          }
        }
        return { success: true, created_ids: created };
      },
    },
    {
      name: 'rotate_entities',
      description: 'Rotate entities around a center point',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
          cx: { type: 'number', description: 'Center X' },
          cy: { type: 'number', description: 'Center Y' },
          angle: { type: 'number', description: 'Rotation angle (radians)' },
        },
        required: ['ids', 'cx', 'cy', 'angle'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const results = ids.map((id) =>
          kernel.executeCommand({
            type: 'RotateEntity',
            id,
            cx: params.cx,
            cy: params.cy,
            angle: params.angle,
          }),
        );
        return { success: results.every((r) => r.success) };
      },
    },
    {
      name: 'scale_entities',
      description: 'Scale entities from a base point',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
          cx: { type: 'number', description: 'Base point X' },
          cy: { type: 'number', description: 'Base point Y' },
          factor: { type: 'number', description: 'Scale factor' },
        },
        required: ['ids', 'cx', 'cy', 'factor'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const results = ids.map((id) =>
          kernel.executeCommand({
            type: 'ScaleEntity',
            id,
            cx: params.cx,
            cy: params.cy,
            factor: params.factor,
          }),
        );
        return { success: results.every((r) => r.success) };
      },
    },
    {
      name: 'mirror_entities',
      description: 'Mirror entities across a line',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
          x1: { type: 'number', description: 'Mirror line point 1 X' },
          y1: { type: 'number', description: 'Mirror line point 1 Y' },
          x2: { type: 'number', description: 'Mirror line point 2 X' },
          y2: { type: 'number', description: 'Mirror line point 2 Y' },
        },
        required: ['ids', 'x1', 'y1', 'x2', 'y2'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const created: string[] = [];
        for (const id of ids) {
          const r = kernel.executeCommand({
            type: 'MirrorEntity',
            id,
            x1: params.x1,
            y1: params.y1,
            x2: params.x2,
            y2: params.y2,
          });
          if (r.success) created.push(...r.created_ids);
        }
        return { success: true, created_ids: created };
      },
    },
    {
      name: 'delete_entities',
      description: 'Delete entities by ID',
      inputSchema: {
        type: 'object' as const,
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to delete' },
        },
        required: ['ids'],
      },
      handler: (params: Record<string, unknown>) => {
        const ids = params.ids as string[];
        const results = ids.map((id) => kernel.executeCommand({ type: 'DeleteEntity', id }));
        return { success: results.every((r) => r.success), deleted: ids.length };
      },
    },
  ];
}
