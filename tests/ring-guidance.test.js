import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getFlightCue, updateGame } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';
import { CHALLENGES, rewardCue } from '../src/route-rewards.js';

function flight(craftId = 'butterfly') {
  const game = createGame('tranquility', craftId);
  Object.assign(game, { status: 'running', speed: game.craft.speed });
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

test('precision guidance warns about drifting out and recognizes coasting into the ring', () => {
  for (const side of [-1, 1]) for (const entering of [false, true]) {
    const game = flight();
    Object.assign(game, { lane: entering ? side * -3 : 0, lateralSpeed: side * 25 });
    game.course.challenges = [{ id: 0, kind: 'precision', distance: game.speed * .4, lane: 0 }];
    const cue = getFlightCue(game);
    assert.equal(cue.projected, true);
    assert.equal(cue.drifting, !entering);
    assert.equal(cue.aligned, entering);
    assert.equal(cue.direction, entering ? 'center' : side > 0 ? 'left' : 'right');
    for (let i = 0; i < 25; i++) updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.precisionHits, Number(entering));
  }
});

test('ring projections match actual fixed-step crossings for every craft at cruise and boost', () => {
  for (const craft of CRAFTS) for (const boost of [false, true]) for (const kind of ['speed', 'precision']) for (const side of [-1, 1]) for (const arrival of [.09, .237, .65]) {
    const game = flight(craft.id);
    Object.assign(game, { speed: boost ? craft.boostSpeed : craft.speed, lateralSpeed: side * craft.handling });
    const ring = { id: 0, kind, distance: game.speed * arrival, lane: 0 };
    game.course.challenges = [ring];
    const before = structuredClone(game), cue = rewardCue(game);
    assert.deepEqual(game, before);
    assert.equal(cue.projected, true);
    let crossing;
    while (!game.challengesResolved.size) {
      const distance = game.distance, lane = game.lane;
      updateGame(game, { accelerate: true, boost }, 1 / 60);
      if (game.challengesResolved.size) crossing = lane + (game.lane - lane) * (ring.distance - distance) / (game.distance - distance);
      assert.ok(game.elapsed < 1);
    }
    const label = `${craft.id}/${boost}/${kind}/${side}/${arrival}`;
    assert.ok(Math.abs(cue.offset + crossing) < 1e-8, label);
    assert.equal(cue.aligned, game.challengeHits === 1, label);
  }
});

test('ring cues use each ring width, keep stationary and distant alignment current, and yield to danger', () => {
  const game = flight();
  const ring = { id: 0, kind: 'precision', distance: 80, lane: 0 };
  game.course.challenges = [ring];
  Object.assign(game, { speed: 0, lane: 1.5, lateralSpeed: 25 });
  assert.equal(rewardCue(game).projected, false);
  assert.equal(rewardCue(game).aligned, false);
  game.lane = 1.49;
  assert.equal(rewardCue(game).aligned, true);
  game.speed = game.craft.speed;
  ring.distance = game.speed * 1.5;
  assert.equal(rewardCue(game).projected, false);
  assert.equal(rewardCue(game).aligned, true);
  ring.distance = 80;
  for (const kind of ['jump', 'speed', 'precision']) {
    ring.kind = kind;
    Object.assign(game, { lane: CHALLENGES[kind].width, lateralSpeed: 0 });
    assert.equal(rewardCue(game).aligned, false);
    game.lane -= .01;
    assert.equal(rewardCue(game).aligned, true);
  }
  game.lane = 0;
  game.course.gates = [{ id: 0, distance: 100, lane: 0, width: 9 }];
  assert.equal(getFlightCue(game).kind, 'gate');
  game.course.obstacles = [{ id: 0, distance: 30, lane: 0, kind: 'rock', radius: 2.8 }];
  assert.equal(getFlightCue(game).kind, 'hazard');
});

test('reward selection preserves nearest, tie, resolved and rewind behavior', () => {
  const game = flight();
  game.course.powerups = [{ id: 0, kind: 'battery', distance: 80, lane: -7 }, { id: 1, kind: 'overdrive', distance: 300, lane: 7 }];
  game.course.challenges = [{ id: 0, kind: 'precision', distance: 80, lane: 0 }, { id: 1, kind: 'jump', distance: 180, lane: 0 }];
  assert.equal(rewardCue(game).reward, 'battery');
  game.powerupsTaken.add(0);
  assert.equal(rewardCue(game).reward, 'precision');
  game.challengesResolved.add(0);
  assert.equal(rewardCue(game).reward, 'jump');
  game.distance = 200;
  assert.equal(rewardCue(game).reward, 'overdrive');
  game.distance = 0;
  assert.equal(rewardCue(game).reward, 'jump');
  game.challengesResolved.add(1); game.powerupsTaken.add(1);
  assert.equal(rewardCue(game), null);
});

test('reward navigation searches only nearby route sections', () => {
  const game = flight();
  let reads = 0;
  game.course.powerups = Array.from({ length: 10000 }, (_, id) => ({ id, kind: 'battery', lane: 0, get distance() { reads++; return id * 100; } }));
  game.course.challenges = Array.from({ length: 10000 }, (_, id) => ({ id, kind: 'precision', lane: 0, get distance() { reads++; return id * 100 + 50; } }));
  game.distance = 500025;
  assert.equal(rewardCue(game).reward, 'precision');
  assert.ok(reads < 100, `read ${reads} distances for one cue`);
});
