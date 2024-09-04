import * as THREE from 'three';
import CustomOrbitControls from '../Custom/CustomOrbitControls';
function Cubes() {
    // Set up your scene, camera, and renderer as usual
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a simple object to rotate (e.g., a cube)
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

// Initialize the custom orbit controls
const controls = new CustomOrbitControls(camera, renderer.domElement);

// Optionally adjust auto-rotation speed
controls.setAutoRotateSpeed(0.01, 0.02);

// Rendering loop
const animate = () => {
    requestAnimationFrame(animate);

    // Render the scene
    renderer.render(scene, camera);
};

animate();
  return (
    <div>
      
    </div>
  )
}

export default Cubes



