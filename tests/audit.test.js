import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, togglePause, getFlightCue } from '../src/game.js';
import { getMeteorCue } from '../src/environment.js';

function flight() {
  const game = createGame();
  startGame(game);
  game.status = 'running';
  for (const key of ['gates', 'pickups', 'obstacles', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
  return game;
}

test('a harmless meteor cue cannot hide an imminent rock collision', () => {
  const game = flight();
  Object.assign(game, { distance: 80, lane: 8, speed: 36, elapsed: 3 });
  game.course.meteors = [{ id: 0, distance: 100, lane: -6, radius: 5, first: 4, period: 10 }];
  game.course.obstacles = [{ id: 0, distance: 110, lane: 8, radius: 2, kind: 'rock' }];
  assert.equal(getFlightCue(game).kind, 'hazard');
});

test('meteor dodge is awarded only after clearing the full active contact', () => {
  const game = flight();
  game.course.meteors = [{ id: 0, distance: 100, lane: 0, radius: 5, first: 4, period: 10 }];
  Object.assign(game, { distance: 100, elapsed: 4.1, height: 3.5, verticalSpeed: -5 });
  updateGame(game, {}, 1 / 60);
  assert.equal(game.meteorDodges, 0);
  for (let i = 0; i < 60; i++) updateGame(game, {}, 1 / 60);
  assert.equal(game.hull, 78);
  assert.equal(game.meteorDodges, 0);
  assert.equal(game.score, 0);
});

test('destroyed craft cannot be revived by a pickup later in the same step', () => {
  const game = flight();
  Object.assign(game, { hull: 8, lane: 15, speed: 36 });
  game.course.pickups = [{ id: 0, distance: 0, lane: 15 }];
  updateGame(game, { accelerate: true, steer: 1 }, 1 / 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.hull, 0);
  assert.equal(game.collected.size, 0);
});

test('a simulation step cannot travel or collect beyond the remaining time', () => {
  const game = flight();
  Object.assign(game, { time: 0.001, speed: 36 });
  game.course.pickups = [{ id: 0, distance: 3, lane: 0 }];
  updateGame(game, { accelerate: true }, 0.1);
  assert.equal(game.status, 'lost');
  assert.ok(game.distance <= 0.036 + 1e-8);
  assert.equal(game.collected.size, 0);
  assert.equal(game.elapsed, 0.001);
});

test('meteor prediction checks low altitude on entry, not just over the center', () => {
  const game = flight();
  game.course.meteors = [{ id: 0, distance: 100, lane: 0, radius: 5, first: 4, period: 10 }];
  Object.assign(game, { distance: 90, elapsed: 4.1, speed: 36, height: 1.8, verticalSpeed: 11 });
  assert.equal(getMeteorCue(game).danger, true);
});

test('glide rewards use height at the zone boundary, including ascent and descent', () => {
  for (const [height, verticalSpeed, expected] of [[3.3, -10, 1], [3.1, 10, 0]]) {
    const game = flight();
    game.course.gravityZones = [{ id: 0, start: 20, end: 80 }];
    Object.assign(game, { distance: 79.8, speed: 36, height, verticalSpeed });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.glides, expected);
  }
});

test('landing on the back of a rock cannot earn an aerial dodge first', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 100, lane: 0, radius: 2.8, kind: 'rock' }];
  Object.assign(game, { distance: 99.8, speed: 36, height: 2.7, verticalSpeed: -5 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.airDodges, 0);
  for (let i = 0; i < 20; i++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, 76);
  assert.equal(game.airDodges, 0);
  assert.equal(game.score, 0);
});

test('a descending craft that lands after clearing a rock remains unharmed', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 100, lane: 0, radius: 2.8, kind: 'rock' }];
  Object.assign(game, { distance: 102.9, speed: 36, height: 2.6, verticalSpeed: -10 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, 100);
  assert.equal(game.airDodges, 1);
});

test('a moving drone cannot pass through a stationary craft between endpoints', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 100, radius: 2.3, kind: 'drone', phase: -0.35, frequency: 10 }];
  Object.assign(game, { distance: 100, lane: 0 });
  updateGame(game, {}, 0.1);
  assert.equal(game.hull, 72);
});

test('a stopped craft inside the rear edge of a meteor site still receives a danger cue', () => {
  const game = flight();
  game.course.meteors = [{ id: 0, distance: 100, lane: 0, radius: 5, first: 4, period: 10 }];
  Object.assign(game, { distance: 106, elapsed: 2.5, speed: 0 });
  assert.equal(getMeteorCue(game).danger, true);
});

test('an expired mission cannot trigger jump, pickup or pad effects at zero remaining time', () => {
  const game = flight();
  game.course.pickups = [{ id: 0, distance: 100, lane: 0 }];
  game.course.pads = [{ id: 0, distance: 100, lane: 0 }];
  Object.assign(game, { distance: 100, time: 0 });
  updateGame(game, { jump: true, accelerate: true }, 1 / 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.energy, 100);
  assert.equal(game.score, 0);
  assert.deepEqual(game.events, []);
});

test('pausing preserves a pending obstacle dodge, while retry and gate rewinds cancel it', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 100, lane: 0, radius: 2.8, kind: 'rock' }];
  Object.assign(game, { distance: 99.8, speed: 36, height: 4 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.pendingObstacleDodges.size, 1);
  togglePause(game);
  const before = structuredClone(game);
  updateGame(game, { accelerate: true }, 0.1);
  assert.deepEqual(game, before);
  togglePause(game);
  game.course.gates = [{ id: 0, distance: 101, lane: 10, width: 2 }];
  for (let i = 0; i < 3; i++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.pendingObstacleDodges.size, 0);
  assert.equal(game.airDodges, 0);
  assert.ok(game.passedObstacles.has(0));
  startGame(game);
  assert.equal(game.passedObstacles.size, 0);
  assert.equal(game.pendingObstacleDodges.size, 0);
});

test('rock warnings account for vulnerable height at the leading edge of the obstacle', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 100, lane: 0, radius: 2.8, kind: 'rock' }];
  Object.assign(game, { distance: 93, speed: 36, height: 1.2, verticalSpeed: 11 });
  assert.equal(getFlightCue(game).kind, 'hazard');
});

test('a jump press released before the next simulation step still jumps once', () => {
  const game = flight();
  updateGame(game, { jump: false, jumpPressed: true }, 1 / 60);
  assert.ok(game.height > 0);
  assert.equal(game.events.filter(event => event.type === 'jump').length, 1);
  for (let i = 0; i < 180; i++) {
    updateGame(game, {}, 1 / 60);
    assert.ok(!game.events.some(event => event.type === 'jump'));
  }
});

test('releasing and repressing a held jump between steps rearms the next jump', () => {
  const game = flight();
  for (let i = 0; i < 180; i++) updateGame(game, { jump: true }, 1 / 60);
  assert.equal(game.height, 0);
  assert.equal(game.jumpCooldown, 0);
  updateGame(game, { jump: true, jumpPressed: true }, 1 / 60);
  assert.ok(game.height > 0);
});

test('a boost release between steps unlocks a recharged boost on repress', () => {
  const game = flight();
  for (let i = 0; i < 360; i++) updateGame(game, { boost: true }, 1 / 60);
  assert.equal(game.boostLocked, true);
  assert.ok(game.energy > 10);
  updateGame(game, { boost: true, boostReleased: true }, 1 / 60);
  assert.equal(game.boosting, true);
  assert.equal(game.boostLocked, false);
});
