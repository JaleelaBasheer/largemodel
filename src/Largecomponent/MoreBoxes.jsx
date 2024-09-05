import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { Octree } from './Octree';
import { CubeLOD } from './CubeLOD';

const ThousandCubes = () => {
  const mountRef = useRef(null);

  useEffect(() => {
    // Set up scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Calculate dimensions for the three volumes
    const innerSide = Math.cbrt(100);
    const middleSide = Math.cbrt(1000);
    const outerSide = Math.cbrt(10000);

    // Create colors for the cubes
    const cubeColors = [
      0xff0000, // Red (inner)
      0x00ff00, // Green (middle)
      0x0000ff  // Blue (outer)
    ];

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Initialize octree
    const octree = new Octree(new THREE.Box3(
      new THREE.Vector3(-outerSide/2, -outerSide/2, -outerSide/2),
      new THREE.Vector3(outerSide/2, outerSide/2, outerSide/2)
    ));

    // Initialize web worker
    const worker = new Worker(new URL('../Largecomponent/boxWorker.js', import.meta.url));

    // Send initial cube data to worker
    worker.postMessage({ 
      type: 'init', 
      cubeCount: 1000, 
      dimensions: [innerSide, middleSide, outerSide] 
    });

    // Map to store cube LODs
    const cubeLODs = new Map();

    // Handle messages from worker
    worker.onmessage = (e) => {
      if (e.data.type === 'updateCubes') {
        const visibleCubes = e.data.visibleCubes;
        const invisibleCubes = e.data.invisibleCubes;
        
        // Remove invisible cubes from the scene and octree
        invisibleCubes.forEach(cubeId => {
          if (cubeLODs.has(cubeId)) {
            const cube = cubeLODs.get(cubeId);
            scene.remove(cube);
            octree.remove(cube);
            cubeLODs.delete(cubeId);
          }
        });
        
        // Add or update visible cubes
        visibleCubes.forEach(cube => {
          let cubeLOD;
          if (cubeLODs.has(cube.id)) {
            cubeLOD = cubeLODs.get(cube.id);
            cubeLOD.position.set(cube.x, cube.y, cube.z);
            cubeLOD.updateMatrixWorld();
            octree.update(cubeLOD);
          } else {
            cubeLOD = new CubeLOD(cubeColors[cube.volume]);
            cubeLOD.position.set(cube.x, cube.y, cube.z);
            cubeLOD.updateMatrixWorld();
            cubeLODs.set(cube.id, cubeLOD);
            scene.add(cubeLOD);
            octree.insert(cubeLOD);
          }
        });
      }
    };

    // Position camera
    camera.position.set(outerSide, outerSide / 2, outerSide * 1.5);
    camera.lookAt(0, 0, 0);

    // Add orbit controls for better interaction
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Create frustum for culling
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Update frustum
      camera.updateMatrixWorld();
      projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projScreenMatrix);

      // Perform frustum culling and update LOD
      const visibleObjects = octree.getObjectsInFrustum(frustum);
      cubeLODs.forEach((cubeLOD, id) => {
        const isVisible = visibleObjects.includes(cubeLOD);
        cubeLOD.visible = isVisible;
        if (isVisible) {
          const distance = camera.position.distanceTo(cubeLOD.position);
          cubeLOD.updateLOD(distance);
        }
      });

      // Send camera data to worker
      worker.postMessage({
        type: 'updateCamera',
        cameraPosition: camera.position.toArray(),
        cameraRotation: camera.rotation.toArray(),
        projectionMatrix: camera.projectionMatrix.toArray()
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resizing
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current.removeChild(renderer.domElement);
      worker.terminate();
    };
  }, []);

  return <div ref={mountRef} />;
};

export default ThousandCubes;