#!/usr/bin/env node
/**
 * Prompt stress test v2 — tests the FULL LOOP with tool result feedback.
 * Validates that the AI:
 * 1. Picks correct tools (same as v1)
 * 2. Interprets results and communicates back to user
 * 3. Handles failures gracefully in multi-turn
 * 4. Doesn't loop endlessly
 *
 * Usage: node packages/app/src/lib/ai/prompt-test-loop.mjs
 */

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4';
const MAX_STEPS = 5;

// --- System prompt (v2 with result-interpretation rule) ---

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
10. **Explain tool results.** After every tool call, interpret the result for the user. If the operation failed or found nothing, explain why. If it changed the scene, briefly describe what changed. Never leave the user wondering what happened.
11. **Ambiguity → ask.** If a request is ambiguous, ask a clarification question instead of guessing.
12. **Context is truth.** Do not assume hidden state. The drawing state above is the complete source of truth. If an entity or layer isn't listed, it does not exist.`;

// --- Tool definitions ---

const TOOLS = [
  { type: 'function', function: { name: 'draw_line', description: 'Draw a line between two points', parameters: { type: 'object', required: ['x1','y1','x2','y2'], properties: { x1:{type:'number'}, y1:{type:'number'}, x2:{type:'number'}, y2:{type:'number'}, layer_id:{type:'string'} } } } },
  { type: 'function', function: { name: 'draw_circle', description: 'Draw a circle with center and radius', parameters: { type: 'object', required: ['cx','cy','radius'], properties: { cx:{type:'number'}, cy:{type:'number'}, radius:{type:'number'}, layer_id:{type:'string'} } } } },
  { type: 'function', function: { name: 'draw_rectangle', description: 'Draw a rectangle from origin corner', parameters: { type: 'object', required: ['x','y','width','height'], properties: { x:{type:'number'}, y:{type:'number'}, width:{type:'number'}, height:{type:'number'}, layer_id:{type:'string'} } } } },
  { type: 'function', function: { name: 'move_entities', description: 'Move entities by displacement', parameters: { type: 'object', required: ['ids','dx','dy'], properties: { ids:{type:'array',items:{type:'string'}}, dx:{type:'number'}, dy:{type:'number'} } } } },
  { type: 'function', function: { name: 'scale_entities', description: 'Scale entities from a base point', parameters: { type: 'object', required: ['ids','cx','cy','factor'], properties: { ids:{type:'array',items:{type:'string'}}, cx:{type:'number'}, cy:{type:'number'}, factor:{type:'number'} } } } },
  { type: 'function', function: { name: 'delete_entities', description: 'Delete entities by ID', parameters: { type: 'object', required: ['ids'], properties: { ids:{type:'array',items:{type:'string'}} } } } },
  { type: 'function', function: { name: 'get_entities', description: 'Get all entities in the drawing', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'measure_distance', description: 'Measure distance between two points', parameters: { type: 'object', required: ['x1','y1','x2','y2'], properties: { x1:{type:'number'}, y1:{type:'number'}, x2:{type:'number'}, y2:{type:'number'} } } } },
];

// --- Simulated tool results ---

function simulateToolResult(toolName, args) {
  switch (toolName) {
    case 'draw_line': return { success: true, message: 'Created Line ent_4', entities_created: ['ent_4'] };
    case 'draw_circle': return { success: true, message: 'Created Circle ent_5', entities_created: ['ent_5'] };
    case 'draw_rectangle': return { success: true, message: 'Created Rectangle ent_6', entities_created: ['ent_6'] };
    case 'move_entities': {
      const ids = args.ids || [];
      const valid = ids.filter(id => ['ent_1','ent_2','ent_3'].includes(id));
      const invalid = ids.filter(id => !['ent_1','ent_2','ent_3'].includes(id));
      if (invalid.length > 0) return { success: false, message: `Entity IDs not found: ${invalid.join(', ')}` };
      return { success: true, message: `Moved ${valid.join(', ')}`, entities_modified: valid };
    }
    case 'scale_entities': {
      const ids = args.ids || [];
      return { success: true, message: `Scaled ${ids.join(', ')}`, entities_modified: ids };
    }
    case 'delete_entities': {
      const ids = args.ids || [];
      const valid = ids.filter(id => ['ent_1','ent_2','ent_3'].includes(id));
      if (valid.length === 0) return { success: false, message: 'No matching entities found' };
      return { success: true, message: `Deleted ${valid.join(', ')}` };
    }
    case 'get_entities':
      return { success: true, message: 'Found 3 entities', data: [
        { id: 'ent_1', type: 'Line', layer: 'layer_0' },
        { id: 'ent_2', type: 'Circle', layer: 'layer_0' },
        { id: 'ent_3', type: 'Rectangle', layer: 'layer_0' },
      ]};
    case 'measure_distance': {
      const dx = (args.x2||0) - (args.x1||0);
      const dy = (args.y2||0) - (args.y1||0);
      return { success: true, message: `Distance: ${Math.sqrt(dx*dx+dy*dy).toFixed(2)}` };
    }
    default: return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

// --- Multi-turn Ollama loop ---

async function runLoop(userPrompt) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ];

  const trace = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, stream: false }),
    });
    const data = await res.json();
    const msg = data.message;

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      // Record tool call
      const tc = msg.tool_calls[0];
      const toolResult = simulateToolResult(tc.function.name, tc.function.arguments);
      trace.push({ step, type: 'tool', name: tc.function.name, args: tc.function.arguments, result: toolResult });

      // Feed back to model
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
      messages.push({ role: 'tool', content: JSON.stringify(toolResult) });
      continue;
    }

    // Text response — done
    trace.push({ step, type: 'text', content: msg.content });
    return { trace, finalText: msg.content, steps: step + 1 };
  }

  return { trace, finalText: '[MAX STEPS REACHED]', steps: MAX_STEPS };
}

// --- Test scenarios (focused on loop behavior) ---

const SCENARIOS = [
  {
    name: '1. Single tool → explain result',
    prompt: 'Draw a circle at (5, 5) with radius 3',
    checks: [
      { label: 'Calls draw_circle', test: (t) => t.trace.some(s => s.name === 'draw_circle') },
      { label: 'Final text explains what was created', test: (t) =>
        t.finalText && (t.finalText.toLowerCase().includes('circle') || t.finalText.toLowerCase().includes('drew') || t.finalText.toLowerCase().includes('created'))
      },
      { label: 'Completes in ≤2 steps', test: (t) => t.steps <= 2 },
    ],
  },
  {
    name: '2. Multi-step: verify then act',
    prompt: 'Delete all entities on the "electrical" layer',
    checks: [
      { label: 'Does NOT blindly delete', test: (t) => {
        const firstAction = t.trace.find(s => s.type === 'tool');
        return firstAction?.name !== 'delete_entities';
      }},
      { label: 'Final text explains no such layer exists', test: (t) =>
        t.finalText && (t.finalText.toLowerCase().includes('no') ||
                        t.finalText.toLowerCase().includes('doesn') ||
                        t.finalText.toLowerCase().includes('not') ||
                        t.finalText.toLowerCase().includes('only'))
      },
    ],
  },
  {
    name: '3. Tool failure → explain',
    prompt: 'Move entity ent_99 to the right by 10',
    checks: [
      { label: 'Attempts move or explains ID not found', test: (t) => {
        const move = t.trace.find(s => s.name === 'move_entities');
        if (move && !move.result.success) return true; // tried and got error
        return t.finalText && (t.finalText.toLowerCase().includes('not found') ||
                               t.finalText.toLowerCase().includes('doesn\'t exist') ||
                               t.finalText.toLowerCase().includes('does not exist') ||
                               t.finalText.toLowerCase().includes('invalid') ||
                               t.finalText.toLowerCase().includes('ent_99'));
      }},
      { label: 'Does NOT silently succeed', test: (t) => {
        const move = t.trace.find(s => s.name === 'move_entities');
        return !move || !move.result.success || t.finalText.length > 10;
      }},
    ],
  },
  {
    name: '4. Context-grounded multi-step',
    prompt: 'Move the circle 20 units up, then draw a small triangle above it',
    checks: [
      { label: 'Moves ent_2 (the circle)', test: (t) => {
        const move = t.trace.find(s => s.name === 'move_entities');
        return move && move.args.ids?.includes('ent_2');
      }},
      { label: 'Creates geometry for triangle', test: (t) =>
        t.trace.some(s => s.name === 'draw_polyline' || s.name === 'draw_line')
      },
      { label: 'Triangle positioned above circle (y > 20)', test: (t) => {
        const draw = t.trace.find(s => s.name === 'draw_polyline' || s.name === 'draw_line');
        if (!draw) return false;
        const args = draw.args;
        // Check y coordinates are above the moved circle
        if (args.vertices) return args.vertices.some(v => v[1] > 15);
        if (args.y1 !== undefined) return args.y1 > 15 || args.y2 > 15;
        return false;
      }},
      { label: 'Final text summarizes both actions', test: (t) =>
        t.finalText && t.finalText.length > 20
      },
    ],
  },
  {
    name: '5. Ambiguity → no tool call, just ask',
    prompt: 'Make it look better',
    checks: [
      { label: 'No tool calls', test: (t) => t.trace.filter(s => s.type === 'tool').length === 0 },
      { label: 'Asks clarification', test: (t) =>
        t.finalText && (t.finalText.includes('?') || t.finalText.toLowerCase().includes('what') ||
                        t.finalText.toLowerCase().includes('which') || t.finalText.toLowerCase().includes('clarif'))
      },
    ],
  },
  {
    name: '6. No-op detection',
    prompt: 'Move the circle 0 units in any direction',
    checks: [
      { label: 'Either skips or explains no-op', test: (t) => {
        const move = t.trace.find(s => s.name === 'move_entities');
        if (!move) return true; // smart enough to skip
        return t.finalText && t.finalText.length > 5; // at least explains
      }},
    ],
  },
  {
    name: '7. Result interpretation after success',
    prompt: 'Move the line 5 units to the right and tell me its new position',
    checks: [
      { label: 'Moves ent_1', test: (t) => {
        const move = t.trace.find(s => s.name === 'move_entities');
        return move && move.args.ids?.includes('ent_1') && move.args.dx === 5;
      }},
      { label: 'Final text mentions new position or confirms move', test: (t) =>
        t.finalText && (t.finalText.includes('-10') || t.finalText.includes('20') ||
                        t.finalText.toLowerCase().includes('moved') || t.finalText.toLowerCase().includes('position'))
      },
    ],
  },
];

// --- Main ---

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  NEXUS AI Loop Stress Test v2 — ${MODEL}`);
  console.log(`  Testing: tool loop, result interpretation, failure handling`);
  console.log(`${'='.repeat(70)}\n`);

  let totalChecks = 0;
  let totalPassed = 0;

  for (const scenario of SCENARIOS) {
    process.stdout.write(`▶ ${scenario.name}\n`);
    process.stdout.write(`  Prompt: "${scenario.prompt}"\n`);

    try {
      const result = await runLoop(scenario.prompt);

      // Print trace
      for (const step of result.trace) {
        if (step.type === 'tool') {
          const status = step.result.success ? '✓' : '✗';
          process.stdout.write(`  Step ${step.step}: TOOL ${step.name}(${JSON.stringify(step.args)}) → ${status} ${step.result.message}\n`);
        } else {
          const preview = step.content?.slice(0, 100) || '(empty)';
          process.stdout.write(`  Step ${step.step}: TEXT → "${preview}${step.content?.length > 100 ? '...' : ''}"\n`);
        }
      }

      for (const check of scenario.checks) {
        totalChecks++;
        let passed = false;
        try { passed = check.test(result); } catch { passed = false; }
        if (passed) totalPassed++;
        console.log(`    ${passed ? '✓' : '✗'} ${check.label}`);
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
    console.log('⚠ Below 70% — loop behavior needs work before building Chat UI.');
  } else if (totalPassed / totalChecks < 0.85) {
    console.log('◐ 70-85% — loop works but needs prompt refinement.');
  } else {
    console.log('● 85%+ — loop is solid. Safe to build Chat UI.');
  }
}

main().catch(console.error);
