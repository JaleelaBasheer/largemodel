import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class CustomOrbitControls extends OrbitControls {
    constructor(object, domElement) {
        super(object, domElement);

        this.autoRotateSpeedX = 0.01; // Default rotation speed around X-axis
        this.autoRotateSpeedY = 0.01; // Default rotation speed around Y-axis
        this.autoRotateEnabled = true; // Enable or disable automatic rotation

        // Start the animation loop
        this.animate();
    }

    // Custom animation loop
    animate = () => {
        if (this.autoRotateEnabled) {
            this.object.rotation.x += this.autoRotateSpeedX;
            this.object.rotation.y += this.autoRotateSpeedY;
        }

        // Update the controls (for damping and user interactions)
        this.update();

        // Request the next frame for continuous animation
        requestAnimationFrame(this.animate);
    };

    // Method to enable or disable automatic rotation
    setAutoRotate(enabled) {
        this.autoRotateEnabled = enabled;
    }

    // Method to set custom rotation speed
    setAutoRotateSpeed(speedX, speedY) {
        this.autoRotateSpeedX = speedX;
        this.autoRotateSpeedY = speedY;
    }
}

export default CustomOrbitControls;
