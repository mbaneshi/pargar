// AutoCAD CIRCLE — executable state-machine model (provisional).
//
// Status: provisional — pending reconciliation with
//   notes/specs/autocad-2d/commands/circle.yaml when produced.
//
// AutoCAD CIRCLE has many entry modes. Our current handler only supports
// Center+Radius and Center+Diameter. The model covers the full set so
// missing modes are surfaced as fixme'd tests.
//
// Sources: Autodesk AutoCAD Command Reference (CIRCLE), common community docs.

import type { ParityModel } from './types';

export const CIRCLE: ParityModel = {
  command: 'CIRCLE',
  aliases: ['C'],
  sysvars: [],

  states: {
    center_point: {
      prompt: /Specify center point for circle or \[3P\/2P\/Ttr \(tan tan radius\)\]:/,
      description: 'Initial: ask for center or pick alternate mode',
      options: ['3P', '2P', 'Ttr'],
    },
    radius: {
      prompt: /Specify radius of circle or \[Diameter\]:/,
      description: 'After center picked, specify radius by point or number',
      options: ['Diameter'],
    },
    diameter: {
      prompt: /Specify diameter of circle or \[Radius\]:/,
      description: 'After center picked and D chosen, specify diameter',
      options: ['Radius'],
    },
    two_point_first: {
      prompt: /Specify first end point of circle's diameter:/,
      description: '2P mode: first point of diameter',
      options: [],
    },
    two_point_second: {
      prompt: /Specify second end point of circle's diameter:/,
      description: '2P mode: second point — circle computed from diameter',
      options: [],
    },
    three_point_first: {
      prompt: /Specify first point on circle:/,
      description: '3P mode: first of three circumscribed points',
      options: [],
    },
    three_point_second: {
      prompt: /Specify second point on circle:/,
      description: '3P mode: second point',
      options: [],
    },
    three_point_third: {
      prompt: /Specify third point on circle:/,
      description: '3P mode: third point — circle computed',
      options: [],
    },
    ttr_first_tangent: {
      prompt: /Specify point on object for first tangent of circle:/,
      description: 'TTR mode: pick first tangent entity',
      options: [],
    },
    ttr_second_tangent: {
      prompt: /Specify point on object for second tangent of circle:/,
      description: 'TTR mode: pick second tangent entity',
      options: [],
    },
    ttr_radius: {
      prompt: /Specify radius of circle:/,
      description: 'TTR mode: specify radius, circle tangent to both',
      options: [],
    },
  },

  transitions: [
    // center_point
    { from: 'center_point', input: { kind: 'point', via: 'pick' },     to: 'radius' },
    { from: 'center_point', input: { kind: 'point', via: 'coord' },    to: 'radius' },
    { from: 'center_point', input: { kind: 'keyword', value: '3P' },   to: 'three_point_first' },
    { from: 'center_point', input: { kind: 'keyword', value: '2P' },   to: 'two_point_first' },
    { from: 'center_point', input: { kind: 'keyword', value: 'T' },    to: 'ttr_first_tangent', notes: 'Ttr' },

    // radius / diameter toggle
    { from: 'radius',   input: { kind: 'point', via: 'pick' },      to: 'S0', effect: 'emit CreateCircle, radius = dist(center, point)' },
    { from: 'radius',   input: { kind: 'number', unit: 'distance' }, to: 'S0', effect: 'emit CreateCircle' },
    { from: 'radius',   input: { kind: 'keyword', value: 'D' },     to: 'diameter' },
    { from: 'diameter', input: { kind: 'point', via: 'pick' },      to: 'S0', effect: 'emit CreateCircle, radius = dist/2' },
    { from: 'diameter', input: { kind: 'number', unit: 'distance' }, to: 'S0', effect: 'emit CreateCircle, radius = value/2' },
    { from: 'diameter', input: { kind: 'keyword', value: 'R' },     to: 'radius' },

    // 2P mode
    { from: 'two_point_first',  input: { kind: 'point', via: 'pick' }, to: 'two_point_second' },
    { from: 'two_point_second', input: { kind: 'point', via: 'pick' }, to: 'S0', effect: 'center = midpoint, radius = dist/2' },

    // 3P mode
    { from: 'three_point_first',  input: { kind: 'point', via: 'pick' }, to: 'three_point_second' },
    { from: 'three_point_second', input: { kind: 'point', via: 'pick' }, to: 'three_point_third' },
    { from: 'three_point_third',  input: { kind: 'point', via: 'pick' }, to: 'S0', effect: 'circumscribed circle through 3 points' },

    // TTR mode
    { from: 'ttr_first_tangent',  input: { kind: 'point', via: 'pick' }, to: 'ttr_second_tangent' },
    { from: 'ttr_second_tangent', input: { kind: 'point', via: 'pick' }, to: 'ttr_radius' },
    { from: 'ttr_radius',         input: { kind: 'number', unit: 'distance' }, to: 'S0', effect: 'circle tangent to both, with given radius' },
  ],

  invariants: [
    { name: 'pan-middle-mouse', appliesTo: 'all', action: { kind: 'gesture', value: 'MiddleMouseDrag' }, assertion: 'viewport pans, state unchanged' },
    { name: 'zoom-scroll',      appliesTo: 'all', action: { kind: 'gesture', value: 'WheelScroll' },     assertion: 'viewport zooms at cursor, state unchanged' },
    { name: 'esc-cancels',      appliesTo: 'all', action: { kind: 'key',     value: 'Escape' },          assertion: 'command ends, returns to idle' },
    { name: 'f3-toggles-osnap', appliesTo: 'all', action: { kind: 'key',     value: 'F3' },              assertion: 'OSMODE toggles, state unchanged' },
    { name: 'f8-toggles-ortho', appliesTo: 'all', action: { kind: 'key',     value: 'F8' },              assertion: 'ORTHOMODE toggles, state unchanged' },
  ],
};
