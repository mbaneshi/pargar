import { jsPDF } from 'jspdf';
import type { Entity, Layer, Point2D } from '$lib/types/kernel';

export interface PdfExportOptions {
  paperSize: 'a4' | 'a3' | 'letter';
  orientation: 'portrait' | 'landscape';
  title?: string;
  scale?: number;
  viewBounds?: { minX: number; minY: number; maxX: number; maxY: number };
  showLineweights?: boolean;
}

const PAPER_SIZES: Record<string, { w: number; h: number }> = {
  a4: { w: 210, h: 297 },
  a3: { w: 297, h: 420 },
  letter: { w: 215.9, h: 279.4 },
};

const MARGIN = 10; // mm

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBoundingBox(entities: Entity[]): BBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  function expand(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    found = true;
  }

  function expandPoint(p: Point2D) {
    expand(p.x, p.y);
  }

  for (const entity of entities) {
    const g = entity.geometry;
    if ('Line' in g) {
      expandPoint(g.Line.start);
      expandPoint(g.Line.end);
    } else if ('Circle' in g) {
      const { center, radius } = g.Circle;
      expand(center.x - radius, center.y - radius);
      expand(center.x + radius, center.y + radius);
    } else if ('Arc' in g) {
      const { center, radius } = g.Arc;
      expand(center.x - radius, center.y - radius);
      expand(center.x + radius, center.y + radius);
    } else if ('Rectangle' in g) {
      const { origin, width, height } = g.Rectangle;
      expandPoint(origin);
      expand(origin.x + width, origin.y + height);
    } else if ('Polyline' in g) {
      for (const v of g.Polyline.vertices) expandPoint(v);
    } else if ('Text' in g) {
      expandPoint(g.Text.position);
    } else if ('Dimension' in g) {
      expandPoint(g.Dimension.start);
      expandPoint(g.Dimension.end);
    } else if ('AlignedDimension' in g) {
      expandPoint(g.AlignedDimension.start);
      expandPoint(g.AlignedDimension.end);
    } else if ('Ellipse' in g) {
      const { center, semi_major, semi_minor } = g.Ellipse;
      expand(center.x - semi_major, center.y - semi_minor);
      expand(center.x + semi_major, center.y + semi_minor);
    } else if ('Spline' in g) {
      for (const cp of g.Spline.control_points) expandPoint(cp);
    } else if ('Point' in g) {
      expandPoint(g.Point.position);
    } else if ('ConstructionLine' in g) {
      expandPoint(g.ConstructionLine.origin);
    } else if ('AngularDimension' in g) {
      expandPoint(g.AngularDimension.center);
      expandPoint(g.AngularDimension.start_ray);
      expandPoint(g.AngularDimension.end_ray);
    } else if ('RadialDimension' in g) {
      expandPoint(g.RadialDimension.center);
      expandPoint(g.RadialDimension.point_on_arc);
    } else if ('DiameterDimension' in g) {
      expandPoint(g.DiameterDimension.center);
      expandPoint(g.DiameterDimension.point_on_arc);
    } else if ('MText' in g) {
      expandPoint(g.MText.position);
    } else if ('Table' in g) {
      expandPoint(g.Table.position);
    }
  }

  if (!found) return null;
  return { minX, minY, maxX, maxY };
}

function resolveColor(entity: Entity, layerMap: Map<string, Layer>): string {
  if (entity.style.color) return entity.style.color;
  const layer = layerMap.get(entity.layer_id);
  if (layer?.color) return layer.color;
  return '#000000';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [0, 0, 0];
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function resolveLineWidth(entity: Entity, showLineweights: boolean): number {
  if (showLineweights && entity.style.lineweight && entity.style.lineweight > 0) {
    return Math.max(0.1, entity.style.lineweight * 0.1);
  }
  return 0.25;
}

function drawEntity(
  doc: jsPDF,
  entity: Entity,
  layerMap: Map<string, Layer>,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  scale: number,
  showLineweights: boolean,
) {
  const color = resolveColor(entity, layerMap);
  const [r, g, b] = hexToRgb(color);
  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);
  doc.setLineWidth(resolveLineWidth(entity, showLineweights));

  const geom = entity.geometry;

  if ('Line' in geom) {
    const { start, end } = geom.Line;
    doc.line(toX(start.x), toY(start.y), toX(end.x), toY(end.y));
  } else if ('Circle' in geom) {
    const { center, radius } = geom.Circle;
    doc.circle(toX(center.x), toY(center.y), radius * scale, 'S');
  } else if ('Arc' in geom) {
    const { center, radius, start_angle, end_angle } = geom.Arc;
    drawArc(doc, toX(center.x), toY(center.y), radius * scale, start_angle, end_angle);
  } else if ('Rectangle' in geom) {
    const { origin, width, height } = geom.Rectangle;
    doc.rect(toX(origin.x), toY(origin.y + height), width * scale, height * scale, 'S');
  } else if ('Polyline' in geom) {
    const { vertices, closed } = geom.Polyline;
    if (vertices.length < 2) return;
    for (let i = 0; i < vertices.length - 1; i++) {
      doc.line(
        toX(vertices[i].x),
        toY(vertices[i].y),
        toX(vertices[i + 1].x),
        toY(vertices[i + 1].y),
      );
    }
    if (closed && vertices.length > 2) {
      const last = vertices[vertices.length - 1];
      doc.line(toX(last.x), toY(last.y), toX(vertices[0].x), toY(vertices[0].y));
    }
  } else if ('Text' in geom) {
    const { position, content, height, rotation } = geom.Text;
    const fontSize = Math.max(4, height * scale * 2.83); // mm to pt approx
    doc.setFontSize(fontSize);
    if (rotation && rotation !== 0) {
      const angleDeg = (rotation * 180) / Math.PI;
      doc.text(content, toX(position.x), toY(position.y), { angle: -angleDeg });
    } else {
      doc.text(content, toX(position.x), toY(position.y));
    }
  } else if ('MText' in geom) {
    const { position, content, height, rotation } = geom.MText;
    const fontSize = Math.max(4, height * scale * 2.83);
    doc.setFontSize(fontSize);
    if (rotation && rotation !== 0) {
      const angleDeg = (rotation * 180) / Math.PI;
      doc.text(content, toX(position.x), toY(position.y), { angle: -angleDeg });
    } else {
      doc.text(content, toX(position.x), toY(position.y));
    }
  } else if ('Dimension' in geom) {
    drawDimension(doc, geom.Dimension, toX, toY);
  } else if ('AlignedDimension' in geom) {
    drawDimension(doc, geom.AlignedDimension, toX, toY);
  } else if ('Ellipse' in geom) {
    const { center, semi_major, semi_minor } = geom.Ellipse;
    doc.ellipse(toX(center.x), toY(center.y), semi_major * scale, semi_minor * scale, 'S');
  } else if ('Spline' in geom) {
    const { control_points } = geom.Spline;
    if (control_points.length < 2) return;
    for (let i = 0; i < control_points.length - 1; i++) {
      doc.line(
        toX(control_points[i].x),
        toY(control_points[i].y),
        toX(control_points[i + 1].x),
        toY(control_points[i + 1].y),
      );
    }
  } else if ('Point' in geom) {
    const { position } = geom.Point;
    const sz = 0.5;
    doc.line(toX(position.x) - sz, toY(position.y), toX(position.x) + sz, toY(position.y));
    doc.line(toX(position.x), toY(position.y) - sz, toX(position.x), toY(position.y) + sz);
  } else if ('ConstructionLine' in geom) {
    // Construction lines are infinite — skip in PDF
  } else if ('AngularDimension' in geom) {
    const { center, start_ray, end_ray, radius } = geom.AngularDimension;
    doc.line(toX(center.x), toY(center.y), toX(start_ray.x), toY(start_ray.y));
    doc.line(toX(center.x), toY(center.y), toX(end_ray.x), toY(end_ray.y));
    const startAngle = Math.atan2(start_ray.y - center.y, start_ray.x - center.x);
    const endAngle = Math.atan2(end_ray.y - center.y, end_ray.x - center.x);
    drawArc(doc, toX(center.x), toY(center.y), radius * scale, startAngle, endAngle);
  } else if ('RadialDimension' in geom) {
    const { center, point_on_arc } = geom.RadialDimension;
    doc.line(toX(center.x), toY(center.y), toX(point_on_arc.x), toY(point_on_arc.y));
    const dist = Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
    const midX = (center.x + point_on_arc.x) / 2;
    const midY = (center.y + point_on_arc.y) / 2;
    const label = geom.RadialDimension.text_override ?? `R${dist.toFixed(2)}`;
    doc.setFontSize(6);
    doc.text(label, toX(midX), toY(midY));
  } else if ('DiameterDimension' in geom) {
    const { center, point_on_arc } = geom.DiameterDimension;
    const oppX = 2 * center.x - point_on_arc.x;
    const oppY = 2 * center.y - point_on_arc.y;
    doc.line(toX(oppX), toY(oppY), toX(point_on_arc.x), toY(point_on_arc.y));
    const dist = 2 * Math.sqrt((point_on_arc.x - center.x) ** 2 + (point_on_arc.y - center.y) ** 2);
    const label = geom.DiameterDimension.text_override ?? `\u2300${dist.toFixed(2)}`;
    doc.setFontSize(6);
    doc.text(label, toX(center.x), toY(center.y));
  } else if ('BlockRef' in geom || 'Hatch' in geom || 'Table' in geom) {
    // Skip complex types with a warning
    console.warn(`PDF export: skipping unsupported geometry type in entity ${entity.id}`);
  }
}

function drawArc(
  doc: jsPDF,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  // Approximate arc with line segments
  const segments = 64;
  let sa = startAngle;
  let ea = endAngle;
  if (ea < sa) ea += 2 * Math.PI;
  const step = (ea - sa) / segments;
  for (let i = 0; i < segments; i++) {
    const a1 = sa + step * i;
    const a2 = sa + step * (i + 1);
    // Note: Y is already flipped by toY, so use negative sin for arc in PDF coords
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy - r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2);
    const y2 = cy - r * Math.sin(a2);
    doc.line(x1, y1, x2, y2);
  }
}

function drawDimension(
  doc: jsPDF,
  dim: { start: Point2D; end: Point2D; offset: number; text_override?: string },
  toX: (wx: number) => number,
  toY: (wy: number) => number,
) {
  const { start, end, offset } = dim;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return;

  // Perpendicular direction
  const nx = -dy / len;
  const ny = dx / len;

  const s1x = start.x + nx * offset;
  const s1y = start.y + ny * offset;
  const e1x = end.x + nx * offset;
  const e1y = end.y + ny * offset;

  // Extension lines
  doc.line(toX(start.x), toY(start.y), toX(s1x), toY(s1y));
  doc.line(toX(end.x), toY(end.y), toX(e1x), toY(e1y));

  // Dimension line
  doc.line(toX(s1x), toY(s1y), toX(e1x), toY(e1y));

  // Text
  const midX = (s1x + e1x) / 2;
  const midY = (s1y + e1y) / 2;
  const label = dim.text_override ?? len.toFixed(2);
  doc.setFontSize(6);
  doc.text(label, toX(midX), toY(midY) - 1);
}

export async function exportToPdf(
  entities: Entity[],
  layers: Layer[],
  options: PdfExportOptions,
): Promise<void> {
  const layerMap = new Map<string, Layer>();
  for (const l of layers) layerMap.set(l.id, l);

  // Filter to visible layers only
  const visibleLayerIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const visibleEntities = entities.filter((e) => visibleLayerIds.has(e.layer_id));

  if (visibleEntities.length === 0) {
    console.warn('PDF export: no visible entities to export');
    return;
  }

  // Determine the area bounds: viewBounds (Current View) or entity extents
  const bbox = options.viewBounds ?? computeBoundingBox(visibleEntities);
  if (!bbox) return;

  // When using viewBounds, filter entities to those within the bounds
  const entitiesToRender = options.viewBounds
    ? visibleEntities.filter((e) => {
        const ebox = computeBoundingBox([e]);
        if (!ebox) return false;
        return (
          ebox.maxX >= bbox.minX &&
          ebox.minX <= bbox.maxX &&
          ebox.maxY >= bbox.minY &&
          ebox.minY <= bbox.maxY
        );
      })
    : visibleEntities;

  if (entitiesToRender.length === 0) {
    console.warn('PDF export: no entities in the selected area');
    return;
  }

  const paper = PAPER_SIZES[options.paperSize] ?? PAPER_SIZES.a4;
  const isLandscape = options.orientation === 'landscape';
  const pageW = isLandscape ? paper.h : paper.w;
  const pageH = isLandscape ? paper.w : paper.h;

  const drawW = pageW - 2 * MARGIN;
  const drawH = pageH - 2 * MARGIN;

  const worldW = bbox.maxX - bbox.minX || 1;
  const worldH = bbox.maxY - bbox.minY || 1;

  // Scale: if explicit scale given, use it; otherwise fit to page
  // scale option is in "units per mm" — e.g. scale=50 means 1mm on paper = 50 units in world
  const scale =
    options.scale != null ? 1 / options.scale : Math.min(drawW / worldW, drawH / worldH);

  // Center the drawing on the page
  const scaledW = worldW * scale;
  const scaledH = worldH * scale;
  const offsetX = MARGIN + (drawW - scaledW) / 2;
  const offsetY = MARGIN + (drawH - scaledH) / 2;

  const toX = (wx: number) => offsetX + (wx - bbox.minX) * scale;
  const toY = (wy: number) => offsetY + (bbox.maxY - wy) * scale; // flip Y

  const showLineweights = options.showLineweights !== false;

  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: options.paperSize,
  });

  if (options.title) {
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(options.title, pageW / 2, MARGIN / 2 + 2, { align: 'center' });
  }

  for (const entity of entitiesToRender) {
    drawEntity(doc, entity, layerMap, toX, toY, scale, showLineweights);
  }

  doc.save(`${options.title ?? 'drawing'}.pdf`);
}
