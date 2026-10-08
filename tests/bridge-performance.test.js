import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { bridgeAt } from '../src/bridges.js';
import { makeBridges } from '../src/bridge-view.js';
import { partitionLandscape } from '../src/landscape-chunks.js';

function makeWorld(t, mission) {
  const world = Object.assign(Object.create(World.prototype), {
    mission, curve: createRoute(mission), scene: new THREE.Scene(),
    materials: { dark: new THREE.MeshStandardMaterial() },
    renderer: { renderLists: { dispose() {} } }, groundInfo: () => ({ y: -2000 }),
  });
  t.after(() => { world.clearScene(); world.materials.dark.dispose(); });
  return world;
}

test('bridge construction keeps route sampling proportional to distinct cross-sections', t => {
  const mission = MISSIONS.find(mission => mission.id === 'summit'), world = makeWorld(t, mission);
  let frames = 0;
  world.frame = function (...args) { frames++; return World.prototype.frame.apply(this, args); };
  makeBridges(world);
  const sections = mission.bridges.reduce((sum, span) => sum + Math.ceil((span.end - span.start) / 30), 0);
  assert.ok(frames < sections * 3, `${frames} route samples for ${sections} bridge sections`);
  const beam = world.scene.getObjectByName('bridge-steel'), matrix = new THREE.Matrix4();
  beam.getMatrixAt(0, matrix);
  const first = mission.bridges[0];
  const a = World.prototype.frame.call(world, first.start, -14, -5).point;
  const b = World.prototype.frame.call(world, first.start + (first.end - first.start) / Math.ceil((first.end - first.start) / 30), -14, -5).point;
  for (const [height, expected] of [[-.5, a], [.5, b]]) {
    assert.ok(new THREE.Vector3(0, height, 0).applyMatrix4(matrix).distanceTo(expected) < .02, 'cached frames must preserve the banked beam endpoints');
  }
});

test('road piers omit bridge spans without leaving degenerate instances or changing remaining supports', t => {
  const mission = MISSIONS.find(mission => mission.id === 'summit'), world = makeWorld(t, mission);
  world.makeTrack();
  const piers = world.scene.getObjectByName('road-piers'), matrix = new THREE.Matrix4();
  const count = Math.ceil(mission.length / 65);
  const distances = Array.from({ length: count }, (_, i) => i / count * mission.length).filter(distance => !bridgeAt(mission, distance));
  assert.equal(piers.count, distances.length * 2);
  for (let i = 0; i < distances.length; i++) for (const side of [-1, 1]) {
    piers.getMatrixAt(i * 2 + (side > 0 ? 1 : 0), matrix);
    assert.ok(matrix.determinant() > 0, 'piers must not contain zero-scale transforms');
    const top = new THREE.Vector3(0, .5, 0).applyMatrix4(matrix);
    const expected = world.frame(distances[i], side * 12.8, -2.4).point;
    assert.ok(top.distanceTo(expected) < .02, 'surviving piers must still meet the banked deck');
  }
  partitionLandscape(world.scene);
  const chunks = world.scene.children.filter(mesh => mesh.name === 'road-piers');
  assert.equal(chunks.reduce((sum, mesh) => sum + mesh.count, 0), piers.count);
  assert.ok(chunks.every(mesh => Number.isFinite(mesh.boundingSphere.radius)));
});

test('routes fully covered by bridge spans allocate no ordinary pier batch', t => {
  const source = MISSIONS.find(mission => mission.id === 'tranquility');
  const mission = { ...source, bridges: [{ start: 0, end: source.length, kind: 'viaduct' }] };
  const world = makeWorld(t, mission);
  world.makeTrack();
  assert.ok(!world.scene.getObjectByName('road-piers'), 'fully bridged routes must not allocate empty pier buffers');
  assert.ok(world.scene.getObjectByName('bridge-concrete').count > 0);
});
