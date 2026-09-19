import test from 'node:test';
import assert from 'node:assert/strict';
import { getDriveStatus } from '../src/drive-status.js';

const idle = { speed: 0, boostLocked: false, padBoost: 0, boosting: false };

test('braking and boost release instructions take priority over low-gravity and cruise descriptions', () => {
  const game = { ...idle, speed: 230, boostLocked: true };
  assert.equal(getDriveStatus(game, { brake: true, cruise: true, lowGravity: true }).kind, 'brake');
  assert.equal(getDriveStatus(game, { cruise: true, lowGravity: true }).kind, 'locked');
  assert.match(getDriveStatus(game, { lowGravity: true }).text, /松开冲刺/);
});

test('free pads and manual boost reflect actual propulsion, while ordinary cruise keeps steering explicit', () => {
  assert.equal(getDriveStatus({ ...idle, padBoost: 1, boosting: true, boostLocked: true }, { cruise: true }).kind, 'pad');
  assert.equal(getDriveStatus({ ...idle, boosting: true }, { cruise: true, lowGravity: true }).kind, 'boost');
  const cruise = getDriveStatus(idle, { cruise: true, lowGravity: true });
  assert.equal(cruise.kind, 'cruise');
  assert.match(cruise.text, /手动转向/);
  assert.equal(getDriveStatus(idle, { lowGravity: true }).kind, 'gravity');
  assert.equal(getDriveStatus(idle).kind, 'idle');
  assert.equal(getDriveStatus({ ...idle, speed: 230 }).kind, 'moving');
});
