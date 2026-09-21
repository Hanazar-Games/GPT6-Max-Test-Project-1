import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { createGame, obstacleLane } from '../src/game.js';

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

test('patrols reuse their fixed route samples and retain their exact pose through pause, retry and map changes', t => {
  const world = makeWorld(t), expected = new THREE.Object3D();
  for (const id of ['summit', 'opalreach', 'summit']) {
    const game = createGame(id);
    world.loadMission(game);
    world.environment.render = () => {};
    let frames = 0;
    world.frame = (...args) => { frames++; return World.prototype.frame.call(world, ...args); };
    for (const [status, elapsed] of [['running', 603], ['paused', 603], ['running', 604], ['countdown', 0], ['menu', 0]]) {
      Object.assign(game, { status, elapsed, distance: game.mission.length / 2, speed: 430 });
      frames = 0;
      world.render(game, 1 / 60);
      assert.ok(frames <= 4, `${id}/${status}: ${frames} route samples for fixed patrol positions`);
      const time = status === 'menu' ? world.clock : elapsed;
      for (const { group, obstacle } of world.drones) {
        const frame = World.prototype.frame.call(world, obstacle.distance, obstacleLane(obstacle, time));
        expected.position.copy(frame.point);
        world.orient(expected, frame);
        expected.rotateZ(Math.cos(time * obstacle.frequency + obstacle.phase) * -.12);
        assert.ok(group.position.equals(expected.position), `${id}: changed patrol position`);
        assert.ok(group.quaternion.equals(expected.quaternion), `${id}: changed patrol orientation`);
      }
    }
  }
});

test('offscreen cores skip animation and return at the current phase after collection, rewind and camera changes', t => {
  const world = makeWorld(t), game = createGame('summit');
  world.loadMission(game);
  const point = new THREE.Vector3();
  let sawVisible = false, sawCulled = false;
  for (const [progress, aspect, speed] of [[0, 1.6, 0], [.5, 1.6, 430], [.5, .5, 430], [.9, 2.4, 492], [.01, 1.6, 100]]) {
    Object.assign(game, { status: progress ? 'running' : 'menu', distance: game.mission.length * progress, speed, elapsed: progress * 600 });
    world.camera.aspect = aspect;
    world.cameraReady = false;
    world.render(game, 1 / 60);
    let animated = 0;
    for (let i = 0; i < world.pickups.length; i++) {
      const { group, core, ring } = world.pickups[i];
      assert.equal(core.matrixAutoUpdate, group.visible, 'hidden cores must not rebuild their matrix');
      assert.equal(ring.matrixAutoUpdate, group.visible, 'hidden rings must not rebuild their matrix');
      if (!group.visible) {
        sawCulled = true;
        // Check the full animation envelope against the culling sphere below.
        continue;
      }
      sawVisible = true;
      animated++;
      assert.equal(core.rotation.y, world.clock * 1.1 + i);
      assert.equal(core.position.y, 2.6 + Math.sin(world.clock * 2 + i) * .35);
      assert.equal(ring.rotation.y, -world.clock * .65);
    }
    assert.ok(animated < world.pickups.length / 4, `${animated} cores animated out of ${world.pickups.length}`);
  }
  assert.ok(sawVisible && sawCulled);
  const pickup = world.pickups[0];
  game.status = 'running'; game.distance = game.course.pickups[0].distance;
  game.collected.add(0); world.cameraReady = false;
  world.render(game, 1 / 60);
  assert.equal(pickup.group.visible, false);
  game.collected.clear(); world.cameraReady = false;
  world.render(game, 1 / 60);
  assert.equal(pickup.group.visible, true);
  assert.equal(pickup.core.rotation.y, world.clock * 1.1);
  for (const { group, core, ring, bounds } of world.pickups) {
    for (const phase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      core.position.y = 2.6 + Math.sin(phase) * .35;
      core.rotation.y = ring.rotation.y = phase;
      core.updateMatrix(); ring.updateMatrix(); group.updateMatrixWorld(true);
      group.traverse(mesh => {
        if (!mesh.geometry) return;
        const vertices = mesh.geometry.attributes.position;
        for (let i = 0; i < vertices.count; i++) {
          point.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld);
          assert.ok(bounds.containsPoint(point), 'culling bounds must enclose every core, ring and footprint pose');
        }
      });
    }
  }
});
