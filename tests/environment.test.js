import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, makeCourse } from '../src/missions.js';
import { createGame, startGame, updateGame, togglePause, getFlightCue } from '../src/game.js';
import { ENVIRONMENT, gravityAt, meteorState, meteorContact } from '../src/environment.js';
import { pilotInput } from '../src/pilots.js';

const meteor = { id: 0, distance: 100, lane: 0, radius: 5, first: 4, period: 10 };
const pose = (elapsed, distance = 100, lane = 0, height = 0) => ({ elapsed, distance, lane, height });

function flight() {
  const game = createGame();
  startGame(game);
  game.status = 'running';
  game.course.obstacles = [];
  game.course.pickups = [];
  game.course.pads = [];
  game.course.meteors = [meteor];
  game.course.gravityZones = [];
  return game;
}

test('all missions provide deterministic, bounded environmental layouts of increasing difficulty', () => {
  const counts = [];
  for (const mission of MISSIONS) {
    const course = makeCourse(mission);
    assert.deepEqual(course, makeCourse(mission));
    assert.ok(course.gravityZones.length >= 1);
    assert.equal(new Set(course.meteors.map(item => item.id)).size, course.meteors.length);
    assert.ok(course.gravityZones.every(zone => zone.start > 0 && zone.end > zone.start && zone.end < mission.length));
    assert.ok(course.meteors.every(item => item.distance > 200 && item.distance < mission.length - 100 && Math.abs(item.lane) + item.radius < 15 && item.first >= ENVIRONMENT.warning));
    counts.push(course.meteors.length);
  }
  assert.ok(counts[0] < counts[1] && counts[1] < counts[2]);
});

test('meteor warning, impact and recovery follow a deterministic repeating flight clock', () => {
  assert.equal(meteorState(meteor, 0).phase, 'idle');
  assert.equal(meteorState(meteor, 4 - ENVIRONMENT.warning).phase, 'warning');
  assert.equal(meteorState(meteor, 3.9).phase, 'warning');
  assert.equal(meteorState(meteor, 4).phase, 'impact');
  assert.equal(meteorState(meteor, 4 + ENVIRONMENT.blast).phase, 'afterglow');
  assert.equal(meteorState(meteor, 8).phase, 'idle');
  assert.equal(meteorState(meteor, 14).phase, 'impact');
  assert.equal(meteorState(meteor, 13).remaining, 1);
});

test('blast collision clips motion to the active time window, preventing tunneling and early damage', () => {
  assert.equal(meteorContact(meteor, pose(3.8, 85), pose(3.9, 115)), null);
  assert.ok(meteorContact(meteor, pose(4.1, 85), pose(4.2, 115)));
  assert.equal(meteorContact(meteor, pose(4.1, 85, 9), pose(4.2, 115, 9)), null);
  assert.equal(meteorContact(meteor, pose(3.95, 100), pose(4.05, 130)), null);
  assert.ok(meteorContact(meteor, pose(3.95, 85), pose(4.05, 110)));
  assert.equal(meteorContact(meteor, pose(4 + ENVIRONMENT.blast), pose(4.1 + ENVIRONMENT.blast)), null);
});

test('blast collision respects lateral motion and checks the entire contact interval for low altitude', () => {
  const contact = meteorContact(meteor, pose(4.1, 100, -10, 6), pose(4.2, 100, 10, 0));
  assert.ok(contact);
  assert.ok(contact.height > 0 && contact.height < 2);
  assert.equal(meteorContact(meteor, pose(4.1, 110, -10), pose(4.2, 110, 10)), null);
});

test('a strike crossing an exact fixed-step boundary emits one explosion event', () => {
  const game = flight();
  game.distance = 30;
  let explosions = 0;
  for (let step = 0; step < 270; step++) {
    updateGame(game, {}, 1 / 60);
    explosions += game.events.filter(event => event.type === 'meteor-strike').length;
  }
  assert.equal(explosions, 1);
});

test('active impacts damage low craft, grant immunity, and cannot award a later dodge', () => {
  const game = flight();
  Object.assign(game, { distance: 100, elapsed: 4.1 });
  updateGame(game, {}, 1 / 60);
  assert.equal(game.hull, 100 - ENVIRONMENT.damage);
  assert.equal(game.impacts, 1);
  assert.ok(game.events.some(event => event.type === 'impact' && event.source === 'meteor'));
  updateGame(game, {}, 1 / 60);
  assert.equal(game.impacts, 1);
  Object.assign(game, { height: 5, verticalSpeed: 0, elapsed: 14.1 });
  updateGame(game, {}, 1 / 60);
  assert.equal(game.meteorDodges, 0);
});

test('clearing an active shockwave in the air awards once per landing site', () => {
  const game = flight();
  Object.assign(game, { distance: 105.8, elapsed: 4.1, height: 5, speed: 36 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.hull, 100);
  assert.equal(game.meteorDodges, 1);
  assert.equal(game.score, 180);
  assert.ok(game.events.some(event => event.type === 'meteor-dodge'));
  game.elapsed = 14.1;
  updateGame(game, {}, 1 / 60);
  assert.equal(game.meteorDodges, 1);
  assert.equal(game.score, 180);
});

test('a low craft outside impact time or outside the blast radius takes no damage', () => {
  for (const [elapsed, lane] of [[3.5, 0], [6, 0], [4.1, 10]]) {
    const game = flight();
    Object.assign(game, { distance: 100, elapsed, lane });
    updateGame(game, {}, 1 / 60);
    assert.equal(game.hull, 100);
    assert.equal(game.meteorDodges, 0);
  }
});

test('warnings fire once per nearby strike and pause freezes the environment exactly', () => {
  const game = flight();
  Object.assign(game, { distance: 30, elapsed: 2 });
  updateGame(game, {}, 1 / 60);
  assert.equal(game.events.filter(event => event.type === 'meteor-warning').length, 1);
  updateGame(game, {}, 1 / 60);
  assert.equal(game.events.filter(event => event.type === 'meteor-warning').length, 0);
  togglePause(game);
  const snapshot = structuredClone(game);
  updateGame(game, { accelerate: true }, 0.1);
  assert.deepEqual(game, snapshot);
  togglePause(game);
  game.elapsed = 12;
  updateGame(game, {}, 1 / 60);
  assert.equal(game.events.filter(event => event.type === 'meteor-warning').length, 1);
});

test('low gravity is bounded by route zones and visibly extends a normal jump', () => {
  const game = flight();
  game.course.gravityZones = [{ id: 0, start: 20, end: 80 }];
  assert.equal(gravityAt(game.course, 19.99), 17);
  assert.equal(gravityAt(game.course, 20), 8);
  assert.equal(gravityAt(game.course, 80), 17);
  const base = flight();
  game.distance = 30;
  for (let step = 0; step < 90; step++) {
    for (const craft of [base, game]) updateGame(craft, { jump: step === 0 }, 1 / 60);
  }
  assert.equal(base.height, 0);
  assert.ok(game.height > 6);
  assert.equal(game.hull, 100);
});

test('airborne zone exits reward once, while ground exits and gate rewinds cannot farm rewards', () => {
  for (const airborne of [true, false]) {
    const game = flight();
    game.course.gravityZones = [{ id: 0, start: 20, end: 80 }];
    Object.assign(game, { distance: 79.8, speed: 36, height: airborne ? 5 : 0 });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.glides, airborne ? 1 : 0);
    assert.equal(game.score, airborne ? 200 : 0);
    Object.assign(game, { distance: 79.8, height: 5 });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.glides, airborne ? 1 : 0);
  }
});

test('meteor cues warn about nearby strikes without hiding a closer rock collision', () => {
  const game = flight();
  Object.assign(game, { distance: 45, speed: 36, elapsed: 2.5 });
  assert.equal(getFlightCue(game).kind, 'meteor');
  game.course.obstacles = [{ id: 0, distance: 65, lane: 0, kind: 'rock', radius: 2 }];
  assert.equal(getFlightCue(game).kind, 'hazard');
  game.course.obstacles = [];
  game.elapsed = 7;
  assert.equal(getFlightCue(game).kind, 'gate');
});

test('retry resets weather clocks, warning history, cleared sites and skill statistics', () => {
  const game = flight();
  Object.assign(game, { distance: 105.8, elapsed: 4.1, height: 5, speed: 36 });
  updateGame(game, { accelerate: true }, 1 / 60);
  assert.equal(game.meteorDodges, 1);
  startGame(game);
  assert.equal(game.elapsed, 0);
  assert.equal(game.meteorDodges, 0);
  assert.equal(game.glides, 0);
  assert.equal(game.resolvedMeteors.size + game.clearedZones.size + game.meteorWarnings.size, 0);
});

test('pilots account for a dangerous second obstacle even when the nearest one is harmless', () => {
  const game = flight();
  Object.assign(game, { distance: 80, lane: 7, speed: 36 });
  game.course.meteors = [];
  game.course.pickups = [{ id: 0, distance: 115, lane: 7 }];
  game.course.obstacles = [{ id: 0, distance: 98, lane: -8, radius: 2.8, kind: 'rock' }, { id: 1, distance: 105, lane: 7, radius: 2.8, kind: 'rock' }];
  assert.ok(pilotInput(game, { coast: 0, offset: 0 }).steer < 0);
});
