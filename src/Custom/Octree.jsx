import * as THREE from 'three';

class Octree {
    constructor(center, size, depth = 0, maxDepth = 8, maxObjectsPerNode = 10) {
        this.center = center;
        this.size = size;
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.maxObjectsPerNode = maxObjectsPerNode;
        this.objects = [];
        this.children = null;

        // Create the bounding box for this node
        const halfSize = size / 2;
        this.box = new THREE.Box3(
            new THREE.Vector3(center.x - halfSize, center.y - halfSize, center.z - halfSize),
            new THREE.Vector3(center.x + halfSize, center.y + halfSize, center.z + halfSize)
        );
    }

    insert(object) {
        if (this.children !== null) {
            const octant = this.getOctant(object);
            if (octant !== -1) {
                this.children[octant].insert(object);
                return;
            }
        }

        this.objects.push(object);

        if (this.objects.length > this.maxObjectsPerNode && this.depth < this.maxDepth) {
            this.split();
        }
    }

    split() {
        this.children = [];
        for (let i = 0; i < 8; i++) {
            const newSize = this.size / 2;
            const newCenter = new THREE.Vector3(
                this.center.x + ((i & 1) ? newSize : -newSize) / 2,
                this.center.y + ((i & 2) ? newSize : -newSize) / 2,
                this.center.z + ((i & 4) ? newSize : -newSize) / 2
            );
            this.children.push(new Octree(newCenter, newSize, this.depth + 1, this.maxDepth, this.maxObjectsPerNode));
        }

        for (let i = this.objects.length - 1; i >= 0; i--) {
            const object = this.objects[i];
            const octant = this.getOctant(object);
            if (octant !== -1) {
                this.children[octant].insert(object);
                this.objects.splice(i, 1);
            }
        }
    }

    getOctant(object) {
        const center = new THREE.Vector3();
        object.getWorldPosition(center);
        let octant = 0;
        if (center.x >= this.center.x) octant |= 1;
        if (center.y >= this.center.y) octant |= 2;
        if (center.z >= this.center.z) octant |= 4;
        return octant;
    }

    queryFrustum(frustum) {
        const result = [];

        if (!frustum.intersectsBox(this.box)) {
            return result;
        }

        for (const object of this.objects) {
            if (frustum.intersectsObject(object)) {
                result.push(object);
            }
        }

        if (this.children) {
            for (const child of this.children) {
                result.push(...child.queryFrustum(frustum));
            }
        }

        return result;
    }
}

export { Octree };