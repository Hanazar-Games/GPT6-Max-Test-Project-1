import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, togglePause, PHYSICS } from '../src/game.js';

function running() {
  const game = createGame();
  startGame(game);
  for (let i = 0; i < 181; i++) updateGame(game, {}, 1 / 60);
  return game;
}

test('launch counts down before movement and resets a previous run', () => {
  const game = createGame();
  startGame(game);
  updateGame(game, { accelerate: true }, 0.1);
  assert.equal(game.status, 'countdown');
  assert.equal(game.distance, 0);
  game.hull = 12;
  startGame(game);
  assert.equal(game.hull, 100);
  assert.equal(game.collected.size, 0);
});

test('accelerating advances and braking slows the craft', () => {
  const game = running();
  for (let i = 0; i < 120; i++) updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.speed > 20);
  assert.ok(game.distance > 20);
  const speed = game.speed;
  for (let i = 0; i < 30; i++) updateGame(game, { brake: true }, 1 / 60);
  assert.ok(game.speed < speed);
});

test('pause freezes countdown, mission time and motion', () => {
  const game = running();
  togglePause(game);
  const before = { ...game };
  updateGame(game, { accelerate: true }, 0.1);
  assert.deepEqual(game, before);
  togglePause(game);
  assert.equal(game.status, 'running');
  startGame(game);
  togglePause(game);
  updateGame(game, {}, 0.1);
  assert.equal(game.countdown, 3);
  togglePause(game);
  assert.equal(game.status, 'countdown');
});

test('boost consumes energy and energy recovers within its bounds', () => {
  const game = running();
  for (let i = 0; i < 100; i++) updateGame(game, { accelerate: true, boost: true }, 1 / 60);
  assert.ok(game.speed > game.craft.speed);
  assert.ok(game.energy < 100);
  const energy = game.energy;
  for (let i = 0; i < 60; i++) updateGame(game, {}, 1 / 60);
  assert.ok(game.energy > energy);
  assert.ok(game.energy <= 100);
});

test('a pickup is awarded exactly once and recharges the craft', () => {
  const game = running();
  const pickup = game.course.pickups[0];
  game.distance = pickup.distance - 0.2;
  game.lane = pickup.lane;
  game.speed = 20;
  game.energy = 40;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.collected.has(pickup.id));
  assert.ok(game.energy > 50);
  const score = game.score;
  game.distance = pickup.distance - 0.2;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.score, score);
});

test('holding boost after depletion cannot repeatedly trigger free bursts', () => {
  const game = running();
  game.energy = 2;
  for (let i = 0; i < 45; i++) {
    updateGame(game, { accelerate: true, boost: true }, 1 / 60);
    if (i > 12) assert.equal(game.boosting, false);
  }
  assert.equal(game.boosting, false);
  assert.ok(game.energy > 3);
  updateGame(game, { accelerate: true }, 1 / 60);
  updateGame(game, { accelerate: true, boost: true }, 1 / 60);
  assert.equal(game.boosting, true);
});

test('collision damages hull and grants brief impact immunity', () => {
  const game = running();
  const rock = game.course.obstacles[0];
  game.distance = rock.distance - 0.2;
  game.lane = rock.lane;
  game.speed = 20;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.ok(game.hull < 100);
  const hull = game.hull;
  game.distance = rock.distance - 0.2;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, hull);
});

test('missing a gate returns the craft before that gate and costs mission time', () => {
  const game = running();
  game.distance = game.course.gates[0].distance - 0.2;
  game.lane = 14;
  game.speed = 20;
  const time = game.time;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.gates, 0);
  assert.ok(game.distance < game.course.gates[0].distance - 10);
  assert.ok(game.time < time - 3);
});

test('mission ends when time or hull runs out', () => {
  const expired = running();
  expired.time = 0.001;
  updateGame(expired, {}, 1 / 60);
  assert.equal(expired.status, 'lost');
  assert.equal(expired.reason, 'time');
  const destroyed = running();
  destroyed.hull = 0;
  updateGame(destroyed, {}, 1 / 60);
  assert.equal(destroyed.status, 'lost');
  assert.equal(destroyed.reason, 'hull');
});

test('finishing without enough energy cores fails the delivery', () => {
  const game = running();
  game.distance = game.mission.length - 0.2;
  game.gates = game.course.gates.length;
  game.speed = 20;
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.status, 'lost');
  assert.equal(game.reason, 'cargo');
});

test('a complete continuously simulated run is winnable', () => {
  const game = running();
  for (let i = 0; i < 6000 && game.status === 'running'; i++) {
    const nextRock = game.course.obstacles.find((rock) => rock.distance > game.distance - 5 && rock.distance < game.distance + 35);
    const target = nextRock && Math.abs(nextRock.lane) < 4 ? -7 : 0;
    const steer = Math.max(-1, Math.min(1, (target - game.lane) * 0.4));
    updateGame(game, { accelerate: true, steer }, 1 / 60);
  }
  assert.equal(game.status, 'won');
  assert.equal(game.gates, 6);
  assert.ok(game.collected.size >= game.mission.cargo);
  assert.ok(game.score > 0);
});

test('terminal states cannot advance and a retry resets every resource', () => {
  const game = running();
  game.time = 0;
  updateGame(game, {}, 1 / 60);
  const distance = game.distance;
  updateGame(game, { accelerate: true }, 0.1);
  assert.equal(game.distance, distance);
  startGame(game);
  assert.equal(game.distance, 0);
  assert.equal(game.energy, 100);
  assert.equal(game.time, game.mission.duration);
  assert.equal(game.status, 'countdown');
});

test('lateral movement is bounded even when steering against the edge', () => {
  const game = running();
  for (let i = 0; i < 120; i++) updateGame(game, { accelerate: true, steer: 1 }, 1 / 60);
  assert.ok(game.lane <= PHYSICS.width);
  assert.ok(game.hull < 100);
});
