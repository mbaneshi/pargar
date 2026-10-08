# 36 — File I/O System Design: Multi-Format Adapter Architecture

> **Status:** Implementation proposal (2026-04-19)
> **Depends on:** 03-data-interoperability, 14-ports-adapters-design, 28-file-format-integrity
> **Research basis:** docs/research/09-file-io-ecosystem.md
> **Scope:** Replace hand-rolled format-specific code with a port/adapter registry that scales across DXF, IFC, GeoJSON, LandXML, STEP, PDF, SVG

---

## Problem Statement

The file-io package is 1,044 lines of hand-rolled format-specific code. It works for v0.1 (DXF + PDF). But the expansion path requires:

| Format | Domain | Library | Complexity |
|--------|--------|---------|-----------|
| DXF | 2D CAD | dxf-parser (import), hand-rolled (export) | Medium |
| DWG | 2D/3D CAD | ODA SDK or server-side conversion | High (proprietary) |
| IFC | BIM | web-ifc (WASM) | High (876 entity types) |
| GeoJSON/SHP/GPKG | GIS | gdal3.js or georust | Medium |
| LandXML | Civil | Custom parser (quick-xml) | Medium |
| STEP/IGES | 3D Exchange | truck or opencascade.js | Very High |
| PDF | Output | jsPDF (current) | Low |
| SVG | Output | Hand-rolled | Low |

If each format gets its own hand-rolled import/export pipeline, we'll maintain thousands of lines of format-specific code, each with its own bugs, each losing semantics in its own way. This violates Rule 4 (additive expansion) and Rule 7 (use existing libraries).

---

## Current State Diagnosis

### Architecture

```
AppState.svelte.ts (consumer)
    ↓ dynamic import
@nexus/file-io
    ├── dxf-import.ts   (275 LOC, library: dxf-parser)
    ├── dxf-export.ts   (365 LOC, hand-rolled string builder)
    ├── pdf-export.ts   (172 LOC, library: jsPDF)
    ├── persistence.ts  (217 LOC, OPFS + localStorage)
    └── index.ts        (15 LOC, barrel exports)
```

### Coupling Points

1. **Zero type safety:** file-io has no imports from @nexus/core or @nexus/kernel. Entity schema is inferred from JSON — schema drift is silent.
2. **Entity mapping is scattered:** Each format file has its own if-chain mapping geometry types. Adding an entity type to the kernel requires modifying every format file.
3. **No shared canonical model:** DXF import produces `{ geometry: { Line: { start, end } } }` by convention, not by type contract.
4. **No pass-through preservation:** Unsupported entities are silently dropped. DXF entities the kernel doesn't understand vanish — violates doc 28 recommendation.

### Lossiness Map

| Translation | What's Lost | Fixable? |
|---|---|---|
| DXF → NEXUS: Bulge tessellation | Arc segments become line segments | No (architectural — would need bulge component) |
| DXF → NEXUS: Color range | Only 9 ACI colors mapped | Yes (expand palette) |
| DXF → NEXUS: Z-coordinates | 3D data stripped | No (NEXUS is 2D v0.1) |
| NEXUS → DXF: Rectangle | Exported as LWPOLYLINE, re-imports as Polyline | Yes (type hint metadata) |
| NEXUS → DXF: Dimension | Decomposed to LINE+TEXT | Yes (proper DIMENSION entity — F8 task) |
| NEXUS → DXF: Unsupported entities | Silently dropped | Yes (pass-through storage) |

---

## Proposed Architecture

### Core Principle

**One canonical model, N adapters.** The kernel entity types ARE the canonical model. Each format adapter translates between the kernel schema and the format's native concepts. Libraries handle the heavy lifting (Rule 7). Adding a format = implementing one adapter, not modifying core code (Rule 4).

### Layer Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    Consumers (App Layer)                     │
│  AppState · FileMenu · MCP Tools · CLI Commands             │
└──────────────────────────┬─────────────────────────────────┘
                           │ FileFormatRegistry.import/export
┌──────────────────────────▼─────────────────────────────────┐
│                  FileFormatRegistry                          │
│  register(adapter) · getByExtension() · import() · export() │
│  Canonical types: Entity[], Layer[], TextStyle[], Units      │
└──────────┬────────┬────────┬────────┬────────┬─────────────┘
           │        │        │        │        │
     ┌─────▼──┐ ┌──▼───┐ ┌──▼──┐ ┌──▼───┐ ┌──▼───┐
     │  DXF   │ │ IFC  │ │ GIS │ │ STEP │ │ PDF  │
     │Adapter │ │Adapt.│ │Adapt│ │Adapt.│ │Adapt.│
     │        │ │      │ │     │ │      │ │      │
     │dxf-    │ │web-  │ │gdal │ │truck/│ │jsPDF │
     │parser  │ │ifc   │ │3.js │ │occt  │ │      │
     └────────┘ └──────┘ └─────┘ └──────┘ └──────┘
```

### Type Contracts

```typescript
// packages/core/src/file-io-types.ts

import type { Entity, Layer, TextStyle, DrawingUnits } from './types';

interface ImportResult {
  entities: Entity[];
  layers: Layer[];
  textStyles?: TextStyle[];
  units?: DrawingUnits;
  warnings: ImportWarning[];       // lossy translations documented
  passthrough?: PassthroughData[]; // raw data we couldn't parse
}

interface ImportWarning {
  entityId?: string;
  code: 'LOSSY_CONVERSION' | 'UNSUPPORTED_ENTITY' | 'MISSING_REFERENCE' | 'PRECISION_LOSS';
  message: string;
  sourceFormat: string;
  sourceData?: unknown;            // original data for debugging
}

interface PassthroughData {
  format: string;                  // "dxf", "ifc"
  entityType: string;              // "XDATA", "LEADER", etc.
  rawData: unknown;                // format-specific opaque data
}

interface ExportOptions {
  format: string;
  includePassthrough?: boolean;    // re-emit stored passthrough data
  precision?: number;
  layers?: string[];               // filter to specific layers
}

interface FileFormatAdapter {
  id: string;                      // "dxf", "ifc", "geojson", "pdf", "svg"
  extensions: string[];            // [".dxf", ".DXF"]
  displayName: string;             // "AutoCAD DXF (R2000)"
  capabilities: FormatCapability[];
  
  // Optional magic-byte detection
  canHandle?(data: ArrayBuffer): boolean;
  
  // Import: format → canonical types
  import?(data: ArrayBuffer | string, options?: Record<string, unknown>): ImportResult;
  
  // Export: canonical types → format
  export?(
    entities: Entity[],
    layers: Layer[],
    options?: ExportOptions
  ): ArrayBuffer | string;
}

type FormatCapability = 'import' | 'export' | 'round-trip';
```

### FileFormatRegistry

```typescript
// packages/file-io/src/FileFormatRegistry.ts

class FileFormatRegistry {
  private adapters = new Map<string, FileFormatAdapter>();
  
  register(adapter: FileFormatAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }
  
  getImporters(): FileFormatAdapter[] {
    return [...this.adapters.values()].filter(a => 
      a.capabilities.includes('import')
    );
  }
  
  getExporters(): FileFormatAdapter[] {
    return [...this.adapters.values()].filter(a => 
      a.capabilities.includes('export')
    );
  }
  
  getByExtension(ext: string): FileFormatAdapter | undefined {
    const lower = ext.toLowerCase();
    for (const adapter of this.adapters.values()) {
      if (adapter.extensions.some(e => e.toLowerCase() === lower)) {
        return adapter;
      }
    }
    return undefined;
  }
  
  async import(
    data: ArrayBuffer | string,
    formatId?: string
  ): Promise<ImportResult> {
    let adapter: FileFormatAdapter | undefined;
    
    if (formatId) {
      adapter = this.adapters.get(formatId);
    } else {
      // Auto-detect by magic bytes
      for (const a of this.adapters.values()) {
        if (a.canHandle?.(data as ArrayBuffer)) {
          adapter = a;
          break;
        }
      }
    }
    
    if (!adapter?.import) {
      throw new Error(`No importer for format: ${formatId}`);
    }
    
    return adapter.import(data);
  }
  
  export(
    formatId: string,
    entities: Entity[],
    layers: Layer[],
    options?: ExportOptions
  ): ArrayBuffer | string {
    const adapter = this.adapters.get(formatId);
    if (!adapter?.export) {
      throw new Error(`No exporter for format: ${formatId}`);
    }
    return adapter.export(entities, layers, options);
  }
}
```

### DXF Adapter (refactoring current code)

```typescript
// packages/file-io/src/adapters/dxf-adapter.ts

import { parseDxfFull } from '../parsers/dxf-import';
import { exportDxf } from '../writers/dxf-export';

export const dxfAdapter: FileFormatAdapter = {
  id: 'dxf',
  extensions: ['.dxf', '.DXF'],
  displayName: 'AutoCAD DXF (R2000)',
  capabilities: ['import', 'export', 'round-trip'],
  
  canHandle(data: ArrayBuffer): boolean {
    const text = new TextDecoder().decode(data.slice(0, 100));
    return text.includes('SECTION') && text.includes('HEADER');
  },
  
  import(data: ArrayBuffer | string): ImportResult {
    const text = typeof data === 'string' 
      ? data 
      : new TextDecoder().decode(data);
    
    const parsed = parseDxfFull(text);
    
    return {
      entities: parsed.entities,
      layers: parsed.layers,
      warnings: parsed.warnings ?? [],
      passthrough: parsed.unsupported ?? [],
    };
  },
  
  export(entities, layers, options): string {
    const entitiesJson = JSON.stringify(entities);
    const layersJson = JSON.stringify(layers);
    return exportDxf(entitiesJson, layersJson);
  },
};
```

### SVG Adapter (new, ~200 lines)

```typescript
// packages/file-io/src/adapters/svg-adapter.ts

export const svgAdapter: FileFormatAdapter = {
  id: 'svg',
  extensions: ['.svg', '.SVG'],
  displayName: 'SVG Vector Graphics',
  capabilities: ['export'],
  
  export(entities, layers, options): string {
    // Compute bounding box
    const bbox = computeBoundingBox(entities);
    const { minX, minY, maxX, maxY } = bbox;
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    
    const lines: string[] = [];
    lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${-maxY} ${width} ${height}">`);
    
    // Group by layer
    const byLayer = groupByLayer(entities);
    for (const [layerId, ents] of byLayer) {
      const layer = layers.find(l => l.id === layerId);
      const color = layer?.color || '#ffffff';
      lines.push(`  <g id="${layerId}" stroke="${color}" fill="none" stroke-width="0.5">`);
      
      for (const ent of ents) {
        lines.push(`    ${entityToSvg(ent)}`);
      }
      
      lines.push('  </g>');
    }
    
    lines.push('</svg>');
    return lines.join('\n');
  },
};

function entityToSvg(entity: Entity): string {
  const g = entity.geometry;
  if (g.Line) return `<line x1="${g.Line.start.x}" y1="${-g.Line.start.y}" x2="${g.Line.end.x}" y2="${-g.Line.end.y}" />`;
  if (g.Circle) return `<circle cx="${g.Circle.center.x}" cy="${-g.Circle.center.y}" r="${g.Circle.radius}" />`;
  if (g.Arc) return arcToSvgPath(g.Arc);
  if (g.Rectangle) return rectToSvg(g.Rectangle);
  if (g.Polyline) return polylineToSvg(g.Polyline);
  if (g.Text) return `<text x="${g.Text.position.x}" y="${-g.Text.position.y}" font-size="${g.Text.height}">${escapeXml(g.Text.content)}</text>`;
  if (g.Point) return `<circle cx="${g.Point.position.x}" cy="${-g.Point.position.y}" r="0.5" fill="currentColor" />`;
  return `<!-- unsupported: ${Object.keys(g)[0]} -->`;
}
```

### PDF Adapter (wrapping current code)

```typescript
// packages/file-io/src/adapters/pdf-adapter.ts

import { exportPdf } from '../writers/pdf-export';

export const pdfAdapter: FileFormatAdapter = {
  id: 'pdf',
  extensions: ['.pdf', '.PDF'],
  displayName: 'PDF Document',
  capabilities: ['export'],
  
  export(entities, layers, options): ArrayBuffer {
    const entitiesJson = JSON.stringify(entities);
    const layersJson = JSON.stringify(layers);
    const bytes = exportPdf(entitiesJson, layersJson, {
      pageSize: options?.pageSize as any || 'a4',
      orientation: 'landscape',
    });
    return bytes.buffer;
  },
};
```

---

## Pass-Through Preservation

Doc 28 requires: "For entities NEXUS doesn't understand, pass-through verbatim." Currently violated — unsupported entities silently dropped.

### Design

```typescript
// In @nexus/core types
interface Entity {
  id: string;
  geometry: GeometryType;
  layer_id: string;
  style: EntityStyle;
  passthrough?: Record<string, unknown>;  // format-specific data we couldn't parse
}
```

DXF import stores unrecognized entity types in `passthrough`:
```typescript
// In dxf-import, when entity type is unrecognized:
{
  id: generateId(),
  geometry: { Unknown: { type: 'LEADER' } },
  layer_id: entity.layer || '0',
  style: defaultStyle,
  passthrough: {
    dxf: {
      type: entity.type,
      groups: entity.groups,  // raw DXF group codes
    }
  }
}
```

DXF export re-emits passthrough data if `includePassthrough: true`:
```typescript
// In dxf-export:
if (entity.passthrough?.dxf && options.includePassthrough) {
  // Re-emit original DXF group codes
  for (const group of entity.passthrough.dxf.groups) {
    lines.push(String(group.code));
    lines.push(String(group.value));
  }
}
```

---

## Migration Path

### Phase 1: Registry + Type Contracts (this cycle)

1. Define `FileFormatAdapter`, `ImportResult`, `ExportOptions` types in @nexus/core
2. Create `FileFormatRegistry` in file-io
3. Wrap existing dxf-import/dxf-export as `dxfAdapter`
4. Wrap existing pdf-export as `pdfAdapter`
5. Add `svgAdapter` (~200 lines)
6. Update AppState to use registry instead of direct imports
7. No behavior change — pure refactor

**Files changed:**
```
packages/core/src/file-io-types.ts          (new — type contracts)
packages/file-io/src/FileFormatRegistry.ts  (new — registry)
packages/file-io/src/adapters/dxf-adapter.ts   (new — wraps existing)
packages/file-io/src/adapters/pdf-adapter.ts   (new — wraps existing)
packages/file-io/src/adapters/svg-adapter.ts   (new — ~200 lines)
packages/file-io/src/index.ts              (update — export registry)
packages/app/src/lib/stores/AppState.svelte.ts (update — use registry)
```

### Phase 2: Pass-Through + Warnings (next cycle)

1. Add `passthrough` field to Entity type in kernel
2. Update DXF import to store unrecognized entities
3. Add `ImportWarning` emission for lossy conversions
4. Update DXF export to re-emit passthrough data
5. Show warnings in UI after import

### Phase 3: Domain Format Adapters (per domain)

Each domain module (from doc 35) registers its format adapters:

```typescript
// BIM domain module
const bimModule: DomainModule = {
  // ...
  formatAdapters: [ifcAdapter],  // uses web-ifc
};

// GIS domain module
const gisModule: DomainModule = {
  // ...
  formatAdapters: [geojsonAdapter, shapefileAdapter, geopackageAdapter],
};
```

The shell auto-registers format adapters when a domain activates. File → Import/Export menus populate from the registry.

---

## Relationship to Kernel

The kernel owns entity types. File-io translates between those types and external formats. The kernel NEVER knows about file formats — it receives entities, not DXF strings.

```
DXF file → [file-io: dxfAdapter.import()] → Entity[] → [kernel: execute_command()] → state
                                                                    ↓
DXF file ← [file-io: dxfAdapter.export()] ← Entity[] ← [kernel: get_entities_json()]
```

The Rust kernel could also have format adapters (e.g., ixmilia/dxf crate for high-performance DXF) exposed via WASM. The registry doesn't care whether an adapter runs in TS or Rust — it just implements the interface.

---

## Compatibility

| Existing Doc | Relationship |
|---|---|
| 03-data-interoperability | This doc implements the format handling it describes |
| 14-ports-adapters (PersistencePort) | FileFormatRegistry IS the persistence port adapter |
| 28-file-format-integrity | Pass-through preservation satisfies doc 28 requirement |
| 34-platform-architecture | Domain modules register format adapters alongside commands |
| 35-ui-system-design | DomainModule gains `formatAdapters` field |

---

## Success Criteria

- [ ] Adding a new file format requires: one adapter file + one `registry.register()` call. Zero modifications to AppState, kernel, or shell.
- [ ] File → Import menu auto-populates from registered importers.
- [ ] File → Export menu auto-populates from registered exporters.
- [ ] DXF round-trip preserves unrecognized entities via passthrough.
- [ ] Import warnings surface in UI (lossy conversion, unsupported entity).
- [ ] SVG export works for all 2D entity types.
- [ ] A hypothetical IFC adapter can register without modifying any core file.
