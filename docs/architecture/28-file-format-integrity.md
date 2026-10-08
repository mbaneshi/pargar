# Architecture Decision: File Format Round-Trip Integrity

> ## Status: PARKED under SD-05 (2026-04-29)
>
> STEP/IFC/3D format strategy is paused until AutoCAD 2D parity ships. DXF round-trip rules (the 6 mandatory tests, pass-through of unknowns) stay in force and apply directly to the 2D parity sprint. Lifting SD-05 in `DECISIONS.md` reactivates non-DXF format work.

> Priority: 9 of 10 — trust is lost instantly on format failures
> Risk if wrong: "DXF doesn't open in AutoCAD" = users never come back
> Audience: All agents and developers working on NEXUS

---

## The Trust Problem

Professional CAD users test new tools with one ritual:
1. Export a known-good model from their current tool
2. Import into the new tool → visual inspection
3. Export back to original format
4. Import into original tool → compare

If ANYTHING is wrong — missing faces, shifted geometry, lost colors, broken layers — the new tool is permanently distrusted. You get one chance.

---

## DXF Round-Trip

### What Commonly Breaks

| Entity/Feature | Common Problem |
|---------------|---------------|
| Hatch patterns | Custom patterns lost. AutoCAD rewrites hatch boundaries. Pattern names non-standard between apps. |
| Dimension styles | ~70 DIMVAR variables. Overrides stored as XDATA on entities. Partial support = dimensions look wrong. |
| MText formatting | RTF-like codes (`\H`, `\f`, `\P`) differ between implementations. Font substitution. |
| Block attributes (ATTDEF/ATTRIB) | Attribute order, default values, invisible flags handled differently. |
| XDATA (Extended Data) | App-registered data on entities. If not preserved verbatim, round-trip loses third-party info. |
| Reactor chains | Handle-based links between objects. Missing reactors can crash AutoCAD. |
| XRECORD/XDICTIONARY | Arbitrary dictionary data. Used by AutoCAD's parametric constraints, annotation monitor. |
| DXF version differences | R12 (~50 entity types) vs R2018 (~200+ types, OBJECTS section, CLASSES, handle cross-refs). |

### The Preservation Strategy

**For entities NEXUS understands:** Full round-trip — read, modify, write with correct format.

**For entities NEXUS doesn't understand:** **Pass-through verbatim.** Read the raw DXF groups, store them as opaque data, write them back unchanged. This is what BricsCAD and other AutoCAD-compatible tools do.

```rust
pub struct DxfPassthrough {
    pub entity_type: String,     // "ACAD_PROXY_ENTITY", "XRECORD", etc.
    pub raw_groups: Vec<DxfGroup>, // Raw group code + value pairs
}
```

**For XDATA:** Always preserve. Read app name + typed value list, store as raw bytes, write back unchanged.

### DXF Testing Requirements (Sprint 8)

6 mandatory round-trip tests:

1. **Lines + layers:** Multi-layer drawing with different colors, linetypes, lineweights → export → import in LibreCAD → verify visually
2. **Arcs + circles:** Various radii and angles → verify start/end angles survive
3. **Polylines (closed + open):** Closed polyline → verify closure flag. Polyline with arcs → verify bulge values.
4. **Text + dimensions:** Single-line text, MText, linear dimension → verify positions, content, dimension values
5. **Blocks:** Block with 3 entities → insert with rotation + scale → verify instance transform
6. **Mixed layers + styles:** 5 layers with different colors, frozen/locked states → verify layer properties

**Target format:** DXF R2013/R2014 (widely compatible, not too old, not bleeding-edge).

---

## STEP Round-Trip

### What STEP Preserves vs Loses

| Information | STEP AP203 | STEP AP214 | STEP AP242 |
|------------|-----------|-----------|-----------|
| Exact B-Rep geometry | YES | YES | YES |
| Assembly structure | YES | YES | YES |
| Colors | NO | YES | YES |
| Materials | NO | Name only | Extended |
| Parametric history | **NEVER** | **NEVER** | **NEVER** |
| Feature names | Non-standard | Non-standard | Better |
| Sketch constraints | **NEVER** | **NEVER** | **NEVER** |
| Construction geometry | **NEVER** | **NEVER** | **NEVER** |
| Assembly constraints | **NEVER** (baked into placement) | Same | Same |
| GD&T (tolerancing) | NO | Partial | YES |
| User attributes | NO | NO | Via Property Definitions |

**Key insight:** STEP is a "dumb solid" format. An extruded cylinder is just a cylinder — the extrude operation is gone. All parametric intent is destroyed on export.

### STEP Import Healing (Required)

After importing STEP via `truck-stepio` or opencascade.js, these repairs are typically needed:

1. **Sewing:** Stitch disconnected faces into closed shell (tolerance-based edge matching)
2. **Fix orientation:** Ensure outward-facing normals
3. **Remove degenerate edges:** Zero-length edges from upstream CAD
4. **Add missing seam edges:** Periodic surfaces (cylinders, spheres) need seam edges
5. **Tolerance reconciliation:** Source CAD may use different precision than truck/OCCT

### STEP Strategy for NEXUS

**v0.2:** Use `truck-stepio` (AP203 only). Accept limitations: no colors, experimental quality.

**v0.3+:** Lazy-load opencascade.js for full STEP support (AP214 colors, AP242 GD&T). Use OCCT's `STEPControl_Reader` which includes automatic healing.

**Always:** Show an import report: "Imported 47 faces, 123 edges. 3 edges healed. 1 face orientation corrected."

---

## STL/OBJ Precision

### What's Lost Converting B-Rep to Mesh

| Property | B-Rep | STL/OBJ |
|----------|-------|---------|
| Exact geometry | YES (NURBS) | NO (triangle approximation) |
| Topology | YES (face/edge/vertex adjacency) | NO (triangle soup in STL, shared vertices in OBJ) |
| Parametric info | YES (if B-Rep has feature tree) | NO |
| Infinite resolution | YES (evaluate anywhere) | NO (fixed tessellation) |

### Deflection vs Quality vs File Size

For a typical 100-face mechanical part:

| Deflection | Triangles | Binary STL | Max Error |
|-----------|-----------|-----------|-----------|
| 1.0 mm | ~5K | ~100 KB | 1.0 mm |
| 0.1 mm | ~50K | ~1 MB | 0.1 mm (3D printing quality) |
| 0.01 mm | ~500K | ~10 MB | 0.01 mm (CNC quality) |
| 0.001 mm | ~5M | ~100 MB | 0.001 mm (overkill) |

**STL-specific limitation:** 32-bit float coordinates. A part at (10000, 10000, 10000) mm has positional precision of only ~0.001 mm. For large assemblies at building scale, this is a problem.

**OBJ advantages over STL:** Vertex sharing (40-60% smaller), texture coordinates, material references, group names.

### Tessellation Parameters for NEXUS

Expose two controls to users:

```
Quality:  [Draft] ---- [Standard] ---- [Fine] ---- [Ultra]
          1.0mm        0.1mm           0.01mm       0.001mm

Custom:   Deflection [0.1] mm    Angular [20] degrees
```

Default to "Standard" (0.1mm, 20°). This balances quality and performance for 3D printing and visualization.

---

## Trust-Building Strategy

### For v0.1 (DXF)

1. **Publish DXF test results** in the repository: `tests/dxf-roundtrip/` with before/after comparisons
2. **Validation report after import:** "Imported 47 entities across 5 layers. 2 unsupported entity types preserved as raw data."
3. **Strict mode option:** Reject files with issues instead of silently healing. Let power users verify correctness.

### For v0.2 (STEP + STL)

1. **Volume comparison on STEP import:** Compute volume of imported B-Rep, compare with source (if available). Report: "Volume: 1234.56 mm³ (matches source within 0.01%)"
2. **Face count validation:** "Source: 47 faces. Imported: 47 faces. No missing faces."
3. **Bounding box comparison:** Verify spatial extent matches
4. **Test against NIST MBE reference models** — the industry benchmark for STEP fidelity

### What NOT to Do

1. **Do NOT silently drop entities.** If NEXUS can't parse an entity, preserve it as raw data and tell the user. "3 proxy entities preserved but not editable."

2. **Do NOT claim STEP support without healing.** Raw STEP import without sewing/fixing produces broken models that fail on first boolean. Always heal.

3. **Do NOT default to STL for 3D export.** Encourage STEP (exact) over STL (approximate). Make STEP the prominent export option, with STL as secondary "for 3D printing."

4. **Do NOT ignore units.** DXF files can be in any unit (mm, inches, meters). STEP files specify units in the header. Always convert to NEXUS's internal unit (mm) on import, and write correct unit headers on export. Unit errors are catastrophic (model 25.4x too large/small).
