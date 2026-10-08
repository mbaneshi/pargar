// AutoCAD TRIM — executable state-machine model (provisional).
//
// Status: provisional — pending reconciliation with
//   notes/specs/autocad-2d/commands/trim.yaml when produced.
//
// AutoCAD 2021+ changed TRIM's default: Enter at boundary selection now
// selects ALL entities as cutting edges (no explicit pick needed). Our
// handler requires picking one boundary object — a significant flow gap
// for power users who never pick boundaries anymore.
//
// Shift-click to extend (crossing to the EXTEND command without restarting)
// is a hallmark power-user move that must be supported for parity.
//
// Sources: Autodesk AutoCAD Command Reference (TRIM), BricsCAD TRIM,
//   community docs on the 2021+ default-all behavior.

import type { ParityModel } from './types';

export const TRIM: ParityModel = {
  command: 'TRIM',
  aliases: ['TR'],
  sysvars: ['EDGEMODE', 'TRIMMODE'],

  states: {
    select_cutting_edges: {
      // AutoCAD 2021+ default: "Select cutting edges ... Select objects or <select all>:"
      // Enter here = select all as boundaries.
      prompt: /Select cutting edges[\s\S]*Select objects or <select all>:/,
      description: 'Select cutting edges, or Enter to use all entities as boundaries',
      options: [],
      default: 'select all',
    },
    select_to_trim: {
      // After boundary confirmed, the repeating trim prompt:
      prompt: /Select object to trim or shift-select to extend or \[Fence\/Crossing\/Project\/Edge\/eRase\/Undo\]:/,
      description: 'Pick entities to trim; shift-click extends instead; keyword options available',
      options: ['Fence', 'Crossing', 'Project', 'Edge', 'eRase', 'Undo'],
    },
  },

  transitions: [
    // select_cutting_edges
    { from: 'select_cutting_edges', input: { kind: 'point', via: 'pick' },  to: 'select_cutting_edges', effect: 'add picked entity to boundary set' },
    { from: 'select_cutting_edges', input: { kind: 'key', value: 'Enter' }, to: 'select_to_trim',        effect: 'confirm boundaries (or all if none picked)' },
    { from: 'select_cutting_edges', input: { kind: 'key', value: 'Space' }, to: 'select_to_trim',        effect: 'same as Enter' },

    // select_to_trim (repeating loop)
    { from: 'select_to_trim', input: { kind: 'point', via: 'pick' },     to: 'select_to_trim', effect: 'trim the picked entity at nearest boundary intersection' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'F' },    to: 'select_to_trim', effect: 'Fence mode: trim all entities crossing a fence line' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'C' },    to: 'select_to_trim', effect: 'Crossing mode: trim all in a crossing window' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'P' },    to: 'select_to_trim', effect: 'Project: set projection mode (None/UCS/View)' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'E' },    to: 'select_to_trim', effect: 'Edge: set extension mode (Extend/No extend)' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'R' },    to: 'select_to_trim', effect: 'eRase: pick objects to delete' },
    { from: 'select_to_trim', input: { kind: 'keyword', value: 'U' },    to: 'select_to_trim', effect: 'Undo last trim in this command' },
    { from: 'select_to_trim', input: { kind: 'key',     value: 'Enter' }, to: 'S0',             effect: 'end command' },
  ],

  invariants: [
    { name: 'pan-middle-mouse',      appliesTo: 'all', action: { kind: 'gesture', value: 'MiddleMouseDrag' },   assertion: 'viewport pans, state unchanged' },
    { name: 'zoom-scroll',           appliesTo: 'all', action: { kind: 'gesture', value: 'WheelScroll' },       assertion: 'viewport zooms at cursor, state unchanged' },
    { name: 'esc-cancels',           appliesTo: 'all', action: { kind: 'key',     value: 'Escape' },            assertion: 'command ends, returns to idle' },
    { name: 'f3-toggles-osnap',      appliesTo: 'all', action: { kind: 'key',     value: 'F3' },                assertion: 'OSMODE toggles, state unchanged' },
    { name: 'shift-click-extends',   appliesTo: ['select_to_trim'], action: { kind: 'gesture', value: 'ShiftClick' }, assertion: 'EXTEND the picked entity instead of trimming' },
  ],
};
