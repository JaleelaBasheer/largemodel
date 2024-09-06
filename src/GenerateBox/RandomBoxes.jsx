// 1.)Generate random boxes
//---------------------------------------
// import React, { useRef, useEffect } from 'react';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// const RandomBoxesScene = () => {
//   const mountRef = useRef(null);

//   useEffect(() => {
//     const currentMount = mountRef.current;

//     // Scene setup
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
//     const renderer = new THREE.WebGLRenderer();
//     renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     currentMount.appendChild(renderer.domElement);

//     // Camera position
//     camera.position.z = 1500;

//     // Lights
//     const ambientLight = new THREE.AmbientLight(0x404040);
//     scene.add(ambientLight);
//     const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
//     directionalLight.position.set(1, 1, 1);
//     scene.add(directionalLight);

//     // Controls
//     const controls = new OrbitControls(camera, renderer.domElement);

//     // Generate 1000 random boxes
//     const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
//     const boxMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

//     for (let i = 0; i < 1000; i++) {
//       const box = new THREE.Mesh(boxGeometry, boxMaterial);
      
//       // Random position within 1000m³ volume (10m x 10m x 10m)
//       box.position.set(
//         Math.random() * 1000 - 500,
//         Math.random() * 1000 - 500,
//         Math.random() * 1000 - 500
//       );

//       // Random rotation
//       box.rotation.set(
//         Math.random() * Math.PI,
//         Math.random() * Math.PI,
//         Math.random() * Math.PI
//       );

//       scene.add(box);
//     }

//     // Animation loop
//     const animate = () => {
//       requestAnimationFrame(animate);
//       controls.update();
//       renderer.render(scene, camera);
//     };
//     animate();

//     // Handle window resize
//     const handleResize = () => {
//       camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
//       camera.updateProjectionMatrix();
//       renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     };
//     window.addEventListener('resize', handleResize);

//     // Cleanup
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       currentMount.removeChild(renderer.domElement);
//     };
//   }, []);

//   return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
// };

// export default RandomBoxesScene;

// -----------------------------------------------------------------------------//
// ==============================================================================//
// 2.) Web worker
//-----------------------------------------------------
// import React, { useRef, useEffect, useState } from 'react';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// // Web Worker code (you'll need to create a separate file for this)
// const workerCode = `
//   self.onmessage = function(e) {
//     const { count, volume } = e.data;
//     const boxes = [];
//     for (let i = 0; i < count; i++) {
//       boxes.push({
//         position: [
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2
//         ],
//         rotation: [
//           Math.random() * Math.PI,
//           Math.random() * Math.PI,
//           Math.random() * Math.PI
//         ]
//       });
//     }
//     self.postMessage(boxes);
//   };
// `;

// const RandomBoxesScene = () => {
//   const mountRef = useRef(null);
//   const [loadedCount, setLoadedCount] = useState(0);
//   const [unloadedCount, setUnloadedCount] = useState(0);

//   useEffect(() => {
//     const currentMount = mountRef.current;

//     // Scene setup
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 200);
//     const renderer = new THREE.WebGLRenderer();
//     renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     currentMount.appendChild(renderer.domElement);

//     // Camera position
//     camera.position.z = 1500;

//     // Lights
//     const ambientLight = new THREE.AmbientLight(0x404040);
//     scene.add(ambientLight);
//     const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
//     directionalLight.position.set(1, 1, 1);
//     scene.add(directionalLight);

//     // Controls
//     const controls = new OrbitControls(camera, renderer.domElement);

//     // Box geometry and materials
//     const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
//     const loadedMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
//     const unloadedMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

//     // Frustum for culling
//     const frustum = new THREE.Frustum();
//     const projScreenMatrix = new THREE.Matrix4();

//     // Boxes array
//     const boxes = [];

//     // Web Worker setup
//     const blob = new Blob([workerCode], { type: 'application/javascript' });
//     const worker = new Worker(URL.createObjectURL(blob));

//     worker.onmessage = function(e) {
//       const boxData = e.data;
//       boxData.forEach((data, index) => {
//         const box = new THREE.Mesh(boxGeometry, unloadedMaterial);
//         box.position.set(...data.position);
//         box.rotation.set(...data.rotation);
//         box.visible = false;
//         boxes.push(box);
//         scene.add(box);
//       });
//       setUnloadedCount(boxData.length);
//     };

//     worker.postMessage({ count: 1000, volume: 1000 });

//     // Function to update box visibility based on distance and frustum
//     const updateBoxVisibility = () => {
//       camera.updateMatrixWorld();
//       projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
//       frustum.setFromProjectionMatrix(projScreenMatrix);

//       let loaded = 0;
//       let unloaded = 0;

//       boxes.forEach((box) => {
//         const distance = camera.position.distanceTo(box.position);
//         const inFrustum = frustum.containsPoint(box.position);

//         if (distance < 1000 && inFrustum) {
//           if (!box.visible) {
//             box.visible = true;
//             box.material = loadedMaterial;
//           }
//           loaded++;
//         } else {
//           if (box.visible) {
//             box.visible = false;
//             box.material = unloadedMaterial;
//           }
//           unloaded++;
//         }
//       });

//       setLoadedCount(loaded);
//       setUnloadedCount(unloaded);
//     };

//     // Animation loop
//     const animate = () => {
//       requestAnimationFrame(animate);
//       controls.update();
//       updateBoxVisibility();
//       renderer.render(scene, camera);
//     };
//     animate();

//     // Handle window resize
//     const handleResize = () => {
//       camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
//       camera.updateProjectionMatrix();
//       renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     };
//     window.addEventListener('resize', handleResize);

//     // Cleanup
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       currentMount.removeChild(renderer.domElement);
//       worker.terminate();
//     };
//   }, []);

//   return (
//     <div>
//       <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
//       <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
//         Loaded: {loadedCount}, Unloaded: {unloadedCount}
//       </div>
//     </div>
//   );
// };

// export default RandomBoxesScene;

//-------------------------------------------------------------------//
// ==================================================================//

//3.) web worker, octri and cullin
//----------------------------------------------------

// import React, { useRef, useEffect, useState } from 'react';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// const workerCode = `
//   self.onmessage = function(e) {
//     const { count, volume } = e.data;
//     const boxes = [];
//     for (let i = 0; i < count; i++) {
//       boxes.push({
//         position: [
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2
//         ],
//         rotation: [
//           Math.random() * Math.PI,
//           Math.random() * Math.PI,
//           Math.random() * Math.PI
//         ]
//       });
//     }
//     self.postMessage(boxes);
//   };
// `;

// const RandomBoxesScene = () => {
//   const mountRef = useRef(null);
//   const [stats, setStats] = useState({ loaded: 0, unloaded: 0, culled: 0, unculled: 0 });

//   useEffect(() => {
//     const currentMount = mountRef.current;

//     // Scene setup
//     const scene = new THREE.Scene();
//     const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
//     const renderer = new THREE.WebGLRenderer({ antialias: true });
//     renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     currentMount.appendChild(renderer.domElement);

//     // Camera position - moved closer
//     camera.position.z = 750;

//     // Lights
//     const ambientLight = new THREE.AmbientLight(0x404040);
//     scene.add(ambientLight);
//     const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
//     directionalLight.position.set(1, 1, 1);
//     scene.add(directionalLight);

//     // Controls
//     const controls = new OrbitControls(camera, renderer.domElement);

//     // Box geometry and materials - increased size
//     const boxGeometry = new THREE.BoxGeometry(20, 20, 20);
//     const loadedMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
//     const unloadedMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });

//     // Frustum for culling
//     const frustum = new THREE.Frustum();
//     const projScreenMatrix = new THREE.Matrix4();

//     // Boxes array
//     const boxes = [];

//     // Web Worker setup
//     const blob = new Blob([workerCode], { type: 'application/javascript' });
//     const worker = new Worker(URL.createObjectURL(blob));

//     worker.onmessage = function(e) {
//       const boxData = e.data;
//       boxData.forEach((data, index) => {
//         const box = new THREE.Mesh(boxGeometry, unloadedMaterial);
//         box.position.set(...data.position);
//         box.rotation.set(...data.rotation);
//         box.visible = true; // Set initially visible
//         boxes.push(box);
//         scene.add(box);
//       });
//       setStats(prevStats => ({ ...prevStats, unloaded: boxData.length }));
//     };

//     worker.postMessage({ count: 1000, volume: 1000 });

//     // Function to update box visibility based on distance and frustum
//     const updateBoxVisibility = () => {
//       camera.updateMatrixWorld();
//       projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
//       frustum.setFromProjectionMatrix(projScreenMatrix);

//       let loaded = 0;
//       let unloaded = 0;
//       let culled = 0;
//       let unculled = 0;

//       boxes.forEach((box) => {
//         const distance = camera.position.distanceTo(box.position);
//         const inFrustum = frustum.intersectsObject(box);

//         if (distance < 1500 && inFrustum) { // Increased distance check
//           if (!box.visible) {
//             box.visible = true;
//             box.material = loadedMaterial;
//           }
//           loaded++;
//           unculled++;
//         } else {
//           if (box.visible) {
//             box.visible = false;
//             box.material = unloadedMaterial;
//           }
//           unloaded++;
//           if (!inFrustum) {
//             culled++;
//           }
//         }
//       });

//       setStats({ loaded, unloaded, culled, unculled });
//     };

//     // Animation loop
//     const animate = () => {
//       requestAnimationFrame(animate);
//       controls.update();
//       updateBoxVisibility();
//       renderer.render(scene, camera);
//     };
//     animate();

//     // Handle window resize
//     const handleResize = () => {
//       camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
//       camera.updateProjectionMatrix();
//       renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//     };
//     window.addEventListener('resize', handleResize);

//     // Cleanup
//     return () => {
//       window.removeEventListener('resize', handleResize);
//       currentMount.removeChild(renderer.domElement);
//       worker.terminate();
//     };
//   }, []);

//   // Log stats to console whenever they change
//   useEffect(() => {
//     console.log('Rendering stats:', stats);
//   }, [stats]);

//   return (
//     <div>
//       <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
//       <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
//         Loaded: {stats.loaded}, Unloaded: {stats.unloaded}, Culled: {stats.culled}, Unculled: {stats.unculled}
//       </div>
//     </div>
//   );
// };

// export default RandomBoxesScene;


// ------------------------------------------------------------//
// ==========================================================//

//3)------------------------------------------------------------
// webworker , octri and occulusion culling
// import React, { useRef, useEffect, useState } from 'react';
// import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// // Custom Octree implementation
// class Octree {
//   constructor(center, size) {
//     this.center = center;
//     this.size = size;
//     this.objects = [];
//     this.children = null;
//   }

//   insert(object) {
//     if (this.children !== null) {
//       const octant = this.getOctant(object.position);
//       if (octant !== -1) {
//         this.children[octant].insert(object);
//         return;
//       }
//     }

//     this.objects.push(object);

//     if (this.children === null && this.objects.length > 8 && this.size > 20) {
//       this.split();
//     }
//   }

//   split() {
//     const halfSize = this.size / 2;
//     this.children = [];
//     for (let i = 0; i < 8; i++) {
//       const newCenter = new THREE.Vector3(
//         this.center.x + (i & 1 ? halfSize : -halfSize),
//         this.center.y + (i & 2 ? halfSize : -halfSize),
//         this.center.z + (i & 4 ? halfSize : -halfSize)
//       );
//       this.children.push(new Octree(newCenter, halfSize));
//     }

//     for (const object of this.objects) {
//       const octant = this.getOctant(object.position);
//       if (octant !== -1) {
//         this.children[octant].insert(object);
//       }
//     }

//     this.objects = [];
//   }

//   getOctant(position) {
//     const dx = position.x - this.center.x;
//     const dy = position.y - this.center.y;
//     const dz = position.z - this.center.z;
//     let octant = 0;
//     if (dx > 0) octant |= 1;
//     if (dy > 0) octant |= 2;
//     if (dz > 0) octant |= 4;
//     return octant;
//   }

//   getObjectsInFrustum(frustum) {
//     const objects = [];
//     this.getObjectsInFrustumRecursive(frustum, objects);
//     return objects;
//   }

//   getObjectsInFrustumRecursive(frustum, objects) {
//     if (!frustum.intersectsBox(new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size)))) {
//       return;
//     }

//     objects.push(...this.objects);

//     if (this.children !== null) {
//       for (const child of this.children) {
//         child.getObjectsInFrustumRecursive(frustum, objects);
//       }
//     }
//   }
// }

// // Web Worker code (you'll need to create a separate file for this)
// const workerCode = `
//   self.onmessage = function(e) {
//     const { count, volume } = e.data;
//     const boxes = [];
//     for (let i = 0; i < count; i++) {
//       boxes.push({
//         position: [
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2,
//           Math.random() * volume - volume/2
//         ],
//         rotation: [
//           Math.random() * Math.PI,
//           Math.random() * Math.PI,
//           Math.random() * Math.PI
//         ]
//       });
//     }
//     self.postMessage(boxes);
//   };
// `;


// const RandomBoxesScene = () => {
//     const mountRef = useRef(null);
//     const [loadedCount, setLoadedCount] = useState(0);
//     const [unloadedCount, setUnloadedCount] = useState(0);
//     const [culledCount, setCulledCount] = useState(0);
//     const [unculledCount, setUnculledCount] = useState(0);
  
//     useEffect(() => {
//       const currentMount = mountRef.current;
  
//       // Scene setup
//       const scene = new THREE.Scene();
//       const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 4000);
//       const renderer = new THREE.WebGLRenderer();
//       renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//       currentMount.appendChild(renderer.domElement);
  
//       // Camera position
//       camera.position.z = 100;
  
//       // Lights
//       const ambientLight = new THREE.AmbientLight(0x404040);
//       scene.add(ambientLight);
//       const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
//       directionalLight.position.set(1, 1, 1);
//       scene.add(directionalLight);
  
//       // Controls
//       const controls = new OrbitControls(camera, renderer.domElement);
  
//       // Box geometry and materials
//       const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
//       const initialMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });  // Red
//       const reloadedMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });  // Green
  
//       // Frustum for culling
//       const frustum = new THREE.Frustum();
//       const projScreenMatrix = new THREE.Matrix4();
  
//       // Custom Octree setup
//       const octree = new Octree(new THREE.Vector3(0, 0, 0), 1000);
  
//       // Boxes array
//       const boxes = [];
  
//       // Web Worker setup
//       const blob = new Blob([workerCode], { type: 'application/javascript' });
//       const worker = new Worker(URL.createObjectURL(blob));
  
//       worker.onmessage = function(e) {
//         const boxData = e.data;
//         boxData.forEach((data, index) => {
//           const box = new THREE.Mesh(boxGeometry, initialMaterial);
//           box.position.set(...data.position);
//           box.rotation.set(...data.rotation);
//           box.visible = false;
//           box.userData.loadState = 'initial';
//           box.userData.hasBeenUnloaded = false;
//           box.userData.isOccluded = false;
//           boxes.push(box);
//           scene.add(box);
//           octree.insert(box);
//         });
//         setUnloadedCount(boxData.length);
//       };
  
//       worker.postMessage({ count: 1000, volume: 1000 });
  
//       // Raycaster for occlusion culling
//       const raycaster = new THREE.Raycaster();
  
//       // Function to update box visibility based on distance, frustum, and occlusion
//       const updateBoxVisibility = () => {
//         camera.updateMatrixWorld();
//         projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
//         frustum.setFromProjectionMatrix(projScreenMatrix);
  
//         const visibleBoxes = octree.getObjectsInFrustum(frustum);
  
//         let loaded = 0;
//         let unloaded = 0;
//         let culled = 0;
//         let unculled = 0;
  
//         visibleBoxes.forEach((box) => {
//           const distance = camera.position.distanceTo(box.position);
  
//           if (distance < 1000) {
//             // Check for occlusion
//             raycaster.set(camera.position, box.position.clone().sub(camera.position).normalize());
//             const intersects = raycaster.intersectObjects(scene.children, true);
  
//             if (intersects.length > 0 && intersects[0].object !== box) {
//               // Box is occluded
//               box.visible = false;
//               box.userData.isOccluded = true;
//               culled++;
//             } else {
//               // Box is not occluded
//               box.visible = true;
//               box.userData.isOccluded = false;
//               if (box.userData.hasBeenUnloaded) {
//                 box.material = reloadedMaterial;
//               }
//               unculled++;
//             }
  
//             if (box.visible) {
//               loaded++;
//             } else {
//               unloaded++;
//               box.userData.hasBeenUnloaded = true;
//             }
//           } else {
//             // Box is out of range
//             box.visible = false;
//             box.userData.hasBeenUnloaded = true;
//             unloaded++;
//             culled++;
//           }
//         });
  
//         // Handle boxes not in frustum
//         const outOfFrustumCount = boxes.length - visibleBoxes.length;
//         culled += outOfFrustumCount;
//         unloaded += outOfFrustumCount;
  
//         setLoadedCount(loaded);
//         setUnloadedCount(unloaded);
//         setCulledCount(culled);
//         setUnculledCount(unculled);
//       };
  
//       // Animation loop
//       const animate = () => {
//         requestAnimationFrame(animate);
//         controls.update();
//         updateBoxVisibility();
//         renderer.render(scene, camera);
//       };
//       animate();
  
//       // Handle window resize
//       const handleResize = () => {
//         camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
//         camera.updateProjectionMatrix();
//         renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
//       };
//       window.addEventListener('resize', handleResize);
  
//       // Cleanup
//       return () => {
//         window.removeEventListener('resize', handleResize);
//         currentMount.removeChild(renderer.domElement);
//         worker.terminate();
//       };
//     }, []);
  
//     return (
//       <div>
//         <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
//         <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
//           Loaded: {loadedCount}, Unloaded: {unloadedCount}, Culled: {culledCount}, Unculled: {unculledCount}
//         </div>
//       </div>
//     );
//   };
  
//   export default RandomBoxesScene;


//   -------------------------------------------------------------------------//
// ===========================================================================//
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Custom Octree implementation
class Octree {
  constructor(center, size) {
    this.center = center;
    this.size = size;
    this.objects = [];
    this.children = null;
  }

  insert(object) {
    if (this.children !== null) {
      const octant = this.getOctant(object.position);
      if (octant !== -1) {
        this.children[octant].insert(object);
        return;
      }
    }

    this.objects.push(object);

    if (this.children === null && this.objects.length > 8 && this.size > 20) {
      this.split();
    }
  }

  split() {
    const halfSize = this.size / 2;
    this.children = [];
    for (let i = 0; i < 8; i++) {
      const newCenter = new THREE.Vector3(
        this.center.x + (i & 1 ? halfSize : -halfSize),
        this.center.y + (i & 2 ? halfSize : -halfSize),
        this.center.z + (i & 4 ? halfSize : -halfSize)
      );
      this.children.push(new Octree(newCenter, halfSize));
    }

    for (const object of this.objects) {
      const octant = this.getOctant(object.position);
      if (octant !== -1) {
        this.children[octant].insert(object);
      }
    }

    this.objects = [];
  }

  getOctant(position) {
    const dx = position.x - this.center.x;
    const dy = position.y - this.center.y;
    const dz = position.z - this.center.z;
    let octant = 0;
    if (dx > 0) octant |= 1;
    if (dy > 0) octant |= 2;
    if (dz > 0) octant |= 4;
    return octant;
  }

  getObjectsInFrustum(frustum) {
    const objects = [];
    this.getObjectsInFrustumRecursive(frustum, objects);
    return objects;
  }

  getObjectsInFrustumRecursive(frustum, objects) {
    if (!frustum.intersectsBox(new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size)))) {
      return;
    }

    objects.push(...this.objects);

    if (this.children !== null) {
      for (const child of this.children) {
        child.getObjectsInFrustumRecursive(frustum, objects);
      }
    }
  }
}

// Web Worker code
const workerCode = `
  let boxes = [];

  self.onmessage = function(e) {
    const { type, data } = e.data;
    switch(type) {
      case 'init':
        initializeBoxes(data.count, data.volume);
        break;
      case 'update':
        updateBoxes(data.cameraPosition, data.viewportSize);
        break;
    }
  };

  function initializeBoxes(count, volume) {
    boxes = [];
    for (let i = 0; i < count; i++) {
      boxes.push({
        position: [
          Math.random() * volume - volume/2,
          Math.random() * volume - volume/2,
          Math.random() * volume - volume/2
        ],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ],
        loaded: false,
        screenSize: 0
      });
    }
    self.postMessage({ type: 'initialized', count: boxes.length });
  }

  function updateBoxes(cameraPosition, viewportSize) {
    const updatedBoxes = boxes.map((box, index) => ({
      ...box,
      index,
      screenSize: getScreenSize(box.position, cameraPosition, viewportSize)
    }));

    self.postMessage({ 
      type: 'updated', 
      boxes: updatedBoxes,
      totalBoxes: boxes.length
    });
  }

  function getScreenSize(position, cameraPosition, viewportSize) {
    const dx = position[0] - cameraPosition[0];
    const dy = position[1] - cameraPosition[1];
    const dz = position[2] - cameraPosition[2];
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    return (50 / distance) * Math.min(viewportSize.width, viewportSize.height);
  }
`;

const RandomBoxesScene = () => {
    const mountRef = useRef(null);
    const [stats, setStats] = useState({
      loaded: 0,
      unloaded: 0,
      culled: 0,
      unculled: 0,
      lod1: 0,
      lod2: 0,
      smallSizeUnloaded: 0,
      total: 0
    });
  
    useEffect(() => {
      const currentMount = mountRef.current;
  
      // Scene setup
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 4000);
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      currentMount.appendChild(renderer.domElement);
  
      camera.position.z = 100;
  
      // Lights setup (unchanged)
      const ambientLight = new THREE.AmbientLight(0x404040);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);
  
      const controls = new OrbitControls(camera, renderer.domElement);
  
      const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
      const materials = {
        lod1: new THREE.MeshPhongMaterial({ color: 0x00ff00 }), // Green for LOD1
        lod2: new THREE.MeshPhongMaterial({ color: 0x0000ff })  // Blue for LOD2
      };
  
      const LOD_THRESHOLDS = {
        HIGH: 50,  // Threshold for LOD1
        LOW: 20,   // Threshold for LOD2
        UNLOAD: 10 // Threshold for unloading (based on screen pixel ratio)
      };
  
      const frustum = new THREE.Frustum();
      const projScreenMatrix = new THREE.Matrix4();
  
      const octree = new Octree(new THREE.Vector3(0, 0, 0), 1000);
  
      const boxes = new Map();
  
      // Web Worker setup
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
  
      worker.onmessage = function(e) {
        const { type, boxes: updatedBoxes, totalBoxes } = e.data;
        if (type === 'updated') {
          updateScene(updatedBoxes, totalBoxes);
        }
      };
  
      worker.postMessage({ type: 'init', data: { count: 1000, volume: 1000 } });
  
      const raycaster = new THREE.Raycaster();
  
      function updateScene(updatedBoxes, totalBoxes) {
        let loaded = 0;
        let unloaded = 0;
        let culled = 0;
        let unculled = 0;
        let lod1Count = 0;
        let lod2Count = 0;
        let smallSizeUnloaded = 0;
  
        camera.updateMatrixWorld();
        projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);
  
        updatedBoxes.forEach(boxData => {
          const position = new THREE.Vector3(...boxData.position);
          const inFrustum = frustum.containsPoint(position);
  
          if (inFrustum) {
            if (boxData.screenSize >= LOD_THRESHOLDS.UNLOAD) {
              let box = boxes.get(boxData.index);
              if (!box) {
                box = new THREE.Mesh(boxGeometry, materials.lod1);
                boxes.set(boxData.index, box);
                scene.add(box);
                octree.insert(box);
              }
  
              box.position.set(...boxData.position);
              box.rotation.set(...boxData.rotation);
  
              // Determine LOD
              if (boxData.screenSize >= LOD_THRESHOLDS.HIGH) {
                box.material = materials.lod1;
                lod1Count++;
              } else {
                box.material = materials.lod2;
                lod2Count++;
              }
  
              // Occlusion culling
              raycaster.set(camera.position, position.sub(camera.position).normalize());
              const intersects = raycaster.intersectObjects(scene.children, true);
  
              if (intersects.length > 0 && intersects[0].object !== box) {
                box.visible = false;
                culled++;
              } else {
                box.visible = true;
                unculled++;
              }
  
              loaded++;
            } else {
              // Box is in frustum but too small
              smallSizeUnloaded++;
              unloaded++;
              const box = boxes.get(boxData.index);
              if (box) {
                scene.remove(box);
                boxes.delete(boxData.index);
              }
            }
          } else {
            // Box is out of frustum
            unloaded++;
            const box = boxes.get(boxData.index);
            if (box) {
              scene.remove(box);
              boxes.delete(boxData.index);
            }
          }
        });
  
        setStats({
          loaded,
          unloaded,
          culled,
          unculled,
          lod1: lod1Count,
          lod2: lod2Count,
          smallSizeUnloaded,
          total: totalBoxes
        });
      }
  
      function animate() {
        requestAnimationFrame(animate);
        controls.update();
  
        worker.postMessage({
          type: 'update',
          data: {
            cameraPosition: camera.position.toArray(),
            viewportSize: { width: currentMount.clientWidth, height: currentMount.clientHeight }
          }
        });
  
        renderer.render(scene, camera);
      }
      animate();
  
      // Handle window resize
      const handleResize = () => {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      };
      window.addEventListener('resize', handleResize);
  
      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        currentMount.removeChild(renderer.domElement);
        worker.terminate();
      };
    }, []);
  
    return (
      <div>
        <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
        <div style={{ position: 'absolute', top: 10, left: 10, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px' }}>
          <div>Total Boxes: {stats.total}</div>
          <div>Loaded: {stats.loaded}, Unloaded: {stats.unloaded}</div>
          <div>Culled: {stats.culled}, Unculled: {stats.unculled}</div>
          <div style={{ color: '#00ff00' }}>LOD1 (Near): {stats.lod1}</div>
          <div style={{ color: '#0000ff' }}>LOD2 (Far): {stats.lod2}</div>
          <div style={{ color: '#ff9900' }}>Unloaded (Small Size): {stats.smallSizeUnloaded}</div>
          <div>Total Visible: {stats.unculled}</div>
        </div>
      </div>
    );
  };
  
  export default RandomBoxesScene;