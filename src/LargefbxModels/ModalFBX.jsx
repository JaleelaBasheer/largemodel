import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

const FBXViewer = () => {
  const mountRef = useRef(null);
  const [scene, setScene] = useState(null);
  const [camera, setCamera] = useState(null);
  const [renderer, setRenderer] = useState(null);

  useEffect(() => {
    // Set up scene
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const newScene = new THREE.Scene();
    const newCamera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const newRenderer = new THREE.WebGLRenderer();

    newRenderer.setSize(window.innerWidth, window.innerHeight);
    newRenderer.setClearColor(0xffff00);
    mountRef.current.appendChild(newRenderer.domElement);

    newCamera.position.z = 5;

    const light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set(0, 0, 10);
    newScene.add(light);

    setScene(newScene);
    setCamera(newCamera);
    setRenderer(newRenderer);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      newRenderer.render(newScene, newCamera);
    };
    animate();

    // Clean up
    return () => {
      mountRef.current.removeChild(newRenderer.domElement);
    };
  }, []);

  const loadFBX = (file) => {
    console.log(file);
    const loader = new FBXLoader();
      loader.load(URL.createObjectURL(file),(object) => {
      
        scene.add(object);
        // Center the object
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const distance = Math.max(size.x, size.y, size.z) * 2;
    
        camera.position.copy(center);
        camera.position.y += distance;

      });

  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
      loadFBX(files[i]);
    }
  };

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <input type="file" onChange={handleFileChange} multiple accept=".fbx" />
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default FBXViewer;