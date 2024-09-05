/* eslint-disable no-restricted-globals */


let cubeData = [];
let dimensions = [];
const frustum = {
  planes: Array(6).fill().map(() => ({ normal: { x: 0, y: 0, z: 0 }, constant: 0 }))
};

self.onmessage = function(e) {
  if (e.data.type === 'init') {
    dimensions = e.data.dimensions;
    initializeCubes(e.data.cubeCount);
  } else if (e.data.type === 'updateCamera') {
    updateFrustum(e.data.projectionMatrix);
    const { visibleCubes, invisibleCubes } = updateCubeVisibility(e.data.cameraPosition);
    self.postMessage({ type: 'updateCubes', visibleCubes, invisibleCubes });
  }
};

function initializeCubes(count) {
  cubeData = [];
  for (let i = 0; i < count; i++) {
    const volume = getRandomVolume();
    cubeData.push({
      id: i,
      volume: volume,
      x: (Math.random() - 0.5) * dimensions[volume],
      y: (Math.random() - 0.5) * dimensions[volume],
      z: (Math.random() - 0.5) * dimensions[volume],
    });
  }
}

function getRandomVolume() {
  const rand = Math.random();
  if (rand < 0.1) return 0; // 10% in inner volume
  if (rand < 0.5) return 1; // 40% in middle volume
  return 2; // 50% in outer volume
}

function updateFrustum(projectionMatrix) {
  // Update frustum planes based on projection matrix
  for (let i = 0; i < 6; i++) {
    const row = Math.floor(i / 2);
    const column = (i % 2) * 4;
    const plane = frustum.planes[i];
    
    plane.normal.x = projectionMatrix[column + 0] - (i % 2 ? projectionMatrix[row] : 0);
    plane.normal.y = projectionMatrix[column + 1] - (i % 2 ? projectionMatrix[row + 4] : 0);
    plane.normal.z = projectionMatrix[column + 2] - (i % 2 ? projectionMatrix[row + 8] : 0);
    plane.constant = projectionMatrix[column + 3] - (i % 2 ? projectionMatrix[row + 12] : 0);
    
    const len = Math.sqrt(
      plane.normal.x * plane.normal.x +
      plane.normal.y * plane.normal.y +
      plane.normal.z * plane.normal.z
    );
    
    plane.normal.x /= len;
    plane.normal.y /= len;
    plane.normal.z /= len;
    plane.constant /= len;
  }
}

function updateCubeVisibility(cameraPosition) {
  const visibleCubes = [];
  const invisibleCubes = [];

  cubeData.forEach(cube => {
    if (isCubeVisible(cube, cameraPosition)) {
      visibleCubes.push(cube);
    } else {
      invisibleCubes.push(cube.id);
    }
  });

  return { visibleCubes, invisibleCubes };
}

function isCubeVisible(cube, cameraPosition) {
  // Check if cube is within a certain distance from the camera
  const distanceThreshold = 30; // Adjust this value to change visibility range
  const dx = cube.x - cameraPosition[0];
  const dy = cube.y - cameraPosition[1];
  const dz = cube.z - cameraPosition[2];
  const distanceSquared = dx * dx + dy * dy + dz * dz;
  
  if (distanceSquared > distanceThreshold * distanceThreshold) {
    return false;
  }

  // Check against frustum planes
  for (let i = 0; i < 6; i++) {
    const plane = frustum.planes[i];
    if (
      plane.normal.x * cube.x +
      plane.normal.y * cube.y +
      plane.normal.z * cube.z +
      plane.constant <= -0.25 // Half the size of the cube
    ) {
      return false;
    }
  }
  return true;
}