# File I/O Ecosystem — Libraries, Formats, Architecture Patterns

> **Date:** 2026-04-19
> **Purpose:** Survey of open-source libraries for AEC file format handling (JS/TS + Rust). Research feeding into architecture proposal `docs/architecture/36-file-io-system-design.md`.

---

## 1. DXF/DWG

### Import (JS/TS)

| Library | Package | Updated | Browser | Notes |
|---------|---------|---------|---------|-------|
| dxf-parser | `dxf-parser@1.1.2` | 2022-06 | Yes | **Currently used.** Effectively abandoned. Supports most 2D entities, layers, blocks. Missing: 3D solids, leaders, dimensions (partial). |
| dxf | `dxf@5.3.1` | 2025-09 | Yes | **Active.** Wraps dxf-parser + adds SVG output, entity denormalization. Better maintained. |
| dxf-json | `dxf-json@0.11.0` | 2025-12 | Yes | **Active, pre-1.0.** Rich TypeScript types, async parsing, thumbnail extraction. Best type coverage. API unstable. Candidate dxf-parser replacement. |

### Export (JS/TS)

| Library | Package | Notes |
|---------|---------|-------|
| dxf-writer | `dxf-writer@1.18.4` | Simple 2D writer. Stale. |
| @tarikjabiri/dxf | `@tarikjabiri/dxf@2.8.9` | **Best JS DXF writer.** TypeScript. More entity types. |
| Hand-rolled (current) | — | Our `dxf-export.ts` (365 lines). Fine for controlled output. |

### Rust DXF

| Crate | Notes |
|-------|-------|
| `dxf` (ixmilia/dxf-rs) | **Best Rust option.** Read/write DXF and DXB. Updated March 2026. Could compile to WASM. |

### DWG

| Option | Notes |
|--------|-------|
| ODA Drawings inWEB SDK | Browser SDK for DWG viewing/editing. **Proprietary, members-only (~$2500+/yr).** |
| libredwg | C, GPL-licensed. WASM possible but GPL is viral — incompatible with MIT. |
| **Verdict** | DWG in browser without ODA = not viable. Workaround: convert DWG→DXF server-side. |

---

## 2. IFC (BIM)

| Library | Package | Notes |
|---------|---------|-------|
| web-ifc | `web-ifc@0.0.77` | **The answer.** C++ IFC parser compiled to WASM. Read/write at native speed. Multi-threaded. Full IFC2x3/IFC4. Actively maintained by That Open Company. |
| @thatopen/components | `@thatopen/components` | Higher-level: viewer, property inspector, spatial trees, BCF on top of web-ifc + Three.js. |
| ifc-lite | `@ifc-viewer/core` | Browser-native IFC viewer with WebGPU + Rust/WASM parser. Newer. |

### Rust IFC

| Crate | Notes |
|-------|-------|
| `ifc_rs` | WIP, unstable. Parses IFC STEP format into Rust types. Not production-ready. |
| `ifc-lite-core` | Zero-copy STEP tokenizer, SIMD-accelerated, streaming. IFC4X3 (876 entities). More mature. Updated March 2026. |

**Verdict:** web-ifc for browser. ifc-lite-core for Rust/WASM long-term.

---

## 3. GIS Formats (GeoJSON, GeoPackage, Shapefile)

### JS/TS

| Library | Package | Notes |
|---------|---------|-------|
| gdal3.js | `gdal3.js` | **Swiss army knife.** GDAL+PROJ+GEOS compiled to WASM. 30+ formats. ~15MB WASM bundle. Client-side conversion. |
| Turf.js | `@turf/turf` | Geospatial analysis (buffers, intersections). Not a parser. |
| shpjs | `shpjs` | Shapefile parser for browser. Simple. |
| geotiff.js | `geotiff.js` | GeoTIFF/COG reader. Production-ready. |
| flatgeobuf | `flatgeobuf` | Fast streaming format. Reference JS implementation. |
| proj4js | `proj4js` | CRS transforms in browser. Essential companion. |

### Rust

| Crate | Notes |
|-------|-------|
| `geojson` (georust) | Read/write GeoJSON. Mature, WASM-compatible. |
| `shapefile` (georust) | Read/write Shapefiles. Mature. |
| `flatgeobuf` | Reference Rust implementation. Streaming. |
| `geozero` (georust) | **Key crate.** Zero-copy reader/writer abstraction across WKB, WKT, GeoJSON, MVT, GDAL, FlatGeobuf. The adapter layer for Rust GIS I/O. |
| `oxigdal` | **New (Feb 2026).** Pure Rust GDAL alternative. 500k SLoC, 68 crates, 11 drivers. Too new for production. |

**Verdict:** gdal3.js for max browser coverage. georust (geojson + shapefile + geozero) for Rust. oxigdal — watch list.

---

## 4. LandXML (Civil)

**No dedicated parsers exist** in JS or Rust. LandXML is well-defined XML schema.

| Option | Notes |
|--------|-------|
| `quick-xml` (Rust) | Fast XML parser. Build custom LandXML mapper on top. Updated Feb 2026. |
| `fast-xml-parser` (JS) | Fast XML parser for JS. Alternative for TS-side parsing. |
| GDAL GMLAS driver | Limited LandXML support via gdal3.js. |

**Verdict:** Custom parser required. Use `quick-xml` in Rust, map `<Surface>`, `<Alignment>`, `<Parcel>` elements to ECS components.

---

## 5. STEP/IGES (3D Exchange)

### JS/TS (browser)

| Library | Package | Notes |
|---------|---------|-------|
| opencascade.js | `opencascade.js` | **Full OCCT kernel in WASM.** Booleans, NURBS, fillets, STEP/IGES import/export. ~30-50MB WASM. Used by replicad, CascadeStudio. |
| occt-import-js | `occt-import-js` | Import-only for BREP/STEP/IGES. Converts to mesh JSON. Lighter WASM. |

### Rust

| Crate | Notes |
|-------|-------|
| `truck` (ricosjp) | **Pure Rust B-Rep kernel.** NURBS, booleans, STEP I/O. WASM via truck-js. Used by CADmium. Strategic choice — aligns with Rust dual-stack. |
| `opencascade-rs` | Rust bindings to OCCT. WIP, spare-time project. Not production-ready. |

**Verdict:** truck for Rust-native path (aligns with NEXUS dual-stack). opencascade.js as proven fallback.

---

## 6. PDF Export

| Library | Package | Notes |
|---------|---------|-------|
| jsPDF | `jspdf@4.2.1` | **Currently used.** Lines, circles, text. No real arc primitive, no hatch, limited precision. Adequate for v0.1. |
| pdf-lib | `pdf-lib` | Lower-level. Better for document composition. Similar CAD limitations. |
| pdfkit | `pdfkit` | Node.js focused, browser builds exist. Better path/curve support. SVG path natively. |
| printpdf (Rust) | `printpdf` | High-level PDF creation. Strategic path for server-side batch plotting. |

**Strategic pattern:** Render to SVG first → convert SVG to PDF. Gives precise vector output with single SVG implementation.

---

## 7. SVG Export

**Hand-rolling is recommended.** SVG is XML. CAD entities map cleanly:

| Entity | SVG Element |
|--------|-------------|
| Line | `<line x1 y1 x2 y2>` |
| Circle | `<circle cx cy r>` |
| Arc | `<path d="M...A...">` |
| Polyline | `<polyline points="...">` / `<polygon>` |
| Rectangle | `<rect x y width height>` |
| Text | `<text x y>content</text>` |
| Layers | `<g id="layer-name">` groups |

~200 lines of code for full 2D entity coverage. No library needed.

---

## 8. Architecture Patterns — Multi-Format I/O in CAD Tools

### FreeCAD
Each workbench registers importers/exporters via Python modules. Addons register with File → Import/Export menus. Simple `register()` / `unregister()` lifecycle.

### Blender
Addons declare `bl_info` metadata, implement `register()` / `unregister()`. Import/export operators self-register with menu system. File filter by extension.

### Recommended Pattern — FileFormatPort Adapter

```typescript
interface FileFormatAdapter {
  id: string;                           // "dxf", "ifc", "geojson"
  extensions: string[];                 // [".dxf", ".DXF"]
  displayName: string;                  // "AutoCAD DXF"
  capabilities: ("import" | "export")[];
  
  canImport?(data: ArrayBuffer): boolean;  // sniff magic bytes
  import?(data: ArrayBuffer, options?: ImportOptions): ImportResult;
  export?(entities: Entity[], options?: ExportOptions): ArrayBuffer;
}

class FileFormatRegistry {
  private adapters = new Map<string, FileFormatAdapter>();
  register(adapter: FileFormatAdapter): void;
  getImporters(): FileFormatAdapter[];
  getExporters(): FileFormatAdapter[];
  getByExtension(ext: string): FileFormatAdapter | undefined;
}
```

Aligns with NEXUS rules: each format is a command (Rule 1), the registry is additive (Rule 4), computation-heavy parsing in Rust/WASM (Rule 5), adapter interface becomes MCP tool schema (Rule 6).

---

## 9. Phased Adoption Path

| Phase | Format | Library | Action |
|-------|--------|---------|--------|
| **v0.1** | DXF import | `dxf-parser` (current) | Keep. Migrate to `dxf-json` when 1.0. |
| **v0.1** | DXF export | Hand-rolled (current) | Keep. |
| **v0.1** | PDF export | `jspdf` (current) | Keep. |
| **v0.1** | SVG export | Hand-roll | Add ~200 lines. |
| **v0.2 (BIM)** | IFC | `web-ifc` | Direct dependency. |
| **v0.3 (GIS)** | GeoJSON/SHP/GPKG | `gdal3.js` or georust via WASM | gdal3.js for coverage; georust for Rust path. |
| **v0.4 (3D)** | STEP/IGES | `truck` (Rust) or `opencascade.js` | truck aligns with dual-stack. |
| **v0.5 (Civil)** | LandXML | Custom on `quick-xml` | No library exists. |
| **Future** | DWG | ODA or server-side conversion | No open-source browser path. |

---

## Sources

- npm registry search for each package
- crates.io registry search for each crate
- [web-ifc GitHub](https://github.com/ThatOpenCompany/engine_web-ifc)
- [truck GitHub](https://github.com/ricosjp/truck)
- [gdal3.js GitHub](https://github.com/nickovs/gdal3.js)
- [georust organization](https://github.com/georust)
- [opencascade.js](https://github.com/nicx519y/opencascade.js)
- [ODA inWEB SDK announcement](https://www.opendesign.com/products/drawings-inweb)
