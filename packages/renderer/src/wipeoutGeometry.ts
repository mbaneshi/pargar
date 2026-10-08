import * as THREE from 'three';

interface Point2D {
  x: number;
  y: number;
}

/**
 * Build the Three.js Mesh for a Wipeout entity.
 *
 * AutoCAD Wipeout is an opaque polygon that masks underlying geometry.
 * We render as a `THREE.Mesh` with `MeshBasicMaterial` at z=0.5 so it
 * occludes lines/circles/polylines (which sit at z=0). The mask color
 * matches the canvas background; future work can read `WIPEOUTFRAME`
 * sysvar to toggle the boundary outline visibility — out of scope for
 * the C2 render-coverage gap and tracked separately.
 */
export function buildWipeoutMesh(vertices: Point2D[]): THREE.Mesh | null {
  if (vertices.length < 3) return null;

  const shape = new THREE.Shape();
  shape.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    shape.lineTo(vertices[i].x, vertices[i].y);
  }
  shape.lineTo(vertices[0].x, vertices[0].y);

  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: false,
    opacity: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = 0.5;
  return mesh;
}
