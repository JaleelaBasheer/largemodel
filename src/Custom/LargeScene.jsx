import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { openDB } from "idb";
import { Octree } from "three/examples/jsm/math/Octree";

function FinalLargeScene() {
    const mountRef = useRef(null);
    const sceneRef = useRef(new THREE.Scene());
    const cameraRef = useRef(new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000));
    const rendererRef = useRef(new THREE.WebGLRenderer({ antialias: true }));
    const [db, setDb] = useState(null);
    const cumulativeBoundingBoxRef = useRef(new THREE.Box3());
    const mouse = useRef({ x: 0, y: 0 });
    const isMouseDown = useRef(false);
    const isPanning = useRef(false);
    const isZooming = useRef(false);
    const lastMouseMovement = useRef({ x: 0, y: 0 });
    const [flySpeed, setFlySpeed] = useState(1); 
    const [flyrotationSpeed, setflyrotationSpeed] = useState(1); 
    const [loadingProgress, setLoadingProgress] = useState(0); 
    const [loading, setLoading] = useState(false);
    const octreeRef = useRef(null);
    const loadedModels = useRef(new Map());
    const workerRef = useRef(null);
    const meshesRef = useRef([]);
    const frustumPlanesRef = useRef([]);
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
        
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        rendererRef.current.setClearColor(0xff0000);
        mountRef.current.appendChild(rendererRef.current.domElement);
        
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        sceneRef.current.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 1, 0);
        sceneRef.current.add(directionalLight);
        
        octreeRef.current = new Octree();

        // Initialize Web Worker
        workerRef.current = new Worker(new URL('./finalpriorityWorker.js', import.meta.url));
        workerRef.current.onmessage = handleWorkerMessage;       
        animate();
        
        return () => {
            mountRef.current.removeChild(rendererRef.current.domElement);
            if (workerRef.current) {
                workerRef.current.terminate();
            }
        };
    }, []);

    useEffect(() => {
        enablefycontrols();
        return () => {
            disableflycontrols();
        };
    }, [flySpeed, flyrotationSpeed]);
   
    const onFileChange = (event) => {
        const fbxLoader = new FBXLoader();
        const files = event.target.files;
        const cumulativeBox = new THREE.Box3();
        const storedCenter = JSON.parse(localStorage.getItem('boundingBoxCenter'));

        const priorityMapping = {
            high: 1,
            medium: 2,
            low: 3,
          };
        if (files.length > 0) {
          setLoading(true);
          let loadedFilesCount = 0;
    
          Array.from(files).forEach((file) => {
            const priority = determinePriority(file);

            if (storedCenter) {
                const center = new THREE.Vector3(storedCenter.x, storedCenter.y, storedCenter.z);
                cameraRef.current.position.set(center.x, center.y, center.z);
                cameraRef.current.lookAt(center);
              }
              else{
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
                    setLoadingProgress(Math.round((loadedFilesCount / files.length) * 100));
          
                    // After all files are loaded, log the final cumulative bounding box
                    if (loadedFilesCount === files.length) {
                      const center = cumulativeBox.getCenter(new THREE.Vector3());
                      const size = cumulativeBox.getSize(new THREE.Vector3());
                      const maxDim = Math.max(size.x, size.y, size.z);
                      const fov = cameraRef.current.fov * (Math.PI / 180);
                      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
                      cameraZ *= 1.5; // Zoom out a little so object fits in view
          
                      cameraRef.current.position.set(center.x, center.y, center.z + cameraZ);
                      cameraRef.current.lookAt(center);
                        // Store the center in local storage
        const centerData = {
          x: center.x,
          y: center.y,
          z: center.z
        };
        localStorage.setItem('boundingBoxCenter', JSON.stringify(centerData));
          
                      // Remove progress bar after loading
                      setLoading(false);
                      setLoadingProgress(0);
                    }
                  });
              }
           
    
            loadModel(file, priority);
          });
        }
      };
     
    const determinePriority = (file) => {
        const fileSize = file.size;
        console.log(fileSize)
        if (fileSize < 5000000) return 'high';
        if (fileSize < 50000000) return 'medium';
        return 'low';
    };

      const handleWorkerMessage = (event) => {
        const { type, fileName, modelData, modelsToLoad, modelsToUnload } = event.data;
        
        switch (type) {
            case 'loadModel':
                loadModelToScene(fileName, modelData);
                break;
            case 'unloadModel':
                unloadModelFromScene(fileName);
                break;
            case 'updateLoadedModels':
                modelsToLoad.forEach(model => loadModelFromDB(model));
                modelsToUnload.forEach(model => unloadModelFromScene(model));
                break;
        }
    };
   
    const updatePriorityQueue = () => {
        const cameraPosition = cameraRef.current.position;
        const modelData = Array.from(loadedModels.current.entries()).map(([fileName, modelInfo]) => ({
            fileName,
            position: modelInfo.position,
        }));

        workerRef.current.postMessage({
            type: 'updatePriority',
            cameraPosition: cameraPosition.toArray(),
            models: modelData
        });
    };

    const loadModelToScene = (fileName, modelData) => {
      const loader = new FBXLoader();
      loader.parse(modelData, "", (object) => {
        removeTexturesAndApplyColor(object);
        object.name = fileName;
    
       
    
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        loadedModels.current.set(fileName, { position: center });
      });
    };

    const unloadModelFromScene = (fileName) => {
        const object = sceneRef.current.getObjectByName(fileName);
        if (object) {
            sceneRef.current.remove(object);
            object.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(material => material.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        loadedModels.current.delete(fileName);
    };
  
  const loadModel = async (file, priorityQueue) => {
    if (db) {
        // Check if the file is already stored in IndexedDB
        const existingFile = await db.get("files", file.name);
        
        if (existingFile) {
            console.log(`File already exists: ${file.name}`);
            loadedModels.current.set(file.name, { position: new THREE.Vector3() });

            // Notify the worker and load the model
            workerRef.current.postMessage({
                type: 'newModel',
                fileName: file.name,
                priorityQueue
            });

            await loadModelFromDB(file.name);
        } else {
            // If the file is not in the database, read and store it
            const reader = new FileReader();

            reader.onload = async (event) => {
                const arrayBuffer = event.target.result;

                await db.put("files", { id: file.name, data: arrayBuffer });
                console.log(`Stored file: ${file.name}`);

                loadedModels.current.set(file.name, { position: new THREE.Vector3() });

                workerRef.current.postMessage({
                    type: 'newModel',
                    fileName: file.name,
                    priorityQueue
                });

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
              
              removeTexturesAndApplyColor(object);   
              object.traverse((child) => {
                if (child.isMesh) {
                    meshesRef.current.push(child);
                }
            });      
              // Add the object to the octree
              sceneRef.current.add(object);
            },
            undefined,
            (error) => {
              console.error("Error loading model:", error);
            }
          );
        }
      };
    
      const removeTexturesAndApplyColor = (object) => {
        const color = new THREE.Color(0x0000ff);
        object.traverse((child) => {
          if (child.isMesh) {
            if (child.material) {
              // If the material is an array (e.g., for multi-material meshes)
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  material.map = null; // Remove texture map
                  // material.color.set(color); // Set the solid color
                  material.needsUpdate = true; // Notify Three.js to update the material
                });
              } else {
                child.material.map = null; // Remove texture map
                // child.material.color.set(color); // Set the solid color
                child.material.needsUpdate = true; // Notify Three.js to update the material
              }
            }
          }
        });
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
        updatePriorityQueue();
        performOcclusionCulling();
      requestAnimationFrame(animate);
       rendererRef.current.render(sceneRef.current, cameraRef.current);
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
      };
    
      let continueTranslation = false;
      let continueRotation = false;
      let translationDirection = 0;
      let rotationDirection = 0;
      let translationSpeed = 5; // Initial translation speed
      let rotationSpeed = 0.001; // Initial rotation speed
    // Define sensitivity constants
      const horizontalSensitivity = 1.1; // Adjust as needed
      const verticalSensitivity = 1.1; // Adjust as needed
    
      // mouse events functions on fly control
    
      const handleMouseDown = (event) => {
            // event.preventDefault();
            const mouseEvent = event.touches ? event.touches[0] : event;
            if (mouseEvent.button === 0) { // Left mouse button pressed
                
                isMouseDown.current = true;
                mouse.current.x = mouseEvent.clientX;
                mouse.current.y = mouseEvent.clientY;
                isZooming.current = true;
                continueTranslation = true; // Enable automatic translation
                continueRotation = true; // Enable automatic rotation
                translationDirection = lastMouseMovement.current.y > 0 ? 1 : -1; // Set translation direction based on last mouse movement
                rotationDirection = lastMouseMovement.current.x > 0 ? 1 : -1; // Set rotation direction based on last mouse movement
            } else if (event.button === 1) { // Middle mouse button pressed
                console.log("middlebutton pressed")
                isPanning.current = true;
                continueTranslation = true; // Enable automatic translation
                mouse.current.x = mouseEvent.clientX;
                mouse.current.y = mouseEvent.clientY;
            }
        };
    
        const handleMouseUp = () => {
            isMouseDown.current = false;
            isPanning.current = false;
            isZooming.current = false;    
            lastMouseMovement.current = { x: 0, y: 0 };
        };
    
        const handleMouseMove = (event) => {
            event.preventDefault();
    
            const mouseEvent = event.touches ? event.touches[0] : event;
            if (!isMouseDown.current && !isPanning.current && !isZooming.current) return;
        
            const movementX = mouseEvent.clientX - mouse.current.x;
            const movementY = mouseEvent.clientY - mouse.current.y;
        
            lastMouseMovement.current = { x: movementX, y: movementY };
            if (isMouseDown.current) { // Left mouse button clicked
                const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
                if (isHorizontal) { // Horizontal movement, rotate around Y axis
                    continueCameraMovement(); 
                } else  { // Vertical movement, forward/backward
                    continueCameraMovement(); // Adjust with factors
                }
            } else if (isPanning.current) { // Middle mouse button clicked
    
                continueCameraMovement(movementX, movementY); // Adjust with factors
            }
        
            mouse.current.x = mouseEvent.clientX;
            mouse.current.y = mouseEvent.clientY;
        };
        
        const handleWheel = (event) => {
        const rotationAngle = -event.deltaY * 0.001;
    
        // Get the camera's up vector
        let cameraUp = new THREE.Vector3(1, 0, 0); // Assuming Y-axis is up
        cameraUp.applyQuaternion(cameraRef.current.quaternion);
    
        // Create a quaternion representing the rotation around the camera's up vector
        let quaternion = new THREE.Quaternion().setFromAxisAngle(cameraUp, rotationAngle);
    
        cameraRef.current.applyQuaternion(quaternion);
        storeCameraPosition(); // Assuming this function stores camera position
    
        };
    
        const continueCameraMovement = () => {
            const adjustedTranslationSpeed = flySpeed * translationSpeed ;
            if (isMouseDown.current && (continueTranslation || continueRotation)) {
                
                    requestAnimationFrame(continueCameraMovement);
                    const movementX = lastMouseMovement.current.x;
                    const movementY = lastMouseMovement.current.y;
                    const tileSizeFactor =10; // Implement this function to calculate the factor based on tile size
                    const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
                    if(isHorizontal){
                        const rotationAngle = -movementX * rotationSpeed * horizontalSensitivity * flyrotationSpeed *tileSizeFactor;
    
                        // Get the camera's up vector
                        let cameraUp = cameraRef.current.up.clone().normalize();
                        
                        // Create a quaternion representing the rotation around the camera's up vector
                        let quaternion = new THREE.Quaternion().setFromAxisAngle(cameraUp, rotationAngle);
                        
                        cameraRef.current.applyQuaternion(quaternion);
                        storeCameraPosition();
    
                    }
                    else {
                        const zoomSpeed = movementY * 0.01; // Adjust zoom speed based on last recorded mouse movement
    
                        const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraRef.current.quaternion);
                    // Move the camera forward/backward along its local forward direction
                    cameraRef.current.position.add(forwardDirection.multiplyScalar(zoomSpeed * adjustedTranslationSpeed * tileSizeFactor));
                    storeCameraPosition();
    
                    }			
            }
            
            else if (isPanning.current && (continueTranslation)) {
                requestAnimationFrame(continueCameraMovement);
                const tileSizeFactor = 0.1;
                const movementY = lastMouseMovement.current.y;
                const movementX = lastMouseMovement.current.x;
            const adjustedHorizontalSensitivity = horizontalSensitivity * tileSizeFactor;
            const adjustedVerticalSensitivity = verticalSensitivity * tileSizeFactor;
    
                // Calculate movement speed based on mouse movement and sensitivity
                const moveSpeedX = movementX * adjustedHorizontalSensitivity;
                const moveSpeedY = movementY * adjustedVerticalSensitivity;
               
                const isHorizontal = Math.abs(movementX) > Math.abs(movementY);
                const isVertical = Math.abs(movementY) > Math.abs(movementX);
            
                if (isHorizontal) {
                    // Move the camera along its local x axis
                    cameraRef.current.translateX(moveSpeedX);
                    storeCameraPosition()
                } else if (isVertical) {
                    // Move the camera along its local y axis
                    cameraRef.current.translateY(-moveSpeedY);
                    storeCameraPosition()
    
                }
    
    
            }
        };
        const storeCameraPosition = () => {
        // const { position,} = cameraRef.current;
        // flyModeCameraPosition.current.copy(position);
        // console.log('Camera position stored:', position);
        // const { position, quaternion } = cameraRef.current;
        // flyModeCameraPosition.current.copy(position);
        // orbitControlsTargets.current.copy(controlsRef.current.target);
        // // Optionally, you can save this state to a database or local storage.
        // console.log('Camera position stored:', position);
        };

      // enablefycontrols
    const enablefycontrols=()=>{
    
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousemove', handleMouseMove);
        
        // document.addEventListener('wheel', handleWheel);
    }
    // disableflycontrols
    const disableflycontrols=()=>{
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('mousemove', handleMouseMove);    
        // document.removeEventListener('wheel', handleWheel);
    }
  
    
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

export default FinalLargeScene
