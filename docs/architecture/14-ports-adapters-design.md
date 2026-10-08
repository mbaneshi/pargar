# NEXUS Ports & Adapters Architecture

> The hexagonal architecture that makes NEXUS expandable across 6+ domains without touching the kernel core. Maps every port to a concrete swap on the roadmap.

---

## The Hexagonal Map

```
                ┌──────────────────────────────────────┐
                │                                      │
  ┌─────────┐   │          CORE DOMAIN                 │   ┌──────────────┐
  │ Human   │   │                                      │   │ Three.js     │
  │ (GUI)   │──>│  Commands + Events + ECS             ├──>│ Renderer     │
  └─────────┘   │  + Constraints + Spatial Index       │   └──────────────┘
                │                                      │
  ┌─────────┐   │  (Pure Rust logic, no I/O, no UI,   │   ┌──────────────┐
  │ AI Agent│   │   no framework, no network)          │   │ DXF/IFC/STEP │
  │ (MCP)   │──>│                                      ├──>│ Parsers      │
  └─────────┘   │                                      │   └──────────────┘
                │                                      │
  ┌─────────┐   │                                      │   ┌──────────────┐
  │ CLI /   │   │                                      │   │ OPFS / Cloud │
  │ Script  │──>│                                      ├──>│ Storage      │
  └─────────┘   │                                      │   └──────────────┘
                │                                      │
  ┌─────────┐   │                                      │   ┌──────────────┐
  │ Plugin  │   │                                      │   │ ezpz /       │
  │ (WASM)  │──>│                                      ├──>│ planegcs     │
  └─────────┘   └──────────────────────────────────────┘   └──────────────┘
```

Left side (driving ports): things that TELL the core to do something.
Right side (driven ports): things the core USES to accomplish work.
Core: pure domain logic with no dependencies on any adapter.

---

## The Seven Ports

### Port 1: CommandPort (Driving -- Inbound)

What crosses: structured command objects -> Core -> CommandResult.
Who drives: GUI tools, AI agents (MCP), CLI, scripts, plugins, tests, collaboration (Yjs).

```typescript
interface CommandPort {
    execute(command: Command, source: EventSource): Promise<CommandResult>;
    validate(command: Command): ValidationResult;
}
```

The async signature is deliberate: sync WASM today, Worker tomorrow, network later. AI agents call the same port as GUI. Source attribution flows through automatically.

**Current:** WasmCommandAdapter (calls `kernel.execute_command(json)`)
**Future:** WorkerCommandAdapter (Comlink), NetworkCommandAdapter (Cloud Run), YjsCommandAdapter (collaboration), BatchCommandAdapter (undo groups)

### Port 2: StatePort (Driving -- Outbound Query)

What crosses: query -> Core -> typed state snapshot.
Who queries: renderer, property panel, layer manager, AI agents, file exporters.

```typescript
interface StatePort {
    getEntities(filter?: EntityFilter): Entity[];
    getEntity(id: string): Entity | null;
    getLayers(): Layer[];
    getDirtyIds(): Set<string>;
    getDeletedIds(): Set<string>;
    subscribe(event: string, handler: (data: unknown) => void): () => void;
}
```

The kernel already has `dirty_ids` tracking internally. This port exposes it properly so the renderer only re-renders changed entities, and AI agents can query filtered subsets.

### Port 3: EventPort (Driven -- Outbound Notification)

What crosses: core emits events -> subscribers react.
Who subscribes: UI (agent panel, status bar), AI agents, collaboration layer, audit log.

```typescript
interface EventPort {
    onCommandExecuted(handler: (event: CommandExecutedEvent) => void): () => void;
    onEntityChanged(handler: (event: EntityChangedEvent) => void): () => void;
}

interface CommandExecutedEvent {
    commandId: string;
    params: Record<string, unknown>;
    result: CommandResult;
    source: EventSource;  // { type: 'human' } | { type: 'agent', agentId }
    timestamp: number;
}
```

**Current:** Events exist in Rust EventStore but TypeScript doesn't subscribe to them.
**Future:** EventBusAdapter, YjsEventAdapter (broadcast), CloudStorageEventAdapter (audit JSONL), AgentObserverAdapter (AI context).

### Port 4: RenderPort (Driven -- Outbound Presentation)

What crosses: typed entity data -> renderer -> pixels.
Who implements: Three.js (2D now), Three.js+OCCT (3D), CesiumJS (GIS), Potree (point cloud).

```typescript
interface RenderPort {
    addEntity(id: string, entity: RenderableEntity, color: string): void;
    updateEntity(id: string, entity: RenderableEntity): void;
    removeEntity(id: string): void;
    setSelection(ids: Set<string>): void;
    setPreselection(id: string | null): void;
    setSnapIndicator(snap: SnapResult | null): void;
    setGhostGeometry(entities: RenderableEntity[]): void;  // AI suggestions
    render(): void;
}
```

Adding 3D = new adapter implementing same port, not rewriting sync logic. Multiple renderers can coexist: 2D viewport + 3D viewport + minimap.

### Port 5: PersistencePort (Driven -- Outbound Storage)

```typescript
interface PersistencePort {
    saveProject(projectId: string, data: ProjectSnapshot): Promise<void>;
    loadProject(projectId: string): Promise<ProjectSnapshot | null>;
    listProjects(): Promise<ProjectMetadata[]>;
    deleteProject(projectId: string): Promise<void>;
    exportFile(format: string, data: ExportData): Promise<Blob>;
    importFile(file: File): Promise<ImportResult>;
}
```

**Current:** OPFS with localStorage fallback, hardcoded in AppState.
**Future:** CloudStoragePersistenceAdapter (GCS), IfcImportAdapter (web-ifc), StepImportAdapter (truck-stepio).

### Port 6: ConstraintPort (Driven -- Internal Service)

```rust
pub trait ConstraintPort: Send + Sync {
    fn solve(&self, entities: &mut HashMap<String, Entity>, constraints: &[Constraint]) -> SolveResult;
    fn add_constraint(&mut self, constraint: Constraint) -> String;
    fn remove_constraint(&mut self, id: &str) -> bool;
    fn get_dof(&self, entity_id: &str) -> usize;
    fn detect_conflicts(&self) -> Vec<ConflictInfo>;
}
```

`get_dof()` and `detect_conflicts()` enable constraint visualization UI. Swapping ezpz for planegcs is implementing one trait.

**Current:** IterativeSolverAdapter (50-iteration averaging)
**Future:** EzpzSolverAdapter, PlanegcsSolverAdapter, MockSolverAdapter (testing)

### Port 7: SpatialIndexPort (Driven -- Internal Service)

```rust
pub trait SpatialIndexPort {
    fn insert(&mut self, id: &str, bbox: BoundingBox);
    fn remove(&mut self, id: &str);
    fn update(&mut self, id: &str, bbox: BoundingBox);
    fn query_window(&self, window: BoundingBox) -> Vec<String>;
    fn query_nearest(&self, point: Point2D, radius: f64) -> Option<(String, f64)>;
}
```

**Current:** O(n) linear scan. Works under 1k entities.
**Future:** rstar R-tree for O(log n). Same consumer code, drop-in replacement.

---

## The Kernel After Ports

```rust
// Before (god object):
pub struct Kernel {
    entities: Vec<Entity>,
    layers: Vec<Layer>,
    event_store: EventStore,
    constraint_solver: constraints::ConstraintSolver,  // concrete
    dirty_ids: HashSet<String>,
}

// After (composition of ports):
pub struct Kernel {
    world: World,                                       // ECS world
    event_store: EventStore,
    dirty_tracker: DirtyTracker,
    constraint_solver: Box<dyn ConstraintSolverPort>,
    spatial_index: Box<dyn SpatialIndexPort>,
    geometry_ops: Box<dyn GeometryOpsPort>,
    geometry_kernel: Option<Box<dyn GeometryKernelPort>>,  // None for 2D
    format_registry: FormatRegistry,
    tolerance: Tolerance,
}
```

---

## Roadmap Mapping

The ports weave into existing phases:

| Port | Define Interface | Build Adapter | Phase |
|------|-----------------|---------------|-------|
| CommandPort | UI-0 (AppContext) | UI-1 (CommandRegistry) | Phase 3 |
| StatePort | UI-0 (AppContext) | Phase 4 (incremental sync) | Phase 3-4 |
| EventPort | UI-0 (EventTypes) | UI-1 (EventBus) | Phase 3 |
| RenderPort | Phase 4 (3D split) | Phase 4-5 | Phase 4 |
| PersistencePort | Phase 4 (cloud save) | Phase 4 | Phase 4 |
| ConstraintPort | v0.1 (add trait now) | Phase 6 (ezpz eval) | Phase 0+6 |
| SpatialIndexPort | Phase 4 (rstar) | Phase 4 | Phase 4 |

CommandPort, StatePort, and EventPort are already being designed in the UI evolution sprint through AppContext and EventTypes. The Rust side mirrors them.

---

## What NOT to Over-Architect

1. **Don't port-ify internal kernel logic.** Entity struct, GeometryType enum, EventStore -- these are CORE. They don't need abstraction.
2. **Don't create ports you won't swap.** No `MathPort` for vector operations. No `LoggingPort`. Only abstract what has a concrete second adapter on the roadmap.
3. **Don't add adapters before the second implementation.** ConstraintPort trait exists conceptually, but don't build it until Phase 6 (ezpz evaluation) unless it's trivial to extract.
4. **Don't add abstraction on top of wasm-bindgen.** The WASM boundary IS a port boundary. Don't layer another one.
5. **Performance-critical paths (geometry iteration, render loops) should NOT go through trait dispatch.** Use direct calls with monomorphization. Reserve `Box<dyn>` for runtime-swappable components.

**Rule of thumb:** If you can name two concrete adapters within 6 months, extract a port. If not, keep it direct.

---

## Time Savings

| Without Ports | With Ports |
|---------------|-----------|
| Adding 3D: rewrite CadRenderer sync + AppState + entity parsing | New RenderPort adapter. Everything else unchanged. |
| Swapping solver: rewrite Kernel fields + solve calls | Implement ConstraintPort for ezpz. One file. |
| Adding IFC import: splice parsing into file I/O | Implement FileImportPort adapter. Plug in. |
| Moving kernel to Worker: change every callsite to async | Swap WasmCommandAdapter for WorkerCommandAdapter. |
| Adding AI agent: build separate command pipeline | Call same CommandPort. Source = 'agent'. Done. |
| Adding collaboration: retrofit event broadcasting | Add YjsEventAdapter to EventPort subscribers. |

Each new domain (BIM, GIS, Civil, Point Cloud) adds adapters. Core untouched. Testing in isolation. Parallel development possible. The port investment pays for itself by the third domain.
