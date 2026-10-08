import type { KernelBridge } from '../kernel-bridge.js';

export function drawTools(kernel: KernelBridge) {
  return [
    {
      name: 'draw_line',
      description: 'Draw a line between two points',
      inputSchema: {
        type: 'object' as const,
        properties: {
          x1: { type: 'number', description: 'Start X' },
          y1: { type: 'number', description: 'Start Y' },
          x2: { type: 'number', description: 'End X' },
          y2: { type: 'number', description: 'End Y' },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['x1', 'y1', 'x2', 'y2'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreateLine',
          x1: params.x1,
          y1: params.y1,
          x2: params.x2,
          y2: params.y2,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_circle',
      description: 'Draw a circle with center and radius',
      inputSchema: {
        type: 'object' as const,
        properties: {
          cx: { type: 'number', description: 'Center X' },
          cy: { type: 'number', description: 'Center Y' },
          radius: { type: 'number', description: 'Radius' },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['cx', 'cy', 'radius'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreateCircle',
          cx: params.cx,
          cy: params.cy,
          radius: params.radius,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_rectangle',
      description: 'Draw a rectangle from origin with width and height',
      inputSchema: {
        type: 'object' as const,
        properties: {
          x: { type: 'number', description: 'Origin X' },
          y: { type: 'number', description: 'Origin Y' },
          width: { type: 'number', description: 'Width' },
          height: { type: 'number', description: 'Height' },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['x', 'y', 'width', 'height'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreateRectangle',
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_arc',
      description: 'Draw an arc with center, radius, and angles',
      inputSchema: {
        type: 'object' as const,
        properties: {
          cx: { type: 'number', description: 'Center X' },
          cy: { type: 'number', description: 'Center Y' },
          radius: { type: 'number', description: 'Radius' },
          start_angle: { type: 'number', description: 'Start angle (radians)' },
          end_angle: { type: 'number', description: 'End angle (radians)' },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['cx', 'cy', 'radius', 'start_angle', 'end_angle'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreateArc',
          cx: params.cx,
          cy: params.cy,
          radius: params.radius,
          start_angle: params.start_angle,
          end_angle: params.end_angle,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_polyline',
      description: 'Draw a polyline through a series of points',
      inputSchema: {
        type: 'object' as const,
        properties: {
          vertices: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
            description: 'Array of [x, y] coordinate pairs',
          },
          closed: { type: 'boolean', description: 'Close the polyline', default: false },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['vertices'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreatePolyline',
          vertices: params.vertices,
          closed: params.closed ?? false,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_point',
      description: 'Draw a point at coordinates',
      inputSchema: {
        type: 'object' as const,
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['x', 'y'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreatePoint',
          x: params.x,
          y: params.y,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
    {
      name: 'draw_text',
      description: 'Place text at a position',
      inputSchema: {
        type: 'object' as const,
        properties: {
          x: { type: 'number', description: 'X coordinate' },
          y: { type: 'number', description: 'Y coordinate' },
          content: { type: 'string', description: 'Text content' },
          height: { type: 'number', description: 'Text height', default: 2.5 },
          rotation: { type: 'number', description: 'Rotation (radians)', default: 0 },
          layer_id: { type: 'string', description: 'Layer ID', default: 'layer_0' },
        },
        required: ['x', 'y', 'content'],
      },
      handler: (params: Record<string, unknown>) =>
        kernel.executeCommand({
          type: 'CreateText',
          x: params.x,
          y: params.y,
          content: params.content,
          height: params.height ?? 2.5,
          rotation: params.rotation ?? 0,
          layer_id: params.layer_id ?? 'layer_0',
        }),
    },
  ];
}
