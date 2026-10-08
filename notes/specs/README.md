# AutoCAD Parity Audit — Methodology & Schema

This directory contains machine-readable behavior specifications for AutoCAD commands (the ground truth) and NEXUS implementations (the audit), plus runtime probe specs and gap reports.

## The four-artifact pattern

For each command, produce four files:

```
notes/specs/autocad-2d/commands/{cmd}.yaml    ← what AutoCAD does (the spec)
notes/specs/nexus-2d/commands/{cmd}.code.yaml ← what NEXUS code says it does (the audit)
e2e/probe-{cmd}.spec.ts                       ← what NEXUS actually does at runtime (the probe)
notes/gaps/{cmd}.md                            ← three-way diff + classified gap report
```

Plus a runtime trace emitted by the probe:
```
notes/runtime-traces/{cmd}.trace.json          ← machine-readable probe observations
```

## How to extract an AutoCAD spec

### Sources (in trust order)

1. **BricsCAD docs** (`help.bricsys.com/en-us/document/command-reference/`) — best primary source. AutoCAD-compatible by design. Plain HTML, renders through WebFetch. Use as Tier-1 default.

2. **`acad.pgp` mirrors** — canonical alias file. Use `stress-free.co.nz` mirror (has standard Autodesk defaults). Cross-validate against a second mirror. Beware custom alias schemes on tutorial sites.

3. **Autodesk's official command reference** (`help.autodesk.com/view/ACD/2024/ENU/`) — authoritative but SPA; WebFetch returns the bootloader JS, not content. Use search snippets for cross-validation. Occasionally Autodesk blog posts (separate domain, plain HTML) have command deep-dives that work.

4. **CAD Forum** (`cadforum.cz/en/command.asp?cmd=X`) — concise per-command pages with prompt strings, options, and sysvars. Plain HTML. Good for cross-validation.

5. **Community forums** (Autodesk Forums, CADTutor, Reddit r/AutoCAD) — for edge cases and undocumented behavior. Use only for `unverified` entries.

6. **Open-source AutoCAD-compatible implementations** (LibreCAD, NanoCAD, DraftSight docs) — for cross-validation on disputed behavior.

### Provenance discipline

Every fact in the spec must have a `provenance` entry at the bottom of the YAML with:
- `sources`: list of URLs or named references
- `confidence`: high / medium / low
- `note`: optional clarification

Facts without two independent sources go into the `unverified` list at the bottom.

### What to extract per command

```yaml
command: NAME
aliases: [...]
prompts:
  - id: step_name
    text: "exact prompt string with {SYSVAR} placeholders"
    accepts:
      - kind: pick | number | keyword | enter | escape | shift_pick
        value: X (for keywords)
        action: what_happens
options:
  OptionName:
    desc: one-liner
    sub_prompt: "text if this option has a sub-prompt"
sysvars_read: [...]
sysvars_written: [...]
sysvar_definitions:
  VARNAME:
    type: integer | real | string
    default: value
    persistence: drawing | registry
    valid_values: { ... }
repeats_with_space: true | false
modeless_during_command:
  fkeys: { F3: ok, F8: ok, ... }
  transparent_commands: ["'PAN", "'ZOOM"]
cancel_semantics:
  esc_once: end_command | step_back
power_user_patterns:
  pattern_name:
    description: what the pattern is and why it matters
```

## How to audit NEXUS code

1. Find the handler: `packages/app/src/lib/shell/tools/{Cmd}Handler.ts`
2. Find the registry entry: `packages/app/src/lib/commands/registerBuiltinCommands.ts`
3. Find the kernel function: grep for `{Cmd}Entity` or `fn {cmd}` in `packages/kernel/src/`
4. Extract into the same YAML schema with `NOT_IMPLEMENTED`, `ABSENT`, `PARTIAL` markers
5. Note `audit_findings` at the bottom: severity + category per finding

## How to write a runtime probe

Probe specs live at `e2e/probe-{cmd}.spec.ts`. Each probe:

1. Draws a known setup (line, cross, L-shape, etc.) using `drawLine` helper
2. Activates the command via `typeCmd(page, alias)`
3. For each dimension in the spec: captures the prompt text, takes an action, records the observation
4. Emits a `notes/runtime-traces/{cmd}.trace.json` file with structured observations

Each observation has: `id`, `stage`, `expected`, `observed`, `verdict` (match/mismatch/absent), `evidence`.

Run all probes: `pnpm exec playwright test e2e/probe-*.spec.ts`

## How to write the gap report

Gap reports live at `notes/gaps/{cmd}.md`. Structure:

1. **Top-line summary** — gap count, critical/high/medium breakdown, NEXUS coverage %
2. **Gap table** — one row per dimension: spec value, NEXUS value, runtime value, class (DESIGN/IMPL/GRAMMAR/STATE/CTX/MODELESS/KERNEL/AI-PARITY), severity
3. **Fix path summary** — grouped by effort: quick wins, small features, new design surface, kernel work, platform-level

## Gap classification

| Class | Meaning |
|---|---|
| DESIGN | Feature never planned; needs new design |
| IMPL | Coded but broken; needs debugging |
| GRAMMAR | Prompt text, alias, option keyword mismatch |
| STATE | Sysvar / persistence / recall missing |
| CTX | Context-aware UI (menus, right-click) mismatch |
| MODELESS | F-keys, transparent commands, mid-command behavior |
| KERNEL | Geometry computation missing in Rust |
| AI-PARITY | MCP schema doesn't expose what human surface has |

## Cost model

Per command, end-to-end: ~30 minutes.
- Research/spec extraction: ~15 min (LLM-assisted)
- Code audit: ~5 min (grep + read)
- Probe scaffold: ~5 min (reusable pattern)
- Gap report: ~5 min (diff + classify)

Top 30 commands: ~15 hours. Full 600: ~300 hours (but diminishing returns after ~30; platform gaps stabilize by then).

## Roll-up reports

`notes/gaps/ROLLUP.md` aggregates patterns across audited commands. Updated after each new batch. Identifies shared infrastructure gaps and ranks them by impact.

## Command priority list (suggested order)

Tier 1 — audit these first (high usage, diverse shapes):
```
OFFSET, TRIM, FILLET (done)
LINE, CIRCLE, PLINE, RECTANG (draw fundamentals)
COPY, MOVE, ROTATE, SCALE, MIRROR (modify fundamentals)
HATCH, DIMENSION (annotation)
```

Tier 2 — audit after platform infrastructure lands:
```
ARRAY, STRETCH, CHAMFER, EXTEND, BREAK, JOIN, EXPLODE, LENGTHEN
TEXT, MTEXT, LEADER, DIMLINEAR, DIMALIGNED, DIMRADIUS
LAYER, PROPERTIES, MATCHPROP
```

Tier 3 — audit when expanding toward full parity:
```
BLOCK, INSERT, WBLOCK, XREF, GROUP
PEDIT, SPLINEDIT, HATCHEDIT
PLOT, PAGESETUP, LAYOUT
ZOOM, PAN (transparent command details)
all remaining commands
```
