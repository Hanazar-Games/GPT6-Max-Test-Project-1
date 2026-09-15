import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, togglePause, getFlightCue } from '../src/game.js';
import { getMeteorCue } from '../src/environment.js';
import { CRAFTS } from '../src/missions.js';

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

test('holding boost during a powered pad gives the same free acceleration and recharge', () => {
  for (const craft of CRAFTS) {
    const held = createGame('tranquility', craft.id);
    startGame(held);
    Object.assign(held, { status: 'running', energy: 40, padBoost: 1.8 });
    const released = structuredClone(held);
    for (let step = 0; step < 60; step++) {
      updateGame(held, { boost: true }, 1 / 60);
      updateGame(released, {}, 1 / 60);
      assert.equal(held.energy, released.energy, craft.id);
      assert.equal(held.speed, released.speed, craft.id);
      assert.equal(held.distance, released.distance, craft.id);
    }
    assert.ok(held.energy > 40);
  }
});

test('jumping on a powered pad charges only the jump cost and still recharges', () => {
  const game = flight();
  Object.assign(game, { energy: 40, padBoost: 1 });
  updateGame(game, { boost: true, jump: true }, 1 / 60);
  assert.ok(game.height > 0);
  assert.equal(game.energy, 40 - 18 + game.craft.recharge / 60);
});

test('manual boost resumes its energy cost after a pad expires', () => {
  const game = flight();
  Object.assign(game, { energy: 40, padBoost: 0.01 });
  updateGame(game, { boost: true }, 1 / 60);
  assert.equal(game.padBoost, 0);
  assert.equal(game.boosting, true);
  assert.equal(game.energy, 40 - 25 / 60);
});

test('braking on a powered pad slows the craft without consuming boost energy', () => {
  const game = flight();
  Object.assign(game, { energy: 40, padBoost: 1, speed: 50 });
  updateGame(game, { boost: true, brake: true }, 1 / 60);
  assert.equal(game.boosting, false);
  assert.ok(game.speed < 50);
  assert.ok(game.energy > 40);
});

test('leaving the gate width after crossing cannot turn a valid pass into a miss', () => {
  for (const side of [-1, 1]) {
    const game = createGame();
    startGame(game);
    const gate = game.course.gates[0];
    Object.assign(game, { status: 'running', distance: gate.distance - 0.01, speed: 36, lane: side * (gate.width - 0.02), lateralSpeed: side * 8 });
    updateGame(game, { accelerate: true, steer: side }, 1 / 60);
    assert.equal(game.gates, 1);
    assert.equal(game.score, 300);
    assert.ok(game.distance > gate.distance);
  }
});

test('entering the gate width after crossing still misses and rewinds before the gate', () => {
  for (const side of [-1, 1]) {
    const game = createGame();
    startGame(game);
    const gate = game.course.gates[0];
    Object.assign(game, { status: 'running', distance: gate.distance - 0.01, speed: 36, lane: side * (gate.width + 0.02), lateralSpeed: -side * 8 });
    updateGame(game, { accelerate: true, steer: -side }, 1 / 60);
    assert.equal(game.gates, 0);
    assert.equal(game.distance, gate.distance - 35);
    assert.equal(game.score, 0);
    assert.ok(game.time < game.mission.duration - 4);
  }
});

test('perfect gate rewards use the lane at crossing on both sides of the center', () => {
  for (const side of [-1, 1]) for (const [lane, steer, perfect] of [[2.48, 1, true], [2.52, -1, false]]) {
    const game = createGame();
    startGame(game);
    const gate = game.course.gates[0];
    Object.assign(game, { status: 'running', distance: gate.distance - 0.01, speed: 36, lane: side * lane, lateralSpeed: side * steer * 8 });
    updateGame(game, { accelerate: true, steer: side * steer }, 1 / 60);
    assert.equal(game.gates, 1);
    assert.equal(game.perfectGates, Number(perfect));
    assert.equal(game.score, perfect ? 500 : 300);
  }
});

function finalApproach() {
  const game = createGame();
  startGame(game);
  Object.assign(game, { status: 'running', elapsed: game.mission.duration - 0.01, time: 0.01, distance: game.mission.length - 0.1, speed: game.craft.speed, gates: 6 });
  for (const pickup of game.course.pickups.slice(0, game.mission.cargo)) game.collected.add(pickup.id);
  return game;
}

test('a complete delivery arriving within the final available step succeeds', () => {
  const game = finalApproach();
  assert.ok((game.mission.length - game.distance) / game.speed < game.time);
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.status, 'won');
  assert.equal(game.reason, '');
  assert.equal(game.distance, game.mission.length);
  assert.equal(game.time, 0);
  const score = game.score;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.score, score);
});

test('the final available step cannot grant distance beyond the deadline', () => {
  const game = finalApproach();
  game.distance = game.mission.length - 1;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.reason, 'time');
  assert.ok(game.distance < game.mission.length);
});

test('last-moment arrival still requires cargo and a surviving craft', () => {
  const empty = finalApproach();
  empty.collected.clear();
  updateGame(empty, { accelerate: true }, 1 / 60);
  assert.equal(empty.status, 'lost');
  assert.equal(empty.reason, 'cargo');
  const damaged = finalApproach();
  Object.assign(damaged, { hull: 8, lane: 15, lateralSpeed: 16 });
  updateGame(damaged, { accelerate: true, steer: 1 }, 1 / 60);
  assert.equal(damaged.status, 'lost');
  assert.equal(damaged.reason, 'hull');
});
