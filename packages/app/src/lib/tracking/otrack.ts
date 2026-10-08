import type { Vec2 } from '../shell/types';

export interface TrackingGuide {
  from: Vec2;
  horizontal: boolean;
}

export interface OtrackResult {
  point: Vec2;
  guides: TrackingGuide[];
}

export function findOtrackSnap(
  cursor: Vec2,
  acquiredPoints: Vec2[],
  threshold: number,
): OtrackResult | null {
  if (acquiredPoints.length === 0) return null;

  const activeGuides: TrackingGuide[] = [];
  let bestDist = threshold;
  let bestPoint: Vec2 | null = null;
  let bestGuides: TrackingGuide[] = [];

  // Check each acquired point for horizontal/vertical alignment
  for (const ap of acquiredPoints) {
    const hDist = Math.abs(cursor.y - ap.y);
    const vDist = Math.abs(cursor.x - ap.x);

    if (hDist < threshold) {
      activeGuides.push({ from: ap, horizontal: true });
    }
    if (vDist < threshold) {
      activeGuides.push({ from: ap, horizontal: false });
    }
  }

  // Check for alignment line intersections (two acquired points creating crosshairs)
  for (let i = 0; i < acquiredPoints.length; i++) {
    for (let j = i + 1; j < acquiredPoints.length; j++) {
      const a = acquiredPoints[i];
      const b = acquiredPoints[j];

      // a provides horizontal line, b provides vertical line
      const p1: Vec2 = { x: b.x, y: a.y };
      const d1 = Math.sqrt(
        (cursor.x - p1.x) * (cursor.x - p1.x) + (cursor.y - p1.y) * (cursor.y - p1.y),
      );
      if (d1 < bestDist) {
        bestDist = d1;
        bestPoint = p1;
        bestGuides = [
          { from: a, horizontal: true },
          { from: b, horizontal: false },
        ];
      }

      // a provides vertical line, b provides horizontal line
      const p2: Vec2 = { x: a.x, y: b.y };
      const d2 = Math.sqrt(
        (cursor.x - p2.x) * (cursor.x - p2.x) + (cursor.y - p2.y) * (cursor.y - p2.y),
      );
      if (d2 < bestDist) {
        bestDist = d2;
        bestPoint = p2;
        bestGuides = [
          { from: a, horizontal: false },
          { from: b, horizontal: true },
        ];
      }
    }
  }

  // If intersection found, prefer it
  if (bestPoint) {
    return { point: bestPoint, guides: bestGuides };
  }

  // Otherwise snap to single alignment line
  if (activeGuides.length > 0) {
    // Pick closest guide
    let closestDist = Infinity;
    let closestGuide: TrackingGuide | null = null;
    for (const g of activeGuides) {
      const d = g.horizontal ? Math.abs(cursor.y - g.from.y) : Math.abs(cursor.x - g.from.x);
      if (d < closestDist) {
        closestDist = d;
        closestGuide = g;
      }
    }
    if (closestGuide) {
      const snapped: Vec2 = closestGuide.horizontal
        ? { x: cursor.x, y: closestGuide.from.y }
        : { x: closestGuide.from.x, y: cursor.y };
      return { point: snapped, guides: [closestGuide] };
    }
  }

  return null;
}
