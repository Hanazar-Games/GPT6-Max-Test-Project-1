import * as THREE from 'three';

// Only call before creating animated objects and mutable instance buffers.
export function partitionLandscape(scene, retainedGeometry, cellSize = 1200) {
  const cell = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), color = new THREE.Color();
  for (const source of [...scene.children]) {
    if (!source.isMesh || Array.isArray(source.material) || source.material.transparent) continue;
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
      const index = geometry.index, count = index?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const a = index ? index.getX(i) : i, b = index ? index.getX(i + 1) : i + 1, c = index ? index.getX(i + 2) : i + 2;
        const key = cell((positions.getX(a) + positions.getX(b) + positions.getX(c)) / 3, (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3);
        const group = groups.get(key);
        if (group) group.push(a, b, c);
        else groups.set(key, [a, b, c]);
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
