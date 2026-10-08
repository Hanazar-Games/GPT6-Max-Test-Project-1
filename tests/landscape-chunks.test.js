import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { partitionLandscape } from '../src/landscape-chunks.js';
import { MISSIONS } from '../src/missions.js';
import { createGame } from '../src/game.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { makePlanetScenery } from '../src/planet-view.js';

const triangles = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);

test('banked road strips share material batches while preserving every vertex, face and shadow setting', t => {
  const mission = MISSIONS.find(mission => mission.id === 'marathon');
  const world = Object.assign(Object.create(World.prototype), {
    mission: { ...mission, bridges: [] }, curve: createRoute(mission), scene: new THREE.Scene(),
    materials: { dark: new THREE.MeshStandardMaterial() }, groundInfo: () => ({ y: -2000 }),
    renderer: { renderLists: { dispose() {} } },
  });
  t.after(() => { world.clearScene(); world.materials.dark.dispose(); });
  world.makeTrack();
  const batches = new Map();
  for (const mesh of world.scene.children.filter(mesh => !mesh.isInstancedMesh && mesh.isMesh && !mesh.material.transparent)) {
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh);
  }
  assert.equal(batches.size, 3);
  const expected = new Map();
  const digest = arrays => {
    const hash = createHash('sha256');
    for (const array of arrays) hash.update(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    return hash.digest('hex');
  };
  for (const [material, meshes] of batches) {
    let offset = 0;
    const indices = meshes.flatMap(mesh => {
      const indices = Array.from(mesh.geometry.index.array, index => index + offset);
      offset += mesh.geometry.attributes.position.count;
      return indices;
    });
    expected.set(material, {
      attributes: Object.fromEntries(['position', 'normal', 'uv'].map(name => [name, digest(meshes.map(mesh => mesh.geometry.attributes[name].array))])),
      faces: Array.from({ length: indices.length / 3 }, (_, i) => indices.slice(i * 3, i * 3 + 3).join(',')).sort(),
    });
  }
  partitionLandscape(world.scene);
  const surfaces = world.scene.children.filter(mesh => !mesh.isInstancedMesh && mesh.isMesh && !mesh.material.transparent);
  assert.equal(new Set(surfaces.map(mesh => mesh.geometry.attributes.position)).size, 3, 'road strips need one shared vertex buffer per material');
  for (const [material, source] of expected) {
    const chunks = surfaces.filter(mesh => mesh.material === material);
    for (const mesh of chunks) {
      assert.ok(mesh.receiveShadow && !mesh.castShadow);
      for (const name of ['position', 'normal', 'uv']) assert.equal(digest([mesh.geometry.attributes[name].array]), source.attributes[name]);
    }
    const faces = chunks.flatMap(mesh => Array.from({ length: mesh.geometry.index.count / 3 }, (_, i) => Array.from(mesh.geometry.index.array.slice(i * 3, i * 3 + 3)).join(','))).sort();
    assert.deepEqual(faces, source.faces);
  }
});

for (const indexed of [true, false]) test(`${indexed ? 'indexed' : 'non-indexed'} landscape tiles preserve geometry, transforms and instance colors with local bounds`, () => {
  const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial();
  let terrain = new THREE.PlaneGeometry(12000, 12000, 120, 120).rotateX(-Math.PI / 2);
  if (!indexed) { const source = terrain; terrain = source.toNonIndexed(); source.dispose(); }
  const surface = new THREE.Mesh(terrain, material);
  surface.position.y = 37;
  scene.add(surface);
  const fleet = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 100);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  for (let i = 0; i < fleet.count; i++) {
    fleet.setMatrixAt(i, matrix.makeTranslation(i * 100, 10, 0));
    fleet.setColorAt(i, color.setHSL(i / 100, .5, .5));
  }
  scene.add(fleet);
  const count = scene.children.reduce((sum, mesh) => sum + triangles(mesh), 0);
  partitionLandscape(scene, terrain);
  assert.equal(scene.children.reduce((sum, mesh) => sum + triangles(mesh), 0), count);
  let instances = 0;
  for (const mesh of scene.children) {
    assert.ok(mesh.geometry === fleet.geometry || mesh.geometry.boundingSphere.radius < 1000);
    if (!mesh.isInstancedMesh) {
      assert.equal(mesh.position.y, 37);
      for (const attribute of ['position', 'normal', 'uv']) assert.equal(mesh.geometry.attributes[attribute], terrain.attributes[attribute]);
    } else for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const original = matrix.elements[12] / 100;
      mesh.getColorAt(i, color);
      const expected = new THREE.Color(); fleet.getColorAt(original, expected);
      assert.equal(color.getHex(), expected.getHex());
      instances++;
    }
  }
  assert.equal(instances, 100);
  const faces = geometry => Array.from({ length: (geometry.index?.count ?? geometry.attributes.position.count) / 3 }, (_, i) => [0, 1, 2].map(offset => geometry.index ? geometry.index.getX(i * 3 + offset) : i * 3 + offset).join(',')).sort();
  assert.deepEqual(scene.children.filter(mesh => !mesh.isInstancedMesh).flatMap(mesh => faces(mesh.geometry)).sort(), faces(terrain));
});

test('transparent road surfaces retain their original geometry and drawing order', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(12000, 12000, 120, 120);
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: .12, depthWrite: false });
  const surface = new THREE.Mesh(geometry, material);
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 3;
  scene.add(surface);
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  partitionLandscape(scene);
  assert.equal(scene.children.length, 1);
  assert.equal(scene.children[0], surface);
  assert.equal(surface.geometry, geometry);
  assert.equal(surface.renderOrder, 3);
  assert.equal(disposed, 0);
  geometry.dispose(); material.dispose();
});

test('the largest mountain route renders nearby tiles with a bounded visible triangle count and frees all resources', () => {
  const mission = MISSIONS.find(mission => mission.id === 'summit'), game = createGame(mission.id);
  const world = Object.assign(Object.create(World.prototype), {
    mission, course: game.course, curve: createRoute(mission), scene: new THREE.Scene(), drones: [],
    materials: { dark: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), glow: new THREE.MeshBasicMaterial(), cyan: new THREE.MeshBasicMaterial() },
    renderer: { renderLists: { dispose() {} } },
  });
  world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
  world.makeTerrain(); world.makeTrack(); world.makeRocks();
  let seed = 53;
  makePlanetScenery(world, () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const total = world.scene.children.filter(mesh => mesh.isMesh).reduce((sum, mesh) => sum + triangles(mesh), 0);
  partitionLandscape(world.scene, world.terrainGeometry);
  world.scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(90, 1.6, .2, 4000);
  for (const distance of [0, 30000, 120000, 210000]) {
    const frame = world.frame(distance);
    camera.position.copy(frame.point).addScaledVector(frame.tangent, -25).addScaledVector(frame.up, 12);
    camera.lookAt(frame.point.clone().addScaledVector(frame.tangent, 100));
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const visible = world.scene.children.filter(mesh => mesh.isMesh && frustum.intersectsObject(mesh)).reduce((sum, mesh) => sum + triangles(mesh), 0);
    assert.ok(visible < total * .25 && visible < 800000, `visible ${visible} / total ${total} at ${distance}`);
  }
  const resources = new Set([world.terrainGeometry]);
  world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) resources.add(mesh.material); });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  world.clearScene();
  assert.ok([...disposed.values()].every(count => count === 1));
});
