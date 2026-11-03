import test from 'node:test';
import assert from 'node:assert/strict';
import { mountDrivingSettings } from '../src/driving-settings.js';
import { DRIVING_FIELDS, DRIVING_PRESETS } from '../src/flight-motion.js';

function fixture(status = 'menu', settings) {
  const nodes = new Map(), applications = [], document = { activeElement: null };
  let success = true;
  const element = id => {
    if (!nodes.has(id)) nodes.set(id, {
      attributes: {}, listeners: {}, value: '', textContent: '', disabled: false, hidden: false,
      insertAdjacentHTML() {}, setAttribute(key, value) { this.attributes[key] = value; },
      addEventListener(type, callback) { this.listeners[type] = callback; },
      emit(type) { this.listeners[type]({ target: this }); },
      focus() { document.activeElement = this; },
    });
    return nodes.get(id);
  };
  const root = { ownerDocument: document, querySelector: selector => element(selector.slice(1)) };
  mountDrivingSettings({ settings, guide: { querySelector: selector => selector === '#driving-settings' ? root : element('anchor') },
    getStatus: () => status, onApply: settings => { if (success) applications.push(settings); return success; } });
  return { element, applications, document, fail: () => { success = false; }, retry: () => { success = true; } };
}

test('unchanged settings cannot reapply or reset the current defaults', () => {
  const { element, applications } = fixture();
  assert.equal(element('apply-driving').disabled, true);
  assert.equal(element('reset-driving').disabled, true);
  assert.equal(element('discard-driving').hidden, true);
  element('apply-driving').emit('click');
  assert.equal(applications.length, 0);
});

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
  const { element, applications, document, fail, retry } = fixture();
  element('driving-preset').value = 'precision'; element('driving-preset').emit('change');
  element('apply-driving').focus();
  fail(); element('apply-driving').emit('click');
  assert.equal(applications.length, 0);
  assert.match(element('driving-status').textContent, /未能应用/);
  assert.match(element('driving-summary').textContent, /待应用/);
  assert.equal(element('apply-driving').disabled, false);
  assert.equal(document.activeElement, element('apply-driving'));
  retry(); element('apply-driving').emit('click');
  assert.equal(applications.length, 1);
  assert.equal(element('apply-driving').disabled, true);
  assert.equal(document.activeElement, element('driving-status'));
});

test('numeric typing enables apply immediately and preserves unfinished decimal text until committed', () => {
  const { element, applications } = fixture();
  const input = element('driving-turnRadius-number');
  input.value = '1.'; input.valueAsNumber = 1; input.emit('input');
  assert.equal(input.value, '1.');
  input.value = '1.237'; input.valueAsNumber = 1.237; input.emit('input');
  assert.equal(input.value, '1.237');
  assert.equal(element('driving-turnRadius').value, 1.24);
  assert.equal(element('apply-driving').disabled, false);
  assert.match(element('driving-status').textContent, /1 项/);
  assert.equal(applications.length, 0);
  input.emit('change');
  assert.equal(input.value, 1.24);
  element('apply-driving').emit('click');
  assert.equal(applications[0].turnRadius, 1.24);
});

test('incomplete numeric input blocks applying and restores the last valid draft on commit', () => {
  const { element, applications } = fixture();
  element('driving-preset').value = 'precision'; element('driving-preset').emit('change');
  const input = element('driving-turnRadius-number');
  input.value = ''; input.valueAsNumber = NaN; input.emit('input');
  assert.equal(input.value, '');
  assert.equal(input.attributes['aria-invalid'], 'true');
  assert.equal(element('apply-driving').disabled, true);
  assert.match(element('driving-status').textContent, /转弯半径系数/);
  element('apply-driving').emit('click');
  assert.equal(applications.length, 0);
  input.emit('change');
  assert.equal(input.value, .8);
  assert.equal(input.attributes['aria-invalid'], 'false');
  assert.equal(element('apply-driving').disabled, false);
});

test('discard returns to the applied custom configuration without applying defaults and restores focus', () => {
  const { element, applications, document } = fixture('menu', { ...DRIVING_PRESETS.precision.settings, turnRadius: 1.31 });
  element('driving-preset').value = 'drift'; element('driving-preset').emit('change');
  assert.equal(element('discard-driving').hidden, false);
  element('discard-driving').focus(); element('discard-driving').emit('click');
  assert.equal(element('driving-turnRadius-number').value, 1.31);
  assert.equal(element('driving-preset').value, 'custom');
  assert.equal(element('apply-driving').disabled, true);
  assert.equal(element('discard-driving').hidden, true);
  assert.equal(applications.length, 0);
  assert.equal(document.activeElement, element('driving-status'));
});

test('restoring defaults remains a draft and keeps focus visible when its button becomes disabled', () => {
  const { element, applications, document } = fixture('menu', DRIVING_PRESETS.precision.settings);
  element('reset-driving').focus(); element('reset-driving').emit('click');
  assert.equal(element('driving-preset').value, 'balanced');
  assert.equal(element('reset-driving').disabled, true);
  assert.equal(element('apply-driving').disabled, false);
  assert.equal(document.activeElement, element('driving-status'));
  assert.equal(applications.length, 0);
});
