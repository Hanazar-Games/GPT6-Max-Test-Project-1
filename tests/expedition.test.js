import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS, makeCourse } from '../src/missions.js';
import { createGame, startGame, updateGame, togglePause, obstacleLane, getDebrief } from '../src/game.js';
import { FlightRecorder, MAX_GHOST_SAMPLES, saveRecord } from '../src/ghost.js';
import { pilotInput } from '../src/pilots.js';

function running(missionId = 'tranquility', craftId = 'scout') {
  const game = createGame(missionId, craftId);
  startGame(game);
  for (let i = 0; i < 181; i++) updateGame(game, {}, 1 / 60);
  return game;
}

test('ten distinct missions provide deterministic, reachable route objects', () => {
  assert.equal(MISSIONS.length, 10);
  const layouts = new Set();
  for (const mission of MISSIONS) {
    const course = makeCourse(mission);
    assert.deepEqual(course, makeCourse(mission));
    assert.equal(course.gates.length, 6);
    assert.ok(course.pickups.length > mission.cargo);
    for (const kind of ['gates', 'pickups', 'obstacles', 'pads']) {
      assert.equal(new Set(course[kind].map(object => object.id)).size, course[kind].length);
      assert.ok(course[kind].every(object => object.distance > 0 && object.distance < mission.length && Math.abs(object.lane) <= 12));
    }
    layouts.add(JSON.stringify(course));
  }
  assert.equal(layouts.size, MISSIONS.length);
});

test('retry preserves selected mission and craft while resetting run resources', () => {
  const game = running('eclipse', 'hauler');
  game.combo = 5;
  game.hull = 10;
  game.height = 3;
  startGame(game);
  assert.equal(game.mission.id, 'eclipse');
  assert.equal(game.craft.id, 'hauler');
  assert.equal(game.hull, game.craft.hull);
  assert.equal(game.time, game.mission.duration);
  assert.equal(game.height, 0);
  assert.equal(game.combo, 0);
  assert.equal(game.activatedPads.size, 0);
});

test('craft choice changes speed and survivability', () => {
  const scout = running('tranquility', 'scout');
  const racer = running('tranquility', 'interceptor');
  const hauler = running('tranquility', 'hauler');
  for (let i = 0; i < 170; i++) {
    for (const game of [scout, racer, hauler]) updateGame(game, { accelerate: true }, 1 / 60);
  }
  assert.ok(racer.speed > scout.speed && scout.speed > hauler.speed);
  assert.ok(hauler.hull > scout.hull && scout.hull > racer.hull);
});

test('jump rises, consumes energy, and requires release before another jump', () => {
  const game = running();
  updateGame(game, { jump: true }, 1 / 60);
  assert.ok(game.height > 0);
  assert.ok(game.energy < 90);
  let highest = game.height;
  for (let i = 0; i < 120; i++) { updateGame(game, { jump: true }, 1 / 60); highest = Math.max(highest, game.height); }
  assert.ok(highest > 3);
  assert.equal(game.height, 0);
  updateGame(game, {}, 1 / 60);
  updateGame(game, { jump: true }, 1 / 60);
  assert.ok(game.height > 0);
});

test('insufficient energy prevents jumping and a paused jump freezes', () => {
  const game = running();
  game.energy = 5;
  updateGame(game, { jump: true }, 1 / 60);
  assert.equal(game.height, 0);
  game.energy = 100;
  updateGame(game, {}, 1 / 60);
  updateGame(game, { jump: true }, 1 / 60);
  togglePause(game);
  const height = game.height;
  const elapsed = game.elapsed;
  updateGame(game, {}, 0.1);
  assert.equal(game.height, height);
  assert.equal(game.elapsed, elapsed);
});

test('jumping over a rock avoids damage and grants an aerial dodge only once', () => {
  const game = running();
  const rock = game.course.obstacles.find(object => object.kind === 'rock');
  Object.assign(game, { distance: rock.distance - 0.2, lane: rock.lane, speed: 30, height: 4 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, game.craft.hull);
  assert.equal(game.airDodges, 0);
  for (let i = 0; i < 7; i++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.airDodges, 1);
  const score = game.score;
  game.distance = rock.distance - 0.2;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.airDodges, 1);
  assert.equal(game.score, score);
});

test('moving drones use their current lane for collisions', () => {
  const game = running('eclipse');
  const drone = game.course.obstacles.find(object => object.kind === 'drone');
  assert.notEqual(obstacleLane(drone, 0), obstacleLane(drone, 2));
  game.elapsed = 2;
  game.distance = drone.distance - 0.2;
  game.speed = 30;
  game.lane = obstacleLane(drone, game.elapsed + 1 / 60);
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.hull < game.craft.hull);
});

test('accelerator pads activate once, launch the craft and expire', () => {
  const game = running();
  const pad = game.course.pads[0];
  Object.assign(game, { distance: pad.distance - 0.1, lane: pad.lane, speed: 20 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.activatedPads.has(pad.id));
  assert.ok(game.padBoost > 0);
  for (let i = 0; i < 30; i++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.speed > game.craft.speed);
  game.distance = pad.distance - 0.1;
  const remaining = game.padBoost;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.padBoost < remaining);
});

test('braking on an unused accelerator pad never forces the craft forward', () => {
  const game = running();
  const pad = game.course.pads[0];
  Object.assign(game, { distance: pad.distance - 1, lane: pad.lane, speed: 0 });
  updateGame(game, { brake: true }, 1 / 60);
  assert.equal(game.speed, 0);
  assert.equal(game.activatedPads.size, 0);
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.activatedPads.has(pad.id));
});

test('an obstacle already hit cannot later grant an aerial dodge reward', () => {
  const game = running();
  const rock = game.course.obstacles[0];
  Object.assign(game, { distance: rock.distance - 2.8, lane: rock.lane, speed: 20 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.hull < game.craft.hull);
  Object.assign(game, { distance: rock.distance - 0.1, height: 4 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.airDodges, 0);
});

test('failed deliveries receive no completion medals despite good driving stats', () => {
  const game = running();
  Object.assign(game, { status: 'lost', perfectGates: 6, airDodges: 4, impacts: 0 });
  assert.deepEqual(getDebrief(game), { medals: [], rank: '—' });
});

test('consecutive core pickups increase score, misses and impacts break the chain', () => {
  const game = running();
  for (const pickup of game.course.pickups.slice(0, 4)) {
    Object.assign(game, { distance: pickup.distance - 0.1, lane: pickup.lane, speed: 30 });
    updateGame(game, { accelerate: true }, 1 / 60);
  }
  assert.equal(game.combo, 4);
  assert.equal(game.maxCombo, 4);
  assert.ok(game.score > 4 * 150);
  const missed = game.course.pickups[4];
  Object.assign(game, { distance: missed.distance + 3.9, lane: 14, speed: 30 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.combo, 0);
  game.combo = 4;
  const rock = game.course.obstacles[0];
  Object.assign(game, { distance: rock.distance - 0.1, lane: rock.lane, speed: 30 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.combo, 0);
});

test('a centered fast gate pass earns a perfect bonus without replay farming', () => {
  const game = running();
  const gate = game.course.gates[0];
  Object.assign(game, { distance: gate.distance - 0.1, lane: gate.lane, speed: game.craft.speed });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.perfectGates, 1);
  assert.equal(game.gates, 1);
  const score = game.score;
  game.distance = gate.distance - 0.1;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.score, score);
});

test('every mission and craft combination can complete and record a continuous run', () => {
  const records = new Map();
  for (const mission of MISSIONS) for (const craft of CRAFTS) {
    const game = createGame(mission.id, craft.id);
    startGame(game);
    const recorder = new FlightRecorder(game);
    for (let i = 0; i < 9000 && ['countdown', 'running'].includes(game.status); i++) {
      updateGame(game, pilotInput(game, { coast: 0, offset: 0 }), 1 / 60);
      recorder.capture(game);
    }
    assert.equal(game.status, 'won', `${mission.id}/${craft.id}: ${game.reason}, cargo ${game.collected.size}, gates ${game.gates}`);
    const debrief = getDebrief(game);
    assert.ok(debrief.medals.length >= 1);
    assert.ok(['S', 'A', 'B'].includes(debrief.rank));
    assert.equal(saveRecord(records, game, recorder).newBest, true);
    const ghost = records.get(`${mission.id}/${craft.id}`).ghost;
    assert.equal(ghost.splits.length, 7);
    assert.equal(ghost.samples.at(-1).time, game.elapsed);
    assert.ok(ghost.samples.length < MAX_GHOST_SAMPLES);
  }
  assert.equal(records.size, MISSIONS.length * CRAFTS.length);
});
