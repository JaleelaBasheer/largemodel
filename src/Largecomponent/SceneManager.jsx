import React, { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { SimpleOctree } from '../Largecomponent/octreeHelper';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'; // Import OrbitControls
import FileUploader from './FileUploader';

function SceneManager() {
  const [worker, setWorker] = useState(null);
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);
  const octree = useRef(new SimpleOctree()).current;
  const mountRef = useRef(null);
  const controlsRef = useRef(null); // Ref to store OrbitControls

  useEffect(() => {
    const myWorker = new Worker(new URL('../Largecomponent/fileWorker.js', import.meta.url));
    setWorker(myWorker);

    const width = window.innerWidth;
    const height = window.innerHeight;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(width, height);
    renderer.setClearColor(0xffff00); // Set a clear color for debugging
    mountRef.current.appendChild(renderer.domElement);
    setRenderer(renderer);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 10; // Move the camera further back for visibility
    setCamera(camera);

    const scene = new THREE.Scene();
    setScene(scene);

    // Initialize OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;

    function animate() {
      requestAnimationFrame(animate);
      if (camera && scene) {
        octree.update(camera);
        controls.update(); // Update controls
        renderer.render(scene, camera);
      }
    }

    animate();

    // Cleanup function
    return () => {
      mountRef.current.removeChild(renderer.domElement);
      myWorker.terminate();
    };
  }, []);

  function loadFile(fileName) {
    console.log(`Loading file: ${fileName}`);
    if (worker) {
      worker.postMessage({ type: 'load', fileName });
      worker.onmessage = (event) => {
        if (event.data.type === 'loaded') {
          const { arrayBuffer } = event.data;
          const loader = new FBXLoader();
          loader.parse(arrayBuffer, (object) => {
            console.log('Object loaded:', object);
            scene.add(object);
            octree.add(object);
          });
        }
      };
    }
  }

  function unloadFile(fileName) {
    console.log(`Unloading file: ${fileName}`);
    if (worker) {
      worker.postMessage({ type: 'unload', fileName });
    }
  }

  // Optional: Add a basic object to the scene for testing
  useEffect(() => {
    if (scene) {
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const cube = new THREE.Mesh(geometry, material);
      scene.add(cube);
    }
  }, [scene]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%' }}>
      <FileUploader onFileLoaded={loadFile} onFileUnloaded={unloadFile} />
    </div>
  );
}

export default SceneManager;
