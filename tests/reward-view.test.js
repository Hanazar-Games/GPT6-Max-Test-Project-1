import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGame, startGame } from '../src/game.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { RewardView } from '../src/reward-view.js';

test('route reward models follow the course, disappear when resolved, return on retry and release their resources', () => {
  const game = createGame('marathon');
  const world = Object.assign(Object.create(World.prototype), { mission: game.mission, course: game.course, curve: createRoute(game.mission), scene: new THREE.Scene(), materials: { dark: new THREE.MeshBasicMaterial() }, renderer: { renderLists: { dispose() {} } } });
  const view = new RewardView(world);
  for (const { item, group } of [...view.items, ...view.rings]) {
    assert.ok(group.position.toArray().every(Number.isFinite));
    game.distance = item.distance;
    view.render(game); assert.equal(group.visible, true);
    (view.items.some(row => row.group === group) ? game.powerupsTaken : game.challengesResolved).add(item.id);
    view.render(game); assert.equal(group.visible, false);
  }
  startGame(game); game.distance = view.items[0].item.distance;
  view.render(game); assert.equal(view.items[0].group.visible, true);
  const resources = new Set();
  world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) resources.add(mesh.material); });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  world.clearScene(); assert.ok([...disposed.values()].every(count => count === 1));
});
