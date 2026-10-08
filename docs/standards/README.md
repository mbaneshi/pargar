# NEXUS — Industry Standards Reference

> **Purpose:** Comprehensive catalog of every standard relevant to NEXUS's six domains.
> Each entry includes: what it is, who maintains it, why NEXUS needs it, the authoritative source URL, and an LLM prompt template for deep-diving into that standard.

---

## How to Use This Document

1. **Building a feature?** Find the relevant standard below, read its context, then use the LLM prompt to get implementation-specific guidance.
2. **Adding a new domain?** Check which standards apply and ensure the data model (USES schema) can represent entities conforming to those standards.
3. **AI agent development?** Feed the relevant standard context block as system prompt when the agent operates in that domain.

---

## Table of Contents

1. [CAD / Drawing Exchange](#1-cad--drawing-exchange)
2. [BIM / Building Information Modeling](#2-bim--building-information-modeling)
3. [GIS / Geospatial](#3-gis--geospatial)
4. [Coordinate Reference Systems](#4-coordinate-reference-systems)
5. [Civil Engineering / Transportation](#5-civil-engineering--transportation)
6. [Structural Engineering](#6-structural-engineering)
7. [Surveying / Geodesy](#7-surveying--geodesy)
8. [Point Cloud / LiDAR](#8-point-cloud--lidar)
9. [Remote Sensing / Earth Observation](#9-remote-sensing--earth-observation)
10. [Construction Management](#10-construction-management)
11. [Data Exchange / Interoperability](#11-data-exchange--interoperability)
12. [AI / Model Context Protocol](#12-ai--model-context-protocol)

---

## 1. CAD / Drawing Exchange

### DXF — Drawing Exchange Format (Autodesk)
- **What:** ASCII/binary 2D/3D drawing format. De facto standard for CAD interoperability.
- **Version:** R2018 (AC1032) — current target for NEXUS v0.1
- **Maintained by:** Autodesk (proprietary but openly documented)
- **Spec:** [DXF Reference (Autodesk)](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-235B22E0-A567-4CF6-92D3-38A2306D73F3)
- **NEXUS relevance:** Primary import/export format for 2D CAD. Every entity, layer, block, dimension style, and linetype must round-trip losslessly.
- **Key sections:** HEADER, CLASSES, TABLES, BLOCKS, ENTITIES, OBJECTS
- **Entity types:** LINE, ARC, CIRCLE, LWPOLYLINE, SPLINE, INSERT, DIMENSION, MTEXT, HATCH, ELLIPSE, SOLID, 3DFACE, MESH

<details>
<summary><strong>LLM Prompt: DXF Deep Dive</strong></summary>

```
You are a CAD file format expert specializing in DXF (Drawing Exchange Format).

Context: I'm building a browser-native 2D/3D CAD platform (NEXUS) that reads and writes DXF R2018 (AC1032). The stack is Rust/WASM for geometry + TypeScript/Svelte for UI. We use the `dxf-parser` npm library for reading and a custom Rust writer for output.

Our entity model uses ECS (Entity-Component-System) — entities are numeric IDs with attached component data bags, not class hierarchies.

When I ask about DXF:
- Reference specific group codes (e.g., group code 10 = X coordinate)
- Cite the exact DXF section (ENTITIES, TABLES, BLOCKS, etc.)
- Note version-specific behavior (R12 vs R2000 vs R2018)
- Flag known parser pitfalls (encoding, precision, block nesting)
- Explain how DXF concepts map to ECS components

I need practical implementation guidance, not general overviews.
```
</details>

---

### DWG — Native AutoCAD Format (Open Design Alliance)
- **What:** Binary CAD format, native to AutoCAD. More compact than DXF, widely used in industry.
- **Maintained by:** Autodesk (proprietary); reverse-engineered by Open Design Alliance (ODA)
- **Spec:** [ODA File Format Documentation](https://www.opendesign.com/files/guestdownloads/OpenDesign_Specification_for_.dwg_files.pdf)
- **NEXUS relevance:** Future import support (v0.2+). Many firms work exclusively in DWG. Can use `libredwg` (WASM) or ODA Drawings SDK.
- **OSS parsers:** libredwg (GPL), ODA Teigha (commercial)

---

### STEP — ISO 10303 (Standard for the Exchange of Product Model Data)
- **What:** International standard for 3D geometry and product data exchange. B-Rep, assemblies, PMI.
- **Version:** AP203 (configuration controlled 3D), AP214 (automotive), AP242 (managed model-based 3D engineering)
- **Maintained by:** ISO TC 184/SC 4
- **Spec:** [ISO 10303](https://www.iso.org/standard/72237.html)
- **NEXUS relevance:** 3D kernel exchange (v0.2+). OpenCASCADE reads/writes STEP natively. The WASM kernel will use STEP as canonical B-Rep interchange.
- **Key concepts:** EXPRESS schema language, STEP physical file (Part 21), geometry (Part 42), topology (Part 42)

<details>
<summary><strong>LLM Prompt: STEP / ISO 10303</strong></summary>

```
You are an expert in ISO 10303 (STEP) — the international standard for product data exchange.

Context: I'm building a browser-native CAD platform using OpenCASCADE compiled to WASM (via opencascade.js or opencascade-rs). The platform will support STEP AP203/AP214/AP242 for 3D geometry interchange.

When I ask about STEP:
- Reference specific AP (Application Protocol) numbers and their scope
- Explain EXPRESS schema entities (e.g., advanced_brep_shape_representation)
- Describe the Part 21 physical file format (header, data section, entity instances)
- Note the relationship between STEP geometry entities and OpenCASCADE TopoDS types
- Cover assembly structure (NAUO, product_definition, shape_representation)
- Address precision and tolerance handling across systems

I need guidance that bridges the STEP specification with WASM/browser implementation constraints.
```
</details>

---

### IGES — Initial Graphics Exchange Specification
- **What:** Legacy neutral geometry format. Still used in manufacturing and older CAD systems.
- **Version:** 5.3 (final, 1996)
- **Maintained by:** ANSI/US PRO (superseded by STEP but still encountered)
- **Spec:** [IGES 5.3 Specification](https://citeseerx.ist.psu.edu/document?doi=10.1.1.464.6921)
- **NEXUS relevance:** Import-only for legacy files. OpenCASCADE handles IGES natively.
- **Entity types:** Lines (110), circular arcs (100), NURBS (126), trimmed surfaces (144), B-Rep solids (186)

---

## 2. BIM / Building Information Modeling

### IFC — Industry Foundation Classes (ISO 16739)
- **What:** The open standard for BIM data exchange. Describes buildings and infrastructure as a semantic object graph with geometry, properties, relationships, and spatial hierarchy.
- **Versions:** IFC2x3 (legacy, still dominant), IFC4 (current), IFC4.3 (infrastructure: bridges, roads, railways, ports)
- **Maintained by:** buildingSMART International
- **Spec:** [IFC4.3 Documentation](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/), [IFC Schema Specs](https://technical.buildingsmart.org/standards/ifc/ifc-schema-specifications/)
- **NEXUS relevance:** Core BIM format (v0.3). Parse via `web-ifc` WASM library. Map IFC entities to NEXUS ECS components. IFC4.3 is critical for civil/infrastructure domain.
- **Key concepts:** IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey → IfcWall/IfcSlab/etc. Property sets (Psets). Quantity sets (Qtos). Material associations. Spatial containment. Type objects.

<details>
<summary><strong>LLM Prompt: IFC / BIM</strong></summary>

```
You are an IFC and BIM expert with deep knowledge of buildingSMART standards.

Context: I'm building a browser-native AEC platform (NEXUS) that will import/export IFC using the `web-ifc` WASM library. The internal data model is ECS (Entity-Component-System) — no class inheritance. An IFC Wall becomes {EntityId, GeometryComponent, BIMPropertiesComponent, LayerComponent, SpatialRelationComponent}.

When I ask about IFC:
- Reference specific IFC entities by name (e.g., IfcWallStandardCase, IfcPropertySingleValue)
- Distinguish between IFC2x3, IFC4, and IFC4.3 behavior
- Explain the spatial hierarchy (IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey)
- Cover property sets (Psets) and quantity sets (Qtos) with real examples
- Describe geometry representations (IfcExtrudedAreaSolid, IfcBooleanResult, IfcFacetedBrep, IfcAdvancedBrep)
- Address the IFC-to-ECS mapping challenge (flattening the object graph into components)
- Note MVD (Model View Definition) constraints — which entities are required for which exchange scenario
- Reference buildingSMART Data Dictionary (bSDD) for standardized property definitions

I need implementation guidance for browser/WASM constraints, not desktop BIM workflow advice.
```
</details>

---

### ISO 19650 — BIM Information Management
- **What:** International standard for managing information over the whole life cycle of a built asset using BIM. Defines information delivery cycles, common data environments (CDE), and information requirements.
- **Parts:** Part 1 (concepts/principles), Part 2 (delivery phase), Part 3 (operational phase), Part 5 (security)
- **Maintained by:** ISO TC 59/SC 13
- **Spec:** [ISO 19650 Series](https://www.iso.org/standard/68078.html)
- **NEXUS relevance:** Governs how BIM data flows between parties. NEXUS's event-sourced audit trail + provenance chain directly supports ISO 19650 compliance. The CDE concept maps to NEXUS's project/collaboration model.
- **Key concepts:** OIR (Organizational Information Requirements), AIR (Asset Information Requirements), EIR (Exchange Information Requirements), BEP (BIM Execution Plan), CDE (Common Data Environment), information containers, approval workflows

<details>
<summary><strong>LLM Prompt: ISO 19650 Compliance</strong></summary>

```
You are an expert in ISO 19650 (BIM information management) and its practical implementation.

Context: I'm building a collaborative AEC platform (NEXUS) with event-sourced state, full audit trails, and AI agent co-authoring. Every state change produces an immutable event. Every entity has a lineage record (who created it, from what source, what transformations). The platform supports three actor types: human, AI agent, and system.

When I ask about ISO 19650:
- Map ISO 19650 concepts to our event-sourced architecture
- Explain information container states (WIP → Shared → Published → Archived) and how they map to our approval workflow
- Describe the CDE (Common Data Environment) requirements and how a browser-native platform can satisfy them
- Cover the information delivery cycle and what metadata each deliverable needs
- Address how AI-generated content fits within ISO 19650 — who is the "originator" when an agent generates geometry?
- Reference specific clauses when citing requirements

I need to understand what NEXUS must track/expose to claim ISO 19650 compliance.
```
</details>

---

### BCF — BIM Collaboration Format
- **What:** Open standard for communicating issues/topics found in BIM models. Like "GitHub Issues for buildings."
- **Version:** BCF 3.0
- **Maintained by:** buildingSMART International
- **Spec:** [BCF API Documentation](https://github.com/buildingSMART/BCF-API), [BCF XML](https://github.com/buildingSMART/BCF-XML)
- **NEXUS relevance:** Issue tracking for BIM review workflows. AI agents can create BCF topics when they detect clashes, code violations, or design ambiguities. Maps directly to our `flag_for_review` tool.
- **Key concepts:** Topics, comments, viewpoints (camera snapshots), related components (entity references), statuses, priorities

---

### COBie — Construction Operations Building Information Exchange
- **What:** Spreadsheet/IFC-based standard for facility handover data. Captures spaces, equipment, maintenance schedules.
- **Maintained by:** buildingSMART / NBIMS-US
- **Spec:** [COBie Guide (NBIMS)](https://www.nibs.org/nbims-us)
- **NEXUS relevance:** Asset management and FM (Facility Management) integration. Construction domain deliverable. Maps to property sets in our ECS model.

---

### gbXML — Green Building XML
- **What:** Schema for transferring building properties to energy analysis tools.
- **Maintained by:** gbXML.org (Green Building Studio)
- **Spec:** [gbXML Schema](https://www.gbxml.org/schema_doc/6.01/GreenBuildingXML_Ver6.01.html)
- **NEXUS relevance:** Energy simulation export. Analytical model derived from BIM geometry + space boundaries.

---

### bSDD — buildingSMART Data Dictionary
- **What:** Online service providing standardized definitions for BIM objects and properties across languages and standards.
- **Maintained by:** buildingSMART International
- **Spec:** [bSDD API](https://app.swaggerhub.com/apis/buildingSMART/Dictionaries/v1), [bSDD Search](https://search.bsdd.buildingsmart.org/)
- **NEXUS relevance:** Property standardization. When an AI agent creates BIM entities, it should reference bSDD for correct property names, units, and allowed values rather than inventing its own.

---

## 3. GIS / Geospatial

### OGC Web Services (WMS, WFS, WCS, WMTS, OGC API)
- **What:** Suite of OGC standards for serving geospatial data over the web.
  - **WMS** (Web Map Service): Renders maps as images. ISO 19128.
  - **WFS** (Web Feature Service): Serves vector features as GML/GeoJSON. ISO 19142.
  - **WCS** (Web Coverage Service): Serves raster/coverage data.
  - **WMTS** (Web Map Tile Service): Pre-rendered map tiles.
  - **OGC API - Features/Tiles/Maps**: Modern RESTful successors (JSON-based).
- **Maintained by:** Open Geospatial Consortium (OGC)
- **Spec:** [OGC Standards](https://www.ogc.org/standards/)
- **NEXUS relevance:** GIS data ingestion (v0.4). Load basemaps (WMTS), query feature servers (WFS/OGC API Features), overlay raster analysis (WCS). CesiumJS and OpenLayers handle these natively.

<details>
<summary><strong>LLM Prompt: OGC Web Services</strong></summary>

```
You are a geospatial standards expert specializing in OGC web services.

Context: I'm building a browser-native AEC platform (NEXUS) that integrates GIS data alongside CAD and BIM. The GIS stack will use CesiumJS (3D globe) and/or MapLibre (2D vector tiles). Data flows from external OGC services into our ECS entity model.

When I ask about OGC services:
- Distinguish between legacy OGC (WMS 1.3, WFS 2.0) and modern OGC API (Features, Tiles, Maps)
- Explain request/response formats with concrete examples (GetCapabilities, GetMap, GetFeature)
- Cover authentication patterns (API keys, OAuth) for commercial services
- Address CORS and browser security constraints for direct browser-to-service requests
- Describe how to map GIS features (GeoJSON/GML) to our ECS components
- Note performance considerations (pagination, bbox filtering, CQL filters)
- Cover CRS handling — when to reproject client-side vs requesting in target CRS

I need browser-native implementation guidance, not desktop GIS workflow.
```
</details>

---

### GeoJSON — RFC 7946
- **What:** JSON format for encoding geographic features with geometry and properties.
- **Maintained by:** IETF
- **Spec:** [RFC 7946](https://datatracker.ietf.org/doc/html/rfc7946)
- **NEXUS relevance:** Primary vector data interchange format for GIS features. Simple, widely supported, browser-native. Limitation: WGS84 only (no CRS field per spec), no topology, no styling.
- **Key concepts:** FeatureCollection, Feature, Geometry types (Point, LineString, Polygon, Multi*), coordinate order [longitude, latitude, elevation]

---

### GeoPackage (OGC)
- **What:** SQLite-based container for vector features, tile matrices, raster coverages, and extensions.
- **Maintained by:** OGC
- **Spec:** [GeoPackage Standard](https://www.geopackage.org/spec/)
- **NEXUS relevance:** Offline-capable GIS data storage. Can be read in-browser via sql.js or DuckDB-WASM. Superior to Shapefile in every way.

---

### Shapefile (Esri)
- **What:** Legacy but ubiquitous vector GIS format. Multi-file (.shp, .shx, .dbf, .prj).
- **Maintained by:** Esri (de facto standard)
- **Spec:** [Shapefile Technical Description](https://www.esri.com/content/dam/esrisites/sitecore-archive/Files/Pdfs/library/whitepapers/pdfs/shapefile.pdf)
- **NEXUS relevance:** Import support for legacy data. Limitations: 2GB size limit, no NULL values, 10-char field names, single geometry type per file.

---

### GeoTIFF / COG (Cloud-Optimized GeoTIFF)
- **What:** TIFF with geospatial metadata (CRS, bounds, pixel scale). COG adds internal tiling + overviews for HTTP range-request streaming.
- **Maintained by:** OGC (GeoTIFF), [cogeo.org](https://www.cogeo.org/) (COG)
- **Spec:** [OGC GeoTIFF Standard](https://www.ogc.org/standard/geotiff/)
- **NEXUS relevance:** Raster data (elevation models, satellite imagery, orthophotos). COG enables streaming without downloading full files. Parse with `geotiff.js` in browser.

---

### 3D Tiles (OGC)
- **What:** Specification for streaming massive heterogeneous 3D geospatial datasets (buildings, terrain, point clouds, photogrammetry).
- **Version:** 1.1 (with extensions: EXT_structural_metadata, EXT_mesh_features)
- **Maintained by:** OGC (originated at Cesium)
- **Spec:** [3D Tiles Specification](https://github.com/CesiumGS/3d-tiles/tree/main/specification)
- **NEXUS relevance:** Streaming large BIM/GIS/point cloud datasets in CesiumJS. Convert IFC models to 3D Tiles for web viewing. The metadata extensions allow per-feature properties (critical for BIM-GIS integration).

<details>
<summary><strong>LLM Prompt: 3D Tiles</strong></summary>

```
You are an expert in OGC 3D Tiles specification and its use in web-based geospatial platforms.

Context: I'm building a browser-native AEC platform (NEXUS) that renders BIM models, terrain, and point clouds together on a CesiumJS globe. We convert IFC models and LAS point clouds into 3D Tiles for streaming. The internal data model is ECS with cross-domain entity references.

When I ask about 3D Tiles:
- Explain tileset.json structure (root tile, bounding volumes, geometric error, refine strategy)
- Cover content formats: b3dm (batched 3D), i3dm (instanced), pnts (point cloud), glTF
- Describe the 1.1 metadata extensions (EXT_structural_metadata, EXT_mesh_features) for per-feature properties
- Address the IFC-to-3DTiles pipeline (what tools exist, what's lost in translation)
- Explain implicit tiling for large datasets (octree/quadtree templates)
- Cover styling (3D Tiles Styling language for conditional rendering)
- Note integration with CesiumJS APIs (Cesium3DTileset, Cesium3DTileStyle)

I need to understand both the spec and the practical pipeline for AEC data.
```
</details>

---

### GeoParquet
- **What:** Apache Parquet with geospatial metadata. Columnar storage for vector features — 10-100x faster than Shapefile/GeoJSON for analytical queries.
- **Maintained by:** [geoparquet.org](https://geoparquet.org/) (OGC candidate)
- **Spec:** [GeoParquet Specification](https://github.com/opengeospatial/geoparquet)
- **NEXUS relevance:** Cloud-native vector analytics. Read with DuckDB-WASM's spatial extension in-browser. Ideal for large feature datasets (parcels, building footprints, road networks).

---

### KML — Keyhole Markup Language (OGC)
- **What:** XML format for geographic visualization (originally Google Earth).
- **Maintained by:** OGC
- **Spec:** [OGC KML](https://www.ogc.org/standard/kml/)
- **NEXUS relevance:** Import from Google Earth/Maps workflows. Contains geometry + styling + camera views.

---

### CityGML / CityJSON
- **What:** OGC standard for 3D city models. Semantic building models with LOD (Level of Detail) 0-4.
- **Maintained by:** OGC (CityGML), [cityjson.org](https://www.cityjson.org/) (CityJSON — JSON encoding)
- **Spec:** [CityGML 3.0](https://www.ogc.org/standard/citygml/), [CityJSON 2.0](https://www.cityjson.org/specs/)
- **NEXUS relevance:** Urban-scale 3D models. Bridge between BIM (building-scale) and GIS (city-scale). CityJSON is browser-friendly. LOD concept maps to our multi-representation geometry.

---

### GML — Geography Markup Language (ISO 19136)
- **What:** XML grammar for expressing geographical features. Foundation for many OGC standards.
- **Maintained by:** OGC / ISO
- **Spec:** [ISO 19136](https://www.ogc.org/standard/gml/)
- **NEXUS relevance:** WFS responses often arrive as GML. Understanding GML geometry types is necessary for parsing OGC service responses.

---

## 4. Coordinate Reference Systems

### EPSG Registry / ISO 19111
- **What:** Database of coordinate reference systems, transformations, and datums. Every CRS has a numeric code (e.g., EPSG:4326 = WGS84, EPSG:32637 = UTM zone 37N).
- **Maintained by:** IOGP (International Association of Oil & Gas Producers)
- **Spec:** [EPSG Registry](https://epsg.org/), [ISO 19111](https://www.iso.org/standard/74039.html)
- **NEXUS relevance:** Core to every spatial operation. NEXUS stores EPSG codes per entity and reprojects via PROJ WASM. The floating-origin rendering pipeline depends on correct CRS handling.

### WKT2 — ISO 19162 (Well-Known Text for CRS)
- **What:** Text representation of coordinate reference systems. Successor to WKT1.
- **Maintained by:** OGC / ISO
- **Spec:** [ISO 19162](https://www.iso.org/standard/76496.html)
- **NEXUS relevance:** CRS definition strings stored in project files. PROJ parses WKT2 natively.

### Vertical Datums (EGM2008, NAVD88, AHD, etc.)
- **What:** Reference surfaces for elevation measurement. Geoid models convert between ellipsoidal height (GPS) and orthometric height (engineering).
- **Key datums:** EGM2008 (global geoid), NAVD88 (North America), AHD (Australia), EVRF2019 (Europe)
- **NEXUS relevance:** Civil engineering and surveying require orthometric heights. The `geoidSeparation` field in our CoordinateReference schema handles this. Critical for earthwork volumes and drainage design.

<details>
<summary><strong>LLM Prompt: CRS and Coordinate Handling</strong></summary>

```
You are a geodesy and coordinate reference system expert.

Context: I'm building a browser-native AEC platform (NEXUS) that unifies CAD, BIM, GIS, and civil engineering data. The platform uses a 5-stage coordinate transformation pipeline:
1. Parse source georeferencing (float64)
2. Build local-to-projected 4x4 affine transform
3. Reproject to WGS84 via PROJ WASM
4. Floating-origin rebase (float64 → float32 for GPU)
5. Camera-relative submission to WebGL/WebGPU

The core challenge: UTM easting at 500,000m with float32 = 0.06m jitter. We solve this with floating-origin, but need to handle CRS correctly at every stage.

When I ask about CRS:
- Reference specific EPSG codes and their properties (bounds, units, axes)
- Explain the distinction between geographic (lat/lon), projected (easting/northing), and engineering (local) CRS
- Cover vertical datums and geoid models — when does ellipsoidal vs orthometric height matter?
- Describe PROJ WASM usage patterns (proj4js vs full PROJ WASM)
- Address datum transformation accuracy (e.g., WGS84 ↔ NAD83 — are they identical or not?)
- Explain compound CRS (horizontal + vertical) and how PROJ handles them
- Cover the precision implications of CRS choice for engineering-grade work (mm accuracy)

I need geodetically rigorous answers that account for browser/WASM constraints.
```
</details>

---

## 5. Civil Engineering / Transportation

### AASHTO — A Policy on Geometric Design of Highways and Streets ("Green Book")
- **What:** The primary design standard for roads and highways in the United States. Defines design speed, sight distance, horizontal curves, vertical curves, lane widths, superelevation, intersection geometry.
- **Edition:** 7th Edition (2018)
- **Maintained by:** American Association of State Highway and Transportation Officials
- **Spec:** [AASHTO Publications](https://store.transportation.org/) (paid; widely available in engineering libraries)
- **NEXUS relevance:** Core constraint system for road alignment design (v0.5). Every horizontal curve radius, vertical curve length, and cross-section parameter must comply. Maps to `ParametricConstraint.source` in our schema.
- **Key tables:** Table 3-7 (min radius by design speed), Table 3-34 (K-values for crest/sag vertical curves), Table 3-36 (superelevation), Chapter 9 (intersections)

<details>
<summary><strong>LLM Prompt: AASHTO Road Design</strong></summary>

```
You are a highway geometric design expert specializing in AASHTO standards.

Context: I'm building a browser-native road alignment design tool as part of a unified AEC platform (NEXUS). The system uses parametric alignment objects (horizontal: tangents + circular curves + spirals; vertical: tangents + parabolic curves) with constraints enforced by design standards.

Design standards supported: AASHTO 2018 (primary), DMRB (UK), Austroads, IRC (India).

When I ask about AASHTO:
- Reference specific tables and section numbers (e.g., "Table 3-7: Minimum Radius")
- Provide the actual formula or lookup values (e.g., R_min = V² / (127 × (e_max + f_max)))
- Cover horizontal alignment: tangent, circular curve, spiral (clothoid), compound curves
- Cover vertical alignment: crest curves, sag curves, K-values, sight distance
- Cover cross-section: lane width, shoulder width, superelevation, crown slope, clear zone
- Explain how design speed propagates through ALL geometric parameters
- Note where AASHTO conflicts with or differs from DMRB/Austroads/IRC
- Address iterative design: what happens when terrain forces a constraint violation

I need formulae and constraint values I can encode as validation rules in Rust/WASM.
```
</details>

---

### DMRB — Design Manual for Roads and Bridges (UK)
- **What:** UK standard for highway design, assessment, and maintenance. Covers geometry, structures, geotechnics, drainage.
- **Maintained by:** National Highways (UK)
- **Spec:** [DMRB Standards](https://www.standardsforhighways.co.uk/dmrb/)
- **NEXUS relevance:** Alternative design standard for UK projects. Different curve/speed relationships and cross-section requirements compared to AASHTO.

### Austroads — Guide to Road Design (Australia/NZ)
- **What:** Australian/NZ road design standards. 8-part guide covering geometric design, intersections, drainage, road environment.
- **Maintained by:** Austroads
- **Spec:** [Austroads Publications](https://austroads.com.au/publications)
- **NEXUS relevance:** Alternative design standard for Australian projects.

### IRC — Indian Roads Congress Standards
- **What:** Indian road design standards covering geometric design, pavements, structures, traffic engineering.
- **Maintained by:** Indian Roads Congress
- **Spec:** [IRC Publications](https://irc.nic.in/irc-publications)
- **Key codes:** IRC:73 (geometric design of rural highways), IRC:86 (geometric design of urban roads)
- **NEXUS relevance:** Alternative design standard for Indian projects.

---

### LandXML
- **What:** XML schema for civil engineering and land surveying data — alignments, surfaces, parcels, pipe networks.
- **Version:** 2.0
- **Maintained by:** LandXML.org (community standard)
- **Spec:** [LandXML Schema](http://www.landxml.org/schema/LandXML-2.0/LandXML-2.0.xsd)
- **NEXUS relevance:** Import/export for alignment and surface data from Civil 3D, 12d, OpenRoads. Maps directly to our Civil entity types (Alignment, Profile, Corridor, GradingSurface).
- **Key elements:** `<Alignment>`, `<Profile>`, `<CrossSects>`, `<Surface>` (TIN), `<Parcel>`, `<PipeNetwork>`

<details>
<summary><strong>LLM Prompt: LandXML / Civil Data Exchange</strong></summary>

```
You are an expert in LandXML and civil engineering data exchange formats.

Context: I'm building a browser-native civil engineering design tool (part of NEXUS) that imports/exports alignment, surface, and pipe network data. The primary interchange format is LandXML 2.0, with InfraGML as a future target. Internal representation uses ECS with parametric alignment components.

When I ask about LandXML:
- Describe the XML schema structure for alignments (horizontal: Line, Curve, Spiral; vertical: PVI, ParaCurve, CircCurve)
- Explain surface representation (TIN: Pnts, Faces, Breaklines)
- Cover pipe network elements (Pipe, Structure, InvertElev)
- Show how stationing and offset work in the schema
- Address cross-section assembly representation
- Note known issues (ambiguous spiral definitions, missing corridor model, schema validation gaps)
- Compare with InfraGML (OGC) and explain the migration path

I need practical parsing guidance for browser/WASM implementation.
```
</details>

---

### InfraGML (OGC)
- **What:** OGC standard for infrastructure facility information (roads, railways, bridges, tunnels). GML-based replacement for LandXML with proper OGC/ISO compliance.
- **Maintained by:** OGC
- **Spec:** [InfraGML Standard](https://www.ogc.org/standard/infragml/)
- **NEXUS relevance:** Future-proof infrastructure data exchange. More rigorous than LandXML but less widely adopted.

### OpenDRIVE
- **What:** Open standard for road network description. Used in driving simulation, autonomous vehicle development, and digital twins.
- **Version:** 1.8
- **Maintained by:** ASAM (Association for Standardization of Automation and Measuring Systems)
- **Spec:** [ASAM OpenDRIVE](https://www.asam.net/standards/detail/opendrive/)
- **NEXUS relevance:** Export for simulation workflows. Detailed road surface geometry, lane topology, and road markings.

---

## 6. Structural Engineering

### AISC 360 — Specification for Structural Steel Buildings
- **What:** US standard for structural steel design. Covers tension, compression, flexure, shear, connections, stability.
- **Edition:** AISC 360-22
- **Maintained by:** American Institute of Steel Construction
- **Spec:** [AISC Standards](https://www.aisc.org/publications/steel-construction-manual-resources/)
- **NEXUS relevance:** Steel member sizing in BIM structural frame generation. Referenced by `generate_structural_frame` tool's `design_code` parameter.

### ACI 318 — Building Code Requirements for Structural Concrete
- **What:** US standard for reinforced concrete design. Covers flexure, shear, columns, foundations, durability.
- **Edition:** ACI 318-19
- **Maintained by:** American Concrete Institute
- **Spec:** [ACI 318](https://www.concrete.org/store/productdetail.aspx?ItemID=31819)
- **NEXUS relevance:** Concrete member sizing and reinforcement design in BIM.

### Eurocodes (EN 1990–1999)
- **What:** European structural design standards suite.
  - **EN 1990** (Eurocode 0): Basis of structural design
  - **EN 1991** (Eurocode 1): Actions on structures (loads)
  - **EN 1992** (Eurocode 2): Concrete structures
  - **EN 1993** (Eurocode 3): Steel structures
  - **EN 1994** (Eurocode 4): Composite structures
  - **EN 1995** (Eurocode 5): Timber structures
  - **EN 1997** (Eurocode 7): Geotechnical design
  - **EN 1998** (Eurocode 8): Seismic design
- **Maintained by:** CEN (European Committee for Standardization)
- **Spec:** [Eurocodes at CEN](https://eurocodes.jrc.ec.europa.eu/)
- **NEXUS relevance:** European BIM projects require Eurocode compliance. Member sizing, load combinations, and material properties all differ from US codes.

### ASCE 7 — Minimum Design Loads and Associated Criteria for Buildings
- **What:** US standard for structural loads — dead, live, wind, snow, seismic, flood, tsunami.
- **Edition:** ASCE 7-22
- **Maintained by:** American Society of Civil Engineers
- **Spec:** [ASCE 7](https://www.asce.org/publications-and-news/asce-7)
- **NEXUS relevance:** Load definitions for structural analysis. Wind/seismic maps, risk categories, load combinations.

### AS 4100 — Steel Structures (Australia)
- **What:** Australian standard for steel structure design.
- **Maintained by:** Standards Australia
- **NEXUS relevance:** Australian BIM projects. Referenced in `generate_structural_frame` tool.

<details>
<summary><strong>LLM Prompt: Structural Engineering Standards</strong></summary>

```
You are a structural engineering expert familiar with AISC 360, ACI 318, Eurocodes, ASCE 7, and AS 4100.

Context: I'm building a browser-native AEC platform (NEXUS) that generates structural frames (columns + beams) from floor plate geometry, applies member sizing based on span/load/material, and checks utilization ratios against design codes. The BIM module uses ECS entities with structural property components.

When I ask about structural codes:
- Reference specific code sections and equations (e.g., AISC 360 Chapter E for compression)
- Provide member sizing logic (how to select a W-shape given span, load, and deflection limits)
- Cover load combinations per ASCE 7 (e.g., 1.2D + 1.6L + 0.5Lr)
- Explain utilization ratio calculation (demand/capacity)
- Note differences between US (LRFD/ASD), European (limit state), and Australian approaches
- Address seismic design categories and their impact on member sizing
- Cover deflection limits (L/240, L/360) and which code governs

I need formulae and decision logic I can implement in validation rules.
```
</details>

---

## 7. Surveying / Geodesy

### GNSS / RINEX
- **What:** RINEX (Receiver Independent Exchange Format) is the standard for GNSS observation data (GPS, GLONASS, Galileo, BeiDou).
- **Version:** RINEX 3.05 / 4.01
- **Maintained by:** IGS (International GNSS Service)
- **Spec:** [RINEX Format](https://files.igs.org/pub/data/format/)
- **NEXUS relevance:** Survey data import. Post-processing GNSS observations for control point coordinates.

### Geodetic Control Standards (NSRS, CORS)
- **What:** National Spatial Reference System (US) — framework of geodetic control points and continuously operating reference stations (CORS).
- **Maintained by:** NOAA/NGS (National Geodetic Survey)
- **Spec:** [NGS Tools and Data](https://geodesy.noaa.gov/)
- **NEXUS relevance:** Survey control networks. The `ControlNetwork` entity type in USES schema. Datum transformations between NAD83 epochs.

### ISO 17123 — Optics and Optical Instruments — Field Procedures for Testing Surveying Instruments
- **What:** Standard procedures for testing EDM, total stations, GNSS, levels, theodolites.
- **Parts:** 1-9 covering different instrument types
- **Maintained by:** ISO TC 172/SC 6
- **NEXUS relevance:** Instrument accuracy specifications that inform survey adjustment weights and error ellipses.

### Least Squares Adjustment
- **What:** Mathematical method for optimal estimation of survey coordinates from redundant observations. Not a "standard" per se, but the universally accepted methodology (codified in FIG, ICSM, and national guidelines).
- **Key references:** Ghilani "Adjustment Computations" (textbook standard), FIG publications
- **NEXUS relevance:** Traverse and network adjustment in the Survey domain. Weighted observations, variance-covariance matrices, error ellipses.

<details>
<summary><strong>LLM Prompt: Surveying and Geodesy</strong></summary>

```
You are a surveying and geodesy expert with knowledge of GNSS processing, control networks, and least squares adjustment.

Context: I'm building a browser-native AEC platform (NEXUS) with a surveying module. The platform handles:
- Survey point import (CSV, RINEX, field book formats)
- Traverse computation and adjustment
- Control network adjustment (least squares)
- Coordinate transformations between datums (via PROJ WASM)
- Error ellipse computation and visualization

Entity types: SurveyPoint, Traverse, ControlNetwork, Boundary (from our ECS schema).

When I ask about surveying:
- Reference specific formulas (inverse/forward geodetic problems, traverse adjustment methods)
- Cover GNSS processing levels (autonomous, DGNSS, RTK, PPP, PPK)
- Explain datum realization vs datum definition (e.g., NAD83(2011) epoch 2010.0)
- Describe least squares adjustment mechanics (design matrix A, weight matrix P, normal equations)
- Cover error propagation and quality metrics (PDOP, error ellipses, redundancy numbers)
- Address the practical accuracy achievable in browser-based computation (float64 is sufficient?)

I need computational methods I can implement in Rust/WASM.
```
</details>

---

## 8. Point Cloud / LiDAR

### LAS — ASPRS LASer File Format
- **What:** Binary format for LiDAR point cloud data. Each point has XYZ, intensity, classification, return number, GPS time, RGB.
- **Version:** LAS 1.4 (with point formats 0-10)
- **Maintained by:** ASPRS (American Society for Photogrammetry and Remote Sensing)
- **Spec:** [LAS 1.4 Specification](https://www.asprs.org/divisions-committees/lidar-division/laser-las-file-format-exchange-activities)
- **NEXUS relevance:** Primary point cloud format. Parse in browser via `laz-perf` WASM. Map to `PointCloudRegion` entity.
- **Key fields:** X, Y, Z (scaled int32), Intensity, Classification (ASPRS codes: 2=Ground, 6=Building, 9=Water, etc.), Return Number, GPS Time, RGB

### LAZ — Compressed LAS
- **What:** Lossless compression of LAS files (typically 7-20x smaller). Industry standard.
- **Maintained by:** Martin Isenburg / rapidlasso (LAStools); now open standard
- **Spec:** [LAZ Specification](https://laszip.org/)
- **NEXUS relevance:** Practical LiDAR distribution format. Decompress in-browser via `laz-perf` WASM.

### COPC — Cloud-Optimized Point Cloud
- **What:** LAZ 1.4 with a clustered octree organization enabling HTTP range-request streaming. Like COG for point clouds.
- **Maintained by:** [copc.io](https://copc.io/) (HOBU, Inc.)
- **Spec:** [COPC Specification](https://copc.io/)
- **NEXUS relevance:** Stream LiDAR from cloud storage without downloading entire files. Parse with `copc.js`. Critical for large survey datasets (billions of points).

### ASPRS Classification Codes
- **What:** Standardized point classification scheme for LiDAR data.
- **Key codes:** 1=Unclassified, 2=Ground, 3=Low Vegetation, 4=Medium Vegetation, 5=High Vegetation, 6=Building, 7=Low Point (Noise), 9=Water, 10=Rail, 11=Road Surface, 17=Bridge Deck, 18=High Noise
- **NEXUS relevance:** Classification display and filtering. Maps to `classifications` array in `PointCloudReference` component.

<details>
<summary><strong>LLM Prompt: Point Cloud / LiDAR</strong></summary>

```
You are a LiDAR and point cloud processing expert.

Context: I'm building a browser-native AEC platform (NEXUS) that renders and analyzes point clouds. The stack:
- Potree (WebGL) or Potree-Next (WebGPU) for rendering
- laz-perf (WASM) for LAZ decompression
- copc.js for streaming COPC from cloud storage
- Rust/WASM for spatial queries and classification

Entity types: PointCloudRegion, ClassifiedSegment (ECS components with octree references).

When I ask about point clouds:
- Reference LAS 1.4 point record formats and their fields
- Explain octree/LOD strategies (Potree format, 3D Tiles pnts, COPC)
- Cover ASPRS classification codes and ML-based reclassification
- Describe terrain extraction (ground filtering: progressive morphological, cloth simulation)
- Address rendering budgets (point budget, LOD selection, GPU instancing)
- Cover coordinate precision (LAS stores scaled int32 — implications for large-extent surveys)
- Explain integration with BIM/GIS data (scan-to-BIM, deviation analysis)

I need browser/WASM-aware implementation guidance.
```
</details>

---

## 9. Remote Sensing / Earth Observation

### STAC — SpatioTemporal Asset Catalog
- **What:** Specification for cataloging and searching spatiotemporal data (satellite imagery, drone orthophotos, DEMs, weather data).
- **Version:** 1.0
- **Maintained by:** [STAC Community](https://stacspec.org/)
- **Spec:** [STAC Specification](https://github.com/radiantearth/stac-spec)
- **NEXUS relevance:** Search and discover remote sensing data. STAC API + COG = full cloud-native raster pipeline. Feed orthophotos and DEMs into the platform.

### OGC SensorThings API
- **What:** OGC standard for IoT sensor data. RESTful API for Observations, Datastreams, Things, Sensors, Observed Properties.
- **Maintained by:** OGC
- **Spec:** [SensorThings API](https://www.ogc.org/standard/sensorthings/)
- **NEXUS relevance:** Digital twin IoT integration. Stream sensor data (structural monitoring, environmental sensors, construction equipment telemetry).

### Orthophoto / Orthoimage Standards
- **What:** Geometrically corrected aerial/satellite imagery with uniform scale. Delivered as GeoTIFF/COG.
- **Key standards:** ASPRS Positional Accuracy Standards, USGS Lidar Base Specification
- **NEXUS relevance:** Base layers for survey, civil, and GIS work. Accuracy specifications determine what design decisions can rely on ortho measurements.

<details>
<summary><strong>LLM Prompt: Remote Sensing Data Integration</strong></summary>

```
You are a remote sensing and earth observation expert.

Context: I'm building a browser-native AEC platform (NEXUS) that integrates remote sensing data (satellite imagery, drone orthophotos, DEMs, point clouds) with CAD, BIM, and GIS data. The platform runs entirely in the browser using WASM and WebGL/WebGPU.

Data pipeline: STAC catalog → COG/COPC URLs → streaming via HTTP range requests → browser rendering.

When I ask about remote sensing:
- Describe the STAC specification and how to query STAC APIs from a browser
- Explain COG (Cloud-Optimized GeoTIFF) structure and HTTP range-request patterns
- Cover common satellite imagery sources and their spatial/spectral resolution
- Describe DEM formats and vertical accuracy considerations for civil engineering
- Address radiometric vs geometric correction and when each matters
- Cover change detection workflows (comparing multi-temporal imagery)
- Explain how drone orthophoto accuracy relates to GCP density and flight parameters

I need cloud-native, browser-compatible data access patterns.
```
</details>

---

## 10. Construction Management

### ISO 21597 — Information Container for Linked Document Delivery (ICDD)
- **What:** Standard for packaging and linking heterogeneous documents (IFC, PDF, spreadsheets) in a single container with semantic links between them.
- **Maintained by:** ISO TC 59/SC 13
- **Spec:** [ISO 21597](https://www.iso.org/standard/74389.html)
- **NEXUS relevance:** Construction document packages. Links between 3D model, specifications, schedules, and inspection reports.

### ISO 16739-1 — IFC for Construction (IFC4.3 Infrastructure Extensions)
- **What:** IFC4.3 extends IFC to infrastructure: roads (IfcRoad), railways (IfcRailway), bridges (IfcBridge), ports (IfcMarineFacility), earthworks (IfcEarthworksCut/Fill).
- **Maintained by:** buildingSMART International
- **Spec:** [IFC4.3 Infrastructure](https://standards.buildingsmart.org/IFC/RELEASE/IFC4_3/)
- **NEXUS relevance:** Critical bridge between our Civil and BIM domains. Road alignments in IFC4.3 can reference the same parametric definitions we use internally.

### PAS 1192 (UK BIM Framework, now superseded by ISO 19650)
- **What:** UK predecessor to ISO 19650. PAS 1192-2 (capital/delivery phase), PAS 1192-3 (operational phase), PAS 1192-5 (security).
- **Maintained by:** BSI (superseded but still referenced in contracts)
- **NEXUS relevance:** Legacy UK projects may still reference PAS 1192 in contracts. Concepts are absorbed into ISO 19650.

### FIDIC Contracts and Digital Delivery
- **What:** International construction contract templates. FIDIC 2017 editions acknowledge BIM and digital delivery.
- **Maintained by:** International Federation of Consulting Engineers (FIDIC)
- **NEXUS relevance:** Understanding contractual context for information delivery requirements. Who owns AI-generated design data?

---

## 11. Data Exchange / Interoperability

### JSON-LD / Schema.org
- **What:** JSON-LD is a method for encoding linked data using JSON. Schema.org provides vocabularies for structured data.
- **Maintained by:** W3C (JSON-LD), Schema.org community
- **Spec:** [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/), [Schema.org](https://schema.org/)
- **NEXUS relevance:** Semantic interoperability. Annotate NEXUS entities with Schema.org types for web-wide discoverability. AI agents can reason over linked data.

### FlatBuffers
- **What:** Efficient cross-platform serialization library. Zero-copy access, smaller than Protocol Buffers, no parsing step.
- **Maintained by:** Google
- **Spec:** [FlatBuffers Documentation](https://flatbuffers.dev/)
- **NEXUS relevance:** Already used in USES schema (`uses.fbs`). High-performance serialization for WASM ↔ JS bridge and network transmission. The `web-ifc` fragments format uses FlatBuffers.

### glTF — GL Transmission Format (Khronos)
- **What:** The "JPEG of 3D." Runtime delivery format for 3D models — meshes, materials, animations, scenes.
- **Version:** glTF 2.0 (with extensions: KHR_mesh_quantization, EXT_structural_metadata)
- **Maintained by:** Khronos Group
- **Spec:** [glTF 2.0 Specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html)
- **NEXUS relevance:** 3D model delivery format. Three.js loads glTF natively. BIM → glTF pipeline for web rendering. 3D Tiles uses glTF as content format.

### IPC / Arrow (Apache)
- **What:** In-memory columnar format for analytical data processing. Zero-copy, cross-language.
- **Maintained by:** Apache Software Foundation
- **Spec:** [Apache Arrow](https://arrow.apache.org/docs/format/Columnar.html)
- **NEXUS relevance:** High-performance data transfer between WASM modules and JavaScript. DuckDB-WASM uses Arrow internally.

---

## 12. AI / Model Context Protocol

### MCP — Model Context Protocol
- **What:** Open protocol for AI systems to interact with external tools and data sources. Defines tool schemas, resource access, and prompts.
- **Version:** 2025-03-26 (latest)
- **Maintained by:** Anthropic (adopted by OpenAI, Microsoft, Google)
- **Spec:** [MCP Specification](https://modelcontextprotocol.io/specification/2025-03-26)
- **NEXUS relevance:** Core AI integration protocol. Every NEXUS command is exposed as an MCP tool. AI agents call tools, read project state, and produce geometry through MCP.

### OpenAI Function Calling / Anthropic Tool Use
- **What:** LLM provider protocols for structured tool invocation. JSON Schema parameter definitions, typed returns.
- **Spec:** [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use/overview), [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- **NEXUS relevance:** NEXUS tool schemas (`docs/api/agent-tools.ts`) follow this format. MCP wraps these for standardized access.

<details>
<summary><strong>LLM Prompt: MCP Tool Design for AEC</strong></summary>

```
You are an expert in MCP (Model Context Protocol) and AI tool design for engineering applications.

Context: I'm building a browser-native AEC platform (NEXUS) where every geometric/data operation is exposed as an MCP tool. We currently have 16 tool schemas covering civil engineering, BIM, clash detection, and quantity takeoff. The platform uses ECS (Entity-Component-System) internally.

Design principles:
- Every tool must be callable without GUI context
- Parameters use JSON Schema with enums, min/max, and defaults
- Returns are structured objects, not free text
- Tools reference design standards (e.g., AASHTO_2018, AISC_360)
- Tools operate on entity IDs, not raw geometry

When I ask about MCP tool design:
- Evaluate tool schemas for completeness and usability
- Suggest missing tools for a given domain
- Review parameter design (are enums complete? are defaults sensible?)
- Address error handling patterns (what should tools return on failure?)
- Cover tool composition (how should agents chain tools for complex workflows?)
- Explain resource and prompt patterns in MCP (not just tools)
- Address security: what prevents an agent from calling destructive tools?

I need tool design guidance specific to engineering/AEC, not generic API design.
```
</details>

---

## Cross-Domain Reference Prompt

Use this when an AI agent needs full context about NEXUS's standards landscape:

<details>
<summary><strong>LLM Prompt: NEXUS Standards Context (Full)</strong></summary>

```
You are an AEC (Architecture, Engineering, Construction) technology expert working on NEXUS — a browser-native platform that unifies CAD, BIM, GIS, Civil Engineering, Surveying, and Construction in one application.

NEXUS architecture:
- Rust/WASM geometry kernel + TypeScript/Svelte UI
- ECS (Entity-Component-System) data model — entities are IDs with component data bags
- Event-sourced state — every mutation produces an immutable event
- MCP (Model Context Protocol) — every operation is an AI-callable tool
- Six domains: CAD, BIM, GIS, Civil, Survey, PointCloud, Construction

Standards the platform must support:

FILE FORMATS:
- DXF R2018 (2D/3D CAD exchange)
- IFC 2x3/4/4.3 (BIM — buildings + infrastructure)
- STEP AP203/AP214/AP242 (3D B-Rep exchange)
- LandXML 2.0 (civil alignments, surfaces, parcels)
- LAS 1.4 / LAZ / COPC (point clouds)
- GeoJSON, GeoPackage, Shapefile (GIS vectors)
- GeoTIFF / COG (rasters)
- 3D Tiles 1.1 (streaming 3D datasets)
- glTF 2.0 (3D model delivery)
- CityGML / CityJSON (urban 3D models)
- BCF 3.0 (BIM collaboration issues)

DESIGN CODES:
- AASHTO 2018 Green Book (US road design)
- DMRB (UK road design)
- Austroads (AU/NZ road design)
- IRC (India road design)
- AISC 360 (US steel structures)
- ACI 318 (US concrete structures)
- Eurocodes EN 1990-1999 (European structural design)
- ASCE 7 (US structural loads)

GEOSPATIAL:
- EPSG registry / ISO 19111 (coordinate reference systems)
- WKT2 / ISO 19162 (CRS text representation)
- OGC WMS, WFS, WCS, WMTS, OGC API (web services)
- PROJ (coordinate transformations)
- Vertical datums: EGM2008, NAVD88, AHD

INFORMATION MANAGEMENT:
- ISO 19650 (BIM information management lifecycle)
- bSDD (buildingSMART Data Dictionary)
- COBie (facility handover)
- MCP (Model Context Protocol for AI tools)

When answering questions:
- Reference specific standard sections, tables, and clause numbers
- Note which NEXUS domain and entity types are affected
- Flag where standards conflict or leave ambiguity
- Consider browser/WASM implementation constraints
- Distinguish between "must implement now" (v0.1-0.2) and "must support eventually"
```
</details>

---

## Authoritative Sources Quick Reference

| Organization | Domain | URL |
|---|---|---|
| buildingSMART International | BIM, IFC, BCF, bSDD | [buildingsmart.org](https://www.buildingsmart.org/) |
| Open Geospatial Consortium (OGC) | GIS, 3D Tiles, CityGML, InfraGML | [ogc.org](https://www.ogc.org/) |
| ISO TC 59/SC 13 | BIM information management | [iso.org](https://www.iso.org/) |
| ISO TC 184/SC 4 | STEP, product data | [iso.org](https://www.iso.org/) |
| AASHTO | US road design | [transportation.org](https://www.transportation.org/) |
| AISC | US steel structures | [aisc.org](https://www.aisc.org/) |
| ACI | US concrete structures | [concrete.org](https://www.concrete.org/) |
| CEN | Eurocodes | [eurocodes.jrc.ec.europa.eu](https://eurocodes.jrc.ec.europa.eu/) |
| ASCE | US structural loads, civil | [asce.org](https://www.asce.org/) |
| ASPRS | LiDAR, photogrammetry | [asprs.org](https://www.asprs.org/) |
| IOGP | EPSG, CRS registry | [epsg.org](https://epsg.org/) |
| NOAA/NGS | Geodetic control, datums | [geodesy.noaa.gov](https://geodesy.noaa.gov/) |
| Khronos Group | glTF, WebGL, WebGPU | [khronos.org](https://www.khronos.org/) |
| IETF | GeoJSON (RFC 7946) | [ietf.org](https://www.ietf.org/) |
| Autodesk | DXF, DWG | [autodesk.com](https://www.autodesk.com/) |
| ASAM | OpenDRIVE | [asam.net](https://www.asam.net/) |
| Anthropic | MCP | [modelcontextprotocol.io](https://modelcontextprotocol.io/) |
| National Highways (UK) | DMRB | [standardsforhighways.co.uk](https://www.standardsforhighways.co.uk/) |
| Austroads | AU/NZ road design | [austroads.com.au](https://austroads.com.au/) |
| STAC Community | Remote sensing catalog | [stacspec.org](https://stacspec.org/) |
