import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, makeCourse } from '../src/missions.js';
import { createGame, startGame, updateGame } from '../src/game.js';
import { pilotInput } from '../src/pilots.js';
import { getContracts } from '../src/expedition.js';

const special = id => {
  const mission = MISSIONS.find(item => item.id === id);
  assert.ok(mission, `missing special map ${id}`);
  return mission;
};

test('Earth and overdrive contain no damaging or low-gravity course objects', () => {
  for (const id of ['earth', 'overdrive']) {
    const mission = special(id), course = makeCourse(mission);
    assert.deepEqual(course, makeCourse(mission));
    for (const key of ['obstacles', 'meteors', 'gravityZones']) assert.deepEqual(course[key], []);
    assert.ok(course.pickups.length > mission.cargo + 3);
    assert.equal(course.gates.length, 6);
    assert.ok(course.gates.every(gate => gate.lane === 0));
  }
});

test('safe-route boundary damage identifies the road edge instead of a nonexistent obstacle', () => {
  for (const id of ['earth', 'overdrive']) {
    const game = createGame(id, 'nova');
    Object.assign(game, { status: 'running', lane: 15, speed: 200 });
    updateGame(game, { accelerate: true, steer: 1 }, 1 / 60);
    assert.equal(game.hull, game.craft.hull - 8);
    assert.deepEqual(game.events.find(event => event.type === 'impact'), { type: 'impact', source: 'boundary' });
  }
});

test('overdrive offers full-width boost coverage from launch to the finish', () => {
  const mission = special('overdrive'), { pads } = makeCourse(mission);
  assert.ok(pads.length >= mission.length / 300);
  assert.ok(pads[0].distance <= 30 && mission.length - pads.at(-1).distance <= 240);
  assert.ok(pads.every((pad, i) => pad.width >= 30 && (!i || pad.distance - pads[i - 1].distance <= 240)));
  for (const lane of [-14, 0, 14]) {
    const game = createGame(mission.id, 'nova');
    Object.assign(game, { status: 'running', distance: pads[0].distance - 1, lane, speed: 100 });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.activatedPads.size, 1);
    assert.ok(game.padBoost > 0);
  }
  const game = createGame(mission.id, 'hauler');
  startGame(game);
  while (game.elapsed < 45) {
    updateGame(game, { accelerate: true }, 1 / 60);
    if (game.distance > 500) assert.equal(game.speed, game.craft.boostSpeed);
  }
  assert.equal(game.impacts, 0);
  assert.equal(game.energy, 100);
  for (let i = 0; i < 120; i++) updateGame(game, { brake: true }, 1 / 60);
  assert.equal(game.speed, 0, 'brakes must override the accelerator track');
});

test('apocalypse is dense with obstacles but every row leaves a navigable opening', () => {
  const mission = special('apocalypse'), course = makeCourse(mission);
  assert.ok(course.obstacles.length > mission.length / 130);
  assert.ok(course.meteors.length >= 30);
  assert.equal(course.pads.length, 0);
  const rows = Map.groupBy(course.obstacles, object => object.distance);
  let previous = 0;
  for (const [distance, obstacles] of rows) {
    assert.ok(distance - previous <= 1000);
    assert.ok([-9, 0, 9].some(lane => obstacles.every(object => Math.abs(object.lane - lane) > object.radius + 1.1)));
    previous = distance;
  }
  const game = createGame(mission.id, 'nova');
  Object.assign(game, { status: 'running' });
  while (game.status === 'running' && game.distance < 6000) updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.impacts > 3, 'dense course must require active avoidance');
});

test('special maps remain completable with basic craft and offer achievable expedition contracts', () => {
  for (const id of ['overdrive', 'apocalypse', 'earth']) for (const craft of ['hauler', 'nova']) {
    special(id);
    const game = createGame(id, craft);
    startGame(game);
    const contracts = getContracts(game);
    assert.ok(contracts.every(contract => contract.id !== 'dodge' || game.course.obstacles.length));
    assert.ok(contracts.every(contract => contract.id !== 'pads' || game.course.pads.length >= contract.target));
    for (let i = 0; i < (game.mission.duration + 4) * 60 && ['running', 'countdown'].includes(game.status); i++) {
      updateGame(game, pilotInput(game, { coast: 0, offset: 0 }), 1 / 60);
    }
    assert.equal(game.status, 'won', `${id}/${craft}: ${game.reason}`);
    if (id !== 'apocalypse') assert.equal(game.impacts, 0);
  }
});
