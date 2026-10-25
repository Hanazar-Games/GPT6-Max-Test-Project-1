import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame } from '../src/game.js';
import { CRAFTS } from '../src/missions.js';
import { DRIVING_FIELDS, DRIVING_PRESETS, normalizeDrivingSettings, drivingKey, advanceLateral, coastingLane } from '../src/flight-motion.js';
import { FlightRecorder, flightKey } from '../src/ghost.js';
import { RACERS, buildField, pilotInput } from '../src/pilots.js';

function flight(settings = {}, craft = 'scout') {
  const game = createGame('tranquility', craft, {}, { density: 0 }, settings);
  Object.assign(game, { status: 'running', speed: game.craft.speed });
  for (const key of Object.keys(game.course)) game.course[key] = [];
  return game;
}

test('driving settings clamp, quantize and discard invalid or obsolete fields', () => {
  const defaults = normalizeDrivingSettings();
  assert.deepEqual(defaults, DRIVING_PRESETS.balanced.settings);
  for (const [key, field] of Object.entries(DRIVING_FIELDS)) {
    assert.equal(normalizeDrivingSettings({ [key]: Infinity })[key], defaults[key]);
    assert.equal(normalizeDrivingSettings({ [key]: -100 })[key], field.min);
    assert.equal(normalizeDrivingSettings({ [key]: 100 })[key], field.max);
  }
  assert.equal(normalizeDrivingSettings({ turnRadius: 1.237, obsolete: true }).turnRadius, 1.24);
  assert.equal('obsolete' in normalizeDrivingSettings({ obsolete: true }), false);
  assert.deepEqual(normalizeDrivingSettings(null), defaults);
  assert.equal(drivingKey({}), drivingKey(defaults));
  assert.equal(drivingKey({ turnRadius: 1.237 }), drivingKey({ turnRadius: 1.24 }));
  assert.throws(() => { defaults.turnRadius = 1.5; }, TypeError);
  assert.notEqual(drivingKey({ turnRadius: 1.01 }), drivingKey(defaults));
});

test('smaller turning radii start tighter arcs without changing the eventual lateral limit', () => {
  const tight = flight({ turnRadius: .5, highSpeedStability: 0 }), wide = flight({ turnRadius: 2, highSpeedStability: 0 });
  advanceLateral(tight, { steer: 1 }, .1);
  advanceLateral(wide, { steer: 1 }, .1);
  assert.ok(tight.lane > wide.lane * 2);
  assert.ok(tight.lateralSpeed > wide.lateralSpeed);
  for (let frame = 0; frame < 600; frame++) {
    advanceLateral(tight, { steer: 1 }, 1 / 60);
    advanceLateral(wide, { steer: 1 }, 1 / 60);
  }
  assert.ok(Math.abs(tight.lateralSpeed - wide.lateralSpeed) < 1e-8);
});

test('default grip reduces the old release slide and braking arrests drift sooner', () => {
  const coast = flight(), brake = flight();
  coast.lateralSpeed = brake.lateralSpeed = 25;
  for (let frame = 0; frame < 60; frame++) {
    updateGame(coast, { accelerate: true }, 1 / 60);
    updateGame(brake, { brake: true }, 1 / 60);
  }
  const oldSlide = 25 / 60 * .85 / .15;
  assert.ok(coast.lane < oldSlide * .8);
  assert.ok(brake.lane < coast.lane * .5);
  assert.ok(Math.abs(brake.lateralSpeed) < Math.abs(coast.lateralSpeed));
});

test('countersteer catches a slide earlier and remains symmetric', () => {
  for (const side of [-1, 1]) {
    const assisted = flight({ countersteer: 2.5 }), unassisted = flight({ countersteer: 1 });
    assisted.lateralSpeed = unassisted.lateralSpeed = side * 25;
    advanceLateral(assisted, { steer: -side }, .04);
    advanceLateral(unassisted, { steer: -side }, .04);
    assert.ok(side * assisted.lane < side * unassisted.lane);
    assert.ok(side * assisted.lateralSpeed < side * unassisted.lateralSpeed);
  }
});

test('steering power, speed stability and input curve change distinct parts of the response', () => {
  const sample = (settings, steer = 1, boost = false) => {
    const game = flight(settings);
    if (boost) game.speed = game.craft.boostSpeed;
    advanceLateral(game, { steer }, .1);
    return game.lateralSpeed;
  };
  assert.ok(sample({ steeringPower: 1.5 }) > sample({ steeringPower: .5 }));
  assert.ok(sample({ highSpeedStability: .6 }, 1, true) < sample({ highSpeedStability: 0 }, 1, true));
  assert.ok(sample({ inputCurve: 2 }, .25) < sample({ inputCurve: 1 }, .25));
  assert.equal(sample({ inputCurve: 2 }), sample({ inputCurve: 1 }));
  const parked = flight(); parked.speed = 0;
  advanceLateral(parked, { steer: 1 }, .1);
  assert.ok(parked.lateralSpeed > 0 && parked.lateralSpeed < 6);
});

test('lateral integration is independent of frame size including the instant of countersteer reversal', () => {
  for (const preset of Object.values(DRIVING_PRESETS)) for (const input of [{ steer: -1 }, {}, { brake: true }, { steer: .2, brake: true }]) {
    const one = flight(preset.settings), many = structuredClone(one);
    one.lateralSpeed = many.lateralSpeed = 30;
    advanceLateral(one, input, .4);
    for (let frame = 0; frame < 48; frame++) advanceLateral(many, input, 1 / 120);
    assert.ok(Math.abs(one.lane - many.lane) < 1e-10);
    assert.ok(Math.abs(one.lateralSpeed - many.lateralSpeed) < 1e-10);
  }
});

test('coasting projections match fixed-step crossing interpolation for every preset, craft and road edge', () => {
  for (const craft of CRAFTS) for (const preset of Object.values(DRIVING_PRESETS)) for (const side of [-1, 1]) for (const arrival of [.009, .237, .65]) {
    const game = flight(preset.settings, craft.id);
    Object.assign(game, { lane: side * 7, lateralSpeed: side * craft.handling });
    const prediction = coastingLane(game, arrival);
    const whole = Math.floor(arrival * 60), fraction = arrival * 60 - whole;
    for (let frame = 0; frame < whole; frame++) updateGame(game, { accelerate: true }, 1 / 60);
    const lane = game.lane;
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.ok(Math.abs(prediction - (lane + (game.lane - lane) * fraction)) < 1e-8, `${craft.id}/${arrival}`);
  }
});

test('restart preserves normalized driving settings and clears motion', () => {
  const game = flight({ ...DRIVING_PRESETS.drift.settings, turnRadius: 1.37 });
  const settings = { ...game.drivingSettings };
  Object.assign(game, { lane: 8, lateralSpeed: 20 });
  startGame(game);
  assert.deepEqual(game.drivingSettings, settings);
  assert.equal(game.lane, 0);
  assert.equal(game.lateralSpeed, 0);
  assert.equal(game.status, 'countdown');
});

test('records and in-progress recordings isolate driving configurations', () => {
  const game = flight(), other = flight({ turnRadius: 1.01 });
  assert.notEqual(flightKey(game), flightKey(other));
  const recorder = new FlightRecorder(game);
  game.drivingSettings = other.drivingSettings;
  Object.assign(game, { status: 'won', elapsed: 30, distance: game.mission.length, gates: 6 });
  assert.equal(recorder.finish(game), null);
});

test('computer fields use the selected physics and complete representative routes in every preset', () => {
  for (const preset of Object.values(DRIVING_PRESETS)) for (const [mission, craft] of [['tranquility', 'scout'], ['apocalypse', 'nova'], ['cascade', 'hauler']]) {
    const field = buildField(mission, craft, { density: 12, mix: { semi: 100 } }, preset.settings);
    assert.ok(field.every(racer => racer.status === 'won'), `${mission}/${preset.label}`);
    const game = createGame(mission, craft, {}, { density: 12, mix: { semi: 100 } }, preset.settings);
    startGame(game);
    const recorder = new FlightRecorder(game);
    for (let frame = 0; frame < 300; frame++) {
      updateGame(game, pilotInput(game, RACERS[0]), 1 / 60);
      recorder.capture(game);
    }
    assert.deepEqual(field[0].trace.samples.slice(0, recorder.samples.length), recorder.samples);
  }
});
