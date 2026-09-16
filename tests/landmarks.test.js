import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { makeLandmarks } from '../src/landmarks.js';

test('new planetary landmarks remain outside the road and release their shared resources', () => {
  for (const mission of MISSIONS.slice(10)) {
    const world = Object.assign(Object.create(World.prototype), { mission, curve: createRoute(mission), scene: new THREE.Scene(), materials: { dark: new THREE.MeshStandardMaterial() }, renderer: { renderLists: { dispose() {} } } });
    world.samples = world.curve.getSpacedPoints(600);
    let seed = mission.seed;
    makeLandmarks(world, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
    const instances = world.scene.children.filter(mesh => mesh.isInstancedMesh);
    assert.ok(instances.length >= 3);
    assert.ok(instances.every(mesh => mesh.count >= 24));
    const matrix = new THREE.Matrix4();
    for (const mesh of instances) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
      const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      const radius = Math.hypot(size.x, size.z) / 2;
      assert.ok(world.groundInfo(center.x, center.z).distance > radius + 18.2, `${mission.id}: landmark intersects the roadside`);
    }
    const resources = new Set();
    world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) resources.add(mesh.material); });
    const disposed = new Map([...resources].map(resource => [resource, 0]));
    for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
    world.clearScene();
    assert.equal(world.scene.children.length, 0);
    assert.ok([...disposed.values()].every(count => count === 1));
    if (!resources.has(world.materials.dark)) world.materials.dark.dispose();
  }
});
