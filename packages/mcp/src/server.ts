import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { exportDxf, parseDxfFull } from '@nexus/file-io';
import type { KernelBridge } from './kernel-bridge.js';
import type { BridgeServer } from './bridge.js';
import { TOOL_DEFINITIONS, type ParamType, type ToolDefinition } from './tool-definitions.js';

function paramToZod(paramType: ParamType, description: string, optional?: boolean) {
  let schema: z.ZodTypeAny;
  switch (paramType) {
    case 'number':
      schema = z.number().describe(description);
      break;
    case 'string':
      schema = z.string().describe(description);
      break;
    case 'boolean':
      schema = z.boolean().describe(description);
      break;
    case 'number[][]':
      schema = z.array(z.tuple([z.number(), z.number()])).describe(description);
      break;
    case 'string[]':
      schema = z.array(z.string()).describe(description);
      break;
    case 'number[]':
      schema = z.array(z.number()).describe(description);
      break;
  }
  return optional ? schema.optional() : schema;
}

function buildZodShape(def: ToolDefinition): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, param] of Object.entries(def.parameters)) {
    if (def.perEntity && key === 'ids') {
      shape[key] = z.array(z.string()).describe(param.description);
    } else {
      shape[key] = paramToZod(param.type, param.description, param.optional);
    }
  }
  return shape;
}

function applyDefaults(
  def: ToolDefinition,
  params: Record<string, unknown>,
  activeLayerId?: string,
): Record<string, unknown> {
  const result = { ...params };
  for (const [key, param] of Object.entries(def.parameters)) {
    if (result[key] === undefined && param.default !== undefined) {
      if (key === 'layer_id' && activeLayerId) {
        result[key] = activeLayerId;
      } else {
        result[key] = param.default;
      }
    }
  }
  return result;
}

export function createMcpServer(kernel: KernelBridge, bridge?: BridgeServer): McpServer {
  const exec = bridge
    ? (cmd: object) => bridge.executeInBrowser(cmd)
    : (cmd: object) => Promise.resolve(kernel.executeCommand(cmd));
  const queryEntities = bridge
    ? () => bridge.queryBrowser('get_entities')
    : () => Promise.resolve(kernel.getEntitiesJson());
  const queryLayers = bridge
    ? () => bridge.queryBrowser('get_layers')
    : () => Promise.resolve(kernel.getLayersJson());
  const queryActiveLayer = async (): Promise<string> => {
    if (bridge?.hasBrowserConnection()) {
      try {
        const result = await bridge.queryBrowser('get_active_layer');
        const parsed = JSON.parse(result);
        if (parsed.layer_id) return parsed.layer_id;
      } catch {
        // fall through to default
      }
    }
    return 'layer_0';
  };

  const server = new McpServer({
    name: 'nexus-cad',
    version: '0.1.0',
  });

  // Tools with custom handlers registered below
  const CUSTOM_TOOLS = new Set([
    'get_entities',
    'get_entity',
    'measure_distance',
    'measure_area',
    'undo',
    'redo',
    'get_layers',
    'get_drawing_info',
    'get_selection',
    'set_selection',
    'export_dxf',
  ]);

  // Register tools from definitions
  for (const def of TOOL_DEFINITIONS) {
    if (CUSTOM_TOOLS.has(def.name)) {
      continue;
    }

    const zodShape = buildZodShape(def);

    if (def.perEntity) {
      server.tool(def.name, def.description, zodShape, async (params) => {
        const activeLayer = await queryActiveLayer();
        const filled = applyDefaults(def, params, activeLayer);
        const ids = filled.ids as string[];

        if (def.commandType === 'CopyEntity') {
          // Copy needs special handling: copy then move
          const created: string[] = [];
          for (const id of ids) {
            const r = await exec({ type: 'CopyEntity', id });
            if (r.success && r.created_ids[0]) {
              if (filled.dx !== undefined || filled.dy !== undefined) {
                await exec({
                  type: 'MoveEntity',
                  id: r.created_ids[0],
                  dx: filled.dx ?? 0,
                  dy: filled.dy ?? 0,
                });
              }
              created.push(r.created_ids[0]);
            }
          }
          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true, created_ids: created }) },
            ],
          };
        }

        if (def.commandType === 'MirrorEntity') {
          const created: string[] = [];
          for (const id of ids) {
            const cmd: Record<string, unknown> = { type: def.commandType, id };
            for (const [key, val] of Object.entries(filled)) {
              if (key !== 'ids') cmd[key] = val;
            }
            const r = await exec(cmd);
            if (r.success) created.push(...r.created_ids);
          }
          return {
            content: [
              { type: 'text', text: JSON.stringify({ success: true, created_ids: created }) },
            ],
          };
        }

        // Generic per-entity dispatch
        const results = await Promise.all(
          ids.map((id) => {
            const cmd: Record<string, unknown> = { type: def.commandType, id };
            for (const [key, val] of Object.entries(filled)) {
              if (key !== 'ids') {
                const mappedKey = def.parameterMapping?.[key] ?? key;
                cmd[mappedKey] = val;
              }
            }
            return exec(cmd);
          }),
        );
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: results.every((r) => r.success),
                count: ids.length,
              }),
            },
          ],
        };
      });
    } else {
      // Single command dispatch
      server.tool(def.name, def.description, zodShape, async (params) => {
        const activeLayer = await queryActiveLayer();
        const filled = applyDefaults(def, params, activeLayer);
        const cmd: Record<string, unknown> = { type: def.commandType };
        for (const [key, val] of Object.entries(filled)) {
          const mappedKey = def.parameterMapping?.[key] ?? key;
          cmd[mappedKey] = val;
        }
        const r = await exec(cmd);
        return {
          content: [{ type: 'text', text: JSON.stringify(r) }],
        };
      });
    }
  }

  // ─── Custom query/state tools ────────────────────────────────────────────

  server.tool(
    'get_entities',
    'Get all entities in the current drawing with their geometry, layer, and style',
    {},
    async () => {
      const entities = JSON.parse(await queryEntities());
      return {
        content: [{ type: 'text', text: JSON.stringify({ count: entities.length, entities }) }],
      };
    },
  );

  server.tool(
    'get_entity',
    'Get a single entity by its ID',
    { id: z.string().describe('Entity ID') },
    async ({ id }) => {
      const entities = JSON.parse(await queryEntities());
      const entity = entities.find((e: { id: string }) => e.id === id);
      return {
        content: [{ type: 'text', text: JSON.stringify(entity ?? { error: `Not found: ${id}` }) }],
      };
    },
  );

  server.tool(
    'measure_distance',
    'Measure the distance between two points',
    {
      x1: z.number(),
      y1: z.number(),
      x2: z.number(),
      y2: z.number(),
    },
    async ({ x1, y1, x2, y2 }) => {
      const r = await exec({ type: 'MeasureDistance', x1, y1, x2, y2 });
      return { content: [{ type: 'text', text: JSON.stringify({ distance: r.measurement }) }] };
    },
  );

  server.tool(
    'measure_area',
    'Measure the area of a closed entity (rectangle, circle, closed polyline)',
    {
      entity_id: z.string().describe('Closed entity ID to measure'),
    },
    async ({ entity_id }) => {
      const r = await exec({ type: 'MeasureArea', entity_id });
      return { content: [{ type: 'text', text: JSON.stringify({ area: r.measurement }) }] };
    },
  );

  server.tool('undo', 'Undo the last operation', {}, async () => {
    if (!kernel.canUndo())
      return { content: [{ type: 'text', text: '{"success":false,"error":"Nothing to undo"}' }] };
    kernel.undo();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, entity_count: kernel.entityCount() }),
        },
      ],
    };
  });

  server.tool('redo', 'Redo the last undone operation', {}, async () => {
    if (!kernel.canRedo())
      return { content: [{ type: 'text', text: '{"success":false,"error":"Nothing to redo"}' }] };
    kernel.redo();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, entity_count: kernel.entityCount() }),
        },
      ],
    };
  });

  server.tool('get_layers', 'Get all layers in the drawing with their properties', {}, async () => {
    const layers = JSON.parse(await queryLayers());
    return { content: [{ type: 'text', text: JSON.stringify({ count: layers.length, layers }) }] };
  });

  server.tool(
    'get_drawing_info',
    'Get a summary of the current drawing: entity count, layer count, undo/redo state',
    {},
    async () => {
      const entities = JSON.parse(await queryEntities());
      const layers = JSON.parse(await queryLayers());
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              entity_count: entities.length,
              layer_count: layers.length,
              can_undo: kernel.canUndo(),
              can_redo: kernel.canRedo(),
            }),
          },
        ],
      };
    },
  );

  // ─── Selection state ─────────────────────────────────────────────────────

  const selectedIds = new Set<string>();

  server.tool('get_selection', 'Get the currently selected entity IDs', {}, async () => ({
    content: [{ type: 'text', text: JSON.stringify({ ids: Array.from(selectedIds) }) }],
  }));

  server.tool(
    'set_selection',
    'Set the current selection to the specified entity IDs',
    { ids: z.array(z.string()).describe('Entity IDs to select. Pass empty array to clear.') },
    async ({ ids }) => {
      selectedIds.clear();
      for (const id of ids) selectedIds.add(id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ids: Array.from(selectedIds), count: selectedIds.size }),
          },
        ],
      };
    },
  );

  // ─── DXF export ──────────────────────────────────────────────────────────

  server.tool(
    'export_dxf',
    'Export the current drawing as a DXF file. Returns the file path.',
    {
      filename: z.string().optional().describe('Output filename (default: "drawing.dxf")'),
      directory: z
        .string()
        .optional()
        .describe('Output directory (default: current working directory)'),
    },
    async ({ filename, directory }) => {
      const entitiesJson = await queryEntities();
      const layersJson = await queryLayers();
      const textStylesJson = kernel.getTextStylesJson();
      const dxfContent = exportDxf(entitiesJson, layersJson, textStylesJson);

      if (!dxfContent) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Export failed — no entities' }),
            },
          ],
        };
      }

      const outDir = directory ? resolve(directory) : process.cwd();
      const outFile = resolve(outDir, filename ?? 'drawing.dxf');
      writeFileSync(outFile, dxfContent, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: outFile,
              entities: JSON.parse(entitiesJson).length,
              size_bytes: Buffer.byteLength(dxfContent, 'utf-8'),
            }),
          },
        ],
      };
    },
  );

  // ─── DXF import ─────────────────────────────────────────────────────────

  server.tool(
    'import_dxf',
    'Import a DXF file into the current drawing. Creates entities and layers from the file.',
    {
      path: z.string().describe('Path to the DXF file to import'),
    },
    async ({ path: filePath }) => {
      try {
        const absPath = resolve(filePath);
        const dxfContent = readFileSync(absPath, 'utf-8');
        const result = parseDxfFull(dxfContent);

        // Create layers first
        for (const layer of result.layers) {
          await exec({
            type: 'CreateLayer',
            name: layer.name,
            color: layer.color ?? '#ffffff',
          });
        }

        // Create entities
        let created = 0;
        for (const ent of result.entities) {
          const cmd = ent.geometry;
          if (cmd && cmd.type) {
            cmd.layer_id = `layer_0`;
            const r = await exec(cmd);
            if (r.success) created++;
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                layers_imported: result.layers.length,
                entities_imported: created,
                entities_total: result.entities.length,
              }),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
        };
      }
    },
  );

  return server;
}
