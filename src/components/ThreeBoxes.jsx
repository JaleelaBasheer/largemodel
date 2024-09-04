import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

function ThreeBoxes() {
  const canvasRef = useRef(null);
  const count = 20;  // Number of boxes
  const totalVolume = 1000;  // Total volume of the space
  const [boxes, setBoxes] = useState([]);

  useEffect(() => {
    const worker = new Worker(new URL('../components/boxWorker1.js', import.meta.url));

    worker.postMessage({ count, totalVolume });

    worker.onmessage = function(e) {
      setBoxes(e.data);
    };

    return () => worker.terminate();
  }, [count, totalVolume]);

  useEffect(() => {
    if (!canvasRef.current || boxes.length === 0) return;

    // Set up the scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Set camera position
    camera.position.z = 500;

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;

    // Set up frustum for culling
    const frustum = new THREE.Frustum();
    const cameraViewProjectionMatrix = new THREE.Matrix4();

    const isBoxInFrustum = (box) => {
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      cameraViewProjectionMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(cameraViewProjectionMatrix);

      return frustum.intersectsObject(box);
    };

    const createBox = (boxData) => {
      const size = [Math.random() * 10, Math.random() * 10, Math.random() * 10];
      const geometry = new THREE.BoxGeometry(...size);
      const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(boxData.color) });
      const box = new THREE.Mesh(geometry, material);

      box.position.set(boxData.position.x, boxData.position.y, boxData.position.z);

      return box;
    };

    // Add boxes to the scene if they are within the frustum
    const sceneBoxes = boxes.map(createBox);
    sceneBoxes.forEach(box => {
      if (isBoxInFrustum(box)) {
        scene.add(box);
      }
    });

    // Set up lighting
    const ambientLight = new THREE.AmbientLight(0x404040);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 10);
    scene.add(ambientLight);
    scene.add(directionalLight);

    // Render loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();

      // Check visibility and add/remove boxes as needed
      sceneBoxes.forEach(box => {
        if (isBoxInFrustum(box)) {
          if (!scene.children.includes(box)) {
            scene.add(box);
          }
        } else {
          scene.remove(box);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Clean up on component unmount
    return () => {
      sceneBoxes.forEach(box => {
        if (box.geometry) box.geometry.dispose();
        if (box.material) box.material.dispose();
      });
      renderer.dispose();
    };
  }, [boxes]);

  return <canvas ref={canvasRef} />;
}

export default ThreeBoxes;