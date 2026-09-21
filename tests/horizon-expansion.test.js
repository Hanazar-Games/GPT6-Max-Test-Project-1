import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS, makeCourse } from '../src/missions.js';
import { createGame, startGame, updateGame, togglePause } from '../src/game.js';
import { getDriveStatus } from '../src/drive-status.js';
import { filterCrafts, filterMissions } from '../src/catalogue.js';

function flight() {
  const game = createGame();
  game.status = 'running';
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

test('four new destinations and four distinct ships extend the advanced rally catalogue', () => {
  assert.equal(MISSIONS.length, 58);
  assert.equal(CRAFTS.length, 40);
  const routes = MISSIONS.slice(54);
  assert.deepEqual(routes.map(m => m.length), [32000, 56000, 96000, 128000]);
  assert.equal(new Set(routes.map(m => m.biome)).size, 4);
  assert.equal(new Set(routes.map(m => m.layout)).size, 2);
  assert.deepEqual(filterMissions('精准', 'advanced'), routes);
  for (const mission of routes) {
    const course = makeCourse(mission);
    assert.ok(mission.advanced && mission.tour);
    assert.ok(filterMissions(mission.planet, 'tour').includes(mission));
    assert.ok(mission.bridges.length >= 3);
    assert.equal(new Set(course.powerups.map(p => p.kind)).size, 5);
    assert.equal(new Set(course.challenges.map(p => p.kind)).size, 3);
    for (const list of [course.powerups, course.challenges]) {
      assert.ok(list.every((item, index) => !index || item.distance > list[index - 1].distance));
      assert.ok(list.every(item => item.distance < mission.length - 100));
    }
  }
  for (const craft of CRAFTS.slice(36)) assert.deepEqual(filterCrafts(craft.model.replace('–', '-')), [craft]);
});

test('battery restores only energy, caps at 100 and cannot be collected twice or from high altitude', () => {
  const game = flight();
  game.course.powerups = [{ id: 0, kind: 'battery', distance: 110, lane: 0 }];
  Object.assign(game, { distance: 100, speed: 400, energy: 10, hull: 70 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.energy, 67.5);
  assert.equal(game.hull, 70);
  assert.equal(game.collected.size, 0);
  Object.assign(game, { distance: 100, speed: 400, energy: 10 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.energy, 7.5);
  game.powerupsTaken.clear();
  Object.assign(game, { distance: 100, speed: 400, energy: 90, height: 4 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.powerupsTaken.size, 0);
  Object.assign(game, { distance: 100, speed: 400, height: 0 });
  updateGame(game, { boost: true }, .1);
  assert.equal(game.energy, 100);
});

test('overdrive grants five seconds of free boost, supports braking and freezes during pause', () => {
  const game = flight();
  game.course.powerups = [{ id: 0, kind: 'overdrive', distance: 101, lane: 0 }];
  Object.assign(game, { distance: 100, speed: 170, energy: 20 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.overdriveTime, 5);
  const energy = game.energy;
  updateGame(game, { boost: true }, .1);
  assert.equal(game.boosting, true);
  assert.ok(game.speed > 170 && game.energy > energy);
  assert.equal(getDriveStatus(game).kind, 'overdrive');
  const speed = game.speed;
  updateGame(game, { brake: true, boost: true }, .1);
  assert.equal(game.boosting, false);
  assert.ok(game.speed < speed);
  togglePause(game);
  const remaining = game.overdriveTime;
  updateGame(game, {}, .1);
  assert.equal(game.overdriveTime, remaining);
  togglePause(game);
  game.overdriveTime = .01;
  updateGame(game, {}, .1);
  assert.equal(game.overdriveTime, 0);
  assert.equal(game.boosting, false);
  game.overdriveTime = 4;
  startGame(game);
  assert.equal(game.overdriveTime, 0);
});

test('unshielded impacts and missed gates cancel overdrive while a shield preserves it', () => {
  for (const shield of [false, true]) {
    const game = flight();
    Object.assign(game, { distance: 100, speed: 170, overdriveTime: 5, shieldTime: shield ? 12 : 0 });
    game.course.obstacles = [{ id: 0, distance: 101, lane: 0, radius: 2.8, kind: 'rock' }];
    updateGame(game, {}, 1 / 60);
    assert.equal(game.overdriveTime > 0, shield);
  }
  const game = flight();
  Object.assign(game, { distance: 100, speed: 170, overdriveTime: 5, lane: 14 });
  game.course.gates = [{ id: 0, distance: 101, lane: 0, width: 9 }];
  updateGame(game, {}, 1 / 60);
  assert.equal(game.overdriveTime, 0);
});

test('precision rings require a centered low-altitude fast crossing and cannot be farmed', () => {
  for (const [lane, height, fast, success] of [[1.49, 0, true, true], [-1.49, 0, true, true], [1.5, 0, true, false], [0, 2.5, true, false], [0, 0, false, false]]) {
    const game = flight();
    game.course.challenges = [{ id: 0, kind: 'precision', distance: 101, lane: 0 }];
    Object.assign(game, { distance: 100, speed: fast ? 200 : 100, lane, height });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.challengeHits, Number(success));
    assert.equal(game.precisionHits, Number(success));
    assert.equal(game.score, success ? 450 : 0);
    game.distance = 100;
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.score, success ? 450 : 0);
    startGame(game);
    assert.equal(game.precisionHits, 0);
  }
});
