import * as THREE from 'three';

function ribbon(world, left, right, material, height = -0.38, depth = 0) {
  const positions = [], indices = [];
  for (let i = 0; i <= 1000; i++) {
    positions.push(...world.frame(i / 1000 * world.mission.length, left, height).point.toArray());
    positions.push(...world.frame(i / 1000 * world.mission.length, right, height + depth).point.toArray());
    if (i < 1000) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = world.mesh(geometry, material, world.scene);
  mesh.receiveShadow = true;
  return mesh;
}

export function makeMountainRoad(world) {
  const asphalt = new THREE.MeshStandardMaterial({ color: '#27313c', roughness: 0.93, metalness: 0.1, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: world.mission.color, emissive: world.mission.color, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const rail = new THREE.MeshStandardMaterial({ color: '#728797', roughness: 0.55, metalness: 0.7, side: THREE.DoubleSide });
  ribbon(world, -17, 17, asphalt);
  for (const side of [-1, 1]) {
    ribbon(world, side * 17, side * 17, asphalt, -0.38, -4);
    ribbon(world, side * 16.6, side * 17, edge, -0.28);
    ribbon(world, side * 18.2, side * 18.2, rail, 0.65, 0.5);
    ribbon(world, side * 18.2, side * 18.2, edge, 1.16, 0.08);
  }
  const count = Math.ceil(world.mission.length / 14);
  const markers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.08, 3), new THREE.MeshBasicMaterial({ color: '#bed3dc' }), count);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), rail, count * 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const distance = i / count * world.mission.length;
    for (const side of [-1, 0, 1]) {
      const frame = world.frame(distance, side * 18.2, side ? 0.35 : -0.25);
      dummy.position.copy(frame.point);
      world.orient(dummy, frame);
      dummy.updateMatrix();
      if (!side) markers.setMatrixAt(i, dummy.matrix);
      else posts.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
    }
  }
  world.scene.add(markers, posts);
  const signMaterial = new THREE.MeshBasicMaterial({ color: world.mission.color });
  for (let i = 0; i < 50; i++) {
    const distance = (i + 0.3) / 50 * world.mission.length;
    const frame = world.frame(distance);
    if (Math.abs(frame.bank) < 0.07) continue;
    const sign = new THREE.Group();
    world.box([0.2, 4, 0.2], rail, sign, [0, 1.3, 0]);
    world.box([2.5, 1.3, 0.16], world.materials.dark, sign, [0, 3, 0]);
    for (const side of [-1, 1]) {
      const bar = world.box([0.22, 0.75, 0.22], signMaterial, sign, [0, 3 + side * 0.23, -0.14]);
      bar.rotation.z = side * Math.sign(frame.bank) * 0.7;
    }
    world.place(sign, distance, Math.sign(frame.bank) * 21);
  }
}

export function makePlanetScenery(world, random) {
  const { biome, color, ground } = world.mission;
  let geometry;
  if (['crystal', 'ice', 'spires', 'storm'].includes(biome)) geometry = new THREE.ConeGeometry(1, 1, biome === 'ice' ? 4 : 6);
  else if (['mesa', 'sandstone', 'volcanic'].includes(biome)) geometry = new THREE.CylinderGeometry(0.7, 1, 1, biome === 'mesa' ? 6 : 8);
  else geometry = new THREE.IcosahedronGeometry(1, biome === 'forest' ? 1 : 0);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(ground, 0.42, biome === 'ice' ? 0.72 : 0.34), roughness: biome === 'ice' ? 0.2 : 0.85, metalness: biome === 'crystal' ? 0.45 : 0.1, flatShading: true,
    emissive: color, emissiveIntensity: ['crystal', 'storm', 'volcanic'].includes(biome) ? 0.12 : 0 });
  const props = new THREE.InstancedMesh(geometry, material, 180);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 180; i++) {
    const position = world.frame(random() * world.mission.length, (random() < 0.5 ? -1 : 1) * (65 + random() * 220)).point;
    const info = world.groundInfo(position.x, position.z);
    const height = 12 + random() * (biome === 'forest' ? 48 : 80);
    const radius = 4 + random() * (['mesa', 'sandstone', 'ridge'].includes(biome) ? 28 : 10);
    dummy.position.set(position.x, info.y + height * 0.42, position.z);
    dummy.scale.set(radius, height, radius);
    if (info.distance < radius + 32) dummy.scale.setScalar(0);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.15);
    dummy.updateMatrix();
    props.setMatrixAt(i, dummy.matrix);
  }
  props.castShadow = true;
  world.scene.add(props);
  if (['ocean', 'volcanic'].includes(biome)) {
    const sea = world.mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshStandardMaterial({ color: biome === 'ocean' ? '#126e89' : '#c4370d', metalness: 0.55, roughness: 0.3, emissive: biome === 'ocean' ? '#052d48' : '#ff470d', emissiveIntensity: biome === 'ocean' ? 0.25 : 1.5 }), world.scene, [0, 5, 0]);
    sea.rotation.x = -Math.PI / 2;
  }
}
