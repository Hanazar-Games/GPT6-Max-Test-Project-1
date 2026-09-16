import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Consume an exclusively owned group of static meshes, retaining one mesh per material.
export function batchMeshes(group) {
  const batches = new Map(), sources = new Set();
  for (const part of [...group.children]) {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(part.matrix);
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
    sources.add(part.geometry);
    group.remove(part);
  }
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    geometries.forEach(geometry => geometry.dispose());
  }
  sources.forEach(geometry => geometry.dispose());
  return group;
}
