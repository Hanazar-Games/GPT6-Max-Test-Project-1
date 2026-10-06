import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { makePlanetScenery } from '../src/planet-view.js';

test('city route builds deterministic skyline batches outside the driving corridor', () => {
  const mission = MISSIONS.find(item => item.id === 'copper');
  assert.equal(mission.biome, 'city');
  const world = Object.assign(Object.create(World.prototype), {
    mission, curve: createRoute(mission), scene: new THREE.Scene(),
    materials: { dark: new THREE.MeshStandardMaterial() },
    renderer: { renderLists: { dispose() {} } },
  });
  world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
  world.makeTerrain();
  let seed = mission.seed;
  makePlanetScenery(world, () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const buildings = world.scene.getObjectByName('city-buildings');
  const windows = world.scene.getObjectByName('city-windows');
  const roofs = world.scene.getObjectByName('city-roofs');
  assert.ok(buildings && windows && roofs);
  assert.equal(windows.count, buildings.count * 4);
  assert.equal(roofs.count, buildings.count);
  assert.ok(buildings.count >= 96 && buildings.count < 220);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < buildings.count; i++) {
    buildings.getMatrixAt(i, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    assert.ok(world.groundInfo(position.x, position.z).distance > 40, `building ${i} enters the road corridor`);
    assert.ok(matrix.elements.every(Number.isFinite));
  }
  const resources = new Set();
  world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) resources.add(mesh.material); });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  world.clearScene();
  assert.ok([...disposed.values()].every(count => count === 1));
});
