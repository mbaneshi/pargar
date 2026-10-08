import * as THREE from 'three';
import type { RendererEntity } from './CadRenderer.js';

export interface SelectionState {
  selectedIds: Set<string>;
}

export interface GripHit {
  entityId: string;
  gripIndex: number;
  gripType: 'endpoint' | 'midpoint' | 'center';
  point: { x: number; y: number };
}

export class SelectionManager {
  public selectedIds: Set<string> = new Set();
  private highlightMeshes: Map<string, THREE.Object3D> = new Map();
  private gripMeshes: THREE.Object3D[] = [];
  private scene: THREE.Scene;

  // Colors
  private highlightColor = new THREE.Color(0x00bfff); // cyan
  private gripColor = new THREE.Color(0x00bfff);
  private gripSize = 0.4; // world units, will be adjusted by zoom

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  select(id: string) {
    this.selectedIds.add(id);
  }

  deselect(id: string) {
    this.selectedIds.delete(id);
  }

  clear() {
    this.selectedIds.clear();
    this.clearVisuals();
  }

  toggle(id: string) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds);
  }

  hitTest(
    worldX: number,
    worldY: number,
    entityMeshes: Map<string, THREE.Object3D>,
    threshold: number,
  ): string | null {
    let closestId: string | null = null;
    let closestDist = threshold;

    const point = new THREE.Vector3(worldX, worldY, 0);

    for (const [id, obj] of entityMeshes) {
      const box = new THREE.Box3().setFromObject(obj);
      const boxDist = box.distanceToPoint(point);

      if (boxDist < closestDist) {
        if (obj instanceof THREE.Line) {
          const positions = (obj.geometry as THREE.BufferGeometry).getAttribute('position');
          if (positions) {
            for (let i = 0; i < positions.count - 1; i++) {
              const ax = positions.getX(i),
                ay = positions.getY(i);
              const bx = positions.getX(i + 1),
                by = positions.getY(i + 1);
              const d = this.pointToSegmentDist(worldX, worldY, ax, ay, bx, by);
              if (d < closestDist) {
                closestDist = d;
                closestId = id;
              }
            }
          }
        }
      }
    }

    return closestId;
  }

  private pointToSegmentDist(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax,
      dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = ax + t * dx,
      projY = ay + t * dy;
    return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
  }

  updateVisuals(
    entityMeshes: Map<string, THREE.Object3D>,
    entities: RendererEntity[],
    zoom: number,
  ) {
    this.clearVisuals();

    const gripSize = zoom * 0.008;

    for (const id of this.selectedIds) {
      const mesh = entityMeshes.get(id);
      if (!mesh || !(mesh instanceof THREE.Line)) continue;

      const highlight = mesh.clone();
      (highlight as THREE.Line).material = new THREE.LineBasicMaterial({
        color: this.highlightColor,
        linewidth: 2,
      });
      highlight.position.z = 0.1;
      this.scene.add(highlight);
      this.highlightMeshes.set(id, highlight);

      const entity = entities.find((e) => e.id === id);
      if (!entity) continue;

      const gripPoints = this.getGripPoints(entity);
      for (const gp of gripPoints) {
        const geo = new THREE.BoxGeometry(gripSize, gripSize, 0.01);
        const mat = new THREE.MeshBasicMaterial({ color: this.gripColor });
        const grip = new THREE.Mesh(geo, mat);
        grip.position.set(gp.x, gp.y, 0.2);
        this.scene.add(grip);
        this.gripMeshes.push(grip);
      }
    }
  }

  selectByRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    mode: 'window' | 'crossing',
    entityMeshes: Map<string, THREE.Object3D>,
    entities: RendererEntity[],
  ): string[] {
    const minX = Math.min(x1, x2),
      maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2),
      maxY = Math.max(y1, y2);
    const rectBox = new THREE.Box2(new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, maxY));

    const result: string[] = [];
    for (const entity of entities) {
      const obj = entityMeshes.get(entity.id);
      if (!obj) continue;

      const objBox3 = new THREE.Box3().setFromObject(obj);
      const objBox2 = new THREE.Box2(
        new THREE.Vector2(objBox3.min.x, objBox3.min.y),
        new THREE.Vector2(objBox3.max.x, objBox3.max.y),
      );

      if (mode === 'window') {
        if (rectBox.containsBox(objBox2)) {
          result.push(entity.id);
        }
      } else {
        if (rectBox.intersectsBox(objBox2)) {
          result.push(entity.id);
        }
      }
    }
    return result;
  }

  getGripAtPoint(
    worldX: number,
    worldY: number,
    entities: RendererEntity[],
    threshold: number,
  ): GripHit | null {
    let closest: GripHit | null = null;
    let closestDist = threshold;

    for (const id of this.selectedIds) {
      const entity = entities.find((e) => e.id === id);
      if (!entity) continue;

      const grips = this.getGripPoints(entity);
      for (let i = 0; i < grips.length; i++) {
        const dx = worldX - grips[i].x;
        const dy = worldY - grips[i].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) {
          closestDist = d;
          closest = {
            entityId: id,
            gripIndex: i,
            gripType: this.getGripType(entity, i),
            point: grips[i],
          };
        }
      }
    }

    return closest;
  }

  private getGripType(
    entity: RendererEntity,
    gripIndex: number,
  ): 'endpoint' | 'midpoint' | 'center' {
    const g = entity.geometry;
    if (g.Line) {
      return gripIndex < 2 ? 'endpoint' : 'midpoint';
    } else if (g.Circle) {
      return gripIndex === 0 ? 'center' : 'endpoint';
    } else if (g.Arc) {
      return gripIndex === 0 ? 'center' : 'endpoint';
    } else if (g.Rectangle) {
      return gripIndex < 4 ? 'endpoint' : 'center';
    } else if (g.Polyline) {
      return 'endpoint';
    } else if (g.Ellipse) {
      return gripIndex === 0 ? 'center' : 'endpoint';
    }
    return 'endpoint';
  }

  public getGripPoints(entity: RendererEntity): { x: number; y: number }[] {
    const g = entity.geometry;
    const points: { x: number; y: number }[] = [];

    if (g.Line) {
      points.push(g.Line.start, g.Line.end);
      points.push({
        x: (g.Line.start.x + g.Line.end.x) / 2,
        y: (g.Line.start.y + g.Line.end.y) / 2,
      });
    } else if (g.Circle) {
      const c = g.Circle.center,
        r = g.Circle.radius;
      points.push(c);
      points.push({ x: c.x + r, y: c.y }, { x: c.x - r, y: c.y });
      points.push({ x: c.x, y: c.y + r }, { x: c.x, y: c.y - r });
    } else if (g.Arc) {
      const c = g.Arc.center,
        r = g.Arc.radius;
      points.push(c);
      points.push({
        x: c.x + r * Math.cos(g.Arc.start_angle),
        y: c.y + r * Math.sin(g.Arc.start_angle),
      });
      points.push({
        x: c.x + r * Math.cos(g.Arc.end_angle),
        y: c.y + r * Math.sin(g.Arc.end_angle),
      });
    } else if (g.Rectangle) {
      const o = g.Rectangle.origin,
        w = g.Rectangle.width,
        h = g.Rectangle.height;
      points.push(o, { x: o.x + w, y: o.y }, { x: o.x + w, y: o.y + h }, { x: o.x, y: o.y + h });
      points.push({ x: o.x + w / 2, y: o.y + h / 2 });
    } else if (g.Polyline) {
      for (const v of g.Polyline.vertices) points.push(v);
    } else if (g.Ellipse) {
      const c = g.Ellipse.center;
      const a = g.Ellipse.semi_major;
      const b = g.Ellipse.semi_minor;
      const rot = g.Ellipse.rotation || 0;
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      points.push(c);
      points.push({ x: c.x + a * cos, y: c.y + a * sin });
      points.push({ x: c.x - a * cos, y: c.y - a * sin });
      points.push({ x: c.x - b * sin, y: c.y + b * cos });
      points.push({ x: c.x + b * sin, y: c.y - b * cos });
    } else if (g.Spline) {
      for (const p of g.Spline.control_points) points.push(p);
    } else if (g.Text) {
      points.push(g.Text.position);
    } else if (g.MText) {
      points.push(g.MText.position);
    } else if (g.Point) {
      points.push(g.Point.position);
    } else if (g.ConstructionLine) {
      points.push(g.ConstructionLine.origin);
    } else if (g.Dimension) {
      points.push(g.Dimension.start, g.Dimension.end);
    } else if (g.AlignedDimension) {
      points.push(g.AlignedDimension.start, g.AlignedDimension.end);
    } else if (g.RadialDimension) {
      points.push(g.RadialDimension.center, g.RadialDimension.point_on_arc);
    } else if (g.DiameterDimension) {
      points.push(g.DiameterDimension.center, g.DiameterDimension.point_on_arc);
    } else if (g.AngularDimension) {
      points.push(
        g.AngularDimension.center,
        g.AngularDimension.start_ray,
        g.AngularDimension.end_ray,
      );
    } else if (g.RevisionCloud) {
      for (const p of g.RevisionCloud.boundary) points.push(p);
    }

    return points;
  }

  clearVisuals() {
    for (const obj of this.highlightMeshes.values()) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.highlightMeshes.clear();
    for (const obj of this.gripMeshes) {
      this.scene.remove(obj);
      this.disposeObject(obj);
    }
    this.gripMeshes = [];
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
      if (child instanceof THREE.Sprite) {
        child.material.map?.dispose();
        child.material.dispose();
      }
    });
  }
}
