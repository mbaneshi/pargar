# NEXUS vs AutoCAD 2D — E2E Test Report

**Date:** 2026-04-14
**Target:** (the hosted build at the time of this report)
**Results:** 41/41 passed (100%)

## Tier 1 — UX Parity (28 tests)

| Test | Status |
|------|--------|
| crosshair-visible | PASS |
| aperture-box-visible | PASS |
| snap-marker-endpoint | PASS |
| snap-label-visible | PASS |
| dynamic-input-visible | PASS |
| ucs-icon-visible | PASS |
| ribbon-draw-panel-visible | PASS |
| ribbon-modify-panel-visible | PASS |
| ribbon-annotate-panel-visible | PASS |
| ribbon-constrain-panel-visible | PASS |
| ribbon-edit-panel-visible | PASS |
| layer-dropdown-in-toolbar | PASS |
| status-bar-osnap-toggle | PASS |
| status-bar-ortho-toggle | PASS |
| status-bar-polar-toggle | PASS |
| status-bar-dynin-toggle | PASS |
| status-bar-grid-toggle | PASS |
| right-click-context-menu | PASS |
| model-tab-at-bottom | PASS |
| dark-theme-active | PASS |
| command-history-shows-actual-commands | PASS |
| command-autocomplete | PASS |
| up-arrow-recalls-command | PASS |
| line-tool-creates-entity | PASS |
| undo-reduces-entity-count | PASS |
| F8-toggles-ortho | PASS |
| screenshot-full-app | PASS |
| screenshot-drawing-state | PASS |

## Tier 2 — Functional Depth (8 tests)

| Test | Status |
|------|--------|
| coordinate-input-absolute (10,5) | PASS |
| coordinate-input-relative (@20,0) | PASS |
| coordinate-input-polar (@10<45) | PASS |
| text-tool-creates-entity | PASS |
| dimension-tool-creates-entity | PASS |
| ortho-constrains-lines | PASS |
| shift-click-multi-select | PASS |
| properties-panel-shows-no-selection-state | PASS |

## Tier 3 — Edge Cases (5 tests)

| Test | Status |
|------|--------|
| fillet-r0-corner-cleanup | PASS |
| extend-non-intersecting-fails-gracefully | PASS |
| undo-redo-10-operations | PASS |
| 50-entities-performance | PASS |
| wasm-loads-under-3-seconds | PASS |
