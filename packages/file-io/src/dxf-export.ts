/**
 * Export kernel entities to DXF format string.
 * Generates a minimal but valid DXF R12/R2000 file.
 */
import { createLogger } from '@nexus/logger';
import { serializeSysvarsToHeaderLines } from './dxf-sysvars.js';

const log = createLogger('file-io:dxf-export');

interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  linetype?: string;
}

function hexToAci(hex: string): number {
  const map: Record<string, number> = {
    '#ff0000': 1,
    '#ffff00': 2,
    '#00ff00': 3,
    '#00ffff': 4,
    '#0000ff': 5,
    '#ff00ff': 6,
    '#ffffff': 7,
    '#808080': 8,
    '#c0c0c0': 9,
    '#00ff88': 3,
  };
  return map[hex.toLowerCase()] || 7;
}

const LTYPE_DEFS: Record<string, { description: string; pattern: number[] }> = {
  CONTINUOUS: { description: 'Solid line', pattern: [] },
  DASHED: { description: '_ _ _ _ _', pattern: [0.5, -0.25] },
  HIDDEN: { description: '_ _ _ _ _', pattern: [0.25, -0.125] },
  CENTER: { description: '___ _ ___ _ ___', pattern: [1.25, -0.25, 0.25, -0.25] },
  DOT: { description: '. . . . .', pattern: [0, -0.25] },
  DASHDOT: { description: '___ . ___ .', pattern: [0.5, -0.25, 0, -0.25] },
};

function writeLtypeTable(lines: string[]) {
  lines.push('0', 'TABLE');
  lines.push('2', 'LTYPE');
  lines.push('70', String(Object.keys(LTYPE_DEFS).length));

  for (const [name, def] of Object.entries(LTYPE_DEFS)) {
    lines.push('0', 'LTYPE');
    lines.push('2', name);
    lines.push('70', '0');
    lines.push('3', def.description);
    lines.push('72', '65'); // alignment code 'A'
    lines.push('73', String(def.pattern.length));
    const totalLen = def.pattern.reduce((a, b) => a + Math.abs(b), 0);
    lines.push('40', String(totalLen));
    for (const seg of def.pattern) {
      lines.push('49', String(seg));
    }
  }

  lines.push('0', 'ENDTAB');
}

function writeEntityStyleCodes(lines: string[], ent: any) {
  if (ent.color) {
    const aci = hexToAci(ent.color);
    if (aci !== 7) {
      lines.push('62', String(aci));
    }
  }
  if (ent.linetype && ent.linetype.toUpperCase() !== 'CONTINUOUS') {
    lines.push('6', ent.linetype.toUpperCase());
  }
}

interface DimStyleExport {
  name: string;
  dimscale?: number;
  dimtxt?: number;
  dimasz?: number;
  dimexo?: number;
  dimexe?: number;
  dimgap?: number;
  dimtad?: number;
  dimtxsty?: string;
}

function writeDimStyleTable(lines: string[], styles: DimStyleExport[]) {
  // DXF DIMSTYLE table — group codes follow R2000 conventions.
  // Each dim style entry maps NEXUS field names to DXF group codes.
  lines.push('0', 'TABLE');
  lines.push('2', 'DIMSTYLE');
  lines.push('70', String(styles.length));

  for (const ds of styles) {
    lines.push('0', 'DIMSTYLE');
    lines.push('2', ds.name);
    lines.push('70', '0');
    lines.push('40', String(ds.dimscale ?? 1.0)); // DIMSCALE
    lines.push('41', String(ds.dimasz ?? 2.5)); // DIMASZ
    lines.push('42', String(ds.dimexo ?? 0.625)); // DIMEXO
    lines.push('44', String(ds.dimexe ?? 1.25)); // DIMEXE
    lines.push('140', String(ds.dimtxt ?? 2.5)); // DIMTXT
    lines.push('147', String(ds.dimgap ?? 0.625)); // DIMGAP
    lines.push('77', String(ds.dimtad ?? 1)); // DIMTAD
    if (ds.dimtxsty) {
      lines.push('340', ds.dimtxsty); // DIMTXSTY (text style name reference)
    }
  }

  lines.push('0', 'ENDTAB');
}

interface DwgPropsExport {
  title?: string;
  subject?: string;
  author?: string;
  keywords?: string;
  comments?: string;
  hyperlink_base?: string;
  last_saved_by?: string;
}

interface NamedViewExport {
  name: string;
  center_x: number;
  center_y: number;
  zoom: number;
  rotation?: number;
}

interface NamedUcsExport {
  name: string;
  origin: { x: number; y: number };
  x_axis: { x: number; y: number };
  y_axis: { x: number; y: number };
}

export function exportDxf(
  entitiesJson: string,
  layersJson?: string,
  textStylesJson?: string,
  dimStylesJson?: string,
  dwgPropsJson?: string,
  namedViewsJson?: string,
  namedUcsJson?: string,
  sysvarsJson?: string,
): string {
  let entities: any[];
  try {
    entities = JSON.parse(entitiesJson);
  } catch {
    return '';
  }

  log.info('DXF export started', {
    entityCount: entities.length,
    layerCount: layersJson ? JSON.parse(layersJson).length : 1,
  });

  let layers: Layer[];
  if (layersJson) {
    try {
      layers = JSON.parse(layersJson);
    } catch {
      layers = [{ id: '0', name: '0', color: '#ffffff', visible: true, locked: false }];
    }
  } else {
    layers = [{ id: '0', name: '0', color: '#ffffff', visible: true, locked: false }];
  }

  const layerNameMap = new Map<string, string>();
  for (const layer of layers) {
    layerNameMap.set(layer.id, layer.name);
  }

  const lines: string[] = [];

  // Parse drawing properties for inclusion in HEADER section.
  let dwgProps: DwgPropsExport = {};
  if (dwgPropsJson) {
    try {
      dwgProps = JSON.parse(dwgPropsJson) as DwgPropsExport;
    } catch {
      // ignore parse error
    }
  }

  // Header section
  lines.push('0', 'SECTION');
  lines.push('2', 'HEADER');
  lines.push('9', '$ACADVER');
  lines.push('1', 'AC1015'); // AutoCAD 2000
  lines.push('9', '$INSUNITS');
  lines.push('70', '6'); // meters
  if (dwgProps.title) {
    lines.push('9', '$TITLE');
    lines.push('1', dwgProps.title);
  }
  if (dwgProps.subject) {
    lines.push('9', '$SUBJECT');
    lines.push('1', dwgProps.subject);
  }
  if (dwgProps.author) {
    lines.push('9', '$AUTHOR');
    lines.push('1', dwgProps.author);
  }
  if (dwgProps.keywords) {
    lines.push('9', '$KEYWORDS');
    lines.push('1', dwgProps.keywords);
  }
  if (dwgProps.comments) {
    lines.push('9', '$COMMENTS');
    lines.push('1', dwgProps.comments);
  }
  if (dwgProps.hyperlink_base) {
    lines.push('9', '$HYPERLINKBASE');
    lines.push('1', dwgProps.hyperlink_base);
  }
  if (dwgProps.last_saved_by) {
    lines.push('9', '$LASTSAVEDBY');
    lines.push('1', dwgProps.last_saved_by);
  }
  // S4-A: kernel sysvars round-tripped through HEADER section.
  if (sysvarsJson) {
    lines.push(...serializeSysvarsToHeaderLines(sysvarsJson));
  }
  lines.push('0', 'ENDSEC');

  // Tables section
  lines.push('0', 'SECTION');
  lines.push('2', 'TABLES');

  // LTYPE table
  writeLtypeTable(lines);

  // Layer table
  lines.push('0', 'TABLE');
  lines.push('2', 'LAYER');
  lines.push('70', String(layers.length));

  for (const layer of layers) {
    lines.push('0', 'LAYER');
    lines.push('2', layer.name);
    lines.push('70', layer.locked ? '4' : '0');
    lines.push('62', String(hexToAci(layer.color)));
    lines.push('6', layer.linetype?.toUpperCase() || 'CONTINUOUS');
  }

  lines.push('0', 'ENDTAB');

  // STYLE table
  let textStyles: any[] = [];
  if (textStylesJson) {
    try {
      textStyles = JSON.parse(textStylesJson);
    } catch {
      // ignore
    }
  }
  if (textStyles.length > 0) {
    lines.push('0', 'TABLE');
    lines.push('2', 'STYLE');
    lines.push('70', String(textStyles.length));
    for (const ts of textStyles) {
      lines.push('0', 'STYLE');
      lines.push('2', ts.name);
      lines.push('70', '0');
      lines.push('40', String(ts.height ?? 0));
      lines.push('41', String(ts.width_factor ?? 1));
      lines.push('50', String(ts.oblique_angle ?? 0));
      lines.push('3', ts.font_family ?? 'txt');
    }
    lines.push('0', 'ENDTAB');
  }

  // DIMSTYLE table — built from kernel.dim_styles when provided, otherwise Standard fallback.
  let dimStyles: DimStyleExport[] = [{ name: 'Standard' }];
  if (dimStylesJson) {
    try {
      const parsed = JSON.parse(dimStylesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        dimStyles = parsed;
      }
    } catch {
      // ignore parse error, fall through to Standard
    }
  }
  writeDimStyleTable(lines, dimStyles);

  // VIEW table — named camera viewpoints.
  let namedViews: NamedViewExport[] = [];
  if (namedViewsJson) {
    try {
      const parsed = JSON.parse(namedViewsJson);
      if (Array.isArray(parsed)) namedViews = parsed;
    } catch {
      // ignore
    }
  }
  if (namedViews.length > 0) {
    lines.push('0', 'TABLE');
    lines.push('2', 'VIEW');
    lines.push('70', String(namedViews.length));
    for (const v of namedViews) {
      lines.push('0', 'VIEW');
      lines.push('2', v.name);
      lines.push('70', '0');
      lines.push('40', String(Math.max(v.zoom, 0.01))); // view height
      lines.push('12', String(v.center_x));
      lines.push('22', String(v.center_y));
      lines.push('41', String(Math.max(v.zoom, 0.01))); // view width (use same)
      lines.push('50', String(((v.rotation ?? 0) * 180) / Math.PI));
    }
    lines.push('0', 'ENDTAB');
  }

  // UCS table — named coordinate systems.
  let namedUcs: NamedUcsExport[] = [];
  if (namedUcsJson) {
    try {
      const parsed = JSON.parse(namedUcsJson);
      if (Array.isArray(parsed)) namedUcs = parsed;
    } catch {
      // ignore
    }
  }
  if (namedUcs.length > 0) {
    lines.push('0', 'TABLE');
    lines.push('2', 'UCS');
    lines.push('70', String(namedUcs.length));
    for (const u of namedUcs) {
      lines.push('0', 'UCS');
      lines.push('2', u.name);
      lines.push('70', '0');
      lines.push('10', String(u.origin.x));
      lines.push('20', String(u.origin.y));
      lines.push('11', String(u.x_axis.x));
      lines.push('21', String(u.x_axis.y));
      lines.push('12', String(u.y_axis.x));
      lines.push('22', String(u.y_axis.y));
    }
    lines.push('0', 'ENDTAB');
  }

  lines.push('0', 'ENDSEC');

  // Entities section
  lines.push('0', 'SECTION');
  lines.push('2', 'ENTITIES');

  for (const ent of entities) {
    const g = ent.geometry;
    const layer = layerNameMap.get(ent.layer_id) || ent.layer || '0';

    if (g.Point) {
      lines.push('0', 'POINT');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Point.position.x));
      lines.push('20', String(g.Point.position.y));
      lines.push('30', '0.0');
    }

    if (g.Line) {
      lines.push('0', 'LINE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Line.start.x));
      lines.push('20', String(g.Line.start.y));
      lines.push('30', '0.0');
      lines.push('11', String(g.Line.end.x));
      lines.push('21', String(g.Line.end.y));
      lines.push('31', '0.0');
    }

    if (g.Circle) {
      lines.push('0', 'CIRCLE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Circle.center.x));
      lines.push('20', String(g.Circle.center.y));
      lines.push('30', '0.0');
      lines.push('40', String(g.Circle.radius));
    }

    if (g.Arc) {
      lines.push('0', 'ARC');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Arc.center.x));
      lines.push('20', String(g.Arc.center.y));
      lines.push('30', '0.0');
      lines.push('40', String(g.Arc.radius));
      lines.push('50', String((g.Arc.start_angle * 180) / Math.PI));
      lines.push('51', String((g.Arc.end_angle * 180) / Math.PI));
    }

    if (g.Ellipse) {
      const { center, semi_major, semi_minor, rotation } = g.Ellipse;
      const ratio = semi_major === 0 ? 1 : semi_minor / semi_major;
      lines.push('0', 'ELLIPSE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(center.x));
      lines.push('20', String(center.y));
      lines.push('30', '0.0');
      lines.push('11', String(semi_major * Math.cos(rotation)));
      lines.push('21', String(semi_major * Math.sin(rotation)));
      lines.push('31', '0.0');
      lines.push('40', String(ratio));
      lines.push('41', '0.0');
      lines.push('42', String(Math.PI * 2));
    }

    if (g.EllipseArc) {
      const { center, semi_major, semi_minor, rotation, start_angle, end_angle } = g.EllipseArc;
      const ratio = semi_major === 0 ? 1 : semi_minor / semi_major;
      lines.push('0', 'ELLIPSE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(center.x));
      lines.push('20', String(center.y));
      lines.push('30', '0.0');
      lines.push('11', String(semi_major * Math.cos(rotation)));
      lines.push('21', String(semi_major * Math.sin(rotation)));
      lines.push('31', '0.0');
      lines.push('40', String(ratio));
      lines.push('41', String(start_angle));
      lines.push('42', String(end_angle));
    }

    if (g.Spline) {
      // Kernel stores control_points + degree + closed only — regenerate a
      // uniform clamped knot vector on export. For a clamped non-rational
      // B-spline of degree p with N control points: numKnots = N + p + 1,
      // (p+1) zeros at start, (p+1) ones at end, internal knots evenly spaced.
      const { control_points, degree, closed } = g.Spline;
      const N = control_points.length;
      const p = Math.min(degree, Math.max(0, N - 1));
      const numKnots = N + p + 1;
      const numInternal = N - p - 1;
      const knots: number[] = [];
      for (let k = 0; k <= p; k++) knots.push(0);
      for (let k = 1; k <= numInternal; k++) knots.push(k / (numInternal + 1));
      for (let k = 0; k <= p; k++) knots.push(1);
      // 70 bit flags: 1 = closed, 8 = planar (always set for 2D)
      const flag70 = (closed ? 1 : 0) | 8;
      lines.push('0', 'SPLINE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('70', String(flag70));
      lines.push('71', String(p));
      lines.push('72', String(numKnots));
      lines.push('73', String(N));
      lines.push('74', '0');
      for (const k of knots) {
        lines.push('40', String(k));
      }
      for (const cp of control_points) {
        lines.push('10', String(cp.x));
        lines.push('20', String(cp.y));
        lines.push('30', '0.0');
      }
    }

    if (g.Rectangle) {
      const o = g.Rectangle.origin;
      const w = g.Rectangle.width;
      const h = g.Rectangle.height;
      const rot = g.Rectangle.rotation ?? 0;
      lines.push('0', 'LWPOLYLINE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('90', '4');
      lines.push('70', '1');
      lines.push('10', String(o.x));
      lines.push('20', String(o.y));
      lines.push('10', String(o.x + w));
      lines.push('20', String(o.y));
      lines.push('10', String(o.x + w));
      lines.push('20', String(o.y + h));
      lines.push('10', String(o.x));
      lines.push('20', String(o.y + h));
      // XDATA: preserve Rectangle identity for NEXUS round-trip
      lines.push('1001', 'NEXUS');
      lines.push('1000', 'ENTITY_TYPE=Rectangle');
      lines.push('1000', `ORIGIN_X=${o.x}`);
      lines.push('1000', `ORIGIN_Y=${o.y}`);
      lines.push('1000', `WIDTH=${w}`);
      lines.push('1000', `HEIGHT=${h}`);
      lines.push('1000', `ROTATION=${rot}`);
    }

    if (g.Polyline) {
      lines.push('0', 'LWPOLYLINE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('90', String(g.Polyline.vertices.length));
      lines.push('70', g.Polyline.closed ? '1' : '0');
      for (const v of g.Polyline.vertices) {
        lines.push('10', String(v.x));
        lines.push('20', String(v.y));
      }
    }

    if (g.Text) {
      lines.push('0', 'TEXT');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Text.position.x));
      lines.push('20', String(g.Text.position.y));
      lines.push('30', '0.0');
      lines.push('40', String(g.Text.height));
      lines.push('1', g.Text.content);
      if (g.Text.rotation !== 0) {
        lines.push('50', String((g.Text.rotation * 180) / Math.PI));
      }
    }

    if (g.Dimension) {
      const { start, end, offset, text_override, style_name } = g.Dimension;
      const len = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const dimText = text_override || len.toFixed(3);
      const nx = len > 1e-9 ? (-(end.y - start.y) / len) * offset : 0;
      const ny = len > 1e-9 ? ((end.x - start.x) / len) * offset : 0;
      lines.push('0', 'DIMENSION');
      lines.push('8', layer);
      lines.push('3', style_name || 'Standard');
      lines.push('70', '1');
      lines.push('1', dimText);
      lines.push('10', String((start.x + end.x) / 2 + nx));
      lines.push('20', String((start.y + end.y) / 2 + ny));
      lines.push('13', String(start.x));
      lines.push('23', String(start.y));
      lines.push('14', String(end.x));
      lines.push('24', String(end.y));
    } else if (g.AlignedDimension) {
      const { start, end, offset, text_override, style_name } = g.AlignedDimension;
      const len = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      const dimText = text_override || len.toFixed(3);
      const nx = len > 1e-9 ? (-(end.y - start.y) / len) * offset : 0;
      const ny = len > 1e-9 ? ((end.x - start.x) / len) * offset : 0;
      lines.push('0', 'DIMENSION');
      lines.push('8', layer);
      lines.push('3', style_name || 'Standard');
      lines.push('70', '1');
      lines.push('1', dimText);
      lines.push('10', String((start.x + end.x) / 2 + nx));
      lines.push('20', String((start.y + end.y) / 2 + ny));
      lines.push('13', String(start.x));
      lines.push('23', String(start.y));
      lines.push('14', String(end.x));
      lines.push('24', String(end.y));
    } else if (g.RadialDimension) {
      const { center, point_on_arc, text_override, style_name } = g.RadialDimension;
      const radius = Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
      const dimText = text_override || `R${radius.toFixed(3)}`;
      lines.push('0', 'DIMENSION');
      lines.push('8', layer);
      lines.push('3', style_name || 'Standard');
      lines.push('70', '4');
      lines.push('1', dimText);
      lines.push('10', String(center.x));
      lines.push('20', String(center.y));
      lines.push('15', String(point_on_arc.x));
      lines.push('25', String(point_on_arc.y));
    } else if (g.DiameterDimension) {
      const { center, point_on_arc, text_override, style_name } = g.DiameterDimension;
      const radius = Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
      const dimText = text_override || `\u00D8${(radius * 2).toFixed(3)}`;
      lines.push('0', 'DIMENSION');
      lines.push('8', layer);
      lines.push('3', style_name || 'Standard');
      lines.push('70', '3');
      lines.push('1', dimText);
      lines.push('10', String(center.x));
      lines.push('20', String(center.y));
      lines.push('15', String(point_on_arc.x));
      lines.push('25', String(point_on_arc.y));
    } else if (g.AngularDimension) {
      const { center, start_ray, end_ray, text_override, style_name } = g.AngularDimension;
      const arcRadius = Math.sqrt((start_ray.x - center.x) ** 2 + (start_ray.y - center.y) ** 2);
      const angle =
        Math.atan2(end_ray.y - center.y, end_ray.x - center.x) -
        Math.atan2(start_ray.y - center.y, start_ray.x - center.x);
      const angleDeg = Math.abs((angle * 180) / Math.PI);
      const dimText = text_override || `${angleDeg.toFixed(3)}°`;
      const arcMidAngle = Math.atan2(start_ray.y - center.y, start_ray.x - center.x) + angle / 2;
      lines.push('0', 'DIMENSION');
      lines.push('8', layer);
      lines.push('3', style_name || 'Standard');
      lines.push('70', '2');
      lines.push('1', dimText);
      lines.push('10', String(center.x));
      lines.push('20', String(center.y));
      lines.push('13', String(start_ray.x));
      lines.push('23', String(start_ray.y));
      lines.push('14', String(end_ray.x));
      lines.push('24', String(end_ray.y));
      lines.push('16', String(center.x + arcRadius * Math.cos(arcMidAngle)));
      lines.push('26', String(center.y + arcRadius * Math.sin(arcMidAngle)));
    }

    if (g.Hatch && Array.isArray(g.Hatch.boundary_ids)) {
      const { boundary_ids, pattern, scale: hatchScale, angle: hatchAngle } = g.Hatch;
      const allEntities: any[] = JSON.parse(entitiesJson);
      const boundaryVertices: { x: number; y: number }[][] = [];

      for (const bid of boundary_ids) {
        const bEnt = allEntities.find((e: any) => e.id === bid);
        if (!bEnt) continue;
        const bg = bEnt.geometry;
        if (bg.Line) {
          boundaryVertices.push([bg.Line.start, bg.Line.end]);
        } else if (bg.Polyline) {
          boundaryVertices.push(bg.Polyline.vertices);
        } else if (bg.Rectangle) {
          const { origin, width, height } = bg.Rectangle;
          boundaryVertices.push([
            { x: origin.x, y: origin.y },
            { x: origin.x + width, y: origin.y },
            { x: origin.x + width, y: origin.y + height },
            { x: origin.x, y: origin.y + height },
          ]);
        }
      }

      if (boundaryVertices.length > 0) {
        lines.push('  0');
        lines.push('HATCH');
        lines.push('  8');
        lines.push(layer);
        lines.push('  2');
        lines.push(pattern || 'ANSI31');
        lines.push(' 70');
        lines.push('0');
        lines.push(' 71');
        lines.push('0');
        lines.push(' 91');
        lines.push(String(boundaryVertices.length));
        for (const path of boundaryVertices) {
          lines.push(' 92');
          lines.push('1');
          lines.push(' 93');
          lines.push(String(path.length));
          for (const v of path) {
            lines.push(' 10');
            lines.push(String(v.x));
            lines.push(' 20');
            lines.push(String(v.y));
          }
        }
        lines.push(' 41');
        lines.push(String(hatchScale || 1.0));
        lines.push(' 52');
        lines.push(String(((hatchAngle || 0) * 180) / Math.PI));
      }
    }

    if (g.Ray) {
      lines.push('0', 'RAY');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.Ray.origin.x));
      lines.push('20', String(g.Ray.origin.y));
      lines.push('30', '0.0');
      lines.push('11', String(g.Ray.direction.x));
      lines.push('21', String(g.Ray.direction.y));
      lines.push('31', '0.0');
    }

    if (g.ConstructionLine) {
      lines.push('0', 'XLINE');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('10', String(g.ConstructionLine.origin.x));
      lines.push('20', String(g.ConstructionLine.origin.y));
      lines.push('30', '0.0');
      lines.push('11', String(g.ConstructionLine.direction.x));
      lines.push('21', String(g.ConstructionLine.direction.y));
      lines.push('31', '0.0');
    }

    if (g.Wipeout && Array.isArray(g.Wipeout.vertices)) {
      // Identity-transform WIPEOUT: insertion (0,0,0), U=(1,0,0), V=(0,1,0).
      // Boundary vertices live in 14/24 — world coordinates under identity.
      // R2000 subclass markers required so ezdxf can locate the 14 codes
      // (it reads them from subclass index 2 = AcDbRasterImage).
      const verts = g.Wipeout.vertices;
      lines.push('0', 'WIPEOUT');
      lines.push('100', 'AcDbEntity');
      lines.push('8', layer);
      writeEntityStyleCodes(lines, ent);
      lines.push('100', 'AcDbRasterImage');
      lines.push('90', '0');
      lines.push('10', '0.0');
      lines.push('20', '0.0');
      lines.push('30', '0.0');
      lines.push('11', '1.0');
      lines.push('21', '0.0');
      lines.push('31', '0.0');
      lines.push('12', '0.0');
      lines.push('22', '1.0');
      lines.push('32', '0.0');
      lines.push('13', '1.0');
      lines.push('23', '1.0');
      lines.push('70', '7');
      lines.push('280', '1');
      lines.push('281', '50');
      lines.push('282', '50');
      lines.push('283', '0');
      lines.push('71', '2');
      lines.push('91', String(verts.length));
      for (const v of verts) {
        lines.push('14', String(v.x));
        lines.push('24', String(v.y));
      }
    }
  }

  lines.push('0', 'ENDSEC');

  // EOF
  lines.push('0', 'EOF');

  log.info('DXF export complete');
  return lines.join('\n');
}
