// App.js
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { zipSync } from 'fflate';

function CompressedFbx() {
  const mountRef = useRef(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    // Set up the scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Set up the renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0xffff00)
    mountRef.current.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 5, 5);
    scene.add(directionalLight);

    // Load FBX files when they change
    if (files.length > 0) {
      const loader = new FBXLoader();

      files.forEach((file) => {
        console.log(file);
        const reader = new FileReader();
        reader.onload = async (event) => {
          const content = event.target.result;
          console.log(content)

          // Compress the file
          const compressed = zipSync(new Uint8Array(content), { level: 9 });
          console.log(compressed);
          const compressedBlob = new Blob([compressed], { type: 'application/zip' });

          // Uncompress and load the FBX
          const decompressedBuffer = await compressedBlob.arrayBuffer();
          loader.parse(decompressedBuffer, '', (object) => {
            object.scale.set(0.01, 0.01, 0.01); // Adjust scale if necessary
            scene.add(object);
          });
        };
        reader.readAsArrayBuffer(file);
      });
    }

    // Animation loop
    const animate = function () {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Clean up on component unmount
    return () => {
      mountRef.current.removeChild(renderer.domElement);
    };
  }, [files]);

  // Handle file input change
  const handleFileChange = (event) => {
    setFiles(Array.from(event.target.files));
  };

  return (
    <>
      <input type="file" multiple accept=".fbx" onChange={handleFileChange} />
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
    </>
  );
}

export default CompressedFbx;
