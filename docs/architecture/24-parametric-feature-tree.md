# Architecture Decision: Parametric Feature Tree

> ## Status: PARKED under SD-05 (2026-04-29)
>
> Parametric feature trees apply to 3D modeling. Execution is paused until AutoCAD 2D parity ships. Lifting SD-05 in `DECISIONS.md` reactivates this work.

> Priority: 5 of 10 — core differentiator from drawing tools
> Risk if wrong: cascading rebuild failures, circular dependencies, undo/redo breaks
> Audience: All agents and developers working on NEXUS

---

## The Problem

Parametric modeling means: edit a dimension → the model rebuilds. This requires an ordered sequence of features (the "feature tree"), a dependency graph, and a rebuild engine. Getting this right is what separates a CAD tool from a drawing tool.

The complication: NEXUS uses event sourcing (Rule 2). When a dimension changes, is that one event or N events? How does undo work across a rebuild cascade?

---

## How Reference Apps Handle It

### FreeCAD: Topological Sort + Sequential Execute

**`Document::recompute()` algorithm:**
1. Collect dirty objects (marked with `Touch` or `Recompute` flags)
2. Build dependency graph from `PropertyLink` connections between objects
3. Topological sort (Boost `topological_sort` — DFS-based)
4. For cycles: `partialTopologicalSort()` — Kahn's algorithm forward pass, then reverse pass, append remaining cycle nodes
5. Execute each dirty object in reverse topological order:
   - Evaluate expressions BEFORE `execute()` (so expression-bound properties are current)
   - Call `object->execute()` (which recomputes the shape)
   - Catch exceptions → set `Error` status flag → continue (does NOT stop cascade)

**Feature suppression:** `Suppressed` boolean property. Suppressed features are skipped during recompute. Known bugs: can still trigger unnecessary recomputes.

**The "Tip" pointer:** `PartDesign::Body::Tip` points to the last active feature. Features after Tip are suppressed. Moving Tip is like rolling back/forward through history.

**Failure handling:** Errors do NOT stop the cascade. Downstream features attempt to execute with an error-state input, typically also failing. UI shows cascading error icons. User must fix the root cause.

### Blender: Ordered Modifier Stack + Depsgraph

**Modifier evaluation:** Strictly top-to-bottom on the Object's modifier list. Output of modifier N = input of modifier N+1. The base mesh is never modified.

**Depsgraph tracks per-modifier dirty flags.** If modifier 3 changes, only modifiers 3..N re-evaluate (not 1..2). This is because the depsgraph has operation nodes per modifier.

**No parametric history:** Blender modifiers are live transforms, not recorded operations. You cannot "go back and edit the sketch that created this extrusion."

### OpenSCAD: Cached Subtree Evaluation

**Cache key = canonical subtree string dump.** If a parameter changes, every ancestor node's cache key changes. Sibling subtrees are unaffected. Cost-based eviction.

**No partial failure:** If a boolean fails, the entire render fails. No concept of "feature N failed but N+1 might work."

---

## Decision for NEXUS

### Event Sourcing + Feature Tree Integration

**Core principle: One intent event, N derived effects.**

When a user changes a dimension from 10mm to 15mm:

```
Event stored:  DimensionChanged { feature: "pad_1", param: "depth", old: 10.0, new: 15.0 }
Rebuild:       Feature tree engine determines cascade → rebuilds pad_1, fillet_2, boolean_3
               These rebuilds are NOT individual events — they are computed state
```

**Why NOT store N events (one per rebuilt feature):**
- Event log becomes coupled to feature tree topology
- Inserting a feature changes the number of events for the same user intent
- Undo becomes ambiguous — which events to undo?
- Event sourcing should capture *intent*, not *derived computation*

### The Rebuild Engine

```rust
pub struct FeatureTree {
    /// Ordered feature list (evaluated top-to-bottom)
    features: Vec<FeatureNode>,
    /// Dependency graph (DAG — features can reference multiple inputs)
    deps: DiGraph<Entity, ()>,  // petgraph
    /// Active feature index ("Tip" — features after this are suppressed)
    active_index: usize,
    /// Snapshot for fast undo (full feature tree state every K events)
    last_snapshot: Option<FeatureTreeSnapshot>,
}

pub struct FeatureNode {
    pub entity: Entity,         // The feature entity in ECS
    pub status: FeatureStatus,  // Ok, Error(String), Suppressed
    pub last_shape: Option<BrepHandle>,  // Cached result
    pub generation: u64,        // Incremented on rebuild
}

pub enum FeatureStatus {
    Ok,
    Error(String),    // Rebuild failed — error message
    Suppressed,       // Skipped (after Tip)
    Stale,            // Needs rebuild but hasn't been rebuilt yet
}
```

### Rebuild Algorithm

```
fn rebuild(tree: &mut FeatureTree, changed: Entity, world: &mut World) {
    // 1. Mark changed feature and all downstream as Stale
    let dirty = bfs_forward(tree.deps, changed);
    for node in dirty { tree.features[node].status = Stale; }
    
    // 2. Topological sort of dirty features (Kahn's algorithm — iterative, WASM-safe)
    let order = topo_sort(tree.deps, &dirty);
    
    // 3. Evaluate each dirty feature in order
    let mut current_shape = get_shape_before(changed, tree);
    for feature_entity in order {
        if tree.features[feature_entity].status == Suppressed { continue; }
        
        match apply_feature(feature_entity, current_shape, world) {
            Ok(new_shape) => {
                tree.features[feature_entity].status = Ok;
                tree.features[feature_entity].last_shape = Some(new_shape);
                current_shape = new_shape;
            }
            Err(e) => {
                tree.features[feature_entity].status = Error(e.to_string());
                // Do NOT stop — continue with last valid shape
                // Downstream features will see the last valid shape, not the error
            }
        }
    }
    
    // 4. Increment generation on all rebuilt features
    // 5. Mark mesh caches as stale (triggers re-tessellation)
}
```

**Key design choices:**

1. **Kahn's algorithm (iterative), not DFS (recursive).** WASM has a limited call stack (~1MB default). Deep feature trees with DFS can overflow. Kahn's uses a queue — no recursion.

2. **Continue on failure.** Like FreeCAD, don't stop the cascade. Use the last valid shape as input for downstream features. This prevents a single error from making the entire model disappear.

3. **Stale status before rebuild.** Mark features as `Stale` immediately (UI shows them as pending). Rebuild in a Web Worker. When rebuild completes, swap in results.

### Undo/Redo for Parametric Changes

**Snapshots at intervals:**

```rust
/// Store full feature tree state every 10 events
const SNAPSHOT_INTERVAL: usize = 10;

fn undo(tree: &mut FeatureTree, event_store: &mut EventStore) {
    event_store.undo();
    // Find nearest snapshot before current cursor
    let snapshot = find_nearest_snapshot(event_store.cursor);
    // Restore feature tree state from snapshot
    tree.restore(snapshot);
    // Replay events from snapshot to cursor
    for event in event_store.events[snapshot.seq..event_store.cursor] {
        apply_event_to_tree(event, tree);
    }
    // Rebuild all stale features
    rebuild_all_stale(tree);
}
```

This avoids replaying from genesis (which would be O(all events) per undo).

### Expression Engine Integration

**Use `evalexpr` (7M downloads) for parametric expressions.**

```rust
// When a feature has an expression-bound parameter:
// e.g., pad depth = "width * 2 + 5"

fn evaluate_expressions(feature: Entity, world: &World) -> Result<()> {
    let params = world.get::<ParameterSet>(feature);
    let mut context = evalexpr::HashMapContext::new();
    
    // Populate context with named parameters from referenced entities
    for (name, param) in params.iter() {
        if let Some(expr) = &param.expression {
            // Resolve variable references
            for var in expr.variables() {
                let value = resolve_variable(var, world);
                context.set_value(var.to_string(), value)?;
            }
            let result = evalexpr::eval_float_with_context(expr, &context)?;
            param.value = result;
        }
    }
    Ok(())
}
```

**Circular reference detection:** Use `petgraph` cycle detection before evaluation. If a cycle is detected, mark involved features as `Error("Circular dependency")`.

**Evaluation order:** Expressions are evaluated BEFORE `apply_feature()` (same as FreeCAD). This ensures expression-bound parameters have current values when the feature rebuilds.

### What NOT to Do

1. **Do NOT store rebuild results as events.** The event log captures user intent. Rebuild results are derived state. Storing them couples the event log to the feature tree topology.

2. **Do NOT use recursive topological sort.** WASM stack overflow. Use iterative Kahn's algorithm.

3. **Do NOT stop rebuild on first failure.** Show the error, continue with last valid shape, let downstream features attempt to rebuild. Users can diagnose and fix one feature at a time.

4. **Do NOT block the UI during rebuild.** Run the rebuild engine in a Web Worker. Show stale geometry with a visual indicator while rebuilding.

5. **Do NOT snapshot every event.** Snapshots are expensive (full feature tree state). Snapshot every 10-20 events. Undo replays from nearest snapshot.

6. **Do NOT allow expressions to reference entity ordinal indices.** Use entity handles or named parameters. This prevents expression breakage when the feature tree is reordered.
