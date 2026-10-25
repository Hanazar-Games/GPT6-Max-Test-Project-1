import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDrivingSettings } from '../src/driving-settings.js';
import { DRIVING_FIELDS, DRIVING_PRESETS } from '../src/flight-motion.js';

function fixture(status = 'menu') {
  const nodes = new Map(), applications = [];
  let success = true;
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      attributes: {}, listeners: {}, value: '', textContent: '',
      insertAdjacentHTML() {}, setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      emit(type) { this.listeners[type]({ target: this }); },
    });
    return nodes.get(id);
  };
  const root = { querySelector: selector => element(selector.slice(1)) };
  mountDrivingSettings({ guide: { querySelector: selector => selector === '#driving-settings' ? root : element('anchor') },
    getStatus: () => status, onApply: settings => { if (success) applications.push(settings); return success; } });
  return { element, applications, fail: () => { success = false; } };
}

test('precise numeric edits clamp and synchronize controls without applying the draft', () => {
  const { element, applications } = fixture();
  const input = element('driving-turnRadius-number');
  input.valueAsNumber = 1.237; input.emit('change');
  assert.equal(element('driving-turnRadius').value, 1.24);
  assert.equal(element('driving-preset').value, 'custom');
  assert.match(element('driving-summary').textContent, /待应用/);
  assert.equal(applications.length, 0);
  const stability = element('driving-highSpeedStability-number');
  stability.valueAsNumber = 35; stability.emit('change');
  assert.equal(element('driving-highSpeedStability-value').textContent, '35%');
  input.valueAsNumber = NaN; input.emit('change');
  assert.equal(input.value, 1.24);
  element('apply-driving').emit('click');
  assert.equal(applications[0].turnRadius, 1.24);
  assert.equal(applications[0].highSpeedStability, .35);
  assert.doesNotMatch(element('driving-summary').textContent, /待应用/);
  input.valueAsNumber = 999; input.emit('change');
  assert.equal(input.value, DRIVING_FIELDS.turnRadius.max);
});

test('presets and reset remain drafts; paused flights explicitly defer saved settings', () => {
  const { element, applications } = fixture('paused');
  const preset = element('driving-preset');
  preset.value = 'drift'; preset.emit('change');
  assert.equal(applications.length, 0);
  element('apply-driving').emit('click');
  assert.deepEqual(applications[0], DRIVING_PRESETS.drift.settings);
  assert.match(element('driving-status').textContent, /重飞或下一站生效/);
  element('reset-driving').emit('click');
  assert.equal(applications.length, 1);
  assert.equal(preset.value, 'balanced');
  element('apply-driving').emit('click');
  assert.deepEqual(applications[1], DRIVING_PRESETS.balanced.settings);
});

test('a failed application retains the draft for retry', () => {
  const { element, applications, fail } = fixture();
  element('driving-preset').value = 'precision'; element('driving-preset').emit('change');
  fail(); element('apply-driving').emit('click');
  assert.equal(applications.length, 0);
  assert.match(element('driving-status').textContent, /未能应用/);
  assert.match(element('driving-summary').textContent, /待应用/);
});
