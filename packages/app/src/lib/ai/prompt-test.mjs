#!/usr/bin/env node
/**
 * Prompt stress test — 7 scenarios against Ollama (Gemma 4)
 * Tests whether the AI anchors to context, picks correct tools, avoids hallucination.
 *
 * Usage: node packages/app/src/lib/ai/prompt-test.mjs
 */

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4';

// --- System prompt + context (from our live canvas with 3 entities) ---

const SYSTEM_PROMPT = `You are the AI assistant embedded in NEXUS, a browser-based 2D CAD application. You help users draft, modify, and reason about technical drawings.

## Your capabilities

You can CREATE geometry (lines, circles, arcs, rectangles, polylines, points, text), MODIFY entities (move, copy, rotate, scale, mirror, delete), QUERY the drawing (get entities, measure distances/areas, inspect layers), and MANAGE state (undo, redo, create/configure layers).

## Current drawing state

# Drawing State (v0.1.0)

## Scene: 3 entities (1 Line, 1 Circle, 1 Rectangle) across 1 layer
Bounds: (-15, -10) to (15, 10)
Layers:
  - "0" (layer_0): 3 entities, color #ffffff

## Selected
  - [ent_2] Circle at (0, 0), radius 8 (layer: layer_0)

## Recent
  - [ent_3] Rectangle at (-12, -8), 24×16
  - [ent_2] Circle at (0, 0), radius 8
  - [ent_1] Line from (-15, -10) to (15, 10), length 36.06

## Nearby Entities (3)
  - [ent_1] Line (-15, -10)→(15, 10)
  - [ent_2] Circle at (0, 0) r=8
  - [ent_3] Rectangle at (-12, -8) 24×16

## Settings
Active layer: layer_0
Units: decimal (millimeters)
Object snap: ON
Viewport center: (0, 0), size 100×100

## Rules

1. **Use tools, don't describe.** When the user says "draw a circle," call the tool — don't explain how.
2. **Reference real entity IDs.** Only use IDs from the drawing state above. NEVER invent IDs. If unsure, call get_entities first.
3. **Coordinate system.** Origin (0,0). X right, Y up. Units: millimeters.
4. **Active layer.** New entities go on "layer_0" unless user specifies otherwise.
5. **One intent per response.** Complex requests → break into steps, execute sequentially.
6. **Verify before modifying.** Check the drawing state for matching entities before move/delete.
7. **Spatial reasoning.** Place new geometry sensibly relative to existing entities and viewport.
8. **Be concise.** State what you did, not what you could do.
9. **Admit limits.** Cannot zoom, pan, select, import files, or change rendering.
10. **Ambiguity → ask.** If a request is ambiguous, ask a clarification question instead of guessing.
11. **Context is truth.** Do not assume hidden state. The drawing state above is the complete source of truth.`;

// --- Tool definitions (Ollama format) ---

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'draw_line',
      description: 'Draw a line between two points',
      parameters: {
        type: 'object',
        required: ['x1', 'y1', 'x2', 'y2'],
        properties: {
          x1: { type: 'number', description: 'Start X' },
          y1: { type: 'number', description: 'Start Y' },
          x2: { type: 'number', description: 'End X' },
          y2: { type: 'number', description: 'End Y' },
          layer_id: { type: 'string', description: 'Layer ID' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draw_circle',
      description: 'Draw a circle with center and radius',
      parameters: {
        type: 'object',
        required: ['cx', 'cy', 'radius'],
        properties: {
          cx: { type: 'number', description: 'Center X' },
          cy: { type: 'number', description: 'Center Y' },
          radius: { type: 'number', description: 'Radius' },
          layer_id: { type: 'string', description: 'Layer ID' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draw_rectangle',
      description: 'Draw a rectangle from origin corner',
      parameters: {
        type: 'object',
        required: ['x', 'y', 'width', 'height'],
        properties: {
          x: { type: 'number', description: 'Origin X' },
          y: { type: 'number', description: 'Origin Y' },
          width: { type: 'number', description: 'Width' },
          height: { type: 'number', description: 'Height' },
          layer_id: { type: 'string', description: 'Layer ID' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'move_entities',
      description: 'Move entities by displacement',
      parameters: {
        type: 'object',
        required: ['ids', 'dx', 'dy'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
          dx: { type: 'number', description: 'X displacement' },
          dy: { type: 'number', description: 'Y displacement' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scale_entities',
      description: 'Scale entities from a base point',
      parameters: {
        type: 'object',
        required: ['ids', 'cx', 'cy', 'factor'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs' },
          cx: { type: 'number', description: 'Base X' },
          cy: { type: 'number', description: 'Base Y' },
          factor: { type: 'number', description: 'Scale factor' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_entities',
      description: 'Delete entities by ID',
      parameters: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, description: 'Entity IDs to delete' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_entities',
      description: 'Get all entities in the drawing',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'measure_distance',
      description: 'Measure distance between two points',
      parameters: {
        type: 'object',
        required: ['x1', 'y1', 'x2', 'y2'],
        properties: {
          x1: { type: 'number' }, y1: { type: 'number' },
          x2: { type: 'number' }, y2: { type: 'number' },
        },
      },
    },
  },
];

// --- Test scenarios ---

const SCENARIOS = [
  {
    name: '1. Basic geometry',
    prompt: 'Draw a circle at (0,0) with radius 10',
    checks: [
      { label: 'Uses draw_circle tool', test: (r) => r.tool === 'draw_circle' },
      { label: 'cx=0, cy=0', test: (r) => r.args?.cx === 0 && r.args?.cy === 0 },
      { label: 'radius=10', test: (r) => r.args?.radius === 10 },
    ],
  },
  {
    name: '2. Context awareness (selected entity)',
    prompt: 'Move the selected circle 10 units to the right',
    checks: [
      { label: 'Uses move_entities tool', test: (r) => r.tool === 'move_entities' },
      { label: 'References ent_2', test: (r) => r.args?.ids?.includes('ent_2') },
      { label: 'dx=10', test: (r) => r.args?.dx === 10 },
      { label: 'dy=0', test: (r) => r.args?.dy === 0 },
      { label: 'Does NOT create new entity', test: (r) => r.tool !== 'draw_circle' },
    ],
  },
  {
    name: '3. Spatial reasoning (viewport)',
    prompt: 'Place a small rectangle in the top-right area of the viewport',
    checks: [
      { label: 'Uses draw_rectangle', test: (r) => r.tool === 'draw_rectangle' },
      { label: 'x > 0 (right side)', test: (r) => (r.args?.x ?? -1) > 0 },
      { label: 'y > 0 (top side)', test: (r) => (r.args?.y ?? -1) > 0 },
    ],
  },
  {
    name: '4. Incremental edit (recent entity)',
    prompt: 'Make the last rectangle twice as wide',
    checks: [
      { label: 'Uses scale or references ent_3', test: (r) =>
        r.tool === 'scale_entities' && r.args?.ids?.includes('ent_3') ||
        r.tool === 'draw_rectangle' ||
        r.text?.includes('ent_3')
      },
      { label: 'Does NOT hallucinate entity IDs', test: (r) => {
        const ids = r.args?.ids ?? [];
        return ids.every(id => ['ent_1', 'ent_2', 'ent_3'].includes(id));
      }},
    ],
  },
  {
    name: '5. Ambiguity handling',
    prompt: 'Make it bigger',
    checks: [
      { label: 'Asks clarification OR uses selected ent_2', test: (r) =>
        r.isText || (r.tool === 'scale_entities' && r.args?.ids?.includes('ent_2'))
      },
      { label: 'Does NOT guess random entity', test: (r) => {
        if (!r.args?.ids) return true;
        return r.args.ids.every(id => ['ent_1', 'ent_2', 'ent_3'].includes(id));
      }},
    ],
  },
  {
    name: '6. Unit awareness',
    prompt: 'Draw a 1-inch horizontal line starting at (20, 0)',
    checks: [
      { label: 'Uses draw_line', test: (r) => r.tool === 'draw_line' },
      { label: 'Converts to mm (~25.4) or asks', test: (r) => {
        if (r.isText) return true; // asking is valid
        const len = Math.abs((r.args?.x2 ?? 0) - (r.args?.x1 ?? 0));
        return len > 20 && len < 30; // ~25.4mm
      }},
    ],
  },
  {
    name: '7. Invalid request',
    prompt: 'Delete all entities on the "electrical" layer',
    checks: [
      { label: 'Does NOT blindly delete', test: (r) => r.tool !== 'delete_entities' || r.args?.ids?.length === 0 },
      { label: 'Mentions layer doesn\'t exist or asks', test: (r) =>
        r.isText && (r.text?.toLowerCase().includes('no') || r.text?.toLowerCase().includes('exist') ||
                     r.text?.toLowerCase().includes('electrical') || r.text?.toLowerCase().includes('only'))
      },
    ],
  },
];

// --- Ollama call ---

async function callOllama(userPrompt) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    tools: TOOLS,
    stream: false,
  };

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  return res.json();
}

function parseResponse(ollamaRes) {
  const msg = ollamaRes.message;

  // Check for tool calls
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const tc = msg.tool_calls[0];
    return {
      isText: false,
      tool: tc.function.name,
      args: tc.function.arguments,
      text: msg.content || '',
      raw: msg,
    };
  }

  // Text-only response
  return {
    isText: true,
    tool: null,
    args: null,
    text: msg.content || '',
    raw: msg,
  };
}

// --- Main ---

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  NEXUS AI Prompt Stress Test — ${MODEL}`);
  console.log(`${'='.repeat(70)}\n`);

  let totalChecks = 0;
  let totalPassed = 0;

  for (const scenario of SCENARIOS) {
    process.stdout.write(`▶ ${scenario.name}...\n`);
    process.stdout.write(`  Prompt: "${scenario.prompt}"\n`);

    try {
      const ollamaRes = await callOllama(scenario.prompt);
      const parsed = parseResponse(ollamaRes);

      if (parsed.isText) {
        process.stdout.write(`  Response: TEXT → "${parsed.text.slice(0, 120)}..."\n`);
      } else {
        process.stdout.write(`  Response: TOOL → ${parsed.tool}(${JSON.stringify(parsed.args)})\n`);
      }

      for (const check of scenario.checks) {
        totalChecks++;
        let passed = false;
        try {
          passed = check.test(parsed);
        } catch (e) {
          passed = false;
        }
        if (passed) totalPassed++;
        const mark = passed ? '✓' : '✗';
        console.log(`    ${mark} ${check.label}`);
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      totalChecks += scenario.checks.length;
    }

    console.log('');
  }

  console.log(`${'='.repeat(70)}`);
  console.log(`  Results: ${totalPassed}/${totalChecks} checks passed (${Math.round(totalPassed/totalChecks*100)}%)`);
  console.log(`${'='.repeat(70)}\n`);

  if (totalPassed / totalChecks < 0.7) {
    console.log('⚠ Below 70% — prompt/context needs iteration before building API route.');
  } else if (totalPassed / totalChecks < 0.9) {
    console.log('◐ 70-90% — solid foundation, minor prompt tuning needed.');
  } else {
    console.log('● 90%+ — prompt is production-ready. Safe to build API route.');
  }
}

main().catch(console.error);
