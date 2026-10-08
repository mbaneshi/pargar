import * as THREE from 'three';

const MAX_GRIPS = 4096;

export class GripPool {
  private instancedMesh: THREE.InstancedMesh;
  private scene: THREE.Scene;
  private count = 0;
  private tempMatrix = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00bfff,
      depthTest: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_GRIPS);
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.renderOrder = 10;
    this.scene.add(this.instancedMesh);
  }

  update(gripPoints: { x: number; y: number }[], gripSize: number) {
    this.count = Math.min(gripPoints.length, MAX_GRIPS);
    this.instancedMesh.count = this.count;

    for (let i = 0; i < this.count; i++) {
      const gp = gripPoints[i];
      this.tempMatrix.makeScale(gripSize, gripSize, 0.01);
      this.tempMatrix.setPosition(gp.x, gp.y, 0.2);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    }

    if (this.count > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    this.instancedMesh.count = 0;
    this.count = 0;
  }

  dispose() {
    this.scene.remove(this.instancedMesh);
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
