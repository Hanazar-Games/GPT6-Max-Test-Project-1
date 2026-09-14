import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getFlightCue } from '../src/game.js';

test('guidance points toward the next gate and recognizes a centered approach', () => {
  const game = createGame();
  game.course.obstacles = [];
  game.course.gates[0].lane = -6;
  assert.equal(getFlightCue(game).direction, 'left');
  game.lane = -6;
  assert.equal(getFlightCue(game).direction, 'center');
  game.lane = -12;
  assert.equal(getFlightCue(game).direction, 'right');
  game.gates = 6;
  assert.equal(getFlightCue(game).kind, 'finish');
});

test('hazard cues predict drone position at arrival, and ignore obstacles behind or outside the lane', () => {
  const game = createGame();
  Object.assign(game, { speed: 30, distance: 100, lane: 0 });
  game.course.obstacles = [{ distance: 130, lane: 0, kind: 'drone', radius: 2, phase: -1, frequency: 1 }];
  assert.equal(getFlightCue(game).kind, 'hazard');
  game.lane = 10;
  assert.equal(getFlightCue(game).kind, 'gate');
  game.lane = 0;
  game.distance = 135;
  assert.equal(getFlightCue(game).kind, 'gate');
});

test('a jump that clears the projected collision suppresses the warning, but an early landing does not', () => {
  const game = createGame();
  Object.assign(game, { speed: 30, height: 3.5, verticalSpeed: 0 });
  game.course.obstacles = [{ distance: 3, lane: 0, kind: 'rock', radius: 2 }];
  assert.equal(getFlightCue(game).kind, 'gate');
  game.course.obstacles[0].distance = 30;
  assert.equal(getFlightCue(game).kind, 'hazard');
});
