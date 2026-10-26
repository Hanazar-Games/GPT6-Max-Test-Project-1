import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, startGame, togglePause, getJumpRingCue, getFlightCue } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';
import { verticalAt, landingOffset } from '../src/vertical-motion.js';

function flight() {
  const game = createGame('cascade', 'scout', {}, { density: 0 });
  game.status = 'running';
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`);
}

test('gravity integration handles boundary starts, overlapping zones and reverse travel', () => {
  const pose = { distance: 100, height: 5, verticalSpeed: 10 };
  const course = { gravityZones: [{ start: 112, end: 118 }, { start: 106, end: 114 }] };
  const forward = verticalAt(course, pose, 124, .1);
  const reverse = verticalAt(course, { ...pose, distance: 124 }, 100, .1);
  for (const result of [forward, reverse]) {
    near(result.height, 5.9375, 'union height');
    near(result.verticalSpeed, 8.75, 'union velocity');
  }
  const boundary = verticalAt({ gravityZones: [{ start: 100, end: 124 }] }, pose, 124, .1);
  near(boundary.height, 5.96, 'boundary height');
  near(boundary.verticalSpeed, 9.2, 'boundary velocity');
});

test('landing feedback remains bounded and gate rewinds cancel it', () => {
  const game = flight();
  game.lastLanding = { time: 0, speed: 300 };
  for (let frame = 0; frame <= 120; frame++) {
    game.elapsed = frame / 60;
    assert.ok(Math.abs(landingOffset(game)) <= .22);
  }
  assert.equal(landingOffset(game), 0);
  Object.assign(game, { distance: 100, lane: -10, speed: game.craft.speed });
  game.course.gates = [{ distance: 101, lane: 10, width: 2 }];
  updateGame(game, { accelerate: true }, .1);
  assert.ok(game.events.some(event => event.type === 'miss'));
  assert.equal(game.lastLanding, null);
});

test('jump follows an analytic parabola independent of update frequency', () => {
  for (const step of [.1, 1 / 60, 1 / 120]) {
    const game = flight();
    for (let frame = 0; frame < Math.round(.6 / step); frame++) updateGame(game, { jumpPressed: frame === 0 }, step);
    near(game.height, 11 * .6 - 17 * .6 ** 2 / 2, `height at ${step}`);
    near(game.verticalSpeed, 11 - 17 * .6, `velocity at ${step}`);
  }
});

test('one frame can traverse an entire low-gravity zone without skipping its force', () => {
  for (const step of [.1, .025, .01]) {
    const game = flight();
    Object.assign(game, { distance: 100, height: 5, verticalSpeed: 10, speed: game.craft.boostSpeed, padBoost: 2 });
    const span = game.speed * .1;
    game.course.gravityZones = [{ id: 0, start: 100 + span * .25, end: 100 + span * .75 }];
    for (let frame = 0; frame < Math.round(.1 / step); frame++) updateGame(game, {}, step);
    near(game.height, 5.9375, `height at ${step}`);
    near(game.verticalSpeed, 8.75, `velocity at ${step}`);
  }
});

test('landing records exact time and speed once, freezes on pause and clears on retry', () => {
  const game = flight();
  Object.assign(game, { height: 1, verticalSpeed: -5 });
  updateGame(game, {}, .1);
  assert.equal(game.events.filter(event => event.type === 'land').length, 0);
  updateGame(game, {}, .1);
  const event = game.events.find(event => event.type === 'land');
  assert.ok(event);
  near(event.speed, Math.sqrt(59), 'impact speed');
  near(game.lastLanding.time, (Math.sqrt(59) - 5) / 17, 'impact time');
  near(game.lastLanding.speed, event.speed, 'landing feedback');
  assert.equal(game.height, 0);
  assert.equal(game.verticalSpeed, 0);
  updateGame(game, {}, .1);
  assert.equal(game.events.filter(event => event.type === 'land').length, 0);
  togglePause(game);
  const snapshot = structuredClone(game);
  updateGame(game, { jumpPressed: true }, .1);
  assert.deepEqual(game, snapshot);
  startGame(game);
  assert.equal(game.lastLanding, null);
});

test('nonpositive or invalid timesteps cannot spend energy, latch input or change flight state', () => {
  for (const step of [0, -1, NaN]) {
    const game = flight(), snapshot = structuredClone(game);
    updateGame(game, { jump: true, jumpPressed: true, boost: true }, step);
    assert.deepEqual(game, snapshot);
  }
});

test('a descending craft can activate a pad during the frame before touching down', () => {
  const game = flight();
  Object.assign(game, { distance: 100, speed: 200, height: 2.4, verticalSpeed: -40 });
  game.course.pads = [{ id: 0, distance: 108, lane: 0 }];
  updateGame(game, { accelerate: true, boost: true }, .1);
  assert.ok(game.activatedPads.has(0));
  assert.equal(game.height, 0);
});

test('landing before a gravity-zone exit cannot award an airborne glide', () => {
  const game = flight();
  Object.assign(game, { distance: 100, speed: 200, height: 10, verticalSpeed: -300 });
  game.course.gravityZones = [{ id: 0, start: 90, end: 111 }];
  updateGame(game, { accelerate: true, boost: true }, .1);
  assert.equal(game.height, 0);
  assert.equal(game.glides, 0);
});

test('ring advice uses the gravity ahead and every new recommended window is reachable', () => {
  for (const low of [false, true]) for (const arrival of [.8, .9]) {
    const game = flight();
    game.speed = game.craft.speed;
    if (low) game.course.gravityZones = [{ id: 0, start: 0, end: 10000 }];
    const distance = game.speed * arrival;
    game.course.challenges = [{ id: 0, kind: 'jump', distance, lane: 0 }];
    assert.equal(getJumpRingCue(game, distance).action, low ? 'approach' : 'jump');
    for (let frame = 0; frame <= Math.ceil(arrival * 60); frame++) updateGame(game, { accelerate: true, jumpPressed: frame === 0 }, 1 / 60);
    assert.equal(game.challengeHits, low ? 0 : 1);
  }
});

test('airborne obstacle and meteor forecasts agree with flight across gravity boundaries for all craft', () => {
  for (const craft of CRAFTS) for (const kind of ['rock', 'meteor']) for (const height of [3, 6]) {
    const game = flight();
    game.craft = { ...craft };
    Object.assign(game, { distance: 100, height, verticalSpeed: 2, speed: craft.boostSpeed, padBoost: 2 });
    game.course.gravityZones = [{ id: 0, start: 100 + game.speed * .1, end: 100 + game.speed * .35 }];
    const distance = 100 + game.speed * .6;
    if (kind === 'rock') game.course.obstacles = [{ id: 0, distance, lane: 0, kind: 'rock', radius: 2 }];
    else game.course.meteors = [{ id: 0, distance, lane: 0, radius: 5, first: .1, period: 10 }];
    const snapshot = structuredClone(game), cue = getFlightCue(game);
    assert.deepEqual(game, snapshot);
    const danger = kind === 'rock' ? cue.kind === 'hazard' : cue.kind === 'meteor' && cue.danger;
    let impactAt = null;
    for (let frame = 0; frame < 60; frame++) {
      updateGame(game, {}, 1 / 60);
      if (game.events.some(event => event.type === 'impact')) { impactAt = game.elapsed; break; }
    }
    const label = `${craft.id}/${kind}/${height}`;
    assert.equal(danger, impactAt !== null, label);
    if (danger) assert.ok(Math.abs(cue.timeToImpact - impactAt) <= 1 / 60 + 1e-8, label);
  }
});
