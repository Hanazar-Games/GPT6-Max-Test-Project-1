import * as THREE from 'three';
import { makeLandmarks } from './landmarks.js';
import { makeSurfaceTexture } from './surface-view.js';
import { batchMeshes } from './model-utils.js';

function ribbon(world, left, right, material, height = -0.38, depth = 0) {
  const positions = [], indices = [], uvs = [];
  for (let i = 0; i <= 1000; i++) {
    positions.push(...world.frame(i / 1000 * world.mission.length, left, height).point.toArray());
    positions.push(...world.frame(i / 1000 * world.mission.length, right, height + depth).point.toArray());
    uvs.push(0, i / 1000 * world.mission.length / 8, Math.max(1, Math.abs(right - left) / 8), i / 1000 * world.mission.length / 8);
    if (i < 1000) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = world.mesh(geometry, material, world.scene);
  mesh.receiveShadow = true;
  return mesh;
}

export function makeMountainRoad(world) {
  const asphalt = new THREE.MeshStandardMaterial({ color: '#27313c', map: makeSurfaceTexture(), roughness: 0.93, metalness: 0.1, side: THREE.DoubleSide });
  const edge = new THREE.MeshStandardMaterial({ color: world.mission.color, emissive: world.mission.color, emissiveIntensity: 0.4, side: THREE.DoubleSide });
  const rail = new THREE.MeshStandardMaterial({ color: '#728797', roughness: 0.55, metalness: 0.7, side: THREE.DoubleSide });
  ribbon(world, -17, 17, asphalt);
  for (const side of [-1, 1]) {
    ribbon(world, side * 17, side * 17, asphalt, -0.38, -4);
    ribbon(world, side * 12.8, side * 12.8, rail, -1.2, -2.4);
    ribbon(world, side * 16.6, side * 17, edge, -0.28);
    ribbon(world, side * 18.2, side * 18.2, rail, 0.65, 0.5);
    ribbon(world, side * 18.2, side * 18.2, edge, 1.16, 0.08);
  }
  const count = Math.ceil(world.mission.length / 14);
  const markers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.08, 3), new THREE.MeshBasicMaterial({ color: '#bed3dc' }), count);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.6, 0.2), rail, count * 2);
  const curbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.65, 0.12, 4), new THREE.MeshStandardMaterial({ color: '#a5b3b8', roughness: 0.8 }), count * 2);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const distance = i / count * world.mission.length;
    for (const side of [-1, 0, 1]) {
      const frame = world.frame(distance, side * 18.2, side ? 0.35 : -0.25);
      dummy.position.copy(frame.point);
      world.orient(dummy, frame);
      dummy.updateMatrix();
      if (!side) markers.setMatrixAt(i, dummy.matrix);
      else {
        const index = i * 2 + (side > 0 ? 1 : 0);
        posts.setMatrixAt(index, dummy.matrix);
        dummy.position.copy(world.frame(distance, side * 16.1, -0.24).point);
        dummy.updateMatrix();
        curbs.setMatrixAt(index, dummy.matrix);
      }
    }
  }
  world.scene.add(markers, posts, curbs);
  const pierCount = Math.ceil(world.mission.length / 65);
  const piers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), rail, pierCount * 2);
  piers.name = 'road-piers';
  for (let i = 0; i < pierCount; i++) for (const side of [-1, 1]) {
    const frame = world.frame(i / pierCount * world.mission.length, side * 12.8, -2.4);
    const ground = world.groundInfo(frame.point.x, frame.point.z).y;
    const height = Math.max(0.1, frame.point.y - ground);
    dummy.position.set(frame.point.x, ground + height / 2, frame.point.z);
    dummy.rotation.set(0, Math.atan2(frame.tangent.x, frame.tangent.z), 0);
    dummy.scale.set(1.3, height, 2.8);
    dummy.updateMatrix();
    piers.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), dummy.matrix);
  }
  world.scene.add(piers);
  const signMaterial = new THREE.MeshBasicMaterial({ color: world.mission.color });
  const signs = new THREE.Group();
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
    const placement = world.frame(distance, Math.sign(frame.bank) * 21);
    sign.position.copy(placement.point);
    world.orient(sign, placement);
    sign.updateMatrix();
    for (const part of [...sign.children]) {
      part.applyMatrix4(sign.matrix);
      signs.add(part);
    }
  }
  if (signs.children.length) world.scene.add(batchMeshes(signs));
  else signMaterial.dispose();
}

export function makePlanetScenery(world, random) {
  const { biome, color, ground } = world.mission;
  let geometry;
  if (['crystal', 'ice', 'spires', 'storm', 'aurora', 'prism'].includes(biome)) geometry = new THREE.ConeGeometry(1, 1, biome === 'ice' ? 4 : 6);
  else if (['mesa', 'sandstone', 'volcanic'].includes(biome)) geometry = new THREE.CylinderGeometry(0.7, 1, 1, biome === 'mesa' ? 6 : 8);
  else if (['salt', 'industrial', 'ruins'].includes(biome)) geometry = new THREE.BoxGeometry(1, 1, 1);
  else if (biome === 'dunes') geometry = new THREE.SphereGeometry(1, 12, 6);
  else geometry = new THREE.IcosahedronGeometry(1, biome === 'forest' ? 1 : 0);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(ground, world.mission.saturation, ['ice', 'salt', 'aurora'].includes(biome) ? 0.72 : 0.34), roughness: biome === 'ice' ? 0.2 : 0.85, metalness: biome === 'crystal' ? 0.45 : 0.1, flatShading: true,
    emissive: color, emissiveIntensity: ['crystal', 'storm', 'volcanic'].includes(biome) ? 0.12 : 0 });
  const count = 90;
  const props = new THREE.InstancedMesh(geometry, material, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const position = world.frame(random() * world.mission.length, (random() < 0.5 ? -1 : 1) * (150 + random() * 220)).point;
    const info = world.groundInfo(position.x, position.z);
    const height = 12 + random() * 40;
    const radius = 4 + random() * (['mesa', 'sandstone', 'ridge'].includes(biome) ? 28 : 10);
    dummy.position.set(position.x, info.y + height * (biome === 'dunes' ? 0.06 : 0.42), position.z);
    dummy.scale.set(radius, biome === 'dunes' ? height * 0.2 : height, radius);
    if (info.distance < radius + 32) dummy.scale.setScalar(0);
    dummy.rotation.set(0, random() * Math.PI * 2, (random() - 0.5) * 0.15);
    dummy.updateMatrix();
    props.setMatrixAt(i, dummy.matrix);
  }
  props.castShadow = true;
  world.scene.add(props);
  makeLandmarks(world, random);
  if (['ocean', 'coral', 'volcanic'].includes(biome)) {
    const bounds = world.routeBounds.getSize(new THREE.Vector3());
    const center = world.routeBounds.getCenter(new THREE.Vector3());
    const sea = world.mesh(new THREE.PlaneGeometry(bounds.x + 1000, bounds.z + 1000), new THREE.MeshStandardMaterial({ color: biome === 'volcanic' ? '#c4370d' : '#126e89', metalness: 0.55, roughness: 0.3, emissive: biome === 'volcanic' ? '#ff470d' : '#052d48', emissiveIntensity: biome === 'volcanic' ? 1.5 : 0.25 }), world.scene, [center.x, 5, center.z]);
    sea.rotation.x = -Math.PI / 2;
  }
}
