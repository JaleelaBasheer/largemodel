/* eslint-disable no-restricted-globals */
// priorityWorker.js

// const calculateDistance = (point1, point2) => {
//     const dx = point1[0] - point2[0];
//     const dy = point1[1] - point2[1];
//     const dz = point1[2] - point2[2];
//     return Math.sqrt(dx * dx + dy * dy + dz * dz);
// };

// const updatePriorityQueue = (cameraPosition, models) => {
//     const priorityQueue = { high: [], medium: [], low: [] };

//     models.forEach(model => {
//         const distance = calculateDistance(cameraPosition, model.position);
        
//         if (distance < 5) {
//             priorityQueue.high.push(model.fileName);
//         } else if (distance < 10) {
//             priorityQueue.medium.push(model.fileName);
//         } else {
//             priorityQueue.low.push(model.fileName);
//         }
//     });

//     return priorityQueue;
// };

// self.onmessage = (event) => {
//     const { type, cameraPosition, models } = event.data;

//     if (type === 'updatePriority') {
//         const priorityQueue = updatePriorityQueue(cameraPosition, models);
        
//         // Determine which models to load and unload
//         const toLoad = [...priorityQueue.high, ...priorityQueue.medium];
//         const toUnload = priorityQueue.low;

//         // Send messages back to main thread
//         toLoad.forEach(fileName => {
//             self.postMessage({ type: 'load', fileName });
//         });

//         toUnload.forEach(fileName => {
//             self.postMessage({ type: 'unload', fileName });
//         });
//     }
// };
import * as THREE from 'three'

const priorityQueue = {
  high: [],
  medium: [],
  low: []
};

const loadedModels = new Map();

self.onmessage = function(event) {
  const { type, cameraPosition, models, fileName, priorityQueue: newPriorityQueue } = event.data;

  switch (type) {
      case 'updatePriority':
          updatePriorityQueue(cameraPosition, models);
          break;
      case 'newModel':
          addNewModel(fileName, newPriorityQueue);
          break;
      case 'performOcclusionCulling':
          performOcclusionCulling(cameraPosition, event.data.projectionMatrix, event.data.matrixWorldInverse);
          break;
  }
};

function updatePriorityQueue(cameraPosition, models) {
  const camera = new THREE.Vector3().fromArray(cameraPosition);

  models.forEach(model => {
      const distance = camera.distanceTo(new THREE.Vector3().fromArray(model.position));
      updateModelPriority(model.fileName, distance);
  });

  // Sort each queue based on distance
  for (let queue in priorityQueue) {
      priorityQueue[queue].sort((a, b) => a.distance - b.distance);
  }

  // Determine which models to load/unload
  const modelsToLoad = [...priorityQueue.high, ...priorityQueue.medium.slice(0, 5)];
  const modelsToUnload = [...priorityQueue.medium.slice(5), ...priorityQueue.low];

  self.postMessage({
      type: 'updateLoadedModels',
      modelsToLoad: modelsToLoad.map(m => m.fileName),
      modelsToUnload: modelsToUnload.map(m => m.fileName)
  });
}

function updateModelPriority(fileName, distance) {
  let priority;
  if (distance < 10) priority = 'high';
  else if (distance < 20) priority = 'medium';
  else priority = 'low';

  // Remove from old queue
  for (let queue in priorityQueue) {
      const index = priorityQueue[queue].findIndex(m => m.fileName === fileName);
      if (index !== -1) {
          priorityQueue[queue].splice(index, 1);
          break;
      }
  }

  // Add to new queue
  priorityQueue[priority].push({ fileName, distance });
}

function addNewModel(fileName, priority) {
  priorityQueue[priority].push({ fileName, distance: Infinity });
  loadedModels.set(fileName, { priority });
}

function performOcclusionCulling(cameraPosition, projectionMatrix, matrixWorldInverse) {
  // Implement occlusion culling logic here
  // This is a placeholder and should be replaced with actual occlusion culling implementation
  const visibleObjects = []; // This should be populated with actually visible objects

  self.postMessage({
      type: 'occlusionCullingResult',
      visibleObjects: visibleObjects
  });
}

// You might need to implement a minimal Three.js Vector3 class here for distance calculations
class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
  }

  distanceTo(v) {
      const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  fromArray(array) {
      this.x = array[0];
      this.y = array[1];
      this.z = array[2];
      return this;
  }
}
