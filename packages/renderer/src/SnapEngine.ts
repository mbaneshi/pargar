export interface SnapPoint {
  x: number;
  y: number;
  type:
    | 'endpoint'
    | 'midpoint'
    | 'center'
    | 'geometric_center'
    | 'intersection'
    | 'grid'
    | 'nearest'
    | 'quadrant'
    | 'tangent'
    | 'extension';
}

export interface SnapConfig {
  enabled: boolean;
  gridSize: number;
  threshold: number; // in world units (will be computed from screen pixels)
  types: {
    endpoint: boolean;
    midpoint: boolean;
    center: boolean;
    /// Geometric Center (AutoCAD GCEN): centroid of closed shapes — closed
    /// polylines, regions, hatches, circles, ellipses, rectangles. Off by
    /// default; typically activated via the OSNAP override menu (Shift+RClick).
    geometric_center: boolean;
    intersection: boolean;
    grid: boolean;
    nearest: boolean;
    quadrant: boolean;
    /// Tangent snap requires a from-point and only applies to circles/arcs.
    /// Off by default — typically activated via the OSNAP override menu (Shift+RClick).
    tangent: boolean;
    /// Extension (AutoCAD EXT): snaps to the projection of the cursor onto a
    /// line extended beyond either endpoint (parametric t < 0 or t > 1).
    /// Off by default; typically activated via the OSNAP override menu
    /// (Shift+RClick).
    extension: boolean;
  };
}

interface Point2D {
  x: number;
  y: number;
}

interface SnapGeometry {
  Point?: { position: Point2D };
  Line?: { start: Point2D; end: Point2D };
  Circle?: { center: Point2D; radius: number };
  Arc?: { center: Point2D; radius: number; start_angle: number; end_angle: number };
  Rectangle?: { origin: Point2D; width: number; height: number; rotation?: number };
  Polyline?: { vertices: Point2D[]; closed: boolean };
  Ellipse?: { center: Point2D; semi_major: number; semi_minor: number; rotation: number };
}

export interface EntityData {
  id: string;
  geometry: SnapGeometry;
}

export class SnapEngine {
  public config: SnapConfig = {
    enabled: true,
    gridSize: 1,
    threshold: 2, // world units
    types: {
      endpoint: true,
      midpoint: true,
      center: true,
      geometric_center: false,
      intersection: true,
      grid: true,
      nearest: true,
      quadrant: true,
      tangent: false,
      extension: false,
    },
  };

  // One-shot override (Shift+RClick OSNAP override menu). When set, the next
  // kernel snap query is constrained to exactly this type. The override
  // persists across mousemoves and is cleared on point-commit by the
  // InteractionShell. 'none' suppresses snap entirely. 'perpendicular' is
  // valid here even though it isn't in SnapPoint['type'] (it lives only on
  // the kernel side as a snap result).
  public oneShotOverride: SnapPoint['type'] | 'perpendicular' | 'none' | null = null;

  findSnap(worldX: number, worldY: number, entities: EntityData[]): SnapPoint | null {
    if (!this.config.enabled) return null;
    if (!Number.isFinite(worldX) || !Number.isFinite(worldY)) return null;

    let best: SnapPoint | null = null;
    let bestDist = this.config.threshold;

    const check = (x: number, y: number, type: SnapPoint['type']) => {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const d = Math.sqrt((worldX - x) ** 2 + (worldY - y) ** 2);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y, type };
      }
    };

    for (const ent of entities) {
      const g = ent?.geometry;
      if (!g) continue;

      if (g.Point && this.config.types.endpoint) {
        check(g.Point.position.x, g.Point.position.y, 'endpoint');
      }

      if (g.Line && this.config.types.endpoint) {
        check(g.Line.start.x, g.Line.start.y, 'endpoint');
        check(g.Line.end.x, g.Line.end.y, 'endpoint');
        if (this.config.types.midpoint) {
          const mx = (g.Line.start.x + g.Line.end.x) / 2;
          const my = (g.Line.start.y + g.Line.end.y) / 2;
          check(mx, my, 'midpoint');
        }
      }

      if (g.Circle && this.config.types.center) {
        check(g.Circle.center.x, g.Circle.center.y, 'center');
        if (this.config.types.endpoint) {
          const c = g.Circle.center;
          const r = g.Circle.radius;
          if (Number.isFinite(r) && r > 0) {
            check(c.x + r, c.y, 'endpoint');
            check(c.x - r, c.y, 'endpoint');
            check(c.x, c.y + r, 'endpoint');
            check(c.x, c.y - r, 'endpoint');
          }
        }
      }

      if (g.Arc && this.config.types.center) {
        check(g.Arc.center.x, g.Arc.center.y, 'center');
        if (this.config.types.endpoint) {
          const c = g.Arc.center;
          const r = g.Arc.radius;
          if (Number.isFinite(r) && r > 0) {
            check(
              c.x + r * Math.cos(g.Arc.start_angle),
              c.y + r * Math.sin(g.Arc.start_angle),
              'endpoint',
            );
            check(
              c.x + r * Math.cos(g.Arc.end_angle),
              c.y + r * Math.sin(g.Arc.end_angle),
              'endpoint',
            );
          }
        }
      }

      if (g.Rectangle && this.config.types.endpoint) {
        const o = g.Rectangle.origin;
        const w = g.Rectangle.width;
        const h = g.Rectangle.height;
        check(o.x, o.y, 'endpoint');
        check(o.x + w, o.y, 'endpoint');
        check(o.x + w, o.y + h, 'endpoint');
        check(o.x, o.y + h, 'endpoint');
        if (this.config.types.center) {
          check(o.x + w / 2, o.y + h / 2, 'center');
        }
        if (this.config.types.midpoint) {
          check(o.x + w / 2, o.y, 'midpoint');
          check(o.x + w, o.y + h / 2, 'midpoint');
          check(o.x + w / 2, o.y + h, 'midpoint');
          check(o.x, o.y + h / 2, 'midpoint');
        }
      }

      if (g.Polyline && this.config.types.endpoint) {
        for (const v of g.Polyline.vertices) {
          check(v.x, v.y, 'endpoint');
        }
        if (this.config.types.midpoint) {
          const verts = g.Polyline.vertices;
          for (let i = 0; i < verts.length - 1; i++) {
            check((verts[i].x + verts[i + 1].x) / 2, (verts[i].y + verts[i + 1].y) / 2, 'midpoint');
          }
        }
      }

      if (this.config.types.quadrant) {
        if (g.Circle) {
          const c = g.Circle.center;
          const r = g.Circle.radius;
          check(c.x + r, c.y, 'quadrant');
          check(c.x, c.y + r, 'quadrant');
          check(c.x - r, c.y, 'quadrant');
          check(c.x, c.y - r, 'quadrant');
        }

        if (g.Arc) {
          const c = g.Arc.center;
          const r = g.Arc.radius;
          const quadrantAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
          for (const qa of quadrantAngles) {
            if (this.angleInArc(qa, g.Arc.start_angle, g.Arc.end_angle)) {
              check(c.x + r * Math.cos(qa), c.y + r * Math.sin(qa), 'quadrant');
            }
          }
        }

        if (g.Ellipse) {
          const c = g.Ellipse.center;
          const a = g.Ellipse.semi_major;
          const b = g.Ellipse.semi_minor;
          const rot = g.Ellipse.rotation || 0;
          const cosR = Math.cos(rot);
          const sinR = Math.sin(rot);
          const endpoints = [
            { lx: a, ly: 0 },
            { lx: -a, ly: 0 },
            { lx: 0, ly: b },
            { lx: 0, ly: -b },
          ];
          for (const ep of endpoints) {
            check(c.x + ep.lx * cosR - ep.ly * sinR, c.y + ep.lx * sinR + ep.ly * cosR, 'quadrant');
          }
        }
      }
    }

    // Intersection snaps
    if (this.config.types.intersection) {
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          const g1 = entities[i]?.geometry;
          const g2 = entities[j]?.geometry;
          if (!g1 || !g2) continue;
          if (g1.Line && g2.Line) {
            const { start: s1, end: e1 } = g1.Line;
            const { start: s2, end: e2 } = g2.Line;
            const d1x = e1.x - s1.x,
              d1y = e1.y - s1.y;
            const d2x = e2.x - s2.x,
              d2y = e2.y - s2.y;
            const denom = d1x * d2y - d1y * d2x;
            if (Number.isFinite(denom) && Math.abs(denom) > 1e-10) {
              const t = ((s2.x - s1.x) * d2y - (s2.y - s1.y) * d2x) / denom;
              const u = ((s2.x - s1.x) * d1y - (s2.y - s1.y) * d1x) / denom;
              if (
                Number.isFinite(t) &&
                Number.isFinite(u) &&
                t >= -0.01 &&
                t <= 1.01 &&
                u >= -0.01 &&
                u <= 1.01
              ) {
                check(s1.x + t * d1x, s1.y + t * d1y, 'intersection');
              }
            }
          }
          const lineCirclePairs: Array<[any, any]> = [];
          if (g1.Line && g2.Circle) lineCirclePairs.push([g1.Line, g2.Circle]);
          if (g2.Line && g1.Circle) lineCirclePairs.push([g2.Line, g1.Circle]);
          for (const [line, circle] of lineCirclePairs) {
            const { start: s, end: e } = line;
            const { center: c, radius: r } = circle;
            if (!Number.isFinite(r) || r <= 0) continue;
            const dx = e.x - s.x,
              dy = e.y - s.y;
            const fx = s.x - c.x,
              fy = s.y - c.y;
            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const cc = fx * fx + fy * fy - r * r;
            let discriminant = b * b - 4 * a * cc;
            if (Number.isFinite(discriminant) && discriminant >= 0 && a > 1e-10) {
              discriminant = Math.sqrt(discriminant);
              for (const sign of [-1, 1]) {
                const t = (-b + sign * discriminant) / (2 * a);
                if (Number.isFinite(t) && t >= -0.01 && t <= 1.01) {
                  check(s.x + t * dx, s.y + t * dy, 'intersection');
                }
              }
            }
          }
        }
      }
    }

    // Nearest snap (on-curve projection)
    if (this.config.types.nearest && !best) {
      for (const ent of entities) {
        const g = ent?.geometry;
        if (!g) continue;
        if (g.Line) {
          const { start: s, end: e } = g.Line;
          const dx = e.x - s.x,
            dy = e.y - s.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0) {
            let t = ((worldX - s.x) * dx + (worldY - s.y) * dy) / lenSq;
            t = Math.max(0, Math.min(1, t));
            check(s.x + t * dx, s.y + t * dy, 'nearest');
          }
        } else if (g.Circle) {
          const { center, radius } = g.Circle;
          if (Number.isFinite(radius) && radius > 0) {
            const dx = worldX - center.x,
              dy = worldY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1e-10) {
              check(center.x + (dx / dist) * radius, center.y + (dy / dist) * radius, 'nearest');
            } else {
              check(center.x + radius, center.y, 'nearest');
            }
          }
        } else if (g.Arc) {
          const { center, radius, start_angle, end_angle } = g.Arc;
          if (Number.isFinite(radius) && radius > 0) {
            const dx = worldX - center.x,
              dy = worldY - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1e-10) {
              let angle = Math.atan2(dy, dx);
              if (angle < 0) angle += Math.PI * 2;
              let sa = start_angle % (Math.PI * 2);
              let ea = end_angle % (Math.PI * 2);
              if (sa < 0) sa += Math.PI * 2;
              if (ea < 0) ea += Math.PI * 2;
              const inArc = sa <= ea ? angle >= sa && angle <= ea : angle >= sa || angle <= ea;
              if (inArc) {
                check(center.x + (dx / dist) * radius, center.y + (dy / dist) * radius, 'nearest');
              }
            } else {
              check(center.x + radius, center.y, 'nearest');
            }
          }
        }
      }
    }

    // Grid snap as fallback
    if (!best && this.config.types.grid) {
      const gs = this.config.gridSize;
      best = {
        x: Math.round(worldX / gs) * gs,
        y: Math.round(worldY / gs) * gs,
        type: 'grid',
      };
    }

    return best;
  }

  private angleInArc(angle: number, startAngle: number, endAngle: number): boolean {
    const TWO_PI = Math.PI * 2;
    let a = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    let sa = ((startAngle % TWO_PI) + TWO_PI) % TWO_PI;
    let ea = ((endAngle % TWO_PI) + TWO_PI) % TWO_PI;
    return sa <= ea ? a >= sa && a <= ea : a >= sa || a <= ea;
  }
}
