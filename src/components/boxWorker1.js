/* eslint-disable no-restricted-globals */
// boxWorker.js
import * as THREE from 'three';

self.onmessage = function(e) {
  const { boxes, cameraMatrix, cameraProjectionMatrix } = e.data;

  // Create a new Frustum
  const frustum = new THREE.Frustum();

  // Set up the camera's matrices
  const camera = new THREE.PerspectiveCamera();

  // Use Matrix4 to set camera's matrixWorld and projectionMatrix
  const matrixWorld = new THREE.Matrix4().fromArray(cameraMatrix);
  const projectionMatrix = new THREE.Matrix4().fromArray(cameraProjectionMatrix);

  camera.matrixWorld.copy(matrixWorld);
  camera.projectionMatrix.copy(projectionMatrix);

  // Calculate the inverse of matrixWorld and set the camera's matrixWorldInverse
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

  // Set up the frustum based on the camera's combined projection and inverse world matrix
  frustum.setFromProjectionMatrix(camera.projectionMatrix.multiply(camera.matrixWorldInverse));

  // Filter the boxes that are within the frustum
  const visibleBoxes = boxes.filter(box => {
    const position = new THREE.Vector3(box.x, box.y, box.z);
    return frustum.containsPoint(position);
  });

  // Post the visible boxes back to the main thread
  self.postMessage({ visibleBoxes });
};
