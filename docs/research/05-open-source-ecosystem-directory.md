# NEXUS Open-Source Ecosystem Directory

> Comprehensive catalog of every open-source repo, app, library, tool, and resource related to NEXUS initiatives: 2D/3D CAD, BIM, GIS, Civil Engineering, Surveying, Remote Sensing, Point Cloud, Digital Twin, Construction, and the underlying platform stack (Rust/WASM, ECS, rendering, collaboration, AI agents).
>
> Last updated: 2026-04-12

---

## Table of Contents

1. [Browser-Based CAD](#1-browser-based-cad)
2. [Desktop CAD (Reference)](#2-desktop-cad-reference)
3. [Geometry Kernels (WASM)](#3-geometry-kernels-wasm)
4. [2D Constraint Solvers](#4-2d-constraint-solvers)
5. [BIM / IFC Processing](#5-bim--ifc-processing)
6. [BIM Viewers (Web)](#6-bim-viewers-web)
7. [BIM Authoring & Platforms](#7-bim-authoring--platforms)
8. [Construction Management](#8-construction-management)
9. [GIS — 3D Globe & Terrain](#9-gis--3d-globe--terrain)
10. [GIS — 2D / Vector Mapping](#10-gis--2d--vector-mapping)
11. [GIS — Vector Tiles & Cloud-Native Formats](#11-gis--vector-tiles--cloud-native-formats)
12. [GIS — Spatial Analysis & Indexing](#12-gis--spatial-analysis--indexing)
13. [Coordinate Systems & Projections](#13-coordinate-systems--projections)
14. [Remote Sensing & Satellite Imagery](#14-remote-sensing--satellite-imagery)
15. [Point Cloud](#15-point-cloud)
16. [Photogrammetry & Drone Mapping](#16-photogrammetry--drone-mapping)
17. [3D City Models (CityGML / CityJSON)](#17-3d-city-models-citygml--cityjson)
18. [Digital Twin & IoT](#18-digital-twin--iot)
19. [File Format Parsers & Writers](#19-file-format-parsers--writers)
20. [3D Rendering (WebGL / WebGPU)](#20-3d-rendering-webgl--webgpu)
21. [Svelte Ecosystem & UI](#21-svelte-ecosystem--ui)
22. [Gaussian Splatting & NeRF (Web)](#22-gaussian-splatting--nerf-web)
23. [Rust Spatial / Physics / Math](#23-rust-spatial--physics--math)
24. [ECS Libraries & Patterns](#24-ecs-libraries--patterns)
25. [Event Sourcing & CQRS](#25-event-sourcing--cqrs)
26. [Real-Time Collaboration (CRDT)](#26-real-time-collaboration-crdt)
27. [In-Browser Databases](#27-in-browser-databases)
28. [Browser Storage (OPFS)](#28-browser-storage-opfs)
29. [AI / LLM / Agent Orchestration](#29-ai--llm--agent-orchestration)
30. [MCP Servers (AI ↔ CAD/BIM/GIS)](#30-mcp-servers-ai--cadbimgis)
31. [In-Browser AI Inference](#31-in-browser-ai-inference)
32. [Robotics / ROS 2 / Telemetry](#32-robotics--ros-2--telemetry)
33. [Build Tools & Monorepo](#33-build-tools--monorepo)
34. [OGC Standards & Web Services](#34-ogc-standards--web-services)
35. [Curated Lists & Meta-Resources](#35-curated-lists--meta-resources)

---

## 1. Browser-Based CAD

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **CADmium** | Browser-based parametric CAD. Rust/WASM + SvelteKit + Three.js. Uses Truck B-Rep kernel. | Rust, TS | — | [GitHub](https://github.com/CADmium-Co/CADmium) · [Blog](https://mattferraro.dev/posts/cadmium) |
| **Chili3D** | Browser-based 3D CAD. Compiles OpenCASCADE to WASM. Boolean ops, filleting, parametric modeling, industry-standard file formats. | TS, C++ | — | [GitHub](https://github.com/xiangechen/chili3d) · [Article](https://www.blog.brightcoding.dev/2026/03/12/chili3d-the-revolutionary-browser-cad-tool-developers-crave) |
| **CADAM** | AI-powered text-to-CAD web app. WASM-native with parametric slider controls. | TS | — | [GitHub](https://github.com/Adam-CAD/CADAM) |
| **replicad** | TypeScript CAD library built on opencascade.js. B-Rep operations, STEP export, fillets, lofts. | TS | MIT | [Homepage](https://replicad.xyz/) · [GitHub](https://github.com/sgenoud/replicad) |
| **JSketcher** | Parametric 2D/3D modeler in pure JavaScript. Uses OpenCASCADE for solid ops. | JS | — | [GitHub](https://github.com/xibyte/jsketcher) |
| **CascadeStudio** | Live-scripted CAD kernel in browser using opencascade.js. | JS | — | [GitHub](https://github.com/nicholasgasior/CascadeStudio) |
| **JSCAD** | Code-based parametric 3D modeling in browser. Pure JS CSG engine. | JS | MIT | [Homepage](https://openjscad.xyz/) · [GitHub](https://github.com/jscad/OpenJSCAD.org) |
| **Zoo Design Studio** | Browser CAD by Zoo.dev. Code-first KCL language. AI text-to-CAD. | Rust, TS | MIT (app) | [Homepage](https://zoo.dev/) · [GitHub](https://github.com/KittyCAD/modeling-app) |
| **Shapesmith** | Open-source, browser-based 3D solid modeler. | JS | — | [Homepage](https://shapesmith.net/) |

---

## 2. Desktop CAD (Reference)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **FreeCAD** | Full-featured desktop parametric CAD. v1.1 released March 2026. planegcs for 2D constraints. | C++, Python | LGPL | [Homepage](https://www.freecad.org/) · [GitHub](https://github.com/FreeCAD/FreeCAD) |
| **SolveSpace** | Lightweight parametric 2D/3D CAD with constraint solver. Experimental WASM port exists. | C++ | GPL-3.0 | [Homepage](https://solvespace.com/) · [GitHub](https://github.com/solvespace/solvespace) |
| **Dune3D** | Parametric 3D CAD with constraint solver. C++/GTK4/OpenCASCADE. | C++ | GPL-3.0 | [GitHub](https://github.com/dune3d/dune3d) |

---

## 3. Geometry Kernels (WASM)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **opencascade.js** | Full OpenCASCADE B-Rep kernel compiled to WASM. Boolean ops, NURBS, fillets, STEP I/O. | C++ → WASM | LGPL-2.1 | [GitHub](https://github.com/nicholasgasior/opencascade.js) |
| **Truck** | Rust CAD kernel. B-rep with NURBS. Vertex/edge/wire/face/shell/solid topology. JS wrapper. | Rust | Apache-2.0 | [GitHub](https://github.com/ricosjp/truck) |
| **Monstertruck** | Rust-native B-Rep + NURBS from scratch. Includes T-splines. WebAssembly/JS bindings. | Rust | — | [GitHub](https://github.com/virtualritz/monstertruck) |
| **Fornjot** | Early-stage B-Rep CAD kernel written in Rust. Active development. | Rust | — | [Homepage](https://www.fornjot.app/) · [GitHub](https://github.com/hannobraun/fornjot) |
| **csgrs** | Multi-modal CSG kernel in Rust. 32/64-bit floats. WASM support. | Rust | — | [GitHub](https://github.com/timschmidt/csgrs) |
| **Manifold** | Ultra-fast guaranteed-manifold mesh booleans. Google-backed. WASM build. | C++ | Apache-2.0 | [GitHub](https://github.com/elalish/manifold) |
| **opencascade-rs** | Rust bindings to OpenCASCADE. Can compile to WASM. | Rust | — | [GitHub](https://github.com/nicholasgasior/opencascade-rs) |
| **occt-import-js** | Emscripten interface for OpenCASCADE import. Reads BREP, STEP, IGES in browser. | C++ → WASM | — | [GitHub](https://github.com/nicholasgasior/occt-import-js) |

---

## 4. 2D Constraint Solvers

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **planegcs** | FreeCAD's 2D geometric constraint solver ported to WASM. | C++ → WASM | LGPL | [GitHub](https://github.com/nicholasgasior/planegcs) |
| **SolveSpace (WASM)** | Experimental WASM port of SolveSpace's constraint solver. | C++ → WASM | GPL-3.0 | [GitHub](https://github.com/nicholasgasior/solvespace) |

---

## 5. BIM / IFC Processing

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **web-ifc** | C++ IFC parser compiled to WASM. Reads & writes IFC at native speed. Converts to "Fragments" binary format. | C++ → WASM | MPL-2.0 | [GitHub](https://github.com/ThatOpen/engine_web-ifc) |
| **IFC-lite** | Browser-native IFC viewer. Rust/WASM parser + WebGPU rendering. IFC4X3 schema (876 entities). 5x faster geometry processing. | Rust, TS | — | [GitHub](https://github.com/louistrue/ifc-lite) · [Crate](https://crates.io/crates/ifc-lite-core) |
| **IfcOpenShell** | C++ IFC geometry engine with Python bindings. Most complete open-source IFC toolkit. | C++, Python | LGPL | [Homepage](https://ifcopenshell.org/) · [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) |
| **IFC++** | C++ class model for reading/writing IFC STEP files. Qt/OpenSceneGraph viewer. | C++ | MIT | [Homepage](https://ifcquery.com/) · [GitHub](https://github.com/ifcquery/ifcplusplus) |
| **That Open Engine Components** | High-level BIM component toolkit. Viewer, property inspector, spatial trees, measurements, BCF. | TS | — | [GitHub](https://github.com/ThatOpen/engine_components) |
| **Speckle** | AEC data interoperability platform. Versioned object graph. Connectors for Revit, Rhino, AutoCAD, Civil 3D, QGIS, Blender. | C#, TS | Apache-2.0 | [Homepage](https://speckle.systems/) · [GitHub](https://github.com/specklesystems) |

---

## 6. BIM Viewers (Web)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **xeokit-sdk** | High-performance WebGL BIM viewer. Double-precision coordinates. IFC, glTF, LAZ, CityJSON. | JS | AGPL-3.0 | [Homepage](https://xeokit.github.io/xeokit-sdk/) · [GitHub](https://github.com/xeokit/xeokit-sdk) |
| **xeokit-bim-viewer** | Standalone BIM viewer package built on xeokit SDK. IFC2x3 and IFC4. | JS | AGPL-3.0 | [GitHub](https://github.com/xeokit/xeokit-bim-viewer) |
| **BIMsurfer** | WebGL IFC model viewer for BIMServer. v3 with WebGL2 high performance. | JS | MIT | [GitHub](https://github.com/opensourceBIM/BIMsurfer) |
| **BIMROCKET** | Web-based BIM platform. Viewing, editing, BCF/IFC management. OrientDB/MongoDB backend. | Java, JS | — | [GitHub](https://github.com/bimrocket/bimrocket) |
| **Open IFC Viewer** | Simple browser-based IFC viewer. | JS | — | [GitHub](https://github.com/nicholasgasior/Open-IFC-Viewer) |
| **bimvie.ws** | JavaScript client for BIM using IFC, BCF, and BIMSie standards. | JS | — | [GitHub](https://github.com/opensourceBIM/bimvie.ws) |

---

## 7. BIM Authoring & Platforms

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Bonsai (BlenderBIM)** | Full BIM authoring addon for Blender. Creates/edits/exports native IFC. | Python | LGPL | [Homepage](https://bonsaibim.org/) · [GitHub](https://github.com/IfcOpenShell/IfcOpenShell) |
| **BIMserver** | Server-side BIM collaboration, versioning, merge, BimQL queries. | Java | AGPL-3.0 | [GitHub](https://github.com/opensourceBIM/BIMserver) |
| **OpenProject BIM** | Project management with integrated xeokit IFC viewer. | Ruby | GPL-3.0 | [Homepage](https://www.openproject.org/bim-project-management/) |

---

## 8. Construction Management

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **OpenConstructionERP** | Open-source construction cost estimation. BOQ, 4D/5D, AI, CAD/BIM takeoff. Gantt chart with CPM. EVM tracking. 21 languages, 55K+ cost items. | Python | — | [GitHub](https://github.com/datadrivenconstruction/OpenConstructionERP) |
| **OpenConstructionEstimate** | Open multilingual construction cost database for AI Agents. 55K+ work items, 27K+ resources. Qdrant vector DB. | Python | — | [GitHub](https://github.com/datadrivenconstruction/OpenConstructionEstimate-DDC-CWICR) |
| **4D Schedule Viewer** | BIM demo binding construction schedule to BIM model. 4D visualization. | JS | — | [GitHub](https://github.com/ZeaInc/4d-schedule-viewer) |

---

## 9. GIS — 3D Globe & Terrain

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **CesiumJS** | 3D globe, terrain streaming, 3D Tiles, satellite imagery. WebGPU branch. | JS | Apache-2.0 | [Homepage](https://cesium.com/platform/cesiumjs/) · [GitHub](https://github.com/CesiumGS/cesium) |
| **TerriaJS** | Full web geospatial data explorer. Built on CesiumJS. Powers national-scale digital twins. | TS | Apache-2.0 | [Homepage](https://terria.io/) · [GitHub](https://github.com/TerriaJS/terriajs) |
| **Maptalks** | 2D/3D map library. Three.js plugin for 3D visualization. Open-source Cesium alternative. | JS | BSD-3 | [Homepage](https://maptalks.org/) · [GitHub](https://github.com/maptalks/maptalks.js) |
| **Cesium Terrain Builder** | C++ library to convert GDAL raster DTMs to Cesium terrain tiles. | C++ | MIT | [GitHub](https://github.com/geo-data/cesium-terrain-builder) |
| **TIN Terrain** | Generates TIN meshes from raster terrain for CesiumJS. | C++ | — | [GitHub](https://github.com/nicholasgasior/tin-terrain) |
| **TouchTerrain** | Python app to create 3D printable terrain models from elevation data. Web app at touchterrain.org. | Python | GPL | [GitHub](https://github.com/nicholasgasior/TouchTerrain_for_CAGEO) |

---

## 10. GIS — 2D / Vector Mapping

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **MapLibre GL JS** | Open-source fork of Mapbox GL JS. Vector tiles, 2D/2.5D maps. | JS | BSD-3 | [Homepage](https://maplibre.org/) · [GitHub](https://github.com/maplibre/maplibre-gl-js) |
| **OpenLayers** | Foundational web mapping library. All OGC standards, vector tiles, WebGL rendering. | JS | BSD-2 | [Homepage](https://openlayers.org/) · [GitHub](https://github.com/openlayers/openlayers) |
| **Leaflet** | Lightweight mobile-friendly interactive maps. Massive plugin ecosystem. | JS | BSD-2 | [Homepage](https://leafletjs.com/) · [GitHub](https://github.com/Leaflet/Leaflet) |
| **Deck.gl** | WebGL/WebGPU data visualization. Large-scale point clouds, geospatial layers. | JS | MIT | [Homepage](https://deck.gl/) · [GitHub](https://github.com/visgl/deck.gl) |

---

## 11. GIS — Vector Tiles & Cloud-Native Formats

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **PMTiles (Protomaps)** | Single-file tile archive. Serverless byte-range reads. No tile server needed. | JS, Go | BSD-3 | [Homepage](https://protomaps.com/) · [GitHub](https://github.com/protomaps/PMTiles) |
| **Martin** | Open-source vector tile server. MVT from PostGIS, PMTiles, MBTiles. | Rust | Apache-2.0/MIT | [GitHub](https://github.com/maplibre/martin) |
| **Tippecanoe** | Best-in-class tool for creating vector tiles from GeoJSON/FlatGeobuf/GeoParquet. Smart overviews. | C++ | BSD-2 | [GitHub](https://github.com/felt/tippecanoe) |
| **FlatGeobuf** | Performant binary geospatial format. Streaming HTTP range reads. | Multi | BSD-2 | [Homepage](https://flatgeobuf.org/) · [GitHub](https://github.com/flatgeobuf/flatgeobuf) |
| **GeoParquet** | Apache Parquet with geospatial metadata. Cloud-native analytical queries. | Spec | Apache-2.0 | [Homepage](https://geoparquet.org/) · [GitHub](https://github.com/opengeospatial/geoparquet) |
| **OpenMapTiles** | Self-hosted world maps from OpenStreetMap vector tiles. | Multi | BSD-3 | [Homepage](https://openmaptiles.org/) · [GitHub](https://github.com/openmaptiles/openmaptiles) |

---

## 12. GIS — Spatial Analysis & Indexing

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Turf.js** | Advanced geospatial analysis in JS. Spatial joins, buffers, measurements. | JS | MIT | [Homepage](https://turfjs.org/) · [GitHub](https://github.com/Turfjs/turf) |
| **H3-js** | Uber's hexagonal hierarchical spatial index. | JS | Apache-2.0 | [GitHub](https://github.com/uber/h3-js) |
| **Flatbush** | Ultra-fast static R-tree for 2D points/rectangles. | JS | ISC | [GitHub](https://github.com/mourner/flatbush) |
| **RBush** | High-performance 2D spatial index (R-tree). | JS | MIT | [GitHub](https://github.com/mourner/rbush) |
| **geokdbush** | Geographic extension for kdbush. Nearest-neighbor queries on lat/lon. | JS | ISC | [GitHub](https://github.com/mourner/geokdbush) |

---

## 13. Coordinate Systems & Projections

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **PROJ** | Cartographic projections and coordinate transformations. 6000+ CRS. | C | MIT | [Homepage](https://proj.org/) · [GitHub](https://github.com/OSGeo/PROJ) |
| **proj4js** | JavaScript port of PROJ. Lightweight CRS transforms in browser. | JS | MIT | [GitHub](https://github.com/proj4js/proj4js) |
| **GDAL** | Universal geospatial translator library. Raster + vector. | C/C++ | MIT | [Homepage](https://gdal.org/) · [GitHub](https://github.com/OSGeo/gdal) |
| **GDAL3.js** | GDAL + PROJ + GEOS + SpatiaLite compiled to WASM. Full geospatial conversion in browser. | C → WASM | — | [GitHub](https://github.com/nicholasgasior/gdal3.js) |
| **Loam** | JavaScript wrapper for GDAL in the browser. Reprojection, format conversion. | JS | MIT | [GitHub](https://github.com/azavea/loam) |

---

## 14. Remote Sensing & Satellite Imagery

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **STAC Spec** | SpatioTemporal Asset Catalogs. The standard for organizing satellite/aerial imagery. | Spec | Apache-2.0 | [Homepage](https://stacspec.org/) · [GitHub](https://github.com/radiantearth/stac-spec) |
| **STAC Browser** | SPA for browsing static STAC catalogs. | JS | Apache-2.0 | [Homepage](https://radiantearth.github.io/stac-browser/) · [GitHub](https://github.com/radiantearth/stac-browser) |
| **geotiff.js** | Parse GeoTIFF/COG files in browser. Pure JavaScript. | JS | MIT | [GitHub](https://github.com/geotiffjs/geotiff.js) |
| **COG (Cloud Optimized GeoTIFF)** | Spec for efficient HTTP range-based raster access. | Spec | — | [Homepage](https://cogeo.org/) |
| **Titiler** | Modern cloud-optimized GeoTIFF tile server. FastAPI. | Python | MIT | [GitHub](https://github.com/developmentseed/titiler) |
| **Raster Foundry** | Web app for GIS analysis on Landsat, Sentinel, MODIS. COG support. | Scala, JS | Apache-2.0 | [GitHub](https://github.com/raster-foundry/raster-foundry) |
| **OL STAC** | OpenLayers plugin for STAC resources. Auto-display GeoTIFF, WMS, etc. | JS | Apache-2.0 | [GitHub](https://github.com/m-mohr/ol-stac) |
| **Copernicus Data Space** | Europe's satellite imagery platform. Free Sentinel data. API access. | — | — | [Homepage](https://dataspace.copernicus.eu/) |

---

## 15. Point Cloud

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Potree** | WebGL point cloud viewer. Renders billions of points via octree LOD. | JS | BSD-2 | [Homepage](https://potree.github.io/) · [GitHub](https://github.com/potree/potree) |
| **Potree-Next** | WebGPU rewrite of Potree. Compute shaders for GPU-based decode. Research stage. | JS | — | [GitHub](https://github.com/nicholasgasior/potree) |
| **COPC.js** | JavaScript reader for Cloud-Optimized Point Clouds. Stream LAZ from cloud storage. | JS | MIT | [GitHub](https://github.com/connormanning/copc.js) |
| **laz-perf** | LAZ decompression in JavaScript/WASM. Fast point cloud decode. | C++ → WASM | — | [GitHub](https://github.com/verma/laz-perf) |
| **LiDAR Viewer** | Web-based LiDAR viewer. Loads COPC LAZ by URL. Dynamic streaming, multiple color schemes. | JS | — | [GitHub](https://github.com/opengeos/lidar-viewer) |
| **maplibre-gl-lidar** | MapLibre plugin for LAS/LAZ/COPC point cloud visualization. Dynamic COPC streaming. | JS | — | [GitHub](https://github.com/opengeos/maplibre-gl-lidar) |
| **PotreeConverter** | Convert LAS/LAZ to Potree format for streaming. | C++ | BSD-2 | [GitHub](https://github.com/potree/PotreeConverter) |
| **plas.io** | Drag-and-drop in-browser LAS/LAZ viewer. | JS | — | [Homepage](https://plas.io/) |
| **LASViewer** | Web app to view LiDAR LAS files. Up to 250M points. | JS | — | [GitHub](https://github.com/nicholasgasior/LASViewer) |
| **xeokit-convert** | CLI to batch-convert IFC, CityJSON, LAZ, glTF to xeokit's XKT format. | JS | AGPL-3.0 | [GitHub](https://github.com/xeokit/xeokit-convert) |
| **COPC Spec** | Cloud-Optimized Point Cloud specification. LAZ 1.4 with VLR index. | Spec | — | [Homepage](https://copc.io/) |

---

## 16. Photogrammetry & Drone Mapping

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **OpenDroneMap (ODM)** | CLI toolkit for drone imagery → maps, point clouds, 3D models, DEMs. | C++, Python | AGPL-3.0 | [Homepage](https://opendronemap.org/) · [GitHub](https://github.com/OpenDroneMap/ODM) |
| **WebODM** | Web UI for OpenDroneMap. User-friendly drone processing. | Python, JS | AGPL-3.0 | [Homepage](https://opendronemap.org/webodm/) · [GitHub](https://github.com/OpenDroneMap/WebODM) |
| **Meshroom (AliceVision)** | Node-based photogrammetry pipeline. Dense point clouds and textured meshes. | C++ | MPL-2.0 | [Homepage](https://alicevision.org/) · [GitHub](https://github.com/alicevision/Meshroom) |
| **COLMAP** | Research-grade SfM and MVS pipeline. Pinhole + fisheye. | C++ | BSD | [GitHub](https://github.com/colmap/colmap) |
| **OpenSplat** | Free C++ Gaussian splatting from camera poses. Portable, lean, fast. | C++ | MIT | [GitHub](https://github.com/pierotofy/OpenSplat) |

---

## 17. 3D City Models (CityGML / CityJSON)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **3DCityDB** | Database + tools for CityGML/CityJSON. Import/export. CesiumJS-based web viewer. | Java, SQL | Apache-2.0 | [Homepage](https://www.3dcitydb.org/) · [GitHub](https://github.com/3dcitydb/3dcitydb) |
| **3DCityDB-Web-Map** | Cesium-based viewer for 3DCityDB. Large-scale semantic 3D city visualization. | JS | Apache-2.0 | [GitHub](https://github.com/3dcitydb/3dcitydb-web-map) |
| **CityJSON** | JSON-based encoding of CityGML. Easy-to-use, compact. Web viewer included. | Spec | CC-BY-4.0 | [Homepage](https://www.cityjson.org/) · [GitHub](https://github.com/cityjson) |
| **citygml4j** | Open Source Java API for CityGML. Reads/writes CityGML and CityJSON. | Java | Apache-2.0 | [GitHub](https://github.com/citygml4j/citygml4j) |
| **azul** | 3D city model viewer for Mac. CityGML 1.0/2.0, CityJSON 1.0/1.1/2.0, IndoorGML, OBJ. | Swift | — | [GitHub](https://github.com/tudelft3d/azul) |
| **awesome-citygml** | Curated list of open CityGML datasets from 21+ countries. | — | — | [GitHub](https://github.com/OloOcki/awesome-citygml) |

---

## 18. Digital Twin & IoT

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **iTwin.js** (Bentley) | Digital twin visualization. BIM + GIS + reality data. | TS | MIT | [Homepage](https://www.itwinjs.org/) · [GitHub](https://github.com/iTwin/iTwinjs-core) |
| **Eclipse Ditto** | IoT digital twin framework. REST/WS APIs. "Things" state management. Python/Java/JS/Go SDKs. | Java | EPL-2.0 | [Homepage](https://eclipse.dev/ditto/) · [GitHub](https://github.com/eclipse-ditto/ditto) |
| **Eclipse BaSyx** | Asset Administration Shell (AAS) for industrial digital twins. MQTT, OPC-UA. | Java | EPL-2.0 | [GitHub](https://github.com/eclipse-basyx) |
| **DTCC Platform** | City planning digital twins. Python. Digital Twin Cities Centre (Sweden). | Python | MIT | [GitHub](https://github.com/dtcc-platform) |
| **OpenTwins** | Open-source compositional digital twin platform. | Multi | — | [GitHub](https://github.com/ertis-research/opentwins) |
| **Garnet Framework** | Living digital twins via dynamic knowledge graphs. | — | — | [GitHub](https://github.com/Open-Source-Digital-Twin) |
| **ODTP** | Open Digital Twin Platform. Automates generation and sharing of digital twins. | Python | — | [GitHub](https://github.com/odtp-org) |

---

## 19. File Format Parsers & Writers

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **dxf-parser** | JavaScript DXF file parser. Reads into structured JS objects. | JS | MIT | [GitHub](https://github.com/gdsestimating/dxf-parser) |
| **dxf-viewer** | DXF 2D viewer in JavaScript for browser. | JS | — | [GitHub](https://github.com/vagran/dxf-viewer) |
| **libredwg-web** | DWG/DXF parser using libredwg compiled to WASM. Browser & Node.js native. | C → WASM | — | [GitHub](https://github.com/mlightcad/libredwg-web) · [npm](https://www.npmjs.com/package/@mlightcad/libredwg-web) |
| **libdxfrw** | C++ library to read/write DXF/DWG. Reads DWG R14–2020. | C++ | — | [GitHub](https://github.com/codelibs/libdxfrw) |
| **rust_dxf** | Rust library for reading/writing DXF files. | Rust | — | [crates.io](https://crates.io/crates/dxf) |
| **shpjs** | Shapefile parser for JavaScript. | JS | — | [GitHub](https://github.com/calvinmetcalf/shapefile-js) |
| **geotiff.js** | Parse GeoTIFF/COG files in browser. Pure JavaScript. | JS | MIT | [GitHub](https://github.com/geotiffjs/geotiff.js) |
| **loaders.gl** | Framework for loading 3D Tiles, point clouds, geospatial formats. vis.gl ecosystem. | JS | MIT | [GitHub](https://github.com/visgl/loaders.gl) |

---

## 20. 3D Rendering (WebGL / WebGPU)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Three.js** | Standard JavaScript 3D library. WebGL + WebGPU (production-ready since r171). 100k+ stars. | JS | MIT | [Homepage](https://threejs.org/) · [GitHub](https://github.com/mrdoob/three.js) |
| **Babylon.js** | Full 3D engine. WebGL + WebGPU. | TS | Apache-2.0 | [Homepage](https://www.babylonjs.com/) · [GitHub](https://github.com/BabylonJS/Babylon.js) |
| **PlayCanvas** | WebGL/WebGPU game engine. Open source runtime. | JS | MIT | [Homepage](https://playcanvas.com/) · [GitHub](https://github.com/playcanvas/engine) |
| **wgpu** | Cross-platform, safe, pure-Rust WebGPU implementation. | Rust | MIT/Apache-2.0 | [Homepage](https://wgpu.rs/) · [GitHub](https://github.com/gfx-rs/wgpu) |
| **Dawn** | Google's open-source WebGPU implementation in C++. | C++ | BSD-3 | [GitHub](https://dawn.googlesource.com/dawn) |
| **Zephyr3D** | TypeScript WebGL + WebGPU rendering engine. Lightweight, modular. | TS | — | [GitHub](https://github.com/nicholasgasior/zephyr3d) |

---

## 21. Svelte Ecosystem & UI

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Svelte 5** | Compiler-based UI framework. Runes for fine-grained reactivity. No virtual DOM. | JS/TS | MIT | [Homepage](https://svelte.dev/) · [GitHub](https://github.com/sveltejs/svelte) |
| **SvelteKit** | Full-stack framework for Svelte. Routing, SSR, adapters. | JS/TS | MIT | [GitHub](https://github.com/sveltejs/kit) |
| **Threlte** | Declarative Three.js for Svelte. Scene graph via Svelte components. WebGPU support. | TS | MIT | [Homepage](https://threlte.xyz/) · [GitHub](https://github.com/threlte/threlte) |
| **shadcn-svelte** | Beautiful, customizable components for Svelte. | TS | MIT | [Homepage](https://shadcn-svelte.com/) · [GitHub](https://github.com/huntabyte/shadcn-svelte) |
| **Flowbite Svelte** | Tailwind CSS component library for Svelte. | TS | MIT | [GitHub](https://github.com/themesberg/flowbite-svelte) |

---

## 22. Gaussian Splatting & NeRF (Web)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **3D Gaussian Splatting** | Original reference implementation. CUDA-based. | Python, CUDA | — | [GitHub](https://github.com/graphdeco-inria/gaussian-splatting) |
| **GaussianSplats3D** | Three.js-based 3DGS renderer for web. .ply, .splat, .ksplat formats. | JS | MIT | [GitHub](https://github.com/mkkellogg/GaussianSplats3D) |
| **splat (antimatter15)** | WebGL real-time 3DGS renderer. Lightweight. | JS | MIT | [GitHub](https://github.com/antimatter15/splat) |
| **gaussian-splatting-web** | WebGPU-based Gaussian splatting viewer. EPFL/CVLAB. | JS | — | [GitHub](https://github.com/cvlab-epfl/gaussian-splatting-web) |
| **gsplat** | CUDA accelerated rasterization. Python bindings. Nerfstudio project. | Python, CUDA | Apache-2.0 | [GitHub](https://github.com/nerfstudio-project/gsplat) |
| **OpenSplat** | Production-grade 3DGS. CPU/GPU, Windows/Mac/Linux. | C++ | MIT | [GitHub](https://github.com/pierotofy/OpenSplat) |
| **awesome-3D-gaussian-splatting** | Curated list of 3DGS papers and resources. | — | — | [GitHub](https://github.com/MrNeRF/awesome-3D-gaussian-splatting) |

---

## 23. Rust Spatial / Physics / Math

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Rapier** | 2D/3D physics engine in Rust. Official WASM bindings. | Rust | Apache-2.0 | [Homepage](https://rapier.rs/) · [GitHub](https://github.com/dimforge/rapier) |
| **Parry** | 2D/3D collision detection library (from Rapier). Now uses glam by default. | Rust | Apache-2.0 | [Homepage](https://parry.rs/) · [GitHub](https://github.com/dimforge/parry) |
| **Barry** | Fork of Parry using Glam types. Tailored for Bevy ecosystem. | Rust | Apache-2.0 | [GitHub](https://github.com/Jondolf/barry) |
| **nalgebra** | Linear algebra library for Rust. Matrices, vectors, transformations. | Rust | Apache-2.0 | [Homepage](https://nalgebra.org/) · [GitHub](https://github.com/dimforge/nalgebra) |
| **glam** | Fast, simple math library for games/graphics. f32 and f64. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/bitshifter/glam-rs) |
| **geo** | Geospatial primitives and algorithms for Rust. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/georust/geo) |
| **nphysics** | 2D/3D rigid body physics engine for Rust (predecessor to Rapier). | Rust | Apache-2.0 | [GitHub](https://github.com/dimforge/nphysics) |

---

## 24. ECS Libraries & Patterns

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Bevy** | Data-driven game engine in Rust. ECS at core. WASM-ready. WebGPU rendering. 18k+ stars. | Rust | MIT/Apache-2.0 | [Homepage](https://bevy.org/) · [GitHub](https://github.com/bevyengine/bevy) |
| **Bevy ECS (standalone)** | Bevy's ECS can be used as a library independent of the engine. | Rust | MIT/Apache-2.0 | [Crate](https://crates.io/crates/bevy_ecs) |
| **Flecs** | Blazing-fast C ECS library. WASM support. Relationship system, multi-language queries. | C | MIT | [Homepage](https://www.flecs.dev/) · [GitHub](https://github.com/SanderMertens/flecs) |
| **bitECS** | Tiny, fast ECS for JavaScript. Pure JS, no WASM dependency. | JS | MPL-2.0 | [GitHub](https://github.com/NateTheGreatt/bitECS) |
| **Godot Engine** | Full-featured game engine. MIT. WASM exports with SIMD. | C++ | MIT | [Homepage](https://godotengine.org/) · [GitHub](https://github.com/godotengine/godot) |

---

## 25. Event Sourcing & CQRS

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **cqrs-es** | Lightweight CQRS and event sourcing framework for Rust. | Rust | Apache-2.0 | [Docs](https://doc.rust-cqrs.org/) · [GitHub](https://github.com/serverlesstechnology/cqrs) |
| **event_sourcing.rs** | Opinionated event sourcing library for Rust. | Rust | — | [GitHub](https://github.com/primait/event_sourcing.rs) |
| **eventmill** | Event sourcing and CQRS for Rust applications. | Rust | — | [GitHub](https://github.com/innoave/eventmill) |
| **chronicle** | Event sourced CQRS framework for Rust. | Rust | — | [GitHub](https://github.com/brendanzab/chronicle) |
| **Thalo** | Event sourcing runtime with WebAssembly support. | Rust | MIT | [GitHub](https://github.com/nicholasgasior/thalo) |
| **eventually-rs** | Event Sourcing library for Rust. Immutable event series, aggregate pattern. | Rust | MIT | [GitHub](https://github.com/nicholasgasior/eventually-rs) |

---

## 26. Real-Time Collaboration (CRDT)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Yjs** | CRDT for real-time collaboration. P2P via WebRTC. 900k+ weekly npm downloads. Shared types, offline editing, version snapshots. | JS | MIT | [Homepage](https://yjs.dev/) · [GitHub](https://github.com/yjs/yjs) |
| **Automerge** | JSON CRDT built in Rust with JS bindings via WASM. Full document history. | Rust, JS | MIT | [Homepage](https://automerge.org/) · [GitHub](https://github.com/automerge/automerge) |
| **Loro** | CRDTs based on Replayable Event Graph. Rich text, list, map, movable tree. Rust + JS (WASM) + Swift. | Rust | MIT | [Homepage](https://loro.dev/) · [GitHub](https://github.com/loro-dev/loro) |

---

## 27. In-Browser Databases

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **DuckDB-WASM** | Analytical SQL database in browser. Parquet, CSV, JSON, Arrow, spatial extension. Fastest in-browser engine. | C++ → WASM | MIT | [Homepage](https://duckdb.org/) · [GitHub](https://github.com/duckdb/duckdb-wasm) |
| **SQLite WASM** | Official SQLite compiled to WASM. Public domain. OPFS backend for persistent storage. | C → WASM | Public Domain | [Homepage](https://sqlite.org/wasm/) |
| **sql.js** | SQLite compiled to JS via Emscripten. Runs in browser. | C → WASM | MIT | [GitHub](https://github.com/sql-js/sql.js) |
| **PGlite** | Lightweight PostgreSQL in WASM. Runs in browser & Node.js. OPFS filesystem support. | C → WASM | Apache-2.0 | [Homepage](https://pglite.dev/) · [GitHub](https://github.com/electric-sql/pglite) |
| **RxDB** | Reactive, real-time database for JavaScript. Offline-first. OPFS + CRDT support. | TS | Apache-2.0 | [Homepage](https://rxdb.info/) · [GitHub](https://github.com/pubkey/rxdb) |

---

## 28. Browser Storage (OPFS)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **OPFS (Origin Private File System)** | Browser-native sandboxed file system. 3-4x faster than IndexedDB. Powers Photoshop on the Web. | Web API | — | [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) · [web.dev](https://web.dev/articles/origin-private-file-system) |
| **OPFS Explorer** | Chrome DevTools extension to explore OPFS contents. | JS | — | [Chrome Web Store](https://chromewebstore.google.com/detail/opfs-explorer/acndjpgkpaclldomagafnognkcgjignd) |

---

## 29. AI / LLM / Agent Orchestration

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **LangGraph.js** | Agent orchestration as stateful directed cyclic graphs. Multi-agent coordination. | TS | MIT | [Homepage](https://www.langchain.com/langgraph) · [GitHub](https://github.com/langchain-ai/langgraphjs) |
| **LangChain.js** | LLM application framework for JavaScript. 90k+ stars. | TS | MIT | [GitHub](https://github.com/langchain-ai/langchainjs) |
| **Open Agent Platform** | No-code web UI for creating and managing LangGraph agents. | TS | — | [GitHub](https://github.com/langchain-ai/open-agent-platform) |
| **CrewAI** | Role-based multi-agent framework. Python. | Python | MIT | [Homepage](https://crewai.com/) · [GitHub](https://github.com/crewAIInc/crewAI) |
| **AutoGen** | Multi-agent conversation framework by Microsoft. | Python | MIT | [GitHub](https://github.com/microsoft/autogen) |
| **MetaGPT** | Multi-agent framework that mimics a software company. | Python | MIT | [GitHub](https://github.com/geekan/MetaGPT) |
| **Vectra** | In-memory vector database for JavaScript. Local vector search. | TS | MIT | [GitHub](https://github.com/Stevenic/vectra) |

---

## 30. MCP Servers (AI ↔ CAD/BIM/GIS)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **MCP Protocol Spec** | Model Context Protocol standard. Adopted by Anthropic, OpenAI, Microsoft, Google. | Spec | MIT | [Homepage](https://modelcontextprotocol.io/) · [GitHub](https://github.com/modelcontextprotocol/modelcontextprotocol) |
| **MCP Servers (Official)** | Reference server implementations maintained by the MCP org. | Multi | MIT | [GitHub](https://github.com/modelcontextprotocol/servers) |
| **GIS MCP Server** | MCP server for GIS operations — coordinate transforms, spatial analysis, geometry ops. | Python | — | [GitHub](https://github.com/mahdin75/gis-mcp) |
| **CAD-MCP** | MCP server for CAD operations. Draw lines, circles, text, annotations. | Python | — | [GitHub](https://github.com/daobataotie/CAD-MCP) |
| **openBIM-MCP** | MCP server for BIM. Convert IFC to fragments, load fragments, query BIM data by category. | TS | — | [GitHub](https://github.com/helenkwok/openbim-mcp) |
| **ifcMCP** | MCP server for LLM agents to work with IFC files. Uses IfcOpenShell. | Python | — | [GitHub](https://github.com/nicholasgasior/ifcMCP) |
| **FreeCAD MCP** | AI-driven CAD modeling via RPC server controlling FreeCAD. | Python | — | [GitHub](https://github.com/nicholasgasior/freecad-mcp) |
| **Revit MCP** | AI assistant connection to Autodesk Revit via MCP + WebSocket. | C# | — | [Homepage](https://archilabs.ai/posts/revit-model-context-protocol) |
| **AutoCAD LT MCP** | Translates natural language into AutoLISP instructions for AutoCAD. | Python | — | [GitHub](https://github.com/nicholasgasior/autocad-lt-mcp) |
| **Microsoft MCP Catalog** | Official Microsoft MCP server implementations. | Multi | MIT | [GitHub](https://github.com/microsoft/mcp) |

---

## 31. In-Browser AI Inference

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Transformers.js** | Run HuggingFace models in browser. Embeddings, NLP, vision. ONNX Runtime + WebGPU. | JS | Apache-2.0 | [Homepage](https://huggingface.co/docs/transformers.js) · [GitHub](https://github.com/xenova/transformers.js) |
| **WebLLM** | High-performance in-browser LLM inference via WebGPU. Llama, Phi, Gemma, Mistral. | TS | Apache-2.0 | [Homepage](https://webllm.mlc.ai/) · [GitHub](https://github.com/nicholasgasior/web-llm) |
| **ONNX Runtime Web** | Run ONNX models in browser with WebGPU acceleration. | TS | MIT | [Homepage](https://onnxruntime.ai/) · [GitHub](https://github.com/microsoft/onnxruntime) |

---

## 32. Robotics / ROS 2 / Telemetry

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Robot Web Tools** | Suite of libraries for web-based robot apps with ROS. | JS | BSD | [Homepage](https://robotwebtools.github.io/) · [GitHub](https://github.com/RobotWebTools) |
| **roslibjs** | JavaScript library for interacting with ROS from the browser. | JS | BSD | [GitHub](https://github.com/RobotWebTools/roslibjs) |
| **ros2-web-bridge** | JSON interface to ROS 2 via rosbridge v2 protocol over WebSockets. | JS | Apache-2.0 | [GitHub](https://github.com/nicholasgasior/ros2-web-bridge) |
| **opentera-webrtc-ros** | WebRTC teleoperation for ROS 2. Video + data channel. | C++, Python | Apache-2.0 | [GitHub](https://github.com/nicholasgasior/opentera-webrtc-ros) |
| **Foxglove** | Open-source robotics observability platform. Web + desktop. ROS, MCAP, Protobuf. | TS | MPL-2.0 | [Homepage](https://foxglove.dev/) · [GitHub](https://github.com/foxglove/studio) |

---

## 33. Build Tools & Monorepo

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **Turborepo** | High-performance monorepo build system. Smart caching. Composable config (v2.7+). | Go | MIT | [Homepage](https://turborepo.dev/) · [GitHub](https://github.com/vercel/turborepo) |
| **pnpm** | Fast, disk-efficient package manager. Workspace support for monorepos. | JS | MIT | [Homepage](https://pnpm.io/) · [GitHub](https://github.com/pnpm/pnpm) |
| **wasm-pack** | Build Rust → WASM packages for npm. | Rust | MIT/Apache-2.0 | [Homepage](https://rustwasm.github.io/wasm-pack/) · [GitHub](https://github.com/nicholasgasior/wasm-pack) |
| **wasm-bindgen** | Facilitating high-level interactions between Rust/WASM and JavaScript. | Rust | MIT/Apache-2.0 | [GitHub](https://github.com/nicholasgasior/wasm-bindgen) |
| **Vitest** | Vite-native test framework. Fast, TypeScript-first. | TS | MIT | [Homepage](https://vitest.dev/) · [GitHub](https://github.com/vitest-dev/vitest) |
| **Playwright** | Cross-browser E2E testing. By Microsoft. | TS | Apache-2.0 | [Homepage](https://playwright.dev/) · [GitHub](https://github.com/microsoft/playwright) |
| **esbuild** | Extremely fast JavaScript/TypeScript bundler. Go-based. | Go | MIT | [Homepage](https://esbuild.github.io/) · [GitHub](https://github.com/evanw/esbuild) |
| **monorepo-typescript-rust** | Template: pnpm workspaces + Next + Vite + Rust + Turborepo. | Rust, TS | — | [GitHub](https://github.com/spa5k/monorepo-typescript-rust) |

---

## 34. OGC Standards & Web Services

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **OGC API Spec** | Modern REST-based geospatial API standards (Features, Tiles, Maps, Processes). | Spec | — | [Homepage](https://ogcapi.ogc.org/) · [GitHub](https://github.com/opengeospatial/ogcapi-features) |
| **GeoServer** | Open-source server for sharing geospatial data. WMS, WFS, WCS, OGC API. | Java | GPL-2.0 | [Homepage](https://geoserver.org/) · [GitHub](https://github.com/geoserver/geoserver) |
| **MapServer** | CGI-based geospatial web server. WMS, WFS, OGC API Features. | C | MIT | [Homepage](https://mapserver.org/) · [GitHub](https://github.com/MapServer/MapServer) |
| **GeoNode** | Web geospatial CMS. Upload, share, manage spatial data. Built on GeoServer + Django. | Python | GPL-3.0 | [Homepage](https://geonode.org/) · [GitHub](https://github.com/GeoNode/geonode) |
| **MapStore** | Modern web mapping framework. 2D/3D viewer, dashboards. React + OpenLayers + CesiumJS. | JS | BSD-2 | [Homepage](https://mapstore.geosolutionsgroup.com/) · [GitHub](https://github.com/geosolutions-it/MapStore2) |
| **pygeoapi** | Python server implementing OGC API standards. Lightweight, easy to deploy. | Python | MIT | [Homepage](https://pygeoapi.io/) · [GitHub](https://github.com/geopython/pygeoapi) |

---

## 35. Curated Lists & Meta-Resources

| Project | Description | Links |
|---------|-------------|-------|
| **awesome-civil-engineering** | Curated list of civil engineering software and resources. | [GitHub](https://github.com/QuantumNovice/awesome-civil-engineering) |
| **awesome-frontend-gis** | Curated geospatial resources for web development. | [GitHub](https://github.com/nicholasgasior/awesome-frontend-gis) |
| **awesome-geospatial** | Comprehensive list of geospatial tools and resources. | [GitHub](https://github.com/sacridini/Awesome-Geospatial) |
| **awesome-3D-gaussian-splatting** | Curated list of 3DGS papers and resources. | [GitHub](https://github.com/MrNeRF/awesome-3D-gaussian-splatting) |
| **awesome-citygml** | Open CityGML datasets from 21+ countries. | [GitHub](https://github.com/OloOcki/awesome-citygml) |
| **awesome-duckdb** | Curated list of DuckDB resources. | [GitHub](https://github.com/davidgasquez/awesome-duckdb) |
| **Cloud-Native Geospatial Forum** | Community for COG, STAC, GeoParquet, COPC standards. | [Homepage](https://cloudnativegeo.org/) |
| **CRDT.tech** | Comprehensive list of CRDT implementations across languages. | [Homepage](https://crdt.tech/implementations) |
| **STAC Index** | Directory of STAC catalogs, APIs, and ecosystem tools. | [Homepage](https://stacindex.org/) |
| **WebGL/WebGPU Frameworks List** | Collection of WebGL and WebGPU frameworks and libraries. | [GitHub Gist](https://gist.github.com/dmnsgn/76878ba6903cf15789b712464875cfdc) |

---

## Civil Engineering & Surveying (Niche)

| Project | Description | Language | License | Links |
|---------|-------------|----------|---------|-------|
| **GeoEasy** | Land surveying calculation, network adjustment, DTMs, regression. | Tcl | GPL | [GitHub](https://github.com/zsiki/GeoEasy) |
| **Surveying Calculator** | Engineering app with surveying and GIS. Uses QGIS, GDAL, PROJ. | Python | — | [GitHub](https://github.com/edips/surveyingcalculator) |
| **Survey2GIS** | Convert field survey data (GPS/total station) to geometry (SHP, GeoJSON, KML). | C | GPL | [Homepage](https://www.nfdi4objects.net/en/portal/services/survey2gis/) |
| **CalcForge** | Open-source engineering calculators. Civil, mechanical, electrical. | Python | — | [Homepage](https://calcforge.com/) · [GitHub](https://github.com/calcforge) |
| **EngineeringPaper.xyz** | Free browser-based engineering calculation tool. | JS | MIT | [Homepage](https://engineeringpaper.xyz/) |
| **Open Civil 3D Data** | Open datasets for civil engineering workflows. | — | — | (various sources) |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Browser-Based CAD | 9 |
| Desktop CAD (Reference) | 3 |
| Geometry Kernels (WASM) | 8 |
| 2D Constraint Solvers | 2 |
| BIM / IFC Processing | 6 |
| BIM Viewers (Web) | 6 |
| BIM Authoring & Platforms | 3 |
| Construction Management | 3 |
| GIS — 3D Globe & Terrain | 6 |
| GIS — 2D / Vector Mapping | 4 |
| GIS — Vector Tiles & Cloud-Native | 6 |
| GIS — Spatial Analysis & Indexing | 5 |
| Coordinate Systems & Projections | 5 |
| Remote Sensing & Satellite Imagery | 8 |
| Point Cloud | 11 |
| Photogrammetry & Drone Mapping | 5 |
| 3D City Models | 6 |
| Digital Twin & IoT | 7 |
| File Format Parsers | 8 |
| 3D Rendering (WebGL/WebGPU) | 6 |
| Svelte Ecosystem & UI | 5 |
| Gaussian Splatting & NeRF | 7 |
| Rust Spatial / Physics / Math | 7 |
| ECS Libraries & Patterns | 5 |
| Event Sourcing & CQRS | 6 |
| Real-Time Collaboration (CRDT) | 3 |
| In-Browser Databases | 5 |
| Browser Storage (OPFS) | 2 |
| AI / LLM / Agent Orchestration | 7 |
| MCP Servers | 10 |
| In-Browser AI Inference | 3 |
| Robotics / ROS 2 / Telemetry | 5 |
| Build Tools & Monorepo | 8 |
| OGC Standards & Web Services | 6 |
| Curated Lists & Meta-Resources | 10 |
| Civil Engineering & Surveying | 6 |
| **Total** | **~210+** |
