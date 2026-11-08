import test from 'node:test';
import assert from 'node:assert/strict';
import { aircraftKeyBinding, aircraftInput, aircraftControlHelp } from '../src/aircraft-controls.js';

test('flight keys retain defaults and alternate keys do not amplify an axis', () => {
  assert.deepEqual(aircraftKeyBinding('ArrowDown'), ['pitch', 1]);
  assert.equal(aircraftKeyBinding('KeyV'), undefined);
  const input = aircraftInput(new Set(['KeyA', 'ArrowLeft', 'ArrowDown', 'KeyW', 'Space']));
  assert.deepEqual(input, { pitch: 1, roll: -1, yaw: 0, throttle: 1, brake: true });
  assert.equal(aircraftInput(new Set(['KeyA', 'ArrowLeft', 'KeyD'])).roll, 0);
});

test('WASD preset, pitch inversion and sensitivity apply to keyboard and touch', () => {
  const settings = { preset: 'wasd', sensitivity: .5, invertPitch: true };
  assert.deepEqual(aircraftInput(new Set(['KeyW', 'KeyD', 'ArrowUp', 'KeyQ']), {}, settings), { pitch: -.5, roll: .5, yaw: -.5, throttle: 1, brake: false });
  const touch = aircraftInput(new Set(), { pitch: .6, roll: -.8, brake: true }, settings);
  assert.equal(touch.pitch, -.3); assert.equal(touch.roll, -.4); assert.equal(touch.brake, true);
  assert.match(aircraftControlHelp(settings).pitch, /S.*W/);
  assert.match(aircraftControlHelp(settings).throttle, /↑.*↓/);
});

test('invalid settings and unknown keys cannot poison flight input', () => {
  assert.deepEqual(aircraftInput(new Set(['Unknown']), { pitch: NaN, roll: Infinity }, { preset: 'unknown', sensitivity: NaN }), { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false });
  assert.equal(aircraftInput(new Set(['ArrowDown']), {}, { sensitivity: 100 }).pitch, 1);
  assert.equal(aircraftInput(new Set(), { roll: -.7 }).roll, -.7);
});

test('reused input output clears released axes and preserves mixed keyboard and touch cancellation', () => {
  const output = { pitch: 99, roll: 99, yaw: 99, throttle: 99, brake: true };
  assert.equal(aircraftInput(new Set(['KeyA', 'ArrowLeft', 'ArrowDown']), { roll: .4 }, {}, output), output);
  assert.equal(output.roll, -.6); assert.equal(output.pitch, 1);
  aircraftInput(new Set(), {}, {}, output);
  assert.deepEqual(output, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: false });
});
