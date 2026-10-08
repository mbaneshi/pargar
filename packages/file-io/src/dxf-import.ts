/**
 * Parse a DXF file string and convert to kernel-compatible entity data.
 * Uses dxf-parser library for parsing, then maps to our entity format.
 */

// dxf-parser default export
import DxfParser from 'dxf-parser';
import { createLogger } from '@nexus/logger';
import { parseSysvarsFromDxf } from './dxf-sysvars.js';

const log = createLogger('file-io:dxf-import');

const ACI_TO_HEX: Record<number, string> = {
  1: '#ff0000',
  2: '#ffff00',
  3: '#00ff00',
  4: '#00ffff',
  5: '#0000ff',
  6: '#ff00ff',
  7: '#ffffff',
  8: '#808080',
  9: '#c0c0c0',
};

export interface ImportedLayer {
  name: string;
  color?: string;
  linetype?: string;
  frozen?: boolean;
  locked?: boolean;
}

export interface ImportedEntity {
  type: string;
  geometry: any;
  layer: string;
  color?: string;
  linetype?: string;
}

export interface ImportedDwgProps {
  title?: string;
  subject?: string;
  author?: string;
  keywords?: string;
  comments?: string;
  hyperlink_base?: string;
  last_saved_by?: string;
}

export interface ImportedNamedView {
  name: string;
  center_x: number;
  center_y: number;
  zoom: number;
  rotation?: number;
}

export interface ImportedNamedUcs {
  name: string;
  origin_x: number;
  origin_y: number;
  x_axis_x: number;
  x_axis_y: number;
  y_axis_x: number;
  y_axis_y: number;
}

export interface DxfImportResult {
  entities: ImportedEntity[];
  layers: ImportedLayer[];
  dwgProps?: ImportedDwgProps;
  namedViews?: ImportedNamedView[];
  namedUcs?: ImportedNamedUcs[];
  sysvars?: Record<string, import('./dxf-sysvars.js').SysvarValue>;
}

function resolveAciColor(colorIndex: number | undefined): string | undefined {
  if (colorIndex == null || colorIndex === 0 || colorIndex === 256) return undefined;
  return ACI_TO_HEX[colorIndex] || undefined;
}

function parseNexusXdataString(strings: string[], key: string): string | undefined {
  const prefix = `${key}=`;
  const entry = strings.find((s) => s.startsWith(prefix));
  return entry ? entry.substring(prefix.length) : undefined;
}

function parseNexusXdataNumber(strings: string[], key: string): number {
  const val = parseNexusXdataString(strings, key);
  return val != null ? parseFloat(val) : 0;
}

interface ParsedHatch {
  layer: string;
  pattern: string;
  scale: number;
  angle: number;
  boundaries: { x: number; y: number }[][];
}

function parseHatchEntities(dxfString: string): ParsedHatch[] {
  const hatches: ParsedHatch[] = [];
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());

  let inEntities = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'ENTITIES') {
        inEntities = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inEntities) break;

    if (!inEntities || lines[i] !== '0' || lines[i + 1] !== 'HATCH') continue;

    i += 2;
    let layer = '0';
    let pattern = 'ANSI31';
    let scale = 1.0;
    let angle = 0;
    const boundaries: { x: number; y: number }[][] = [];

    while (i < lines.length - 1) {
      const code = lines[i];
      const value = lines[i + 1];

      if (code === '0') break;

      if (code === '8') {
        layer = value;
      } else if (code === '2') {
        pattern = value;
      } else if (code === '41') {
        scale = parseFloat(value) || 1.0;
      } else if (code === '52') {
        angle = parseFloat(value) || 0;
      } else if (code === '92') {
        // boundary type flag — start a new boundary path
        // read vertex count from next group 93
        const path: { x: number; y: number }[] = [];
        i += 2;
        let numVertices = 0;
        if (i < lines.length - 1 && lines[i] === '93') {
          numVertices = parseInt(lines[i + 1]) || 0;
          i += 2;
        }
        for (let v = 0; v < numVertices && i < lines.length - 1; v++) {
          if (lines[i] === '10') {
            const x = parseFloat(lines[i + 1]) || 0;
            i += 2;
            let y = 0;
            if (i < lines.length - 1 && lines[i] === '20') {
              y = parseFloat(lines[i + 1]) || 0;
              i += 2;
            }
            path.push({ x, y });
          } else {
            break;
          }
        }
        if (path.length > 0) boundaries.push(path);
        continue;
      }

      i += 2;
    }

    hatches.push({
      layer,
      pattern,
      scale,
      angle: (angle * Math.PI) / 180,
      boundaries,
    });
  }

  return hatches;
}

interface ParsedRayLike {
  layer: string;
  origin: { x: number; y: number };
  direction: { x: number; y: number };
}

interface ParsedWipeout {
  layer: string;
  vertices: { x: number; y: number }[];
}

/**
 * Single raw-text scan that pulls RAY, XLINE, and WIPEOUT entities from the
 * ENTITIES section. dxf-parser ships no handler for any of these three, so we
 * have to walk the file ourselves (same approach as parseHatchEntities).
 *
 * - RAY/XLINE: 10/20/30 = origin, 11/21/31 = unit direction vector.
 * - WIPEOUT: assumes identity transform (insertion=(0,0,0), U=(1,0,0),
 *   V=(0,1,0)). Boundary vertices live in group codes 14/24 — these are world
 *   coordinates only when the transform is identity, which is what NEXUS's
 *   writer always emits.
 */
function parseSimpleEntities(dxfString: string): {
  rays: ParsedRayLike[];
  xlines: ParsedRayLike[];
  wipeouts: ParsedWipeout[];
} {
  const rays: ParsedRayLike[] = [];
  const xlines: ParsedRayLike[] = [];
  const wipeouts: ParsedWipeout[] = [];
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());
  let inEntities = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'ENTITIES') {
        inEntities = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inEntities) break;
    if (!inEntities || lines[i] !== '0') continue;

    const entityType = lines[i + 1];
    if (entityType !== 'RAY' && entityType !== 'XLINE' && entityType !== 'WIPEOUT') continue;

    i += 2;
    let layer = '0';
    let originX = 0;
    let originY = 0;
    let dirX = 0;
    let dirY = 0;
    const wipeoutVerts: { x: number; y: number }[] = [];

    while (i < lines.length - 1) {
      const code = lines[i];
      if (code === '0') break;
      const value = lines[i + 1];

      if (code === '8') {
        layer = value;
      } else if ((entityType === 'RAY' || entityType === 'XLINE') && code === '10') {
        originX = parseFloat(value) || 0;
      } else if ((entityType === 'RAY' || entityType === 'XLINE') && code === '20') {
        originY = parseFloat(value) || 0;
      } else if ((entityType === 'RAY' || entityType === 'XLINE') && code === '11') {
        dirX = parseFloat(value) || 0;
      } else if ((entityType === 'RAY' || entityType === 'XLINE') && code === '21') {
        dirY = parseFloat(value) || 0;
      } else if (entityType === 'WIPEOUT' && code === '14') {
        const x = parseFloat(value) || 0;
        i += 2;
        let y = 0;
        if (i < lines.length - 1 && lines[i] === '24') {
          y = parseFloat(lines[i + 1]) || 0;
          i += 2;
        }
        wipeoutVerts.push({ x, y });
        continue;
      }

      i += 2;
    }

    if (entityType === 'RAY') {
      rays.push({
        layer,
        origin: { x: originX, y: originY },
        direction: { x: dirX, y: dirY },
      });
    } else if (entityType === 'XLINE') {
      xlines.push({
        layer,
        origin: { x: originX, y: originY },
        direction: { x: dirX, y: dirY },
      });
    } else if (entityType === 'WIPEOUT' && wipeoutVerts.length > 0) {
      wipeouts.push({ layer, vertices: wipeoutVerts });
    }
  }

  return { rays, xlines, wipeouts };
}

/**
 * Parse selected DWGPROPS-style header variables ($TITLE, $SUBJECT, $AUTHOR,
 * $KEYWORDS, $COMMENTS, $HYPERLINKBASE, $LASTSAVEDBY) from the HEADER section.
 * Returns undefined if the HEADER section is missing or has none of these.
 */
function parseDwgProps(dxfString: string): ImportedDwgProps | undefined {
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());
  let inHeader = false;
  const props: ImportedDwgProps = {};
  let touched = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'HEADER') {
        inHeader = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inHeader) break;
    if (!inHeader) continue;

    if (lines[i] !== '9') continue;
    const varName = lines[i + 1];
    // Header variables are followed by `<group-code>\n<value>` on the next two lines.
    if (i + 3 >= lines.length) break;
    const value = lines[i + 3];
    switch (varName) {
      case '$TITLE':
        props.title = value;
        touched = true;
        break;
      case '$SUBJECT':
        props.subject = value;
        touched = true;
        break;
      case '$AUTHOR':
        props.author = value;
        touched = true;
        break;
      case '$KEYWORDS':
        props.keywords = value;
        touched = true;
        break;
      case '$COMMENTS':
        props.comments = value;
        touched = true;
        break;
      case '$HYPERLINKBASE':
        props.hyperlink_base = value;
        touched = true;
        break;
      case '$LASTSAVEDBY':
        props.last_saved_by = value;
        touched = true;
        break;
    }
  }

  return touched ? props : undefined;
}

/**
 * Parse the VIEW table (named views). Each entry has DXF group codes:
 *   2  = view name
 *   12/22 = view center X/Y
 *   40 = view height (we use it as zoom denominator)
 *   50 = twist angle (degrees) — converted to radians
 */
function parseNamedViews(dxfString: string): ImportedNamedView[] {
  const result: ImportedNamedView[] = [];
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());
  let inTablesSection = false;
  let inViewTable = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'TABLES') {
        inTablesSection = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inTablesSection) {
      inTablesSection = false;
      inViewTable = false;
      continue;
    }
    if (!inTablesSection) continue;

    if (lines[i] === '0' && lines[i + 1] === 'TABLE' && lines[i + 2] === '2') {
      inViewTable = lines[i + 3] === 'VIEW';
      continue;
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDTAB') {
      inViewTable = false;
      continue;
    }
    if (!inViewTable) continue;
    if (lines[i] !== '0' || lines[i + 1] !== 'VIEW') continue;

    // Scan forward until the next "0" code, capturing fields.
    let name: string | undefined;
    let cx = 0,
      cy = 0,
      height = 0,
      twistDeg = 0;
    let j = i + 2;
    while (j < lines.length - 1 && lines[j] !== '0') {
      const code = lines[j];
      const value = lines[j + 1];
      if (code === '2') name = value;
      else if (code === '12') cx = parseFloat(value) || 0;
      else if (code === '22') cy = parseFloat(value) || 0;
      else if (code === '40') height = parseFloat(value) || 0;
      else if (code === '50') twistDeg = parseFloat(value) || 0;
      j += 2;
    }
    if (name) {
      // DXF view height is world units visible vertically. NEXUS zoom is also
      // in world units per screen unit, so use height directly with a sane
      // floor to avoid div-by-zero.
      result.push({
        name,
        center_x: cx,
        center_y: cy,
        zoom: Math.max(height, 0.01),
        rotation: (twistDeg * Math.PI) / 180,
      });
    }
    i = j - 1;
  }

  return result;
}

/**
 * Parse the UCS table. Each entry has:
 *   2  = UCS name
 *   10/20 = origin X/Y
 *   11/21 = X axis direction X/Y
 *   12/22 = Y axis direction X/Y
 */
function parseNamedUcs(dxfString: string): ImportedNamedUcs[] {
  const result: ImportedNamedUcs[] = [];
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());
  let inTablesSection = false;
  let inUcsTable = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'TABLES') {
        inTablesSection = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inTablesSection) {
      inTablesSection = false;
      inUcsTable = false;
      continue;
    }
    if (!inTablesSection) continue;

    if (lines[i] === '0' && lines[i + 1] === 'TABLE' && lines[i + 2] === '2') {
      inUcsTable = lines[i + 3] === 'UCS';
      continue;
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDTAB') {
      inUcsTable = false;
      continue;
    }
    if (!inUcsTable) continue;
    if (lines[i] !== '0' || lines[i + 1] !== 'UCS') continue;

    let name: string | undefined;
    let ox = 0,
      oy = 0,
      xx = 1,
      xy = 0,
      yx = 0,
      yy = 1;
    let j = i + 2;
    while (j < lines.length - 1 && lines[j] !== '0') {
      const code = lines[j];
      const value = lines[j + 1];
      if (code === '2') name = value;
      else if (code === '10') ox = parseFloat(value) || 0;
      else if (code === '20') oy = parseFloat(value) || 0;
      else if (code === '11') xx = parseFloat(value) || 1;
      else if (code === '21') xy = parseFloat(value) || 0;
      else if (code === '12') yx = parseFloat(value) || 0;
      else if (code === '22') yy = parseFloat(value) || 1;
      j += 2;
    }
    if (name && name !== 'World') {
      result.push({
        name,
        origin_x: ox,
        origin_y: oy,
        x_axis_x: xx,
        x_axis_y: xy,
        y_axis_x: yx,
        y_axis_y: yy,
      });
    }
    i = j - 1;
  }

  return result;
}

/**
 * Walk the raw DXF text and collect the dim style name (DXF group code 3)
 * for every DIMENSION entity, in the order they appear in the ENTITIES section.
 * dxf-parser drops code 3 on dimensions, so we need this prepass for round-trip
 * parity with the export side (which writes code 3 = dim style name).
 */
function parseDimensionStyleNames(dxfString: string): (string | undefined)[] {
  const result: (string | undefined)[] = [];
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());
  let inEntities = false;

  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === '0' && lines[i + 1] === 'SECTION') {
      if (i + 3 < lines.length && lines[i + 2] === '2' && lines[i + 3] === 'ENTITIES') {
        inEntities = true;
        i += 3;
        continue;
      }
    }
    if (lines[i] === '0' && lines[i + 1] === 'ENDSEC' && inEntities) break;
    if (!inEntities) continue;
    if (lines[i] !== '0' || lines[i + 1] !== 'DIMENSION') continue;

    // Found a DIMENSION; scan forward until next "0" code, capturing code 3.
    let styleName: string | undefined;
    let j = i + 2;
    while (j < lines.length - 1 && lines[j] !== '0') {
      if (lines[j] === '3') {
        styleName = lines[j + 1];
      }
      j += 2;
    }
    result.push(styleName);
    i = j - 1;
  }

  return result;
}

function parseLayerLinetypes(dxfString: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = dxfString.split(/\r?\n/).map((l) => l.trim());

  let inLayerTable = false;
  let inLayerEntry = false;
  let currentLayerName: string | undefined;

  for (let i = 0; i < lines.length - 1; i++) {
    const code = lines[i];
    const value = lines[i + 1];

    if (code === '0' && value === 'TABLE') {
      const nextCode = lines[i + 2];
      const nextVal = lines[i + 3];
      if (nextCode === '2' && nextVal === 'LAYER') {
        inLayerTable = true;
      }
    }
    if (code === '0' && value === 'ENDTAB' && inLayerTable) {
      inLayerTable = false;
      break;
    }
    if (inLayerTable && code === '0' && value === 'LAYER') {
      if (currentLayerName) inLayerEntry = false;
      inLayerEntry = true;
      currentLayerName = undefined;
    }
    if (inLayerEntry && code === '2') {
      currentLayerName = value;
    }
    if (inLayerEntry && code === '6' && currentLayerName) {
      if (value.toUpperCase() !== 'CONTINUOUS') {
        result.set(currentLayerName, value.toUpperCase());
      }
    }
  }
  return result;
}

function buildLayerMap(dxf: any, dxfString: string): Map<string, ImportedLayer> {
  const map = new Map<string, ImportedLayer>();
  if (!dxf.tables?.layer?.layers) return map;

  const layerLinetypes = parseLayerLinetypes(dxfString);

  for (const [name, layerDef] of Object.entries<any>(dxf.tables.layer.layers)) {
    map.set(name, {
      name,
      color: resolveAciColor(layerDef.colorIndex ?? layerDef.color),
      linetype: layerLinetypes.get(name) || undefined,
      frozen: layerDef.frozen || false,
      locked: layerDef.locked || false,
    });
  }
  return map;
}

export function parseDxfFull(dxfString: string): DxfImportResult {
  log.info('DXF import started');
  const parser = new DxfParser();
  let dxf: any;
  try {
    dxf = parser.parseSync(dxfString);
  } catch (e) {
    console.error('DXF parse error:', e);
    return { entities: [], layers: [] };
  }

  if (!dxf) return { entities: [], layers: [] };

  const layerMap = buildLayerMap(dxf, dxfString);
  const layers = Array.from(layerMap.values());

  // Section-level resources parsed independently of the entity stream.
  const dwgProps = parseDwgProps(dxfString);
  const namedViews = parseNamedViews(dxfString);
  const namedUcs = parseNamedUcs(dxfString);
  const sysvars = parseSysvarsFromDxf(dxfString);
  const sysvarsResult = Object.keys(sysvars).length > 0 ? sysvars : undefined;

  if (!dxf.entities) {
    return {
      entities: [],
      layers,
      dwgProps,
      namedViews: namedViews.length ? namedViews : undefined,
      namedUcs: namedUcs.length ? namedUcs : undefined,
      sysvars: sysvarsResult,
    };
  }

  const dimStyleNames = parseDimensionStyleNames(dxfString);
  let dimIndex = 0;

  const entities: ImportedEntity[] = [];

  for (const ent of dxf.entities) {
    const layerName = ent.layer || '0';
    const layerDef = layerMap.get(layerName);

    const entityColor = resolveAciColor(ent.colorIndex ?? ent.color);
    const color = entityColor || layerDef?.color || undefined;
    const entityLinetype = ent.lineTypeName || undefined;
    const linetype =
      entityLinetype !== 'BYLAYER' ? entityLinetype : layerDef?.linetype || undefined;

    const base = { layer: layerName, color, linetype };

    switch (ent.type) {
      case 'POINT':
        entities.push({
          type: 'point',
          geometry: {
            Point: {
              position: { x: ent.position?.x ?? 0, y: ent.position?.y ?? 0 },
            },
          },
          ...base,
        });
        break;

      case 'LINE':
        if (ent.vertices && ent.vertices.length >= 2) {
          entities.push({
            type: 'line',
            geometry: {
              Line: {
                start: { x: ent.vertices[0].x || 0, y: ent.vertices[0].y || 0 },
                end: { x: ent.vertices[1].x || 0, y: ent.vertices[1].y || 0 },
              },
            },
            ...base,
          });
        }
        break;

      case 'CIRCLE':
        entities.push({
          type: 'circle',
          geometry: {
            Circle: {
              center: { x: ent.center?.x || 0, y: ent.center?.y || 0 },
              radius: ent.radius || 1,
            },
          },
          ...base,
        });
        break;

      case 'ARC':
        entities.push({
          type: 'arc',
          geometry: {
            Arc: {
              center: { x: ent.center?.x || 0, y: ent.center?.y || 0 },
              radius: ent.radius || 1,
              start_angle: ent.startAngle || 0,
              end_angle: ent.endAngle || Math.PI * 2,
            },
          },
          ...base,
        });
        break;

      case 'ELLIPSE': {
        // DXF group codes:
        //   10/20/30 = center
        //   11/21/31 = major axis endpoint relative to center (vector)
        //   40       = minor/major axis ratio
        //   41       = start parameter (radians, 0 for full)
        //   42       = end parameter (radians, 2π for full)
        const cx = ent.center?.x ?? 0;
        const cy = ent.center?.y ?? 0;
        const mx = ent.majorAxisEndPoint?.x ?? 1;
        const my = ent.majorAxisEndPoint?.y ?? 0;
        const semi_major = Math.hypot(mx, my);
        const semi_minor = semi_major * (ent.axisRatio ?? 1);
        const rotation = Math.atan2(my, mx);
        const startAngle = ent.startAngle ?? 0;
        const endAngle = ent.endAngle ?? Math.PI * 2;
        const isFull = Math.abs(startAngle) < 1e-9 && Math.abs(endAngle - Math.PI * 2) < 1e-9;
        if (isFull) {
          entities.push({
            type: 'ellipse',
            geometry: {
              Ellipse: { center: { x: cx, y: cy }, semi_major, semi_minor, rotation },
            },
            ...base,
          });
        } else {
          entities.push({
            type: 'ellipse_arc',
            geometry: {
              EllipseArc: {
                center: { x: cx, y: cy },
                semi_major,
                semi_minor,
                rotation,
                start_angle: startAngle,
                end_angle: endAngle,
              },
            },
            ...base,
          });
        }
        break;
      }

      case 'SPLINE': {
        // DXF group codes (per dxf-parser):
        //   10 = control point (repeated)
        //   71 = degree
        //   70 flag bit 1 = closed
        // Knot vector and weights are regenerated on export — kernel stores
        // only control_points + degree + closed.
        if (ent.controlPoints && ent.controlPoints.length >= 2) {
          const control_points = ent.controlPoints.map((p: any) => ({
            x: p.x ?? 0,
            y: p.y ?? 0,
          }));
          const degreeRaw = ent.degreeOfSplineCurve ?? 3;
          const degree = Math.min(degreeRaw, control_points.length - 1);
          const closed = ent.closed ?? false;
          entities.push({
            type: 'spline',
            geometry: {
              Spline: { control_points, degree, closed },
            },
            ...base,
          });
        }
        break;
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const xd = ent.extendedData;
        const xdStrings: string[] = xd?.customStrings || [];
        const nexusType =
          xd?.applicationName === 'NEXUS'
            ? parseNexusXdataString(xdStrings, 'ENTITY_TYPE')
            : undefined;
        if (nexusType === 'Rectangle') {
          const ox = parseNexusXdataNumber(xdStrings, 'ORIGIN_X');
          const oy = parseNexusXdataNumber(xdStrings, 'ORIGIN_Y');
          const w = parseNexusXdataNumber(xdStrings, 'WIDTH');
          const h = parseNexusXdataNumber(xdStrings, 'HEIGHT');
          const rot = parseNexusXdataNumber(xdStrings, 'ROTATION');
          entities.push({
            type: 'rectangle',
            geometry: {
              Rectangle: {
                origin: { x: ox, y: oy },
                width: w,
                height: h,
                rotation: rot,
              },
            },
            ...base,
          });
        } else if (ent.vertices && ent.vertices.length >= 2) {
          const rawVerts = ent.vertices;
          const polyPts: { x: number; y: number }[] = [];
          for (let vi = 0; vi < rawVerts.length; vi++) {
            const v = rawVerts[vi];
            const px = v.x || 0;
            const py = v.y || 0;
            polyPts.push({ x: px, y: py });
            const bulge = v.bulge;
            if (bulge && Math.abs(bulge) > 1e-9) {
              const nextIdx = (vi + 1) % rawVerts.length;
              if (nextIdx === 0 && !(ent.shape || false)) continue;
              const nx = rawVerts[nextIdx].x || 0;
              const ny = rawVerts[nextIdx].y || 0;
              const dx = nx - px;
              const dy = ny - py;
              const chord = Math.sqrt(dx * dx + dy * dy);
              if (chord < 1e-12) continue;
              const sagitta = (Math.abs(bulge) * chord) / 2;
              const radius = ((chord * chord) / 4 + sagitta * sagitta) / (2 * sagitta);
              const midX = (px + nx) / 2;
              const midY = (py + ny) / 2;
              const perpX = -dy / chord;
              const perpY = dx / chord;
              const sign = bulge > 0 ? 1 : -1;
              const centerDist = radius - sagitta;
              const cx = midX + sign * perpX * centerDist;
              const cy = midY + sign * perpY * centerDist;
              const startAngle = Math.atan2(py - cy, px - cx);
              const includedAngle = 4 * Math.atan(Math.abs(bulge));
              const segments = Math.max(8, Math.round(includedAngle / (Math.PI / 16)));
              const step = ((bulge > 0 ? 1 : -1) * includedAngle) / segments;
              for (let s = 1; s < segments; s++) {
                const a = startAngle + step * s;
                polyPts.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) });
              }
            }
          }
          entities.push({
            type: 'polyline',
            geometry: {
              Polyline: {
                vertices: polyPts,
                closed: ent.shape || false,
              },
            },
            ...base,
          });
        }
        break;
      }

      case 'TEXT':
      case 'MTEXT':
        entities.push({
          type: 'text',
          geometry: {
            Text: {
              position: { x: ent.startPoint?.x ?? 0, y: ent.startPoint?.y ?? 0 },
              content: ent.text ?? '',
              height: ent.textHeight ?? 2.5,
              rotation: ((ent.rotation ?? 0) * Math.PI) / 180,
            },
          },
          ...base,
        });
        break;

      case 'DIMENSION': {
        const dimType = (ent.dimensionType ?? 0) & 0x0f;
        const textOverride = ent.text || '';

        const dimStyleName = dimStyleNames[dimIndex++] || undefined;

        if (dimType === 4) {
          // Radial
          const center = {
            x: ent.anchorPoint?.x ?? 0,
            y: ent.anchorPoint?.y ?? 0,
          };
          const pointOnArc = {
            x: ent.diameterOrRadiusPoint?.x ?? 0,
            y: ent.diameterOrRadiusPoint?.y ?? 0,
          };
          entities.push({
            type: 'radial_dimension',
            geometry: {
              RadialDimension: {
                center,
                point_on_arc: pointOnArc,
                text_override: textOverride || null,
                style_name: dimStyleName || null,
              },
            },
            ...base,
          });
        } else if (dimType === 3) {
          // Diameter
          const center = {
            x: ent.anchorPoint?.x ?? 0,
            y: ent.anchorPoint?.y ?? 0,
          };
          const pointOnArc = {
            x: ent.diameterOrRadiusPoint?.x ?? 0,
            y: ent.diameterOrRadiusPoint?.y ?? 0,
          };
          entities.push({
            type: 'diameter_dimension',
            geometry: {
              DiameterDimension: {
                center,
                point_on_arc: pointOnArc,
                text_override: textOverride || null,
                style_name: dimStyleName || null,
              },
            },
            ...base,
          });
        } else if (dimType === 2) {
          // Angular
          const center = {
            x: ent.anchorPoint?.x ?? 0,
            y: ent.anchorPoint?.y ?? 0,
          };
          const startRay = {
            x: ent.linearOrAngularPoint1?.x ?? 0,
            y: ent.linearOrAngularPoint1?.y ?? 0,
          };
          const endRay = {
            x: ent.linearOrAngularPoint2?.x ?? 0,
            y: ent.linearOrAngularPoint2?.y ?? 0,
          };
          entities.push({
            type: 'angular_dimension',
            geometry: {
              AngularDimension: {
                center,
                start_ray: startRay,
                end_ray: endRay,
                text_override: textOverride || null,
                style_name: dimStyleName || null,
              },
            },
            ...base,
          });
        } else {
          // Linear (0) or Aligned (1) — both map to Dimension/AlignedDimension
          const start = {
            x: ent.linearOrAngularPoint1?.x ?? 0,
            y: ent.linearOrAngularPoint1?.y ?? 0,
          };
          const end = {
            x: ent.linearOrAngularPoint2?.x ?? 0,
            y: ent.linearOrAngularPoint2?.y ?? 0,
          };
          const defPt = {
            x: ent.anchorPoint?.x ?? 0,
            y: ent.anchorPoint?.y ?? 0,
          };
          const len = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          let offset = 0;
          if (len > 1e-9) {
            const nx = -(end.y - start.y) / len;
            const ny = (end.x - start.x) / len;
            offset = (defPt.x - midX) * nx + (defPt.y - midY) * ny;
          }
          const geomKey = 'Dimension';
          const typeKey = 'dimension';
          entities.push({
            type: typeKey,
            geometry: {
              [geomKey]: {
                start,
                end,
                offset,
                text_override: textOverride || null,
                style_name: dimStyleName || null,
              },
            },
            ...base,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  // Parse HATCH entities from raw DXF (dxf-parser does not support HATCH)
  const hatches = parseHatchEntities(dxfString);
  for (const hatch of hatches) {
    const boundaryIds: string[] = [];
    for (const boundary of hatch.boundaries) {
      const boundaryId = `hatch-boundary-${entities.length}`;
      entities.push({
        type: 'polyline',
        geometry: {
          Polyline: {
            vertices: boundary,
            closed: true,
          },
        },
        layer: hatch.layer,
      });
      boundaryIds.push(boundaryId);
    }
    entities.push({
      type: 'hatch',
      geometry: {
        Hatch: {
          boundary_ids: boundaryIds,
          pattern: hatch.pattern,
          scale: hatch.scale,
          angle: hatch.angle,
        },
      },
      layer: hatch.layer,
    });
  }

  // Parse RAY / XLINE / WIPEOUT — dxf-parser supports none of them.
  const simple = parseSimpleEntities(dxfString);
  for (const ray of simple.rays) {
    entities.push({
      type: 'ray',
      geometry: { Ray: { origin: ray.origin, direction: ray.direction } },
      layer: ray.layer,
    });
  }
  for (const xline of simple.xlines) {
    entities.push({
      type: 'construction_line',
      geometry: {
        ConstructionLine: { origin: xline.origin, direction: xline.direction },
      },
      layer: xline.layer,
    });
  }
  for (const wipeout of simple.wipeouts) {
    entities.push({
      type: 'wipeout',
      geometry: { Wipeout: { vertices: wipeout.vertices } },
      layer: wipeout.layer,
    });
  }

  log.info('DXF import complete', { entities: entities.length, layers: layers.length });
  return {
    entities,
    layers,
    dwgProps,
    namedViews: namedViews.length ? namedViews : undefined,
    namedUcs: namedUcs.length ? namedUcs : undefined,
    sysvars: sysvarsResult,
  };
}

export function parseDxf(dxfString: string): ImportedEntity[] {
  log.info('DXF parse started');
  return parseDxfFull(dxfString).entities;
}
