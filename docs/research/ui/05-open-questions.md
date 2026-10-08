# Open Questions — UI Architecture

Decisions we haven't made yet. Each needs targeted research or prototyping before committing.

---

## Q1: Docking or Fixed Layout?

**Context:** Every desktop CAD app has dockable panels. Zero web CAD apps have implemented this. Is it actually needed for v0.1, or is fixed layout + collapsible panels sufficient?

**Options:**
- A) Fixed layout with resizable splitters (what everyone does today)
- B) `dockview` (framework-agnostic, active development, docking + tabs + floating)
- C) `lumino` (JupyterLab's panel system, vanilla TS, battle-tested)
- D) Build custom (maximum control, maximum effort)

**What to investigate:**
- Can dockview render Svelte components in panels?
- What's lumino's bundle size and API complexity?
- Do actual CAD users rearrange panels, or do they set once and forget?

---

## Q2: How to Bridge WASM State to UI Reactivity?

**Context:** Current approach is `syncView()` — re-read all state from kernel after every command. CADmium does the same (full JSON dump). This works at <1k entities but won't scale.

**Options:**
- A) Keep full sync, optimize with diffing (CRC32 hashes per entity)
- B) Event-based: kernel emits typed change events, UI applies granular updates
- C) SharedArrayBuffer: kernel writes directly to shared memory, JS reads
- D) Incremental serialization: kernel only serializes changed entities

**What to investigate:**
- Can wasm-bindgen support typed event callbacks from Rust to JS efficiently?
- What's the actual perf ceiling of full JSON sync? Benchmark at 1k, 5k, 10k, 50k entities
- Does SharedArrayBuffer work with current COOP/COEP headers for deployment?

---

## Q3: Design System — Build or Adopt?

**Context:** Current UI has inline CSS with hardcoded hex values. No design tokens, no component library. Future domains (BIM, GIS, Civil) will each add 5-10 new panel types.

**Options:**
- A) shadcn-svelte — copy-paste components, full control, Tailwind-based
- B) Skeleton UI — Svelte-native component library
- C) Build custom design system with CSS custom properties (tokens)
- D) Headless UI (Melt) + custom styling

**What to investigate:**
- Does Tailwind's utility-first approach work well for complex CAD panel layouts?
- What's the migration cost from current inline CSS to design tokens?
- Are shadcn-svelte components flexible enough for CAD-specific needs (property grids, layer toggles)?

---

## Q4: Threlte vs Direct Three.js?

**Context:** Current NEXUS uses Three.js directly via CadRenderer class. CADmium uses Threlte (declarative Three.js for Svelte). ReplicAD uses React-Three-Fiber.

**Options:**
- A) Keep current CadRenderer (imperative, full control, already working)
- B) Migrate to Threlte for declarative scene management
- C) Hybrid: CadRenderer for 2D entities, Threlte for 3D viewport when adding 3D

**What to investigate:**
- Does Threlte handle 50k+ entities efficiently, or does Svelte component overhead become a bottleneck?
- Can Threlte coexist with imperative Three.js (custom render loops, instanced geometry)?
- Is the declarative model worth it for 2D CAD where entities are simple lines/arcs?

---

## Q5: Command Line Implementation

**Context:** Current CommandLine.svelte works but is basic. LibreCAD's command line has features we lack: auto-focus on keypress, keycode mode, sub-prompts, option brackets.

**Options:**
- A) Enhance current CommandLine.svelte incrementally
- B) Study LibreCAD's QG_CommandWidget and reimplement its features in Svelte
- C) Use a terminal emulator library (xterm.js) for rich command line
- D) Build a command palette (cmdk/ninja-keys) alongside the command line

**What to investigate:**
- What's the full feature set of AutoCAD's command line that power users depend on?
- Can xterm.js be styled to look like a CAD command line (not a terminal)?
- Does ninja-keys (web component) work inside a Svelte app?

---

## Q6: AI Agent Panel Architecture

**Context:** Sprint 9 plans an AgentPanel for AI action log + accept/reject. This is unique to NEXUS — no reference implementation exists.

**Options:**
- A) Chat-like interface (conversation with agent, showing proposed actions)
- B) Action log (stream of proposed commands, each with accept/reject/modify)
- C) Copilot overlay (suggestions appear inline in viewport, accept with Tab)
- D) Hybrid: action log + inline suggestions + voice input

**What to investigate:**
- How does Zoo Design Studio's AI conversation panel work?
- How does Cursor/Copilot present AI suggestions in code editors?
- What's the accept/reject UX for geometry changes vs code changes?

---

## Q7: Multi-Document / Multi-Tab

**Context:** Current NEXUS is single-document. Desktop CAD apps use MDI (Multiple Document Interface). Web apps use browser tabs or in-app tabs.

**Options:**
- A) Browser tabs (each drawing = new browser tab, shared WASM kernel)
- B) In-app tabs (LayoutTabs.svelte already exists as a stub)
- C) Single document only for v0.1, add tabs in v0.2

**What to investigate:**
- Can multiple browser tabs share a WASM kernel via SharedWorker?
- What's the memory overhead of multiple WASM instances?
- Do CAD users actually work with multiple drawings open simultaneously?

---

## Q8: Accessibility

**Context:** Zero accessibility in current UI. No ARIA labels, no focus management, no screen reader support. Desktop CAD apps are notoriously bad at this too.

**Decision needed:**
- When to invest in accessibility? v0.1 (now) or v0.2 (after validation)?
- What's the minimum viable accessibility for a CAD app?
- Are there any legal requirements (Section 508, WCAG) for commercial CAD software?

---

## Q9: Mobile / Touch Support

**Context:** All studied projects are desktop-only. Touch input changes everything — no hover, no right-click, no keyboard shortcuts.

**Decision needed:**
- Is mobile/tablet CAD a v1.0 concern or should we architect for it now?
- Can a command-line-driven CAD app work on mobile at all?
- What touch gestures map to CAD operations? (pinch zoom, two-finger pan already work via Three.js)

---

## Q10: Performance Budget

**Context:** No benchmarks exist for current UI. Need to establish targets.

**Targets to define:**
- First contentful paint: < ? ms
- Time to interactive: < ? s
- Pointer event latency (click → visual feedback): < ? ms
- Entity count before UI lag: ? entities
- Bundle size budget: < ? MB (excluding WASM)
- Memory budget: < ? MB for UI state
