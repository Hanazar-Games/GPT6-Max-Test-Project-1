import * as THREE from 'three';

export function makeLandmarks(world, random) {
  const { biome, color } = world.mission;
  if (!['aurora', 'dunes', 'fungal', 'coral', 'salt', 'ruins', 'magnetic', 'industrial', 'prism', 'stargate', 'forest'].includes(biome)) return;
  const model = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: biome === 'industrial' ? 0.75 : 0.15, flatShading: true });
  const dark = world.materials.dark;
  const light = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.35 });
  const add = (geometry, material, x, y, z) => world.mesh(geometry, material, model, [x, y, z]);
  const box = (size, material, x, y, z) => add(new THREE.BoxGeometry(...size), material, x, y, z);
  const ring = (radius, tube, material, y, arc = Math.PI * 2) => add(new THREE.TorusGeometry(radius, tube, 6, 40, arc), material, 0, y, 0);
  if (biome === 'fungal' || biome === 'forest') {
    add(new THREE.CylinderGeometry(2.6, 4, 36, 7), stone, 0, 18, 0);
    if (biome === 'fungal') {
      const cap = add(new THREE.SphereGeometry(19, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), light, 0, 32, 0);
      cap.scale.y = 0.5;
      ring(17, 0.65, light, 32).rotation.x = Math.PI / 2;
    } else for (let i = 0; i < 3; i++) add(new THREE.ConeGeometry(18 - i * 3, 22, 7), stone, 0, 28 + i * 10, 0);
  } else if (biome === 'ruins' || biome === 'dunes') {
    for (const x of [-20, 20]) box([6, 22, 7], stone, x, 11, 0);
    ring(20, 3.4, stone, 22, Math.PI);
    if (biome === 'ruins') {
      box([48, 3, 10], dark, 0, 1.5, 0);
      ring(10, 0.5, light, 24);
    }
  } else if (biome === 'coral') {
    add(new THREE.CylinderGeometry(2, 4, 28, 6), stone, 0, 14, 0);
    for (const side of [-1, 0, 1]) {
      const branch = add(new THREE.CylinderGeometry(1.5, 2.8, 24, 6), stone, side * 7, 27, 0);
      branch.rotation.z = side * -0.65;
      add(new THREE.IcosahedronGeometry(7, 1), light, side * 14, side ? 36 : 42, 0).scale.set(1.2, 0.7, 0.9);
    }
  } else if (biome === 'salt') {
    for (let i = 0; i < 5; i++) box([30 - i * 4, 9, 26 - i * 3], stone, i % 2 * 2, 4.5 + i * 9, 0);
    box([2, 44, 2], light, -9, 22, -8);
  } else if (biome === 'industrial') {
    box([9, 50, 9], dark, 0, 25, 0);
    for (let i = 0; i < 5; i++) box([23, 2.5, 17], stone, 0, 8 + i * 8, 0);
    add(new THREE.CylinderGeometry(0.8, 1.4, 18, 6), stone, 0, 56, 0);
    add(new THREE.SphereGeometry(2.5, 10, 8), light, 0, 66, 0);
  } else if (biome === 'magnetic') {
    add(new THREE.OctahedronGeometry(13), stone, 0, 48, 0).rotation.z = 0.4;
    for (let i = 0; i < 3; i++) { const mesh = ring(20 - i * 3, 0.5, light, 28 + i * 14); mesh.rotation.set(1.1, i * 0.6, i * 0.3); }
    box([20, 4, 20], dark, 0, 2, 0);
  } else if (biome === 'stargate') {
    box([28, 8, 18], dark, 0, 4, 0);
    ring(25, 2.2, stone, 34);
    ring(22, 0.7, light, 34);
    ring(17, 0.4, light, 34).rotation.y = 0.8;
  } else {
    for (let i = -1; i <= 1; i++) {
      const material = biome === 'prism' ? new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((i + 1) / 3 + 0.12, 0.65, 0.66), metalness: 0.55, roughness: 0.15 }) : light;
      const shard = add(new THREE.OctahedronGeometry(1), material, i * 12, 24 - Math.abs(i) * 5, 0);
      shard.scale.set(8, 28 - Math.abs(i) * 6, 8);
      shard.rotation.z = i * -0.3;
    }
  }
  model.updateMatrixWorld(true);
  const placements = [];
  const transform = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const position = world.frame((i + 0.3) / 48 * world.mission.length, (i % 2 ? -1 : 1) * (64 + random() * 40)).point;
    const ground = world.groundInfo(position.x, position.z);
    if (ground.distance < 58) continue;
    transform.position.set(position.x, ground.y - 1, position.z);
    transform.rotation.set(0, random() * Math.PI * 2, 0);
    transform.scale.setScalar(0.85 + random() * 0.25);
    transform.updateMatrix();
    placements.push(transform.matrix.clone());
  }
  const matrix = new THREE.Matrix4();
  for (const part of model.children) {
    const instances = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    instances.name = `landmark-${biome}`;
    placements.forEach((placement, i) => instances.setMatrixAt(i, matrix.multiplyMatrices(placement, part.matrixWorld)));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = true;
    world.scene.add(instances);
  }
  for (const material of [stone, light]) if (!model.children.some(part => part.material === material)) material.dispose();
  if (biome === 'aurora') makeAurora(world);
}

function makeAurora(world) {
  const origin = world.frame(0);
  for (let band = 0; band < 3; band++) {
    const vertices = [], colors = [], indices = [];
    const tint = new THREE.Color(band === 1 ? '#bc92ff' : '#69ffc6');
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const base = origin.point.clone().addScaledVector(origin.tangent, 800 + band * 220 + Math.sin(t * 9) * 180).addScaledVector(origin.right, (t - 0.5) * 2400);
      base.y += 380 + Math.sin(t * 12 + band) * 90;
      for (const edge of [0, 1]) {
        vertices.push(base.x, base.y + edge * 220, base.z);
        tint.clone().multiplyScalar(edge ? 0 : Math.sin(t * Math.PI) * 0.8).toArray(colors, colors.length);
      }
      if (i < 64) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    world.mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }), world.scene);
  }
}
