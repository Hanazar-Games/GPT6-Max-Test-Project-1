import test from 'node:test';
import assert from 'node:assert/strict';
import { composeBeat } from '../src/music.js';
import { MISSIONS } from '../src/missions.js';

test('planet scores are deterministic, bounded and have distinct keys', () => {
  const scores = new Set();
  for (const mission of MISSIONS) {
    const score = Array.from({ length: 128 }, (_, step) => composeBeat(step, mission.music, 1));
    assert.deepEqual(score, Array.from({ length: 128 }, (_, step) => composeBeat(step, mission.music, 1)));
    assert.ok(score.flat().every(note => note.frequency > 20 && note.frequency < 12000 && note.volume <= 0.42 && note.duration < 3));
    assert.ok(score.every(notes => notes.length <= 10));
    assert.ok(score.flat().some(note => note.kind === 'snare'));
    scores.add(JSON.stringify(score));
  }
  assert.equal(scores.size, MISSIONS.length);
});

test('menu has no percussion; racing layers respond to actual speed', () => {
  const theme = MISSIONS[0].music;
  const menu = Array.from({ length: 16 }, (_, step) => composeBeat(step, theme, 0, true)).flat();
  assert.ok(menu.every(note => !['kick', 'snare', 'hat'].includes(note.kind)));
  const slow = Array.from({ length: 16 }, (_, step) => composeBeat(step, theme, 0)).flat();
  const fast = Array.from({ length: 16 }, (_, step) => composeBeat(step, theme, 1)).flat();
  assert.ok(fast.length > slow.length);
  assert.ok(fast.some(note => note.kind === 'kick'));
});

test('Earth uses a major harmony and a calmer tempo than the accelerator route', () => {
  const earth = MISSIONS.find(mission => mission.id === 'earth').music;
  const boost = MISSIONS.find(mission => mission.id === 'overdrive').music;
  assert.ok(earth.bpm < boost.bpm);
  const pads = composeBeat(0, earth, 0, true).filter(note => note.kind === 'pad');
  assert.ok(Math.abs(pads[1].frequency / pads[0].frequency - 2 ** (4 / 12)) < 1e-8);
});
