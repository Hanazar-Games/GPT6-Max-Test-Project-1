import test from 'node:test';
import assert from 'node:assert/strict';
import { CRAFTS } from '../src/missions.js';
import { createGame, updateGame, getFlightCue, getJumpRingCue } from '../src/game.js';

function flight(craftId = 'scout') {
  const game = createGame('cascade', craftId);
  game.status = 'running';
  for (const key of Object.keys(game.course)) game.course[key] = [];
  game.speed = game.craft.speed;
  return game;
}

test('jump rings never recommend a late, unavailable or repeated airborne jump', () => {
  const game = flight();
  assert.equal(getJumpRingCue(game, game.speed * .3).action, 'late');
  assert.equal(getJumpRingCue(game, game.speed * .35).action, 'late');
  assert.equal(getJumpRingCue(game, game.speed).action, 'approach');
  game.jumpCooldown = .4;
  assert.equal(getJumpRingCue(game, game.speed * .5).action, 'cooldown');
  game.jumpCooldown = 0; game.energy = 17;
  assert.equal(getJumpRingCue(game, game.speed * .5).action, 'energy');
  game.energy = 100; game.height = 3;
  assert.equal(getJumpRingCue(game, game.speed * .5).action, 'airborne');
  game.height = 0; game.speed = 0;
  assert.equal(getJumpRingCue(game, 100).action, 'accelerate');
});

test('navigation preserves precise ring distance at the jump-window boundary', () => {
  const game = flight();
  game.course.challenges = [{ id: 0, kind: 'jump', lane: 0, distance: game.speed * .4 - .1 }];
  const cue = getFlightCue(game);
  assert.equal(cue.kind, 'challenge');
  assert.equal(getJumpRingCue(game, cue.distance).action, 'late');
});

test('airborne advice forecasts ring height during descent, ascent and gravity transitions', () => {
  for (const { height, verticalSpeed, arrival, zones, text, hits } of [
    { height: 3, verticalSpeed: -4, arrival: .2, zones: [], text: /预计高度不足/, hits: 0 },
    { height: 7, verticalSpeed: -5, arrival: .3, zones: [], text: /预计高度达标/, hits: 1 },
    { height: 5, verticalSpeed: 5, arrival: .4, zones: [{ start: 0, end: 10000 }], text: /预计高度偏高/, hits: 0 },
    { height: 5, verticalSpeed: 0, arrival: .5, zones: [{ start: 0, end: 34 }], text: /预计高度达标/, hits: 1 },
  ]) {
    const game = flight();
    Object.assign(game, { height, verticalSpeed });
    game.course.gravityZones = zones;
    game.course.challenges = [{ id: 0, kind: 'jump', lane: 0, distance: game.speed * arrival }];
    const snapshot = structuredClone(game), cue = getJumpRingCue(game, game.speed * arrival);
    assert.deepEqual(game, snapshot);
    assert.equal(cue.action, 'airborne');
    assert.match(cue.text, text);
    for (let i = 0; i <= Math.ceil(arrival * 60); i++) updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.challengeHits, hits);
  }
});

test('acceleration and entering boost defer jump advice until the speed settles', () => {
  const game = flight();
  game.speed = 40;
  assert.equal(getJumpRingCue(game, game.speed * .4).action, 'accelerate');
  game.speed = game.craft.speed; game.boosting = true;
  assert.equal(getJumpRingCue(game, game.speed * .4).action, 'accelerate');
  game.speed = game.craft.boostSpeed;
  assert.equal(getJumpRingCue(game, game.speed * .4).action, 'jump');
});

test('every recommended jump can reach the ring across all craft, both speeds and both gravities', () => {
  for (const craft of CRAFTS) for (const boost of [false, true]) for (const low of [false, true]) for (const arrival of [.4, .5, .65]) {
    const game = flight(craft.id);
    game.speed = boost ? craft.boostSpeed : craft.speed;
    const distance = game.speed * arrival;
    game.course.challenges = [{ id: 0, kind: 'jump', lane: 0, distance }];
    if (low) game.course.gravityZones = [{ id: 0, start: 0, end: 10000 }];
    assert.equal(getJumpRingCue(game, distance).action, 'jump');
    for (let i = 0; i <= Math.ceil(arrival * 60); i++) updateGame(game, { accelerate: true, boost, jumpPressed: i === 0 }, 1 / 60);
    assert.equal(game.challengeHits, 1, `${craft.id}/${boost}/${low}/${arrival}`);
  }
});
