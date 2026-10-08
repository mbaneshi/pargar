import * as THREE from 'three';

export interface BatchEntry {
  entityId: string;
  vertexStart: number;
  vertexCount: number;
}

export interface LineBatch {
  mesh: THREE.LineSegments;
  entries: BatchEntry[];
  materialKey: string;
}

export class LineBatcher {
  private scene: THREE.Scene;
  private batches: Map<string, LineBatch> = new Map();
  private entityToBatch: Map<string, string> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  rebuild(
    entities: { id: string; segments: number[]; materialKey: string }[],
    getMaterial: (key: string) => THREE.Material,
  ) {
    this.clear();

    const groups = new Map<string, { ids: string[]; allSegments: number[][] }>();

    for (const entity of entities) {
      let group = groups.get(entity.materialKey);
      if (!group) {
        group = { ids: [], allSegments: [] };
        groups.set(entity.materialKey, group);
      }
      group.ids.push(entity.id);
      group.allSegments.push(entity.segments);
    }

    for (const [materialKey, group] of groups) {
      const entries: BatchEntry[] = [];
      let totalVertices = 0;

      for (let i = 0; i < group.ids.length; i++) {
        const segs = group.allSegments[i];
        const vertexCount = segs.length / 3;
        entries.push({
          entityId: group.ids[i],
          vertexStart: totalVertices,
          vertexCount,
        });
        totalVertices += vertexCount;
      }

      if (totalVertices === 0) continue;

      const positions = new Float32Array(totalVertices * 3);
      let offset = 0;
      for (const segs of group.allSegments) {
        positions.set(segs, offset);
        offset += segs.length;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = getMaterial(materialKey);
      const mesh = new THREE.LineSegments(geometry, material);
      mesh.frustumCulled = false;

      this.scene.add(mesh);
      this.batches.set(materialKey, { mesh, entries, materialKey });

      for (const entry of entries) {
        this.entityToBatch.set(entry.entityId, materialKey);
      }
    }
  }

  clear() {
    for (const batch of this.batches.values()) {
      this.scene.remove(batch.mesh);
      batch.mesh.geometry.dispose();
    }
    this.batches.clear();
    this.entityToBatch.clear();
  }

  hasEntity(entityId: string): boolean {
    return this.entityToBatch.has(entityId);
  }

  hitTest(worldX: number, worldY: number, threshold: number): string | null {
    let closestId: string | null = null;
    let closestDist = threshold;

    for (const batch of this.batches.values()) {
      const positions = batch.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!positions) continue;

      for (const entry of batch.entries) {
        for (let i = entry.vertexStart; i < entry.vertexStart + entry.vertexCount - 1; i += 2) {
          const ax = positions.getX(i),
            ay = positions.getY(i);
          const bx = positions.getX(i + 1),
            by = positions.getY(i + 1);
          const d = pointToSegmentDist(worldX, worldY, ax, ay, bx, by);
          if (d < closestDist) {
            closestDist = d;
            closestId = entry.entityId;
          }
        }
      }
    }

    return closestId;
  }

  getEntityIdsInRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    mode: 'window' | 'crossing',
  ): string[] {
    const result: string[] = [];

    for (const batch of this.batches.values()) {
      const positions = batch.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!positions) continue;

      for (const entry of batch.entries) {
        let eMinX = Infinity,
          eMinY = Infinity,
          eMaxX = -Infinity,
          eMaxY = -Infinity;
        for (let i = entry.vertexStart; i < entry.vertexStart + entry.vertexCount; i++) {
          const x = positions.getX(i),
            y = positions.getY(i);
          if (x < eMinX) eMinX = x;
          if (y < eMinY) eMinY = y;
          if (x > eMaxX) eMaxX = x;
          if (y > eMaxY) eMaxY = y;
        }

        if (mode === 'window') {
          if (eMinX >= minX && eMaxX <= maxX && eMinY >= minY && eMaxY <= maxY) {
            result.push(entry.entityId);
          }
        } else {
          if (eMaxX >= minX && eMinX <= maxX && eMaxY >= minY && eMinY <= maxY) {
            result.push(entry.entityId);
          }
        }
      }
    }

    return result;
  }

  getBatchCount(): number {
    return this.batches.size;
  }

  getEntityCount(): number {
    return this.entityToBatch.size;
  }
}

function pointToSegmentDist(
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
