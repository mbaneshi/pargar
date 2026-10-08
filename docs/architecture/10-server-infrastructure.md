# NEXUS Server-Side Infrastructure Plan

> Solo founder, GCP-native. Client is Svelte 5 + Rust/WASM. All geometry runs in WASM on client. This document covers everything around that.

---

## Architecture Principle: The Thin Server

NEXUS is not Figma. Figma runs its rendering engine on the server and streams pixels. NEXUS runs the geometry kernel on the client in WASM. The server's job is narrower:

1. Authenticate users and AI agents
2. Store and sync document state
3. Relay collaboration messages between clients
4. Run jobs the client can't handle (large file conversion, AI orchestration, server-side export)
5. Serve static assets (WASM binaries, JS bundles, GIS tiles)

Everything else happens in the browser. This is a feature, not a limitation — it means the server can be cheap, stateless, and horizontally scalable from day one.

---

## Layer 1: Identity & Access

### What it does
User accounts, org/team structure, roles, permissions, session management. AI agents authenticate as service principals with scoped permissions (can draw, cannot delete layers).

### MVP (<100 users)

**Service:** Firebase Authentication (free tier: 50k MAU)

Firebase Auth handles email/password, Google OAuth, magic links, and session tokens. It's zero-ops, runs on GCP, and gives you JWT tokens that Cloud Run services can verify without a database call.

**What to build:**
- Firebase Auth for user identity
- Firestore `users` collection for profile data (display name, org, role)
- Firestore `projects` collection with `owner_id` and `collaborator_ids` fields
- Simple role model: `owner`, `editor`, `viewer`
- AI agents get service account JWTs with custom claims (`role: "agent"`, `scopes: ["draw", "query"]`)

**What NOT to build:**
- No SAML/SSO (enterprise feature, defer)
- No seat-based licensing (charge per-project or usage-based initially)
- No org hierarchy (flat user → project model is enough)

### At Scale (10k+ users, enterprise)

- Migrate to **WorkOS** or **Auth0** for SAML, SCIM directory sync, enterprise SSO
- Add org/team hierarchy in Cloud SQL (PostgreSQL)
- Row-level security via PostgREST or Supabase
- Audit log for all auth events (Challenge 6: Trust)
- AI agent permission model: per-project scoped tokens with operation allowlists

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Firebase Auth | Primary | Federated with WorkOS |
| Firestore | User/project metadata | Migrate to Cloud SQL |
| Secret Manager | API keys, agent tokens | Same + rotation policies |

### Cost
- **MVP:** $0/month (Firebase free tier covers 50k MAU)
- **Scale:** ~$55/month per 10k MAU (WorkOS/Auth0) + Cloud SQL $30/month

### Challenges addressed
- **Challenge 6 (Trust):** JWT-signed sessions, audit trail on auth events
- **Challenge 5 (Plugins):** Agent/plugin auth uses same token system with scoped permissions

---

## Layer 2: Real-Time Collaboration

### What it does
Multiple users editing the same document simultaneously. Cursor presence, live selection highlight, follow mode. Conflict resolution when two users modify the same entity.

### The Hard Problem

CAD collaboration is fundamentally harder than text/design collaboration:
- Geometric operations are order-dependent (move then rotate ≠ rotate then move)
- A boolean operation that fails due to numerical tolerance can't be "merged" — it must be retried
- Entity relationships (constraints, BIM hierarchy) create non-local dependencies

The Yjs research finding (#07) established: **Yjs should be the authoritative state store, not a sync layer bolted onto event sourcing.** The event log becomes a derived audit trail, not the source of truth for collaboration.

### MVP (<100 users)

**Service:** Yjs + y-websocket on Cloud Run

The simplest collaboration setup that works:

```
Client A (Yjs Doc) ←──WebSocket──→ y-websocket server (Cloud Run) ←──WebSocket──→ Client B (Yjs Doc)
                                          ↓
                                   Cloud Storage (persistence)
```

**What to build:**
- `y-websocket` server deployed on Cloud Run (min-instances: 0, max: 5)
- Each NEXUS document = one Yjs `Y.Doc`
- Entity data stored as `Y.Map` entries (flat keys per property, NOT nested JSON — per finding #07)
- Persistence provider: save Yjs document updates to Cloud Storage every 30 seconds
- Awareness protocol for cursor positions and selections
- Client-side: Yjs UndoManager for per-user undo (NOT global cursor)

**Architecture decision: Y.Map per entity, flat keys**
```
// NOT this (nested blob — poor conflict resolution):
doc.getMap('entities').set('ent_1', { geometry: { type: 'Line', start: {x:0,y:0}, ... } })

// THIS (flat keys — surgical merges):
doc.getMap('ent_1').set('geometry_type', 'Line')
doc.getMap('ent_1').set('start_x', 0)
doc.getMap('ent_1').set('start_y', 0)
doc.getMap('ent_1').set('end_x', 10)
doc.getMap('ent_1').set('end_y', 5)
doc.getMap('ent_1').set('layer_id', 'layer_0')
```

This way, two users can edit different properties of the same entity without conflict.

**Cloud Run WebSocket caveat:** Cloud Run supports WebSockets but bills for connection duration. A user connected for 1 hour at 1 vCPU = ~$0.086. For 10 concurrent users, 8 hours/day = ~$21/month. Acceptable at MVP.

**What NOT to build:**
- No server-side conflict resolution for geometry (let Yjs handle it — geometric validity is checked client-side after merge)
- No operational transform (Yjs CRDTs eliminate the need)
- No multi-region relay (single region is fine for MVP)

### At Scale (10k+ users, enterprise)

- **Hocuspocus** (Yjs server framework) on GKE for connection pooling and auth middleware
- **Redis (Memorystore)** for cross-instance awareness state and document routing
- **Cloud Pub/Sub** for relaying updates between server instances when a document has clients on different pods
- Multi-region deployment with regional document affinity
- Server-side geometry validation: after Yjs merge, run a lightweight validation pass (are constraints still satisfied? any degenerate geometry?)

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Cloud Run | y-websocket server | Hocuspocus on GKE |
| Cloud Storage | Yjs doc persistence | Same + tiered storage |
| Memorystore (Redis) | — | Cross-instance awareness |
| Cloud Pub/Sub | — | Update relay between pods |

### Cost
- **MVP:** ~$25/month (Cloud Run instances for WebSocket, Cloud Storage)
- **Scale:** ~$200-500/month (GKE pods + Redis + Pub/Sub, scales with concurrent editors)

### Challenges addressed
- **Challenge 1 (Numerical Stability):** Server-side validation after merge catches degenerate geometry before it propagates
- **Challenge 3 (Concurrency):** Yjs handles concurrent edits. Server is message-relay, not computation
- **Challenge 4 (User Expectations):** Sub-100ms collaboration latency target within same region

---

## Layer 3: File & Project Management

### What it does
Create/open/save projects, version history, branching (conceptual), import/export (DXF, IFC, DWG), file organization.

### MVP (<100 users)

**Service:** Firestore (metadata) + Cloud Storage (file blobs)

```
Firestore:
  projects/{projectId}
    name, owner_id, created_at, updated_at
    collaborators: [userId, ...]
    current_version: 42
    format_version: 1

  projects/{projectId}/versions/{versionId}
    seq: 42
    timestamp, actor, description
    snapshot_url: "gs://nexus-snapshots/{projectId}/v42.bin"
    event_count: 1247
```

```
Cloud Storage:
  nexus-documents/
    {projectId}/yjs-state.bin          ← live Yjs document state
  nexus-snapshots/
    {projectId}/v42.bin                ← periodic full snapshots
  nexus-events/
    {projectId}/events-0001.jsonl      ← append-only event log (derived from Yjs)
  nexus-exports/
    {projectId}/export-{timestamp}.dxf ← generated exports
  nexus-imports/
    {uploadId}/original.dxf           ← uploaded files awaiting processing
```

**What to build:**
- Project CRUD via Cloud Run API
- Auto-save: Yjs persistence provider writes to Cloud Storage every 30 seconds
- Version snapshots: every N operations or on explicit "Save Version," snapshot full state
- Event log: derived from Yjs updates, written as append-only JSONL to Cloud Storage (Challenge 6: audit trail)
- Import: upload DXF → Cloud Storage → Cloud Run job parses → writes entities to Yjs doc
- Export: Cloud Run job reads Yjs doc → generates DXF/PDF → stores in Cloud Storage → returns signed URL

**What NOT to build:**
- No branching/merging (defer to post-v0.1 — this is enormously complex for geometry)
- No DWG support (proprietary format, evaluate libredwg later)
- No real-time file browser (simple list is enough)

### At Scale (10k+ users, enterprise)

- Cloud SQL (PostgreSQL) for project metadata with full-text search
- Cloud Storage lifecycle policies: move old snapshots to Nearline after 90 days
- BigQuery for event log analytics ("which AI agent made the most edits last month?")
- Cloud Tasks for async import/export queue with retries
- Signed URLs with expiry for all file access (security)

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Firestore | Project metadata | Cloud SQL (PostgreSQL) |
| Cloud Storage | Documents, snapshots, exports | Same + lifecycle policies |
| Cloud Run | Import/export jobs | Cloud Tasks queue + Cloud Run workers |
| BigQuery | — | Event log analytics |

### Cost
- **MVP:** ~$5/month (Firestore free tier + Cloud Storage at low volume)
- **Scale:** ~$100-300/month (Cloud SQL + Storage + BigQuery)

### Challenges addressed
- **Challenge 6 (Trust):** Append-only event log = tamper-evident audit trail. Every version is a snapshot that can be restored.
- **Challenge 2 (Memory):** Large files (point clouds, BIM) stored server-side, streamed to client on demand — never loaded entirely into browser memory

---

## Layer 4: Storage & Persistence

### What it does
The data layer underlying everything: where entities live, how they're serialized, how large assets (GIS tiles, point clouds, textures) are stored and served.

### Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│   OPFS Cache ←→ Yjs Y.Doc ←→ Rust/WASM Kernel (ECS World)     │
│       ↓              ↓                                          │
│   Offline work   WebSocket sync                                 │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (GCP)                                │
│                                                                  │
│   y-websocket ──→ Cloud Storage (Yjs state)                     │
│                ──→ Cloud Storage (event log JSONL)               │
│                ──→ Cloud Storage (snapshots)                     │
│                                                                  │
│   Asset API ────→ Cloud Storage (GIS tiles, point clouds)       │
│                ──→ Cloud CDN (cached delivery)                   │
└──────────────────────────────────────────────────────────────────┘
```

### Data Format Strategy

**Live document state:** Yjs binary encoding (compact, CRDT-native). This is the source of truth during collaboration.

**Snapshots:** Full ECS world state serialized as FlatBuffers binary (defined in `docs/schemas/uses.fbs`). Used for fast cold-start loading — deserialize directly into WASM memory without JSON parsing overhead.

**Event log:** JSONL (one `EventEnvelope` per line). Human-readable, appendable, greppable. Each line has seq, timestamp, actor, schema_version, payload. This is the audit trail, not the collaboration state.

**Assets:** Stored as-is in Cloud Storage with content-type metadata. GIS tiles in PMTiles format (single-file, HTTP range request compatible — no tile server needed). Point clouds in COPC format (Cloud-Optimized Point Cloud — also range-request compatible).

### MVP (<100 users)

**What to build:**
- OPFS on client for offline cache (already implemented)
- Yjs → Cloud Storage persistence (part of Layer 2)
- FlatBuffer snapshot generation on explicit "Save Version"
- Event log writer: subscribe to Yjs updates, convert to EventEnvelope, append to JSONL file

**What NOT to build:**
- No custom tile server (PMTiles + Cloud CDN handles GIS tiles)
- No point cloud server (COPC + range requests handles it)
- No data warehouse (event JSONL in Cloud Storage is queryable via BigQuery external tables when needed)

### At Scale

- Cloud Storage with Object Versioning enabled (immutable audit trail for compliance)
- Cloud CDN in front of all asset buckets
- Customer-managed encryption keys (CMEK) for enterprise (Challenge 6)
- Data residency: regional buckets for government/infrastructure projects
- Nearline/Coldline lifecycle for old snapshots and event logs

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Cloud Storage | All persistent data | Same + lifecycle + CMEK |
| Cloud CDN | — | Asset delivery, WASM binary caching |
| OPFS (client) | Offline cache | Same |

### Cost
- **MVP:** ~$2/month (minimal storage, no CDN)
- **Scale:** ~$50-200/month (scales with data volume and CDN egress)

### Challenges addressed
- **Challenge 2 (Memory):** PMTiles and COPC use HTTP range requests — client fetches only visible tiles/chunks, never the full dataset
- **Challenge 4 (User Expectations):** FlatBuffer snapshots load faster than JSON — sub-second cold start for typical 2D documents
- **Challenge 6 (Trust):** Object Versioning + append-only JSONL = immutable, tamper-evident audit trail. CMEK for enterprise compliance.

---

## Layer 5: Rendering & Compute (Server-Side)

### What it does
Jobs the client can't or shouldn't handle: PDF/DXF export at print quality, large file conversion (IFC → NEXUS), AI agent orchestration, geometry validation, thumbnail generation.

### MVP (<100 users)

**Service:** Cloud Run jobs (serverless, pay-per-invocation)

```
Client                    Cloud Run Job              Cloud Storage
  │                            │                          │
  ├──POST /export/dxf─────────→│                          │
  │  {project_id, options}     │                          │
  │                            ├──read Yjs state──────────→│
  │                            │←─────────────────────────┤
  │                            │                          │
  │                            │  [Generate DXF in Rust]  │
  │                            │                          │
  │                            ├──write export────────────→│
  │                            │←─────────────────────────┤
  │←──{download_url}───────────┤                          │
```

**What to build:**
- **Export service** (Cloud Run): Read Yjs doc → reconstruct kernel state → generate DXF/PDF → upload to Cloud Storage → return signed URL
  - Runs the same Rust kernel as the client (compiled to native, not WASM) for identical output
  - PDF via `printpdf` crate or `cairo` bindings
  - DXF via the existing `file-io` package logic
- **Import service** (Cloud Run): Parse uploaded DXF/IFC → convert to NEXUS commands → return entity JSON
  - For large files (>10MB), run async with status polling
- **AI agent service** (Cloud Run): LangGraph.js orchestration
  - Receives natural language prompt
  - Decomposes into Command JSON sequence
  - Returns command batch for client to execute via `execute_command(json)`
  - Uses Vertex AI (Gemini) or Anthropic API for LLM calls

**Key design decision:** The AI agent service does NOT execute commands on the server. It generates command JSON that the client executes. This means:
- The client's Rust kernel is the single source of truth (no server/client divergence)
- The agent service is stateless — no kernel instance to maintain
- Challenge 1 (numerical stability) is handled client-side where the user can see and fix results

**What NOT to build:**
- No server-side rendering (unlike Figma — NEXUS renders client-side)
- No heavy geometry compute offload (save for scale phase)
- No thumbnail service (use client-side canvas capture, upload to Storage)

### At Scale (10k+ users, enterprise)

- **Cloud Run with GPU** for heavy geometry: large boolean operations, mesh decimation, point cloud processing
- **Batch export pipeline** via Cloud Tasks: enterprise customers export 100 DXF files overnight
- **AI agent pool**: multiple specialized agents (Structural, MEP, Civil) running as separate Cloud Run services, orchestrated by a LangGraph coordinator
- **Geometry validation service**: after Yjs merge, validate all constraints and topology server-side before persisting (Challenge 1)

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Cloud Run | Export, import, AI agent | Same + GPU instances |
| Vertex AI | LLM calls for agent | Same + fine-tuned models |
| Cloud Tasks | — | Async job queue |
| Cloud Storage | Job inputs/outputs | Same |

### Cost
- **MVP:** ~$10/month (pay-per-invocation, minimal usage)
- **Scale:** ~$200-1000/month (depends heavily on AI token usage and export volume)

### Challenges addressed
- **Challenge 1 (Numerical Stability):** Server-side geometry validation catches degenerate results before persistence
- **Challenge 3 (Concurrency):** Heavy jobs run on server, not blocking browser main thread
- **Challenge 4 (User Expectations):** Export completes in seconds on server vs potentially minutes in browser for large documents
- **Challenge 5 (Plugins):** AI agents use the same Command interface as plugins — identical execution path

---

## Layer 6: API & Integrations

### What it does
The programmatic surface: REST API for third-party integrations, MCP protocol for AI agents, webhook notifications, plugin sandbox.

### MVP (<100 users)

**Service:** Cloud Run API server (single service, multiple routes)

**API Design:**
```
# Authentication
POST   /auth/token                    # Exchange Firebase JWT for API token

# Projects
GET    /projects                      # List user's projects
POST   /projects                      # Create project
GET    /projects/{id}                 # Project metadata
DELETE /projects/{id}                 # Delete project

# Document Operations (via Command pattern)
POST   /projects/{id}/commands        # Execute command batch
  Body: [{"type":"CreateLine","x1":0,"y1":0,"x2":10,"y2":5,"layer_id":"layer_0"}, ...]
  → Applies commands to Yjs doc server-side
  → Returns: [CommandResult, ...]

GET    /projects/{id}/entities        # Query entities (with filter)
  ?layer=A-WALL&type=Line

# Export/Import
POST   /projects/{id}/export          # Trigger export job
GET    /projects/{id}/export/{jobId}  # Poll export status
POST   /projects/{id}/import          # Upload file for import

# AI Agent (MCP endpoint)
POST   /mcp                           # MCP protocol endpoint
  → Routes to appropriate tool handler
  → Each tool maps to a Command variant
```

**MCP Server Implementation:**
The `execute_command(json)` WASM binding from Task F1 is the backbone. The MCP server wraps it:

```typescript
// Each MCP tool = one Command variant
server.addTool({
  name: "draw_line",
  description: "Draw a line between two points",
  parameters: {
    x1: { type: "number" }, y1: { type: "number" },
    x2: { type: "number" }, y2: { type: "number" },
    layer_id: { type: "string", optional: true }
  },
  execute: async (params) => {
    const command = { type: "CreateLine", ...params, layer_id: params.layer_id ?? "layer_0" };
    return kernel.execute_command(JSON.stringify(command));
  }
});
```

**What to build:**
- Single Cloud Run service with Express/Fastify
- JWT verification middleware (Firebase Auth tokens)
- Command batch endpoint that applies commands to server-side Yjs doc
- MCP server (using `@modelcontextprotocol/sdk`) with 10 core tools (matching POST-2 task)
- Webhook: POST to user-configured URL on project events (save, export complete, agent action)

**What NOT to build:**
- No GraphQL (REST is simpler for command-oriented API)
- No plugin sandbox (defer — plugins call the API like any other client)
- No rate limiting (use Cloud Armor later)

### At Scale (10k+ users, enterprise)

- **API Gateway** (GCP) in front of Cloud Run for rate limiting, API key management, usage metering
- **Plugin sandbox**: WASM-based plugin execution (plugins are WASM modules that call the Command API)
- **OAuth2 provider**: third-party apps authenticate via NEXUS OAuth flow
- **Webhook delivery**: Cloud Tasks for reliable delivery with retries
- **API versioning**: `/v1/`, `/v2/` with deprecation schedule

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Cloud Run | API server + MCP server | Same behind API Gateway |
| API Gateway | — | Rate limiting, API keys |
| Cloud Tasks | — | Webhook delivery |

### Cost
- **MVP:** ~$5/month (same Cloud Run instance serves API and MCP)
- **Scale:** ~$50-100/month (API Gateway + separate services)

### Challenges addressed
- **Challenge 5 (Plugins):** The Command API IS the plugin surface. Every operation callable without GUI context. MCP tools = AI agent surface = plugin surface = same interface.
- **Challenge 6 (Trust):** Every API call is authenticated, logged, and attributed to an Actor (User or Agent) in the event envelope.

---

## Layer 7: Infrastructure & DevOps

### What it does
Deployment, CDN, security headers, monitoring, CI/CD, offline support.

### MVP (<100 users)

**Static Assets (SvelteKit app + WASM):**
- Build: GitHub Actions → `pnpm build` + `wasm-pack build`
- Deploy: Cloud Storage static site + Cloud CDN
- WASM binary: ~2MB gzipped for 2D kernel, served with `Content-Type: application/wasm` and long cache headers
- **COOP/COEP headers** (required for SharedArrayBuffer):
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
  Set these on the CDN/load balancer from day one. Without them, SharedArrayBuffer and high-resolution timers are unavailable.

**Backend Services:**
- Deploy all Cloud Run services via `gcloud run deploy` in CI
- Environment config via Secret Manager
- Terraform for infrastructure-as-code (even at MVP — prevents "works on my account" problems)

**Monitoring:**
- Cloud Run built-in metrics (request count, latency, error rate)
- Cloud Logging for all services
- Uptime check on the frontend URL
- Error alerting via Cloud Monitoring → email

**Offline Support:**
- Service Worker caches the SvelteKit shell + WASM binary
- OPFS stores document state locally (already implemented)
- When offline, all operations work locally (the Rust kernel runs entirely client-side)
- On reconnect, Yjs syncs automatically (CRDT merge)

**What to build:**
- GitHub Actions workflow: lint → test (Rust + TS) → build → deploy
- Terraform config for: Cloud Run services, Cloud Storage buckets, Firebase project, Secret Manager secrets
- Service Worker with workbox for offline caching
- COOP/COEP headers on CDN

### At Scale (10k+ users, enterprise)

- **Multi-region deployment**: Cloud Run in us-central1 + europe-west1 + asia-east1
- **Cloud CDN** with regional edge caching for WASM binary and static assets
- **Cloud Armor** for DDoS protection and WAF rules
- **Cloud Build** for CI/CD (replaces GitHub Actions for tighter GCP integration)
- **SLO monitoring**: latency P99 < 200ms for API, < 100ms for collaboration relay
- **Cost alerting**: Budget alerts at $100, $500, $1000/month thresholds

### GCP Services
| Service | MVP | Scale |
|---------|-----|-------|
| Cloud CDN | Static assets + WASM | Multi-region edge |
| Cloud Storage | Static site hosting | Same |
| Cloud Run | All backend services | Multi-region |
| Cloud Monitoring | Basic metrics + alerts | SLO dashboards |
| Cloud Armor | — | DDoS + WAF |
| Secret Manager | Env config | Same + rotation |
| Artifact Registry | Container images | Same |

### Cost
- **MVP:** ~$5/month (Cloud CDN egress minimal, Artifact Registry minimal)
- **Scale:** ~$100-300/month (multi-region, Cloud Armor, enhanced monitoring)

### Challenges addressed
- **Challenge 3 (Concurrency):** COOP/COEP headers enable SharedArrayBuffer for future Web Worker parallelism
- **Challenge 4 (User Expectations):** CDN edge caching means <50ms load for cached assets worldwide. Offline mode means zero-latency for local operations.
- **Challenge 6 (Trust):** Infrastructure-as-code = reproducible, auditable deployments. Cloud Armor for enterprise security requirements.

---

## Complete Cost Model

### MVP (<100 users)

| Layer | Service(s) | Monthly Cost |
|-------|-----------|-------------|
| 1. Identity | Firebase Auth (free tier) | $0 |
| 2. Collaboration | Cloud Run (y-websocket) | $25 |
| 3. File Management | Firestore + Cloud Storage | $5 |
| 4. Storage | Cloud Storage | $2 |
| 5. Compute | Cloud Run (export/AI jobs) | $10 |
| 6. API | Cloud Run (shared instance) | $5 |
| 7. DevOps | CDN + monitoring | $5 |
| **Total** | | **~$52/month** |

Plus: Domain name ~$12/year, Anthropic API for AI agent ~$20-50/month depending on usage.

**Realistic MVP total: ~$75-100/month**

### At Scale (10k+ users)

| Layer | Service(s) | Monthly Cost |
|-------|-----------|-------------|
| 1. Identity | WorkOS + Cloud SQL | $85 |
| 2. Collaboration | GKE + Redis + Pub/Sub | $350 |
| 3. File Management | Cloud SQL + Storage + BigQuery | $200 |
| 4. Storage | Cloud Storage + CDN | $150 |
| 5. Compute | Cloud Run + GPU + Vertex AI | $600 |
| 6. API | API Gateway + Cloud Run | $75 |
| 7. DevOps | Multi-region + Armor + monitoring | $200 |
| **Total** | | **~$1,660/month** |

At 10k users paying $20/month = $200k MRR. Infrastructure is <1% of revenue. Healthy.

---

## Challenge Coverage Matrix

| Infrastructure Decision | Ch1: Numerical | Ch2: Memory | Ch3: Concurrency | Ch4: UX | Ch5: Plugins | Ch6: Trust |
|------------------------|:-:|:-:|:-:|:-:|:-:|:-:|
| Yjs CRDT collaboration | | | | x | | |
| Server-side geometry validation | x | | | | | |
| OPFS offline cache | | x | | x | | |
| PMTiles/COPC range requests | | x | | | | |
| FlatBuffer snapshots | | x | | x | | |
| Command API = Plugin surface | | | | | x | |
| MCP protocol for AI agents | | | | | x | |
| COOP/COEP headers | | | x | | | |
| Cloud Run export jobs | | | x | x | | |
| EventEnvelope audit trail | | | | | | x |
| Append-only JSONL event log | | | | | | x |
| Object Versioning on Storage | | | | | | x |
| CMEK encryption | | | | | | x |
| CDN edge caching | | | | x | | |
| Service Worker offline | | | | x | | |
| JWT auth for agents | | | | | x | x |

---

## Build vs Buy Summary

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Auth | **Buy** (Firebase → WorkOS) | Zero-ops at MVP, enterprise SSO at scale |
| CRDT collaboration | **OSS** (Yjs) | Best-in-class, MIT license, proven at scale |
| Collab server | **OSS** (y-websocket → Hocuspocus) | Simple, extensible, Yjs-native |
| Database | **Buy** (Firestore → Cloud SQL) | Managed, no ops |
| Object storage | **Buy** (Cloud Storage) | No alternative on GCP |
| Export/conversion | **Build** (Rust kernel, native compiled) | Must match client output exactly |
| AI orchestration | **Build** (LangGraph.js) + **Buy** (Vertex AI / Anthropic) | Custom agent logic, commodity LLM |
| CDN | **Buy** (Cloud CDN) | No alternative at this price |
| Plugin sandbox | **Defer** → **Build** (WASM sandbox) | Not needed for MVP |
| Tile server | **Skip** (PMTiles eliminates it) | Range requests on Cloud Storage = zero-ops tile serving |

---

## What to Build First (Solo Founder Priority)

### Phase 0: Ship v0.1 (Current — no server needed)
The app works entirely client-side. OPFS for save/load. DXF export in-browser. No server dependency.

### Phase 1: Add persistence + auth (~1 week)
1. Firebase Auth (email + Google OAuth)
2. Cloud Storage for document save/load (signed URLs)
3. Firestore for project metadata
4. Deploy frontend to Cloud CDN

This lets users log in, save work to the cloud, and access from any device. No collaboration yet.

### Phase 2: Add collaboration (~2 weeks)
1. y-websocket on Cloud Run
2. Yjs integration in the client (replaces direct kernel state management)
3. Awareness protocol for cursors
4. This is the big architectural change — see finding #07 (Yjs) for the full implications.

### Phase 3: Add AI agent API (~1 week)
1. MCP server on Cloud Run
2. 10 core tools wired to `execute_command(json)`
3. Simple chat endpoint that takes NL → generates Command JSON
4. This unlocks the "draw a 10m x 8m room" demo

### Phase 4: Add export/import server (~1 week)
1. Cloud Run export service (DXF/PDF generation)
2. Import service (DXF upload → entity conversion)
3. Async job status polling

**Total time from v0.1 to "Figma-like platform": ~5 weeks of server work.**

Everything after that (plugin system, multi-region, enterprise SSO, advanced AI agents) is growth-stage work funded by revenue.
