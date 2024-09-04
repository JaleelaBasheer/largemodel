import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

class Octree {
  constructor(center, size) {
    this.center = new THREE.Vector3().fromArray(center);
    this.size = size;
    this.objects = [];
    this.children = null;
  }

  add(object) {
    if (!this.contains(object.position)) return false;
    
    if (this.children === null) {
      this.objects.push(object);
      if (this.objects.length > 8 && this.size > 2) {
        this.subdivide();
      }
    } else {
      for (let child of this.children) {
        if (child.add(object)) break;
      }
    }
    return true;
  }

  subdivide() {
    this.children = [];
    for (let i = 0; i < 8; i++) {
      const newSize = this.size / 2;
      const newCenter = new THREE.Vector3(
        this.center.x + (i & 1 ? newSize / 2 : -newSize / 2),
        this.center.y + (i & 2 ? newSize / 2 : -newSize / 2),
        this.center.z + (i & 4 ? newSize / 2 : -newSize / 2)
      );
      this.children.push(new Octree(newCenter.toArray(), newSize));
    }

    for (let object of this.objects) {
      for (let child of this.children) {
        if (child.add(object)) break;
      }
    }
    this.objects = [];
  }

  contains(point) {
    return Math.abs(point[0] - this.center.x) <= this.size / 2 &&
           Math.abs(point[1] - this.center.y) <= this.size / 2 &&
           Math.abs(point[2] - this.center.z) <= this.size / 2;
  }

  getObjectsInFrustum(frustum) {
    if (!this.intersectsFrustum(frustum)) return [];

    let result = [];
    if (this.children === null) {
      result = this.objects.filter(obj => frustum.containsPoint(new THREE.Vector3().fromArray(obj.position)));
    } else {
      for (let child of this.children) {
        result = result.concat(child.getObjectsInFrustum(frustum));
      }
    }
    return result;
  }

  intersectsFrustum(frustum) {
    const box = new THREE.Box3(
      new THREE.Vector3().subVectors(this.center, new THREE.Vector3(this.size / 2, this.size / 2, this.size / 2)),
      new THREE.Vector3().addVectors(this.center, new THREE.Vector3(this.size / 2, this.size / 2, this.size / 2))
    );
    return frustum.intersectsBox(box);
  }
}

const FbxFileLoader = () => {
  const sceneRef = useRef(null);  // Ref for the scene DOM element
  const sceneObjRef = useRef(null); // Ref for the THREE.Scene object
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const workerRef = useRef(null);
  const octreeRef = useRef(null);
  const loadedObjectsRef = useRef(new Map());
  const [files, setFiles] = useState([]);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xffff00);
  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
   
    sceneRef.current.appendChild(renderer.domElement);

    cameraRef.current = camera;
    rendererRef.current = renderer;
    sceneObjRef.current = scene;  // Store the scene in the ref

    // Camera setup
    camera.position.set(0, 0, 50);
    camera.lookAt(0, 0, 0);

    // Controls setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../components/boxWorker1.js', import.meta.url));

    // Initialize Octree
    octreeRef.current = new Octree(new THREE.Vector3(0, 0, 0), 1000);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      updateVisibility();
      renderer.render(scene, camera);
    };
    animate();

    // Clean up
    return () => {
      renderer.dispose();
      controls.dispose();
    };
  }, []);

  // File input handler
  const handleFileChange = (event) => {
    const newFiles = Array.from(event.target.files);
    setFiles(prevFiles => [...prevFiles, ...newFiles]);
    newFiles.forEach(file => loadFbxFile(file));
  };

  // FBX file loading function
  const loadFbxFile = (file) => {
    const loader = new FBXLoader();
    const objectUrl = URL.createObjectURL(file);

    loader.load(objectUrl, (object) => {
      object = centerAndScaleObject(object);
      octreeRef.current.add(object);
      loadedObjectsRef.current.set(object.uuid, object);
      updateVisibility();
    });
  };

  // Center and scale the loaded object
  const centerAndScaleObject = (object) => {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 10 / maxDim;
    
    object.position.sub(center);
    object.scale.multiplyScalar(scale);
    
    return object;
  };

  // Update visibility of objects based on camera position
  const updateVisibility = () => {
    const camera = cameraRef.current;
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
  
    workerRef.current.postMessage({
      type: 'updateVisibility',
      cameraPosition: camera.position.toArray(),
      frustum: frustum.planes.map(plane => ({
        normal: plane.normal.toArray(),
        constant: plane.constant
      })),
      objects: Array.from(loadedObjectsRef.current.entries()).map(([uuid, object]) => ({
        uuid,
        position: object.position.toArray()
      }))
    });
  };

  useEffect(() => {
    const handleWorkerMessage = (event) => {
      const { type, data } = event.data;
      if (type === 'visibilityUpdate') {
        updateSceneWithVisibleObjects(data);
      }
    };

    workerRef.current.addEventListener('message', handleWorkerMessage);

    return () => {
      workerRef.current.removeEventListener('message', handleWorkerMessage);
    };
  }, []);

  const updateSceneWithVisibleObjects = (visibleObjects) => {
    const scene = sceneObjRef.current;  // Use the correct scene reference
  
    loadedObjectsRef.current.forEach((object, uuid) => {
      if (visibleObjects.includes(uuid)) {
        if (!scene.getObjectByProperty('uuid', uuid)) {
          scene.add(object);
        }
      } else {
        scene.remove(object);
      }
    });
  };
  

  return (
    <div>
      <div ref={sceneRef} style={{ width: '100vw', height: '100vh' }} />
      <input type="file" onChange={handleFileChange} multiple accept=".fbx" />
    </div>
  );
};

export default FbxFileLoader;
