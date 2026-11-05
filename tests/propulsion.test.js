import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, startGame, togglePause } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';

function flight(state = {}, craft = 'scout') {
  const game = createGame('tranquility', craft, {}, { density: 0 });
  Object.assign(game, { status: 'running', speed: 200, energy: 50 }, state);
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
const advance = (game, input, steps, duration = .1) => {
  for (let i = 0; i < steps; i++) updateGame(game, input, duration / steps);
  return game;
};

test('manual boost ends at the energy reserve and integrates the remaining coast and recharge', () => {
  for (const steps of [1, 6, 12]) {
    const game = advance(flight({ energy: 1.25 }), { accelerate: true, boost: true }, steps);
    near(game.speed, 197.78, 'speed');
    near(game.distance, 20.0051, 'distance');
    near(game.energy, 1.99, 'energy');
    assert.equal(game.boosting, false);
    assert.equal(game.boostLocked, true);
  }
});

test('powered pads and overdrive retain their full remaining fraction of a step', () => {
  for (const timer of ['padBoost', 'overdriveTime']) for (const steps of [1, 6, 12]) {
    const game = advance(flight({ [timer]: .025 }), { accelerate: true }, steps);
    near(game.speed, 201.65, `${timer} speed`);
    near(game.distance, 20.324375, `${timer} distance`);
    near(game.energy, 51.1, `${timer} energy`);
    assert.equal(game[timer], 0);
    assert.equal(game.boosting, false);
  }
});

test('overlapping free powers last until the later expiry without adding their durations', () => {
  for (const steps of [1, 6, 12]) {
    const game = advance(flight({ padBoost: .02, overdriveTime: .07 }), { accelerate: true }, steps);
    near(game.speed, 213.26, 'overlapping speed');
    near(game.distance, 20.9339, 'overlapping distance');
    near(game.energy, 51.1, 'overlapping energy');
    assert.equal(game.padBoost, 0); assert.equal(game.overdriveTime, 0);
  }
});

test('free boost hands off to held manual boost with energy charged only after expiry', () => {
  for (const steps of [1, 6, 12]) {
    const game = advance(flight({ padBoost: .025 }), { boost: true }, steps);
    near(game.speed, 221, 'handoff speed');
    near(game.distance, 21.05, 'handoff distance');
    near(game.energy, 48.4, 'handoff energy');
    assert.equal(game.boosting, true); assert.equal(game.boostLocked, false);
  }
});

test('exact depletion and free expiry do not retain a spurious final frame from rounding', () => {
  for (const steps of [1, 6, 12, 60]) {
    const manual = advance(flight({ energy: 3.5 }), { boost: true }, steps);
    assert.equal(manual.energy, 1);
    assert.equal(manual.boostLocked, true); assert.equal(manual.boosting, false);
    for (const timer of ['padBoost', 'overdriveTime']) {
      const free = advance(flight({ [timer]: .1 }), {}, steps);
      assert.equal(free[timer], 0);
      assert.equal(free.boosting, false);
      near(free.distance, 21.05, 'exact expiry distance');
    }
  }
});

test('free boost, manual depletion and recharge can all occur within the same update', () => {
  for (const steps of [1, 6, 12]) {
    const game = advance(flight({ padBoost: .025, energy: 1.25 }), { accelerate: true, boost: true }, steps);
    near(game.speed, 207.068, 'three-phase speed');
    near(game.distance, 20.673836, 'three-phase distance');
    near(game.energy, 1.594, 'three-phase energy');
    assert.equal(game.boostLocked, true); assert.equal(game.boosting, false);
  }
});

test('braking overrides every boost source while free timers continue to expire', () => {
  for (const steps of [1, 6, 12]) {
    const game = advance(flight({ padBoost: .025, overdriveTime: .07 }), { brake: true, boost: true }, steps);
    near(game.speed, 174, 'braking speed');
    near(game.distance, 18.7, 'braking distance');
    near(game.energy, 51.1, 'braking energy');
    assert.equal(game.boosting, false);
    assert.equal(game.padBoost, 0); assert.equal(game.overdriveTime, 0);
  }
});

test('holding an exhausted boost stays locked across a free boost until a real release', () => {
  const game = flight({ energy: 1.25 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.boostLocked, true);
  game.padBoost = .025;
  updateGame(game, { boost: true }, .1);
  assert.equal(game.boosting, false); assert.equal(game.boostLocked, true);
  const energy = game.energy;
  updateGame(game, { boost: true, boostReleased: true }, .01);
  assert.equal(game.boosting, true); assert.equal(game.boostLocked, false);
  near(game.energy, energy - .25, 'repress energy');
});

test('propulsion transitions remain consistent for every craft including speed caps and energy saturation', () => {
  for (const craft of CRAFTS) for (const state of [
    { energy: 1.25 }, { energy: .5 }, { padBoost: .025 }, { overdriveTime: .035, energy: 99.99 },
    { padBoost: .025, energy: 1.25 }, { padBoost: .025, speed: craft.boostSpeed - 1 },
    { padBoost: .025, boostLocked: true },
  ]) for (const input of [{ boost: true }, { accelerate: true }, { brake: true, boost: true }]) {
    const one = advance(flight(state, craft.id), input, 1), many = advance(flight(state, craft.id), input, 12);
    for (const key of ['distance', 'speed', 'energy', 'padBoost', 'overdriveTime']) near(one[key], many[key], `${craft.id}/${key}`);
    assert.equal(one.boosting, many.boosting, craft.id);
    assert.equal(one.boostLocked, many.boostLocked, craft.id);
  }
});

test('pause and retry preserve or reset timed propulsion, and mission timeout limits it', () => {
  const paused = flight({ padBoost: .025, overdriveTime: .05, energy: 1.25 });
  togglePause(paused);
  const snapshot = structuredClone(paused);
  updateGame(paused, { boost: true }, .1);
  assert.deepEqual(paused, snapshot);
  startGame(paused);
  assert.equal(paused.padBoost, 0); assert.equal(paused.overdriveTime, 0);
  assert.equal(paused.energy, 100); assert.equal(paused.boostLocked, false);
  const expiring = flight({ time: .01, padBoost: .025, energy: 50 });
  updateGame(expiring, { boost: true }, .1);
  assert.equal(expiring.status, 'lost');
  near(expiring.distance, 2.0105, 'timeout distance');
  near(expiring.energy, 50.11, 'timeout energy');
});
