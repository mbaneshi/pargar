# AutoCAD parity — model-driven test pattern

This directory holds one pair of files per command we claim parity with:

- `<command>.model.ts` — canonical **state-machine model** of the AutoCAD
  command. Pure data: states (prompts), transitions (valid inputs), invariants
  (always-available inputs like pan/zoom/Esc/F-keys). Sourced from Autodesk's
  public Command Reference and System Variables Reference, cross-checked
  against BricsCAD documentation where needed.
- `<command>.spec.ts` — **Playwright driver** that asserts our implementation
  against the model. One test per state prompt, one per transition, one per
  invariant × state.

Shared types live in `types.ts`.

## How to read a failing test

A red test in this directory is a **parity gap**, not a broken test.
Do **not** fix by weakening the assertion. Fix by bringing the implementation
(`packages/app/src/lib/shell/tools/<Command>Handler.ts`) closer to the model.

Known gaps are marked `test.fixme(...)` so CI stays green. When a gap closes,
remove the `.fixme` and the test becomes a regression guard.

## How to add a new command

1. **Model the AutoCAD command** in `<command>.model.ts`:
   - Read the official Command Reference page.
   - List every prompt variant (states).
   - List every valid input per state (transitions).
   - Note which sysvars change behavior.
2. **Write the driver** in `<command>.spec.ts`:
   - One `test(...)` per state prompt.
   - One `test(...)` per transition.
   - One `test(...)` per invariant that matters (Esc, pan, F-keys).
   - Mark known gaps with `test.fixme(...)`.
3. **Run** `pnpm exec playwright test e2e/parity/<command>.spec.ts`.
4. **Fix implementation** until fixmes can be removed.

## What this pattern does and doesn't catch

**Catches (mechanically, no human needed):**
- Wrong or missing prompt strings.
- Wrong or missing option keywords (e.g. `[Through/Erase/Layer]`).
- Wrong defaults (angle-bracket values).
- Missing transitions (e.g. our OFFSET skips the "specify side" state entirely).
- Broken invariants (e.g. F8 doesn't work mid-command).

**Does not catch:**
- Latency, frame time, perceived smoothness.
- Snap-marker glow timing, cursor sticking.
- Rubber-band redraw quality.
- Whether the user *enjoys* the experience.

Those belong to a different verification path (performance instrumentation
and, eventually, human review of opted-in recorded sessions).

## Why this is separate from `e2e/autocad-parity.spec.ts`

The root `autocad-parity.spec.ts` checks DOM surface exists (crosshair
elements, toolbar labels, status toggles). Useful but structural only.

This directory goes one layer deeper: it asserts **command-level state-machine
behavior** against an external spec. Different scope, different authoring
model, separate directory.
