// AutoCAD OFFSET — executable projection of the canonical yaml spec.
//
// Source of truth: notes/specs/autocad-2d/commands/offset.yaml
// Provenance, citations, and unverified-facts list live in that file.
//
// This file is the subset that Playwright can mechanically assert. When the
// yaml is updated, this file must be updated to match (no separate research
// lives here). State keys mirror the yaml's prompt IDs verbatim.

import type { ParityModel } from './types';

export const OFFSET: ParityModel = {
  command: 'OFFSET',
  aliases: ['O'],
  sysvars: ['OFFSETDIST', 'OFFSETERASE', 'OFFSETLAYER', 'OFFSETGAPTYPE'],

  states: {
    distance_or_option: {
      // The <...> content is OFFSETDIST rendered: a number when >0, literal
      // "Through" when OFFSETDIST < 0 (sentinel for "last chose Through").
      prompt: /Specify offset distance or \[Through\/Erase\/Layer\] <(?:[\d.]+|Through)>:/,
      description: 'Initial: numeric distance, a keyword option, or Enter (uses OFFSETDIST)',
      options: ['Through', 'Erase', 'Layer'],
      default: '{OFFSETDIST}',
    },
    select_object: {
      prompt: /Select object to offset or \[Exit\/Undo\] <Exit>:/,
      description: 'Distance mode: pick the object to offset',
      options: ['Exit', 'Undo'],
      default: 'Exit',
    },
    select_object_through: {
      // Same prompt text as select_object; different accepted transitions (advances to through_point).
      prompt: /Select object to offset or \[Exit\/Undo\] <Exit>:/,
      description: 'Through mode: pick the object to offset',
      options: ['Exit', 'Undo'],
      default: 'Exit',
    },
    select_side: {
      prompt: /Specify point on side to offset or \[Exit\/Multiple\/Undo\] <Exit>:/,
      description: 'Distance mode: click which side of the object to offset toward',
      options: ['Exit', 'Multiple', 'Undo'],
      default: 'Exit',
    },
    through_point: {
      prompt: /Specify through point or \[Exit\/Multiple\/Undo\] <Exit>:/,
      description: 'Through mode: click the point the offset passes through',
      options: ['Exit', 'Multiple', 'Undo'],
      default: 'Exit',
    },
    erase_toggle: {
      prompt: /Erase source object after offsetting\? \[Yes\/No\] <[YN]>:/,
      description: 'Sub-prompt from Erase option; persists into OFFSETERASE',
      options: ['Yes', 'No'],
      default: '{OFFSETERASE_Y_OR_N}',
    },
    layer_choice: {
      prompt: /Enter layer option for offset objects \[Current\/Source\] <(?:Current|Source)>:/,
      description: 'Sub-prompt from Layer option; persists into OFFSETLAYER',
      options: ['Current', 'Source'],
      default: '{OFFSETLAYER}',
    },
  },

  transitions: [
    // distance_or_option
    { from: 'distance_or_option', input: { kind: 'number', unit: 'distance' }, to: 'select_object',         effect: 'OFFSETDIST := entered value, mode=distance' },
    { from: 'distance_or_option', input: { kind: 'keyword', value: 'T' },      to: 'select_object_through', effect: 'mode=through, OFFSETDIST := -|OFFSETDIST|' },
    { from: 'distance_or_option', input: { kind: 'keyword', value: 'E' },      to: 'erase_toggle' },
    { from: 'distance_or_option', input: { kind: 'keyword', value: 'L' },      to: 'layer_choice' },
    { from: 'distance_or_option', input: { kind: 'key', value: 'Enter' },      to: 'select_object',         notes: 'taken when OFFSETDIST > 0' },
    { from: 'distance_or_option', input: { kind: 'key', value: 'Enter' },      to: 'select_object_through', notes: 'taken when OFFSETDIST < 0 (Through sentinel)' },

    // erase_toggle / layer_choice loop back
    { from: 'erase_toggle', input: { kind: 'keyword', value: 'Y' }, to: 'distance_or_option', effect: 'OFFSETERASE := 1' },
    { from: 'erase_toggle', input: { kind: 'keyword', value: 'N' }, to: 'distance_or_option', effect: 'OFFSETERASE := 0' },
    { from: 'erase_toggle', input: { kind: 'key', value: 'Enter' }, to: 'distance_or_option', notes: 'uses OFFSETERASE default' },
    { from: 'layer_choice', input: { kind: 'keyword', value: 'C' }, to: 'distance_or_option', effect: 'OFFSETLAYER := 0' },
    { from: 'layer_choice', input: { kind: 'keyword', value: 'S' }, to: 'distance_or_option', effect: 'OFFSETLAYER := 1' },
    { from: 'layer_choice', input: { kind: 'key', value: 'Enter' }, to: 'distance_or_option', notes: 'uses OFFSETLAYER default' },

    // select_object (distance mode)
    { from: 'select_object', input: { kind: 'point',   via: 'pick' },    to: 'select_side' },
    { from: 'select_object', input: { kind: 'keyword', value: 'E' },     to: 'S0',            effect: 'end command' },
    { from: 'select_object', input: { kind: 'keyword', value: 'U' },     to: 'select_object', effect: 'undo last offset this command' },
    { from: 'select_object', input: { kind: 'key',     value: 'Enter' }, to: 'S0',            effect: 'default=Exit' },

    // select_object_through (through mode)
    { from: 'select_object_through', input: { kind: 'point', via: 'pick' },    to: 'through_point' },
    { from: 'select_object_through', input: { kind: 'key',   value: 'Enter' }, to: 'S0' },

    // select_side (distance mode loop)
    { from: 'select_side', input: { kind: 'point',   via: 'pick' },    to: 'select_object', effect: 'emit offset, loop to select' },
    { from: 'select_side', input: { kind: 'keyword', value: 'M' },     to: 'select_side',   effect: 'Multiple: repeat on same source' },
    { from: 'select_side', input: { kind: 'keyword', value: 'U' },     to: 'select_object', effect: 'undo last offset, back to select' },
    { from: 'select_side', input: { kind: 'keyword', value: 'E' },     to: 'S0' },
    { from: 'select_side', input: { kind: 'key',     value: 'Enter' }, to: 'S0' },

    // through_point (through mode loop)
    { from: 'through_point', input: { kind: 'point',   via: 'pick' },    to: 'select_object_through' },
    { from: 'through_point', input: { kind: 'keyword', value: 'M' },     to: 'through_point' },
    { from: 'through_point', input: { kind: 'key',     value: 'Enter' }, to: 'S0' },
  ],

  invariants: [
    // Modeless: must work mid-command without canceling.
    { name: 'pan-middle-mouse',   appliesTo: 'all', action: { kind: 'gesture', value: 'MiddleMouseDrag' }, assertion: 'viewport pans, state unchanged' },
    { name: 'zoom-scroll',        appliesTo: 'all', action: { kind: 'gesture', value: 'WheelScroll' },     assertion: 'viewport zooms at cursor, state unchanged' },
    { name: 'transparent-pan',    appliesTo: 'all', action: { kind: 'keyword', value: "'PAN" },            assertion: 'PAN runs transparently, returns to current state' },
    { name: 'transparent-zoom',   appliesTo: 'all', action: { kind: 'keyword', value: "'ZOOM" },           assertion: 'ZOOM runs transparently, returns to current state' },
    { name: 'f3-toggles-osnap',   appliesTo: 'all', action: { kind: 'key', value: 'F3' },                  assertion: 'OSMODE toggles, state unchanged' },
    { name: 'f8-toggles-ortho',   appliesTo: 'all', action: { kind: 'key', value: 'F8' },                  assertion: 'ORTHOMODE toggles, state unchanged' },
    { name: 'f10-toggles-polar',  appliesTo: 'all', action: { kind: 'key', value: 'F10' },                 assertion: 'polar tracking toggles, state unchanged' },
    { name: 'f11-toggles-otrack', appliesTo: 'all', action: { kind: 'key', value: 'F11' },                 assertion: 'object snap tracking toggles, state unchanged' },
    { name: 'f12-toggles-dynin',  appliesTo: 'all', action: { kind: 'key', value: 'F12' },                 assertion: 'DYNMODE toggles, state unchanged' },

    // Cancel semantics.
    { name: 'esc-once-cancels',   appliesTo: 'all', action: { kind: 'key', value: 'Escape' },              assertion: 'command ends, selection preserved' },
    { name: 'esc-twice-clears',   appliesTo: 'all', action: { kind: 'key', value: 'EscapeEscape' },        assertion: 'command ends, selection cleared' },

    // Right-click behavior during a transparent-permitting command.
    { name: 'rightclick-menu',    appliesTo: 'all', action: { kind: 'gesture', value: 'RightClick' },      assertion: 'context menu shows Enter / Cancel / Recent Input / Pan / Zoom / Snap Overrides' },
  ],
};
