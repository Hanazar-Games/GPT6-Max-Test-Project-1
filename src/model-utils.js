import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function foundationLevel(world, point, width, depth, yaw) {
  const cosine = Math.cos(yaw), sine = Math.sin(yaw);
  let ground = Infinity;
  for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) {
    const dx = x * width, dz = z * depth;
    ground = Math.min(ground, world.groundInfo(point.x + dx * cosine + dz * sine, point.z - dx * sine + dz * cosine).y);
  }
  return ground - 2;
}

// Consume an exclusively owned group of static meshes, retaining one mesh per material.
export function batchMeshes(group) {
  const batches = new Map(), sources = new Set();
  for (const part of [...group.children]) {
    part.updateMatrix();
    const geometry = new THREE.BufferGeometry().copy(part.geometry);
    geometry.applyMatrix4(part.matrix);
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
    sources.add(part.geometry);
    group.remove(part);
  }
  for (const [material, geometries] of batches) {
    const merged = geometries.length > 1;
    let indices;
    if (merged && geometries.some(geometry => geometry.index)) {
      const vertices = geometries.reduce((total, geometry) => total + geometry.attributes.position.count, 0);
      const count = geometries.reduce((total, geometry) => total + (geometry.index?.count ?? geometry.attributes.position.count), 0);
      const array = vertices > 65535 ? new Uint32Array(count) : new Uint16Array(count);
      let offset = 0, cursor = 0;
      for (const geometry of geometries) {
        const index = geometry.index, vertices = geometry.attributes.position.count;
        const count = index?.count ?? vertices;
        for (let i = 0; i < count; i++) array[cursor++] = offset + (index ? index.getX(i) : i);
        offset += vertices;
        geometry.setIndex(null);
      }
      indices = new THREE.BufferAttribute(array, 1);
    }
    const geometry = merged ? mergeGeometries(geometries) : geometries[0];
    if (indices) geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    if (merged) geometries.forEach(geometry => geometry.dispose());
  }
  sources.forEach(geometry => geometry.dispose());
  return group;
}
