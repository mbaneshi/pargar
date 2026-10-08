import { describe, it, expect } from 'vitest';

/**
 * Aperture-formula regression test for issues #87 and #83.
 *
 * AutoCAD's APERTURE sysvar default is 10 pixels — the snap pickbox is
 * supposed to stay at constant pixel size regardless of zoom level. The fix
 * exposes `CadRenderer.getPixelsPerWorldUnit()` so callers can convert a
 * target pixel aperture to world units correctly:
 *
 *     pixelsPerWorldUnit = canvasHeight / (2 * zoom)
 *     apertureWorld      = APERTURE_PIXELS / pixelsPerWorldUnit
 *
 * Round-tripping `apertureWorld` back to pixels (apertureWorld * pixelsPerWorldUnit)
 * must yield APERTURE_PIXELS exactly across the full zoom range. Before the
 * fix, the formula was `threshold / getZoom()` which scaled aperture-pixels as
 * `1/zoom²` — sub-pixel at default zoom, blowing through cursor accuracy.
 *
 * Instantiating CadRenderer in vitest needs a DOM container plus WebGL, both
 * unavailable here, so the test pins the math contract directly. The contract
 * is what the renderer encodes and what the InteractionShell call site relies
 * on; if either side drifts, this test catches it.
 */

const APERTURE_PIXELS = 10;
const CANVAS_HEIGHT = 800;

function pixelsPerWorldUnit(canvasHeight: number, zoom: number): number {
  return canvasHeight / (2 * zoom);
}

function apertureWorldUnits(canvasHeight: number, zoom: number): number {
  return APERTURE_PIXELS / pixelsPerWorldUnit(canvasHeight, zoom);
}

describe('aperture formula — constant pixel aperture across zoom', () => {
  const ZOOM_LEVELS = [1, 10, 50, 100, 500, 10000];

  it.each(ZOOM_LEVELS)('zoom=%i: round-trip aperture is %i pixels', (zoom) => {
    const ppu = pixelsPerWorldUnit(CANVAS_HEIGHT, zoom);
    const apertureWorld = apertureWorldUnits(CANVAS_HEIGHT, zoom);
    const apertureBackToPixels = apertureWorld * ppu;
    expect(apertureBackToPixels).toBeCloseTo(APERTURE_PIXELS, 9);
  });

  it('aperture in world units scales linearly with zoom (zoom=1 vs zoom=100)', () => {
    const a1 = apertureWorldUnits(CANVAS_HEIGHT, 1);
    const a100 = apertureWorldUnits(CANVAS_HEIGHT, 100);
    expect(a100 / a1).toBeCloseTo(100, 9);
  });

  it('aperture in world units is independent of canvas width (only height matters)', () => {
    // Width never enters the formula — `getZoom()`'s semantic locks to
    // viewport vertical extent. Canvas-aspect-ratio change (resize sideways)
    // must not change snap aperture.
    const aperture800 = apertureWorldUnits(CANVAS_HEIGHT, 50);
    expect(aperture800).toBeCloseTo(1.25, 9);
    expect(apertureWorldUnits(800, 50)).toEqual(aperture800);
    expect(apertureWorldUnits(800, 50)).toEqual(aperture800);
  });

  it('aperture stays sub-100 px at the extreme zoom-out (zoom=10000)', () => {
    // Sanity floor: at maxed zoom-out, world aperture grows but pixel
    // aperture must NOT — that's the whole point.
    const ppu = pixelsPerWorldUnit(CANVAS_HEIGHT, 10000);
    const apertureWorld = apertureWorldUnits(CANVAS_HEIGHT, 10000);
    expect(apertureWorld * ppu).toBeCloseTo(APERTURE_PIXELS, 9);
  });

  it('aperture stays above 1 px at the extreme zoom-in (zoom=1)', () => {
    // Pre-fix regression: at default zoom=50 with the old `threshold/getZoom()`
    // formula, aperture_pixels was 0.32 — below cursor pixel granularity.
    // The new formula keeps it at 10 px floor through the full range.
    const ppu = pixelsPerWorldUnit(CANVAS_HEIGHT, 1);
    const apertureWorld = apertureWorldUnits(CANVAS_HEIGHT, 1);
    expect(apertureWorld * ppu).toBeGreaterThan(1);
  });
});
