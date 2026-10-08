/**
 * Context Builder — pure function that reads kernel + app state → AIContext.
 *
 * Rules:
 * 1. No side effects. No network calls. No AI. Just data transformation.
 * 2. Must be fast (<5ms for 500 entities).
 * 3. Output is deterministic: same input → same output.
 * 4. Respects token budget via truncation (nearby first, then recent).
 */

import type { AppState } from '$lib/stores/AppState.svelte';
import type {
  AIContext,
  EntitySummary,
  EntityBrief,
  LayerSummary,
  BoundingBox,
  SceneContext,
  FocusContext,
} from './context-contract';
import { CONTEXT_VERSION } from './context-contract';

interface RawEntity {
  id: string;
  geometry: Record<string, unknown>;
  layer_id: string;
  style: Record<string, unknown>;
}

interface RawLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
}

// --- Main entry point ---

export function buildContext(app: AppState): AIContext {
  const entities = getEntities(app);
  const layers = getLayers(app);
  const selectedIds = app.selection?.getSelectedIds() ?? [];

  return {
    version: CONTEXT_VERSION,
    scene: buildScene(entities, layers),
    focus: buildFocus(entities, selectedIds, app),
    interaction: {
      active_tool: null, // filled by caller if shell context available
      last_command: null,
      mode: 'IDLE',
    },
    settings: {
      units: app.unitFormat ?? 'decimal',
      active_layer: app.activeLayerId ?? 'layer_0',
      grid_spacing: null,
      snap_enabled: true,
      ortho_enabled: false,
    },
  };
}

// --- Scene ---

function buildScene(entities: RawEntity[], layers: RawLayer[]): SceneContext {
  const counts: Record<string, number> = {};
  for (const e of entities) {
    const type = getEntityType(e);
    counts[type] = (counts[type] ?? 0) + 1;
  }

  const layerEntityCounts = new Map<string, number>();
  for (const e of entities) {
    layerEntityCounts.set(e.layer_id, (layerEntityCounts.get(e.layer_id) ?? 0) + 1);
  }

  const layerSummaries: LayerSummary[] = layers.map((l) => ({
    id: l.id,
    name: l.name,
    color: l.color,
    visible: l.visible,
    locked: l.locked,
    entity_count: layerEntityCounts.get(l.id) ?? 0,
  }));

  const total = entities.length;
  const layerCount = layers.length;
  const typeStr = Object.entries(counts)
    .map(([t, n]) => `${n} ${t}${n > 1 ? 's' : ''}`)
    .join(', ');
  const summary =
    total === 0
      ? 'Empty drawing'
      : `${total} entit${total === 1 ? 'y' : 'ies'} (${typeStr}) across ${layerCount} layer${layerCount === 1 ? '' : 's'}`;

  return {
    summary,
    entity_counts: counts,
    layers: layerSummaries,
    bounds: computeBounds(entities),
    total_entities: total,
  };
}

// --- Focus ---

function buildFocus(entities: RawEntity[], selectedIds: string[], _app: AppState): FocusContext {
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  const selected: EntitySummary[] = selectedIds
    .map((id) => entityMap.get(id))
    .filter((e): e is RawEntity => e !== undefined)
    .map(toEntitySummary);

  // Recent = last 5 entities by ID (higher ID = more recent in our ID scheme)
  const recent: EntitySummary[] = entities.slice(-5).reverse().map(toEntitySummary);

  // Nearby = all entities (capped at 20), summarized briefly
  const nearby: EntityBrief[] = entities.slice(0, 20).map(toEntityBrief);

  return {
    selected,
    recent,
    viewport: { center_x: 0, center_y: 0, width: 100, height: 100 },
    nearby,
  };
}

// --- Entity description helpers ---

function getEntityType(e: RawEntity): string {
  const geo = e.geometry;
  if ('Line' in geo) return 'Line';
  if ('Circle' in geo) return 'Circle';
  if ('Arc' in geo) return 'Arc';
  if ('Rectangle' in geo) return 'Rectangle';
  if ('Polyline' in geo) return 'Polyline';
  if ('Point' in geo) return 'Point';
  if ('Text' in geo) return 'Text';
  if ('Ellipse' in geo) return 'Ellipse';
  if ('Spline' in geo) return 'Spline';
  if ('Dimension' in geo) return 'Dimension';
  if ('AlignedDimension' in geo) return 'AlignedDimension';
  if ('AngularDimension' in geo) return 'AngularDimension';
  if ('RadialDimension' in geo) return 'RadialDimension';
  if ('DiameterDimension' in geo) return 'DiameterDimension';
  if ('ConstructionLine' in geo) return 'ConstructionLine';
  if ('BlockRef' in geo) return 'BlockRef';
  if ('Hatch' in geo) return 'Hatch';
  if ('MText' in geo) return 'MText';
  if ('Table' in geo) return 'Table';
  if ('RevisionCloud' in geo) return 'RevisionCloud';
  return 'Unknown';
}

function describeGeometry(e: RawEntity): string {
  const geo = e.geometry as Record<string, any>;
  const fmt = (n: number) => Math.round(n * 100) / 100;

  if ('Line' in geo) {
    const { start, end } = geo.Line;
    const len = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    return `Line from (${fmt(start.x)}, ${fmt(start.y)}) to (${fmt(end.x)}, ${fmt(end.y)}), length ${fmt(len)}`;
  }
  if ('Circle' in geo) {
    const { center, radius } = geo.Circle;
    return `Circle at (${fmt(center.x)}, ${fmt(center.y)}), radius ${fmt(radius)}`;
  }
  if ('Arc' in geo) {
    const { center, radius, start_angle, end_angle } = geo.Arc;
    return `Arc at (${fmt(center.x)}, ${fmt(center.y)}), r=${fmt(radius)}, ${fmt(start_angle)}→${fmt(end_angle)} rad`;
  }
  if ('Rectangle' in geo) {
    const { origin, width, height } = geo.Rectangle;
    return `Rectangle at (${fmt(origin.x)}, ${fmt(origin.y)}), ${fmt(width)}×${fmt(height)}`;
  }
  if ('Polyline' in geo) {
    const pts = geo.Polyline.vertices?.length ?? 0;
    const closed = geo.Polyline.closed ? ', closed' : '';
    return `Polyline with ${pts} vertices${closed}`;
  }
  if ('Point' in geo) {
    const { x, y } = geo.Point;
    return `Point at (${fmt(x)}, ${fmt(y)})`;
  }
  if ('Text' in geo) {
    const { position, content } = geo.Text;
    return `Text "${content}" at (${fmt(position?.x ?? 0)}, ${fmt(position?.y ?? 0)})`;
  }
  if ('Ellipse' in geo) {
    const { center, semi_major, semi_minor, rotation } = geo.Ellipse;
    return `Ellipse at (${fmt(center.x)}, ${fmt(center.y)}), ${fmt(semi_major)}×${fmt(semi_minor)}, rot ${fmt(rotation)} rad`;
  }
  if ('Spline' in geo) {
    const pts = geo.Spline.control_points?.length ?? 0;
    const closed = geo.Spline.closed ? ', closed' : '';
    return `Spline with ${pts} control points, degree ${geo.Spline.degree}${closed}`;
  }
  if ('Dimension' in geo) {
    const { start, end, offset } = geo.Dimension;
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    return `Dimension (${fmt(start.x)}, ${fmt(start.y)})→(${fmt(end.x)}, ${fmt(end.y)}), length ${fmt(dist)}, offset ${fmt(offset)}`;
  }
  if ('AlignedDimension' in geo) {
    const { start, end } = geo.AlignedDimension;
    const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
    return `Aligned dimension ${fmt(dist)} from (${fmt(start.x)}, ${fmt(start.y)}) to (${fmt(end.x)}, ${fmt(end.y)})`;
  }
  if ('AngularDimension' in geo) {
    const { center, start_ray, end_ray } = geo.AngularDimension;
    const a1 = Math.atan2(start_ray.y - center.y, start_ray.x - center.x);
    const a2 = Math.atan2(end_ray.y - center.y, end_ray.x - center.x);
    const deg = fmt(Math.abs(a2 - a1) * (180 / Math.PI));
    return `Angular dimension ${deg}° at (${fmt(center.x)}, ${fmt(center.y)})`;
  }
  if ('RadialDimension' in geo) {
    const { center, point_on_arc } = geo.RadialDimension;
    const r = Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
    return `Radial dimension R${fmt(r)} at (${fmt(center.x)}, ${fmt(center.y)})`;
  }
  if ('DiameterDimension' in geo) {
    const { center, point_on_arc } = geo.DiameterDimension;
    const d = 2 * Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
    return `Diameter dimension ⌀${fmt(d)} at (${fmt(center.x)}, ${fmt(center.y)})`;
  }
  if ('ConstructionLine' in geo) {
    const { origin, direction } = geo.ConstructionLine;
    return `Construction line through (${fmt(origin.x)}, ${fmt(origin.y)}), dir (${fmt(direction.x)}, ${fmt(direction.y)})`;
  }
  if ('BlockRef' in geo) {
    const { block_id, insertion, rotation } = geo.BlockRef;
    return `Block "${block_id}" at (${fmt(insertion.x)}, ${fmt(insertion.y)}), rot ${fmt(rotation)} rad`;
  }
  if ('Hatch' in geo) {
    const { boundary_ids, pattern, scale } = geo.Hatch;
    return `Hatch pattern "${pattern}" (scale ${fmt(scale)}), ${boundary_ids.length} boundaries`;
  }
  if ('MText' in geo) {
    const { position, content, width } = geo.MText;
    return `MText "${content.slice(0, 30)}" at (${fmt(position.x)}, ${fmt(position.y)}), width ${fmt(width)}`;
  }
  if ('Table' in geo) {
    const { position, rows, cols } = geo.Table;
    return `Table ${rows}×${cols} at (${fmt(position.x)}, ${fmt(position.y)})`;
  }
  if ('RevisionCloud' in geo) {
    const pts = geo.RevisionCloud.boundary?.length ?? 0;
    return `Revision cloud with ${pts} boundary points`;
  }
  return 'Unknown geometry';
}

function positionHint(e: RawEntity): string {
  const geo = e.geometry as Record<string, any>;
  const fmt = (n: number) => Math.round(n * 100) / 100;

  if ('Line' in geo)
    return `(${fmt(geo.Line.start.x)}, ${fmt(geo.Line.start.y)})→(${fmt(geo.Line.end.x)}, ${fmt(geo.Line.end.y)})`;
  if ('Circle' in geo)
    return `at (${fmt(geo.Circle.center.x)}, ${fmt(geo.Circle.center.y)}) r=${fmt(geo.Circle.radius)}`;
  if ('Arc' in geo)
    return `at (${fmt(geo.Arc.center.x)}, ${fmt(geo.Arc.center.y)}) r=${fmt(geo.Arc.radius)}`;
  if ('Rectangle' in geo)
    return `at (${fmt(geo.Rectangle.origin.x)}, ${fmt(geo.Rectangle.origin.y)}) ${fmt(geo.Rectangle.width)}×${fmt(geo.Rectangle.height)}`;
  if ('Point' in geo) return `at (${fmt(geo.Point.x)}, ${fmt(geo.Point.y)})`;
  if ('Text' in geo) return `"${geo.Text.content}"`;
  if ('Ellipse' in geo)
    return `at (${fmt(geo.Ellipse.center.x)}, ${fmt(geo.Ellipse.center.y)}) ${fmt(geo.Ellipse.semi_major)}×${fmt(geo.Ellipse.semi_minor)}`;
  if ('Spline' in geo) return `${geo.Spline.control_points?.length ?? 0} pts`;
  if ('Dimension' in geo)
    return `(${fmt(geo.Dimension.start.x)}, ${fmt(geo.Dimension.start.y)})→(${fmt(geo.Dimension.end.x)}, ${fmt(geo.Dimension.end.y)})`;
  if ('AlignedDimension' in geo)
    return `(${fmt(geo.AlignedDimension.start.x)}, ${fmt(geo.AlignedDimension.start.y)})→(${fmt(geo.AlignedDimension.end.x)}, ${fmt(geo.AlignedDimension.end.y)})`;
  if ('AngularDimension' in geo)
    return `at (${fmt(geo.AngularDimension.center.x)}, ${fmt(geo.AngularDimension.center.y)})`;
  if ('RadialDimension' in geo)
    return `at (${fmt(geo.RadialDimension.center.x)}, ${fmt(geo.RadialDimension.center.y)})`;
  if ('DiameterDimension' in geo)
    return `at (${fmt(geo.DiameterDimension.center.x)}, ${fmt(geo.DiameterDimension.center.y)})`;
  if ('ConstructionLine' in geo)
    return `through (${fmt(geo.ConstructionLine.origin.x)}, ${fmt(geo.ConstructionLine.origin.y)})`;
  if ('BlockRef' in geo)
    return `"${geo.BlockRef.block_id}" at (${fmt(geo.BlockRef.insertion.x)}, ${fmt(geo.BlockRef.insertion.y)})`;
  if ('Hatch' in geo) return `"${geo.Hatch.pattern}" ${geo.Hatch.boundary_ids.length} bounds`;
  if ('MText' in geo) return `"${geo.MText.content.slice(0, 20)}"`;
  if ('Table' in geo)
    return `${geo.Table.rows}×${geo.Table.cols} at (${fmt(geo.Table.position.x)}, ${fmt(geo.Table.position.y)})`;
  if ('RevisionCloud' in geo) return `${geo.RevisionCloud.boundary?.length ?? 0} pts`;
  return '';
}

function toEntitySummary(e: RawEntity): EntitySummary {
  return {
    id: e.id,
    type: getEntityType(e),
    layer: e.layer_id,
    description: describeGeometry(e),
  };
}

function toEntityBrief(e: RawEntity): EntityBrief {
  return {
    id: e.id,
    type: getEntityType(e),
    layer: e.layer_id,
    position: positionHint(e),
  };
}

// --- Bounds ---

function computeBounds(entities: RawEntity[]): BoundingBox | null {
  if (entities.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (const e of entities) {
    const pts = extractPoints(e);
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (!isFinite(minX)) return null;
  return { min_x: minX, min_y: minY, max_x: maxX, max_y: maxY };
}

function extractPoints(e: RawEntity): [number, number][] {
  const geo = e.geometry as Record<string, any>;
  if ('Line' in geo)
    return [
      [geo.Line.start.x, geo.Line.start.y],
      [geo.Line.end.x, geo.Line.end.y],
    ];
  if ('Circle' in geo) {
    const { center, radius } = geo.Circle;
    return [
      [center.x - radius, center.y - radius],
      [center.x + radius, center.y + radius],
    ];
  }
  if ('Arc' in geo) {
    const { center, radius } = geo.Arc;
    return [
      [center.x - radius, center.y - radius],
      [center.x + radius, center.y + radius],
    ];
  }
  if ('Rectangle' in geo) {
    const { origin, width, height } = geo.Rectangle;
    return [
      [origin.x, origin.y],
      [origin.x + width, origin.y + height],
    ];
  }
  if ('Point' in geo) return [[geo.Point.x, geo.Point.y]];
  if ('Text' in geo) return [[geo.Text.position?.x ?? 0, geo.Text.position?.y ?? 0]];
  if ('Polyline' in geo)
    return (geo.Polyline.vertices ?? []).map((v: { x: number; y: number }) => [v.x, v.y]);
  if ('Ellipse' in geo) {
    const { center, semi_major, semi_minor } = geo.Ellipse;
    const r = Math.max(semi_major, semi_minor);
    return [
      [center.x - r, center.y - r],
      [center.x + r, center.y + r],
    ];
  }
  if ('Spline' in geo)
    return (geo.Spline.control_points ?? []).map((v: { x: number; y: number }) => [v.x, v.y]);
  if ('Dimension' in geo)
    return [
      [geo.Dimension.start.x, geo.Dimension.start.y],
      [geo.Dimension.end.x, geo.Dimension.end.y],
    ];
  if ('AlignedDimension' in geo)
    return [
      [geo.AlignedDimension.start.x, geo.AlignedDimension.start.y],
      [geo.AlignedDimension.end.x, geo.AlignedDimension.end.y],
    ];
  if ('AngularDimension' in geo) {
    const { center, radius } = geo.AngularDimension;
    return [
      [center.x - radius, center.y - radius],
      [center.x + radius, center.y + radius],
    ];
  }
  if ('RadialDimension' in geo)
    return [
      [geo.RadialDimension.center.x, geo.RadialDimension.center.y],
      [geo.RadialDimension.point_on_arc.x, geo.RadialDimension.point_on_arc.y],
    ];
  if ('DiameterDimension' in geo)
    return [
      [geo.DiameterDimension.center.x, geo.DiameterDimension.center.y],
      [geo.DiameterDimension.point_on_arc.x, geo.DiameterDimension.point_on_arc.y],
    ];
  if ('ConstructionLine' in geo)
    return [[geo.ConstructionLine.origin.x, geo.ConstructionLine.origin.y]];
  if ('BlockRef' in geo) return [[geo.BlockRef.insertion.x, geo.BlockRef.insertion.y]];
  if ('MText' in geo) return [[geo.MText.position.x, geo.MText.position.y]];
  if ('Table' in geo)
    return [
      [geo.Table.position.x, geo.Table.position.y],
      [
        geo.Table.position.x +
          (geo.Table.col_widths ?? []).reduce((a: number, b: number) => a + b, 0),
        geo.Table.position.y + (geo.Table.rows ?? 0) * (geo.Table.row_height ?? 0),
      ],
    ];
  if ('RevisionCloud' in geo)
    return (geo.RevisionCloud.boundary ?? []).map((v: { x: number; y: number }) => [v.x, v.y]);
  if ('Hatch' in geo) return []; // Hatch bounds depend on referenced boundaries
  return [];
}

// --- Utilities ---

function getEntities(app: AppState): RawEntity[] {
  if (!app.kernel) return [];
  try {
    return JSON.parse(app.kernel.get_entities_json());
  } catch {
    return [];
  }
}

function getLayers(app: AppState): RawLayer[] {
  if (!app.kernel) return [];
  try {
    return JSON.parse(app.kernel.get_layers_json());
  } catch {
    return [];
  }
}

// --- Serialization ---

export function contextToString(ctx: AIContext): string {
  const lines: string[] = [];

  lines.push(`# Drawing State (v${ctx.version})`);
  lines.push('');
  lines.push(`## Scene: ${ctx.scene.summary}`);
  if (ctx.scene.bounds) {
    const b = ctx.scene.bounds;
    lines.push(`Bounds: (${b.min_x}, ${b.min_y}) to (${b.max_x}, ${b.max_y})`);
  }
  if (ctx.scene.layers.length > 0) {
    lines.push('Layers:');
    for (const l of ctx.scene.layers) {
      const vis = l.visible ? '' : ' [hidden]';
      const lock = l.locked ? ' [locked]' : '';
      lines.push(
        `  - "${l.name}" (${l.id}): ${l.entity_count} entities, color ${l.color}${vis}${lock}`,
      );
    }
  }

  if (ctx.focus.selected.length > 0) {
    lines.push('');
    lines.push('## Selected');
    for (const e of ctx.focus.selected) {
      lines.push(`  - [${e.id}] ${e.description} (layer: ${e.layer})`);
    }
  }

  if (ctx.focus.recent.length > 0) {
    lines.push('');
    lines.push('## Recent');
    for (const e of ctx.focus.recent) {
      lines.push(`  - [${e.id}] ${e.description}`);
    }
  }

  if (ctx.focus.nearby.length > 0) {
    lines.push('');
    lines.push(`## Nearby Entities (${ctx.focus.nearby.length})`);
    for (const e of ctx.focus.nearby) {
      lines.push(`  - [${e.id}] ${e.type} ${e.position}`);
    }
  }

  lines.push('');
  lines.push('## Settings');
  lines.push(`Active layer: ${ctx.settings.active_layer}`);
  lines.push(`Units: ${ctx.settings.units}`);
  if (ctx.settings.snap_enabled) lines.push('Object snap: ON');
  if (ctx.settings.ortho_enabled) lines.push('Ortho: ON');
  if (ctx.settings.grid_spacing) lines.push(`Grid: ${ctx.settings.grid_spacing}`);

  if (ctx.interaction.active_tool) {
    lines.push('');
    lines.push(`## Active Tool: ${ctx.interaction.active_tool}`);
  }

  return lines.join('\n');
}
