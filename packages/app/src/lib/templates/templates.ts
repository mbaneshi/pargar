import type { LinearUnit, AngularUnit } from '$lib/types/kernel';

export interface DrawingTemplate {
  id: string;
  name: string;
  description: string;
  units: {
    linearType: LinearUnit;
    linearPrecision: number;
    angularType: AngularUnit;
    angularPrecision: number;
    insertionScale: number;
  };
  layers: Array<{
    name: string;
    color: string;
    visible: boolean;
    locked: boolean;
  }>;
}

export const BUILT_IN_TEMPLATES: DrawingTemplate[] = [
  {
    id: 'blank-metric',
    name: 'Blank - Metric',
    description: 'Metric units (mm), decimal precision 4',
    units: {
      linearType: 'Decimal',
      linearPrecision: 4,
      angularType: 'DecimalDegrees',
      angularPrecision: 2,
      insertionScale: 1,
    },
    layers: [{ name: '0', color: '#ffffff', visible: true, locked: false }],
  },
  {
    id: 'blank-imperial',
    name: 'Blank - Imperial',
    description: 'Imperial units (inches), decimal precision 4',
    units: {
      linearType: 'Decimal',
      linearPrecision: 4,
      angularType: 'DecimalDegrees',
      angularPrecision: 2,
      insertionScale: 1,
    },
    layers: [{ name: '0', color: '#ffffff', visible: true, locked: false }],
  },
  {
    id: 'architectural',
    name: 'Architectural',
    description: 'Feet-inches, standard architectural layers',
    units: {
      linearType: 'Architectural',
      linearPrecision: 4,
      angularType: 'DecimalDegrees',
      angularPrecision: 2,
      insertionScale: 1,
    },
    layers: [
      { name: '0', color: '#ffffff', visible: true, locked: false },
      { name: 'Walls', color: '#ff0000', visible: true, locked: false },
      { name: 'Doors', color: '#00ff00', visible: true, locked: false },
      { name: 'Windows', color: '#0000ff', visible: true, locked: false },
      { name: 'Dimensions', color: '#ffff00', visible: true, locked: false },
      { name: 'Text', color: '#00ffff', visible: true, locked: false },
      { name: 'Furniture', color: '#ff00ff', visible: true, locked: false },
    ],
  },
  {
    id: 'mechanical',
    name: 'Mechanical',
    description: 'Metric decimal, standard mechanical layers',
    units: {
      linearType: 'Decimal',
      linearPrecision: 3,
      angularType: 'DecimalDegrees',
      angularPrecision: 1,
      insertionScale: 1,
    },
    layers: [
      { name: '0', color: '#ffffff', visible: true, locked: false },
      { name: 'Object', color: '#ffffff', visible: true, locked: false },
      { name: 'Hidden', color: '#00ff00', visible: true, locked: false },
      { name: 'Center', color: '#ff0000', visible: true, locked: false },
      { name: 'Dimensions', color: '#ffff00', visible: true, locked: false },
      { name: 'Section', color: '#00ffff', visible: true, locked: false },
    ],
  },
];
