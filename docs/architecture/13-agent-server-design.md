# 13 — Nexus Agent Server: Architecture Design

> **Date:** 2026-04-14
> **Status:** Design complete, pending implementation
> **Depends on:** 01-system-architecture, 07-ai-agent-integration (brief), 11-ai-readiness-audit
> **Scope:** Rust server infrastructure for AI agent collaboration on NEXUS drawings

---

## Part 0 — Research Findings & Framework Decision

### What exists in the codebase today

**Done:**
- Kernel command system: 60+ `Command` variants, `execute_command(json) -> json`, serde-serialized (`kernel/src/commands.rs`)
- Event sourcing with Actor enum: `User { session_id }`, `Agent { agent_id, model }`, `System` (`kernel/src/events.rs`)
- Full JSON serialization of all state: entities, layers, constraints, blocks
- Trust architecture designed in `docs/brief/07-ai-agent-integration.md` (792 lines)
- USES schema for cross-domain entities (`docs/schemas/uses.ts`)
- Kernel Cargo.toml already declares `crate-type = ["cdylib", "rlib"]` — native Rust linking ready

**Not done:**
- No `@nexus/ai` package
- No MCP server code
- No agent orchestration
- No real-time sync / WebSocket server
- No workflow engine
- No server binary

### Framework evaluation

| Framework | Version | Downloads | Verdict |
|---|---|---|---|
| **Google ADK (Rust)** | — | — | **Does not exist.** ADK is Python-only (`google/adk-python`). Two unofficial ports exist: `zavora-ai/adk-rust` (263 stars, v0.5.0) and `yougigun/rust-adk` (15 stars, toy). Neither is production-grade. |
| **rmcp (MCP Rust SDK)** | 1.4.0 | 7.5M | **Production-ready.** Official Anthropic-backed SDK. Server + client. `#[tool_router]` proc macro auto-generates JSON Schema from fn signatures. Transports: stdio, HTTP/SSE, WebSocket. |
| **Rig** | 0.35.0 | 519K | **Maturing.** Rust LLM framework. 20+ providers (Claude, GPT, Gemini). Tool trait, RAG, streaming. Handles the prompt-completion-tool loop. No built-in multi-agent. |
| **langchain-rust** | 4.6.0 | 135K | **Stale.** Last release Oct 2024. Avoid. |
| **llm-chain** | 0.13.0 | 86K | **Abandoned.** Last release Nov 2023. Dead. |

### Decision: rmcp + rig + custom orchestration

**rmcp** is the tool interface layer. It exposes kernel commands as MCP tools that any client (Claude Desktop, Cursor, VS Code Copilot, our own agents) can discover and call. The `#[tool_router]` macro gives us automatic JSON Schema generation from Rust function signatures — a direct 1:1 mapping to our command pattern.

**rig** is the agent runtime. When we need autonomous multi-step agents (e.g., "design a floor plan from this description"), Rig handles the LLM loop: send prompt -> model picks tools -> deserialize args -> call tool -> feed result back -> repeat until done. Rig supports Claude natively via `rig::providers::anthropic`.

**Custom orchestration** for multi-agent coordination, workflow engine, and real-time sync. No existing Rust framework handles our specific needs (CAD-aware conflict resolution, engineering workflow automation, actor-aware event propagation). We build this on **Axum** (HTTP/WebSocket) + **Tokio** (async runtime).

**Why not ADK:** It doesn't exist in Rust. The Python ADK is tied to Gemini/Vertex AI and would force a Python sidecar — violating our all-Rust constraint. The unofficial ports are too immature for production.

**Why not raw MCP without Rig:** MCP is a protocol, not an agent. It tells tools how to be called but doesn't drive the LLM loop. We need both: rmcp to expose tools, Rig to orchestrate agents that call those tools.

---

## Part 1 — System Architecture Overview

```
                            ┌─────────────────────────────────┐
                            │          NEXUS Server            │
                            │        (single Rust binary)      │
                            │                                  │
  Browser Client ──ws──────▶│  ┌────────────────────────────┐  │
  (SvelteKit)               │  │      Axum Router           │  │
                            │  │  /ws    → SessionManager    │  │
  Claude Desktop ──mcp─────▶│  │  /mcp   → McpTransport     │  │
  Cursor / IDEs             │  │  /api   → RestHandlers      │  │
                            │  │  /hooks → WebhookRouter     │  │
  External APIs ──rest─────▶│  └────────┬───────────────────┘  │
                            │           │                      │
                            │  ┌────────▼───────────────────┐  │
                            │  │      Command Bus            │  │
                            │  │  (tokio broadcast channel)  │  │
                            │  └────────┬───────────────────┘  │
                            │           │                      │
                            │  ┌────────▼───────────────────┐  │
                            │  │    Project Manager          │  │
                            │  │  HashMap<ProjectId, Project>│  │
                            │  │                             │  │
                            │  │  Project {                  │  │
                            │  │    kernel: Kernel,          │  │
                            │  │    event_log: EventLog,     │  │
                            │  │    sessions: Vec<Session>,  │  │
                            │  │    workflows: WorkflowEngine│  │
                            │  │  }                          │  │
                            │  └────────┬───────────────────┘  │
                            │           │                      │
                            │  ┌────────▼───────────────────┐  │
                            │  │    Agent Runtime (Rig)      │  │
                            │  │  DraftingAgent              │  │
                            │  │  ReviewAgent                │  │
                            │  │  QuantityAgent              │  │
                            │  │  DetailAgent                │  │
                            │  │  ChatAgent                  │  │
                            │  └────────────────────────────┘  │
                            │                                  │
                            │  ┌────────────────────────────┐  │
                            │  │    Storage (SQLite + OPFS)  │  │
                            │  │  projects.db                │  │
                            │  │  events.db                  │  │
                            │  │  agent_memory.db            │  │
                            │  │  workflows.db               │  │
                            │  └────────────────────────────┘  │
                            └─────────────────────────────────┘
```

### Key design decisions

**1. Single binary deployment.** The entire server — HTTP, WebSocket, MCP, agent runtime, workflow engine, database — compiles to one Rust binary. Civil engineers on job sites run `./nexus-server` and have the full system. No Docker, no Kubernetes, no cloud dependency.

**2. Kernel runs natively, not in WASM.** The kernel crate already declares `crate-type = ["cdylib", "rlib"]`. The server links the kernel as a native Rust library via `rlib`. Same code, native speed, no WASM overhead. The browser still uses the `cdylib` → WASM path.

**3. One kernel instance per project.** Each open project gets its own `Kernel` struct. Multiple sessions (human + AI) connect to the same project and share the same kernel. The `ProjectManager` maps `ProjectId` → `Project`.

**4. Command Bus for fan-out.** Every command execution broadcasts an event to all connected sessions. This is how AI edits appear instantly in the browser and human edits update AI context.

---

## Part 2 — Core Type Definitions

### 2.1 — Kernel as a Service

```rust
// server/src/project.rs

use nexus_kernel::Kernel;
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};

/// A live project with a kernel, connected sessions, and event history.
pub struct Project {
    pub id: ProjectId,
    pub meta: ProjectMeta,
    pub kernel: Arc<RwLock<Kernel>>,
    pub event_log: Arc<RwLock<PersistentEventLog>>,
    pub sessions: Arc<RwLock<Vec<Session>>>,
    pub command_tx: broadcast::Sender<BroadcastEvent>,
    pub workflow_engine: Arc<WorkflowEngine>,
}

pub struct ProjectMeta {
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub drawing_units: DrawingUnits,
    pub standards: Vec<String>,  // "ACI-318", "Eurocode-2", etc.
}

pub enum DrawingUnits {
    Meters,
    Millimeters,
    Feet,
    Inches,
}

/// Manages all open projects.
pub struct ProjectManager {
    projects: Arc<RwLock<HashMap<ProjectId, Arc<Project>>>>,
    db: Arc<Database>,
}

impl ProjectManager {
    /// Open a project — loads from disk, creates kernel, starts event log.
    pub async fn open(&self, id: ProjectId) -> Result<Arc<Project>> {
        let mut projects = self.projects.write().await;
        if let Some(p) = projects.get(&id) {
            return Ok(p.clone());
        }

        let saved = self.db.load_project(&id).await?;
        let kernel = Kernel::new();

        // Replay saved entities into kernel
        for entity_json in &saved.entities {
            kernel.import_entity_json(entity_json);
        }

        let (tx, _) = broadcast::channel(1024);
        let project = Arc::new(Project {
            id: id.clone(),
            meta: saved.meta,
            kernel: Arc::new(RwLock::new(kernel)),
            event_log: Arc::new(RwLock::new(
                PersistentEventLog::open(&self.db, &id).await?,
            )),
            sessions: Arc::new(RwLock::new(Vec::new())),
            command_tx: tx,
            workflow_engine: Arc::new(WorkflowEngine::new()),
        });

        projects.insert(id, project.clone());
        Ok(project)
    }

    /// Execute a command on a project, broadcast result to all sessions.
    pub async fn execute(
        &self,
        project_id: &ProjectId,
        command: CommandEnvelope,
    ) -> Result<CommandResult> {
        let project = self.get(project_id).await?;
        let mut kernel = project.kernel.write().await;

        // Execute in kernel
        let result_json = kernel.execute_command(&command.payload_json);
        let result: CommandResult = serde_json::from_str(&result_json)?;

        if result.success {
            // Persist event
            let event = BroadcastEvent {
                seq: project.event_log.read().await.next_seq(),
                timestamp_ms: now_ms(),
                actor: command.actor.clone(),
                command_json: command.payload_json.clone(),
                result: result.clone(),
                changes_json: kernel.flush_changes(),
            };

            project.event_log.write().await.append(&event).await?;

            // Broadcast to all connected sessions
            let _ = project.command_tx.send(event.clone());

            // Trigger workflow engine
            project.workflow_engine.on_event(&event).await;
        }

        Ok(result)
    }
}
```

### 2.2 — Session & Actor Model

```rust
// server/src/session.rs

use crate::trust::AgentTrust;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Actor {
    Human {
        user_id: String,
        session_id: String,
        display_name: String,
    },
    Agent {
        agent_id: String,
        agent_type: AgentType,
        model: String,
        trust: AgentTrust,
    },
    System,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum AgentType {
    Drafting,
    Review,
    Quantity,
    Detail,
    Chat,
    Custom(String),
}

/// A connected session — either a human via WebSocket or an AI agent.
pub struct Session {
    pub id: String,
    pub actor: Actor,
    pub project_id: ProjectId,
    pub connected_at: i64,
    pub last_active: i64,
    /// For agents: the draft layer where tentative geometry goes.
    pub draft_layer_id: Option<String>,
}

/// What the AI sees — trimmed context for token efficiency.
#[derive(Serialize)]
pub struct AgentContext {
    pub project_meta: ProjectMeta,
    pub entity_count: usize,
    pub layer_summary: Vec<LayerSummary>,
    pub recent_commands: Vec<RecentCommand>,    // last 20
    pub active_constraints: usize,
    pub violations: Vec<Violation>,
    pub selection: Vec<String>,                 // currently selected entity IDs
    pub viewport_bounds: Option<BoundingBox>,   // what the human is looking at
}

#[derive(Serialize)]
pub struct LayerSummary {
    pub id: String,
    pub name: String,
    pub entity_count: usize,
    pub visible: bool,
    pub locked: bool,
}

#[derive(Serialize)]
pub struct RecentCommand {
    pub actor: String,      // "human:alice" or "agent:drafting"
    pub command_type: String,
    pub timestamp_ms: i64,
    pub entity_ids: Vec<String>,
}
```

### 2.3 — Trust System

```rust
// server/src/trust.rs

use nexus_kernel::commands::Command;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub enum AgentTrust {
    Observer,     // read only
    Annotator,    // add text, dimensions, markup
    Designer,     // create/modify geometry and constraints
    Administrator, // full access including delete and export
}

impl AgentTrust {
    /// Check if this trust level permits a given command.
    pub fn can_execute(&self, cmd: &Command) -> bool {
        match self {
            AgentTrust::Observer => matches!(cmd,
                Command::MeasureDistance { .. } |
                Command::MeasureArea { .. }
            ),
            AgentTrust::Annotator => {
                self.can_execute_as_observer(cmd) || matches!(cmd,
                    Command::CreateText { .. } |
                    Command::CreateDimension { .. } |
                    Command::CreateAlignedDimension { .. } |
                    Command::CreateAngularDimension { .. } |
                    Command::CreateRadialDimension { .. } |
                    Command::CreateDiameterDimension { .. } |
                    Command::CreateMText { .. }
                )
            }
            AgentTrust::Designer => {
                self.can_execute_as_annotator(cmd) || !matches!(cmd,
                    Command::DeleteEntity { .. } |
                    Command::DeleteLayer { .. }
                )
            }
            AgentTrust::Administrator => true,
        }
    }

    /// Commands that always require human confirmation, regardless of trust.
    pub fn requires_confirmation(cmd: &Command) -> bool {
        matches!(cmd,
            Command::DeleteEntity { .. } |
            Command::DeleteLayer { .. }
        )
    }

    fn can_execute_as_observer(&self, cmd: &Command) -> bool {
        AgentTrust::Observer.can_execute(cmd)
    }

    fn can_execute_as_annotator(&self, cmd: &Command) -> bool {
        AgentTrust::Annotator.can_execute(cmd)
    }
}
```

---

## Part 3 — Tool Registry (Three Tiers)

### Tier 1 — Primitive Tools (1:1 kernel mapping via rmcp)

These are auto-generated from function signatures using `#[tool_router]`.

```rust
// server/src/tools/primitives.rs

use rmcp::prelude::*;

#[derive(Clone)]
pub struct PrimitiveTools {
    project_mgr: Arc<ProjectManager>,
}

#[tool_router]
impl PrimitiveTools {
    // --- Geometry Creation ---

    #[tool(description = "Draw a straight line between two points. \
        Coordinates are in drawing units. Returns the entity ID. \
        Use create_polyline for multiple connected segments.")]
    async fn create_line(
        &self,
        #[tool(param, description = "Start X coordinate")] x1: f64,
        #[tool(param, description = "Start Y coordinate")] y1: f64,
        #[tool(param, description = "End X coordinate")] x2: f64,
        #[tool(param, description = "End Y coordinate")] y2: f64,
        #[tool(param, description = "Layer ID. Use 'layer_0' for default.")] layer_id: String,
        #[tool(param, description = "Project ID")] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "CreateLine",
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Draw a circle. Returns entity ID.")]
    async fn create_circle(
        &self,
        #[tool(param, description = "Center X")] cx: f64,
        #[tool(param, description = "Center Y")] cy: f64,
        #[tool(param, description = "Radius in drawing units. Must be > 0.")] radius: f64,
        #[tool(param, description = "Layer ID")] layer_id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "CreateCircle",
            "cx": cx, "cy": cy, "radius": radius,
            "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Draw a rectangle. Returns entity ID.")]
    async fn create_rectangle(
        &self,
        #[tool(param, description = "Bottom-left X")] x: f64,
        #[tool(param, description = "Bottom-left Y")] y: f64,
        #[tool(param, description = "Width")] width: f64,
        #[tool(param, description = "Height")] height: f64,
        #[tool(param)] layer_id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "CreateRectangle",
            "x": x, "y": y, "width": width, "height": height,
            "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Draw an arc defined by center, radius, start angle, end angle. \
        Angles in radians, counterclockwise from positive X.")]
    async fn create_arc(
        &self,
        #[tool(param)] cx: f64,
        #[tool(param)] cy: f64,
        #[tool(param)] radius: f64,
        #[tool(param, description = "Start angle in radians")] start_angle: f64,
        #[tool(param, description = "End angle in radians")] end_angle: f64,
        #[tool(param)] layer_id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "CreateArc",
            "cx": cx, "cy": cy, "radius": radius,
            "start_angle": start_angle, "end_angle": end_angle,
            "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Draw a polyline through a sequence of points. \
        Set closed=true for a closed polygon.")]
    async fn create_polyline(
        &self,
        #[tool(param, description = "Array of [x,y] coordinate pairs")] vertices: Vec<(f64, f64)>,
        #[tool(param, description = "Close the polyline into a polygon")] closed: bool,
        #[tool(param)] layer_id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "CreatePolyline",
            "vertices": vertices, "closed": closed,
            "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    // --- Editing ---

    #[tool(description = "Move an entity by a delta offset.")]
    async fn move_entity(
        &self,
        #[tool(param, description = "Entity ID to move")] id: String,
        #[tool(param, description = "X displacement")] dx: f64,
        #[tool(param, description = "Y displacement")] dy: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "MoveEntity", "id": id, "dx": dx, "dy": dy });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Delete an entity. Requires human confirmation for agent callers.")]
    async fn delete_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "DeleteEntity", "id": id });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Copy an entity. Returns the new entity ID.")]
    async fn copy_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "CopyEntity", "id": id });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Rotate an entity around a center point. Angle in radians.")]
    async fn rotate_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param, description = "Center of rotation X")] cx: f64,
        #[tool(param, description = "Center of rotation Y")] cy: f64,
        #[tool(param, description = "Angle in radians, counterclockwise")] angle: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "RotateEntity", "id": id,
            "cx": cx, "cy": cy, "angle": angle
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Mirror an entity across a line defined by two points. \
        Creates a new entity (the mirror). Returns the new entity ID.")]
    async fn mirror_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param)] x1: f64, #[tool(param)] y1: f64,
        #[tool(param)] x2: f64, #[tool(param)] y2: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "MirrorEntity", "id": id,
            "x1": x1, "y1": y1, "x2": x2, "y2": y2
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Offset an entity (line, polyline, arc, circle) by a distance. \
        Creates a parallel copy. Returns new entity ID.")]
    async fn offset_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param, description = "Offset distance. Positive = outward.")] distance: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "OffsetEntity", "id": id, "distance": distance });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Fillet (round) the intersection of two lines with an arc of given radius.")]
    async fn fillet(
        &self,
        #[tool(param, description = "First line entity ID")] id_a: String,
        #[tool(param, description = "Second line entity ID")] id_b: String,
        #[tool(param, description = "Fillet radius")] radius: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "Fillet", "id_a": id_a, "id_b": id_b, "radius": radius });
        self.execute(&project_id, cmd).await
    }

    // --- Constraints ---

    #[tool(description = "Add a parallel constraint between two lines.")]
    async fn add_constraint_parallel(
        &self,
        #[tool(param)] entity_a: String,
        #[tool(param)] entity_b: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "AddConstraintParallel",
            "entity_a": entity_a, "entity_b": entity_b
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Add a perpendicular constraint between two lines.")]
    async fn add_constraint_perpendicular(
        &self,
        #[tool(param)] entity_a: String,
        #[tool(param)] entity_b: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "AddConstraintPerpendicular",
            "entity_a": entity_a, "entity_b": entity_b
        });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Add a fixed distance constraint between two points on entities.")]
    async fn add_constraint_distance(
        &self,
        #[tool(param)] entity_a: String,
        #[tool(param, description = "Point index on entity A (0=start, 1=end)")] point_a: usize,
        #[tool(param)] entity_b: String,
        #[tool(param, description = "Point index on entity B")] point_b: usize,
        #[tool(param, description = "Required distance")] distance: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "AddConstraintDistance",
            "entity_a": entity_a, "point_a": point_a,
            "entity_b": entity_b, "point_b": point_b,
            "distance": distance
        });
        self.execute(&project_id, cmd).await
    }

    // --- Layers ---

    #[tool(description = "Create a new layer. Returns layer ID.")]
    async fn create_layer(
        &self,
        #[tool(param)] name: String,
        #[tool(param, description = "Hex color, e.g. '#ff0000'")] color: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({ "type": "CreateLayer", "name": name, "color": color });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Move an entity to a different layer.")]
    async fn set_entity_layer(
        &self,
        #[tool(param)] entity_id: String,
        #[tool(param)] layer_id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let cmd = json!({
            "type": "SetEntityLayer",
            "entity_id": entity_id, "layer_id": layer_id
        });
        self.execute(&project_id, cmd).await
    }

    // --- Queries (read-only) ---

    #[tool(description = "Get all entities as JSON array. Each entity has: id, geometry, layer_id, style. \
        For large drawings, prefer query_entities_on_layer to reduce output size.")]
    async fn get_entities(
        &self,
        #[tool(param)] project_id: String,
    ) -> String {
        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        kernel.get_entities_json()
    }

    #[tool(description = "Get a single entity by ID.")]
    async fn get_entity(
        &self,
        #[tool(param)] id: String,
        #[tool(param)] project_id: String,
    ) -> String {
        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        kernel.get_entity_json(&id)
    }

    #[tool(description = "Get all layers with their properties.")]
    async fn get_layers(
        &self,
        #[tool(param)] project_id: String,
    ) -> String {
        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        kernel.get_layers_json()
    }

    #[tool(description = "Get all geometric constraints.")]
    async fn get_constraints(
        &self,
        #[tool(param)] project_id: String,
    ) -> String {
        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        kernel.get_constraints_json()
    }

    #[tool(description = "Get drawing summary: entity count, layer count, constraint count, bounds.")]
    async fn get_drawing_state(
        &self,
        #[tool(param)] project_id: String,
    ) -> String {
        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        json!({
            "entity_count": kernel.entity_count(),
            "entities_json_preview": "(call get_entities for full data)",
        }).to_string()
    }

    // --- Undo/Redo ---

    #[tool(description = "Undo the last command.")]
    async fn undo(&self, #[tool(param)] project_id: String) -> String {
        let cmd = json!({ "type": "Undo" });
        self.execute(&project_id, cmd).await
    }

    #[tool(description = "Redo the last undone command.")]
    async fn redo(&self, #[tool(param)] project_id: String) -> String {
        let cmd = json!({ "type": "Redo" });
        self.execute(&project_id, cmd).await
    }
}

impl PrimitiveTools {
    async fn execute(&self, project_id: &str, cmd: serde_json::Value) -> String {
        let envelope = CommandEnvelope {
            project_id: project_id.into(),
            actor: Actor::Agent { /* filled by middleware */ },
            payload_json: cmd.to_string(),
        };
        match self.project_mgr.execute(&project_id.into(), envelope).await {
            Ok(r) => serde_json::to_string(&r).unwrap(),
            Err(e) => json!({ "success": false, "error": e.to_string() }).to_string(),
        }
    }
}
```

### Tier 2 — Semantic Tools (Civil Engineering Domain)

These decompose into Tier 1 kernel commands. They encode engineering knowledge.

```rust
// server/src/tools/semantic.rs

/// Semantic tools encode civil engineering domain knowledge.
/// Each tool decomposes into a sequence of Tier 1 kernel commands.
pub struct SemanticTools {
    primitives: Arc<PrimitiveTools>,
    project_mgr: Arc<ProjectManager>,
}

#[tool_router]
impl SemanticTools {
    #[tool(description = "Draw a wall between two points with a given thickness. \
        Creates two parallel lines offset by thickness/2 from the centerline, \
        capped at both ends. All entities placed on a WALLS layer (created if needed). \
        Returns IDs of all created entities.")]
    async fn draw_wall(
        &self,
        #[tool(param, description = "Wall start X")] from_x: f64,
        #[tool(param, description = "Wall start Y")] from_y: f64,
        #[tool(param, description = "Wall end X")] to_x: f64,
        #[tool(param, description = "Wall end Y")] to_y: f64,
        #[tool(param, description = "Wall thickness in drawing units")] thickness: f64,
        #[tool(param, description = "Material label, e.g. 'concrete', 'brick'")] material: String,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition into Tier 1 commands:
        //
        // 1. Ensure WALLS layer exists
        // 2. Draw centerline (on WALLS-CL layer, construction)
        // 3. Offset centerline +thickness/2 → outer line
        // 4. Offset centerline -thickness/2 → inner line
        // 5. Draw end caps (two short lines connecting inner/outer)
        // 6. Add parallel constraints (outer ∥ inner ∥ centerline)
        // 7. Add distance constraint (inner↔outer = thickness)
        // 8. Tag all entities with metadata: { "type": "wall", "material": material }

        let half = thickness / 2.0;
        let dx = to_x - from_x;
        let dy = to_y - from_y;
        let len = (dx * dx + dy * dy).sqrt();
        if len < 1e-10 {
            return json!({ "success": false, "error": "Wall has zero length" }).to_string();
        }
        let nx = -dy / len * half;  // normal offset
        let ny = dx / len * half;

        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let mut kernel = project.kernel.write().await;
        let mut created_ids = Vec::new();

        // Ensure WALLS layer
        let layers_json = kernel.get_layers_json();
        let layers: Vec<serde_json::Value> = serde_json::from_str(&layers_json).unwrap();
        let wall_layer = layers.iter()
            .find(|l| l["name"] == "WALLS")
            .map(|l| l["id"].as_str().unwrap().to_string());
        let layer_id = match wall_layer {
            Some(id) => id,
            None => {
                let r = kernel.execute_command(
                    &json!({"type":"CreateLayer","name":"WALLS","color":"#00ff88"}).to_string()
                );
                let r: CommandResult = serde_json::from_str(&r).unwrap();
                r.created_ids[0].clone()
            }
        };

        // Outer line
        let r = kernel.execute_command(&json!({
            "type": "CreateLine",
            "x1": from_x + nx, "y1": from_y + ny,
            "x2": to_x + nx, "y2": to_y + ny,
            "layer_id": layer_id
        }).to_string());
        let r: CommandResult = serde_json::from_str(&r).unwrap();
        created_ids.extend(r.created_ids.clone());
        let outer_id = r.created_ids[0].clone();

        // Inner line
        let r = kernel.execute_command(&json!({
            "type": "CreateLine",
            "x1": from_x - nx, "y1": from_y - ny,
            "x2": to_x - nx, "y2": to_y - ny,
            "layer_id": layer_id
        }).to_string());
        let r: CommandResult = serde_json::from_str(&r).unwrap();
        created_ids.extend(r.created_ids.clone());
        let inner_id = r.created_ids[0].clone();

        // End cap 1
        let r = kernel.execute_command(&json!({
            "type": "CreateLine",
            "x1": from_x + nx, "y1": from_y + ny,
            "x2": from_x - nx, "y2": from_y - ny,
            "layer_id": layer_id
        }).to_string());
        let r: CommandResult = serde_json::from_str(&r).unwrap();
        created_ids.extend(r.created_ids);

        // End cap 2
        let r = kernel.execute_command(&json!({
            "type": "CreateLine",
            "x1": to_x + nx, "y1": to_y + ny,
            "x2": to_x - nx, "y2": to_y - ny,
            "layer_id": layer_id
        }).to_string());
        let r: CommandResult = serde_json::from_str(&r).unwrap();
        created_ids.extend(r.created_ids);

        // Parallel constraint
        kernel.execute_command(&json!({
            "type": "AddConstraintParallel",
            "entity_a": outer_id, "entity_b": inner_id
        }).to_string());

        // Distance constraint (thickness)
        kernel.execute_command(&json!({
            "type": "AddConstraintDistance",
            "entity_a": outer_id, "point_a": 0,
            "entity_b": inner_id, "point_b": 0,
            "distance": thickness
        }).to_string());

        // Broadcast changes
        let changes = kernel.flush_changes();
        let _ = project.command_tx.send(BroadcastEvent {
            seq: 0,
            timestamp_ms: now_ms(),
            actor: Actor::System,
            command_json: format!("draw_wall({from_x},{from_y} -> {to_x},{to_y}, t={thickness})"),
            result: CommandResult { success: true, created_ids: created_ids.clone(), error: None, measurement: None },
            changes_json: changes,
        });

        json!({
            "success": true,
            "created_ids": created_ids,
            "wall": {
                "centerline": { "from": [from_x, from_y], "to": [to_x, to_y] },
                "thickness": thickness,
                "material": material,
                "outer_line": outer_id,
                "inner_line": inner_id,
                "layer": "WALLS"
            }
        }).to_string()
    }

    #[tool(description = "Place a structural column at a grid reference point. \
        Creates a rectangle representing the column cross-section on the COLUMNS layer. \
        Adds dimension annotations.")]
    async fn place_column(
        &self,
        #[tool(param, description = "Column center X")] x: f64,
        #[tool(param, description = "Column center Y")] y: f64,
        #[tool(param, description = "Column width (X dimension)")] width: f64,
        #[tool(param, description = "Column depth (Y dimension)")] depth: f64,
        #[tool(param, description = "Grid reference label, e.g. 'A1', 'B3'")] grid_ref: String,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition:
        // 1. Ensure COLUMNS layer exists
        // 2. Create rectangle centered at (x,y) with given width/depth
        // 3. Add text label with grid_ref above the column
        // 4. Add dimension annotation for width
        // Returns column entity ID and label entity ID

        // ... (similar pattern to draw_wall)
        todo!("Implementation follows draw_wall pattern")
    }

    #[tool(description = "Add a beam between two column positions. \
        Creates a filled rectangle on the BEAMS layer between the two points.")]
    async fn add_beam(
        &self,
        #[tool(param, description = "Start column entity ID or X coord")] from_x: f64,
        #[tool(param)] from_y: f64,
        #[tool(param, description = "End column entity ID or X coord")] to_x: f64,
        #[tool(param)] to_y: f64,
        #[tool(param, description = "Beam depth")] depth: f64,
        #[tool(param, description = "Beam width")] width: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition: Create rectangle oriented along beam axis
        // on BEAMS layer, add dimension for span
        todo!()
    }

    #[tool(description = "Add a door opening to an existing wall. \
        Breaks the wall at the specified position, creates door swing arc, \
        and adds dimension annotation.")]
    async fn add_door(
        &self,
        #[tool(param, description = "Wall outer line entity ID")] wall_id: String,
        #[tool(param, description = "Position along wall (0.0 = start, 1.0 = end)")] position: f64,
        #[tool(param, description = "Door width")] width: f64,
        #[tool(param, description = "Door height (for annotation only in 2D)")] height: f64,
        #[tool(param, description = "'left' or 'right' swing direction")] swing: String,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition:
        // 1. Get wall geometry, compute door insertion point
        // 2. Trim wall lines to create opening
        // 3. Draw door leaf (line at 90 degrees)
        // 4. Draw swing arc (quarter circle)
        // 5. Place on DOORS layer
        // 6. Add dimension for door width
        todo!()
    }

    #[tool(description = "Add a chain of dimensions along a set of entities. \
        Automatically measures distances between sequential points \
        and places dimension annotations at the specified offset.")]
    async fn add_dimension_chain(
        &self,
        #[tool(param, description = "Ordered list of entity IDs to dimension between")] entity_ids: Vec<String>,
        #[tool(param, description = "Offset distance for dimension line placement")] offset: f64,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition: For each pair of adjacent entities,
        // extract endpoint, create aligned dimension at offset
        todo!()
    }
}
```

### Tier 3 — Workflow Tools (Compound Operations)

```rust
// server/src/tools/workflows.rs

pub struct WorkflowTools {
    project_mgr: Arc<ProjectManager>,
    agent_runtime: Arc<AgentRuntime>,
}

#[tool_router]
impl WorkflowTools {
    #[tool(description = "Check structural column spacing against a building code. \
        Analyzes all entities on the COLUMNS layer, computes grid spacings, \
        and reports violations. Does NOT modify the drawing.")]
    async fn check_structural_spacing(
        &self,
        #[tool(param, description = "Building code: 'ACI-318', 'Eurocode-2', 'IS-456'")] standard: String,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition:
        // 1. Get all entities on COLUMNS layer
        // 2. Extract center points of all rectangles
        // 3. Compute pairwise distances (column grid)
        // 4. Look up max spacing from code table
        // 5. Flag any spacing > max
        // 6. Return structured report

        let project = self.project_mgr.get(&project_id.into()).await.unwrap();
        let kernel = project.kernel.read().await;
        let entities: Vec<serde_json::Value> =
            serde_json::from_str(&kernel.get_entities_json()).unwrap();

        let columns: Vec<_> = entities.iter()
            .filter(|e| e["layer_id"].as_str() == Some("COLUMNS"))
            .collect();

        let max_spacing = match standard.as_str() {
            "ACI-318" => 12.0,    // 12m typical max
            "Eurocode-2" => 10.0,
            "IS-456" => 8.0,
            _ => 10.0,
        };

        // ... spacing analysis logic ...

        json!({
            "success": true,
            "standard": standard,
            "column_count": columns.len(),
            "max_allowed_spacing": max_spacing,
            "violations": [],
            "report": "All column spacings within limits"
        }).to_string()
    }

    #[tool(description = "Calculate material quantities for entities on specified layers. \
        Returns total lengths, areas, and counts by entity type.")]
    async fn quantity_takeoff(
        &self,
        #[tool(param, description = "Layer IDs to include. Empty = all layers.")] layer_ids: Vec<String>,
        #[tool(param)] project_id: String,
    ) -> String {
        // Decomposition:
        // 1. Get entities (filtered by layer if specified)
        // 2. For lines: sum lengths
        // 3. For rectangles: sum areas
        // 4. For circles: sum areas (pi*r^2)
        // 5. Group by layer and entity type
        // 6. Return structured table
        todo!()
    }

    #[tool(description = "Invoke a specialized AI agent to generate a reinforcement detail \
        for a structural element. Creates the detail on a new DETAIL layer. \
        Returns the detail entity IDs for human review.")]
    async fn generate_reinforcement_detail(
        &self,
        #[tool(param, description = "Entity ID of the structural element (column, beam, slab)")] element_id: String,
        #[tool(param, description = "Design code")] standard: String,
        #[tool(param)] project_id: String,
    ) -> String {
        // This tool invokes ANOTHER agent (the DetailAgent)
        // Decomposition:
        // 1. Get element geometry and metadata
        // 2. Create a DETAIL-{element_id} layer
        // 3. Invoke DetailAgent with element context + code requirements
        // 4. DetailAgent creates rebar layout using Tier 1 tools
        // 5. Return detail IDs for review
        let result = self.agent_runtime.invoke_agent(
            AgentType::Detail,
            json!({
                "task": "generate_reinforcement_detail",
                "element_id": element_id,
                "standard": standard,
                "project_id": project_id,
            }),
        ).await;
        result.to_string()
    }
}
```

---

## Part 4 — Event Bus & Real-time Sync

### 4.1 — WebSocket Protocol

```rust
// server/src/ws.rs

use axum::extract::ws::{Message, WebSocket};
use tokio::sync::broadcast;

/// Messages FROM server TO browser client.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum ServerMessage {
    /// Initial state dump when client connects.
    Welcome {
        project_id: String,
        entities_json: String,
        layers_json: String,
        constraints_json: String,
        sessions: Vec<SessionInfo>,
    },

    /// Incremental update: entities changed.
    EntityChanges {
        seq: u64,
        actor: ActorSummary,
        changes: ChangeDelta,
        timestamp_ms: i64,
    },

    /// An agent started or stopped working.
    AgentStatus {
        agent_id: String,
        agent_type: String,
        status: AgentStatusKind,  // Active, Idle, WaitingConfirmation
    },

    /// Human confirmation required for a destructive agent action.
    ConfirmationRequest {
        token: String,
        agent_id: String,
        action: String,
        description: String,
        affected_entity_count: usize,
        expires_at: i64,
    },

    /// Workflow triggered.
    WorkflowEvent {
        workflow_id: String,
        step: String,
        status: String,
    },

    /// Error.
    Error {
        code: String,
        message: String,
    },
}

/// Messages FROM browser client TO server.
#[derive(Deserialize, Debug)]
#[serde(tag = "type")]
pub enum ClientMessage {
    /// Execute a kernel command.
    Command {
        id: String,       // client-generated correlation ID
        payload: serde_json::Value,
    },

    /// Confirm or deny an agent's destructive action.
    Confirmation {
        token: String,
        approved: bool,
    },

    /// Cursor position update (for collaborative cursors).
    CursorMove {
        x: f64,
        y: f64,
    },

    /// Selection changed.
    SelectionChanged {
        entity_ids: Vec<String>,
    },
}

#[derive(Serialize, Clone, Debug)]
pub struct ChangeDelta {
    pub upserted: Vec<serde_json::Value>,  // entities that were created or modified
    pub deleted: Vec<String>,               // entity IDs that were deleted
}

#[derive(Serialize, Clone, Debug)]
pub struct ActorSummary {
    pub kind: String,      // "human" or "agent"
    pub id: String,
    pub display_name: String,
}

/// Handle a WebSocket connection.
pub async fn handle_ws(
    ws: WebSocket,
    project: Arc<Project>,
    actor: Actor,
) {
    let (mut ws_tx, mut ws_rx) = ws.split();
    let mut broadcast_rx = project.command_tx.subscribe();

    // Send welcome with current state
    let kernel = project.kernel.read().await;
    let welcome = ServerMessage::Welcome {
        project_id: project.id.to_string(),
        entities_json: kernel.get_entities_json(),
        layers_json: kernel.get_layers_json(),
        constraints_json: kernel.get_constraints_json(),
        sessions: vec![],
    };
    drop(kernel);
    ws_tx.send(Message::Text(serde_json::to_string(&welcome).unwrap())).await.ok();

    loop {
        tokio::select! {
            // Forward broadcast events to this client
            Ok(event) = broadcast_rx.recv() => {
                // Don't echo back the client's own commands
                if event.actor_id() != actor.id() {
                    let msg = ServerMessage::EntityChanges {
                        seq: event.seq,
                        actor: event.actor.summary(),
                        changes: serde_json::from_str(&event.changes_json).unwrap(),
                        timestamp_ms: event.timestamp_ms,
                    };
                    ws_tx.send(Message::Text(serde_json::to_string(&msg).unwrap())).await.ok();
                }
            }

            // Handle messages from this client
            Some(Ok(msg)) = ws_rx.next() => {
                if let Message::Text(text) = msg {
                    if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                        match client_msg {
                            ClientMessage::Command { id, payload } => {
                                let envelope = CommandEnvelope {
                                    project_id: project.id.clone(),
                                    actor: actor.clone(),
                                    payload_json: payload.to_string(),
                                };
                                let result = project_mgr.execute(&project.id, envelope).await;
                                // Send result back to this client only
                                // (other clients get the broadcast)
                            }
                            ClientMessage::Confirmation { token, approved } => {
                                // Resolve pending agent confirmation
                            }
                            _ => {}
                        }
                    }
                }
            }

            else => break,
        }
    }
}
```

### 4.2 — Conflict Resolution

```rust
// server/src/conflict.rs

/// Conflict resolution strategy when human and AI edit the same entity.
///
/// Design principle: HUMAN ALWAYS WINS.
///
/// When conflict is detected:
/// 1. Human edit is applied immediately
/// 2. Agent's conflicting edit is rejected with a structured error
/// 3. Agent receives updated entity state and can retry
///
/// Conflict detection: entity-level optimistic locking via sequence numbers.

pub struct ConflictResolver;

impl ConflictResolver {
    /// Check if a command conflicts with recent edits.
    /// Returns Ok(()) if safe, Err(Conflict) if entity was modified
    /// since the actor last read it.
    pub fn check(
        &self,
        cmd: &Command,
        actor: &Actor,
        event_log: &EventLog,
    ) -> Result<(), Conflict> {
        let entity_ids = cmd.affected_entity_ids();
        let actor_last_seq = actor.last_observed_seq();

        for id in entity_ids {
            if let Some(last_modified_seq) = event_log.last_modification_seq(&id) {
                if last_modified_seq > actor_last_seq {
                    // Entity was modified after this actor last synced
                    let last_modifier = event_log.get_event(last_modified_seq)
                        .map(|e| e.actor.clone());

                    // If the modifier was a human and the current actor is an agent,
                    // the agent loses.
                    if matches!(actor, Actor::Agent { .. })
                        && matches!(last_modifier, Some(Actor::Human { .. }))
                    {
                        return Err(Conflict {
                            entity_id: id.clone(),
                            your_seq: actor_last_seq,
                            current_seq: last_modified_seq,
                            modified_by: last_modifier.unwrap(),
                            resolution: "Entity was modified by a human. \
                                         Re-read entity state and retry if needed.".into(),
                        });
                    }
                }
            }
        }
        Ok(())
    }
}

#[derive(Serialize, Debug)]
pub struct Conflict {
    pub entity_id: String,
    pub your_seq: u64,
    pub current_seq: u64,
    pub modified_by: Actor,
    pub resolution: String,
}
```

---

## Part 5 — Workflow Engine

### 5.1 — Workflow Definition Format

```yaml
# Workflows are stored as YAML (human-authored) or JSON (agent-authored).
# Location: project_dir/workflows/*.yaml

name: "Auto Reinforcement Detail"
id: "wf_auto_rebar"
description: "When a structural column is placed, generate reinforcement detail"
enabled: true

trigger:
  type: entity_created
  filter:
    layer_id: "COLUMNS"
    # Optional: geometry_type: "Rectangle"

steps:
  - id: "check_spacing"
    action: tool_call
    tool: "check_structural_spacing"
    params:
      standard: "ACI-318"
      project_id: "{{project_id}}"
    on_failure: stop

  - id: "generate_detail"
    action: agent_invoke
    agent_type: "Detail"
    prompt: |
      Generate a reinforcement detail for column {{trigger.entity_id}}
      per ACI-318 Section 10.7.
      Column dimensions: {{trigger.entity.geometry}}.
      Place the detail at offset (20, 0) from the column position.
    trust: Designer
    on_failure: notify

  - id: "notify_engineer"
    action: notify
    channel: "project"
    message: |
      Reinforcement detail generated for column {{trigger.entity_id}}.
      {{steps.check_spacing.violations.length}} spacing violations found.
      Review required before approval.
    severity: info

  - id: "await_approval"
    action: human_gate
    prompt: "Approve reinforcement detail for column {{trigger.entity_id}}?"
    timeout_minutes: 60
    on_timeout: notify
    on_approved: continue
    on_rejected: rollback
```

### 5.2 — Workflow Engine Core

```rust
// server/src/workflow/engine.rs

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkflowDef {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub trigger: Trigger,
    pub steps: Vec<Step>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum Trigger {
    /// Fire when an entity is created matching the filter.
    #[serde(rename = "entity_created")]
    EntityCreated { filter: EntityFilter },

    /// Fire when a constraint is violated.
    #[serde(rename = "constraint_violated")]
    ConstraintViolated { constraint_type: Option<String> },

    /// Fire on a cron schedule.
    #[serde(rename = "scheduled")]
    Scheduled { cron: String },

    /// Fire manually (via API or agent).
    #[serde(rename = "manual")]
    Manual,

    /// Fire when an AI agent requests it.
    #[serde(rename = "agent_initiated")]
    AgentInitiated { agent_type: Option<String> },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct EntityFilter {
    pub layer_id: Option<String>,
    pub geometry_type: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Step {
    pub id: String,
    pub action: StepAction,
    pub on_failure: FailurePolicy,
    pub condition: Option<String>,  // JS expression evaluated against context
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "action")]
pub enum StepAction {
    /// Call a registered tool (Tier 1, 2, or 3).
    #[serde(rename = "tool_call")]
    ToolCall {
        tool: String,
        params: HashMap<String, serde_json::Value>,
    },

    /// Invoke an AI agent with a prompt.
    #[serde(rename = "agent_invoke")]
    AgentInvoke {
        agent_type: String,
        prompt: String,
        trust: AgentTrust,
    },

    /// Send a notification.
    #[serde(rename = "notify")]
    Notify {
        channel: String,
        message: String,
        severity: String,
    },

    /// Wait for human approval.
    #[serde(rename = "human_gate")]
    HumanGate {
        prompt: String,
        timeout_minutes: u32,
        on_timeout: FailurePolicy,
        on_rejected: FailurePolicy,
    },

    /// Conditional branch.
    #[serde(rename = "branch")]
    Branch {
        condition: String,
        if_true: Vec<Step>,
        if_false: Vec<Step>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum FailurePolicy {
    #[serde(rename = "stop")]
    Stop,
    #[serde(rename = "continue")]
    Continue,
    #[serde(rename = "retry")]
    Retry { max_attempts: u32 },
    #[serde(rename = "notify")]
    Notify,
    #[serde(rename = "rollback")]
    Rollback,
}

/// The workflow engine evaluates triggers and executes step sequences.
pub struct WorkflowEngine {
    workflows: Arc<RwLock<Vec<WorkflowDef>>>,
    project_mgr: Arc<ProjectManager>,
    agent_runtime: Arc<AgentRuntime>,
}

impl WorkflowEngine {
    /// Called by ProjectManager after every event.
    pub async fn on_event(&self, event: &BroadcastEvent) {
        let workflows = self.workflows.read().await;

        for wf in workflows.iter().filter(|w| w.enabled) {
            if self.trigger_matches(&wf.trigger, event) {
                let wf = wf.clone();
                let ctx = WorkflowContext {
                    trigger_event: event.clone(),
                    step_results: HashMap::new(),
                };
                // Run workflow in background — don't block the command bus
                tokio::spawn(async move {
                    self.execute_workflow(wf, ctx).await;
                });
            }
        }
    }

    fn trigger_matches(&self, trigger: &Trigger, event: &BroadcastEvent) -> bool {
        match trigger {
            Trigger::EntityCreated { filter } => {
                // Check if event is an entity creation matching the filter
                let cmd: serde_json::Value =
                    serde_json::from_str(&event.command_json).unwrap_or_default();
                let cmd_type = cmd["type"].as_str().unwrap_or("");

                if !cmd_type.starts_with("Create") {
                    return false;
                }
                if let Some(ref layer) = filter.layer_id {
                    let cmd_layer = cmd["layer_id"].as_str().unwrap_or("");
                    if cmd_layer != layer {
                        return false;
                    }
                }
                true
            }
            _ => false,
        }
    }

    async fn execute_workflow(&self, wf: WorkflowDef, mut ctx: WorkflowContext) {
        for step in &wf.steps {
            // Check condition
            if let Some(ref cond) = step.condition {
                if !self.evaluate_condition(cond, &ctx) {
                    continue;
                }
            }

            let result = self.execute_step(step, &ctx).await;

            match result {
                Ok(output) => {
                    ctx.step_results.insert(step.id.clone(), output);
                }
                Err(e) => {
                    match step.on_failure {
                        FailurePolicy::Stop => break,
                        FailurePolicy::Continue => continue,
                        FailurePolicy::Retry { max_attempts } => {
                            // Retry logic
                        }
                        FailurePolicy::Notify => {
                            // Send failure notification
                        }
                        FailurePolicy::Rollback => {
                            // Undo all commands from this workflow run
                            break;
                        }
                    }
                }
            }
        }
    }
}
```

### 5.3 — Bidirectional Workflow-Agent Interaction

```rust
// Agents CAN create workflows (via a Tier 3 tool):

#[tool(description = "Create a new automated workflow. The workflow will trigger \
    on the specified event and execute the given steps. Workflows persist across sessions.")]
async fn create_workflow(
    &self,
    #[tool(param, description = "Workflow definition as JSON")] definition: String,
    #[tool(param)] project_id: String,
) -> String {
    let wf: WorkflowDef = serde_json::from_str(&definition)?;
    self.workflow_engine.register(wf).await;
    json!({ "success": true }).to_string()
}

// Workflows CAN invoke agents (via StepAction::AgentInvoke):
// See Step definition above — the agent_invoke action starts a Rig agent
// with the given prompt and trust level.
```

---

## Part 6 — Multi-Agent Orchestration

### 6.1 — Agent Definitions

```rust
// server/src/agents/mod.rs

use rig::prelude::*;

/// The agent runtime manages all AI agents and their interactions.
pub struct AgentRuntime {
    anthropic: rig::providers::anthropic::Client,
    project_mgr: Arc<ProjectManager>,
    tools: Arc<AllTools>,  // all three tiers combined
}

impl AgentRuntime {
    pub fn new(api_key: &str, project_mgr: Arc<ProjectManager>) -> Self {
        Self {
            anthropic: rig::providers::anthropic::Client::new(api_key),
            project_mgr,
            tools: Arc::new(AllTools::new()),
        }
    }

    /// Create a specialized agent.
    pub fn create_agent(&self, agent_type: AgentType, project_id: &ProjectId) -> Agent {
        let context = self.build_context(agent_type, project_id);

        match agent_type {
            AgentType::Drafting => {
                self.anthropic
                    .agent("claude-sonnet-4-20250514")
                    .preamble(&format!(
                        "You are a CAD drafting agent for NEXUS. \
                         You create and edit 2D geometry in engineering drawings.\n\n\
                         RULES:\n\
                         - Always call get_drawing_state first to understand context\n\
                         - Always call get_layers before creating entities\n\
                         - Create appropriate layers (WALLS, COLUMNS, BEAMS, etc.)\n\
                         - Add constraints to preserve design intent\n\
                         - Add dimensions to critical measurements\n\
                         - Place work on a DRAFT layer for review\n\n\
                         PROJECT CONTEXT:\n{context}"
                    ))
                    .tool(self.tools.primitives.clone())
                    .tool(self.tools.semantic.clone())
                    .build()
            }
            AgentType::Review => {
                self.anthropic
                    .agent("claude-sonnet-4-20250514")
                    .preamble(&format!(
                        "You are a drawing review agent. \
                         You check drawings against engineering standards and codes.\n\n\
                         RULES:\n\
                         - NEVER modify the drawing. Read-only operations only.\n\
                         - Report all findings as structured JSON.\n\
                         - Reference specific entity IDs in findings.\n\
                         - Cite the specific code clause for each violation.\n\n\
                         PROJECT CONTEXT:\n{context}"
                    ))
                    .tool(self.tools.queries.clone())
                    .tool(self.tools.workflow_tools.clone())
                    .build()
            }
            AgentType::Quantity => {
                self.anthropic
                    .agent("claude-haiku-4-5-20251001")  // fast + cheap for calculations
                    .preamble("You are a quantity takeoff agent. \
                         Calculate material quantities from drawing geometry.")
                    .tool(self.tools.queries.clone())
                    .build()
            }
            AgentType::Detail => {
                self.anthropic
                    .agent("claude-sonnet-4-20250514")
                    .preamble(&format!(
                        "You are a structural detailing agent. \
                         You generate reinforcement details, connection details, \
                         and fabrication drawings from schematic structural elements.\n\n\
                         PROJECT CONTEXT:\n{context}"
                    ))
                    .tool(self.tools.primitives.clone())
                    .tool(self.tools.semantic.clone())
                    .build()
            }
            AgentType::Chat => {
                self.anthropic
                    .agent("claude-sonnet-4-20250514")
                    .preamble(&format!(
                        "You are a helpful assistant for NEXUS CAD. \
                         Answer questions about the current drawing, \
                         explain design decisions, and help the user navigate.\n\n\
                         PROJECT CONTEXT:\n{context}"
                    ))
                    .tool(self.tools.queries.clone())
                    .build()
            }
            AgentType::Custom(ref name) => {
                // Dynamic agent with all tools
                self.anthropic
                    .agent("claude-sonnet-4-20250514")
                    .preamble(&format!("Custom agent: {name}\n\nPROJECT CONTEXT:\n{context}"))
                    .tool(self.tools.all.clone())
                    .build()
            }
        }
    }

    /// Invoke an agent for a specific task.
    pub async fn invoke_agent(
        &self,
        agent_type: AgentType,
        input: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let project_id = input["project_id"].as_str().unwrap();
        let agent = self.create_agent(agent_type, &project_id.into());
        let prompt = input["prompt"].as_str()
            .or_else(|| input["task"].as_str())
            .unwrap_or("Execute the given task.");

        let response = agent.prompt(prompt).await?;
        Ok(json!({ "response": response }))
    }
}
```

### 6.2 — Agent Communication

```rust
// Agents communicate through the shared project state.
//
// Design principle: agents do NOT call each other directly.
// Instead:
//   1. Agent A modifies drawing state (creates entities, adds annotations)
//   2. The broadcast event reaches all other connected agents
//   3. Agent B reads updated state and reacts
//
// For explicit agent-to-agent delegation, use workflows:
//   - Agent A calls create_workflow or invoke_agent tool
//   - The workflow engine manages the handoff
//   - Each agent maintains its own context and trust level
//
// Conflict arbitration:
//   - If two agents try to modify the same entity, the first one wins
//     (optimistic locking via sequence numbers)
//   - The losing agent gets a Conflict error and must re-read state
//   - Human edits ALWAYS override agent edits (see ConflictResolver)

/// Example: Drafting Agent creates a column, Review Agent checks it.
///
/// 1. User: "Place columns on a 6m grid, 3x4 bays"
/// 2. DraftingAgent:
///    - Calls create_layer("COLUMNS", "#ff0000")
///    - Calls place_column(0,0,...) through place_column(18,24,...)
///    - Calls add_dimension_chain([...])
/// 3. Broadcast: 12 entity_created events propagate
/// 4. Auto-workflow triggers (trigger: entity_created, layer: COLUMNS)
/// 5. ReviewAgent invoked by workflow:
///    - Calls check_structural_spacing("ACI-318")
///    - Reports: "All spacings within ACI-318 limits"
/// 6. WorkflowEngine sends notification to human
/// 7. Human reviews on DRAFT layer, approves
```

---

## Part 7 — Memory & Context Management

```rust
// server/src/context.rs

/// Context builder — assembles the right context for an AI agent
/// without exceeding token limits.
pub struct ContextBuilder {
    max_tokens: usize,   // target context size
}

impl ContextBuilder {
    /// Build context for an agent, prioritized by relevance.
    pub async fn build(
        &self,
        project: &Project,
        agent_type: &AgentType,
        focus: Option<&ContextFocus>,
    ) -> String {
        let mut sections = Vec::new();
        let mut token_budget = self.max_tokens;

        // Priority 1: Project metadata (always included, ~200 tokens)
        sections.push(self.project_summary(project).await);
        token_budget -= 200;

        // Priority 2: Layer summary (~100 tokens)
        sections.push(self.layer_summary(project).await);
        token_budget -= 100;

        // Priority 3: Active violations (~variable)
        let violations = self.violations(project).await;
        if !violations.is_empty() {
            sections.push(format!("VIOLATIONS:\n{violations}"));
            token_budget -= estimate_tokens(&violations);
        }

        // Priority 4: Recent commands (~500 tokens for last 20)
        sections.push(self.recent_commands(project, 20).await);
        token_budget -= 500;

        // Priority 5: Focused context (entities near viewport or selection)
        if let Some(focus) = focus {
            let focused = self.focused_entities(project, focus, token_budget / 2).await;
            sections.push(focused);
        }

        // Priority 6: Full entity dump (if budget allows, for small drawings)
        let kernel = project.kernel.read().await;
        if kernel.entity_count() < 100 && token_budget > 2000 {
            sections.push(format!("ALL ENTITIES:\n{}", kernel.get_entities_json()));
        } else {
            sections.push(format!(
                "ENTITY COUNT: {} (use get_entities tool for full data)",
                kernel.entity_count()
            ));
        }

        sections.join("\n\n---\n\n")
    }
}

/// What the agent should focus on.
pub enum ContextFocus {
    /// Human's current viewport.
    Viewport { min_x: f64, min_y: f64, max_x: f64, max_y: f64 },
    /// Currently selected entities.
    Selection { entity_ids: Vec<String> },
    /// A specific layer.
    Layer { layer_id: String },
    /// A specific area of the drawing.
    Region { center_x: f64, center_y: f64, radius: f64 },
}

/// Agent memory — persisted per agent per project.
#[derive(Serialize, Deserialize)]
pub struct AgentMemory {
    pub agent_id: String,
    pub project_id: String,
    pub conversation_history: Vec<ConversationTurn>,
    pub learned_preferences: HashMap<String, String>,
    pub design_decisions: Vec<DesignDecision>,
}

#[derive(Serialize, Deserialize)]
pub struct DesignDecision {
    pub timestamp: i64,
    pub decision: String,
    pub rationale: String,
    pub entity_ids: Vec<String>,
    pub approved_by: Option<String>,
}
```

---

## Part 8 — Data Architecture

```
Storage Layer (all SQLite — single-file, embedded, no external service)
│
├── data/projects.db
│   ├── projects (id, name, units, standards, created_at, updated_at)
│   ├── project_entities (project_id, entity_json)      -- current state snapshot
│   └── project_meta (project_id, key, value)
│
├── data/events.db
│   ├── events (seq, project_id, timestamp_ms, actor_json, command_json, result_json)
│   │   -- append-only, indexed by (project_id, seq)
│   │   -- this is the source of truth; entity snapshots are derived
│   └── event_cursors (session_id, project_id, last_seq)
│
├── data/agents.db
│   ├── agent_memory (agent_id, project_id, memory_json)
│   ├── conversations (id, agent_id, project_id, turns_json, created_at)
│   └── design_decisions (id, project_id, decision, rationale, entity_ids, approved_by)
│
├── data/workflows.db
│   ├── workflow_defs (id, project_id, definition_yaml, enabled, created_at)
│   ├── workflow_runs (id, workflow_id, trigger_event_seq, status, started_at, completed_at)
│   └── workflow_step_results (run_id, step_id, output_json, status, duration_ms)
│
└── data/users.db
    ├── users (id, name, email, role)
    ├── sessions (id, user_id, project_id, connected_at, last_active)
    └── api_keys (id, user_id, key_hash, trust_level, created_at, expires_at)
```

**Why SQLite:** Single binary deployment, zero ops, excellent Rust support (`rusqlite`), handles 100k+ writes/sec which exceeds any realistic CAD command rate. For offline-first job site usage, there's no external database to fail.

**Why separate databases:** Isolation. The event log (`events.db`) is append-only and can grow large; keeping it separate means project metadata queries stay fast. Agent memory is orthogonal to drawing data.

---

## Part 9 — API Surface

### External Endpoints (Axum router)

```rust
// server/src/router.rs

pub fn build_router(state: AppState) -> Router {
    Router::new()
        // --- REST API ---
        .route("/api/projects",          get(list_projects).post(create_project))
        .route("/api/projects/:id",      get(get_project).delete(delete_project))
        .route("/api/projects/:id/entities", get(get_entities))
        .route("/api/projects/:id/entities/:eid", get(get_entity))
        .route("/api/projects/:id/layers", get(get_layers))
        .route("/api/projects/:id/constraints", get(get_constraints))
        .route("/api/projects/:id/events", get(get_events))  // query params: from_seq, limit
        .route("/api/projects/:id/command", post(execute_command))

        // --- WebSocket ---
        .route("/ws/:project_id", get(ws_upgrade))

        // --- MCP (rmcp transport) ---
        .route("/mcp/sse", get(mcp_sse_handler))     // SSE transport for MCP
        .route("/mcp/message", post(mcp_message_handler))

        // --- Agent endpoints ---
        .route("/api/agents/invoke", post(invoke_agent))
        .route("/api/agents/status",  get(list_active_agents))

        // --- Workflow endpoints ---
        .route("/api/workflows",      get(list_workflows).post(create_workflow))
        .route("/api/workflows/:id",  get(get_workflow).put(update_workflow).delete(delete_workflow))
        .route("/api/workflows/:id/trigger", post(trigger_workflow))
        .route("/api/workflows/:id/runs",    get(list_workflow_runs))

        // --- Export ---
        .route("/api/projects/:id/export/dxf", get(export_dxf))
        .route("/api/projects/:id/export/json", get(export_json))

        // --- Webhooks ---
        .route("/hooks/:hook_id", post(webhook_handler))

        .with_state(state)
}
```

### Internal API (kernel <-> server)

```rust
// The server calls the kernel as a native Rust library.
// No serialization overhead for internal calls.

// Direct Rust calls (fastest path, used for bulk operations):
let kernel = project.kernel.write().await;
let id = kernel.create_line(0.0, 0.0, 100.0, 50.0, "layer_0");
let ok = kernel.move_entity("ent_1", 10.0, 20.0);

// JSON command path (used for commands from external sources):
let result_json = kernel.execute_command(&command_json);

// Query path (always JSON — kernel returns serialized data):
let entities = kernel.get_entities_json();
let layers = kernel.get_layers_json();

// Atomic multi-command transactions:
// The kernel doesn't have built-in transactions, so the server wraps them:
impl Project {
    /// Execute multiple commands atomically.
    /// If any fails, undo all previous commands in this batch.
    pub async fn execute_batch(
        &self,
        commands: Vec<String>,
        actor: Actor,
    ) -> Result<Vec<CommandResult>> {
        let mut kernel = self.kernel.write().await;
        let mut results = Vec::new();
        let undo_count = 0;

        for cmd_json in &commands {
            let result_json = kernel.execute_command(cmd_json);
            let result: CommandResult = serde_json::from_str(&result_json)?;

            if !result.success {
                // Rollback: undo all commands in this batch
                for _ in 0..undo_count {
                    kernel.undo();
                }
                return Err(anyhow!("Batch failed at command {}: {:?}",
                    undo_count, result.error));
            }

            results.push(result);
            undo_count += 1;
        }

        Ok(results)
    }
}
```

---

## Part 10 — Implementation Roadmap

### Phase 1 — MVP: "AI draws a floor plan from text" (4 weeks)

**Goal:** User types "draw a 3-bedroom apartment" → AI creates geometry in the browser.

| Week | Component | Effort | Details |
|------|-----------|--------|---------|
| 1 | Cargo workspace + kernel linking | S | Create `server/` crate, depend on `nexus-kernel` as `rlib`, verify native compilation. Axum skeleton with health endpoint. |
| 1 | SQLite persistence | S | `rusqlite` schema for projects and events. Load/save project state. |
| 2 | MCP server via rmcp | M | Implement `#[tool_router]` for 15 core Tier 1 tools (create, edit, query). Test with Claude Desktop. |
| 2 | WebSocket basic sync | M | Single project, single client. Forward kernel changes to browser. Modify SvelteKit frontend to connect to server WS instead of local WASM. |
| 3 | Agent runtime (Rig) | M | DraftingAgent with Claude Sonnet. System prompt with drawing context. Connect to MCP tools. |
| 3 | REST endpoint for agent invoke | S | `POST /api/agents/invoke` → runs DraftingAgent → returns result. |
| 4 | End-to-end integration | M | Browser → WS → server → agent → kernel → WS → browser. Test: "draw a floor plan with 3 rooms". |
| 4 | Draft layer system | S | Agent creates on DRAFT layer, human sees differentiated entities. Accept/discard via WS message. |

**Deliverable:** Demo video — user types prompt, AI creates floor plan, entities appear in real-time on the collaborative canvas.

**Dependencies:** Anthropic API key, rmcp v1.4+, rig-core v0.35+
**Risks:** rmcp `#[tool_router]` macro limitations (mitigation: fall back to manual tool registration). Rig's Claude provider compatibility (mitigation: well-tested, 6.9k stars).

### Phase 2 — Collaboration: "Human and AI work together" (4 weeks)

| Week | Component | Effort | Details |
|------|-----------|--------|---------|
| 5 | Multi-session WebSocket | M | Multiple browser clients + multiple agents on same project. Session management, broadcast fan-out. |
| 5 | Conflict resolution | M | Sequence-based optimistic locking. Human-wins policy. Agent retry on conflict. |
| 6 | Trust system | S | `AgentTrust` enum enforced on command execution. Confirmation gates for destructive ops. |
| 6 | Collaborative cursors | S | Broadcast cursor positions between clients. Show "Agent is working..." indicator. |
| 7 | Context builder | M | Smart context assembly for agents. Viewport-aware, selection-aware. Token budget management. |
| 7 | Agent memory persistence | S | SQLite storage for conversation history and design decisions. |
| 8 | Chat agent | S | ChatAgent answers questions about the drawing. Integrated into command palette. |
| 8 | Review agent | M | ReviewAgent checks drawing against basic rules (spacing, alignment). Returns structured findings. |

**Deliverable:** Two browser windows open on same project. Human draws walls in one, AI adds dimensions in the other, both see each other's changes in real-time.

**Risks:** WebSocket scaling under high command rates (mitigation: debounce cursor updates, batch entity changes). Context window limits with large drawings (mitigation: spatial filtering, entity summarization).

### Phase 3 — Workflows: "Automated checking and detailing" (4 weeks)

| Week | Component | Effort | Details |
|------|-----------|--------|---------|
| 9 | Workflow engine core | M | Trigger evaluation, step execution, failure policies. |
| 9 | YAML workflow parser | S | Parse workflow definitions from YAML files. |
| 10 | Tier 2 semantic tools | L | `draw_wall`, `place_column`, `add_beam`, `add_door`. Full decomposition to Tier 1 commands. |
| 10 | Tier 3 workflow tools | M | `check_structural_spacing`, `quantity_takeoff`. |
| 11 | Agent-workflow integration | M | Agents can create workflows. Workflows can invoke agents. Bidirectional. |
| 11 | Human gate UI | S | Browser shows approval requests from workflows. Accept/reject propagates back. |
| 12 | Workflow dashboard | M | List active workflows, view run history, enable/disable. REST API + simple UI. |
| 12 | DetailAgent | M | Structural detailing agent. Generates rebar layouts from column/beam geometry. |

**Deliverable:** User places a column → workflow automatically checks spacing, generates reinforcement detail, sends for review. Zero manual steps.

**Risks:** Workflow reliability (mitigation: step-level persistence, retry policies). Semantic tool accuracy for complex geometry (mitigation: extensive test cases, validation after each decomposition step).

### Phase 4 — Production: "Civil engineering firm uses this daily" (4 weeks)

| Week | Component | Effort | Details |
|------|-----------|--------|---------|
| 13 | Auth + multi-user | M | User accounts, API keys, role-based access. JWT tokens for WS auth. |
| 13 | Offline-first sync | L | Local SQLite + change log. Sync when connectivity returns. Conflict merge. |
| 14 | DXF/PDF export from server | M | Server-side DXF export (kernel already supports it). PDF via `printpdf` crate. |
| 14 | Project templates | S | Predefined workflows + layer setups for common project types (structural, site, road). |
| 15 | RAG over project documents | L | Index project PDFs (specs, codes) into vector store. Agents query relevant code clauses. |
| 15 | Performance hardening | M | Connection pooling, kernel instance limits, memory caps, graceful shutdown. |
| 16 | Deployment packaging | S | Single binary builds for Linux/macOS/Windows. Docker image for team servers. Systemd unit file. |
| 16 | Monitoring + logging | S | Structured logging (`tracing` crate), health endpoints, basic metrics. |

**Deliverable:** Self-hostable server running on a firm's local network. Engineers connect via browser, AI agents assist with drafting/review/quantities. Works offline on laptop at job site.

**Risks:** Offline sync complexity (mitigation: event-sourced design makes merge semantically meaningful — replay events in order). PDF generation quality (mitigation: use `typst` for complex layout, `printpdf` for simple geometry).

---

## Part 11 — Cargo Workspace Layout

```
nexus/
├── Cargo.toml              ← workspace root
├── packages/
│   └── kernel/
│       ├── Cargo.toml      ← crate-type = ["cdylib", "rlib"]
│       └── src/
│           ├── lib.rs
│           ├── entity.rs
│           ├── commands.rs
│           ├── events.rs
│           ├── constraints.rs
│           └── tolerance.rs
│
├── server/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs              ← entry point: starts Axum server
│       ├── config.rs            ← CLI args, env vars, config file
│       ├── router.rs            ← Axum route definitions
│       ├── project.rs           ← Project + ProjectManager
│       ├── session.rs           ← Session + Actor types
│       ├── trust.rs             ← AgentTrust + permission checks
│       ├── conflict.rs          ← ConflictResolver
│       ├── ws.rs                ← WebSocket handler
│       ├── db/
│       │   ├── mod.rs
│       │   ├── projects.rs      ← project CRUD
│       │   ├── events.rs        ← append-only event log
│       │   ├── agents.rs        ← agent memory storage
│       │   └── workflows.rs     ← workflow definitions + runs
│       ├── tools/
│       │   ├── mod.rs
│       │   ├── primitives.rs    ← Tier 1: 1:1 kernel command mapping
│       │   ├── semantic.rs      ← Tier 2: civil engineering domain
│       │   └── workflows.rs     ← Tier 3: compound operations
│       ├── agents/
│       │   ├── mod.rs           ← AgentRuntime
│       │   ├── context.rs       ← ContextBuilder
│       │   ├── drafting.rs      ← DraftingAgent config
│       │   ├── review.rs        ← ReviewAgent config
│       │   ├── quantity.rs      ← QuantityAgent config
│       │   ├── detail.rs        ← DetailAgent config
│       │   └── chat.rs          ← ChatAgent config
│       └── workflow/
│           ├── mod.rs
│           ├── engine.rs        ← WorkflowEngine
│           ├── triggers.rs      ← Trigger evaluation
│           └── steps.rs         ← Step execution
│
└── crates/
    └── nexus-common/
        ├── Cargo.toml
        └── src/
            └── lib.rs           ← shared types (ProjectId, etc.)
```

### Workspace Cargo.toml

```toml
[workspace]
resolver = "2"
members = [
    "packages/kernel",
    "server",
    "crates/nexus-common",
]

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
axum = { version = "0.7", features = ["ws"] }
rmcp = { version = "1.4", features = ["server", "transport-sse-server"] }
rig-core = "0.35"
rusqlite = { version = "0.32", features = ["bundled"] }
tracing = "0.1"
tracing-subscriber = "0.3"
anyhow = "1"
uuid = { version = "1", features = ["v7"] }
```

### Server Cargo.toml

```toml
[package]
name = "nexus-server"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "nexus-server"
path = "src/main.rs"

[dependencies]
nexus-kernel = { path = "../packages/kernel" }
nexus-common = { path = "../crates/nexus-common" }
serde.workspace = true
serde_json.workspace = true
tokio.workspace = true
axum.workspace = true
rmcp.workspace = true
rig-core.workspace = true
rusqlite.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
anyhow.workspace = true
uuid.workspace = true
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }
```

---

## Part 12 — Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **rmcp `#[tool_router]` doesn't support our arg types** | Medium | Fall back to manual `ToolDefinition` construction. The macro is convenience, not a requirement. |
| **Rig's Anthropic provider breaks on update** | Low | Pin version. Rig is actively maintained (daily commits as of 2026-04-14). |
| **Kernel panics crash the server** | High | Wrap all kernel calls in `std::panic::catch_unwind`. Log panic, return error, keep server alive. |
| **Large drawings exceed AI context window** | Medium | ContextBuilder with token budgets. Spatial filtering (only send entities near viewport). Entity summarization for far-away geometry. |
| **WebSocket message storms from busy agents** | Medium | Debounce entity changes: batch updates into 100ms windows. Agents rate-limited to 10 commands/sec. |
| **Offline sync conflicts** | High | Event-sourced design: merge = interleave events by timestamp, re-resolve conflicts. Most CAD edits are spatially disjoint (different parts of drawing), so real conflicts are rare. |
| **SQLite concurrent write contention** | Low | WAL mode handles concurrent reads. Serialize writes through `RwLock<Kernel>` per project — already single-writer by design. |
| **Agent hallucinates invalid geometry** | Medium | Geometric validation layer (Priority 3 from AI-readiness audit). Draft layer pattern — all agent geometry goes to review before promotion. |

---

*Previous: 12-application-shell.md*
*Next: 14-deployment.md (TBD)*
*Series: Architecture documentation*
