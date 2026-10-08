import type { FileFormatAdapter, FileEntity, FileLayer, ImportResult } from '@nexus/core';
import { parseDxfFull } from './dxf-import.js';
import { exportDxf } from './dxf-export.js';

export const dxfAdapter: FileFormatAdapter = {
  id: 'dxf',
  name: 'AutoCAD DXF',
  extensions: ['dxf'],
  mimeType: 'application/dxf',
  capabilities: { import: true, export: true },

  import(content: string): ImportResult {
    const result = parseDxfFull(content);
    const entities: FileEntity[] = result.entities.map((e, i) => ({
      id: `imported-${i}`,
      geometry: e.geometry,
      layer_id: e.layer || '0',
      layer: e.layer,
      color: e.color,
      linetype: e.linetype,
    }));
    const layers: FileLayer[] = result.layers.map((l) => ({
      id: l.name,
      name: l.name,
      color: l.color,
      visible: !l.frozen,
      locked: l.locked,
      linetype: l.linetype,
    }));
    return { entities, layers };
  },

  export(entities: FileEntity[], layers: FileLayer[]): string {
    return exportDxf(JSON.stringify(entities), JSON.stringify(layers));
  },
};
