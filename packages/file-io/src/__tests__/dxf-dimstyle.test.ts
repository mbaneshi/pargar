import { describe, it, expect } from 'vitest';
import { exportDxf } from '../dxf-export.js';
import { parseDxfFull } from '../dxf-import.js';

describe('DXF DIMSTYLE round-trip (A1.4)', () => {
  it('writes a DIMSTYLE table from kernel dim_styles', () => {
    const entities = '[]';
    const layers = JSON.stringify([
      { id: '0', name: '0', color: '#ffffff', visible: true, locked: false },
    ]);
    const dimStyles = JSON.stringify([
      {
        name: 'Standard',
        dimscale: 1.0,
        dimtxt: 2.5,
        dimasz: 2.5,
        dimexo: 0.625,
        dimexe: 1.25,
        dimgap: 0.625,
        dimtad: 1,
      },
      {
        name: 'Architectural',
        dimscale: 48,
        dimtxt: 3.5,
        dimasz: 3.0,
        dimexo: 0.0625,
        dimexe: 0.18,
        dimgap: 0.09,
        dimtad: 1,
      },
    ]);
    const dxf = exportDxf(entities, layers, undefined, dimStyles);

    expect(dxf).toContain('DIMSTYLE');
    expect(dxf).toContain('Standard');
    expect(dxf).toContain('Architectural');
    // DIMSCALE field for Architectural (group code 40, value 48)
    expect(dxf).toContain('48');
  });

  it('writes a Standard fallback when no dim styles JSON given', () => {
    const dxf = exportDxf('[]', undefined, undefined, undefined);
    expect(dxf).toContain('DIMSTYLE');
    expect(dxf).toContain('Standard');
  });

  it('falls back to Standard if dimStylesJson is malformed', () => {
    const dxf = exportDxf('[]', undefined, undefined, 'not-json');
    expect(dxf).toContain('Standard');
  });

  it('writes per-dimension style_name in DXF group code 3', () => {
    const entities = JSON.stringify([
      {
        id: 'd1',
        geometry: {
          Dimension: {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
            offset: 5,
            text_override: null,
            style_name: 'Architectural',
          },
        },
        layer_id: '0',
      },
    ]);
    const dxf = exportDxf(entities, undefined, undefined, undefined);

    // Find the DIMENSION block and verify code 3 is "Architectural"
    const lines = dxf.split('\n').map((l) => l.trim());
    const dimIdx = lines.findIndex((l) => l === 'DIMENSION');
    expect(dimIdx).toBeGreaterThan(-1);
    // Search forward from DIMENSION for the next "3" code, value should be Architectural
    let foundStyle = false;
    for (let i = dimIdx; i < dimIdx + 20 && i < lines.length - 1; i++) {
      if (lines[i] === '3' && lines[i + 1] === 'Architectural') {
        foundStyle = true;
        break;
      }
    }
    expect(foundStyle).toBe(true);
  });

  it('falls back to Standard when style_name is null on a dimension', () => {
    const entities = JSON.stringify([
      {
        id: 'd1',
        geometry: {
          Dimension: {
            start: { x: 0, y: 0 },
            end: { x: 10, y: 0 },
            offset: 5,
            text_override: null,
            style_name: null,
          },
        },
        layer_id: '0',
      },
    ]);
    const dxf = exportDxf(entities, undefined, undefined, undefined);
    const lines = dxf.split('\n').map((l) => l.trim());
    const dimIdx = lines.findIndex((l) => l === 'DIMENSION');
    let foundStandard = false;
    for (let i = dimIdx; i < dimIdx + 20 && i < lines.length - 1; i++) {
      if (lines[i] === '3' && lines[i + 1] === 'Standard') {
        foundStandard = true;
        break;
      }
    }
    expect(foundStandard).toBe(true);
  });

  it('preserves style_name on dimension round-trip', () => {
    const entities = JSON.stringify([
      {
        id: 'd1',
        geometry: {
          Dimension: {
            start: { x: 0, y: 0 },
            end: { x: 100, y: 0 },
            offset: 10,
            text_override: null,
            style_name: 'Mech',
          },
        },
        layer_id: '0',
      },
    ]);
    const dxf = exportDxf(entities, undefined, undefined, undefined);
    const reimported = parseDxfFull(dxf);

    expect(reimported.entities.length).toBeGreaterThanOrEqual(1);
    const dim = reimported.entities.find((e) => e.geometry?.Dimension);
    expect(dim).toBeDefined();
    expect(dim?.geometry.Dimension.style_name).toBe('Mech');
  });

  it('preserves style_name on radial/diameter/angular dimensions', () => {
    // Note: AlignedDimension is exported as DXF type-1 but the importer maps
    // both Linear (0) and Aligned (1) to Dimension on the way back — that's a
    // pre-existing import-side simplification (out of scope for A1.4).
    // This test covers the dimension types whose round-trip is type-stable.
    const entities = JSON.stringify([
      {
        id: 'r',
        geometry: {
          RadialDimension: {
            center: { x: 0, y: 0 },
            point_on_arc: { x: 10, y: 0 },
            text_override: null,
            style_name: 'StyleR',
          },
        },
        layer_id: '0',
      },
      {
        id: 'd',
        geometry: {
          DiameterDimension: {
            center: { x: 0, y: 0 },
            point_on_arc: { x: 5, y: 0 },
            text_override: null,
            style_name: 'StyleD',
          },
        },
        layer_id: '0',
      },
      {
        id: 'g',
        geometry: {
          AngularDimension: {
            center: { x: 0, y: 0 },
            start_ray: { x: 10, y: 0 },
            end_ray: { x: 0, y: 10 },
            radius: 10,
            text_override: null,
            style_name: 'StyleG',
          },
        },
        layer_id: '0',
      },
    ]);
    const dxf = exportDxf(entities, undefined, undefined, undefined);
    const reimported = parseDxfFull(dxf);

    const radial = reimported.entities.find((e) => e.geometry?.RadialDimension);
    const diameter = reimported.entities.find((e) => e.geometry?.DiameterDimension);
    const angular = reimported.entities.find((e) => e.geometry?.AngularDimension);

    expect(radial?.geometry.RadialDimension.style_name).toBe('StyleR');
    expect(diameter?.geometry.DiameterDimension.style_name).toBe('StyleD');
    expect(angular?.geometry.AngularDimension.style_name).toBe('StyleG');
  });
});
