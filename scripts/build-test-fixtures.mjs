#!/usr/bin/env node
// Generate NEXUS-authored DXF fixtures.
//
// Output is byte-deterministic: no timestamps, no random IDs. Fixtures are
// ground truth INDEPENDENT of the code under test (we don't import exportDxf
// here on purpose — if exportDxf has a regression, the fixtures shouldn't
// move with it).
//
// Target: AutoCAD R2000 / AC1015 (NEXUS v0.1 default).

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../packages/file-io/test-fixtures/nexus-authored');

mkdirSync(OUT_DIR, { recursive: true });

// ─── DXF DSL helpers ────────────────────────────────────────────────────────

/** Pair a DXF group code with its value, on two lines, CRLF-terminated. */
function pair(code, value) {
  return `${String(code)}\r\n${String(value)}\r\n`;
}

/** Concatenate group-code/value pairs into a single string. */
function pairs(...rows) {
  return rows.map(([c, v]) => pair(c, v)).join('');
}

/** Standard R2000 (AC1015) HEADER section — minimal but valid. */
function header() {
  return (
    pair(0, 'SECTION') +
    pair(2, 'HEADER') +
    pair(9, '$ACADVER') +
    pair(1, 'AC1015') +
    pair(9, '$INSBASE') +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(9, '$EXTMIN') +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(9, '$EXTMAX') +
    pair(10, 100) +
    pair(20, 100) +
    pair(30, 0) +
    pair(9, '$INSUNITS') +
    pair(70, 6) +
    pair(0, 'ENDSEC')
  );
}

/** Minimal TABLES section — one layer "0", one linetype "CONTINUOUS", one
 *  text style "Standard", one dimstyle "Standard".
 */
function tables() {
  let s = pair(0, 'SECTION') + pair(2, 'TABLES');

  // VPORT
  s += pair(0, 'TABLE') + pair(2, 'VPORT') + pair(70, 1);
  s += pair(0, 'VPORT') + pair(2, '*ACTIVE') + pair(70, 0);
  s += pair(0, 'ENDTAB');

  // LTYPE
  s += pair(0, 'TABLE') + pair(2, 'LTYPE') + pair(70, 1);
  s +=
    pair(0, 'LTYPE') +
    pair(2, 'CONTINUOUS') +
    pair(70, 0) +
    pair(3, 'Solid line') +
    pair(72, 65) +
    pair(73, 0) +
    pair(40, 0);
  s += pair(0, 'ENDTAB');

  // LAYER
  s += pair(0, 'TABLE') + pair(2, 'LAYER') + pair(70, 1);
  s += pair(0, 'LAYER') + pair(2, '0') + pair(70, 0) + pair(62, 7) + pair(6, 'CONTINUOUS');
  s += pair(0, 'ENDTAB');

  // STYLE (TEXT styles)
  s += pair(0, 'TABLE') + pair(2, 'STYLE') + pair(70, 1);
  s +=
    pair(0, 'STYLE') +
    pair(2, 'Standard') +
    pair(70, 0) +
    pair(40, 0) +
    pair(41, 1) +
    pair(50, 0) +
    pair(71, 0) +
    pair(42, 2.5) +
    pair(3, 'txt') +
    pair(4, '');
  s += pair(0, 'ENDTAB');

  // DIMSTYLE
  s += pair(0, 'TABLE') + pair(2, 'DIMSTYLE') + pair(70, 1);
  s +=
    pair(0, 'DIMSTYLE') +
    pair(105, 'A1') +
    pair(2, 'Standard') +
    pair(70, 0) +
    pair(40, 1) +
    pair(41, 2.5) +
    pair(42, 0.625) +
    pair(140, 2.5) +
    pair(141, 2.5) +
    pair(143, 25.4) +
    pair(147, 0.625);
  s += pair(0, 'ENDTAB');

  s += pair(0, 'ENDSEC');
  return s;
}

/** Empty BLOCKS section (required for R2000). */
function blocks() {
  return (
    pair(0, 'SECTION') +
    pair(2, 'BLOCKS') +
    pair(0, 'BLOCK') +
    pair(2, '*Model_Space') +
    pair(70, 0) +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(3, '*Model_Space') +
    pair(1, '') +
    pair(0, 'ENDBLK') +
    pair(0, 'BLOCK') +
    pair(2, '*Paper_Space') +
    pair(70, 0) +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(3, '*Paper_Space') +
    pair(1, '') +
    pair(0, 'ENDBLK') +
    pair(0, 'ENDSEC')
  );
}

function entities(body) {
  return pair(0, 'SECTION') + pair(2, 'ENTITIES') + body + pair(0, 'ENDSEC');
}

function eof() {
  return pair(0, 'EOF');
}

/** Wrap an ENTITIES-section body into a complete R2000 DXF file. */
function wrap(body) {
  return header() + tables() + blocks() + entities(body) + eof();
}

// ─── Per-entity-type fixture builders ───────────────────────────────────────

function fxLine() {
  const body =
    pair(0, 'LINE') +
    pair(8, '0') +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(11, 100) +
    pair(21, 50) +
    pair(31, 0);
  return wrap(body);
}

function fxPolyline() {
  // LWPOLYLINE — 4 vertices, closed
  const body =
    pair(0, 'LWPOLYLINE') +
    pair(8, '0') +
    pair(90, 4) +
    pair(70, 1) +
    pair(10, 0) +
    pair(20, 0) +
    pair(10, 50) +
    pair(20, 0) +
    pair(10, 50) +
    pair(20, 30) +
    pair(10, 0) +
    pair(20, 30);
  return wrap(body);
}

function fxCircle() {
  const body =
    pair(0, 'CIRCLE') + pair(8, '0') + pair(10, 25) + pair(20, 25) + pair(30, 0) + pair(40, 10);
  return wrap(body);
}

function fxArc() {
  // 90° arc
  const body =
    pair(0, 'ARC') +
    pair(8, '0') +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(40, 20) +
    pair(50, 0) +
    pair(51, 90);
  return wrap(body);
}

function fxRectangle() {
  // Rectangle = closed LWPOLYLINE with 4 vertices. Carry a NEXUS XDATA hint
  // so importers can flag it as an authored rectangle, not an arbitrary
  // polyline. (XDATA app name "NEXUS" must be registered in TABLES → APPID
  // for strict audits; we keep this minimal by leaving APPID off — ezdxf
  // will warn, not error, which the advisory mode tolerates.)
  const body =
    pair(0, 'LWPOLYLINE') +
    pair(8, '0') +
    pair(90, 4) +
    pair(70, 1) +
    pair(10, 10) +
    pair(20, 10) +
    pair(10, 60) +
    pair(20, 10) +
    pair(10, 60) +
    pair(20, 40) +
    pair(10, 10) +
    pair(20, 40);
  return wrap(body);
}

function fxEllipse() {
  // ELLIPSE — center, major-axis endpoint, minor/major ratio, start/end params
  const body =
    pair(0, 'ELLIPSE') +
    pair(8, '0') +
    pair(10, 50) +
    pair(20, 50) +
    pair(30, 0) +
    pair(11, 30) +
    pair(21, 0) +
    pair(31, 0) +
    pair(40, 0.5) +
    pair(41, 0) +
    pair(42, 6.283185307179586);
  return wrap(body);
}

function fxText() {
  const body =
    pair(0, 'TEXT') +
    pair(8, '0') +
    pair(10, 5) +
    pair(20, 5) +
    pair(30, 0) +
    pair(40, 2.5) +
    pair(1, 'NEXUS fixture') +
    pair(7, 'Standard');
  return wrap(body);
}

function fxDimension() {
  // Aligned linear dimension. Type flag 70 = 1 (aligned).
  // Definition points: 10 (dim line midpoint), 13 (1st extension origin),
  // 14 (2nd extension origin).
  const body =
    pair(0, 'DIMENSION') +
    pair(8, '0') +
    pair(2, '*D1') + // referenced block name (we omit the block; advisory)
    pair(10, 50) + // dim line definition point
    pair(20, 12) +
    pair(30, 0) +
    pair(11, 50) + // text midpoint
    pair(21, 12) +
    pair(31, 0) +
    pair(70, 1) + // aligned
    pair(13, 0) + // 1st extension line origin
    pair(23, 0) +
    pair(33, 0) +
    pair(14, 100) + // 2nd extension line origin
    pair(24, 0) +
    pair(34, 0) +
    pair(3, 'Standard'); // dim style name
  return wrap(body);
}

function fxHatch() {
  // ANSI31 (45° lines). Single rectangular boundary path made of 4 polyline
  // edges. Pattern is non-solid (70=0), associative=0, boundary count=1,
  // path type=2 (polyline path).
  const body =
    pair(0, 'HATCH') +
    pair(8, '0') +
    pair(10, 0) + // elevation point
    pair(20, 0) +
    pair(30, 0) +
    pair(210, 0) + // extrusion direction
    pair(220, 0) +
    pair(230, 1) +
    pair(2, 'ANSI31') + // pattern name
    pair(70, 0) + // solid fill flag (0 = pattern fill)
    pair(71, 0) + // associativity (0 = non-associative)
    pair(91, 1) + // number of boundary paths
    // ── boundary path ──
    pair(92, 7) + // path type flag: 1=external + 2=polyline + 4=derived
    pair(72, 1) + // has bulge
    pair(73, 1) + // is closed
    pair(93, 4) + // num vertices
    pair(10, 0) +
    pair(20, 0) +
    pair(42, 0) +
    pair(10, 40) +
    pair(20, 0) +
    pair(42, 0) +
    pair(10, 40) +
    pair(20, 25) +
    pair(42, 0) +
    pair(10, 0) +
    pair(20, 25) +
    pair(42, 0) +
    pair(97, 0) + // num source boundary objects
    // ── pattern data ──
    pair(75, 0) + // hatch style (0 = normal/odd parity)
    pair(76, 1) + // pattern type (1 = predefined)
    pair(52, 0) + // pattern angle
    pair(41, 1) + // pattern scale
    pair(77, 0) + // pattern double flag
    pair(78, 1) + // num pattern definition lines
    pair(53, 45) + // line angle
    pair(43, 0) + // base x
    pair(44, 0) + // base y
    pair(45, -2.2) + // offset x
    pair(46, 2.2) + // offset y
    pair(79, 0) + // num dash items
    pair(98, 0); // num seed points
  return wrap(body);
}

function fxSpline() {
  // SPLINE — open, degree-3, 4 control points. Knot vector: 4 zeros + 4 ones
  // (numKnots = N + p + 1 = 4 + 3 + 1 = 8). No internal knots for N - p - 1 = 0.
  // Flags 70: bit 8 (planar) = 8.
  const body =
    pair(0, 'SPLINE') +
    pair(8, '0') +
    pair(70, 8) +
    pair(71, 3) +
    pair(72, 8) +
    pair(73, 4) +
    pair(74, 0) +
    pair(40, 0) +
    pair(40, 0) +
    pair(40, 0) +
    pair(40, 0) +
    pair(40, 1) +
    pair(40, 1) +
    pair(40, 1) +
    pair(40, 1) +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(10, 25) +
    pair(20, 50) +
    pair(30, 0) +
    pair(10, 75) +
    pair(20, 50) +
    pair(30, 0) +
    pair(10, 100) +
    pair(20, 0) +
    pair(30, 0);
  return wrap(body);
}

function fxLeader() {
  // LEADER (legacy, single-line; MLEADER would require dictionaries).
  // 3 vertices, arrow at first point, attached to no annotation.
  const body =
    pair(0, 'LEADER') +
    pair(8, '0') +
    pair(3, 'Standard') + // dim style name
    pair(71, 1) + // arrowhead enabled
    pair(72, 0) + // path type: straight line
    pair(73, 3) + // creation flag: text annotation (0=text, 3=none)
    pair(74, 0) + // hookline direction
    pair(75, 0) + // hookline flag (0 = no hookline)
    pair(40, 2.5) + // text height
    pair(41, 0) + // text width
    pair(76, 3) + // num vertices
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(10, 10) +
    pair(20, 10) +
    pair(30, 0) +
    pair(10, 25) +
    pair(20, 10) +
    pair(30, 0);
  return wrap(body);
}

function fxRay() {
  // RAY — semi-infinite from origin in direction. 10/20/30 = origin,
  // 11/21/31 = unit direction vector.
  const body =
    pair(0, 'RAY') +
    pair(8, '0') +
    pair(10, 10) +
    pair(20, 20) +
    pair(30, 0) +
    pair(11, 1) +
    pair(21, 0) +
    pair(31, 0);
  return wrap(body);
}

function fxXline() {
  // XLINE — infinite construction line through origin in direction.
  const body =
    pair(0, 'XLINE') +
    pair(8, '0') +
    pair(10, 5) +
    pair(20, 5) +
    pair(30, 0) +
    pair(11, 0) +
    pair(21, 1) +
    pair(31, 0);
  return wrap(body);
}

function fxWipeout() {
  // WIPEOUT — IMAGE-derived entity with identity transform. Boundary in 14/24.
  // Closed quad: 5 entries (last duplicates first per AutoCAD convention).
  // R2000 requires AcDbEntity + AcDbRasterImage subclass markers; ezdxf reads
  // boundary 14 codes from subclass index 2 (AcDbRasterImage) and crashes if
  // the markers are missing.
  const body =
    pair(0, 'WIPEOUT') +
    pair(100, 'AcDbEntity') +
    pair(8, '0') +
    pair(100, 'AcDbRasterImage') +
    pair(90, 0) +
    pair(10, 0) +
    pair(20, 0) +
    pair(30, 0) +
    pair(11, 1) +
    pair(21, 0) +
    pair(31, 0) +
    pair(12, 0) +
    pair(22, 1) +
    pair(32, 0) +
    pair(13, 1) +
    pair(23, 1) +
    pair(70, 7) +
    pair(280, 1) +
    pair(281, 50) +
    pair(282, 50) +
    pair(283, 0) +
    pair(71, 2) +
    pair(91, 5) +
    pair(14, 10) +
    pair(24, 10) +
    pair(14, 30) +
    pair(24, 10) +
    pair(14, 30) +
    pair(24, 25) +
    pair(14, 10) +
    pair(24, 25) +
    pair(14, 10) +
    pair(24, 10);
  return wrap(body);
}

// ─── Drive ──────────────────────────────────────────────────────────────────

const FIXTURES = {
  'line.dxf': fxLine,
  'polyline.dxf': fxPolyline,
  'circle.dxf': fxCircle,
  'arc.dxf': fxArc,
  'rectangle.dxf': fxRectangle,
  'ellipse.dxf': fxEllipse,
  'spline.dxf': fxSpline,
  'text.dxf': fxText,
  'dimension.dxf': fxDimension,
  'hatch.dxf': fxHatch,
  'leader.dxf': fxLeader,
  'ray.dxf': fxRay,
  'xline.dxf': fxXline,
  'wipeout.dxf': fxWipeout,
};

let written = 0;
for (const [name, build] of Object.entries(FIXTURES)) {
  const path = join(OUT_DIR, name);
  writeFileSync(path, build(), { encoding: 'utf-8' });
  written += 1;
}

console.log(`Wrote ${written} fixtures to ${OUT_DIR}`);
