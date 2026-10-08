# Architecture Decision: ECS Component Design

> ## Status: PARKED under SD-05 (2026-04-29)
>
> Forward-looking BIM/GIS component layouts are paused until AutoCAD 2D parity ships. The 2D ECS layout (already implemented via hecs / NexusWorld) stays in force. Lifting SD-05 in `DECISIONS.md` reactivates new domain components.

> Priority: 3 of 10 — irreversible. Wrong layout breaks Rule 4 (additive expansion).
> Risk if wrong: adding BIM/GIS/Civil requires rewriting the kernel
> Audience: All agents and developers working on NEXUS

---

## The Problem

Rule 3 says: ECS data model, no class inheritance. Rule 4 says: additive expansion — new domains are new components, never rewrites.

These two rules intersect here. The component layout chosen now determines whether BIM, GIS, Civil, and Point Cloud can be added without restructuring the core. Getting it wrong means one of two outcomes:
1. The expansion path breaks — adding BIM requires restructuring the entity model → Rule 4 violated
2. Components are too generic — everything is `HashMap<String, Value>` → no type safety, no performance

This document defines the component layout from day one through v1.0.

---

## How the Reference Apps Got It Right (and Wrong)

### FreeCAD: Deep Inheritance → Topological Naming Problem

FreeCAD uses 8-level-deep class inheritance:
```
PropertyContainer → ExtensionContainer → TransactionalObject → DocumentObject 
  → GeoFeature → Part::Feature → PartDesign::Feature → PartDesign::Pad
```

**What went right:**
- Extensions system (closest thing to components — add capabilities without subclassing)
- Property system (typed, serializable, change-notifiable)
- Dependency graph from link properties (implicit but functional)

**What went wrong:**
- Diamond inheritance makes cross-domain queries impossible
- Topological Naming Problem (TNP): sub-element references (`Face3`, `Edge7`) break when upstream geometry changes because ordinal indices are assigned by kernel internal order
- Recompute cascade: one error breaks everything downstream
- Adding new object types requires understanding 8 levels of inheritance
- Monolithic `execute()` — no separation of concerns

**Lesson for NEXUS:** Never expose kernel-generated ordinal indices. Never use class inheritance for entity types.

### Blender: DNA Structs + Depsgraph Components

Blender uses monolithic C structs (DNA) but decomposes them into components inside the dependency graph:

```
Depsgraph Components: TRANSFORM, GEOMETRY, ANIMATION, PARAMETERS, 
SHADING, INSTANCING, PARTICLE_SYSTEM, ARMATURE, EVAL_POSE, ...
```

**What went right:**
- Copy-on-Write evaluation (original data never modified during eval)
- Fine-grained dirty tracking per component (TRANSFORM dirty doesn't trigger SHADING recompute)
- Modifier stack = ordered feature list on the Object (simple, correct)

**What went wrong:**
- `struct Object` has ~200 fields for every possible type (wasted memory)
- DNA structs are versioned with explicit padding — adding fields requires migration code
- No cross-type queries ("find all objects with both Mesh data and Particle system" requires type-checking every Object)

**Lesson for NEXUS:** Decompose entities into components for dirty tracking. Use ordered list (not DAG) for modifier/feature stack.

### BRL-CAD: vtable-as-Data + Flat Namespace

BRL-CAD uses `void*` type erasure with function pointer vtables (`rt_functab`):

```c
struct rt_db_internal {
    int idb_minor_type;                    // ID_TOR, ID_TGC, ID_ELL, etc.
    const struct rt_functab *idb_meth;     // vtable
    void *idb_ptr;                         // actual data (cast per type)
    struct bu_attribute_value_set idb_avs; // key-value metadata
};
```

**What went right:**
- Attribute-value sets (key-value strings) for extensible metadata — any object can have any attributes
- Function table pattern (each type brings its own operations) — clean dispatch
- Flat namespace (all objects in one directory) — simple queries

**What went wrong:**
- `void*` casting — zero type safety
- Name-based references (`tree_db_leaf.tl_name` is a string) — renaming breaks everything
- No dependency graph — changes are manual
- Untyped attributes — no schema enforcement

**Lesson for NEXUS:** Attribute bags are useful for user metadata. Entity IDs (not names) for structural references. Enum or trait dispatch (not void*) for type safety.

---

## The Component Layout

### Principles

1. **Shared components first, domain-specific components later.** An entity is a bag of components. The same entity can have `Geometry2d + IfcClass + GeoPosition` simultaneously.
2. **Typed components for performance-critical data.** `Transform`, `BoundingBox`, `MeshGeometry` are concrete types, not generic maps.
3. **Attribute bag for user-extensible metadata.** `Attributes(HashMap<String, Value>)` handles everything that doesn't need compile-time typing.
4. **Entity ID references, never string names.** Structural references use Entity handles. Display names are a separate `Name` component.
5. **Ordered list for feature tree, not ECS system ordering.** Store `FeatureHistory(Vec<FeatureRef>)` on the body entity. One system evaluates features in order. All other systems operate in parallel on results.

### Universal Components (Day One)

These exist from Sprint 1 and never change:

```rust
// Identity
EntityId(Uuid)              // Globally unique, stable across save/load
Name(String)                // Display name (NOT used for references)

// Hierarchy
Parent(Entity)              // Parent entity handle
Children(Vec<Entity>)       // Ordered children

// Spatial
Transform2d(Affine2d)       // 2D local-to-parent transform
Transform3d(Mat4)           // 3D local-to-parent (added v0.2)
WorldTransform(Mat4)        // Computed: local-to-world (cached, derived)
BoundingBox(Aabb)           // Axis-aligned bounding box (cached)

// Organization
Layer(LayerId)              // Layer assignment
Visibility(bool)            // Display toggle
Locked(bool)                // Prevent editing
SelectionState(enum)        // None, Selected, Hovered

// Style
Color(Option<Rgba>)         // Override color (None = inherit from layer)
Linetype(Option<String>)    // Override linetype
Lineweight(Option<f64>)     // Override lineweight

// Metadata
Attributes(HashMap<String, AttributeValue>) // User-extensible key-value
```

### 2D Geometry Components (v0.1 — already implemented as enum, refactor later)

Currently NEXUS stores geometry as `GeometryType` enum with 18 variants. This works for v0.1. When ECS migration happens (Phase 1), refactor to one component per geometry type:

```rust
// Option A: Keep the enum (simpler, fewer archetypes)
Geometry2d(GeometryType)    // The current enum — Line, Circle, Arc, etc.

// Option B: One component per type (more ECS-idiomatic, better queries)
Line2d { start: Point2d, end: Point2d }
Circle2d { center: Point2d, radius: f64 }
Arc2d { center: Point2d, radius: f64, start_angle: f64, end_angle: f64 }
// ... etc for all 18 types
```

**Decision: Option A for v0.1-v0.2. Option B if cross-type queries become a bottleneck.**

The enum is already working, serialization is clean, and 18 variants don't create query problems. Switching to per-type components is a refactor, not a rewrite, and can happen incrementally.

### Annotation Components (v0.1)

```rust
TextContent { content: String, height: f64, font: Option<String> }
DimensionRef { dim_type: DimType, reference_entities: Vec<Entity>, value: f64 }
LeaderLine { points: Vec<Point2d>, annotation: Entity }
HatchPattern { boundary: Entity, pattern: String, scale: f64, angle: f64 }
```

### Block/Instance Components (v0.1)

```rust
BlockDefinition { name: String, base_point: Point2d }
BlockInstance { definition: Entity, insertion: Point2d, scale: Vec2d, rotation: f64 }
```

### Constraint Components (v0.1)

```rust
ConstraintSet(Vec<Constraint>)  // On the sketch/body entity
// Each Constraint references target entities by Entity handle
Constraint {
    id: Uuid,
    constraint_type: ConstraintType,  // coincident, horizontal, distance, etc.
    targets: Vec<Entity>,
    parameters: Vec<f64>,             // distance value, angle, etc.
}
```

### 3D Geometry Components (v0.2)

```rust
// Multi-representation (an entity can have all three simultaneously)
BrepGeometry(BrepHandle)         // Exact B-Rep (from truck)
MeshGeometry(MeshHandle)         // Tessellated mesh (for display/export)
WireframeGeometry(Vec<Edge3d>)   // Edge display (computed from B-Rep)

// The boolean fallback marker (see architecture/21-boolean-operations.md)
BooleanFallback {
    reason: String,
    mesh_only: bool,
    original_operands: [Entity; 2],
}
```

### Feature Tree Components (v0.2)

```rust
// On a body entity
FeatureHistory(Vec<FeatureRef>)  // Ordered feature list
ActiveFeature(usize)            // "Tip" — features after this are suppressed

// Each feature is itself an entity with one of these:
ExtrudeFeature { sketch: Entity, depth: f64, direction: Vec3d, symmetric: bool }
RevolveFeature { sketch: Entity, axis: Entity, angle: f64 }
FilletFeature { edges: Vec<TopoRef>, radius: f64 }
ChamferFeature { edges: Vec<TopoRef>, distance: f64 }
BooleanFeature { tool: Entity, operation: BoolOp }
ShellFeature { faces: Vec<TopoRef>, thickness: f64 }
PatternFeature { source: Entity, pattern: PatternType, params: PatternParams }
```

### Topological Reference (v0.2 — the TNP solution)

```rust
/// How to reference a sub-element that survives parametric rebuild
TopoRef {
    target_body: Entity,           // which body
    source_feature: Entity,        // which feature created this element
    element_kind: ElementKind,     // Face, Edge, Vertex
    provenance: Vec<(Entity, GenType)>,  // chain of features that produced it
    geometric_hint: GeometricHint, // fallback matching data
}

GeometricHint {
    approximate_normal: Option<Vec3d>,   // for faces
    approximate_center: Option<Point3d>, // for edges/faces
    approximate_direction: Option<Vec3d>, // for edges
}

enum GenType { Generated, Modified, Deleted }
```

**Resolution algorithm:**
1. Walk provenance chain to find the element by feature history (exact match)
2. If feature history doesn't resolve (because topology changed), fall back to geometric hint (nearest face with similar normal/center)
3. If geometric hint also fails, mark the downstream feature as broken and show user error

This avoids the TNP by never using ordinal indices (`Face3`) across parametric rebuilds.

### BIM Components (v0.3)

```rust
IfcClass(String)                 // "IfcWall", "IfcDoor", "IfcWindow"
IfcPropertySets(Vec<IfcPset>)    // IFC property sets
WallProperties { width: f64, height: f64, structural: bool }
OpeningProperties { host: Entity, width: f64, height: f64 }
SpaceBoundary { bounding: Vec<Entity> }
BuildingStorey { elevation: f64 }
MaterialLayers(Vec<MaterialLayer>)
```

**Cross-domain query example:** "Find all structural walls on storey 2"
```
query: entities with (WallProperties { structural: true }) AND (BuildingStorey { elevation: 6.0 })
```

This is trivial in ECS. In FreeCAD's class hierarchy, it requires `dynamic_cast` or visitor pattern across unrelated workbench types.

### GIS Components (v0.4)

```rust
CrsInfo { epsg: u32, proj_string: String }
GeoPosition { lon: f64, lat: f64, alt: f64 }
FeatureAttributes(Vec<(String, AttributeValue)>)
GeoExtent { min: GeoPosition, max: GeoPosition }
```

### Civil Components (v0.5)

```rust
Alignment { elements: Vec<AlignmentElement>, equations: Vec<StationEquation> }
Profile { station_elevation: Vec<(f64, f64)>, vertical_curves: Vec<VCurve> }
CrossSection { station: f64, offsets: Vec<(f64, f64)> }
TerrainSurface { tin: TriangulatedNetwork }
Corridor { alignment: Entity, profile: Entity, assembly: Entity }
```

### Point Cloud Components (v0.5+)

```rust
PointSet { positions: Vec<Point3d> }
PointClassification { classes: Vec<u8> }   // LAS classification codes
PointIntensity { intensities: Vec<u16> }
PointColor { colors: Vec<Rgb> }
```

---

## ECS Crate Choice: hecs vs bevy_ecs

| Factor | hecs (375K dl) | bevy_ecs (5.7M dl) |
|--------|---------------|-------------------|
| Weight | 1 crate, minimal | Pulls Bevy ecosystem |
| Change detection | Manual (track yourself) | Built-in `Changed<T>` queries |
| WASM | YES | YES |
| System scheduling | None (you call functions) | Full scheduler with ordering |
| Observers/hooks | None | Built-in observers |
| Community | Moderate | Massive |
| Framework coupling | Zero | Some (App, Schedule concepts) |
| Parallel queries | Manual | Automatic (Send + Sync bounds) |

**Decision: hecs for v0.1-v0.2. Re-evaluate bevy_ecs for v0.3+.**

Rationale:
- NEXUS kernel is a library consumed via WASM, not an application with a game loop
- hecs gives ECS without framework opinions — we control the update loop
- bevy_ecs's `Changed<T>` is useful but can be emulated via dirty flags
- bevy_ecs's system scheduler is irrelevant — our update loop is `execute_command()` → mutate → flush dirty

If by v0.3 the number of systems (rendering, constraints, parametric rebuild, BIM validation, GIS projection) makes manual orchestration painful, switch to bevy_ecs. The component types don't change — only the world/query API changes.

---

## The Feature Tree: Ordered List, Not ECS System

A feature tree is an **ordered sequence** of operations. ECS systems process components in arbitrary order. These are incompatible.

**Solution:** Store the ordered list as a component, evaluate it in one system:

```rust
// On the body entity
FeatureHistory(Vec<FeatureRef>)

// The evaluation system (called after any feature change):
fn evaluate_features(body: Entity, world: &mut World) {
    let history = world.get::<FeatureHistory>(body);
    let active = world.get::<ActiveFeature>(body);
    
    let mut current_shape = initial_shape();
    for (i, feature_ref) in history.0.iter().enumerate() {
        if i > active.0 { break; }  // suppressed features
        let feature_entity = feature_ref.entity;
        current_shape = apply_feature(feature_entity, current_shape, world);
    }
    world.insert(body, BrepGeometry(current_shape));
}
```

This respects ECS (data is components, evaluation is a system) while maintaining order (the Vec enforces sequence).

---

## Anti-Patterns to Avoid

1. **Entity per face/edge/vertex.** Don't create an ECS entity for every topological element of a B-Rep solid. A cube has 6 faces, 12 edges, 8 vertices — that's 26 entities for one box. Instead, store topology as data inside `BrepGeometry(BrepHandle)`. Only create entities for user-visible objects.

2. **Component per property.** Don't create `Width(f64)`, `Height(f64)`, `Depth(f64)` as separate components. Group related data: `BoxDimensions { width: f64, height: f64, depth: f64 }`. Too many components fragments archetypes and kills cache locality.

3. **Stringly-typed references.** Don't reference entities by name (`"wall_1"`) in component data. Always use `Entity` handles. Names are display-only.

4. **Global state in systems.** Don't store state in system functions. All state lives in components. Systems are pure functions: `fn(&mut World)`.

5. **Fighting ECS for ordering.** Don't try to make the ECS enforce feature evaluation order. Accept that feature evaluation is one sequential system. Everything else (rendering, selection, export) runs in parallel on the results.

6. **Premature component splitting.** Don't split `Geometry2d(enum)` into 18 separate components until profiling shows it matters. The enum works, serialization is clean, and 18 variants in one component is fine for 10K entities.

---

## Migration Path

**v0.1 (current):** Vec<Entity> with linear scan. Keep it. It works for <1000 entities.

**Phase 1 (post v0.1):** Add `hecs::World` alongside Vec<Entity>. Migrate entity storage. Keep the command/event architecture unchanged.

**v0.2:** Add 3D components (BrepGeometry, MeshGeometry, FeatureHistory, TopoRef). Add `BooleanFallback`.

**v0.3:** Add BIM components (IfcClass, WallProperties, etc.). This is the first test of Rule 4 — adding a new domain MUST NOT change any existing component or system.

**v0.4:** Add GIS components. Second test of Rule 4.

If v0.3 or v0.4 requires changing universal components, the component design was wrong — fix the abstraction, don't force the domain to fit.
