import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame, togglePause } from '../src/game.js';
import { FlightRecorder, MAX_GHOST_SAMPLES, sampleGhost, compareSplit, saveRecord } from '../src/ghost.js';

function flight() {
  const game = createGame();
  startGame(game);
  const recorder = new FlightRecorder(game);
  for (let i = 0; i < 181; i++) { updateGame(game, {}, 1 / 60); recorder.capture(game); }
  return { game, recorder };
}

function complete(time = 50, craft = 'scout', score = 5000) {
  const game = createGame('tranquility', craft);
  startGame(game);
  const recorder = new FlightRecorder(game);
  game.status = 'running';
  for (const gate of game.course.gates) {
    Object.assign(game, { elapsed: gate.distance / game.mission.length * time, distance: gate.distance, gates: game.gates + 1 });
    recorder.capture(game);
  }
  Object.assign(game, { status: 'won', elapsed: time, distance: game.mission.length, score });
  recorder.capture(game);
  return { game, recorder };
}

test('recording excludes countdown and pause, and retries start at zero', () => {
  const { game, recorder } = flight();
  for (let i = 0; i < 60; i++) { updateGame(game, { accelerate: true }, 1 / 60); recorder.capture(game); }
  const samples = structuredClone(recorder.samples);
  togglePause(game);
  for (let i = 0; i < 100; i++) { updateGame(game, {}, 0.1); recorder.capture(game); }
  assert.deepEqual(recorder.samples, samples);
  assert.ok(recorder.samples.length >= 10 && recorder.samples.length <= 12);
  assert.equal(recorder.samples[0].time, 0);
  startGame(game);
  const retry = new FlightRecorder(game);
  assert.equal(retry.samples.length, 1);
  assert.equal(retry.samples[0].distance, 0);
  assert.deepEqual(retry.splits, []);
});

test('ghost interpolates steering, elevation and speed by flight time without changing its samples', () => {
  const ghost = { samples: [
    { time: 0, distance: 0, lane: -4, height: 0, speed: 20, lateralSpeed: 2 },
    { time: 2, distance: 80, lane: 4, height: 4, speed: 60, lateralSpeed: 6 },
  ] };
  const pose = sampleGhost(ghost, 0.5);
  assert.equal(pose.distance, 20);
  assert.equal(pose.lane, -2);
  assert.equal(pose.height, 1);
  assert.equal(pose.speed, 30);
  pose.lane = 99;
  assert.equal(ghost.samples[0].lane, -4);
  assert.equal(sampleGhost(ghost, -1).distance, 0);
  assert.equal(sampleGhost(ghost, 2).distance, 80);
  assert.equal(sampleGhost(ghost, 3), null);
  assert.equal(sampleGhost(null, 1), null);
});

test('missed gates preserve both sides of a teleport, even between regular samples', () => {
  const { game, recorder } = flight();
  Object.assign(game, { elapsed: 1, distance: 265, lane: 10 });
  recorder.capture(game);
  Object.assign(game, { elapsed: 1.016, distance: 269, lane: 10 });
  recorder.capture(game);
  Object.assign(game, { elapsed: 1.032, distance: 235, lane: 0, events: [{ type: 'miss' }] });
  recorder.capture(game);
  assert.equal(sampleGhost(recorder, 1.02).distance, 269);
  assert.equal(sampleGhost(recorder, 1.032).distance, 235);
  assert.equal(sampleGhost(recorder, 1.032).lane, 0);
});

test('final frame is captured once even when completion falls between regular samples', () => {
  const { game, recorder } = complete(50.013);
  const size = recorder.samples.length;
  for (let i = 0; i < 10; i++) recorder.capture(game);
  assert.equal(recorder.samples.length, size);
  assert.equal(recorder.samples.at(-1).time, 50.013);
  assert.equal(recorder.samples.at(-1).distance, game.mission.length);
  assert.equal(recorder.splits.length, 7);
  assert.equal(recorder.splits.at(-1), 50.013);
});

test('split comparison distinguishes cumulative advantage from the last sector', () => {
  assert.deepEqual(compareSplit([10, 22], [12, 21], 1), { total: 1, sector: 3 });
  assert.deepEqual(compareSplit([10, 22], [12, 21], 0), { total: -2, sector: -2 });
  assert.equal(compareSplit([10], [12, 21], 1), null);
  assert.equal(compareSplit([10], null, 0), null);
});

test('only the fastest complete successful flight replaces the ghost, while score records are independent', () => {
  const records = new Map();
  const first = complete();
  assert.equal(saveRecord(records, first.game, first.recorder).newBest, true);
  const ghost = records.get('tranquility/scout').ghost;
  const slower = complete(55, 'scout', 6000);
  const result = saveRecord(records, slower.game, slower.recorder);
  assert.equal(result.newBest, false);
  assert.equal(result.newScore, true);
  assert.equal(records.get('tranquility/scout').ghost, ghost);
  const faster = complete(45, 'scout', 4000);
  assert.equal(saveRecord(records, faster.game, faster.recorder).newBest, true);
  assert.equal(records.get('tranquility/scout').score, 6000);
  assert.equal(records.get('tranquility/scout').time, 45);
  first.game.distance = 0;
  assert.equal(ghost.samples.at(-1).distance, 1800);
});

test('failed or incomplete recordings never overwrite a successful ghost', () => {
  const records = new Map();
  const first = complete();
  saveRecord(records, first.game, first.recorder);
  const before = records.get('tranquility/scout');
  const failed = complete(40);
  failed.game.status = 'lost';
  saveRecord(records, failed.game, failed.recorder);
  const incomplete = complete(39);
  incomplete.recorder.splits.pop();
  saveRecord(records, incomplete.game, incomplete.recorder);
  assert.equal(records.get('tranquility/scout'), before);
});

test('records isolate mission and craft combinations and ties keep the existing ghost', () => {
  const records = new Map();
  const first = complete();
  saveRecord(records, first.game, first.recorder);
  const ghost = records.get('tranquility/scout').ghost;
  const second = complete(50, 'hauler');
  saveRecord(records, second.game, second.recorder);
  const tied = complete();
  saveRecord(records, tied.game, tied.recorder);
  assert.equal(records.size, 2);
  assert.equal(records.get('tranquility/scout').ghost, ghost);
  assert.equal(records.get('eclipse/scout'), undefined);
  second.game.mission = createGame('eclipse').mission;
  saveRecord(records, second.game, second.recorder);
  assert.equal(records.size, 2);
});

test('recording memory is bounded and an overflow cannot become a partial ghost', () => {
  const { game, recorder } = flight();
  for (let i = 1; i <= MAX_GHOST_SAMPLES + 10; i++) {
    game.elapsed = i * 0.11;
    recorder.capture(game);
  }
  assert.ok(recorder.samples.length <= MAX_GHOST_SAMPLES);
  Object.assign(game, { status: 'won', gates: 6, distance: game.mission.length });
  recorder.capture(game);
  const records = new Map();
  saveRecord(records, game, recorder);
  assert.equal(records.size, 0);
});
