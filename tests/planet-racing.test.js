import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS } from '../src/missions.js';
import { createRoute, routeFrame, speedFov } from '../src/route.js';
import { createGame, updateGame } from '../src/game.js';

test('at least twenty-five different planets have closed mountain roads at their actual advertised lengths', () => {
  assert.ok(MISSIONS.length >= 25);
  assert.equal(new Set(MISSIONS.map(mission => mission.id)).size, MISSIONS.length);
  assert.equal(new Set(MISSIONS.map(mission => mission.planet)).size, MISSIONS.length);
  assert.equal(new Set(MISSIONS.map(mission => JSON.stringify(mission.points))).size, MISSIONS.length);
  for (const mission of MISSIONS) {
    const route = createRoute(mission);
    assert.ok(Math.abs(route.getLength() - mission.length) < 0.1);
    assert.ok(route.getPointAt(0).distanceTo(route.getPointAt(1)) < 0.001);
    const points = route.getSpacedPoints(300);
    assert.ok(Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) > 150);
    let reversals = 0;
    let previousTurn = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const frame = routeFrame(route, mission.length, i / 300 * mission.length);
      const turn = Math.sign(frame.bank);
      if (previousTurn && turn !== previousTurn) reversals++;
      previousTurn = turn;
      assert.ok(Math.abs(frame.tangent.dot(frame.up)) < 1e-8);
      assert.ok(Math.abs(frame.right.length() - 1) < 1e-8);
    }
    const firstTurn = Math.sign(routeFrame(route, mission.length, mission.length / 300).bank);
    if (previousTurn !== firstTurn) reversals++;
    assert.ok(reversals >= 6, `${mission.id} needs alternating mountain bends`);
    for (let i = 0; i < points.length; i++) for (let j = i + 8; j < points.length; j++) {
      if (points.length - (j - i) < 8) continue;
      assert.ok(points[i].distanceTo(points[j]) > 38, `${mission.id}: road overlaps at ${i}/${j}`);
    }
  }
});

test('FOV follows actual speed monotonically with a bounded wide-angle view', () => {
  const speeds = [0, 70, 160, 240, 330, 380, 432];
  const values = speeds.map(speedFov);
  assert.ok(values.every((value, index) => !index || value > values[index - 1]));
  assert.ok(values[0] >= 58 && values.at(-1) <= 106);
  assert.equal(speedFov(-10), speedFov(0));
  assert.equal(speedFov(10000), speedFov(460));
});

test('hairpin road edges and guardrails never fold back across the driving surface', () => {
  for (const mission of MISSIONS) {
    const curve = createRoute(mission);
    for (let distance = 0; distance < mission.length; distance += 3) {
      const { tangent } = routeFrame(curve, mission.length, distance);
      for (const lane of [-18.2, 18.2]) {
        const a = routeFrame(curve, mission.length, distance, lane).point;
        const b = routeFrame(curve, mission.length, distance + 3, lane).point;
        assert.ok(b.sub(a).dot(tangent) > 0, `${mission.id}: folded inner road at ${distance}`);
      }
    }
  }
});

test('all ships exceed 1100 km/h under boost and can brake from the new top speeds', () => {
  assert.ok(CRAFTS.length >= 10);
  assert.equal(new Set(CRAFTS.map(craft => craft.id)).size, CRAFTS.length);
  assert.equal(new Set(CRAFTS.map(craft => [craft.speed, craft.boostSpeed, craft.handling, craft.hull, craft.recharge].join('/'))).size, CRAFTS.length);
  for (const craft of CRAFTS) {
    const game = createGame('tranquility', craft.id);
    game.status = 'running';
    for (const key of ['pickups', 'obstacles', 'gates', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
    for (let i = 0; i < 180; i++) updateGame(game, { accelerate: true }, 1 / 60);
    assert.ok(game.speed >= 150);
    for (let i = 0; i < 180; i++) updateGame(game, { accelerate: true, boost: true }, 1 / 60);
    assert.equal(game.speed, craft.boostSpeed);
    assert.ok(game.speed * 3.6 >= 1100);
    const before = game.speed;
    for (let i = 0; i < 60; i++) updateGame(game, { brake: true }, 1 / 60);
    assert.ok(game.speed < before * 0.5);
  }
});

test('the expanded atlas has seven route families and distinct driving layouts', () => {
  assert.ok(new Set(MISSIONS.map(mission => mission.layout)).size >= 7);
  assert.equal(new Set(MISSIONS.map(mission => mission.biome)).size, MISSIONS.length);
  const shapes = new Set();
  for (const mission of MISSIONS) {
    assert.ok(mission.length >= 7000 && mission.length <= 15000);
    const points = createRoute(mission).getSpacedPoints(120);
    shapes.add(points.slice(0, 120).map((point, i) => (point.distanceTo(points[(i + 30) % 120]) / mission.length).toFixed(3)).join(','));
  }
  assert.equal(shapes.size, MISSIONS.length);
});

test('the fastest upgraded ship cannot tunnel through a gate, rock, core or boost strip', () => {
  for (const kind of ['gates', 'obstacles', 'pickups', 'pads']) {
    const fastest = CRAFTS.reduce((best, craft) => craft.boostSpeed > best.boostSpeed ? craft : best);
    const game = createGame('tranquility', fastest.id, { engine: 2 });
    Object.assign(game, { status: 'running', distance: 80, speed: game.craft.boostSpeed });
    for (const key of ['pickups', 'obstacles', 'gates', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
    game.course[kind] = [{ id: 0, distance: 100, lane: 0, radius: 2.8, width: 10, kind: 'rock' }];
    updateGame(game, { accelerate: true, boost: true }, 0.1);
    assert.ok(game.distance > 103);
    assert.equal(kind === 'gates' ? game.gates : kind === 'obstacles' ? game.impacts : kind === 'pickups' ? game.collected.size : game.activatedPads.size, 1);
  }
});

test('high-speed core and pad crossings use the contact lane and height', () => {
  for (const kind of ['pickups', 'pads']) {
    const game = createGame();
    Object.assign(game, { status: 'running', distance: 90, speed: 240, lane: 0, lateralSpeed: 32 });
    for (const key of ['pickups', 'obstacles', 'gates', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
    game.course[kind] = [{ id: 0, distance: 94, lane: -3 }];
    updateGame(game, { accelerate: true, boost: true, steer: 1 }, 0.1);
    assert.equal(kind === 'pickups' ? game.collected.size : game.activatedPads.size, 1);
  }
  for (const kind of ['pickups', 'pads']) {
    const game = createGame();
    Object.assign(game, { status: 'running', distance: 90, speed: 240, height: 3.5, verticalSpeed: -30 });
    for (const key of ['pickups', 'obstacles', 'gates', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
    game.course[kind] = [{ id: 0, distance: 94, lane: 0 }];
    updateGame(game, { accelerate: true, boost: true }, 0.1);
    assert.ok(game.height < 0.5);
    assert.equal(kind === 'pickups' ? game.collected.size : game.activatedPads.size, 0);
  }
});
