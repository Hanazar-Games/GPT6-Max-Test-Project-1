import * as THREE from 'three';

// Only call before creating animated objects and mutable instance buffers.
export function partitionLandscape(scene, retainedGeometry) {
  const cell = (x, z) => `${Math.floor(x / 1200)},${Math.floor(z / 1200)}`;
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), color = new THREE.Color();
  for (const source of [...scene.children]) {
    if (!source.isMesh || Array.isArray(source.material)) continue;
    const instanced = source.isInstancedMesh;
    if (instanced ? source.count < 32 : source.geometry.attributes.position.count < 10000) continue;
    const groups = new Map();
    const add = (key, index) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    };
    const geometry = source.geometry, positions = geometry.attributes.position;
    if (instanced) {
      for (let i = 0; i < source.count; i++) {
        source.getMatrixAt(i, matrix);
        add(cell(matrix.elements[12], matrix.elements[14]), i);
      }
    } else {
      const count = geometry.index?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const indices = [0, 1, 2].map(offset => geometry.index ? geometry.index.getX(i + offset) : i + offset);
        const x = indices.reduce((sum, index) => sum + positions.getX(index), 0) / 3;
        const z = indices.reduce((sum, index) => sum + positions.getZ(index), 0) / 3;
        for (const index of indices) add(cell(x, z), index);
      }
    }
    if (groups.size < 2) continue;
    for (const indices of groups.values()) {
      let mesh;
      if (instanced) {
        mesh = new THREE.InstancedMesh(geometry, source.material, indices.length);
        indices.forEach((original, index) => {
          source.getMatrixAt(original, matrix); mesh.setMatrixAt(index, matrix);
          if (source.instanceColor) { source.getColorAt(original, color); mesh.setColorAt(index, color); }
        });
        mesh.computeBoundingSphere();
      } else {
        const tile = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(geometry.attributes)) tile.setAttribute(name, attribute);
        tile.setIndex(indices);
        tile.boundingBox = new THREE.Box3();
        for (const index of indices) tile.boundingBox.expandByPoint(point.fromBufferAttribute(positions, index));
        tile.boundingSphere = tile.boundingBox.getBoundingSphere(new THREE.Sphere());
        mesh = new THREE.Mesh(tile, source.material);
      }
      mesh.name = source.name;
      mesh.position.copy(source.position); mesh.quaternion.copy(source.quaternion); mesh.scale.copy(source.scale);
      mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
      mesh.renderOrder = source.renderOrder;
      scene.add(mesh);
    }
    scene.remove(source);
    if (instanced) source.dispose();
    else if (geometry !== retainedGeometry) geometry.dispose();
  }
}
