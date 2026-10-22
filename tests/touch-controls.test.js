import test from 'node:test';
import assert from 'node:assert/strict';
import { touchSteer, mountTouchControls } from '../src/touch-controls.js';
import { FlightInput } from '../src/input.js';

class Element {
  constructor(value = '') { this.value = value; this.dataset = {}; this.attributes = {}; this.captured = new Set(); this.listeners = new Map(); this.style = { setProperty() {} }; }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  emit(type, properties = {}) { for (const listener of this.listeners.get(type) ?? []) listener({ type, button: 0, preventDefault() {}, ...properties }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  setPointerCapture(id) { this.captured.add(id); }
  hasPointerCapture(id) { return this.captured.has(id); }
  releasePointerCapture(id) { this.captured.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
  getBoundingClientRect() { return { left: 0, width: 144 }; }
  insertAdjacentHTML() {}
}

function fixture() {
  const root = new Element(), guide = new Element(), controls = new FlightInput();
  const buttons = ['left', 'right', 'accelerate', 'boost', 'jump', 'brake'].map(control => { const button = new Element(); button.dataset.control = control; return button; });
  const nodes = Object.fromEntries(['touch-steer', 'touch-cruise', 'touch-steer-help', 'touch-throttle-help', 'touch-sensitivity-value'].map(id => [`#${id}`, new Element()]));
  for (const [id, value] of [['touch-steering-mode', 'slider'], ['touch-throttle-mode', 'cruise'], ['touch-hand', 'right'], ['touch-sensitivity', '100']]) nodes[`#${id}`] = new Element(value);
  nodes['.touch-arrows'] = new Element(); nodes['.guide-keys'] = new Element();
  root.querySelector = selector => selector.startsWith('[data-control=') ? buttons.find(button => selector.includes(`"${button.dataset.control}"`)) : nodes[selector];
  root.querySelectorAll = () => buttons; guide.querySelector = selector => nodes[selector];
  const view = mountTouchControls({ root, guide, controls, icon: () => '', isActive: () => true, onChange() {}, onCruise() {}, onActivate() {} });
  return { controls, view, root, nodes, button: action => buttons.find(button => button.dataset.control === action), pad: nodes['#touch-steer'] };
}

test('touch steering has a neutral centre, progressive response and bounded sensitivity', () => {
  for (const position of [-.08, 0, .08]) assert.equal(touchSteer(position), 0);
  assert.ok(Math.abs(touchSteer(.54) - .5) < 1e-10);
  assert.equal(touchSteer(-1), -1);
  assert.equal(touchSteer(1), 1);
  assert.equal(touchSteer(1, .5), .5);
  assert.equal(touchSteer(-1, 1.5), -1);
  for (const value of [NaN, Infinity, -Infinity]) assert.equal(touchSteer(value), 0);
});

test('touch capture releases each finger independently and preserves a quick jump through normal capture loss', () => {
  const { controls, button, pad } = fixture();
  pad.emit('pointerdown', { pointerId: 1, clientX: 96 });
  button('boost').emit('pointerdown', { pointerId: 2 });
  button('jump').emit('pointerdown', { pointerId: 3 });
  button('jump').emit('pointerup', { pointerId: 3 });
  button('jump').emit('lostpointercapture', { pointerId: 3 });
  const input = controls.read();
  assert.ok(input.steer > 0 && input.steer < 1);
  assert.equal(input.boost, true); assert.equal(input.jumpPressed, true);
  assert.equal(controls.read().jumpPressed, false);
  button('boost').emit('pointercancel', { pointerId: 2 });
  assert.equal(controls.read().boost, false);
  assert.equal(controls.read().steer, input.steer);
  pad.emit('lostpointercapture', { pointerId: 1 });
  assert.equal(controls.read().steer, 0);
});

test('clearing the touch surface releases captures, centres steering and allows a fresh gesture', () => {
  const { controls, view, button, pad } = fixture();
  controls.press('KeyW', 'accelerate');
  pad.emit('pointerdown', { pointerId: 1, clientX: 96 });
  button('boost').emit('pointerdown', { pointerId: 2 });
  view.clear();
  assert.equal(pad.hasPointerCapture(1), false);
  assert.equal(button('boost').hasPointerCapture(2), false);
  assert.equal(controls.read().steer, 0);
  assert.equal(controls.read().boost, false);
  assert.equal(controls.read().accelerate, true);
  assert.equal(pad.attributes['aria-valuenow'], '0');
  pad.emit('pointerdown', { pointerId: 3, clientX: 24 });
  assert.equal(controls.read().steer, -1);
});

test('touch settings change response and handedness, and a second finger cannot steal steering', () => {
  const { controls, root, nodes, pad } = fixture();
  nodes['#touch-hand'].value = 'left';
  nodes['#touch-sensitivity'].value = '50';
  nodes['#touch-sensitivity'].emit('input');
  assert.equal(root.dataset.hand, 'left');
  assert.equal(nodes['#touch-sensitivity'].attributes['aria-valuetext'], '50%');
  pad.emit('pointerdown', { pointerId: 1, clientX: 120 });
  pad.emit('pointerdown', { pointerId: 2, clientX: 24 });
  pad.emit('pointermove', { pointerId: 2, clientX: 24 });
  assert.equal(controls.read().steer, .5);
  pad.emit('pointerup', { pointerId: 1 });
  assert.equal(controls.read().steer, 0);
});
