// YAML-to-ParityModel loader.
//
// Reads notes/specs/autocad-2d/commands/<command>.yaml and returns a typed
// ParityModel that the generic parity driver can assert against.
//
// Handles schema variations across yamls:
//   - offset.yaml: flat prompts array with id/text/accepts
//   - trim.yaml: modes + nested prompts under mode keys
//   - fillet.yaml: flat prompts with multi-line text
//
// This is a build-time loader (runs in Node during Playwright), not browser code.

import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import type { ParityModel, StateSpec, Transition, Invariant, InputSpec } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPECS_DIR = resolve(__dirname, '../../notes/specs/autocad-2d/commands');

export function loadModel(command: string): ParityModel {
  const raw = readFileSync(resolve(SPECS_DIR, `${command}.yaml`), 'utf-8');
  const spec = parse(raw);

  const prompts = extractPrompts(spec);
  const states = buildStates(prompts);
  const transitions = buildTransitions(prompts);
  const invariants = buildInvariants(spec);

  return {
    command: spec.command,
    aliases: spec.aliases ?? [],
    sysvars: [
      ...(spec.sysvars_read ?? []),
      ...(spec.sysvars_written ?? []),
    ].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i),
    states,
    transitions,
    invariants,
  };
}

export function listAvailableSpecs(): string[] {
  return readdirSync(SPECS_DIR)
    .filter((f: string) => f.endsWith('.yaml'))
    .map((f: string) => f.replace('.yaml', ''));
}

// --- Prompt extraction (handles schema variations) -------------------------

interface RawPrompt {
  id: string;
  text: string;
  accepts?: RawAccept[];
}

interface RawAccept {
  kind: string;
  value?: string;
  values?: string[];
  long?: string;
  action?: string;
  condition?: string;
}

function extractPrompts(spec: any): RawPrompt[] {
  // Case 1: flat prompts array (offset.yaml, fillet.yaml)
  if (Array.isArray(spec.prompts)) {
    return spec.prompts;
  }

  // Case 2: prompts is an object keyed by mode (trim.yaml)
  if (spec.prompts && typeof spec.prompts === 'object') {
    const all: RawPrompt[] = [];
    for (const modePrompts of Object.values(spec.prompts)) {
      if (Array.isArray(modePrompts)) {
        all.push(...modePrompts);
      }
    }
    return all;
  }

  // Case 3: modes with nested prompts
  if (spec.modes) {
    const all: RawPrompt[] = [];
    for (const mode of Object.values(spec.modes) as any[]) {
      if (mode.prompts && Array.isArray(mode.prompts)) {
        all.push(...mode.prompts);
      }
    }
    // Also check top-level prompts under mode keys
    if (spec.prompts) {
      for (const [_key, prompts] of Object.entries(spec.prompts)) {
        if (Array.isArray(prompts)) {
          all.push(...(prompts as RawPrompt[]));
        }
      }
    }
    return all;
  }

  return [];
}

// --- State building --------------------------------------------------------

function buildStates(prompts: RawPrompt[]): Record<string, StateSpec> {
  const states: Record<string, StateSpec> = {};

  for (const p of prompts) {
    // Skip prompts with no text (e.g. in-place editor states like enter_text)
    if (!p.text) continue;

    // Extract the last line of prompt text (multi-line prompts like fillet
    // have "Current settings: ..." on the first line).
    const lines = p.text.split('\n').filter((l: string) => l.trim());
    const promptLine = lines[lines.length - 1];

    // Build regex from prompt text:
    // - Replace {SYSVAR} templates with flexible matchers
    // - Escape regex special chars in the rest
    const regexStr = escapeForRegex(promptLine)
      .replace(/\\\{[^}]+\\\}/g, '.*?');

    const options = (p.accepts ?? [])
      .filter((a: RawAccept) => a.kind === 'keyword')
      .flatMap((a: RawAccept) => {
        if (a.long) return [a.long];
        if (a.values) return a.values;
        if (a.value) return [a.value];
        return [];
      });

    const hasDefault = (p.accepts ?? []).some(
      (a: RawAccept) => a.kind === 'enter' && a.action?.includes('default')
    );

    states[p.id] = {
      prompt: new RegExp(regexStr),
      description: p.id.replace(/_/g, ' '),
      options,
      default: hasDefault ? 'has default' : undefined,
    };
  }

  return states;
}

// --- Transition building ---------------------------------------------------

function buildTransitions(prompts: RawPrompt[]): Transition[] {
  const transitions: Transition[] = [];

  for (const p of prompts) {
    for (const a of p.accepts ?? []) {
      const target = extractTarget(a.action);

      if (a.kind === 'keyword') {
        // Handle both value (singular) and values (array)
        const values = a.values ?? (a.value ? [a.value] : []);
        for (const v of values) {
          transitions.push({
            from: p.id,
            input: { kind: 'keyword', value: v },
            to: target,
          });
        }
      } else if (a.kind === 'number') {
        transitions.push({
          from: p.id,
          input: { kind: 'number' },
          to: target,
        });
      } else if (a.kind === 'pick' || a.kind === 'shift_pick') {
        transitions.push({
          from: p.id,
          input: { kind: 'point', via: 'pick' },
          to: target,
        });
      } else if (a.kind === 'enter') {
        transitions.push({
          from: p.id,
          input: { kind: 'key', value: 'Enter' },
          to: target,
          notes: a.condition,
        });
      } else if (a.kind === 'escape') {
        transitions.push({
          from: p.id,
          input: { kind: 'key', value: 'Escape' },
          to: 'S0',
        });
      }
    }
  }

  return transitions;
}

function extractTarget(action?: string): string {
  if (!action) return 'S0';
  // Match patterns like advance(select_object), set_distance_then_advance(select_object)
  const match = action.match(/advance\((\w+)\)/);
  if (match) return match[1];
  // Patterns like end_command, cancel_command
  if (action.includes('end_command') || action.includes('cancel_command')) return 'S0';
  // Patterns like emit_fillet, trim_at_pick (stay in same state or end)
  if (action.includes('emit_') || action.includes('_at_pick')) return 'S0';
  // loop patterns like enable_multiple_then_loop(first_object_or_option)
  const loopMatch = action.match(/loop\((\w+)\)/);
  if (loopMatch) return loopMatch[1];
  return 'S0';
}

// --- Invariant building ----------------------------------------------------

function buildInvariants(spec: any): Invariant[] {
  const invariants: Invariant[] = [];
  const modeless = spec.modeless_during_command;

  if (!modeless) {
    // Provide sensible defaults — all CAD commands support these
    return [
      { name: 'esc-cancels', appliesTo: 'all', action: { kind: 'key', value: 'Escape' }, assertion: 'command ends' },
      { name: 'pan-middle-mouse', appliesTo: 'all', action: { kind: 'gesture', value: 'MiddleMouseDrag' }, assertion: 'viewport pans, state unchanged' },
      { name: 'zoom-scroll', appliesTo: 'all', action: { kind: 'gesture', value: 'WheelScroll' }, assertion: 'viewport zooms, state unchanged' },
    ];
  }

  // F-keys
  if (modeless.fkeys) {
    for (const [key, def] of Object.entries(modeless.fkeys) as [string, any][]) {
      invariants.push({
        name: `${key.toLowerCase()}-${def.action?.replace('toggle_', '') ?? key}`,
        appliesTo: 'all',
        action: { kind: 'key', value: key },
        assertion: `${def.action ?? key} toggles, state unchanged`,
      });
    }
  }

  // Mouse
  if (modeless.mouse) {
    if (modeless.mouse.middle_drag) {
      invariants.push({
        name: 'pan-middle-mouse',
        appliesTo: 'all',
        action: { kind: 'gesture', value: 'MiddleMouseDrag' },
        assertion: 'viewport pans, state unchanged',
      });
    }
    if (modeless.mouse.wheel_scroll) {
      invariants.push({
        name: 'zoom-scroll',
        appliesTo: 'all',
        action: { kind: 'gesture', value: 'WheelScroll' },
        assertion: 'viewport zooms at cursor, state unchanged',
      });
    }
  }

  // Always add esc
  invariants.push({
    name: 'esc-cancels',
    appliesTo: 'all',
    action: { kind: 'key', value: 'Escape' },
    assertion: 'command ends, returns to idle',
  });

  return invariants;
}

// --- Utilities -------------------------------------------------------------

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
