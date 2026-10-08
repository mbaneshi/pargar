# NEXUS — Product Architecture Thesis

> Briefing doc. Read time: 60 seconds.

---

## What NEXUS Is

A collaboration runtime for engineering intelligence. A shared spatial model where humans and AI agents co-author geometry with full audit trail, legal admissibility, and domain-aware validation.

Not a CAD tool. Not "AutoCAD in the browser." The product is the shared understanding of spatial intent — every entity is event-sourced, actor-attributed, constraint-bound, and domain-typed.

```
OLD:  Human → CAD software → Drawing → Print → Give to contractor
NEW:  Human + AI agents → Shared spatial model → Automated compliance → Direct fabrication
```

---

## Why Now

1. **WASM matured.** OpenCASCADE, GDAL, constraint solvers, point cloud renderers all run in-browser at near-native speed. Not true before 2024.
2. **AI agents can generate geometry.** MCP protocol means every tool is callable by agents. The kernel's `execute_command(json)` with `Actor::Agent` is the right abstraction.
3. **The AEC industry is desperate.** Autodesk's $2K-5K/seat/year model is hated. Construction has the lowest digital adoption of any sector. The market is the billions who can't afford Autodesk — not stealing existing customers.

Autodesk won't unify — it would cannibalize $4B+ in annual revenue from 7 separate products. Figma proved browser collaboration works, but engineering geometry is 100x harder than design rectangles. NEXUS sits in the gap.

---

## Three Non-Negotiable Bets

### 1. ECS Data Model — The Most Important Technical Choice

A Wall = `{EntityId, Geometry, BIMProperties, StructuralProperties, Layer}`. A Road = `{EntityId, Geometry, AlignmentProperties, SurfaceProperties, Layer}`. Same query interface. Same renderer. Same event store. Same AI tools. This is what makes "all-in-one" actually possible. New domains add components, not class hierarchies or database schemas.

### 2. Trust Architecture — The Product Moat

`AgentDecisionEvent` with hash-chained audit trail. PROPOSED-to-APPROVED lifecycle. Coordinate masking for LLM calls. No other CAD platform has tamper-evident, legally admissible, AI-attributable geometry. This is why enterprises pay. Features can be replicated; the trust layer cannot be bolted on later.

### 3. AutoCAD UX + Invisible AI

Engineers won't switch unless it feels like AutoCAD — command line, coordinate input, snap modes, layers. AI manifests as smarter snapping, pattern auto-completion, validation-as-you-draw, ghost geometry. The chat bar is for power users later. First impression: "AutoCAD, but it reads my mind."

---

## Compound Advantage

Each architectural layer reinforces the others:

- **Events** enable undo/redo, audit trail, AND AI replay
- **ECS** enables cross-domain queries, rendering, AND AI tool uniformity
- **MCP** enables AI agents, IDE plugins, AND third-party integrations — same interface
- **WASM** enables browser execution, server-side export, AND plugin sandboxing — same kernel

No single piece is defensible alone. Together, they create a system easier to extend than to replicate.

---

## Expansion Path

```
2D CAD (v0.1)  → Ship, get users, validate with real engineers
3D CAD (v0.2)  → Add OCCT kernel, extrude/revolve/boolean commands
BIM    (v0.3)  → Add web-ifc parser, BIM components, IFC validation
GIS    (v0.4)  → Add CesiumJS renderer, CRS component, PROJ transforms
Civil  (v0.5)  → Custom Rust alignment/profile/corridor (nothing exists OSS)
Agents (v0.7)  → Multi-agent pipeline, LangGraph orchestration, plugin runtime
```

Each step adds components, commands, renderers, and parsers to the existing ECS world, event store, command system, and MCP protocol. Nothing from previous steps is rewritten.

---

## Decision Framework

Priority stack for any architectural decision:

1. Does it ship the current phase faster? Do it now.
2. Does it preserve ECS + event sourcing + command pattern? Non-negotiable.
3. Does it strengthen the trust architecture? High priority (moat).
4. Does it improve DXF compatibility? High priority (adoption gate).
5. Does it enable AI agents? Important but must not delay human UX.
6. Does it add a new domain? Not until current phase ships and users validate.
7. Does it require infra spend > $0/month? Defer until user demand justifies it.

**The test:** "Would this make a civil engineer with 20 years of AutoCAD experience more productive in their first 5 minutes?"

---

> See also: `docs/infrastructure/13-PRODUCT-ARCHITECTURE-THESIS.md` for infrastructure-specific strategic context.
