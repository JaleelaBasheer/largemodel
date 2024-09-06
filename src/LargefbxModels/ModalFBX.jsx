import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { openDB } from "idb";
import { Octree } from "three/examples/jsm/math/Octree";
import { Capsule } from "three/examples/jsm/math/Capsule";
function MultipleModelLoader() {
    const mountRef = useRef(null);
    const sceneRef = useRef(new THREE.Scene());
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const [db, setDb] = useState(null);
    const workerRef = useRef(null);
    const meshesRef = useRef([]);
    const frustumPlanesRef = useRef([]);
    const octreeRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const cumulativeBoxRef = useRef(new THREE.Box3());

    useEffect(() => {
        const initDB = async () => {
            const database = await openDB("fbx-files-db", 1, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains("files")) {
                        db.createObjectStore("files", { keyPath: "id", autoIncrement: true });
                    }
                },
            });
            setDb(database);
        };

        initDB();
        
        // Set up scene, camera, and renderer
        const scene = sceneRef.current;
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0xcccccc);  // Light gray background
        mountRef.current.appendChild(renderer.domElement);
        
      
        
        // Set up OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        scene.add(directionalLight);
        
        // Add debug cube
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(0, 0, 0);
        scene.add(cube);
        console.log('Debug cube added to scene');

        octreeRef.current = new Octree();
        
        try {
            workerRef.current = new Worker(new URL('../LargefbxModels/fbxmodalWorker.js', import.meta.url));
            workerRef.current.onmessage = handleWorkerMessage;
            workerRef.current.onerror = handleWorkerError;
            console.log('Web worker initialized successfully');
        } catch (error) {
            console.error('Error initializing web worker:', error);
        }

        // Store refs
        cameraRef.current = camera;
        rendererRef.current = renderer;
        controlsRef.current = controls;
        
        // Handle window resize
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        animate();
        
        return () => {
            window.removeEventListener('resize', handleResize);
            mountRef.current.removeChild(renderer.domElement);
            workerRef.current.terminate();
        };
    }, []);

    const handleWorkerMessage = (e) => {
        // console.log('Received message from worker:', e.data);
        const { visibleMeshes, invisibleMeshes } = e.data;
        
        // console.log('Visible meshes:', visibleMeshes.length);
        // console.log('Invisible meshes:', invisibleMeshes.length);
    
        let loadedCount = 0;
        let unloadedCount = 0;
    
        visibleMeshes.forEach(id => {
            const mesh = meshesRef.current.find(m => m.id === id);
            if (mesh && !sceneRef.current.getObjectById(id)) {
                sceneRef.current.add(mesh);
                loadedCount++;
            }
        });
        
        invisibleMeshes.forEach(id => {
            const object = sceneRef.current.getObjectById(id);
            if (object) {
                sceneRef.current.remove(object);
                unloadedCount++;
            }
        });
    
        // console.log(`Loaded ${loadedCount} meshes, unloaded ${unloadedCount} meshes`);
        // console.log(`Total meshes in scene: ${sceneRef.current.children.length}`);
    };
    
    
    const handleWorkerError = (error) => {
        console.error('Web worker error:', error);
    };


  const onFileChange = (event) => {
    const fbxLoader = new FBXLoader();
    const files = event.target.files;
    const cumulativeBox = new THREE.Box3();
    // const storedCenter = JSON.parse(localStorage.getItem('boundingBoxCenter'));  
    if (files.length > 0) {
      let loadedFilesCount = 0;

      Array.from(files).forEach((file) => {

        // if (storedCenter) {
        //     const center = new THREE.Vector3(storedCenter.x, storedCenter.y, storedCenter.z);
        //     cameraRef.current.position.set(center.x, center.y, center.z);
        //     cameraRef.current.lookAt(center);
        //   }
        //   else{
            fbxLoader.load(URL.createObjectURL(file), (object) => {
                const box = new THREE.Box3().setFromObject(object);
              
                // Update cumulative bounding box
                if (cumulativeBox.isEmpty()) {
                  cumulativeBox.copy(box);
                } else {
                  cumulativeBox.union(box);
                }
      
                loadedFilesCount++;
                // Update progress
      
                // After all files are loaded, log the final cumulative bounding box
                if (loadedFilesCount === files.length) {
                octreeRef.current.fromGraphNode(sceneRef.current);
                  const center = cumulativeBox.getCenter(new THREE.Vector3());
                  const size = cumulativeBox.getSize(new THREE.Vector3());
                  const maxDim = Math.max(size.x, size.y, size.z);
                  const fov = cameraRef.current.fov * (Math.PI / 180);
                  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                  cameraZ *= 1.5; // Zoom out a little so object fits in view
      
                  cameraRef.current.position.set(center.x, center.y, center.z);
                  cameraRef.current.lookAt(center);
                 
                    // Store the center in local storage
                const centerData = {
                         x: center.x,
                         y: center.y,
                         z: center.z
                  };
            localStorage.setItem('boundingBoxCenter', JSON.stringify(centerData));
          }              
              });
          // }
          
      });

        Array.from(files).forEach((file) => {
            loadModel(file);
        }) 
      updateOctree();
    }
  };
  const loadModel = async (file) => {
    if (db) {
        const existingFile = await db.get("files", file.name);       
        if (existingFile) {
            console.log(`File already exists: ${file.name}`);
            await loadModelFromDB(file.name);
        } else {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;
                await db.put("files", { id: file.name, data: arrayBuffer });
                console.log(`Stored file: ${file.name}`);
                await loadModelFromDB(file.name);
            };
            reader.readAsArrayBuffer(file);
        }
    }
};

const loadModelFromDB = async (fileName) => {
  if (!db) {
      console.error("Database not initialized");
      return;
  }

  const loader = new FBXLoader();
  const tx = db.transaction("files", "readonly");
  const store = tx.objectStore("files");
  const file = await store.get(fileName);
  if (file) {
      const arrayBuffer = file.data;
      loader.load(
          URL.createObjectURL(new Blob([arrayBuffer])),
          (object) => {
              sceneRef.current.add(object);            
              cumulativeBoxRef.current.expandByObject(object);

              object.traverse((child) => {
                  if (child.isMesh) {
                      meshesRef.current.push(child);
                  }
              });

              console.log(`Added model to scene: ${fileName}`);
          },
          undefined,
          (error) => {
              console.error("Error loading model:", error);
          }
      );
  }
};
const updateOctree = () => {
    octreeRef.current.fromGraphNode(sceneRef.current);
    console.log("Octree updated");
};

const performOcclusionCulling = () => {
    const camera = cameraRef.current;
    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));

    meshesRef.current.forEach(mesh => {
        if (frustum.intersectsObject(mesh)) {
            const meshBoundingSphere = mesh.geometry.boundingSphere.clone();
            meshBoundingSphere.applyMatrix4(mesh.matrixWorld);

            raycasterRef.current.set(camera.position, meshBoundingSphere.center.sub(camera.position).normalize());

            const intersects = raycasterRef.current.intersectObjects(sceneRef.current.children, true);

            if (intersects.length > 0 && intersects[0].object.id === mesh.id) {
                mesh.visible = true;
            } else {
                mesh.visible = false;
            }
        } else {
            mesh.visible = false;
        }
    });
};

const updateFrustumPlanes = () => {
  const frustum = new THREE.Frustum();
  const projScreenMatrix = new THREE.Matrix4();
  projScreenMatrix.multiplyMatrices(cameraRef.current.projectionMatrix, cameraRef.current.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  frustumPlanesRef.current = frustum.planes.map(plane => ({
      normal: { x: plane.normal.x, y: plane.normal.y, z: plane.normal.z },
      constant: plane.constant
  }));
};

const animate = () => {

    requestAnimationFrame(animate);

    updateFrustumPlanes();
    performOcclusionCulling();

    // Send meshes and frustum planes to worker for visibility check
    const message = {
        action: 'checkVisibility',
        meshes: meshesRef.current.map(mesh => ({ 
            id: mesh.id, 
            position: { 
                x: mesh.position.x, 
                y: mesh.position.y, 
                z: mesh.position.z 
            } 
        })),
        frustumPlanes: frustumPlanesRef.current
    };
    
    workerRef.current.postMessage(message);

    controlsRef.current.update();  // Update OrbitControls
    rendererRef.current.render(sceneRef.current, cameraRef.current);
};


  return (
    <div className="main">
    <div className="canvas-container" style={{position:'relative',width:'100%',height:'100vh',overflow:'hidden'}}>
      <div style={{position:'absolute',top:'10px',left:'10px'}} >
      <input className="button" type="file" multiple onChange={onFileChange} accept=".fbx" />
    
      </div>
      
      <div ref={mountRef} style={{ width: "100%", height: "100vh" }}></div>
     
    </div>
  </div>
  )
}
export default MultipleModelLoader;
