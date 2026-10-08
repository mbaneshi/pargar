import { jsPDF } from 'jspdf';
import { createLogger } from '@nexus/logger';

const log = createLogger('file-io:pdf-export');

interface Vec2 {
  x: number;
  y: number;
}

interface PdfExportOptions {
  margin?: number;
  pageWidth?: number;
  pageHeight?: number;
}

function computeBbox(entities: any[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const expandPoint = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const ent of entities) {
    const g = ent.geometry;
    if (g.Point) {
      expandPoint(g.Point.position.x, g.Point.position.y);
    }
    if (g.Line) {
      expandPoint(g.Line.start.x, g.Line.start.y);
      expandPoint(g.Line.end.x, g.Line.end.y);
    }
    if (g.Circle) {
      expandPoint(g.Circle.center.x - g.Circle.radius, g.Circle.center.y - g.Circle.radius);
      expandPoint(g.Circle.center.x + g.Circle.radius, g.Circle.center.y + g.Circle.radius);
    }
    if (g.Arc) {
      expandPoint(g.Arc.center.x - g.Arc.radius, g.Arc.center.y - g.Arc.radius);
      expandPoint(g.Arc.center.x + g.Arc.radius, g.Arc.center.y + g.Arc.radius);
    }
    if (g.Rectangle) {
      const { origin, width, height } = g.Rectangle;
      expandPoint(origin.x, origin.y);
      expandPoint(origin.x + width, origin.y + height);
    }
    if (g.Polyline) {
      for (const v of g.Polyline.vertices) expandPoint(v.x, v.y);
    }
    if (g.Text) {
      expandPoint(g.Text.position.x, g.Text.position.y);
    }
  }

  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  }

  return { minX, minY, maxX, maxY };
}

export function exportPdf(
  entitiesJson: string,
  _layersJson?: string,
  options: PdfExportOptions = {},
): Uint8Array {
  let entities: any[];
  try {
    entities = JSON.parse(entitiesJson);
  } catch {
    entities = [];
  }

  log.info('PDF export started', { entityCount: entities.length });

  const margin = options.margin ?? 10;
  const pageWidth = options.pageWidth ?? 297;
  const pageHeight = options.pageHeight ?? 210;

  const { minX, minY, maxX, maxY } = computeBbox(entities);
  const drawW = maxX - minX;
  const drawH = maxY - minY;
  const usableW = pageWidth - margin * 2;
  const usableH = pageHeight - margin * 2;
  const scale = drawW > 0 && drawH > 0 ? Math.min(usableW / drawW, usableH / drawH) : 1;

  const toPageX = (wx: number) => margin + (wx - minX) * scale;
  const toPageY = (wy: number) => margin + (maxY - wy) * scale;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageWidth, pageHeight] });

  for (const ent of entities) {
    const g = ent.geometry;

    if (g.Line) {
      doc.line(
        toPageX(g.Line.start.x),
        toPageY(g.Line.start.y),
        toPageX(g.Line.end.x),
        toPageY(g.Line.end.y),
        'S',
      );
    }

    if (g.Circle) {
      doc.circle(
        toPageX(g.Circle.center.x),
        toPageY(g.Circle.center.y),
        g.Circle.radius * scale,
        'S',
      );
    }

    if (g.Arc) {
      const { center, radius, start_angle, end_angle } = g.Arc;
      const cx = toPageX(center.x);
      const cy = toPageY(center.y);
      const r = radius * scale;
      const steps = Math.max(16, Math.ceil(Math.abs(end_angle - start_angle) * r * 2));
      let prevX: number | null = null;
      let prevY: number | null = null;
      for (let i = 0; i <= steps; i++) {
        const angle = start_angle + ((end_angle - start_angle) * i) / steps;
        const px = cx + Math.cos(angle) * r;
        const py = cy - Math.sin(angle) * r;
        if (prevX !== null && prevY !== null) {
          doc.line(prevX, prevY, px, py, 'S');
        }
        prevX = px;
        prevY = py;
      }
    }

    if (g.Rectangle) {
      const { origin, width, height } = g.Rectangle;
      doc.rect(toPageX(origin.x), toPageY(origin.y + height), width * scale, height * scale, 'S');
    }

    if (g.Polyline) {
      const verts: Vec2[] = g.Polyline.vertices;
      for (let i = 0; i < verts.length - 1; i++) {
        doc.line(
          toPageX(verts[i].x),
          toPageY(verts[i].y),
          toPageX(verts[i + 1].x),
          toPageY(verts[i + 1].y),
          'S',
        );
      }
      if (g.Polyline.closed && verts.length > 1) {
        const last = verts[verts.length - 1];
        doc.line(toPageX(last.x), toPageY(last.y), toPageX(verts[0].x), toPageY(verts[0].y), 'S');
      }
    }

    if (g.Text) {
      doc.setFontSize(g.Text.height * scale * 2.835);
      doc.text(g.Text.content, toPageX(g.Text.position.x), toPageY(g.Text.position.y));
    }

    if (g.Point) {
      const px = toPageX(g.Point.position.x);
      const py = toPageY(g.Point.position.y);
      const d = 1.0;
      doc.line(px - d, py - d, px + d, py + d, 'S');
      doc.line(px + d, py - d, px - d, py + d, 'S');
    }
  }

  const buf = doc.output('arraybuffer');
  return new Uint8Array(buf);
}
