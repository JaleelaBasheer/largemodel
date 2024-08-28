/* eslint-disable no-restricted-globals */
let boxData = [];
let visibleBoxes = [];
let cameraPosition = { x: 0, y: 0, z: 0 };

self.onmessage = (event) => {
  const { type, boxData: newBoxData, visibleBoxes: newVisibleBoxes, cameraPosition: newCameraPosition } = event.data;

  try {
    if (type === 'init') {
      if (!Array.isArray(newBoxData)) {
        throw new Error('Invalid boxData: expected an array');
      }
      boxData = newBoxData;
      console.log('Worker initialized with', boxData.length, 'boxes');
    } else if (type === 'updateVisibility') {
      if (!Array.isArray(newVisibleBoxes)) {
        throw new Error('Invalid visibleBoxes: expected an array');
      }
      visibleBoxes = newVisibleBoxes;
      cameraPosition = newCameraPosition;
      updatePriorities();
    } else {
      throw new Error('Unknown message type: ' + type);
    }
  } catch (error) {
    console.error('Error in worker:', error);
    self.postMessage({ type: 'error', message: error.message });
  }
};

function updatePriorities() {
  if (!Array.isArray(boxData) || boxData.length === 0) {
    console.warn('boxData is empty or not an array. Skipping priority update.');
    return;
  }

  const priorityBoxes = boxData.filter(box => {
    if (!box || typeof box.x !== 'number' || typeof box.y !== 'number' || typeof box.z !== 'number') {
      console.warn('Invalid box data:', box);
      return false;
    }

    const distance = Math.sqrt(
      Math.pow(box.x - cameraPosition.x, 2) +
      Math.pow(box.y - cameraPosition.y, 2) +
      Math.pow(box.z - cameraPosition.z, 2)
    );

    // Include boxes inside the frustum
    if (visibleBoxes.some(vb => vb.x === box.x && vb.y === box.y && vb.z === box.z)) {
      return true;
    }

    // Include priority 1 boxes
    if (box.priority === 1) {
      return true;
    }

    // Include nearby priority 2 and 3 boxes
    if (box.priority === 2 && distance <= 5) {
      return true;
    }
    if (box.priority === 3 && distance <= 3) {
      return true;
    }

    return false;
  });

  self.postMessage({ type: 'updateBoxes', boxes: priorityBoxes });
}

console.log('Box worker started');