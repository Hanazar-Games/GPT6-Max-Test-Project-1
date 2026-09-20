import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS, makeCourse } from '../src/missions.js';
import { createGame, startGame, updateGame, togglePause, getFlightCue } from '../src/game.js';
import { pickupRange } from '../src/route-rewards.js';

function running() {
  const game = createGame();
  game.status = 'running';
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

test('the original rally routes retain their distances and rewards stay ordered across the atlas', () => {
  assert.equal(MISSIONS.length, 54); assert.equal(CRAFTS.length, 36);
  assert.deepEqual(MISSIONS.slice(44, 48).map(m => m.length), [20000, 20000, 20000, 50000]);
  for (const mission of MISSIONS) {
    const course = makeCourse(mission);
    assert.equal(new Set(course.powerups.map(item => item.kind)).size, mission.tour ? 3 : 0);
    assert.equal(new Set(course.challenges.map(item => item.kind)).size, mission.tour ? 2 : 0);
    for (const list of [course.pickups, course.obstacles, course.pads, course.meteors, course.powerups, course.challenges]) {
      assert.ok(list.every((item, i) => !i || item.distance >= list[i - 1].distance), mission.id);
    }
    for (const item of [...course.powerups, ...course.challenges]) {
      assert.ok(item.distance > 100 && item.distance < mission.length - 100);
      assert.ok(course.gates.every(g => Math.abs(g.distance - item.distance) > 200));
      assert.ok(course.obstacles.every(o => Math.abs(o.distance - item.distance) > 140));
    }
  }
});

test('repair pickups use swept contact, cap resources, and never grant cargo or repeat', () => {
  const game = running();
  game.course.powerups = [{ id: 0, kind: 'repair', distance: 110, lane: 0 }];
  Object.assign(game, { distance: 100, speed: 400, hull: 80, energy: 80 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.hull, game.craft.hull); assert.equal(game.energy, 100);
  assert.equal(game.collected.size, 0); assert.equal(game.powerupsTaken.size, 1);
  Object.assign(game, { distance: 100, speed: 400, hull: 70 });
  updateGame(game, {}, .1); assert.equal(game.hull, 70);
});

test('one shield absorbs one collision without slowing, then ordinary collision rules return', () => {
  const game = running();
  game.shieldTime = 12;
  game.course.obstacles = [{ id: 0, distance: 103, lane: 0, kind: 'rock', radius: 2.8 }];
  Object.assign(game, { distance: 100, speed: 170, combo: 3 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, game.craft.hull); assert.equal(game.speed, 170);
  assert.equal(game.combo, 3); assert.equal(game.shieldTime, 0); assert.equal(game.shieldBlocks, 1);
  assert.ok(game.events.some(e => e.type === 'shield-block'));
  Object.assign(game, { distance: 100, immunity: 0 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, game.craft.hull - 24);
});

test('magnet range affects pickups and guidance without changing the craft configuration', () => {
  const game = running();
  game.magnetTime = 8;
  game.course.pickups = [{ id: 0, distance: 103, lane: 8 }];
  Object.assign(game, { distance: 100, speed: 170 });
  assert.equal(getFlightCue(game).aligned, true);
  assert.equal(pickupRange(game), 9);
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.collected.size, 1); assert.equal(game.craft.pickupRange, 3.7);
});

test('temporary powers freeze on pause, expire during flight and reset on retry', () => {
  const game = running();
  Object.assign(game, { shieldTime: .1, magnetTime: .1 });
  togglePause(game); updateGame(game, {}, .1);
  assert.equal(game.shieldTime, .1); assert.equal(game.magnetTime, .1);
  togglePause(game); updateGame(game, {}, .1);
  assert.equal(game.shieldTime, 0); assert.equal(pickupRange(game), game.craft.pickupRange);
  game.powerupsTaken.add(1); game.challengesResolved.add(1); game.challengeChain = 4;
  startGame(game);
  assert.equal(game.powerupsTaken.size, 0); assert.equal(game.challengesResolved.size, 0); assert.equal(game.challengeChain, 0);
});

test('optional guidance yields to imminent gates and hazards', () => {
  const game = running();
  game.speed = 200; game.course.powerups = [{ id: 0, kind: 'shield', distance: 150, lane: -7 }];
  assert.equal(getFlightCue(game).kind, 'powerup');
  game.course.gates = [{ id: 0, distance: 180, lane: 0, width: 9 }];
  assert.equal(getFlightCue(game).kind, 'gate');
  game.course.obstacles = [{ id: 0, distance: 80, lane: 0, kind: 'rock', radius: 2.8 }];
  assert.equal(getFlightCue(game).kind, 'hazard');
});

test('a wide magnet still cannot collect cores while airborne', () => {
  const game = running();
  Object.assign(game, { magnetTime: 8, height: 4, distance: 100, speed: 400 });
  game.course.pickups = [{ id: 0, distance: 105, lane: 8 }];
  updateGame(game, {}, 1 / 60); assert.equal(game.collected.size, 0);
});

test('collision queries skip distant objects without losing a high-speed contact or a missed-core penalty', () => {
  const game = running(); let reads = 0;
  game.course.pickups = Array.from({ length: 10000 }, (_, id) => ({ id, lane: id % 2 ? 0 : 12, get distance() { reads++; return id * 10; } }));
  Object.assign(game, { distance: 20000, speed: 480, combo: 4 });
  game.mission = { ...game.mission, length: 100000 };
  updateGame(game, { boost: true }, .1);
  assert.ok(game.collected.has(2001)); assert.ok(game.missedPickups.has(2000));
  assert.ok(reads < 150, `read ${reads} distances for one simulation step`);
});

test('optional speed and jump rings evaluate the crossing pose, chain rewards, and cannot be farmed after rewinding', () => {
  const game = running();
  game.course.challenges = [{ id: 0, distance: 110, lane: 0, kind: 'speed' }, { id: 1, distance: 140, lane: 0, kind: 'jump' }];
  Object.assign(game, { distance: 100, speed: 200 });
  updateGame(game, { accelerate: true }, .1);
  assert.equal(game.challengeHits, 1); assert.equal(game.challengeChain, 1);
  Object.assign(game, { distance: 130, speed: 200, height: 3.5, verticalSpeed: 0 });
  updateGame(game, { accelerate: true }, .1);
  assert.equal(game.challengeHits, 2); assert.equal(game.challengeChain, 2);
  const score = game.score;
  Object.assign(game, { distance: 100, speed: 200, height: 0 });
  updateGame(game, { accelerate: true }, .1);
  assert.equal(game.score, score);
  game.course.challenges.push({ id: 2, distance: 160, lane: 8, kind: 'speed' });
  Object.assign(game, { distance: 150, speed: 200 });
  updateGame(game, { accelerate: true }, .1);
  assert.equal(game.challengeChain, 0); assert.equal(game.maxChallengeChain, 2);
});
