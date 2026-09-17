import * as THREE from 'three';
import { makeLandmarks } from './landmarks.js';
import { makeSurfaceTexture } from './surface-view.js';
import { batchMeshes } from './model-utils.js';

function ribbon(world, left, right, material, height = -0.38, depth = 0) {
  const positions = [], indices = [], uvs = [];
  const steps = Math.max(1000, Math.ceil(world.mission.length / 8));
  for (let i = 0; i <= steps; i++) {
    positions.push(...world.frame(i / steps * world.mission.length, left, height).point.toArray());
    positions.push(...world.frame(i / steps * world.mission.length, right, height + depth).point.toArray());
    uvs.push(0, i / steps * world.mission.length / 8, Math.max(1, Math.abs(right - left) / 8), i / steps * world.mission.length / 8);
    if (i < steps) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
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
  if (world.mission.special === 'boost') {
    const energy = new THREE.MeshBasicMaterial({ color: '#63f7c5', side: THREE.DoubleSide });
    const surface = new THREE.MeshBasicMaterial({ color: '#4ed9ae', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    ribbon(world, -16, 16, surface, -0.29).name = 'accelerator-surface';
    for (const side of [-1, 1]) ribbon(world, side * 10, side * 10.45, energy, -0.25);
  }
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
  const signCount = Math.max(50, Math.ceil(world.mission.length / 180));
  for (let i = 0; i < signCount; i++) {
    const distance = (i + 0.3) / signCount * world.mission.length;
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
  if (biome === 'earth') {
    makeEarthForest(world, random);
    makeLandmarks(world, random);
    return;
  }
  let geometry;
  if (['crystal', 'ice', 'spires', 'storm', 'aurora', 'prism'].includes(biome)) geometry = new THREE.ConeGeometry(1, 1, biome === 'ice' ? 4 : 6);
  else if (['mesa', 'sandstone', 'volcanic', 'geyser'].includes(biome)) geometry = new THREE.CylinderGeometry(0.7, 1, 1, biome === 'mesa' ? 6 : 8);
  else if (['salt', 'industrial', 'ruins', 'solar', 'observatory'].includes(biome)) geometry = new THREE.BoxGeometry(1, 1, 1);
  else if (biome === 'dunes') geometry = new THREE.SphereGeometry(1, 12, 6);
  else geometry = new THREE.IcosahedronGeometry(1, biome === 'forest' ? 1 : 0);
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(ground, world.mission.saturation, ['ice', 'salt', 'aurora'].includes(biome) ? 0.72 : 0.34), roughness: biome === 'ice' ? 0.2 : 0.85, metalness: biome === 'crystal' ? 0.45 : 0.1, flatShading: true,
    emissive: color, emissiveIntensity: ['crystal', 'storm', 'volcanic'].includes(biome) ? 0.12 : 0 });
  const count = Math.max(90, Math.ceil(world.mission.length / 100));
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
  if (['ocean', 'coral', 'volcanic', 'wasteland'].includes(biome)) {
    const lava = ['volcanic', 'wasteland'].includes(biome);
    const bounds = world.routeBounds.getSize(new THREE.Vector3());
    const center = world.routeBounds.getCenter(new THREE.Vector3());
    const sea = world.mesh(new THREE.PlaneGeometry(bounds.x + 1000, bounds.z + 1000), new THREE.MeshStandardMaterial({ color: lava ? '#c4370d' : '#126e89', metalness: 0.55, roughness: 0.3, emissive: lava ? '#ff470d' : '#052d48', emissiveIntensity: lava ? 1.5 : 0.25 }), world.scene, [center.x, 5, center.z]);
    sea.rotation.x = -Math.PI / 2;
  }
}

function makeEarthForest(world, random) {
  const count = Math.ceil(world.mission.length / 55);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.9, 10, 6).translate(0, 5, 0), new THREE.MeshStandardMaterial({ color: '#725239', roughness: 1 }), count);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1).scale(5, 6, 5).translate(0, 11, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }), count);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0).scale(0.9, 0.4, 0.9), new THREE.MeshStandardMaterial({ color: '#fff0b7', roughness: 0.9 }), count * 3);
  const transform = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const p = world.frame((i + 0.4) / count * world.mission.length, (i % 2 ? -1 : 1) * (40 + random() * 160)).point;
    const ground = world.groundInfo(p.x, p.z), size = 1 + random() * 1.3;
    transform.position.set(p.x, ground.y, p.z);
    transform.scale.setScalar(ground.distance > size * 6 + 23 ? size : 0);
    transform.rotation.set(0, random() * Math.PI * 2, 0); transform.updateMatrix();
    for (const mesh of [trunk, leaves]) mesh.setMatrixAt(i, transform.matrix);
    leaves.setColorAt(i, tint.setHSL(0.25 + random() * 0.09, 0.45 + random() * 0.2, 0.24 + random() * 0.15));
    for (let j = 0; j < 3; j++) {
      const point = world.frame((i + (j + 0.3) / 3) / count * world.mission.length, (i % 2 ? -1 : 1) * (22 + random() * 12)).point;
      const soil = world.groundInfo(point.x, point.z);
      transform.position.set(point.x, soil.y + 0.35, point.z);
      transform.scale.setScalar(soil.distance > 20 ? 1 : 0); transform.updateMatrix();
      flowers.setMatrixAt(i * 3 + j, transform.matrix);
    }
  }
  for (const mesh of [trunk, leaves, flowers]) {
    mesh.name = mesh === flowers ? 'earth-wildflowers' : 'earth-forest';
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingSphere(); world.scene.add(mesh);
  }
  leaves.instanceColor.needsUpdate = true;
}
