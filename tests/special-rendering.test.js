import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGame } from '../src/game.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';

function scene(id) {
  const game = createGame(id);
  const world = Object.assign(Object.create(World.prototype), {
    mission: game.mission, course: game.course, curve: createRoute(game.mission), scene: new THREE.Scene(),
    materials: { dark: new THREE.MeshStandardMaterial(), glow: new THREE.MeshBasicMaterial() },
    renderer: { renderLists: { dispose() {} } }, pads: [], drones: [],
  });
  world.samples = world.curve.getSpacedPoints(Math.ceil(game.mission.length / 20));
  return { world, game };
}

test('hundreds of accelerator strips use two batches and reset their activation colors on retry', () => {
  const { world, game } = scene('overdrive');
  world.makePads();
  const meshes = world.scene.children;
  assert.equal(meshes.length, 2);
  assert.ok(meshes.every(mesh => mesh.isInstancedMesh && mesh.count === game.course.pads.length));
  const lights = world.padLights;
  const color = new THREE.Color(), initial = new THREE.Color();
  lights.getColorAt(0, initial);
  game.activatedPads.add(0);
  world.updatePads(game);
  lights.getColorAt(0, color);
  assert.notEqual(color.getHex(), initial.getHex());
  game.activatedPads.clear();
  world.updatePads(game);
  lights.getColorAt(0, color);
  assert.equal(color.getHex(), initial.getHex());
  world.clearScene();
  world.materials.glow.dispose();
});

test('dense apocalypse rocks remain within a bounded rendering budget', () => {
  const { world, game } = scene('apocalypse');
  world.makeRocks();
  assert.ok(world.scene.children.length <= 3);
  const obstacles = world.scene.children.filter(mesh => mesh.name.startsWith('obstacle-'));
  assert.equal(obstacles.length, 2);
  assert.ok(obstacles.every(mesh => mesh.count === game.course.obstacles.length));
  world.clearScene();
  world.materials.dark.dispose();
});

test('Earth has daylight clouds instead of a star field or a giant planet overhead', () => {
  const { world } = scene('earth');
  world.makeSky();
  assert.equal(world.sky.name, 'daylight-sky');
  assert.ok(world.sky.getObjectByName('earth-clouds'));
  assert.ok(world.sky.getObjectByName('earth-sun'));
  assert.ok(world.sky.children.every(child => !child.isPoints));
  world.clearScene();
  Object.values(world.materials).forEach(material => material.dispose());
});
