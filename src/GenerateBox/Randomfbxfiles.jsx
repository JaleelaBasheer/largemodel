import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import ProgressBar from '../GenerateBox/FileProgressBar'; // Make sure this path is correct

// Octree class
class Octree {
  constructor(center, size) {
    this.center = center;
    this.size = size;
    this.children = [];
    this.objects = [];
    this.subdivided = false;
  }

  subdivide() {
    const newSize = this.size / 2;
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          const newCenter = new THREE.Vector3(
            this.center.x + x * newSize / 2,
            this.center.y + y * newSize / 2,
            this.center.z + z * newSize / 2
          );
          this.children.push(new Octree(newCenter, newSize));
        }
      }
    }
    this.subdivided = true;
  }

  insert(object) {
    if (!this.intersects(object.boundingSphere)) {
      return false;
    }

    if (this.objects.length < 8 && !this.subdivided) {
      this.objects.push(object);
      return true;
    }

    if (!this.subdivided) {
      this.subdivide();
    }

    for (const child of this.children) {
      if (child.insert(object)) {
        return true;
      }
    }

    return false;
  }

  intersects(boundingSphere) {
    const distance = this.center.distanceTo(boundingSphere.center);
    return distance <= (this.size / 2 + boundingSphere.radius);
  }

  query(frustum, result) {
    if (!this.intersectsFrustum(frustum)) {
      return;
    }

    for (const object of this.objects) {
      if (frustum.intersectsSphere(object.boundingSphere)) {
        result.push(object);
      }
    }

    if (this.subdivided) {
      for (const child of this.children) {
        child.query(frustum, result);
      }
    }
  }

  intersectsFrustum(frustum) {
    const halfSize = this.size / 2;
    const min = new THREE.Vector3(
      this.center.x - halfSize,
      this.center.y - halfSize,
      this.center.z - halfSize
    );
    const max = new THREE.Vector3(
      this.center.x + halfSize,
      this.center.y + halfSize,
      this.center.z + halfSize
    );
    const box = new THREE.Box3(min, max);
    return frustum.intersectsBox(box);
  }
}

// Web Worker code
const workerCode = `
  self.onmessage = function(e) {
    const { type, data } = e.data;
    if (type === 'checkFrustumAndOcclusion') {
      const { meshData, frustumPlanes, bufferFactor, cameraPosition } = data;
      const frustumResult = checkFrustum(meshData, frustumPlanes, bufferFactor);
      const occlusionResult = performOcclusionCulling(frustumResult.visible, cameraPosition);
      self.postMessage({ 
        type: 'cullingResult', 
        data: {
          visible: occlusionResult.visible,
          buffer: frustumResult.buffer,
          unloaded: frustumResult.unloaded,
          occluded: occlusionResult.occluded
        }
      });
    }
  };

  function checkFrustum(meshData, frustumPlanes, bufferFactor) {
    const visible = [];
    const buffer = [];
    const unloaded = [];

    meshData.forEach(mesh => {
      const status = getMeshStatus(mesh, frustumPlanes, bufferFactor);
      if (status === 'visible') visible.push(mesh);
      else if (status === 'buffer') buffer.push(mesh);
      else unloaded.push(mesh);
    });

    return { visible, buffer, unloaded };
  }

  function getMeshStatus(mesh, frustumPlanes, bufferFactor) {
    const inFrustum = isInFrustum(mesh, frustumPlanes, 1);
    if (inFrustum) return 'visible';
    const inBuffer = isInFrustum(mesh, frustumPlanes, bufferFactor);
    return inBuffer ? 'buffer' : 'unloaded';
  }

  function isInFrustum(mesh, frustumPlanes, scaleFactor) {
    for (let i = 0; i < 6; i++) {
      const plane = frustumPlanes[i];
      const distance = 
        plane.normal.x * mesh.position.x + 
        plane.normal.y * mesh.position.y + 
        plane.normal.z * mesh.position.z + 
        plane.constant;
      if (distance < -mesh.boundingSphere.radius * scaleFactor) {
        return false;
      }
    }
    return true;
  }

  function performOcclusionCulling(visibleMeshes, cameraPosition) {
    const occluders = [];
    const occluded = [];
    const visible = [];

    visibleMeshes.sort((a, b) => {
      const distA = distance(a.position, cameraPosition);
      const distB = distance(b.position, cameraPosition);
      return distA - distB;
    });

    for (const mesh of visibleMeshes) {
      let isOccluded = false;
      for (const occluder of occluders) {
        if (isSphereOccluded(mesh.boundingSphere, occluder.boundingSphere, cameraPosition)) {
          isOccluded = true;
          break;
        }
      }
      if (isOccluded) {
        occluded.push(mesh);
      } else {
        visible.push(mesh);
        occluders.push(mesh);
      }
    }

    return { visible, occluded };
  }

  function distance(a, b) {
    return Math.sqrt(
      (a.x - b.x) ** 2 + 
      (a.y - b.y) ** 2 + 
      (a.z - b.z) ** 2
    );
  }

  function isSphereOccluded(sphere, occluder, cameraPosition) {
    const occluderRadius = occluder.radius;
    const sphereRadius = sphere.radius;
    
    const occluderToCamera = distance(occluder.center, cameraPosition);
    const sphereToCamera = distance(sphere.center, cameraPosition);
    
    if (occluderToCamera >= sphereToCamera) {
      return false;
    }
    
    const occluderToSphere = distance(occluder.center, sphere.center);
    
    return occluderToSphere <= occluderRadius + sphereRadius;
  }
`;

function RandomFbxFiles() {
  const mountRef = useRef(null);
  const [files, setFiles] = useState([]);
  const sceneRef = useRef(new THREE.Scene());
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const workerRef = useRef(null);
  const octreeRef = useRef(null);
  const meshesRef = useRef([]);
  const infoElementRef = useRef(null);
  const totalVolumeRef = useRef(0);
  const filesCountRef = useRef(0);
  const visibleMeshCountRef = useRef(0);
  const occludedMeshCountRef = useRef(0);
  const bufferZoneMeshCountRef = useRef(0);
  const unloadedMeshCountRef = useRef(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const BUFFER_FACTOR = 50;
  const UNITS_TO_METERS = 0.01;

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 4000);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffff00);
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    scene.add(directionalLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Create Web Worker
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);
    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'cullingResult') {
        updateVisibleMeshes(data);
      }
    };

    const loadFBX = (file, index, totalFiles) => {
      return new Promise((resolve, reject) => {
        const loader = new FBXLoader();
        const objectUrl = URL.createObjectURL(file);

        loader.load(
          objectUrl,
          (object) => {
            URL.revokeObjectURL(objectUrl);
            setLoadingProgress((prevProgress) => 
              prevProgress + (50 / totalFiles)
            );
            resolve(object);
          },
          (xhr) => {
            console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
          },
          (error) => {
            console.error('An error occurred while loading the FBX file:', error);
            reject(error);
          }
        );
      });
    };

    const processLoadedObjects = (objects) => {
      const cumulativeBoundingBox = new THREE.Box3();
      let totalVolume = 0;
      let totalMeshCount = 0;
    
      objects.forEach((object, index) => {
        if (object && object.isObject3D) {
          const objectBoundingBox = new THREE.Box3().setFromObject(object);
          cumulativeBoundingBox.union(objectBoundingBox);
    
          object.traverse((child) => {
            if (child.isMesh) {
              const boundingSphere = new THREE.Sphere();
              child.geometry.computeBoundingSphere();
              boundingSphere.copy(child.geometry.boundingSphere).applyMatrix4(child.matrixWorld);
              
              meshesRef.current.push({
                id: child.id,
                mesh: child,
                position: child.position.clone(),
                boundingSphere: {
                  center: boundingSphere.center.clone(),
                  radius: boundingSphere.radius
                }
              });
              totalMeshCount++;
            }
          });
    
          const objectSize = objectBoundingBox.getSize(new THREE.Vector3());
          const objectVolume = objectSize.x * objectSize.y * objectSize.z * Math.pow(UNITS_TO_METERS, 3);
          totalVolume += objectVolume;
        }
        setLoadingProgress((prevProgress) => 
          prevProgress + (50 / objects.length)
        );
      });
    
      if (cumulativeBoundingBox.isEmpty()) {
        console.warn('No valid objects loaded');
        return;
      }
    
      const center = cumulativeBoundingBox.getCenter(new THREE.Vector3());
      const size = cumulativeBoundingBox.getSize(new THREE.Vector3());
    
      // Initialize Octree
      const maxDimension = Math.max(size.x, size.y, size.z);
      octreeRef.current = new Octree(center, maxDimension * 2);
    
      // Insert objects into Octree
      meshesRef.current.forEach(meshData => {
        octreeRef.current.insert(meshData);
      });
    
      // Adjust camera to fit the entire scene
      const camera = cameraRef.current;
      const controls = controlsRef.current;
    
      // Calculate the proper camera distance
      const fov = camera.fov * (Math.PI / 180);
      const aspectRatio = window.innerWidth / window.innerHeight;
      const cameraDistance = Math.max(
        size.y / 2 / Math.tan(fov / 2),
        size.x / 2 / Math.tan(fov / 2) / aspectRatio,
        size.z / 2
      );
    
      // Position camera to view the entire bounding box
      camera.position.set(
        center.x,
        center.y,
        center.z + cameraDistance * 1.1 // Add 10% margin
      );
      camera.lookAt(center);
    
      // Adjust near and far planes
      camera.near = cameraDistance / 100;
      camera.far = cameraDistance * 100;
      camera.updateProjectionMatrix();
    
      // Set orbit controls
      controls.target.copy(center);
      controls.minDistance = cameraDistance * 0.1;
      controls.maxDistance = cameraDistance * 2;
      controls.update();
    
      // Add bounding box helper for all loaded files
      const boxHelper = new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z)), 0xffff00);
      boxHelper.position.copy(center);
      sceneRef.current.add(boxHelper);
    
      // Add axes helper
      const axesHelper = new THREE.AxesHelper(maxDimension / 2);
      axesHelper.position.copy(center);
      sceneRef.current.add(axesHelper);
      infoElementRef.current = document.createElement('div');
      infoElementRef.current.style.position = 'absolute';
      infoElementRef.current.style.top = '50px';
      infoElementRef.current.style.left = '10px';
      infoElementRef.current.style.color = 'white';
      infoElementRef.current.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
      infoElementRef.current.style.padding = '10px';
      infoElementRef.current.style.borderRadius = '5px';
      mountRef.current.appendChild(infoElementRef.current);

      totalVolumeRef.current = totalVolume;
      filesCountRef.current = objects.length;

      const updateFrustumAndOcclusion = () => {
        const frustum = new THREE.Frustum();
        const projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projScreenMatrix);

        const frustumPlanes = frustum.planes.map(plane => ({
          normal: { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z },
          constant: plane.constant
        }));

        const visibleObjects = [];
        octreeRef.current.query(frustum, visibleObjects);
        const serializableMeshData = visibleObjects.map(mesh => ({
          id: mesh.id,
          position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
          boundingSphere: {
            center: { x: mesh.boundingSphere.center.x, y: mesh.boundingSphere.center.y, z: mesh.boundingSphere.center.z },
            radius: mesh.boundingSphere.radius
          }
        }));

        workerRef.current.postMessage({
          type: 'checkFrustumAndOcclusion',
          data: {
            meshData: serializableMeshData,
            frustumPlanes: frustumPlanes,
            bufferFactor: BUFFER_FACTOR,
            cameraPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z }
          }
        });
      };

      updateFrustumAndOcclusion();
      controls.addEventListener('change', updateFrustumAndOcclusion);
      
      setIsLoading(false);
    };

    const updateVisibleMeshes = (cullingResult) => {
      const { visible, buffer, unloaded, occluded } = cullingResult;

      meshesRef.current.forEach(meshData => {
        const visibleMesh = visible.find(m => m.id === meshData.id);
        const bufferMesh = buffer.find(m => m.id === meshData.id);
        const occludedMesh = occluded.find(m => m.id === meshData.id);

        if (visibleMesh) {
          scene.add(meshData.mesh);
          meshData.mesh.visible = true;
        } else if (bufferMesh || occludedMesh) {
          scene.add(meshData.mesh);
          meshData.mesh.visible = false;
        } else {
          scene.remove(meshData.mesh);
        }
      });

      visibleMeshCountRef.current = visible.length;
      occludedMeshCountRef.current = occluded.length;
      bufferZoneMeshCountRef.current = buffer.length;
      unloadedMeshCountRef.current = unloaded.length;

      updateInfoDisplay();
    };

    const updateInfoDisplay = () => {
      if (infoElementRef.current) {
        const totalMeshes = meshesRef.current.length;
        const loadedMeshes = visibleMeshCountRef.current + occludedMeshCountRef.current + bufferZoneMeshCountRef.current;
        const unloadedMeshes = unloadedMeshCountRef.current;
        const bufferZoneMeshes = bufferZoneMeshCountRef.current;
        const culledMeshes = occludedMeshCountRef.current + unloadedMeshes;
        const unculledMeshes = visibleMeshCountRef.current + bufferZoneMeshes;
    
        infoElementRef.current.innerHTML = `
          Total Volume of Files: ${totalVolumeRef.current.toFixed(6)} m³<br>
          Number of Files: ${filesCountRef.current}<br>
          Total Meshes: ${totalMeshes}<br>
          Loaded Meshes: ${loadedMeshes}<br>
          Unloaded Meshes: ${unloadedMeshes}<br>
          Meshes in Buffer Zone: ${bufferZoneMeshes}<br>
          Visible (Unculled) Meshes: ${visibleMeshCountRef.current}<br>
          Occluded Meshes: ${occludedMeshCountRef.current}<br>
          Total Culled Meshes: ${culledMeshes}<br>
          Total Unculled Meshes: ${unculledMeshes}
        `;
      }
    };

    if (files.length > 0) {
      setIsLoading(true);
      setLoadingProgress(0);
      Promise.all(files.map((file, index) => loadFBX(file, index, files.length)))
        .then(processLoadedObjects)
        .catch(error => {
          console.error('Error loading files:', error);
          setIsLoading(false);
        });
    }

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current.removeChild(renderer.domElement);
      workerRef.current.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  }, [files]);

  const handleFileChange = (event) => {
    setFiles([...event.target.files]);
  };

  return (
    <div>
      <input
        style={{position:'absolute', top:10, left:10, zIndex: 1000}}
        type="file"
        multiple
        accept=".fbx"
        onChange={handleFileChange}
      />
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      {isLoading && <ProgressBar progress={loadingProgress} />}
    </div>
  );
}

export default RandomFbxFiles;