import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { SimpleOctree } from '../Largecomponent/octreeHelper';

function SceneCanvas() {
    const mountRef = useRef(null);
    const cameraRef = useRef(null);
    const sceneRef = useRef(null);
    const octree = useRef(new SimpleOctree()).current;
  
    useEffect(() => {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
  
      // Setup renderer
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(width, height);
      mountRef.current.appendChild(renderer.domElement);
  
      // Setup camera
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.z = 5;
      cameraRef.current = camera;
  
      // Setup scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;
  
      // Add some meshes to the octree
      const geometry = new THREE.BoxGeometry();
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      octree.add(mesh);
  
      // Animation loop
      function animate() {
        requestAnimationFrame(animate);
  
        if (cameraRef.current && sceneRef.current) {
          octree.update(cameraRef.current);
        }
  
        renderer.render(scene, camera);
      }
  
      animate();
  
      return () => {
        mountRef.current.removeChild(renderer.domElement);
      };
    }, []);
  
    return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
  }
  
  export default SceneCanvas;
