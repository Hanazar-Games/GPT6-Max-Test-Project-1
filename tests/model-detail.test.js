import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchMeshes } from '../src/model-utils.js';
import { makeReflectionMap, makeSurfaceTexture, terrainElevation } from '../src/surface-view.js';
import { World } from '../src/world.js';

test('scenery elevation matches both rendered terrain triangles, including map edges', () => {
  const geometry = new THREE.PlaneGeometry(20, 20, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(100, 0, 200);
  [0, 4, 8, 20].forEach((y, i) => geometry.attributes.position.setY(i, y));
  geometry.computeBoundingBox();
  assert.equal(terrainElevation(geometry, 90, 190), 0);
  assert.equal(terrainElevation(geometry, 110, 210), 20);
  assert.equal(terrainElevation(geometry, 95, 195), 3);
  assert.equal(terrainElevation(geometry, 105, 205), 13);
  assert.equal(terrainElevation(geometry, 100, 200), 6);
  assert.equal(terrainElevation(geometry, 80, 200), null);
  geometry.dispose();
});

test('material batching preserves transformed bounds and releases repeated source geometry once', () => {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 2, 3);
  const material = new THREE.MeshStandardMaterial();
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  for (const x of [-3, 3]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, 4, 0);
    mesh.rotation.z = x * 0.1;
    group.add(mesh);
  }
  const before = new THREE.Box3().setFromObject(group);
  batchMeshes(group);
  const after = new THREE.Box3().setFromObject(group);
  assert.equal(group.children.length, 1);
  assert.ok(before.min.distanceTo(after.min) < 1e-6);
  assert.ok(before.max.distanceTo(after.max) < 1e-6);
  assert.equal(disposed, 1);
  assert.equal(group.children[0].material, material);
  group.children[0].geometry.dispose();
  material.dispose();
});

test('procedural surface and reflection textures are finite, repeatable and disposed on map changes', () => {
  const first = makeSurfaceTexture(), second = makeSurfaceTexture();
  assert.deepEqual(first.image.data, second.image.data);
  assert.equal(first.wrapS, THREE.RepeatWrapping);
  const reflection = makeReflectionMap('#72baca');
  assert.equal(reflection.mapping, THREE.EquirectangularReflectionMapping);
  assert.ok(reflection.image.data.every(Number.isFinite));
  const scene = new THREE.Scene();
  scene.environment = reflection;
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial({ map: first });
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const resources = [first, reflection, geometry, material];
  const disposed = resources.map(resource => { const counter = { count: 0 }; resource.addEventListener('dispose', () => counter.count++); return counter; });
  const world = Object.assign(Object.create(World.prototype), { scene, renderer: { renderLists: { dispose() {} } } });
  world.clearScene();
  world.clearScene();
  assert.equal(scene.environment, null);
  assert.ok(disposed.every(counter => counter.count === 1));
  second.dispose();
});
