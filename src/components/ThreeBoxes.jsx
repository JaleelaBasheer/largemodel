import React, { useEffect, useRef } from 'react';
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

  remove(object) {
    if (this.children === null) {
      const index = this.objects.indexOf(object);
      if (index !== -1) {
        this.objects.splice(index, 1);
        return true;
      }
    } else {
      for (let child of this.children) {
        if (child.remove(object)) return true;
      }
    }
    return false;
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
      this.children.push(new Octree(newCenter, newSize));
    }

    for (let object of this.objects) {
      for (let child of this.children) {
        if (child.add(object)) break;
      }
    }
    this.objects = [];
  }

  contains(point) {
    return Math.abs(point.x - this.center.x) <= this.size / 2 &&
           Math.abs(point.y - this.center.y) <= this.size / 2 &&
           Math.abs(point.z - this.center.z) <= this.size / 2;
  }

  intersectRay(ray, intersects = []) {
    if (!this.intersectsRay(ray)) return intersects;

    if (this.children === null) {
      for (let object of this.objects) {
        if (ray.intersectBox(new THREE.Box3().setFromObject(object), new THREE.Vector3())) {
          intersects.push(object);
        }
      }
    } else {
      for (let child of this.children) {
        child.intersectRay(ray, intersects);
      }
    }
    return intersects;
  }

  intersectsRay(ray) {
    const bbox = new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size));
    return ray.intersectsBox(bbox);
  }
}

const ThreeBoxes = () => {
  const sceneRef = useRef(null);
  const workerRef = useRef(null);
  const octreeRef = useRef(null);

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    sceneRef.current.appendChild(renderer.domElement);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5).normalize();
    scene.add(directionalLight);

    // Camera positioning
    camera.position.set(5, 2, 10);
    controls.update();

    // Raycaster for occlusion culling
    const raycaster = new THREE.Raycaster();

    // Create a web worker
    workerRef.current = new Worker(new URL('../components/boxWorker.js', import.meta.url));

    // Initialize Octree
    octreeRef.current = new Octree(new THREE.Vector3(0, 0, 0), 40);

    // Box creation function with LOD
    const createBox = (x, y, z, priority) => {
      const lod = new THREE.LOD();

      // High detail (close to camera)
      const highDetailGeometry = new THREE.BoxGeometry(1, 1, 1, 10, 10, 10);
      const highDetailMaterial = new THREE.MeshStandardMaterial({ color: getPriorityColor(priority) });
      const highDetailMesh = new THREE.Mesh(highDetailGeometry, highDetailMaterial);
      lod.addLevel(highDetailMesh, 0);

      // Medium detail
      const mediumDetailGeometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
      const mediumDetailMaterial = new THREE.MeshStandardMaterial({ color: getPriorityColor(priority) });
      const mediumDetailMesh = new THREE.Mesh(mediumDetailGeometry, mediumDetailMaterial);
      lod.addLevel(mediumDetailMesh, 10);

      // Low detail (far from camera)
      const lowDetailGeometry = new THREE.BoxGeometry(1, 1, 1);
      const lowDetailMaterial = new THREE.MeshStandardMaterial({ color: getPriorityColor(priority) });
      const lowDetailMesh = new THREE.Mesh(lowDetailGeometry, lowDetailMaterial);
      lod.addLevel(lowDetailMesh, 20);

      lod.position.set(x, y, z);
      lod.userData.priority = priority;
      return lod;
    };

    // Function to get color based on priority
    const getPriorityColor = (priority) => {
      switch(priority) {
        case 1: return 0xff0000; // Red
        case 2: return 0x00ff00; // Green
        case 3: return 0x0000ff; // Blue
        default: return 0xffffff; // White
      }
    };

    // Generate box data for 1000 boxes
    const boxData = [];
    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * 40 - 20;
      const y = Math.random() * 40 - 20;
      const z = Math.random() * 40 - 20;
      
      const distance = Math.sqrt(x*x + y*y + z*z);
      let priority;
      if (distance <= 10) priority = 1;
      else if (distance <= 20) priority = 2;
      else priority = 3;
      
      boxData.push({ x, y, z, priority });
    }

    // Send initial box data to worker
    workerRef.current.postMessage({ type: 'init', boxData });

    // Handle messages from worker
    workerRef.current.onmessage = (event) => {
      const { type, boxes, message } = event.data;
      if (type === 'error') {
        console.error('Error from worker:', message);
      } else if (type === 'updateBoxes') {
        // Remove boxes that are no longer visible or priority 1
        scene.children.forEach(child => {
          if (child instanceof THREE.LOD) {
            const boxData = boxes.find(b => b.x === child.position.x && b.y === child.position.y && b.z === child.position.z);
            if (!boxData) {
              scene.remove(child);
              octreeRef.current.remove(child);
              child.levels.forEach(level => {
                level.object.geometry.dispose();
                level.object.material.dispose();
              });
            } else if (boxData.priority !== child.userData.priority) {
              // Update priority if changed
              child.userData.priority = boxData.priority;
              child.levels.forEach(level => {
                level.object.material.color.setHex(getPriorityColor(boxData.priority));
              });
            }
          }
        });

        // Add or update visible boxes and priority 1 boxes
        boxes.forEach(({ x, y, z, priority }) => {
          let box = scene.getObjectByName(`box_${x}_${y}_${z}`);
          if (!box) {
            box = createBox(x, y, z, priority);
            box.name = `box_${x}_${y}_${z}`;
            scene.add(box);
            octreeRef.current.add(box);
          }
        });
      } else if (type === 'unloadBoxes') {
        boxes.forEach(({ x, y, z }) => {
          const box = scene.getObjectByName(`box_${x}_${y}_${z}`);
          if (box) {
            scene.remove(box);
            octreeRef.current.remove(box);
            box.levels.forEach(level => {
              level.object.geometry.dispose();
              level.object.material.dispose();
            });
          }
        });
      } else {
        console.warn('Unknown message type from worker:', type);
      }
    };

    // Occlusion culling function
    const performOcclusionCulling = () => {
      const cameraPosition = camera.position;
      const direction = new THREE.Vector3();

      scene.children.forEach(child => {
        if (child instanceof THREE.LOD) {
          child.visible = false;
          direction.subVectors(child.position, cameraPosition).normalize();
          raycaster.set(cameraPosition, direction);

          const intersects = octreeRef.current.intersectRay(raycaster.ray);
          if (intersects.length > 0 && intersects[0] === child) {
            child.visible = true;
          }
        }
      });
    };

    // Animation loop
    const animate = function () {
      requestAnimationFrame(animate);

      performOcclusionCulling();

      // Update LOD levels
      scene.traverse((object) => {
        if (object instanceof THREE.LOD) {
          object.update(camera);
        }
      });

      // Check visibility and update worker
      const visibleBoxes = [];
      scene.traverse((object) => {
        if (object instanceof THREE.LOD && object.visible) {
          visibleBoxes.push({
            x: object.position.x,
            y: object.position.y,
            z: object.position.z,
            priority: object.userData.priority
          });
        }
      });

      workerRef.current.postMessage({ 
        type: 'updateVisibility', 
        visibleBoxes, 
        cameraPosition: { 
          x: camera.position.x, 
          y: camera.position.y, 
          z: camera.position.z 
        } 
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Handle window resizing
    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onWindowResize);

    return () => {
      // Clean up on component unmount
      window.removeEventListener('resize', onWindowResize);
      scene.traverse((object) => {
        if (object instanceof THREE.LOD) {
          object.levels.forEach(level => {
            level.object.geometry.dispose();
            level.object.material.dispose();
          });
        }
      });
      renderer.dispose();
      sceneRef.current.removeChild(renderer.domElement);
      workerRef.current.terminate();
    };
  }, []);

  return <div ref={sceneRef} />;
};

export default ThreeBoxes;