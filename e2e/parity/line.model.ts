// AutoCAD LINE — executable state-machine model (provisional).
//
// Status: provisional — pending reconciliation with
//   notes/specs/autocad-2d/commands/line.yaml when produced.
//
// Sources: Autodesk AutoCAD Command Reference (LINE), common community docs.

import type { ParityModel } from './types';

export const LINE: ParityModel = {
  command: 'LINE',
  aliases: ['L'],
  sysvars: ['ORTHOMODE', 'OSMODE'],

  states: {
    first_point: {
      prompt: /Specify first point:/,
      description: 'Waiting for the start point of the line chain',
      options: [],
    },
    next_point: {
      // After first point: [Undo]; after 2+ segments: [Close/Undo].
      prompt: /Specify next point or \[(?:Close\/)?Undo\]:/,
      description: 'Waiting for the next point; each input extends the chain',
      options: ['Close', 'Undo'],
    },
  },

  transitions: [
    // first_point
    { from: 'first_point', input: { kind: 'point', via: 'coord' },    to: 'next_point' },
    { from: 'first_point', input: { kind: 'point', via: 'pick' },     to: 'next_point' },
    { from: 'first_point', input: { kind: 'point', via: 'relative' }, to: 'next_point', notes: '@x,y relative input' },
    { from: 'first_point', input: { kind: 'point', via: 'polar' },    to: 'next_point', notes: '@d<a polar input' },

    // next_point
    { from: 'next_point', input: { kind: 'point', via: 'coord' },    to: 'next_point', effect: 'emit CreateLine from prev to here, chainCount++' },
    { from: 'next_point', input: { kind: 'point', via: 'pick' },     to: 'next_point', effect: 'emit CreateLine from prev to here, chainCount++' },
    { from: 'next_point', input: { kind: 'point', via: 'relative' }, to: 'next_point', effect: 'relative @x,y from last point' },
    { from: 'next_point', input: { kind: 'point', via: 'polar' },    to: 'next_point', effect: 'polar @d<a from last point' },
    { from: 'next_point', input: { kind: 'keyword', value: 'C' },    to: 'S0',         effect: 'Close: emit line back to first point, end command', notes: 'only valid when chainCount >= 2' },
    { from: 'next_point', input: { kind: 'keyword', value: 'U' },    to: 'next_point', effect: 'Undo: remove last segment, chainCount--; if chainCount=0 → first_point' },
    { from: 'next_point', input: { kind: 'key', value: 'Enter' },    to: 'S0',         effect: 'end command (chain done)' },
    { from: 'next_point', input: { kind: 'key', value: 'Space' },    to: 'S0',         effect: 'same as Enter — end command' },
  ],

  invariants: [
    { name: 'pan-middle-mouse',   appliesTo: 'all', action: { kind: 'gesture', value: 'MiddleMouseDrag' }, assertion: 'viewport pans, state unchanged' },
    { name: 'zoom-scroll',        appliesTo: 'all', action: { kind: 'gesture', value: 'WheelScroll' },     assertion: 'viewport zooms at cursor, state unchanged' },
    { name: 'esc-cancels',        appliesTo: 'all', action: { kind: 'key',     value: 'Escape' },          assertion: 'command ends, returns to idle' },
    { name: 'f3-toggles-osnap',   appliesTo: 'all', action: { kind: 'key',     value: 'F3' },              assertion: 'OSMODE toggles, state unchanged' },
    { name: 'f8-toggles-ortho',   appliesTo: 'all', action: { kind: 'key',     value: 'F8' },              assertion: 'ORTHOMODE toggles, state unchanged — critical for LINE' },
    { name: 'f10-toggles-polar',  appliesTo: 'all', action: { kind: 'key',     value: 'F10' },             assertion: 'polar tracking toggles, state unchanged' },
    { name: 'f12-toggles-dynin',  appliesTo: 'all', action: { kind: 'key',     value: 'F12' },             assertion: 'DYNMODE toggles, state unchanged' },
  ],
};
