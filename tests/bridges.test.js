import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { bridgeAt, bridgeDepth } from '../src/bridges.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';

test('bridge depth joins the mountain smoothly and never changes unrelated routes', () => {
  const mission = MISSIONS.find(mission => mission.id === 'meridian');
  for (const bridge of mission.bridges) {
    assert.equal(bridgeDepth(mission, bridge.start), 0);
    assert.equal(bridgeDepth(mission, bridge.end), 0);
    assert.equal(bridgeDepth(mission, (bridge.start + bridge.end) / 2), bridge.depth);
    assert.ok(bridgeDepth(mission, bridge.start + .01) < .000001);
    assert.equal(bridgeAt(mission, bridge.start + 1), bridge);
    assert.equal(bridgeAt(mission, bridge.end), undefined);
  }
  assert.equal(bridgeDepth(MISSIONS[0], 2000), 0);
});

test('modeled bridge structures leave road and jump clearance, use four batches and release their resources', async () => {
  const { makeBridges } = await import('../src/bridge-view.js');
  for (const mission of MISSIONS.filter(mission => mission.bridges.length)) {
    const world = Object.assign(Object.create(World.prototype), { mission, curve: createRoute(mission), scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } } });
    world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
    world.makeTerrain();
    makeBridges(world);
    const meshes = world.scene.children.filter(mesh => mesh.name.startsWith('bridge-'));
    assert.equal(meshes.length, 4);
    assert.ok(meshes.every(mesh => mesh.isInstancedMesh && mesh.count > 0 && mesh.count < 30000));
    const matrix = new THREE.Matrix4();
    for (const mesh of meshes) for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      for (const t of [-.5, 0, .5]) {
        const p = new THREE.Vector3(0, t, 0).applyMatrix4(matrix);
        const sample = world.groundSampler(p.x, p.z);
        const roadHeight = world.frame(sample.progress * mission.length).point.y;
        assert.ok(sample.distance >= 18.25 || p.y < roadHeight - 2 || p.y > roadHeight + 15, `${mission.id}/${mesh.name}: intrusion into flight space`);
      }
    }
    const resources = new Set(meshes.flatMap(mesh => [mesh.geometry, mesh.material, mesh]));
    let disposed = 0;
    for (const resource of resources) resource.addEventListener('dispose', () => disposed++);
    world.clearScene();
    assert.equal(disposed, resources.size);
  }
});
