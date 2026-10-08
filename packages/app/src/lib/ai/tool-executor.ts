/**
 * Tool Executor — validates and executes AI tool calls against the kernel.
 * Driven by @nexus/mcp tool-definitions — single source of truth.
 *
 * Design:
 * 1. Validate BEFORE executing (no corrupt state from bad args)
 * 2. Normalize results into consistent shape
 * 3. Never throw — always return a ToolResult
 */

import type { AppState } from '$lib/stores/AppState.svelte';
import { TOOL_DEFINITIONS, getToolByName, type ToolDefinition } from '@nexus/mcp/tool-definitions';

let entityIdCache: { kernel: unknown; ids: Set<string> } | null = null;

export function invalidateEntityIdCache(): void {
  entityIdCache = null;
}

export interface ToolResult {
  success: boolean;
  message: string;
  entities_created?: string[];
  entities_modified?: string[];
  data?: unknown;
}

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

const PER_ENTITY_TOOLS = new Set(TOOL_DEFINITIONS.filter((d) => d.perEntity).map((d) => d.name));

export function executeTool(app: AppState, tool: ToolCall): ToolResult {
  if (!app.kernel) {
    return { success: false, message: 'Kernel not initialized' };
  }

  const { name, arguments: args } = tool;
  const def = getToolByName(name);

  if (!def) {
    return { success: false, message: `Unknown tool: ${name}` };
  }

  // --- Validation ---
  const validation = validateTool(app, def, args);
  if (!validation.valid) {
    return { success: false, message: validation.reason };
  }

  try {
    // --- Query tools (no state mutation) ---
    if (name === 'get_entities') {
      const entities = JSON.parse(app.kernel.get_entities_json());
      return {
        success: true,
        message: `Found ${entities.length} entities`,
        data: entities,
      };
    }

    if (name === 'get_entity') {
      const entities = JSON.parse(app.kernel.get_entities_json());
      const entity = entities.find((e: { id: string }) => e.id === args.id);
      if (!entity) return { success: false, message: `Entity ${args.id} not found` };
      return { success: true, message: `Found ${args.id}`, data: entity };
    }

    if (name === 'get_layers') {
      const layers = JSON.parse(app.kernel.get_layers_json());
      return { success: true, message: `Found ${layers.length} layers`, data: layers };
    }

    if (name === 'get_drawing_info') {
      const entities = JSON.parse(app.kernel.get_entities_json());
      const layers = JSON.parse(app.kernel.get_layers_json());
      return {
        success: true,
        message: `Drawing: ${entities.length} entities, ${layers.length} layers`,
        data: {
          entity_count: entities.length,
          layer_count: layers.length,
          can_undo: app.kernel.can_undo(),
          can_redo: app.kernel.can_redo(),
        },
      };
    }

    if (name === 'get_dwg_props') {
      const props = JSON.parse(app.kernel.get_dwg_props_json());
      return { success: true, message: 'Drawing properties', data: props };
    }

    if (name === 'measure_distance') {
      const dx = (args.x2 as number) - (args.x1 as number);
      const dy = (args.y2 as number) - (args.y1 as number);
      const dist = Math.sqrt(dx * dx + dy * dy);
      return { success: true, message: `Distance: ${dist.toFixed(4)}`, data: { distance: dist } };
    }

    if (name === 'measure_area') {
      const r = app.executeCommand({ type: 'MeasureArea', entity_id: args.entity_id });
      return {
        success: r.success,
        message: r.success ? `Area: ${r.measurement}` : (r.error ?? 'Measurement failed'),
        data: r.measurement ? { area: r.measurement } : undefined,
      };
    }

    if (name === 'analyze_dof') {
      const r = app.executeCommand({ type: 'AnalyzeDof' });
      return {
        success: r.success,
        message: r.success ? 'DOF analysis complete' : (r.error ?? 'Analysis failed'),
        data: r,
      };
    }

    // --- State tools ---
    if (name === 'undo') {
      if (!app.kernel.can_undo()) return { success: false, message: 'Nothing to undo' };
      app.undo();
      return { success: true, message: 'Undone' };
    }

    if (name === 'redo') {
      if (!app.kernel.can_redo()) return { success: false, message: 'Nothing to redo' };
      app.redo();
      return { success: true, message: 'Redone' };
    }

    // --- Per-entity tools ---
    if (def.perEntity) {
      const ids = args.ids as string[];

      if (def.commandType === 'CopyEntity') {
        // Copy needs special handling: copy then move
        const created: string[] = [];
        for (const id of ids) {
          const r = app.executeCommand({ type: 'CopyEntity', id });
          if (r.success && r.created_ids[0]) {
            if (args.dx !== undefined || args.dy !== undefined) {
              app.executeCommand({
                type: 'MoveEntity',
                id: r.created_ids[0],
                dx: args.dx ?? 0,
                dy: args.dy ?? 0,
              });
            }
            created.push(r.created_ids[0]);
          }
        }
        return {
          success: true,
          message: `Copied ${created.length} entities`,
          entities_created: created,
        };
      }

      return execPerEntity(app, def, ids, args);
    }

    // --- Single command dispatch (draw, layer, constraint, style, block, array, text_style, dim_style, edit) ---
    return execCommand(app, def, args);
  } catch (err) {
    return {
      success: false,
      message: `Tool error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// --- Helpers ---

function applyDefaults(
  def: ToolDefinition,
  args: Record<string, unknown>,
  activeLayerId?: string,
): Record<string, unknown> {
  const result = { ...args };
  for (const [key, param] of Object.entries(def.parameters)) {
    if (result[key] === undefined) {
      if (key === 'layer_id' && activeLayerId) {
        result[key] = activeLayerId;
      } else if (param.default !== undefined) {
        result[key] = param.default;
      }
    }
  }
  return result;
}

function execCommand(
  app: AppState,
  def: ToolDefinition,
  args: Record<string, unknown>,
): ToolResult {
  const filled = applyDefaults(def, args, app.activeLayerId);
  const cmd: Record<string, unknown> = { type: def.commandType };
  for (const [key, val] of Object.entries(filled)) {
    const mappedKey = def.parameterMapping?.[key] ?? key;
    cmd[mappedKey] = val;
  }

  const r = app.executeCommand(cmd);
  if (!r.success) {
    return { success: false, message: r.error ?? `${def.name} failed` };
  }

  entityIdCache = null;

  const verb = def.commandType.startsWith('Create') ? 'Created' : 'Executed';
  const typeName = def.commandType.replace('Create', '').replace('Add', '').replace('Set', 'Set ');

  return {
    success: true,
    message:
      r.created_ids.length > 0
        ? `${verb} ${typeName} ${r.created_ids.join(', ')}`
        : `${verb} ${typeName}`,
    entities_created: r.created_ids.length > 0 ? r.created_ids : undefined,
    data: r.measurement !== undefined ? { measurement: r.measurement } : undefined,
  };
}

function execPerEntity(
  app: AppState,
  def: ToolDefinition,
  ids: string[],
  args: Record<string, unknown>,
): ToolResult {
  const created: string[] = [];
  const modified: string[] = [];
  let failures = 0;

  for (const id of ids) {
    const cmd: Record<string, unknown> = { type: def.commandType, id };
    for (const [key, val] of Object.entries(args)) {
      if (key !== 'ids') {
        const mappedKey = def.parameterMapping?.[key] ?? key;
        cmd[mappedKey] = val;
      }
    }
    const r = app.executeCommand(cmd);
    if (r.success) {
      if (r.created_ids.length > 0) created.push(...r.created_ids);
      else modified.push(id);
    } else {
      failures++;
    }
  }

  entityIdCache = null;

  if (failures === ids.length) {
    return { success: false, message: `Failed for all ${ids.length} entities` };
  }

  const verb = def.name.replace(/_entities$/, '').replace(/_/, ' ');
  const parts = [];
  if (modified.length) parts.push(`${verb} ${modified.join(', ')}`);
  if (created.length) parts.push(`created ${created.join(', ')}`);
  if (failures) parts.push(`${failures} failed`);

  return {
    success: true,
    message: parts.join('; ') || `${verb} complete`,
    entities_created: created.length ? created : undefined,
    entities_modified: modified.length ? modified : undefined,
  };
}

// --- Validation ---

interface ValidationResult {
  valid: boolean;
  reason: string;
}

function validateTool(
  app: AppState,
  def: ToolDefinition,
  args: Record<string, unknown>,
): ValidationResult {
  // Entity modification tools: check that referenced IDs exist
  if (PER_ENTITY_TOOLS.has(def.name)) {
    const ids = args.ids as string[] | undefined;
    if (!ids || ids.length === 0) {
      return { valid: false, reason: 'No entity IDs provided' };
    }
    if (!entityIdCache || entityIdCache.kernel !== app.kernel) {
      entityIdCache = {
        kernel: app.kernel!,
        ids: new Set(
          (JSON.parse(app.kernel!.get_entities_json()) as { id: string }[]).map((e) => e.id),
        ),
      };
    }
    const invalid = ids.filter((id) => !entityIdCache!.ids.has(id));
    if (invalid.length > 0) {
      return {
        valid: false,
        reason: `Entity IDs not found: ${invalid.join(', ')}. Available: ${[...entityIdCache.ids].join(', ')}`,
      };
    }
  }

  // Draw tools: basic geometry validation
  if (def.name === 'draw_circle' && (args.radius as number) <= 0) {
    return { valid: false, reason: 'Radius must be positive' };
  }
  if (def.name === 'draw_rectangle') {
    if ((args.width as number) <= 0 || (args.height as number) <= 0) {
      return { valid: false, reason: 'Width and height must be positive' };
    }
  }

  return { valid: true, reason: '' };
}
