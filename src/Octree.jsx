import * as THREE from 'three';

export class Octree {
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

    intersectFrustum(frustum) {
        const visibleObjects = [];
        const bbox = new THREE.Box3().setFromCenterAndSize(this.center, new THREE.Vector3(this.size, this.size, this.size));

        if (!frustum.intersectsBox(bbox)) {
            return visibleObjects;
        }

        if (this.children === null) {
            for (let object of this.objects) {
                const objectBBox = new THREE.Box3().setFromObject(object);
                if (frustum.intersectsBox(objectBBox)) {
                    visibleObjects.push(object);
                }
            }
        } else {
            for (let child of this.children) {
                visibleObjects.push(...child.intersectFrustum(frustum));
            }
        }

        return visibleObjects;
    }
}