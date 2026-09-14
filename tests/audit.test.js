import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, getFlightCue } from '../src/game.js';
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
