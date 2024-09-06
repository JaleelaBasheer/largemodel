/* eslint-disable no-restricted-globals */
console.log('Web worker initialized');

self.onmessage = function(e) {
    // console.log('Worker received message:', e.data);
    const { action, meshes, frustumPlanes } = e.data;
    
    if (action === 'checkVisibility') {
        // console.log('Checking visibility for', meshes.length, 'meshes');
        const visibleMeshes = meshes.filter(mesh => {
            return isPointInFrustum(mesh.position, frustumPlanes);
        });
        
        const invisibleMeshes = meshes.filter(mesh => !visibleMeshes.includes(mesh));
        
        // console.log('Visible meshes:', visibleMeshes.length);
        // console.log('Invisible meshes:', invisibleMeshes.length);

        self.postMessage({
            visibleMeshes: visibleMeshes.map(mesh => mesh.id),
            invisibleMeshes: invisibleMeshes.map(mesh => mesh.id)
        });
    } else {
        console.error('Unknown action:', action);
    }
};

function isPointInFrustum(point, frustumPlanes) {
    for (let i = 0; i < frustumPlanes.length; i++) {
        const plane = frustumPlanes[i];
        if (plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z + plane.constant < 0) {
            return false;
        }
    }
    return true;
}

console.log('Web worker setup complete');