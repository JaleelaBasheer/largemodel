import * as THREE from 'three';

class Octree {
  constructor(bounds, maxObjects = 8, maxLevels = 8, level = 0) {
    this.bounds = bounds;
    this.maxObjects = maxObjects;
    this.maxLevels = maxLevels;
    this.level = level;
    this.objects = [];
    this.nodes = [];
  }

  split() {
    const subBounds = new THREE.Box3();
    const center = this.bounds.getCenter(new THREE.Vector3());

    for (let i = 0; i < 8; i++) {
      const x = i & 1 ? center.x : this.bounds.min.x;
      const y = i & 2 ? center.y : this.bounds.min.y;
      const z = i & 4 ? center.z : this.bounds.min.z;

      subBounds.set(
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(
          i & 1 ? this.bounds.max.x : center.x,
          i & 2 ? this.bounds.max.y : center.y,
          i & 4 ? this.bounds.max.z : center.z
        )
      );

      this.nodes[i] = new Octree(subBounds, this.maxObjects, this.maxLevels, this.level + 1);
    }
  }

  getIndex(object) {
    const center = object.position;
    const octantIndex = (center.x > this.bounds.getCenter(new THREE.Vector3()).x ? 1 : 0) +
                        (center.y > this.bounds.getCenter(new THREE.Vector3()).y ? 2 : 0) +
                        (center.z > this.bounds.getCenter(new THREE.Vector3()).z ? 4 : 0);
    return octantIndex;
  }

  insert(object) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(object);
      this.nodes[index].insert(object);
      return;
    }

    this.objects.push(object);

    if (this.objects.length > this.maxObjects && this.level < this.maxLevels) {
      if (this.nodes.length === 0) {
        this.split();
      }

      for (let i = this.objects.length - 1; i >= 0; i--) {
        const index = this.getIndex(this.objects[i]);
        this.nodes[index].insert(this.objects[i]);
        this.objects.splice(i, 1);
      }
    }
  }

  remove(object) {
    if (this.nodes.length > 0) {
      const index = this.getIndex(object);
      return this.nodes[index].remove(object);
    }

    const index = this.objects.indexOf(object);
    if (index !== -1) {
      this.objects.splice(index, 1);
      return true;
    }
    return false;
  }

  update(object) {
    this.remove(object);
    this.insert(object);
  }

  getObjectsInFrustum(frustum) {
    let objects = [];

    if (!frustum.intersectsBox(this.bounds)) {
      return objects;
    }

    if (this.nodes.length > 0) {
      for (let i = 0; i < 8; i++) {
        objects = objects.concat(this.nodes[i].getObjectsInFrustum(frustum));
      }
    } else {
      for (let i = 0; i < this.objects.length; i++) {
        if (frustum.intersectsSphere(this.objects[i].boundingSphere)) {
          objects.push(this.objects[i]);
        }
      }
    }

    return objects;
  }
}

export { Octree };