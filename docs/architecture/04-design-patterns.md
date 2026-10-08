# NEXUS Design Patterns

> Patterns that create structural seams for the expansion path: 2D CAD -> 3D -> BIM -> GIS -> Civil -> Point Cloud -> Digital Twin. Each pattern maps to a concrete problem in the current codebase and a specific swap or extension on the roadmap.

---

## Pattern 1: Ports & Adapters (Hexagonal Architecture)

The kernel defines trait-based ports for all external capabilities. Adapters implement those traits. The kernel depends only on traits, never on concrete implementations.

```
                ┌───────────────────────────┐
   Driving      │      NEXUS KERNEL         │      Driven
   Adapters     │                           │      Adapters
                │  Ports (traits):          │
  WASM API ────>│  - CommandPort            │────> ConstraintSolver
  MCP API  ────>│  - EventSink              │────> SpatialIndex
  CLI      ────>│  - GeometryOps            │────> GeometryKernel
  Tests    ────>│  - FormatRegistry         │────> FileExporter
                │  - PersistencePort        │────> TessellationEngine
                └───────────────────────────┘
```

### Where it applies

**Constraint solver swap.** Current: concrete `ConstraintSolver` struct hardcoded into `Kernel`. With port:

```rust
pub trait ConstraintSolverPort {
    fn add_constraint(&mut self, ct: ConstraintType) -> String;
    fn remove_constraint(&mut self, id: &str) -> bool;
    fn solve(&self, entities: &mut [Entity]) -> SolveResult;
    fn dof_count(&self) -> usize;
}

// v0.1: hand-rolled iterative solver
// v0.2: ezpz adapter
// v0.3: planegcs WASM adapter
pub struct Kernel {
    constraint_solver: Box<dyn ConstraintSolverPort>,
}
```

**Geometry kernel swap.** For the dual-kernel strategy (truck primary, OCCT fallback):

```rust
pub trait GeometryKernelPort {
    type ShapeHandle: Clone + Send;
    fn boolean_union(&self, a: &Self::ShapeHandle, b: &Self::ShapeHandle) -> Result<Self::ShapeHandle>;
    fn fillet(&self, shape: &Self::ShapeHandle, edges: &[EdgeRef], radius: f64) -> Result<Self::ShapeHandle>;
    fn tessellate(&self, shape: &Self::ShapeHandle, deflection: f64) -> Result<TriMesh>;
    fn import_step(&self, data: &[u8]) -> Result<Vec<Self::ShapeHandle>>;
}

pub struct DualKernel {
    primary: TruckKernel,
    fallback: Option<OcctJsKernel>,
}
```

**File format I/O.** Adding a new format = adding one adapter file:

```rust
pub trait FileImportPort {
    fn can_import(&self, extension: &str) -> bool;
    fn import(&self, data: &[u8]) -> Result<Vec<Command>>;
}

pub struct FormatRegistry {
    importers: Vec<Box<dyn FileImportPort>>,
    exporters: Vec<Box<dyn FileExportPort>>,
}
```

Import returns `Vec<Command>` so every imported entity flows through the normal command pipeline -- event sourcing captures it, undo works, validation applies.

---

## Pattern 2: Strategy Pattern (Geometry Operations)

Current kernel has `line_line_intersect()`, `mirror_geometry()`, `offset_*()`, `fillet()`, `chamfer()` as private methods (~500 lines). These cannot be tested independently or swapped for crate implementations.

```rust
pub trait IntersectionStrategy {
    fn line_line(&self, a: &Line2d, b: &Line2d, tol: &Tolerance) -> Option<Point2D>;
    fn line_circle(&self, line: &Line2d, circle: &Circle2d, tol: &Tolerance) -> Vec<Point2D>;
}

// v0.1: BasicIntersection (current hand-rolled code)
// v0.2: RobustIntersection (using robust predicates crate)

pub trait OffsetStrategy {
    fn offset_polyline(&self, poly: &Polyline2d, distance: f64) -> Polyline2d;
}

// v0.1: BasicOffset (bisector normals)
// v0.2: CavalierOffset (arc-aware, handles self-intersection)
```

Also applies to design standard validation:

```rust
pub trait DesignStandard: Send + Sync {
    fn name(&self) -> &str;
    fn min_curve_radius(&self, design_speed_kmh: f64, superelevation: f64) -> f64;
    fn stopping_sight_distance(&self, speed: f64, grade: f64) -> f64;
}

// One adapter per standard: AASHTO2018, DMRB, Austroads, Eurocode
```

---

## Pattern 3: Mediator Pattern (Command Dispatcher)

Current `execute()` method is a 400+ line match statement on 54+ command variants. Adding 3D, BIM, and Civil commands would triple this.

```rust
pub trait CommandHandler: Send + Sync {
    fn command_type(&self) -> &'static str;
    fn validate(&self, cmd: &Command, ctx: &ExecutionContext) -> Result<(), String>;
    fn execute(&self, cmd: &Command, ctx: &mut ExecutionContext) -> CommandResult;
}

pub struct ExecutionContext<'a> {
    pub entities: &'a mut dyn EntityStorage,
    pub events: &'a mut dyn EventSink,
    pub solver: &'a dyn ConstraintSolverPort,
    pub tolerance: &'a Tolerance,
}

pub struct CommandDispatcher {
    handlers: HashMap<String, Box<dyn CommandHandler>>,
}
```

Result: one handler file per domain (drawing, editing, constraints, 3D modeling, BIM, civil). Adding a domain = adding a handler module. Rule 4 (Additive Expansion) in action.

---

## Pattern 4: Observer Pattern (Dirty Tracking & Reactive Sync)

Currently, dirty tracking is scattered -- every method that modifies an entity must manually call `self.dirty_ids.insert(id)`. Missing one = renderer stale state = invisible bug.

```rust
pub trait EntityObserver {
    fn on_entity_created(&mut self, id: &str);
    fn on_entity_modified(&mut self, id: &str);
    fn on_entity_deleted(&mut self, id: &str);
}

// Observers: DirtyTracker, SpatialIndexUpdater, TessellationInvalidator
```

On the TypeScript side, this becomes an event bus:

```typescript
// Command bus emits after kernel executes:
const changes = kernel.flushChanges();
eventBus.emit('state:changed', changes);

// Renderer, persistence, collaboration each subscribe independently
eventBus.on('state:changed', (changes) => renderer.applyChanges(changes));
eventBus.on('state:changed', (changes) => persistence.appendEvents(changes));
```

Adding a new subscriber (Yjs for collaboration) is one `eventBus.on()` call -- zero changes to existing code.

---

## Pattern 5: Trait-Based Geometry (Solving the Expression Problem)

Adding a geometry type today requires editing 6-12 files (entity.rs match arms, constraints.rs match arms, renderer branches, snap engine branches, DXF import/export). With 18 types this is manageable. By v0.3 (30+ types) it becomes unsustainable.

```rust
pub trait Geometry: Send + Sync {
    fn type_tag(&self) -> &'static str;

    // Spatial operations
    fn translate(&mut self, dx: f64, dy: f64);
    fn rotate(&mut self, cx: f64, cy: f64, angle: f64);
    fn scale(&mut self, cx: f64, cy: f64, factor: f64);
    fn bounding_box(&self) -> BBox2D;

    // Constraint integration
    fn point_count(&self) -> usize;
    fn get_point(&self, index: usize) -> Option<Point2D>;
    fn set_point(&mut self, index: usize, point: &Point2D) -> bool;

    // Rendering -- tessellate to polylines/mesh, renderer is type-agnostic
    fn tessellate(&self) -> TessellatedGeometry;
    fn snap_points(&self) -> Vec<SnapCandidate> { vec![] }
    fn grip_points(&self) -> Vec<Point2D> { vec![] }
}
```

Result: adding a new geometry type = one file implementing the `Geometry` trait. The renderer draws tessellated output without knowing the type. The constraint solver calls `get_point()`/`set_point()` generically. 4 edits instead of 12.

For serialization, `typetag` crate handles `Box<dyn Geometry>` serde automatically.

### Tessellation as the rendering contract

The renderer never knows geometry types. The kernel tessellates into polylines (2D) or triangle meshes (3D):

```rust
pub struct TessellatedGeometry {
    pub polylines: Vec<Vec<Point2D>>,
    pub triangles: Option<TriangleMesh>,
}
```

One renderer for all domains: 2D lines become polylines, 3D solids become triangle meshes via truck-meshalgo, IFC walls via web-ifc tessellation, terrain via Delaunay. Same renderer code.

---

## Pattern 6: Domain Plugin (Additive Expansion)

Rule 4 says new domains are additive. The plugin pattern makes this mechanical:

```rust
pub trait DomainPlugin {
    fn name(&self) -> &str;
    fn register_components(&self, registry: &mut ComponentRegistry);
    fn register_commands(&self, dispatcher: &mut CommandDispatcher);
    fn register_formats(&self, registry: &mut FormatRegistry);
    fn register_observers(&self, bus: &mut ObserverBus);
}

// Kernel initialization
let mut kernel = Kernel::new();
kernel.register_plugin(CadDomain);       // v0.1
kernel.register_plugin(BimDomain);       // v0.3: just add this line
kernel.register_plugin(GisDomain);       // v0.4: just add this line
kernel.register_plugin(CivilDomain);     // v0.5: just add this line
```

Each plugin registers its components, commands, formats, and observers. No kernel code changes. Lazy-loading WASM modules per domain means a 2D-only user never downloads the BIM parser.

---

## Pattern 7: Kernel Facade (Anti-Corruption Layer)

A thin typed wrapper around the WASM kernel that eliminates `kernel: any` from TypeScript:

```typescript
export class KernelFacade {
    constructor(private wasm: any) {} // only place `any` is used

    executeCommand(command: Command): CommandResult {
        return JSON.parse(this.wasm.execute_command(JSON.stringify(command)));
    }

    getEntities(): Entity[] {
        return JSON.parse(this.wasm.get_entities_json());
    }

    flushChanges(): ChangeSet {
        return JSON.parse(this.wasm.flush_changes());
    }
}
```

Every module imports `KernelFacade` instead of touching WASM directly. If the Rust API changes, only the facade changes -- compile-time errors instead of runtime crashes.

---

## Pattern 8: Command Bus with Middleware

Route all commands through a bus that supports cross-cutting concerns:

```typescript
type CommandMiddleware = (
    command: Command,
    context: CommandContext,
    next: () => Promise<CommandResult>
) => Promise<CommandResult>;

// Compose:
const bus = new CommandBus(kernel)
    .use(featureFlagMiddleware)     // gates unreleased commands
    .use(rateLimitMiddleware)       // throttles AI agents
    .use(auditMiddleware);          // logs every command with actor attribution
```

Each concern is independent middleware. Feature flags, AI rate limiting, audit logging, undo grouping, and collaboration sync never touch the kernel or the tools.

---

## Patterns from Reference Source Code

Analyzed 19 repos (vendor-study/ + reference-repos/cad/). Key adoptable patterns:

### Scale-adaptive epsilon (from Manifold)
Current tolerance.rs uses fixed constants (1e-8). These break on large drawings (too tight) and tiny features (too loose). Manifold computes epsilon relative to bounding box scale. Add `scale_epsilon(base: f64, bbox: &BoundingBox) -> f64` to tolerance.rs.

### Force-based constraint solver (from Cadmium)
Current solver applies each constraint fully in one pass -- oscillates when constraints conflict. Cadmium uses Hooke's law + damping (spring-mass model): accumulate forces, then integrate. Key parameters: `dt=0.02`, `kp=2.0`, `kd=0.3`.

### Material-batched geometry (from CAD-Viewer)
Current syncEntities() creates one mesh per entity = 10k draw calls at 10k entities. Pattern: group by layer + material key, merge geometries via `mergeGeometries()`, one draw call per group. Store entity_id -> vertex range mapping for selection.

### Manual/auto render mode (from IFC.js Components)
Add `needsUpdate: boolean` to renderer. Set true only on entity changes, selection changes, camera moves. Most mouse moves during idle don't change the scene.

### Spatial index (from Manifold/Rapier)
Current snap detection is O(n^2), hitTest is O(n). Implement quadtree in Rust kernel for O(log n) snap + hitTest. Use incremental update (rstar crate) instead of full rebuild per frame.

---

## Implementation Priority

### Before v0.2:
1. **ConstraintSolverPort trait** -- move current solver behind it. Unblocks ezpz swap. (2 hours)
2. **Extract geometry ops from Kernel** -- separate module with public functions. Enables independent testing. (1 day)
3. **DirtyTracker as observer** -- eliminate scattered `dirty_ids.insert()` calls. (half day)
4. **KernelFacade** -- eliminate `any` typing. (2-3 hours)

### For v0.2 (3D):
5. **GeometryKernelPort trait** with TruckKernel adapter
6. **CommandHandler registry** -- break execute() into domain handlers
7. **FormatRegistry** -- register DXF, STL, STEP adapters
8. **DomainPlugin trait** with CadDomain as first plugin

### For v0.3+ (BIM/GIS):
9. Register BimDomain, GisDomain plugins
10. Design standard strategies (AASHTO, Eurocode, etc.)

---

## What NOT to Abstract

| Area | Why Leave It |
|------|-------------|
| **Point2D / Point3D** | Hot path math. Trait dispatch kills performance. |
| **EventStore internals** | Simple (Vec + cursor, 60 lines). No swap path. |
| **Layer system** | Small, stable, always present in CAD. |
| **Three.js internals** | Abstract at the RenderPort boundary, not inside the adapter. |
| **Svelte 5 specifics** | UI framework is locked. Don't abstract it. |
| **WASM bindings** | The WASM boundary IS the port. Don't add another layer. |

**Rule of thumb:** If you can name two concrete adapters that will exist within 6 months, extract a port. If not, keep it direct.

---

## How Patterns Compose

ECS entities emit events through the observer, processed by command handlers via the dispatcher, through middleware on the bus, executed in the kernel behind hexagonal ports. Geometry types implement the Geometry trait for type-agnostic rendering and constraint solving. Domain plugins register components, commands, and formats additively. File imports produce commands, flowing through the same pipeline as GUI and AI agent operations.

The patterns are not independent -- they form the structural seams where future domains plug in without breaking the present.
