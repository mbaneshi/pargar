/**
 * Tool schemas in Ollama/OpenAI function-calling format.
 * Generated from @nexus/mcp tool-definitions — single source of truth.
 */

import {
  TOOL_DEFINITIONS,
  buildToolCommandMap,
  type ParamType,
  type ParamDef,
} from '@nexus/mcp/tool-definitions';

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function paramTypeToJsonSchema(paramType: ParamType): Record<string, unknown> {
  switch (paramType) {
    case 'number':
      return { type: 'number' };
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'number[][]':
      return {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
      };
    case 'string[]':
      return { type: 'array', items: { type: 'string' } };
    case 'number[]':
      return { type: 'array', items: { type: 'number' } };
  }
}

function definitionToToolDef(def: (typeof TOOL_DEFINITIONS)[number]): ToolDef {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(def.parameters) as [string, ParamDef][]) {
    properties[key] = {
      ...paramTypeToJsonSchema(param.type),
      description: param.description,
    };
    if (!param.optional) {
      required.push(key);
    }
  }

  return {
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  };
}

export const TOOL_SCHEMAS: ToolDef[] = TOOL_DEFINITIONS.map(definitionToToolDef);

/** Map of tool name → command type for kernel dispatch */
export const TOOL_TO_COMMAND: Record<string, string> = buildToolCommandMap();
