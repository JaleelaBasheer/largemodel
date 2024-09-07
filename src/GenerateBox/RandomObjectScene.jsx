import React, { useRef, useEffect, useState,useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

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
let fbxObjects = [];

self.onmessage = function(e) {
  const { type, data } = e.data;
  switch(type) {
    case 'init':
      initializeFBXObjects(data.models);
      break;
    case 'update':
      updateFBXObjects(data.cameraPosition, data.viewportSize);
      break;
  }
};

function initializeFBXObjects(models) {
  console.log("Initializing FBX objects with models:", models);
  fbxObjects = models.flatMap((model, modelIndex) => 
    Array(model.count).fill().map(() => {
      const halfVolume = Math.cbrt(model.volume) / 2; // Assuming volume is a cube
      return {
        modelIndex,
        position: [
          Math.random() * halfVolume * 2 - halfVolume,
          Math.random() * halfVolume * 2 - halfVolume,
          Math.random() * halfVolume * 2 - halfVolume
        ],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ],
        loaded: false,
        screenSize: 0
      };
    })
  );
  console.log("Created FBX objects:", fbxObjects.length);
  self.postMessage({ type: 'initialized', count: fbxObjects.length });
}

function updateFBXObjects(cameraPosition, viewportSize) {
  const updatedFBXObjects = fbxObjects.map((obj, index) => ({
    ...obj,
    index,
    screenSize: getScreenSize(obj.position, cameraPosition, viewportSize)
  }));

  self.postMessage({ 
    type: 'updated', 
    fbxObjects: updatedFBXObjects,
    totalFBXObjects: fbxObjects.length
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

const RandomObjectsScene = () => {
  const mountRef = useRef(null);
  const [stats, setStats] = useState({
    loaded: 0,
    unloaded: 0,
    culled: 0,
    unculled: 0,
    lod1: 0,
    lod2: 0,
    smallSizeUnloaded: 0,
    bufferVolumeOutsideFrustum: 0,
    inBufferZone: 0,
    inFrustum: 0,
    loadedToScene: 0,
    visibleFBXObjects: 0,
    hiddenFBXObjects: 0,
    total: 0
  });
  const [activeControls, setActiveControls] = useState('orbit');
  const [flySpeed, setFlySpeed] = useState(1);
  const [flyrotationSpeed, setFlyrotationSpeed] = useState(1);
  const [fbxObjects, setFBXObjects] = useState(new Map());
  const [fbxGeometry, setFBXGeometry] = useState(null);
  const [fbxMaterials, setFBXMaterials] = useState(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const orbitControlsRef = useRef(null);
  const workerRef = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const isMouseDown = useRef(false);
  const isPanning = useRef(false);
  const isZooming = useRef(false);
  const lastMouseMovement = useRef({ x: 0, y: 0 });
  const [fbxModels, setFBXModels] = useState([]);
  const octreeRef = useRef(null);

  const enableFlyControls = useCallback(() => {
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
  }, []);

  const disableFlyControls = useCallback(() => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mouseup', handleMouseUp);
    document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileInput = useCallback((event) => {
    const fbxLoader = new FBXLoader();
    const files = event.target.files;
    const cumulativeBox = new THREE.Box3();
    let loadedModels = [];

    console.log("Files selected:", files.length);

    if (files.length > 0) {
      let loadedFilesCount = 0;

      Array.from(files).forEach((file) => {
        console.log("Loading file:", file.name);
        fbxLoader.load(URL.createObjectURL(file), (object) => {
          console.log("File loaded:", file.name);
          const box = new THREE.Box3().setFromObject(object);
          cumulativeBox.union(box);

          // Calculate volume
          const size = new THREE.Vector3();
          box.getSize(size);
          const volume = size.x * size.y * size.z;

          // Find geometry and material
          let geometry, material;
          object.traverse((child) => {
            if (child.isMesh) {
              geometry = child.geometry;
              material = child.material;
            }
          });

          if (!geometry || !material) {
            console.warn("No geometry or material found in:", file.name);
          } else {
            loadedModels.push({
              geometry,
              materials: {
                lod1: material,
                lod2: material.clone()
              },
              count: 1,
              volume: volume
            });
            console.log("Model added:", file.name, "Volume:", volume);
          }

          loadedFilesCount++;
          if (loadedFilesCount === files.length) {
            // All files have been loaded
            const center = new THREE.Vector3();
            cumulativeBox.getCenter(center);
            console.log("Cumulative bounding box center:", center);

            // Set camera position
            cameraRef.current.position.set(center.x, center.y, center.z + 100); // Adjust the +100 as needed
            cameraRef.current.lookAt(center);

            // Update fbxModels state
            setFBXModels(loadedModels);
            console.log("All models loaded:", loadedModels.length);

            // Initialize worker with new models data
            workerRef.current.postMessage({
              type: 'init',
              data: { models: loadedModels.map(model => ({ count: model.count, volume: model.volume })) }
            });
          }
        }, 
        (xhr) => {
          console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
          console.error("Error loading file:", file.name, error);
        });
      });
    }
  }, []);

  useEffect(() => {
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer();
    rendererRef.current = renderer;
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setClearColor(0xfff000);
    currentMount.appendChild(renderer.domElement);

    camera.position.z = 100; // Increased from 5 to 100

    // Lights setup
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Controls setup
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControlsRef.current = orbitControls;

    const LOD_THRESHOLDS = {
      HIGH: 90,
      LOW: 60,
      UNLOAD: 25
    };

    const BUFFER_VOLUME_SIZE = 200;

    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();

    // Initialize Octree
    octreeRef.current = new Octree(new THREE.Vector3(0, 0, 0), 1000);

    // Web Worker setup
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = function(e) {
      // console.log("Received message from worker:", e.data);
      const { type, fbxObjects: updatedFBXObjects, totalFBXObjects } = e.data;
      if (type === 'updated') {
        updateScene(updatedFBXObjects, totalFBXObjects);
      } else if (type === 'initialized') {
        console.log("Worker initialized with", e.data.count, "objects");
      }
    };

    const raycaster = new THREE.Raycaster();

    function isInBufferVolume(position, cameraPosition) {
      return position.distanceTo(cameraPosition) <= BUFFER_VOLUME_SIZE;
    }

    function updateScene(updatedFBXObjects, totalFBXObjects) {
      // console.log("Updating scene with", updatedFBXObjects.length, "objects");
      
      let loaded = 0;
      let unloaded = 0;
      let culled = 0;
      let unculled = 0;
      let lod1Count = 0;
      let lod2Count = 0;
      let smallSizeUnloaded = 0;
      let bufferVolumeOutsideFrustum = 0;
      let inBufferZone = 0;
      let inFrustum = 0;
      let loadedToScene = 0;
      let visibleFBXObjects = 0;
      let hiddenFBXObjects = 0;

      camera.updateMatrixWorld();
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);

      updatedFBXObjects.forEach(fbxData => {
        const position = new THREE.Vector3(...fbxData.position);
        const inFrustumView = frustum.containsPoint(position);
        const inBufferVolume = isInBufferVolume(position, camera.position);

        if (inFrustumView || inBufferVolume) {
          let fbxObject = fbxObjects.get(fbxData.index);
          if (!fbxObject && fbxModels[fbxData.modelIndex]) {
            const model = fbxModels[fbxData.modelIndex];
            fbxObject = new THREE.Mesh(model.geometry, model.materials.lod1);
            fbxObjects.set(fbxData.index, fbxObject);
            scene.add(fbxObject);
            octreeRef.current.insert(fbxObject);
            loadedToScene++;
            console.log("Added new object to scene:", fbxData.index);
          }

          if (fbxObject) {
            fbxObject.position.set(...fbxData.position);
            fbxObject.rotation.set(...fbxData.rotation);

            if (inFrustumView) {
              inFrustum++;
              if (fbxData.screenSize >= LOD_THRESHOLDS.UNLOAD) {
                // Determine LOD
                if (fbxData.screenSize >= LOD_THRESHOLDS.HIGH) {
                  fbxObject.material = fbxMaterials.lod1;
                  lod1Count++;
                } else {
                  fbxObject.material = fbxMaterials.lod2;
                  lod2Count++;
                }

                // Occlusion culling
                raycaster.set(camera.position, position.clone().sub(camera.position).normalize());
                const intersects = raycaster.intersectObjects(scene.children, true);

                if (intersects.length > 0 && intersects[0].object !== fbxObject) {
                  fbxObject.visible = false;
                  culled++;
                } else {
                  fbxObject.visible = true;
                  visibleFBXObjects++;
                  unculled++;
                }
              } else {
                fbxObject.visible = false;
                hiddenFBXObjects++;
                smallSizeUnloaded++;
              }
            } else {
              fbxObject.visible = false;
              hiddenFBXObjects++;
              bufferVolumeOutsideFrustum++;
            }

            loaded++;
            if (inBufferVolume) inBufferZone++;
          }
        } else {
          unloaded++;
          const fbxObject = fbxObjects.get(fbxData.index);
          if (fbxObject) {
            scene.remove(fbxObject);
            fbxObjects.delete(fbxData.index);
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
        bufferVolumeOutsideFrustum,
        inBufferZone,
        inFrustum,
        loadedToScene,
        visibleFBXObjects,
        hiddenFBXObjects,
        total: totalFBXObjects
      });

      // console.log("Scene update complete. Loaded:", loaded, "Visible:", visibleFBXObjects);
    }

    function animate() {
      requestAnimationFrame(animate);
      if (activeControls === 'orbit') {
        orbitControls.update();
      }

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

    // Add a simple cube to the scene for testing
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    console.log("Added test cube to scene");

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      currentMount.removeChild(renderer.domElement);
      worker.terminate();
      orbitControls.dispose();
    };
  }, [activeControls, fbxModels]);

  let continueTranslation = false;
  let continueRotation = false;
  let translationDirection = 0;
  let rotationDirection = 0;
  let translationSpeed = 5; // Initial translation speed
  let rotationSpeed = 0.0001; // Initial rotation speed
  const horizontalSensitivity = 1.1; // Adjust as needed
  const verticalSensitivity = 1.1; // Adjust as needed

  // Mouse events functions for fly control
  const handleMouseUp = () => {
    isMouseDown.current = false;
    isPanning.current = false;
    isZooming.current = false;    
    lastMouseMovement.current = { x: 0, y: 0 };
    continueTranslation = false;
    continueRotation = false;
  };

  const handleMouseDown = (event) => {
    const mouseEvent = event.touches ? event.touches[0] : event;
    if (mouseEvent.button === 0) { // Left mouse button pressed
      isMouseDown.current = true;
      mouse.current.x = mouseEvent.clientX;
      mouse.current.y = mouseEvent.clientY;
      isZooming.current = true;
      continueTranslation = true; // Enable automatic translation
      continueRotation = true; // Enable automatic rotation
      translationDirection = lastMouseMovement.current.y > 0 ? 1 : -1; // Set translation direction based on last mouse movement
      rotationDirection = lastMouseMovement.current.x > 0 ? 1 : -1; // Set rotation direction based on last mouse movement
    } else if (mouseEvent.button === 1) { // Middle mouse button pressed
      console.log("Middle button pressed");
      isPanning.current = true;
      continueTranslation = true; // Enable automatic translation
      mouse.current.x = mouseEvent.clientX;
      mouse.current.y = mouseEvent.clientY;
    }
  };

  const handleMouseMove = (event) => {
    event.preventDefault();

    const mouseEvent = event.touches ? event.touches[0] : event;
    if (!isMouseDown.current && !isPanning.current && !isZooming.current) return;

    const movementX = mouseEvent.clientX - mouse.current.x;
    const movementY = mouseEvent.clientY - mouse.current.y;

    lastMouseMovement.current = { x: movementX, y: movementY };
    if (isMouseDown.current) { // Left mouse button clicked
      const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
      if (isHorizontal) { // Horizontal movement, rotate around Y axis
        continueCameraMovement(); 
      } else { // Vertical movement, forward/backward
        continueCameraMovement(); // Adjust with factors
      }
    } else if (isPanning.current) { // Middle mouse button clicked
      continueCameraMovement(movementX, movementY); // Adjust with factors
    }

    mouse.current.x = mouseEvent.clientX;
    mouse.current.y = mouseEvent.clientY;
  };

  const continueCameraMovement = () => {
    const adjustedTranslationSpeed = flySpeed * translationSpeed;
    if (isMouseDown.current && (continueTranslation || continueRotation)) {
      requestAnimationFrame(continueCameraMovement);
      const movementX = lastMouseMovement.current.x;
      const movementY = lastMouseMovement.current.y;
      const tileSizeFactor = 10; // Implement this function to calculate the factor based on tile size
      const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
      if (isHorizontal) {
        const rotationAngle = -movementX * rotationSpeed * horizontalSensitivity * flyrotationSpeed * tileSizeFactor;

        // Get the camera's up vector
        let cameraUp = cameraRef.current.up.clone().normalize();
        
        // Create a quaternion representing the rotation around the camera's up vector
        let quaternion = new THREE.Quaternion().setFromAxisAngle(cameraUp, rotationAngle);
        
        cameraRef.current.applyQuaternion(quaternion);
      } else {
        const zoomSpeed = movementY * 0.01; // Adjust zoom speed based on last recorded mouse movement

        const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraRef.current.quaternion);
        // Move the camera forward/backward along its local forward direction
        cameraRef.current.position.add(forwardDirection.multiplyScalar(zoomSpeed * adjustedTranslationSpeed * tileSizeFactor));
      }			
    } else if (isPanning.current && continueTranslation) {
      requestAnimationFrame(continueCameraMovement);
      const tileSizeFactor = 0.1;
      const movementY = lastMouseMovement.current.y;
      const movementX = lastMouseMovement.current.x;
      const adjustedHorizontalSensitivity = horizontalSensitivity * tileSizeFactor;
      const adjustedVerticalSensitivity = verticalSensitivity * tileSizeFactor;

      // Calculate movement speed based on mouse movement and sensitivity
      const moveSpeedX = movementX * adjustedHorizontalSensitivity;
      const moveSpeedY = movementY * adjustedVerticalSensitivity;
      
      const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
      const isVertical = Math.abs(movementY) > Math.abs(movementX);
    
      if (isHorizontal) {
        // Move the camera along its local x axis
        cameraRef.current.translateX(moveSpeedX);
      } else if (isVertical) {
        // Move the camera along its local y axis
        cameraRef.current.translateY(-moveSpeedY);
      }
    }
  };

  const switchToOrbitControls = useCallback(() => {
    if (activeControls !== 'orbit') {
      const camera = cameraRef.current;
      const orbitControls = orbitControlsRef.current;
      
      // Store the current camera position and rotation
      const position = camera.position.clone();
      const quaternion = camera.quaternion.clone();
      
      setActiveControls('orbit');
      
      // After switching, restore the camera position and rotation
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
      orbitControls.target.set(0, 0, 0); // Reset orbit controls target
      orbitControls.update();
    }
  }, [activeControls]);

  const switchToFlyControls = useCallback(() => {
    if (activeControls !== 'fly') {
      const camera = cameraRef.current;
      
      // Store the current camera position and rotation
      const position = camera.position.clone();
      const quaternion = camera.quaternion.clone();
      
      setActiveControls('fly');
      
      // After switching, restore the camera position and rotation
      camera.position.copy(position);
      camera.quaternion.copy(quaternion);
    }
  }, [activeControls]);

  return (
    <div>
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: '10px' }}>
        <div>Total FBX Objects: {stats.total}</div>
        <div>Loaded FBX Objects: {stats.loaded}</div>
        <div>Unloaded FBX Objects: {stats.unloaded}</div>
        <div>Culled FBX Objects: {stats.culled}</div>
        <div>Unculled FBX Objects: {stats.unculled}</div>
        <div>Visible FBX Objects: {stats.visibleFBXObjects}</div>
        <div>Hidden FBX Objects: {stats.hiddenFBXObjects}</div>
        <div>In Frustum: {stats.inFrustum}</div>
        <div style={{ color: '#00ff00' }}>LOD1 (Near): {stats.lod1}</div>
        <div style={{ color: '#0000ff' }}>LOD2 (Far): {stats.lod2}</div>
        <div style={{ color: '#ff9900' }}>Small Size (Hidden): {stats.smallSizeUnloaded}</div>
        <div style={{ color: '#ff00ff' }}>Buffer Volume (Outside Frustum): {stats.bufferVolumeOutsideFrustum}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 10 }}>
        <input type="file" accept=".fbx" multiple onChange={handleFileInput} style={{ color: 'white' }} />
        <button onClick={switchToOrbitControls} disabled={activeControls === 'orbit'}>
          Orbit Controls
        </button>
        <button onClick={switchToFlyControls} disabled={activeControls === 'fly'}>
          Fly Controls
        </button>
      </div>
    </div>
  );
};

export default RandomObjectsScene;