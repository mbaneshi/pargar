import type { FileFormatAdapter, FileEntity, FileLayer } from '@nexus/core';

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBbox(entities: FileEntity[]): BBox {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  const expand = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (const ent of entities) {
    const g = ent.geometry as Record<string, any>;
    if (g.Point) expand(g.Point.position.x, g.Point.position.y);
    if (g.Line) {
      expand(g.Line.start.x, g.Line.start.y);
      expand(g.Line.end.x, g.Line.end.y);
    }
    if (g.Circle) {
      expand(g.Circle.center.x - g.Circle.radius, g.Circle.center.y - g.Circle.radius);
      expand(g.Circle.center.x + g.Circle.radius, g.Circle.center.y + g.Circle.radius);
    }
    if (g.Arc) {
      expand(g.Arc.center.x - g.Arc.radius, g.Arc.center.y - g.Arc.radius);
      expand(g.Arc.center.x + g.Arc.radius, g.Arc.center.y + g.Arc.radius);
    }
    if (g.Rectangle) {
      const { origin, width, height } = g.Rectangle;
      expand(origin.x, origin.y);
      expand(origin.x + width, origin.y + height);
    }
    if (g.Polyline) {
      for (const v of g.Polyline.vertices) expand(v.x, v.y);
    }
    if (g.Text) expand(g.Text.position.x, g.Text.position.y);
  }

  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return { minX, minY, maxX, maxY };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportSvg(
  entities: FileEntity[],
  layers: FileLayer[],
  options?: Record<string, unknown>,
): string {
  const margin = (options?.margin as number) ?? 10;
  const bbox = computeBbox(entities);
  const width = bbox.maxX - bbox.minX + margin * 2;
  const height = bbox.maxY - bbox.minY + margin * 2;
  const strokeColor = (options?.strokeColor as string) ?? '#ffffff';
  const strokeWidth = (options?.strokeWidth as number) ?? 0.5;
  const backgroundColor = options?.backgroundColor as string | undefined;

  const layerColorMap = new Map<string, string>();
  for (const l of layers) {
    if (l.id && l.color) layerColorMap.set(l.id, l.color);
  }

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.minX - margin} ${-(bbox.maxY + margin)} ${width} ${height}" width="${width}" height="${height}">`,
  );

  if (backgroundColor) {
    parts.push(
      `<rect x="${bbox.minX - margin}" y="${-(bbox.maxY + margin)}" width="${width}" height="${height}" fill="${backgroundColor}" />`,
    );
  }

  for (const ent of entities) {
    const g = ent.geometry as Record<string, any>;
    const color = ent.color || layerColorMap.get(ent.layer_id) || strokeColor;

    if (g.Line) {
      parts.push(
        `<line x1="${g.Line.start.x}" y1="${-g.Line.start.y}" x2="${g.Line.end.x}" y2="${-g.Line.end.y}" stroke="${color}" stroke-width="${strokeWidth}" />`,
      );
    }

    if (g.Circle) {
      parts.push(
        `<circle cx="${g.Circle.center.x}" cy="${-g.Circle.center.y}" r="${g.Circle.radius}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
      );
    }

    if (g.Arc) {
      const { center, radius, start_angle, end_angle } = g.Arc;
      const sx = center.x + radius * Math.cos(start_angle);
      const sy = -(center.y + radius * Math.sin(start_angle));
      const ex = center.x + radius * Math.cos(end_angle);
      const ey = -(center.y + radius * Math.sin(end_angle));

      let sweep = end_angle - start_angle;
      if (sweep < 0) sweep += Math.PI * 2;
      const largeArc = sweep > Math.PI ? 1 : 0;
      // With Y-flip (negating Y), sweep direction inverts: use sweep-flag 1
      const sweepFlag = 1;

      parts.push(
        `<path d="M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${ex} ${ey}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
      );
    }

    if (g.Rectangle) {
      const { origin, width: w, height: h } = g.Rectangle;
      parts.push(
        `<rect x="${origin.x}" y="${-(origin.y + h)}" width="${w}" height="${h}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
      );
    }

    if (g.Polyline) {
      const points = g.Polyline.vertices.map((v: any) => `${v.x},${-v.y}`).join(' ');
      if (g.Polyline.closed) {
        parts.push(
          `<polygon points="${points}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
        );
      } else {
        parts.push(
          `<polyline points="${points}" stroke="${color}" stroke-width="${strokeWidth}" fill="none" />`,
        );
      }
    }

    if (g.Text) {
      const fontSize = g.Text.height || 2.5;
      parts.push(
        `<text x="${g.Text.position.x}" y="${-g.Text.position.y}" font-size="${fontSize}" fill="${color}">${escapeXml(g.Text.content)}</text>`,
      );
    }

    if (g.Point) {
      const px = g.Point.position.x;
      const py = -g.Point.position.y;
      const d = 1;
      parts.push(
        `<line x1="${px - d}" y1="${py - d}" x2="${px + d}" y2="${py + d}" stroke="${color}" stroke-width="${strokeWidth}" />`,
      );
      parts.push(
        `<line x1="${px + d}" y1="${py - d}" x2="${px - d}" y2="${py + d}" stroke="${color}" stroke-width="${strokeWidth}" />`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

export const svgAdapter: FileFormatAdapter = {
  id: 'svg',
  name: 'SVG Image',
  extensions: ['svg'],
  mimeType: 'image/svg+xml',
  capabilities: { import: false, export: true },

  export: exportSvg,
};
