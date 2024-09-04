import * as THREE from 'three';

export function updateVisibleObjects(camera, scene) {
  const frustum = new THREE.Frustum();
  const cameraViewProjectionMatrix = new THREE.Matrix4();

  camera.updateMatrixWorld();
  camera.matrixWorldInverse.getInverse(camera.matrixWorld);
  cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromMatrix(cameraViewProjectionMatrix);

  scene.traverse((object) => {
    if (object.isMesh) {
      object.visible = frustum.intersectsObject(object);
    }
  });
}
