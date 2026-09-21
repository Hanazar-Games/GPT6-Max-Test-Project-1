import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { createGame } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';

test('long-route transforms stay within budget while every animated object keeps its correct pose', t => {
  const document = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({ createRadialGradient: () => ({ addColorStop() {} }), fillRect() {}, fillText() {} }) }) };
  t.after(() => { if (document === undefined) delete globalThis.document; else globalThis.document = document; });
  const world = Object.assign(Object.create(World.prototype), {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(58, 1.6, .2, 4000),
    quality: 'low', shake: 0, lastStatus: 'menu',
    renderer: { renderLists: { dispose() {} }, render(scene) { scene.updateMatrixWorld(); } },
  });
  t.after(() => world.clearScene());
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
