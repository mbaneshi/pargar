# Framework Evaluation for CAD UI

We are NOT locked to Svelte. This document evaluates every viable option for building a professional CAD UI in the browser, based on what the studied projects actually chose and why.

---

## What a CAD UI Framework Must Handle

1. **60fps canvas interaction** — pointer events must not be blocked by UI re-renders
2. **Thousands of reactive bindings** — property panel, layer list, entity list, tool state, all updating simultaneously
3. **Complex component trees** — nested panels, context menus, floating overlays, modal tool inputs
4. **WASM interop** — bridge to Rust kernel without serialization overhead killing perf
5. **Keyboard-heavy workflow** — shortcuts, command line, tool sub-commands
6. **Future extensibility** — new workbenches (BIM, GIS, Civil) add new panels/toolbars without rewriting
7. **Bundle size** — CAD app already loads WASM + Three.js; framework overhead matters
8. **Developer velocity** — small team, need to move fast

---

## Framework Analysis

### Svelte 5 (Runes)

**Who uses it:** CADmium (Svelte 4)
**Pros:**
- Compiler-based — zero runtime overhead, smallest bundle
- Runes ($state, $derived, $effect) give fine-grained reactivity without virtual DOM
- Scoped CSS built-in (no CSS-in-JS needed)
- SvelteKit gives routing, SSR, build tooling
- Threlte exists for declarative Three.js integration
- Already used in current NEXUS prototype — no migration cost
- Component files are concise (HTML + JS + CSS in one file)

**Cons:**
- Smaller ecosystem than React (fewer UI component libraries)
- No equivalent to React-Three-Fiber's deep Three.js integration
- Fewer developers in the market
- shadcn-svelte exists but less mature than React shadcn/ui

**CAD-specific fit:**
- Runes model maps well to tool state machines ($state for status, $derived for computed)
- Compiler eliminates virtual DOM overhead during rapid pointer events
- Scoped CSS prevents style leaks in complex panel layouts

**Risk:** Ecosystem gaps for advanced UI needs (docking, complex data grids, node editors)

---

### React 18/19

**Who uses it:** ReplicAD, Zoo Design Studio
**Pros:**
- Largest ecosystem — every UI library exists for React
- React-Three-Fiber for deep Three.js integration
- shadcn/ui, Radix, cmdk, react-mosaic, rc-dock — all React
- Largest developer pool
- Server Components for future SSR optimization

**Cons:**
- Virtual DOM overhead during rapid pointer events (60fps drag/move)
- Bundle size larger than Svelte
- Boilerplate (hooks, memoization, useCallback to prevent re-renders)
- Need external state lib (Zustand, Jotai, MobX) — Svelte has this built in
- JSX/TSX verbose for simple UI

**CAD-specific fit:**
- React-Three-Fiber is excellent for 3D viewport as React component
- useMemo/useCallback dance needed to prevent re-renders during mouse moves
- Zoo and ReplicAD both chose React — both have perf complaints

**Risk:** Performance ceiling during interactive tools (drag, rubber-band, snap preview)

---

### Vue 3 (Composition API)

**Who uses it:** MLightCAD/CAD Viewer, Speckle
**Pros:**
- Good middle ground — reactive by default, good perf
- Composition API is clean (similar to Svelte 5 runes in concept)
- Element Plus, Vuetify, Naive UI — mature UI component libraries
- vue-i18n built-in
- Smaller than React, faster re-renders

**Cons:**
- Smaller ecosystem than React
- No equivalent to React-Three-Fiber (Three.js integration is manual)
- Template syntax less flexible than JSX for complex conditional rendering
- TresJS (Three.js for Vue) exists but less mature than R3F/Threlte

**CAD-specific fit:**
- MLightCAD proves Vue works well for CAD (faithful AutoCAD command system)
- Composition API composables are good for separating tool logic
- Element Plus gives production widgets fast but locks design

**Risk:** Middle of the road — doesn't excel in any dimension for CAD specifically

---

### Solid.js

**Who uses it:** No CAD project studied
**Pros:**
- True fine-grained reactivity (no virtual DOM, like Svelte but runtime)
- Smallest runtime of React-alternatives
- JSX syntax (familiar to React devs)
- Signals model is close to Svelte 5 runes conceptually
- SolidStart for full-stack

**Cons:**
- Tiny ecosystem — few UI component libraries
- No Three.js integration library
- Very small community
- No proven use in any CAD/spatial app

**CAD-specific fit:**
- Fine-grained reactivity is great for pointer-heavy interactions
- Would need to build all CAD UI components from scratch

**Risk:** Too niche. Ecosystem too small. No precedent in spatial/CAD domain.

---

### Vanilla Web Components

**Who uses it:** Chili3D, That Open Components (for UI package)
**Pros:**
- Zero framework lock-in — works with everything
- Native browser API — no build step needed
- Interoperable with any framework
- Chili3D proves it works for CAD
- `dockview` and `lumino` are vanilla-compatible

**Cons:**
- No reactivity system — must build or import one
- Verbose DOM manipulation (Chili3D's code proves this)
- No scoped CSS without Shadow DOM (which has its own issues)
- No component ecosystem — build everything custom
- Developer velocity much lower than framework-based approach

**CAD-specific fit:**
- Maximum flexibility and portability
- Chili3D chose this and it works, but their code is 3x more verbose than equivalent Svelte
- Good for library packages (like @nexus/ui consumed by any framework app)

**Risk:** Development speed. Reinventing reactivity and DOM management.

---

### Lit (Google's Web Components framework)

**Who uses it:** No CAD project studied (but Google uses it for Material Web Components)
**Pros:**
- Reactive properties and declarative templates on top of Web Components
- Tiny runtime (~5kb)
- Native interop with any framework
- Good for building component libraries consumed by others

**Cons:**
- Small ecosystem
- No routing/full-stack solution
- Limited tooling compared to Svelte/React/Vue

**CAD-specific fit:**
- Good option for building @nexus/ui as a distributable component library
- Less good for the main application shell

**Risk:** Small community, uncertain future.

---

## Hybrid Approaches Worth Considering

### A: Svelte App Shell + Vanilla Core Components
- SvelteKit app for routing, layout, state management
- @nexus/ui as vanilla Web Components or Lit elements (framework-agnostic)
- Best of both: fast dev with Svelte, portable components

### B: Svelte App Shell + React for Complex Widgets
- Use Svelte for everything except where React ecosystem is needed
- Embed React components (node editor, complex data grid) via custom element wrappers
- Adds complexity but unlocks React ecosystem

### C: Vanilla Core + Svelte Progressive Enhancement
- Start with vanilla/Lit web components for all UI
- Use Svelte only for the app shell and complex interactive panels
- Maximum portability, slower initial development

---

## Evaluation Matrix

| Criterion | Weight | Svelte 5 | React 18 | Vue 3 | Solid | Web Components | Lit |
|-----------|--------|----------|----------|-------|-------|---------------|-----|
| Render performance (pointer events) | 25% | 9 | 6 | 7 | 9 | 10 | 8 |
| Ecosystem (UI libs, tools) | 20% | 6 | 10 | 7 | 3 | 2 | 4 |
| Developer velocity | 20% | 9 | 7 | 8 | 7 | 4 | 6 |
| Bundle size | 10% | 10 | 5 | 7 | 9 | 10 | 9 |
| WASM interop ergonomics | 10% | 8 | 7 | 7 | 8 | 8 | 8 |
| Three.js integration | 10% | 7 (Threlte) | 9 (R3F) | 5 (TresJS) | 3 | 5 | 4 |
| Portability / no lock-in | 5% | 5 | 4 | 5 | 6 | 10 | 9 |
| **Weighted Total** | | **8.0** | **7.2** | **6.9** | **6.5** | **5.7** | **6.1** |

---

## Open Questions for Deeper Research

1. **Svelte 5 + docking:** Can `dockview` work with Svelte? It claims framework-agnostic but examples are React-heavy.
2. **Svelte 5 + complex data grids:** For entity/layer lists with 10k+ rows, is there a Svelte virtual scroll solution?
3. **Threlte v7 maturity:** How stable is Threlte with Svelte 5 runes? What are the gaps vs R3F?
4. **Web Component interop:** Can we build @nexus/ui as Lit components and consume them in a Svelte app seamlessly?
5. **Performance ceiling:** At what entity count does Svelte's reactivity model start to struggle with property panel updates?

---

## Non-Framework Decisions (Framework-Independent)

These architectural choices apply regardless of framework:

1. **Design tokens** — CSS custom properties (not framework-specific)
2. **Command registry** — Plain TypeScript Map + types
3. **Tool state machines** — Plain TypeScript classes
4. **WASM bridge** — wasm-bindgen + Comlink (framework-independent)
5. **Keyboard handling** — Native DOM events + layered resolver
6. **Event bus** — Typed EventEmitter or framework store
7. **Layout persistence** — localStorage/IndexedDB
