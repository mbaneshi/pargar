import type { ParityKind } from './parser';

function extractCommandEnumBody(rustSource: string): string | null {
  const start = rustSource.indexOf('pub enum Command {');
  if (start < 0) return null;
  let depth = 0;
  let i = rustSource.indexOf('{', start);
  if (i < 0) return null;
  const bodyStart = i + 1;
  for (; i < rustSource.length; i++) {
    const ch = rustSource[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return rustSource.slice(bodyStart, i);
    }
  }
  return null;
}

export function parseKernelCommandVariants(rustSource: string): string[] {
  const body = extractCommandEnumBody(rustSource);
  if (!body) return [];
  const variants: string[] = [];
  // Match a leading-indented variant name regardless of indent width (spaces or
  // tabs) so the parser survives kernel reformatting — see #68. Struct-variant
  // fields are snake_case, so the [A-Z] anchor keeps them out even when nested.
  const re = /^[ \t]+([A-Z][A-Za-z0-9_]*)\s*[\{,\n]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    variants.push(match[1]);
  }
  return variants;
}

export interface VariantLine {
  name: string;
  line: number;
}

export function parseKernelCommandVariantsWithLines(
  rustSource: string,
): VariantLine[] {
  const start = rustSource.indexOf('pub enum Command {');
  if (start < 0) return [];
  const openBrace = rustSource.indexOf('{', start);
  if (openBrace < 0) return [];

  let depth = 0;
  let endIdx = -1;
  for (let i = openBrace; i < rustSource.length; i++) {
    const ch = rustSource[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx < 0) return [];

  const body = rustSource.slice(openBrace + 1, endIdx);
  const bodyStartLine =
    rustSource.slice(0, openBrace + 1).split('\n').length + 1;

  const variants: VariantLine[] = [];
  const lines = body.split('\n');
  const re = /^[ \t]+([A-Z][A-Za-z0-9_]*)\s*[\{,\n]?/;
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) {
      variants.push({ name: m[1], line: bodyStartLine + i - 1 });
    }
  }
  return variants;
}

export function parseKernelSysvars(rustSource: string): string[] {
  const names: string[] = [];
  const re = /m\.insert\(\s*"([A-Z][A-Z0-9_]*)"\s*\.into\(\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rustSource)) !== null) {
    names.push(match[1]);
  }
  return names;
}

// Same extraction as parseKernelSysvars, but pairs each sysvar with its absolute
// line number so the cross-walk can cite the exact registration line (#69).
export function parseKernelSysvarsWithLines(rustSource: string): VariantLine[] {
  const out: VariantLine[] = [];
  const re = /m\.insert\(\s*"([A-Z][A-Z0-9_]*)"\s*\.into\(\)/;
  const lines = rustSource.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = re.exec(lines[i]);
    if (m) {
      out.push({ name: m[1], line: i + 1 });
    }
  }
  return out;
}

// AutoCAD command name → ordered list of NEXUS Command enum variants that implement it.
// Hand-curated. AutoCAD users measure coverage by command, NEXUS by kernel granularity.
// Multiple variants for one command (e.g. CIRCLE construction modes) → still 'yes' if ≥1 covered.
export const COMMAND_MAPPING: Record<string, readonly string[]> = {
  POINT: ['CreatePoint'],
  LINE: ['CreateLine'],
  CIRCLE: [
    'CreateCircle',
    'CreateCircle2P',
    'CreateCircle3P',
    'CreateCircleTtr',
  ],
  ARC: ['CreateArc'],
  RECTANG: ['CreateRectangle'],
  RECTANGLE: ['CreateRectangle'],
  PLINE: ['CreatePolyline'],
  ELLIPSE: ['CreateEllipse', 'CreateEllipseArc'],
  SPLINE: ['CreateSpline'],
  XLINE: ['CreateConstructionLine'],
  POLYGON: ['CreatePolygon'],
  RAY: ['CreateRay'],
  DONUT: ['CreateDonut'],
  DOUGHNUT: ['CreateDonut'],
  MLINE: ['CreateMline'],
  WIPEOUT: ['CreateWipeout'],
  REVCLOUD: ['CreateRevisionCloud'],
  HATCH: ['CreateHatch'],
  TEXT: ['CreateText'],
  DTEXT: ['CreateText'],
  MTEXT: ['CreateMText'],
  LEADER: ['CreateLeader'],
  TABLE: ['CreateTable'],
  REGION: ['CreateRegion'],
  BOUNDARY: ['DetectBoundary'],
  TOLERANCE: ['CreateTolerance'],

  ERASE: ['DeleteEntity'],
  MOVE: ['MoveEntity'],
  ROTATE: ['RotateEntity'],
  SCALE: ['ScaleEntity'],
  COPY: ['CopyEntity'],
  MIRROR: ['MirrorEntity'],
  OFFSET: ['OffsetEntity', 'OffsetEntityThrough'],
  TRIM: ['TrimEntity'],
  EXTEND: ['ExtendEntity'],
  STRETCH: ['StretchEntities'],
  ALIGN: ['AlignEntities'],
  LENGTHEN: ['Lengthen'],
  BREAK: ['Break', 'BreakAtPoint'],
  JOIN: ['JoinEntities'],
  EXPLODE: ['Explode', 'ExplodeBlock'],
  FILLET: ['Fillet', 'FilletPolyline'],
  CHAMFER: ['Chamfer'],
  ARRAY: ['ArrayRectangular', 'ArrayPolar', 'ArrayPath'],
  ARRAYRECT: ['ArrayRectangular'],
  ARRAYPOLAR: ['ArrayPolar'],
  ARRAYPATH: ['ArrayPath'],
  MATCHPROP: ['MatchProperties'],
  OVERKILL: ['Overkill'],
  PURGE: ['PurgeUnused'],
  PEDIT: [
    'PeditClose',
    'PeditOpen',
    'PeditAddVertex',
    'PeditDeleteVertex',
    'PeditMoveVertex',
  ],
  CHANGE: ['SetEntityColor', 'SetEntityLinetype', 'SetEntityLineweight'],
  CHPROP: ['SetEntityColor', 'SetEntityLinetype', 'SetEntityLineweight'],
  PROPERTIES: ['ModifyGeometry'],

  LAYER: [
    'CreateLayer',
    'DeleteLayer',
    'RenameLayer',
    'SetLayerColor',
    'SetLayerVisible',
    'SetLayerLocked',
    'SetEntityLayer',
    'SetLayerLinetype',
    'SetLayerLineweight',
  ],
  '-LAYER': [
    'CreateLayer',
    'DeleteLayer',
    'RenameLayer',
    'SetLayerColor',
    'SetLayerVisible',
    'SetLayerLocked',
  ],
  LTSCALE: ['SetLtscale', 'GetLtscale'],

  DIMLINEAR: ['CreateDimension'],
  DIMALIGNED: ['CreateAlignedDimension'],
  DIMANGULAR: ['CreateAngularDimension'],
  DIMRADIUS: ['CreateRadialDimension'],
  DIMDIAMETER: ['CreateDiameterDimension'],
  DIMORDINATE: ['CreateOrdinateDimension'],
  DIMCONTINUE: ['DimContinue'],
  DIMBASELINE: ['DimBaseline'],
  DIMSTYLE: [
    'CreateDimStyle',
    'ModifyDimStyle',
    'DeleteDimStyle',
    'SetCurrentDimStyle',
  ],
  STYLE: [
    'CreateTextStyle',
    'ModifyTextStyle',
    'DeleteTextStyle',
    'SetCurrentTextStyle',
  ],
  MLEADERSTYLE: [
    'CreateMLeaderStyle',
    'ModifyMLeaderStyle',
    'DeleteMLeaderStyle',
    'SetCurrentMLeaderStyle',
  ],
  TABLESTYLE: [
    'CreateTableStyle',
    'ModifyTableStyle',
    'DeleteTableStyle',
    'SetCurrentTableStyle',
  ],

  BLOCK: ['CreateBlock'],
  '-BLOCK': ['CreateBlock'],
  INSERT: ['InsertBlock'],
  '-INSERT': ['InsertBlock'],
  ATTDEF: ['CreateAttdef'],
  '-ATTDEF': ['CreateAttdef'],
  WBLOCK: ['WriteBlock'],
  '-WBLOCK': ['WriteBlock'],
  XREF: ['AttachXref'],
  XATTACH: ['AttachXref'],
  BEDIT: ['BeditEnter', 'BeditExit'],
  '-BEDIT': ['BeditEnter', 'BeditExit'],
  BCLOSE: ['BeditExit'],
  GROUP: [
    'CreateGroup',
    'DeleteGroup',
    'RenameGroup',
    'AddToGroup',
    'RemoveFromGroup',
    'SetGroupSelectable',
  ],
  '-GROUP': [
    'CreateGroup',
    'DeleteGroup',
    'RenameGroup',
    'AddToGroup',
    'RemoveFromGroup',
    'SetGroupSelectable',
  ],
  UCS: ['SaveUcs', 'DeleteUcs', 'SetCurrentUcs'],
  VIEW: ['SaveNamedView', 'DeleteNamedView', 'RenameNamedView'],
  '-VIEW': ['SaveNamedView', 'DeleteNamedView', 'RenameNamedView'],
  DWGPROPS: ['SetDwgProps'],

  GCHORIZONTAL: ['AddConstraintHorizontal'],
  GCVERTICAL: ['AddConstraintVertical'],
  GCCOINCIDENT: ['AddConstraintCoincident'],
  GCPARALLEL: ['AddConstraintParallel'],
  GCPERPENDICULAR: ['AddConstraintPerpendicular'],
  GCTANGENT: ['AddConstraintTangent'],
  GCCONCENTRIC: ['AddConstraintConcentric'],
  GCEQUAL: ['AddConstraintEqualLength'],
  GCFIX: ['AddConstraintFixed'],
  GCSYMMETRIC: ['AddConstraintSymmetric'],
  DCDISTANCE: ['AddConstraintDistance'],
  DCALIGNED: ['AddConstraintDistance'],
  DCHORIZONTAL: ['AddConstraintDistance'],
  DCVERTICAL: ['AddConstraintDistance'],
  DELCONSTRAINT: ['RemoveConstraint'],
  AUTOCONSTRAIN: ['AutoConstrain'],
  CONSTRAINTBAR: ['ToggleConstraintBar', 'AnalyzeDof'],

  DIST: ['MeasureDistance'],
  AREA: ['MeasureArea'],
  MEASUREGEOM: ['MeasureDistance', 'MeasureArea'],
  ID: ['QueryPoint'],
  MASSPROP: ['MassProperties'],
  PLOT: ['PlotToPdf'],
  EXPORTPDF: ['PlotToPdf'],
  PRINT: ['PlotToPdf'],
  SAVE: ['SaveDrawing'],
  QSAVE: ['SaveDrawing'],
  SAVEAS: ['SaveDrawing'],
  OPEN: ['OpenDrawing'],
  U: ['Undo'],
  UNDO: ['Undo'],
  REDO: ['Redo'],
  MREDO: ['Redo'],
  SETVAR: ['SetSysvar', 'GetSysvar'],
  UNITS: ['SetUnits', 'GetUnits'],
  '-UNITS': ['SetUnits', 'GetUnits'],
  DRAWORDER: [
    'SendToBack',
    'BringToFront',
    'SendBackward',
    'BringForward',
  ],
  HATCHEDIT: ['CreateHatch'],
};

// AutoCAD sysvar name → NEXUS sysvar name(s) in the kernel registry.
// The kernel registers its sysvars in sysvars.rs::default_registry(). Only the 8
// pre-S4 sysvars are mapped here; the S4-A snap/grid/linetype cluster is present
// in the kernel but not yet cross-walked — see follow-up to widen this mapping.
export const SYSVAR_MAPPING: Record<string, readonly string[]> = {
  OFFSETDIST: ['OFFSETDIST'],
  OFFSETGAPTYPE: ['OFFSETGAPTYPE'],
  OFFSETERASE: ['OFFSETERASE'],
  FILLETRAD: ['FILLETRAD'],
  TRIMMODE: ['TRIMMODE'],
  EDGEMODE: ['EDGEMODE'],
  CHAMFERA: ['CHAMFERA'],
  CHAMFERB: ['CHAMFERB'],
};

// Names matching these prefixes are out-of-scope under SD-05
// (3D / surface / mesh / render / material / lighting / point cloud).
export const PARKED_PREFIXES: readonly string[] = [
  '3D',
  'MESH',
  'SURFACE',
  'SURF',
  'CONVTO',
  'XEDGES',
  'POINTCLOUD',
  'RENDER',
  'MATERIAL',
  'LIGHT',
  'CULLING',
];

// Specific names that are out-of-scope under SD-05 (3D solid/surface/mesh modeling,
// rendering, point cloud, civil-engineering placeholders that ship inside AutoCAD-Core).
export const PARKED_NAMES: ReadonlySet<string> = new Set([
  'EXTRUDE',
  'REVOLVE',
  'LOFT',
  'SWEEP',
  'PRESSPULL',
  'POLYSOLID',
  'WEDGE',
  'CONE',
  'CYLINDER',
  'TORUS',
  'PYRAMID',
  'SPHERE',
  'BOX',
  'INTERFERE',
  'INTERSECT',
  'SUBTRACT',
  'UNION',
  'SLICE',
  'SECTION',
  'SECTIONPLANE',
  'SECTIONPLANEJOG',
  'LIVESECTION',
  'FLATSHOT',
  'SOLDRAW',
  'SOLPROF',
  'SOLVIEW',
  'THICKEN',
  'IMPRINT',
  'OFFSETEDGE',
  'EXTRUDEEDGES',
  'FILLETEDGE',
  'CHAMFEREDGE',
  'NAVSWHEEL',
  'NAVSCUBE',
  'VIEWCUBE',
  'WALKFLY',
  'ANIPATH',
  'GEOGRAPHICLOCATION',
  'PROJECTGEOMETRY',
  'STEPIN',
  'STEPOUT',
  'NEWVIEW',
  'MIRROR3D',
  'POINTLIGHT',
  'DISTANTLIGHT',
  'SPOTLIGHT',
  'WEBLIGHT',
  'MIGRATEMATERIALS',
  'CONVERTOLDLIGHTS',
  'CONVERTOLDMATERIALS',
  'CMATERIAL',
  'COMPASS',
  'DEFAULTGIZMO',
  'CAMERADISPLAY',
]);

const FILE_KERNEL_COMMANDS = 'packages/kernel/src/commands.rs';
const FILE_KERNEL_SYSVARS = 'packages/kernel/src/sysvars.rs';

export type Implemented = 'yes' | 'partial' | 'no' | 'parked';

export interface CrossWalkResult {
  nexus_implemented: Implemented;
  nexus_source: string;
  notes: string;
}

function isParked(name: string): boolean {
  // Strip leading '-' (AutoCAD's command-line variant) before applying rules so that
  // e.g. '-3DOSNAP' is parked under the same rule as '3DOSNAP'.
  const stripped = name.startsWith('-') ? name.slice(1) : name;
  if (PARKED_NAMES.has(stripped)) return true;
  for (const prefix of PARKED_PREFIXES) {
    if (stripped.startsWith(prefix)) return true;
  }
  return false;
}

export function crossWalkCommand(
  autocadName: string,
  variantLines: Map<string, number>,
): CrossWalkResult {
  const mapped = COMMAND_MAPPING[autocadName];
  if (mapped) {
    const found = mapped.filter((v) => variantLines.has(v));
    if (found.length > 0) {
      const sources = found
        .map((v) => `${FILE_KERNEL_COMMANDS}:${variantLines.get(v)}`)
        .join('; ');
      const missing = mapped.filter((v) => !variantLines.has(v));
      const notes =
        missing.length > 0 ? `missing variants: ${missing.join(', ')}` : '';
      return {
        nexus_implemented: 'yes',
        nexus_source: sources,
        notes,
      };
    }
    return {
      nexus_implemented: 'no',
      nexus_source: '',
      notes: `mapped to ${mapped.join(', ')} but none present in kernel`,
    };
  }
  if (isParked(autocadName)) {
    return {
      nexus_implemented: 'parked',
      nexus_source: '',
      notes: 'out of scope under SD-05 (3D/mesh/surface/render)',
    };
  }
  return { nexus_implemented: 'no', nexus_source: '', notes: '' };
}

export function crossWalkSysvar(
  autocadName: string,
  sysvarLines: ReadonlyMap<string, number>,
): CrossWalkResult {
  const mapped = SYSVAR_MAPPING[autocadName];
  if (mapped) {
    const found = mapped.filter((v) => sysvarLines.has(v));
    if (found.length > 0) {
      return {
        nexus_implemented: 'yes',
        nexus_source: `${FILE_KERNEL_SYSVARS}:${sysvarLines.get(found[0])}`,
        notes: '',
      };
    }
  }
  if (isParked(autocadName)) {
    return {
      nexus_implemented: 'parked',
      nexus_source: '',
      notes: 'out of scope under SD-05',
    };
  }
  return { nexus_implemented: 'no', nexus_source: '', notes: '' };
}
