import { describe, it, expect } from 'vitest';
import { svgAdapter, exportSvg } from '../svg-adapter.js';
import type { FileEntity, FileLayer } from '@nexus/core';

describe('svgAdapter', () => {
  it('has correct metadata', () => {
    expect(svgAdapter.id).toBe('svg');
    expect(svgAdapter.extensions).toEqual(['svg']);
    expect(svgAdapter.mimeType).toBe('image/svg+xml');
    expect(svgAdapter.capabilities.import).toBe(false);
    expect(svgAdapter.capabilities.export).toBe(true);
  });

  it('does not have an import method', () => {
    expect(svgAdapter.import).toBeUndefined();
  });
});

describe('exportSvg', () => {
  const defaultLayers: FileLayer[] = [{ id: '0', name: '0', color: '#ffffff' }];

  it('exports a line', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 10, y: 5 } } },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<line');
    expect(svg).toContain('x1="0"');
    expect(svg).toContain('y1="0"');
    expect(svg).toContain('x2="10"');
    expect(svg).toContain('y2="-5"');
  });

  it('exports a circle', () => {
    const entities: FileEntity[] = [
      { id: '1', geometry: { Circle: { center: { x: 5, y: 5 }, radius: 3 } }, layer_id: '0' },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<circle');
    expect(svg).toContain('cx="5"');
    expect(svg).toContain('cy="-5"');
    expect(svg).toContain('r="3"');
  });

  it('exports a rectangle', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: { Rectangle: { origin: { x: 0, y: 0 }, width: 10, height: 5 } },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<rect');
    expect(svg).toContain('width="10"');
    expect(svg).toContain('height="5"');
  });

  it('exports a closed polyline as polygon', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: {
          Polyline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 10 },
            ],
            closed: true,
          },
        },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<polygon');
  });

  it('exports an open polyline as polyline', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: {
          Polyline: {
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
            ],
            closed: false,
          },
        },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<polyline');
  });

  it('exports text with XML escaping', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: { Text: { position: { x: 0, y: 0 }, content: 'A < B & C', height: 5 } },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('A &lt; B &amp; C');
  });

  it('exports an arc with correct Y-flip and sweep-flag 1', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: {
          Arc: { center: { x: 0, y: 0 }, radius: 10, start_angle: 0, end_angle: Math.PI / 2 },
        },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    expect(svg).toContain('<path');
    // sweep-flag should be 1 due to Y-flip
    expect(svg).toMatch(/A\s+10\s+10\s+0\s+0\s+1/);
    // Start point: (10, 0) flipped to (10, -0)
    expect(svg).toContain('M 10 0');
  });

  it('handles counter-clockwise arc (>180 degrees) with large-arc flag', () => {
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: {
          Arc: { center: { x: 0, y: 0 }, radius: 5, start_angle: 0, end_angle: Math.PI * 1.5 },
        },
        layer_id: '0',
      },
    ];
    const svg = exportSvg(entities, defaultLayers);
    // large-arc should be 1 for > 180 degrees
    expect(svg).toMatch(/A\s+5\s+5\s+0\s+1\s+1/);
  });

  it('uses layer color when entity has no color', () => {
    const layers: FileLayer[] = [{ id: 'red-layer', name: 'Red', color: '#ff0000' }];
    const entities: FileEntity[] = [
      {
        id: '1',
        geometry: { Line: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } },
        layer_id: 'red-layer',
      },
    ];
    const svg = exportSvg(entities, layers);
    expect(svg).toContain('stroke="#ff0000"');
  });

  it('produces valid SVG for empty entity list', () => {
    const svg = exportSvg([], defaultLayers);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('exports a point as cross mark', () => {
    const entities: FileEntity[] = [
      { id: '1', geometry: { Point: { position: { x: 5, y: 3 } } }, layer_id: '0' },
    ];
    const svg = exportSvg(entities, defaultLayers);
    // Two lines forming an X
    expect(svg).toContain('x1="4"');
    expect(svg).toContain('x2="6"');
  });
});
