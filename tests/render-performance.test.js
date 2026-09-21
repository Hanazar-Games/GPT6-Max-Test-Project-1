import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { createGame } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';

function makeWorld(t) {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {} }) }) };
  t.after(() => { if (document === undefined) delete globalThis.document; else globalThis.document = document; });
  const world = Object.assign(Object.create(World.prototype), {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(58, 1.6, .2, 4000),
    quality: 'low', shake: 0, lastStatus: 'menu',
    renderer: { renderLists: { dispose() {} }, render(scene) { scene.updateMatrixWorld(); } },
  });
  t.after(() => world.clearScene());
  return world;
}

test('long-route transforms stay within budget while every animated object keeps its correct pose', t => {
  const world = makeWorld(t);
  let game = createGame('summit');
  world.loadMission(game);
  world.render(game, 1 / 60);
  let transforms = 0, objects = 0;
  world.scene.traverse(object => {
    objects++;
    const update = object.updateMatrix;
    object.updateMatrix = function () { transforms++; return update.call(this); };
  });
  world.render(game, 1 / 60);
  assert.ok(transforms < objects * .15, `${transforms}/${objects} transforms recomputed`);

  const local = new THREE.Matrix4(), expected = new THREE.Matrix4();
  const verify = () => world.scene.traverse(object => {
    local.compose(object.position, object.quaternion, object.scale);
    assert.ok(local.elements.every((value, i) => Math.abs(value - object.matrix.elements[i]) < 1e-8), `${object.name || object.type}: stale local matrix`);
    expected.copy(local);
    if (object.parent) expected.premultiply(object.parent.matrixWorld);
    assert.ok(expected.elements.every((value, i) => Math.abs(value - object.matrixWorld.elements[i]) < 1e-8), `${object.name || object.type}: stale world matrix`);
  });
  for (const status of ['running', 'paused', 'countdown', 'won', 'lost', 'menu']) {
    Object.assign(game, { status, elapsed: 603, distance: 120000, speed: 430, lateralSpeed: 15, height: 4, verticalSpeed: 3, shieldTime: 5, magnetTime: 5, overdriveTime: 5 });
    for (const craft of [CRAFTS[0], CRAFTS.at(-1)]) {
      world.setCraft(craft);
      world.render(game, 1 / 60, [1, 2, 3].map(i => ({ color: '#88eeff', pose: { distance: game.distance + i * 35, lane: i, height: i, speed: 380, lateralSpeed: -10 } })));
      verify();
    }
  }
  game = createGame('opalreach');
  world.loadMission(game);
  for (const { item } of world.rewards.items) {
    Object.assign(game, { status: 'running', elapsed: 20, distance: item.distance });
    world.render(game, 1 / 60);
    verify();
  }
});

for (const id of ['earth', 'overdrive', 'apocalypse', 'odyssey', 'cascade']) test(`${id}: long routes cull distant scenery without breaking terrain sampling or accelerator colors`, t => {
  const world = makeWorld(t), game = createGame(id);
  world.loadMission(game);
  const terrain = world.scene.children.filter(mesh => mesh.name === 'planet-terrain');
  assert.ok(terrain.length > 1, 'long routes need local terrain bounds');
  assert.ok(terrain.every(mesh => mesh.geometry.attributes.position === world.terrainGeometry.attributes.position));
  for (const progress of [0, .25, .5, .9]) {
    Object.assign(game, { status: progress ? 'running' : 'menu', distance: game.mission.length * progress, speed: progress ? 350 : 0, elapsed: progress * game.mission.length / 200 });
    world.cameraReady = false;
    world.render(game, 0);
    let triangles = 0, total = 0;
    world.scene.traverseVisible(mesh => {
      if (!mesh.isMesh) return;
      const count = (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
      total += count;
      if (world.viewFrustum.intersectsObject(mesh)) triangles += count;
    });
    assert.ok(triangles < 650000, `${id}/${progress}: ${triangles}/${total} triangles`);
    const point = world.frame(game.distance).point;
    assert.ok(Number.isFinite(world.groundInfo(point.x, point.z).y));
  }
  if (game.course.pads.length) {
    assert.equal(world.scene.children.filter(mesh => mesh.name === 'pad-arrows').length, 1);
    const color = new THREE.Color(), initial = new THREE.Color();
    world.padLights.getColorAt(0, initial);
    game.activatedPads.add(game.course.pads[0].id); world.updatePads(game);
    world.padLights.getColorAt(0, color); assert.notEqual(color.getHex(), initial.getHex());
    game.activatedPads.clear(); world.updatePads(game);
    world.padLights.getColorAt(0, color); assert.equal(color.getHex(), initial.getHex());
  }
  const resources = new Set([world.terrainGeometry]);
  world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  world.clearScene();
  assert.ok([...disposed.values()].every(count => count === 1));
});
