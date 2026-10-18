import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from '../src/missions.js';
import { createGame, startGame, updateGame, togglePause, getFlightCue } from '../src/game.js';
import { DEFAULT_TRAFFIC_SETTINGS, TRAFFIC_TYPES, normalizeTrafficSettings, setTrafficShare, makeTraffic, trafficNear, trafficDistance } from '../src/traffic.js';

test('traffic shares stay at 100%, disabled types stay absent, and a single type gets the whole fleet', () => {
  assert.equal(DEFAULT_TRAFFIC_SETTINGS.mix.truck + DEFAULT_TRAFFIC_SETTINGS.mix.semi, 70);
  let settings = normalizeTrafficSettings({ density: 99, mix: { car: 1, van: 1, truck: 1, semi: 0 } });
  assert.equal(settings.density, 12);
  assert.equal(Object.values(settings.mix).reduce((sum, value) => sum + value), 100);
  settings = setTrafficShare(settings, 'truck', 75);
  assert.equal(settings.mix.truck, 75);
  assert.equal(settings.mix.semi, 0);
  settings = setTrafficShare(settings, 'car', 0);
  settings = setTrafficShare(settings, 'van', 0);
  assert.deepEqual(settings.mix, { car: 0, van: 0, truck: 100, semi: 0 });
  assert.equal(setTrafficShare(settings, 'truck', 20).mix.truck, 100);
  assert.ok(Object.values(setTrafficShare(settings, 'truck', 0).mix).every(value => value === 0));
  assert.deepEqual(normalizeTrafficSettings({ density: NaN, mix: { car: -3, van: Infinity } }), { density: 8, mix: { car: 0, van: 0, truck: 0, semi: 0 } });
});

test('fleets are deterministic, spaced safely, and meet the configured type quotas', () => {
  const mission = MISSIONS[0], vehicles = makeTraffic(mission);
  assert.deepEqual(vehicles, makeTraffic(mission));
  assert.equal(vehicles.length, Math.floor(mission.length / 1000 * 8));
  for (const [type, share] of Object.entries(DEFAULT_TRAFFIC_SETTINGS.mix)) {
    assert.ok(Math.abs(vehicles.filter(vehicle => vehicle.type === type).length - vehicles.length * share / 100) <= 1);
  }
  for (let i = 0; i < vehicles.length; i++) {
    assert.ok(Math.abs(vehicles[i].lane) === 11);
    if (i) assert.ok(vehicles[i].distance - vehicles[i - 1].distance > 30);
  }
  assert.ok(makeTraffic(mission, { density: 12, mix: { semi: 100 } }).every(vehicle => vehicle.type === 'semi'));
  assert.equal(makeTraffic(mission, { density: 0 }).length, 0);
  assert.equal(makeTraffic(mission, { mix: {} }).length, 0);
  for (const id of ['earth', 'overdrive']) assert.equal(makeTraffic(MISSIONS.find(mission => mission.id === id)).length, 0);
});

test('local traffic queries match a full search across lap boundaries and long running times', () => {
  const mission = MISSIONS[0], vehicles = makeTraffic(mission, { density: 12 });
  for (const elapsed of [0, 83, 10000]) for (const distance of [0, 3500, mission.length]) {
    const from = distance - 80, to = distance + 1000;
    const actual = trafficNear(vehicles, elapsed, mission.length, from, to);
    const expected = [];
    for (const vehicle of vehicles) {
      const position = ((trafficDistance(vehicle, elapsed) % mission.length) + mission.length) % mission.length;
      for (const lap of [-1, 0, 1]) if (position + lap * mission.length >= from && position + lap * mission.length <= to) expected.push({ id: vehicle.id, distance: position + lap * mission.length });
    }
    expected.sort((a, b) => a.distance - b.distance);
    assert.equal(actual.length, expected.length);
    assert.deepEqual(actual.map(vehicle => vehicle.id), expected.map(vehicle => vehicle.id));
    actual.forEach((vehicle, i) => assert.ok(Math.abs(vehicle.distance - expected[i].distance) < 1e-7));
    assert.ok(actual.length <= 20, 'long routes must only query local traffic');
  }
});

function collisionGame() {
  const game = createGame('tranquility', 'scout', {}, { density: 0 });
  Object.assign(game, { status: 'running', distance: 160, lane: 8, speed: 460 });
  for (const key of ['obstacles', 'pickups', 'powerups', 'pads', 'meteors', 'gravityZones', 'challenges', 'gates']) game.course[key] = [];
  game.course.traffic = [{ ...TRAFFIC_TYPES.semi, id: 0, type: 'semi', kind: 'traffic', radius: TRAFFIC_TYPES.semi.width / 2, clearance: TRAFFIC_TYPES.semi.height - 1.3, distance: 200, lane: 8 }];
  return game;
}

test('high speed traffic collisions use relative swept motion and stop fatal-frame interactions', () => {
  const game = collisionGame();
  game.hull = 1;
  game.course.pads = [{ id: 0, distance: 205, lane: 8 }];
  updateGame(game, { accelerate: true }, .1);
  assert.equal(game.status, 'lost');
  assert.equal(game.impacts, 1);
  assert.ok(game.events.some(event => event.type === 'impact' && event.source === 'traffic'));
  assert.equal(game.activatedPads.size, 0);
  const jumping = collisionGame(); jumping.height = 4;
  updateGame(jumping, { accelerate: true }, .1);
  assert.equal(jumping.impacts, 0);
  const shielded = collisionGame(); shielded.shieldTime = 5;
  updateGame(shielded, { accelerate: true }, .1);
  assert.equal(shielded.hull, shielded.craft.hull);
  assert.equal(shielded.shieldBlocks, 1);
});

test('moving traffic can reach a stopped craft and participates in flight warnings', () => {
  const game = collisionGame();
  game.distance = 212; game.speed = 0;
  updateGame(game, {}, .1);
  assert.equal(game.impacts, 1);
  const approaching = collisionGame(); approaching.distance = 100; approaching.speed = 360;
  const cue = getFlightCue(approaching);
  assert.equal(cue.kind, 'hazard'); assert.equal(cue.hazard, 'traffic'); assert.equal(cue.vehicle, '半挂卡车');
  assert.ok(cue.timeToImpact > 0 && cue.timeToImpact < 1);
});

test('custom fleets survive restarts and pause without advancing NPC motion', () => {
  const game = createGame('tranquility', 'scout', {}, { density: 12, mix: { semi: 100 } });
  startGame(game);
  assert.equal(game.trafficSettings.mix.semi, 100);
  assert.ok(game.course.traffic.length > 0 && game.course.traffic.every(vehicle => vehicle.type === 'semi'));
  game.status = 'running'; game.elapsed = 3;
  togglePause(game); updateGame(game, {}, .1);
  assert.equal(game.elapsed, 3);
});
