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
  sampleRate = 44100;
  currentTime = 0; state = 'suspended'; destination = new Node(); oscillators = [];
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.oscillators.push(node); return node; }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const node = new Node(); this.oscillators.push(node); return node; }
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
  assert.ok(audio.voices.size > 0 && audio.voices.size <= 10);
  const voices = [...audio.voices];
  for (const voice of voices) voice.oscillator.onended();
  assert.ok(voices.every(voice => !voice.oscillator.connections.length && !voice.gain.connections.length));
});

test('switching planets cancels old music while retaining event sounds', async () => {
  const audio = await setup();
  audio.update({ ...running, mission: { music: { root: 45, bpm: 124 } } });
  audio.event('pickup');
  const music = [...audio.voices].filter(voice => voice.bus === 'music');
  const effects = [...audio.voices].filter(voice => voice.bus === 'sfx');
  audio.update({ ...running, mission: { music: { root: 39, bpm: 142 } } });
  assert.ok(music.every(voice => !audio.voices.has(voice)));
  assert.ok(effects.every(voice => audio.voices.has(voice)));
  assert.equal(audio.themeRoot, 39);
  assert.ok([...audio.voices].some(voice => voice.bus === 'music'));
});

test('high-speed percussion is stopped by pause and music mute without silencing SFX', async () => {
  const audio = await setup();
  audio.beat = 15;
  audio.themeRoot = 45;
  audio.update({ ...running, speed: 420 });
  assert.ok([...audio.voices].some(voice => voice.oscillator.buffer));
  audio.setVolume('music', 0);
  assert.equal(audio.voices.size, 0);
  audio.event('pickup');
  assert.ok(audio.voices.size > 0);
  audio.setState('paused');
  assert.equal(audio.voices.size, 0);
});

test('all five powerups have distinct sounds and respect the effects volume', async () => {
  const audio = await setup(), cues = new Set();
  for (const kind of ['shield', 'magnet', 'repair', 'battery', 'overdrive']) {
    const before = audio.context.oscillators.length;
    audio.event('powerup', kind);
    const notes = audio.context.oscillators.slice(before);
    assert.ok(notes.length > 0);
    cues.add(JSON.stringify(notes.map(note => [note.frequency.value, note.type])));
    audio.stopVoices();
  }
  assert.equal(cues.size, 5);
  audio.setVolume('sfx', 0);
  for (const kind of ['shield', 'magnet', 'repair', 'battery', 'overdrive']) audio.event('powerup', kind);
  assert.equal(audio.voices.size, 0);
});

test('dense music leaves headroom for immediate warning and impact sounds', async () => {
  const audio = await setup();
  for (let i = 0; i < 60; i++) audio.tone(440, 2, 0, 'sine', 'music');
  assert.ok(audio.voices.size <= 36);
  const before = audio.context.oscillators.length;
  audio.event('meteor-warning'); audio.event('impact');
  assert.equal(audio.context.oscillators.length - before, 4);
  assert.ok(audio.voices.size <= 48);
});

test('reward bursts leave four voices available for warnings and impacts', async () => {
  const audio = await setup();
  audio.update(running);
  for (let i = 0; i < 30; i++) audio.event('challenge', 'precision');
  assert.ok(audio.voices.size <= 44);
  const before = audio.context.oscillators.length;
  audio.event('meteor-warning'); audio.event('impact');
  assert.equal(audio.context.oscillators.length - before, 4);
  assert.ok(audio.voices.size <= 48);
});

test('alerts briefly lower music, honor volume changes and restore the selected level', async () => {
  const audio = await setup();
  audio.update(running);
  audio.event('meteor-warning');
  assert.equal(audio.music.gain.value, .45 * .4);
  assert.equal(audio.volumes.music, .45);
  assert.equal(audio.sfx.gain.value, .8);
  audio.setVolume('music', .3);
  assert.equal(audio.music.gain.value, .3 * .4);
  audio.context.currentTime = .3;
  audio.update(running);
  assert.equal(audio.music.gain.value, .3 * .4);
  audio.context.currentTime = 1;
  audio.update(running);
  assert.equal(audio.music.gain.value, .3);
});

test('muting effects ends music reduction while music mute preserves independent alerts', async () => {
  const audio = await setup();
  audio.update(running); audio.event('impact');
  audio.setVolume('sfx', 0);
  assert.equal(audio.music.gain.value, .45);
  audio.setVolume('sfx', .8); audio.event('meteor-warning');
  audio.setVolume('music', 0);
  assert.equal(audio.music.gain.value, 0);
  assert.ok([...audio.voices].every(voice => voice.bus === 'sfx'));
  assert.equal(audio.voices.size, 2);
  audio.setVolume('music', .3);
  assert.equal(audio.music.gain.value, .3 * .4);
  audio.setVolume('sfx', 0);
  assert.equal(audio.music.gain.value, .3);
});

test('muted alerts cannot lower music, and pausing or leaving cancels the temporary reduction', async () => {
  const audio = await setup();
  audio.update(running);
  audio.setVolume('sfx', 0);
  audio.event('impact');
  assert.equal(audio.music.gain.value, .45);
  audio.setVolume('sfx', .8);
  for (const stop of [() => audio.setState('paused'), () => audio.setBackground(true), () => audio.toggle()]) {
    audio.event('impact');
    assert.equal(audio.music.gain.value, .45 * .4);
    stop();
    assert.equal(audio.voices.size, 0);
    assert.equal(audio.music.gain.value, .45);
    audio.setState('running'); audio.setBackground(false);
    if (!audio.enabled) audio.toggle();
    audio.update(running);
  }
});
