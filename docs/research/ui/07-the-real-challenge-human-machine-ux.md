# The Real Challenge: Human-Machine Shared Workspace UX

> This is the hard problem. Everything else — panels, toolbars, command lines — is engineering.
> This is design at the boundary of two cognitive models that don't share a language.

---

## The Problem Statement

A traditional CAD UI serves **one type of user**: a human with eyes, hands, spatial intuition, and 20 years of muscle memory. Every UI decision optimizes for that user.

NEXUS serves **two fundamentally different types of users simultaneously**:

| | Human | AI Agent |
|---|---|---|
| **Perceives space** | Visually, holistically, instantly | As coordinate lists, component queries, spatial predicates |
| **Expresses intent** | Clicks, drags, typed shortcodes, gestures | JSON commands, MCP tool calls, structured parameters |
| **Makes decisions** | Gestalt pattern recognition ("this looks wrong") | Constraint evaluation ("angle deviates 0.3 degrees from perpendicular") |
| **Handles ambiguity** | Resolves it intuitively ("close enough") | Needs explicit tolerance parameters |
| **Speed** | 1-5 operations per second | 100+ operations per second |
| **Error pattern** | Imprecise but intentional | Precise but can be systematically wrong |
| **Trust model** | "I see it, I believe it" | "I computed it, here's the proof" |
| **Context** | Sees the whole drawing, remembers history, has domain expertise | Sees what's queried, has no memory between sessions unless given one |

The UX challenge is: **how do you build a shared workspace where both can operate, observe each other, intervene, and build trust — without one degrading the other's experience?**

No product has solved this. Not at CAD scale. This document maps the problem space.

---

## The Five Interaction Modes

Every human-AI interaction in CAD falls into one of five modes. Each needs its own UX pattern.

### Mode 1: Human Works, AI Watches
**Scenario:** Engineer draws a floor plan. AI observes silently, building understanding.

**What the AI sees:**
- Stream of events: `CreateLine`, `CreateLine`, `CreateLine`, `CreateLine` (four walls)
- Entity relationships: four lines form a closed rectangle
- Layer context: all on "Walls" layer
- Constraint context: lines are orthogonal, connected at endpoints

**What the AI should do:**
- Build a semantic model ("this is a room, ~10m x 8m, on Walls layer")
- Detect patterns ("user always creates rooms clockwise, starting from bottom-left")
- Precompute suggestions (but don't show them yet)

**UX question:** Does the AI's understanding need to be visible? Or is invisible observation fine?

**Precedent:** GitHub Copilot watches you code silently. Shows suggestions only when it has high confidence. The "ghost text" pattern — dimmed preview of what it thinks you'll do next.

**NEXUS approach:**
- No UI needed for this mode. AI watches the event stream.
- Optional: subtle indicator that AI is "paying attention" (status bar icon)
- The key: AI must observe at the EVENT level, not the UI level. It reads `CadEvent` objects, not pixels.

---

### Mode 2: Human Works, AI Assists (Copilot)
**Scenario:** Engineer draws lines. AI suggests closing the polyline, adding a door symbol, or snapping to a grid intersection.

**Types of assistance:**
1. **Completion suggestion** — "Close this polyline?" (like Copilot's ghost text)
2. **Constraint suggestion** — "Make this perpendicular?" (like FreeCAD's auto-constraints)
3. **Validation warning** — "This wall is 0.3mm off from the grid" (like a linter)
4. **Domain knowledge** — "AASHTO requires minimum 3.65m lane width" (like Clippy, but useful)

**UX patterns (from other domains):**

| Pattern | Source | How it works | Transfer to CAD |
|---------|--------|-------------|-----------------|
| Ghost text | Copilot | Dimmed preview, Tab to accept | Ghost geometry: dimmed lines showing suggested next step |
| Inline hint | IDE | Grayed text at end of line | Floating label near cursor: "Press C to close" |
| Squiggly underline | VS Code | Red/yellow wavy line under problem | Highlight entity with warning color + tooltip |
| Lightbulb | VS Code | Icon appears, click for suggestions | Small icon near cursor when AI has a suggestion |
| Auto-constraint cursor | FreeCAD Sketcher | Changes cursor icon when near a constraint | Already in NEXUS snap system — extend with AI constraints |

**The critical UX principle:** Suggestions must be **ambient, not interruptive.** A modal dialog ("AI suggests closing this polyline") breaks flow. A dimmed ghost line that the user can Tab-accept or ignore does not.

**NEXUS approach:**
- Ghost geometry layer: dimmed entities rendered by the AI suggestion engine
- Tab/Enter to accept, Esc or keep drawing to ignore
- Confidence threshold: only show suggestions above 0.85 confidence
- Never interrupt a multi-step tool operation (don't suggest while user is mid-line)

---

### Mode 3: Human Commands, AI Executes
**Scenario:** Engineer says "Draw a 10x10 rectangle at origin" or "Offset all walls by 200mm."

**This is the simplest mode.** Human provides natural language or structured command. AI translates to MCP tool calls. AI executes. Human sees result.

**The UX challenge is trust and control:**

**Before execution:**
- Should AI show a preview of what it will do? (Plan approval)
- Should AI execute immediately and let human undo? (Optimistic execution)
- Does it depend on scope? (One line = execute immediately. Redesign floor plan = show plan first.)

**During execution:**
- For fast ops (<1s): no UI needed, just do it
- For slow ops (>1s): progress indicator + preview of partial results
- For batch ops (offset 50 walls): streaming progress (12/50 complete...)

**After execution:**
- Flash/highlight the changed entities briefly (draw attention to what changed)
- Entry in event log: "AI: Offset 50 walls by 200mm" with expand/collapse detail
- Easy undo: Ctrl+Z undoes the entire AI batch as one operation

**Precedent:**
- Cursor: shows diff of proposed changes, user clicks "Accept" or "Reject"
- Figma AI: generates design, places it on canvas, user adjusts
- ChatGPT Canvas: shows tracked changes, user reviews inline

**NEXUS approach:**
- **Small operations (1-5 entities):** Execute immediately. Flash highlights. Ctrl+Z to undo.
- **Large operations (>5 entities):** Show ghost preview + confirmation prompt: "Offset 50 walls by 200mm? [Enter to confirm, Esc to cancel]"
- **Destructive operations (delete, modify existing):** Always preview + confirm.
- Threshold is configurable per user: power users set to "always execute," cautious users set to "always preview."

---

### Mode 4: AI Works, Human Watches
**Scenario:** AI agent runs generative design — exploring 100 layout options for a building, or optimizing a road alignment against terrain.

**This is the hardest mode for UX.**

The human can't follow 100 operations per second visually. But they need:
1. **Progress** — what is the AI doing right now?
2. **Direction** — is it heading toward what I want?
3. **Control** — can I stop it, redirect it, or adjust parameters?
4. **Result** — what did it produce, and why?

**UX patterns:**

| Pattern | What it shows | CAD equivalent |
|---------|--------------|----------------|
| Progress bar | % complete | "Exploring option 34/100" |
| Live preview | Current best result | Viewport shows the best alignment so far, updating in real-time |
| Parameter sliders | Adjustable while running | "Prioritize: [cost ←→ speed] [cut ←→ fill]" |
| Pause/resume | Stop generation, inspect, continue | Pause AI, rotate viewport, inspect geometry, resume |
| Comparison gallery | Grid of options | Split viewport showing top 4 results side-by-side |
| Decision trail | Why this option was chosen | "Option 23: chosen because gradient < 8%, avoids wetland, shortest path" |

**The key insight:** Human oversight of AI generative design is NOT about approving individual operations. It's about **steering a search process.** The UI needs to show the search space, the current trajectory, and let the human redirect.

**Precedent:**
- Grasshopper (Rhino): visual programming with sliders that update geometry in real-time
- Autodesk Generative Design: submit constraints, get back options to compare
- Midjourney: generates 4 options, user picks one, AI refines

**NEXUS approach:**
- Agent Panel with streaming log: each operation appears as it executes
- Viewport shows a ghost overlay of the AI's current working state
- Pause button stops agent at next command boundary (never mid-command)
- "Steer" controls: sliders/buttons that adjust agent parameters mid-run
- Results comparison: split viewport to compare options
- Every AI decision logged to event store with reasoning metadata

---

### Mode 5: Human and AI Co-Create (True Collaboration)
**Scenario:** Human draws the main walls. AI simultaneously places doors per building code. Human adjusts a wall. AI moves the door to maintain clearance. AI flags that the new wall position violates fire egress requirements.

**This is the vision.** Both working on the same spatial state, in real-time, each contributing their strengths.

**The UX challenges are profound:**

1. **Ownership:** Who "owns" an entity? If AI placed a door, can the human move it? (Yes, obviously.) If the human moves it, does the AI re-optimize? (Maybe — needs a rule.)

2. **Conflict resolution:** Human moves wall left. AI simultaneously moves wall right (to satisfy a constraint). Who wins? The event system must handle this — but the UI must show it.

3. **Attribution:** In the viewport, can you tell which entities were human-created vs AI-created? Does it matter? (For audit: yes. For workflow: probably not.)

4. **Pace mismatch:** Human operates at 1-5 ops/sec. AI at 100+ ops/sec. The viewport can't flash 100 operations per second. Need batching/grouping.

5. **Attention management:** When AI makes a change far from where the human is looking, how do you alert without disrupting? (Minimap indicator? Notification in agent panel? Subtle highlight?)

**Precedent:**
- Google Docs: multiple cursors, different colors, real-time
- Figma: multiplayer design, cursors + names, comment threads
- Pair programming: one drives, one navigates — roles are explicit

**NEXUS approach (speculative — needs prototyping):**
- **Cursor/agent indicator:** AI agent has a "cursor" shown as a small icon in the viewport, showing where it's currently working
- **Entity attribution:** Metadata on each event: `Actor::Human { user_id }` or `Actor::Agent { agent_id, model }` — already designed in event envelope
- **Ownership rule:** Human overrides always win. If AI placed it, human can move it. If human placed it, AI can suggest changes but must flag, not auto-modify.
- **Pace management:** AI operations batched visually. "AI adjusted 12 doors" appears as one viewport animation, not 12 flashes.
- **Attention zones:** Divide viewport into zones. AI notifications within current view = ghost highlight. AI notifications outside current view = minimap ping + agent panel log.

---

## The Trust Spectrum

The UX must adapt to the user's trust level, which evolves over time:

```
Zero Trust                                                    Full Trust
|------------|------------|------------|------------|-----------|
  "Show me     "Preview      "Execute      "Work         "I don't
   everything   before you    small ops     autonomously    need to
   and ask      execute"      immediately,  in background,  see what
   permission"                preview big"  I'll review"    you did"
```

**Key design principle:** The default position should be toward the LEFT (more human control). Trust shifts right only through:
1. Demonstrated competence (AI actions that the user accepts without modification)
2. Explicit user preference (settings toggle)
3. Domain-appropriate trust (drafting = higher trust, structural = lower trust)

**UI mechanism:** A "trust slider" in settings, or better — an adaptive system that tracks acceptance rate and gradually increases autonomy.

---

## The Information Architecture

Where does human-AI interaction information live in the UI?

### Layer 1: Viewport (Spatial)
- Ghost geometry (suggestions)
- Entity highlights (AI-modified entities)
- Agent cursor (where AI is working)
- Constraint indicators (AI-detected constraints)
- Warning markers (spatial validation issues)

### Layer 2: Agent Panel (Temporal)
- Streaming log of AI operations (newest at top)
- Each entry: timestamp, operation description, entity count, expand for details
- Accept/reject buttons per entry (for preview mode)
- "Undo last AI action" button
- Agent status: idle / working / paused / error

### Layer 3: Status Bar (Ambient)
- "AI: idle" / "AI: offsetting walls..." / "AI: 3 suggestions pending"
- Click to open agent panel

### Layer 4: Command Line (Conversational)
- Natural language input: "offset these walls 200mm"
- AI response inline: "Done. 12 walls offset. 2 conflicts flagged."
- Sub-commands during AI operation: "stop", "undo", "more", "adjust radius to 300mm"

### Layer 5: Review Panel (Evaluative)
- Flagged items from AI: gradient too steep, code violation, constraint conflict
- Each flag: location (click to zoom), severity, AI explanation, resolve button
- Sorted by severity. Critical at top.

---

## What Makes This Different from Every Other AI UX

Most AI product UX is **conversational** (chat) or **generative** (produce content). CAD AI UX is **collaborative spatial manipulation** — fundamentally different.

| Dimension | Chat AI (ChatGPT) | Generative AI (Midjourney) | Spatial AI (NEXUS) |
|-----------|-------------------|---------------------------|-------------------|
| Input | Text | Text prompt | Text + clicks + geometry + constraints |
| Output | Text | Image/video | Geometry in shared spatial state |
| Feedback loop | User reads, responds | User picks option, refines prompt | User sees geometry, adjusts, AI responds to adjustment |
| State | Stateless between messages | Stateless between generations | Persistent shared state (event log) |
| Undo | Re-prompt | Re-generate | True undo on event log |
| Precision | Approximate is OK | Approximate is the point | Must be exact to tolerances |
| Multi-agent | Not applicable | Not applicable | Multiple agents on same geometry simultaneously |
| Trust requirement | Low (it's just text) | Low (it's just an image) | HIGH (this becomes a building/road/bridge) |

The trust requirement is what makes this hard. When an AI writes text, you read it and decide if it's good. When an AI draws geometry that becomes a structural design, **lives depend on it being correct.** The UX must communicate confidence, provenance, and verifiability.

---

## The Minimum Viable Human-Machine UX (v0.1 → v0.2)

Not everything above is needed immediately. Here's the phased approach:

### v0.1 (Now): Foundation Only
- Event envelope already carries `Actor` (human vs agent)
- Command system already accepts JSON (agent-callable)
- No AI panel yet. No ghost geometry. No suggestions.
- **But:** the architecture supports it. Events are attributed. Commands are serializable. The viewport renders from state, not from UI events.

### v0.2 (Post-ship): Mode 3 Only (Human Commands, AI Executes)
- Add Agent Panel (streaming operation log)
- Natural language → MCP tool call pipeline
- Execute-and-undo pattern for small ops
- Preview-and-confirm for large ops
- Flash highlights on AI-modified entities
- "AI: idle/working" in status bar

### v0.3: Mode 2 (AI Assists / Copilot)
- Ghost geometry layer for suggestions
- Auto-constraint suggestions during drawing
- Validation warnings (squiggly underline equivalent for geometry)
- Confidence-gated suggestion display

### v0.4: Mode 4 + Mode 5 (AI Works + Co-Creation)
- Generative design UI (progress, comparison, steering)
- Agent cursor in viewport
- Multi-agent coordination
- Trust slider / adaptive autonomy
- Entity attribution visualization

---

## Open Research Questions

These need prototyping, user testing, or deeper investigation:

1. **Ghost geometry acceptance rate:** Do CAD users find ghost previews helpful or distracting? Test with 5 drafters.

2. **Command line vs chat for AI input:** Should "offset these walls 200mm" go through the existing command line or a separate AI chat panel? Or both?

3. **Trust calibration:** How quickly do users increase trust? Is it per-session, per-project, or per-operation-type?

4. **Multi-agent visualization:** When 3 agents work simultaneously, does the viewport become chaotic? What's the maximum before users can't track?

5. **Attribution value:** Do users actually care whether a line was human-drawn or AI-drawn during normal work? Or only during review/audit?

6. **Intervention latency:** If AI is executing a batch operation and the user says "stop," what's the acceptable latency? <100ms? <500ms? <1s?

7. **Undo granularity:** When undoing an AI batch (12 wall offsets), should Ctrl+Z undo all 12 at once, or one at a time? User preference? Operation-type dependent?

---

## The Competitive Moat

If NEXUS solves this UX problem — even partially — it creates a moat that no desktop CAD can cross:

- **AutoCAD can't add AI agents** without rebuilding its 40-year-old UI event system
- **FreeCAD could** (Python scriptable) but has no event sourcing for attribution/undo
- **OnShape could** (cloud-native) but Siemens enterprise bureaucracy will slow them
- **Zoo is trying** but their cloud-rendering model means AI and human share a video stream, not a data model

NEXUS's event-sourced ECS with MCP tool schemas is the **only architecture designed from day one for human-AI co-creation.** The UI just needs to make that architecture visible and controllable.

The architecture is the foundation. The UX is the product.
