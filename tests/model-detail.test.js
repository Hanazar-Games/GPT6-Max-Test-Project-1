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

test('mixed model batches retain indexed vertex savings and every triangle attribute', () => {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2, .25, 8, 24), material);
  ring.position.set(3, 2, -1); ring.rotation.set(.2, .4, -.3); ring.scale.set(2, .8, 1);
  const box = new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(), material);
  group.add(ring, box);
  for (const mesh of group.children) mesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(
    Array.from({ length: mesh.geometry.attributes.position.count * 3 }, (_, i) => i % 13 / 13), 3));
  const expected = new Map();
  for (const mesh of group.children) {
    mesh.updateMatrix();
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      if (!expected.has(name)) expected.set(name, []);
      expected.get(name).push(...attribute.array);
    }
    geometry.dispose();
  }
  batchMeshes(group);
  const geometry = group.children[0].geometry;
  const bytes = Object.values(geometry.attributes).reduce((total, attribute) => total + attribute.array.byteLength, geometry.index?.array.byteLength ?? 0);
  const expandedBytes = [...expected.values()].reduce((total, values) => total + values.length * 4, 0);
  assert.ok(bytes < expandedBytes / 2, 'batching must not expand reusable ring vertices');
  const expanded = geometry.toNonIndexed();
  for (const [name, values] of expected) assert.deepEqual([...expanded.attributes[name].array], values, `${name}: triangle data changed`);
  expanded.dispose(); geometry.dispose(); material.dispose();
});

test('large model batches retain valid indices beyond the 16-bit vertex limit', () => {
  const group = new THREE.Group(), material = new THREE.MeshBasicMaterial();
  const geometry = new THREE.PlaneGeometry(1, 1, 181, 181);
  group.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  const vertices = geometry.attributes.position.count, last = geometry.index.getX(geometry.index.count - 1);
  batchMeshes(group);
  const merged = group.children[0].geometry;
  assert.ok(merged.index?.array instanceof Uint32Array);
  assert.equal(merged.attributes.position.count, vertices * 2);
  assert.equal(merged.index.getX(merged.index.count - 1), vertices + last);
  merged.dispose(); material.dispose();
});

test('batching copies generated geometry without rerunning its procedural constructor', () => {
  let builds = 0;
  class GeneratedGeometry extends THREE.BufferGeometry {
    constructor() {
      super();
      builds++;
      this.copy(new THREE.BoxGeometry().toNonIndexed());
    }
  }
  const source = new GeneratedGeometry(), material = new THREE.MeshBasicMaterial(), group = new THREE.Group();
  group.add(new THREE.Mesh(source, material), new THREE.Mesh(source, material));
  batchMeshes(group);
  assert.equal(builds, 1, 'batching must not regenerate procedural source meshes');
  assert.equal(group.children[0].geometry.attributes.position.count, source.attributes.position.count * 2);
  group.children[0].geometry.dispose(); material.dispose();
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
