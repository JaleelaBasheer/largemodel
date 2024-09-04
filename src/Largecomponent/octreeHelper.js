import * as THREE from 'three';

export class SimpleOctree {
  constructor() {
    this.objects = [];
  }

  add(object) {
    this.objects.push(object);
  }

  update(camera) {
    const frustum = new THREE.Frustum();
    const cameraViewProjectionMatrix = new THREE.Matrix4();

    // Ensure camera matrices are up-to-date
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); // Correct way to invert matrix

    // Set up the view-projection matrix
    cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    // Update the frustum from the view-projection matrix
    frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

    // Update visibility of objects
    this.objects.forEach(object => {
      object.visible = frustum.intersectsObject(object);
    });
  }
}
