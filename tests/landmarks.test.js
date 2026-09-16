import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { makeLandmarks } from '../src/landmarks.js';

test('all twenty planetary landmarks stay outside the road within a bounded draw budget', () => {
  const silhouettes = new Set();
  for (const mission of MISSIONS) {
    const world = Object.assign(Object.create(World.prototype), { mission, curve: createRoute(mission), scene: new THREE.Scene(), materials: { dark: new THREE.MeshStandardMaterial() }, renderer: { renderLists: { dispose() {} } } });
    world.samples = world.curve.getSpacedPoints(600);
    let seed = mission.seed;
    makeLandmarks(world, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
    const instances = world.scene.children.filter(mesh => mesh.isInstancedMesh);
    assert.ok(instances.length >= 3 && instances.length <= 5, `${mission.id}: expected 3–5 material batches`);
    assert.ok(instances.every(mesh => mesh.count >= 24));
    const signature = createHash('sha256');
    instances.forEach(mesh => signature.update(Buffer.from(mesh.geometry.attributes.position.array.buffer)));
    silhouettes.add(signature.digest('hex'));
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
  assert.equal(silhouettes.size, MISSIONS.length, 'each planet needs its own modeled silhouette');
});
