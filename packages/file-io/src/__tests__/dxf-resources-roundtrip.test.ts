import { describe, it, expect } from 'vitest';
import { exportDxf } from '../dxf-export.js';
import { parseDxfFull } from '../dxf-import.js';

describe('DXF round-trip: DWGPROPS, VIEW table, UCS table', () => {
  it('writes drawing properties to HEADER section', () => {
    const dwgProps = JSON.stringify({
      title: 'Site Plan',
      author: 'Mehdi',
      keywords: 'plan, foundations',
    });
    const dxf = exportDxf('[]', undefined, undefined, undefined, dwgProps);
    expect(dxf).toContain('$TITLE');
    expect(dxf).toContain('Site Plan');
    expect(dxf).toContain('$AUTHOR');
    expect(dxf).toContain('Mehdi');
    expect(dxf).toContain('$KEYWORDS');
  });

  it('round-trips DWGPROPS through export and re-import', () => {
    const dwgProps = JSON.stringify({
      title: 'Round Trip',
      subject: 'Test',
      author: 'Author',
      keywords: 'rt',
      comments: 'A single-line comment',
      hyperlink_base: 'https://example.com/',
      last_saved_by: 'CI',
    });
    const dxf = exportDxf('[]', undefined, undefined, undefined, dwgProps);
    const re = parseDxfFull(dxf);
    expect(re.dwgProps).toBeDefined();
    expect(re.dwgProps?.title).toBe('Round Trip');
    expect(re.dwgProps?.author).toBe('Author');
    expect(re.dwgProps?.subject).toBe('Test');
    expect(re.dwgProps?.last_saved_by).toBe('CI');
  });

  it('omits DWGPROPS header vars when source is empty', () => {
    const dxf = exportDxf('[]');
    expect(dxf).not.toContain('$TITLE');
    expect(dxf).not.toContain('$AUTHOR');
  });

  it('writes a VIEW table when named views are provided', () => {
    const views = JSON.stringify([
      { name: 'Front', center_x: 100, center_y: 50, zoom: 25, rotation: 0 },
      { name: 'Detail', center_x: 200, center_y: 200, zoom: 5, rotation: 1.5708 },
    ]);
    const dxf = exportDxf('[]', undefined, undefined, undefined, undefined, views);
    expect(dxf).toContain('VIEW');
    expect(dxf).toContain('Front');
    expect(dxf).toContain('Detail');
  });

  it('round-trips named views', () => {
    const views = JSON.stringify([
      { name: 'V1', center_x: 7, center_y: 11, zoom: 13, rotation: 0 },
    ]);
    const dxf = exportDxf('[]', undefined, undefined, undefined, undefined, views);
    const re = parseDxfFull(dxf);
    expect(re.namedViews).toBeDefined();
    expect(re.namedViews?.length).toBe(1);
    const v = re.namedViews![0];
    expect(v.name).toBe('V1');
    expect(v.center_x).toBeCloseTo(7);
    expect(v.center_y).toBeCloseTo(11);
    expect(v.zoom).toBeCloseTo(13);
  });

  it('writes a UCS table when named UCS are provided', () => {
    const ucs = JSON.stringify([
      {
        name: 'Site',
        origin: { x: 100, y: 50 },
        x_axis: { x: 1, y: 0 },
        y_axis: { x: 0, y: 1 },
      },
    ]);
    const dxf = exportDxf('[]', undefined, undefined, undefined, undefined, undefined, ucs);
    expect(dxf).toContain('UCS');
    expect(dxf).toContain('Site');
  });

  it('round-trips named UCS', () => {
    const ucs = JSON.stringify([
      {
        name: 'U1',
        origin: { x: 1, y: 2 },
        x_axis: { x: 0.7071, y: 0.7071 },
        y_axis: { x: -0.7071, y: 0.7071 },
      },
    ]);
    const dxf = exportDxf('[]', undefined, undefined, undefined, undefined, undefined, ucs);
    const re = parseDxfFull(dxf);
    expect(re.namedUcs).toBeDefined();
    expect(re.namedUcs?.length).toBe(1);
    const u = re.namedUcs![0];
    expect(u.name).toBe('U1');
    expect(u.origin_x).toBeCloseTo(1);
    expect(u.origin_y).toBeCloseTo(2);
    expect(u.x_axis_x).toBeCloseTo(0.7071);
  });

  it('skips the World UCS on import (kernel reserves it)', () => {
    const ucs = JSON.stringify([
      {
        name: 'World',
        origin: { x: 0, y: 0 },
        x_axis: { x: 1, y: 0 },
        y_axis: { x: 0, y: 1 },
      },
      {
        name: 'Site',
        origin: { x: 5, y: 5 },
        x_axis: { x: 1, y: 0 },
        y_axis: { x: 0, y: 1 },
      },
    ]);
    const dxf = exportDxf('[]', undefined, undefined, undefined, undefined, undefined, ucs);
    const re = parseDxfFull(dxf);
    expect(re.namedUcs?.length).toBe(1);
    expect(re.namedUcs?.[0].name).toBe('Site');
  });
});
