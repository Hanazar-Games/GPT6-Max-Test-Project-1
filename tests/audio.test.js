import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';

class Param {
  value = 0;
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  gain = new Param(); frequency = new Param(); connections = [];
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
  start(time) { this.started = time; }
  stop(time) { this.stopped = time; }
}
class Context {
  currentTime = 0; state = 'suspended'; destination = new Node(); oscillators = [];
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
async function setup() {
  const audio = new AudioEngine(() => new Context());
  assert.equal(await audio.unlock(), true);
  return audio;
}
const running = { status: 'running', speed: 36, boosting: false };

test('audio unlock failure is recoverable without a partially initialized graph', async () => {
  let attempts = 0;
  const audio = new AudioEngine(() => { if (!attempts++) throw new Error('unavailable'); return new Context(); });
  assert.equal(await audio.unlock(), false);
  assert.equal(await audio.unlock(), true);
  assert.equal(attempts, 2);
});

test('music plays after activation and has an independent bus from sound effects', async () => {
  const audio = await setup();
  audio.update(running);
  assert.ok([...audio.voices].some(voice => voice.bus === 'music'));
  audio.setVolume('music', 0);
  assert.equal(audio.music.gain.value, 0);
  audio.event('pickup');
  assert.ok([...audio.voices].some(voice => voice.bus === 'sfx'));
  audio.setVolume('sfx', 0);
  assert.equal(audio.sfx.gain.value, 0);
  assert.equal(audio.enabled, true);
});

test('pause immediately silences the engine and cancels scheduled sounds', async () => {
  const audio = await setup();
  audio.update(running);
  audio.event('won');
  const voices = [...audio.voices];
  assert.ok(voices.length > 0);
  audio.setState('paused');
  assert.equal(audio.engineGain.gain.value, 0);
  assert.equal(audio.voices.size, 0);
  assert.ok(voices.every(voice => voice.oscillator.stopped <= audio.context.currentTime + 0.04));
  audio.update({ ...running, status: 'paused' });
  audio.event('pickup');
  assert.equal(audio.voices.size, 0);
});

test('background and mute suppress scheduling without changing volume preferences', async () => {
  const audio = await setup();
  audio.setVolume('music', 0.3);
  audio.update(running);
  audio.setBackground(true);
  audio.event('meteor-strike');
  audio.update(running);
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.master.gain.value, 0);
  audio.setBackground(false);
  audio.toggle();
  audio.update(running);
  assert.equal(audio.voices.size, 0);
  audio.toggle();
  audio.update(running);
  assert.ok(audio.voices.size > 0);
  assert.equal(audio.volumes.music, 0.3);
});

test('a delayed frame cannot enqueue missed music, and ended voices disconnect', async () => {
  const audio = await setup();
  audio.update(running);
  for (const voice of [...audio.voices]) voice.oscillator.onended();
  assert.equal(audio.voices.size, 0);
  audio.context.currentTime = 120;
  audio.update(running);
  assert.ok(audio.voices.size > 0 && audio.voices.size <= 4);
  const voices = [...audio.voices];
  for (const voice of voices) voice.oscillator.onended();
  assert.ok(voices.every(voice => !voice.oscillator.connections.length && !voice.gain.connections.length));
});
