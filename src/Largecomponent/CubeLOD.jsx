import * as THREE from 'three';

class CubeLOD extends THREE.Object3D {
  constructor(color, size = 0.5) {
    super();

    this.levels = [
      { distance: 0, object: this.createCube(color, size, 8) },
      { distance: 10, object: this.createCube(color, size, 4) },
      { distance: 50, object: this.createCube(color, size, 2) },
      { distance: 100, object: this.createCube(color, size, 1) }
    ];

    this.levels.forEach(level => this.add(level.object));
    this.updateLOD(0);

    // Create bounding sphere
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), size * Math.sqrt(3) / 2);
  }

  createCube(color, size, segments) {
    const geometry = new THREE.BoxGeometry(size, size, size, segments, segments, segments);
    const material = new THREE.MeshPhongMaterial({ color });
    return new THREE.Mesh(geometry, material);
  }

  updateLOD(distance) {
    for (let i = 0; i < this.levels.length; i++) {
      if (distance < this.levels[i].distance) {
        this.levels.forEach((level, index) => {
          level.object.visible = index === i - 1;
        });
        break;
      }
    }
    // If distance is greater than all levels, show the lowest detail
    if (distance >= this.levels[this.levels.length - 1].distance) {
      this.levels.forEach((level, index) => {
        level.object.visible = index === this.levels.length - 1;
      });
    }
  }

  // Override updateMatrixWorld to update bounding sphere
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    this.boundingSphere.center.setFromMatrixPosition(this.matrixWorld);
  }
}

export { CubeLOD };