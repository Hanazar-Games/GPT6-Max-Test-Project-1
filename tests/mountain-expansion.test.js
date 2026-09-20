import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS, CRAFTS } from '../src/missions.js';
import { createRoute, routeFrame } from '../src/route.js';
import { World } from '../src/world.js';
import { filterMissions } from '../src/catalogue.js';

test('six new mountain routes and six new craft extend the fleet with five-minute minimum journeys', () => {
  assert.equal(CRAFTS.length, 26);
  assert.equal(MISSIONS.length, 44);
  const routes = MISSIONS.filter(mission => mission.bridges?.length);
  assert.equal(routes.length, 6);
  assert.deepEqual(filterMissions('', 'bridges'), routes);
  const fastest = Math.max(...CRAFTS.map(craft => craft.boostSpeed + 12));
  for (const mission of routes) {
    assert.ok(mission.length >= 150000 && mission.length <= 240000);
    assert.ok(mission.length / fastest >= 300);
    assert.ok(mission.bridges.length >= 12);
    const curve = createRoute(mission), points = curve.getSpacedPoints(500);
    const bounds = new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3());
    assert.ok(bounds.y > 1700, `${mission.id}: mountain relief`);
    assert.ok(bounds.x > 14000 && bounds.z > 14000, `${mission.id}: larger landscape`);
    assert.ok(Math.abs(curve.getLength() - mission.length) < .1);
    assert.ok(points[0].distanceTo(points.at(-1)) < .001);
    for (let i = 0; i < mission.bridges.length; i++) {
      const bridge = mission.bridges[i];
      assert.ok(bridge.start > (mission.bridges[i - 1]?.end ?? 1000));
      assert.ok(bridge.end < mission.length - 1000);
      assert.ok(bridge.end - bridge.start >= 1000);
    }
    assert.equal(new Set(mission.bridges.map(bridge => bridge.kind)).size, 3);
  }
});

test('mountain terrain stays below the road and bridge valleys have real clearance within a mesh budget', () => {
  const routes = MISSIONS.filter(mission => mission.bridges?.length);
  assert.equal(routes.length, 6);
  for (const mission of routes) {
    const world = Object.assign(Object.create(World.prototype), { mission, curve: createRoute(mission), scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } } });
    world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
    world.makeTerrain();
    assert.ok(world.terrainGeometry.attributes.position.count <= 263169, `${mission.id}: terrain budget`);
    for (let distance = 0; distance < mission.length; distance += 80) for (const lane of [-17, 0, 17]) {
      const point = routeFrame(world.curve, mission.length, distance, lane, -.38).point;
      assert.ok(world.groundInfo(point.x, point.z).y < point.y - .5, `${mission.id}: terrain penetrates road at ${distance}/${lane}`);
    }
    for (const bridge of mission.bridges) {
      const point = world.frame((bridge.start + bridge.end) / 2).point;
      assert.ok(point.y - world.groundInfo(point.x, point.z).y > bridge.depth * .7, `${mission.id}: valley below bridge`);
    }
    world.clearScene();
  }
});
