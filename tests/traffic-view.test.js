import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TrafficView, makeTrafficModel } from '../src/traffic-view.js';
import { TRAFFIC_TYPES, TRAFFIC_ROAD_HEIGHT, makeTraffic } from '../src/traffic.js';
import { createGame } from '../src/game.js';
import { World } from '../src/world.js';

test('NPC models retain distinct vehicle dimensions, grounded wheels and a bounded material budget', () => {
  for (const [type, spec] of Object.entries(TRAFFIC_TYPES)) {
    const model = makeTrafficModel(type);
    const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
    assert.ok(size.z >= spec.length && size.z < spec.length + .3, `${type}: wrong vehicle length`);
    assert.ok(size.x >= spec.width && size.x < spec.width + .5, `${type}: wrong vehicle width`);
    assert.ok(Math.abs(bounds.min.y) < .05, `${type}: wheels float above the road`);
    assert.ok(Math.abs(bounds.max.y - spec.height) < .1, `${type}: collision height differs from model`);
    assert.ok(model.children.length <= 6);
    model.traverse(mesh => { if (mesh.isMesh) { assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite)); mesh.geometry.dispose(); mesh.material.dispose(); } });
  }
});

test('moving traffic uses a bounded local instance pool and releases every GPU resource once', () => {
  const world = Object.assign(Object.create(World.prototype), { scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } },
    frame: (distance, lane = 0, height = 0) => ({ point: new THREE.Vector3(-lane, height, distance), right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0), tangent: new THREE.Vector3(0, 0, 1) }) });
  const game = createGame('summit', 'scout', {}, { density: 12, mix: { semi: 100 } });
  const view = new TrafficView(world, game);
  const geometries = new Set(), materials = new Set();
  world.scene.traverse(mesh => { if (mesh.geometry) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
  for (const progress of [0, .3, .9]) {
    game.distance = game.mission.length * progress; game.elapsed = progress * 900;
    view.render(game);
    const active = [];
    world.scene.traverse(mesh => {
      if (!mesh.isInstancedMesh || !mesh.count) return;
      assert.ok(mesh.count <= 24);
      assert.equal(mesh.frustumCulled, false, 'moving instance bounds must not become stale');
      active.push(mesh.name);
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix);
        assert.ok(matrix.elements.every(Number.isFinite)); assert.ok(matrix.determinant() > .99);
        assert.ok(Math.abs(matrix.elements[13] - TRAFFIC_ROAD_HEIGHT) < 1e-6, 'wheels must sit on the asphalt');
      }
    });
    assert.ok(active.length > 0 && active.every(name => name.startsWith('traffic-semi-')));
  }
  game.course.traffic = makeTraffic(game.mission, { density: 0 }); view.render(game);
  world.scene.traverse(mesh => { if (mesh.isInstancedMesh) assert.equal(mesh.count, 0); });
  const resources = [...geometries, ...materials], disposals = new Map(resources.map(resource => [resource, 0]));
  resources.forEach(resource => resource.addEventListener('dispose', () => disposals.set(resource, disposals.get(resource) + 1)));
  world.clearScene(); world.clearScene();
  assert.ok([...disposals.values()].every(count => count === 1));
});

test('traffic culling follows camera changes while simulation time is frozen', () => {
  let visible = true;
  const world = Object.assign(Object.create(World.prototype), { scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } },
    viewProjection: new THREE.Matrix4(), viewFrustum: { intersectsSphere: () => visible },
    frame: distance => ({ point: new THREE.Vector3(0, 0, distance), right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0), tangent: new THREE.Vector3(0, 0, 1) }) });
  const game = createGame(), view = new TrafficView(world, game);
  const count = () => view.root.children.reduce((sum, mesh) => sum + mesh.count, 0);
  view.render(game); const before = count(); assert.ok(before > 0);
  visible = false; world.viewProjection.elements[12] = 1;
  view.render(game); assert.equal(count(), 0);
  visible = true; world.viewProjection.identity();
  view.render(game); assert.equal(count(), before);
  world.clearScene();
});

test('traffic parts share one active-range matrix upload per type and retain unchanged paint', () => {
  const world = Object.assign(Object.create(World.prototype), { scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } },
    frame: (distance, lane, height) => ({ point: new THREE.Vector3(-lane, height, distance), right: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0), tangent: new THREE.Vector3(0, 0, 1) }) });
  const game = createGame('summit', 'scout', {}, { density: 12, mix: { semi: 100 } });
  const view = new TrafficView(world, game);
  try {
    view.render(game);
    for (const { type, meshes } of view.batches) {
      const matrices = new Set(meshes.map(({ mesh }) => mesh.instanceMatrix));
      assert.equal(matrices.size, 1, `${type}: material parts must share vehicle transforms`);
      const { mesh } = meshes[0];
      assert.deepEqual(mesh.instanceMatrix.updateRanges, mesh.count ? [{ start: 0, count: mesh.count * 16 }] : []);
      assert.equal(mesh.instanceMatrix.version, mesh.count ? 1 : 0, 'empty batches must not upload');
    }
    const paint = view.batches.find(batch => batch.type === 'semi').meshes.find(part => part.paint).mesh;
    const version = paint.instanceColor.version, initial = paint.instanceColor.array.slice();
    game.elapsed += 1 / 60; view.render(game);
    assert.equal(paint.instanceColor.version, version, 'moving the same vehicles must not upload unchanged paint');
    assert.deepEqual(paint.instanceColor.array, initial);
    game.course.traffic = game.course.traffic.map(vehicle => ({ ...vehicle, tint: (vehicle.tint + 1) % 6 }));
    view.render(game);
    assert.equal(paint.instanceColor.version, version + 1);
    assert.notDeepEqual(paint.instanceColor.array, initial, 'fleet replacement must repaint reused slots');
    assert.deepEqual(paint.instanceColor.updateRanges, [{ start: 0, count: paint.count * 3 }]);
  } finally { world.clearScene(); }
});
