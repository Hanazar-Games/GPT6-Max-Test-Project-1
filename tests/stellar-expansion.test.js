import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS, makeCourse } from '../src/missions.js';
import { filterCrafts, filterMissions } from '../src/catalogue.js';
import { createRoute } from '../src/route.js';

test('six rally destinations add distinct 24–84 km journeys with two new mountain layouts', () => {
  const routes = MISSIONS.slice(48, 54);
  assert.equal(MISSIONS.length, 58);
  assert.deepEqual(routes.map(m => m.length), [24000, 32000, 40000, 60000, 72000, 84000]);
  assert.equal(new Set(routes.map(m => m.biome)).size, 6);
  assert.deepEqual([...new Set(routes.slice(3).map(m => m.layout))].sort(), ['叠湾天路', '星冠盘山']);
  for (const mission of routes) {
    const route = createRoute(mission), course = makeCourse(mission);
    assert.ok(Math.abs(route.getLength() - mission.length) < .1);
    assert.ok(route.getPoint(0).distanceTo(route.getPoint(1)) < .001);
    assert.ok(filterMissions(mission.planet, 'tour').includes(mission));
    assert.equal(course.powerups.length, Math.ceil(mission.length / 12000) * 3);
    assert.equal(course.challenges.length, Math.ceil(mission.length / 12000) * 2);
    assert.ok(course.pickups.length >= mission.cargo + 4);
    if (mission.length >= 60000) {
      assert.ok(mission.bridges.length >= 5);
      assert.equal(new Set(mission.bridges.map(b => b.kind)).size, 3);
    }
  }
});

test('six new craft are searchable and offer distinct high-speed handling and endurance tradeoffs', () => {
  assert.equal(CRAFTS.length, 40);
  const crafts = CRAFTS.slice(30, 36);
  assert.deepEqual(crafts.map(c => c.id), ['bat', 'mantis', 'petrel', 'rhino', 'hummingbird', 'medusa']);
  for (const craft of crafts) {
    assert.deepEqual(filterCrafts(craft.model.replace('–', '-')), [craft]);
    assert.ok(craft.boostSpeed >= 350 && craft.boostSpeed <= 480);
    assert.ok(craft.handling >= 35 && craft.hull >= 80 && craft.recharge >= 10);
  }
  assert.equal(new Set(crafts.map(c => `${c.speed}/${c.boostSpeed}/${c.handling}/${c.hull}/${c.recharge}`)).size, 6);
});
