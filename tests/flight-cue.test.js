import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getFlightCue, updateGame } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';

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

test('hazard guidance reports time to contact at the current speed', () => {
  const game = createGame('apocalypse', 'nova');
  game.course.meteors = [];
  game.course.obstacles = [{ id: 0, distance: 303, lane: 0, kind: 'rock', radius: 2.8 }];
  for (const speed of [240, 480]) {
    game.speed = speed;
    const cue = getFlightCue(game);
    assert.equal(cue.kind, 'hazard');
    assert.ok(Math.abs(cue.timeToImpact - 300 / speed) <= 1 / 60 + 1e-8);
  }
  Object.assign(game, { speed: 0, distance: 303 });
  assert.ok(getFlightCue(game).timeToImpact <= 1 / 60);
});

test('obstacle warnings match coasting collisions and safe escapes for every craft', () => {
  for (const craft of CRAFTS) for (const boost of [false, true]) for (const side of [-1, 1]) for (const approaching of [false, true]) for (const kind of ['rock', 'drone']) {
    const game = createGame('tranquility', craft.id);
    Object.assign(game, { status: 'running', distance: 100, speed: boost ? craft.boostSpeed : craft.speed,
      lane: side * (approaching ? 4.5 : 3), lateralSpeed: side * craft.handling * (approaching ? -1 : 1) });
    for (const key of ['gates', 'pickups', 'pads', 'meteors', 'gravityZones']) game.course[key] = [];
    game.course.obstacles = [{ id: 0, distance: game.distance + game.speed * .3, lane: 0, kind, radius: 2.8, phase: -.3, frequency: 1 }];
    const before = structuredClone(game), cue = getFlightCue(game);
    assert.deepEqual(game, before);
    let contact = null;
    for (let frame = 0; frame < 36; frame++) {
      updateGame(game, { accelerate: true, boost }, 1 / 60);
      if (game.events.some(event => event.type === 'impact')) { contact = game.elapsed; break; }
    }
    const label = `${craft.id}/${kind}/${boost}/${side}/${approaching}`;
    assert.equal(cue.kind === 'hazard', contact !== null, label);
    if (contact !== null) assert.ok(Math.abs(cue.timeToImpact - contact) <= 1 / 60 + 1e-8, label);
  }
});

function gateApproach(craft = 'nova') {
  const game = createGame('frontier', craft);
  const index = game.course.gates.findIndex(gate => gate.lane === 0);
  Object.assign(game, { status: 'running', gates: index, speed: game.craft.boostSpeed });
  game.distance = game.course.gates[index].distance - 50;
  for (const key of ['obstacles', 'meteors', 'pickups', 'pads', 'gravityZones']) game.course[key] = [];
  return game;
}

test('near-gate guidance warns when coasting lateral momentum would miss an apparently aligned gate', () => {
  const game = gateApproach();
  game.distance -= 50;
  Object.assign(game, { lane: 8.2, lateralSpeed: 38 });
  const cue = getFlightCue(game);
  assert.equal(cue.kind, 'gate');
  assert.equal(cue.projected, true);
  assert.equal(cue.drifting, true);
  assert.equal(cue.aligned, false);
  assert.equal(cue.direction, 'left');
  assert.ok(cue.offset < -8.5);
  const corrected = structuredClone(game);
  let missed = false;
  let recovered = false;
  for (let i = 0; i < 16; i++) {
    updateGame(game, { accelerate: true, boost: true }, 1 / 60);
    updateGame(corrected, { accelerate: true, boost: true, steer: -1 }, 1 / 60);
    missed ||= game.events.some(event => event.type === 'miss');
    recovered ||= corrected.events.some(event => event.type === 'gate');
  }
  assert.equal(missed, true);
  assert.equal(recovered, true);
});

test('gate projection recognizes neutral steering that will finish centering the craft', () => {
  const game = gateApproach();
  Object.assign(game, { lane: -4.2, lateralSpeed: 38 });
  const cue = getFlightCue(game);
  assert.equal(cue.projected, true);
  assert.equal(cue.direction, 'center');
  assert.equal(cue.aligned, true);
  assert.equal(cue.drifting, false);
  assert.ok(Math.abs(cue.offset) < 2.5);
});

test('projected gate offsets match fixed-step crossing positions across every ship', () => {
  for (const craft of CRAFTS) for (const side of [-1, 1]) {
    const game = gateApproach(craft.id);
    const gate = game.course.gates[game.gates];
    game.distance = gate.distance - game.speed * 0.237;
    Object.assign(game, { lane: side * 5, lateralSpeed: side * craft.handling });
    const before = structuredClone(game);
    const cue = getFlightCue(game);
    assert.deepEqual(game, before);
    assert.equal(cue.projected, true);
    const prediction = gate.lane - cue.offset;
    const freeFlight = structuredClone(game);
    freeFlight.course.gates = [];
    let crossed = false;
    for (let step = 0; step < 20 && !crossed; step++) {
      const distance = game.distance, lane = game.lane;
      updateGame(freeFlight, { accelerate: true, boost: true }, 1 / 60);
      updateGame(game, { accelerate: true, boost: true }, 1 / 60);
      if (game.events.some(event => event.type === 'gate' || event.type === 'miss')) {
        const fraction = (gate.distance - distance) / (freeFlight.distance - distance);
        const crossing = lane + (freeFlight.lane - lane) * fraction;
        assert.ok(Math.abs(prediction - crossing) < 1e-8, craft.id);
        assert.equal(cue.aligned, game.events.some(event => event.type === 'gate'), craft.id);
        crossed = true;
      }
    }
    assert.equal(crossed, true, craft.id);
  }
});

test('distant and stationary gate cues use current alignment while immediate hazards keep priority', () => {
  const game = gateApproach();
  Object.assign(game, { lane: 8.2, lateralSpeed: 38, speed: 0 });
  assert.equal(getFlightCue(game).projected, false);
  assert.equal(getFlightCue(game).aligned, true);
  game.speed = 480;
  game.distance = game.course.gates[game.gates].distance - 500;
  assert.equal(getFlightCue(game).projected, false);
  game.distance = game.course.gates[game.gates].distance - 50;
  game.course.obstacles = [{ id: 0, distance: game.distance + 20, lane: game.lane, kind: 'rock', radius: 2.8 }];
  assert.equal(getFlightCue(game).kind, 'hazard');
});
