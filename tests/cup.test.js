import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, CRAFTS } from '../src/missions.js';
import { createGame } from '../src/game.js';
import { createCup, completeStage, advanceStage, getStandings, getTrophy, getRaceView, RACE_POINTS } from '../src/cup.js';
import { RACERS, buildField } from '../src/pilots.js';
import { MAX_GHOST_SAMPLES, sampleGhost } from '../src/ghost.js';

function finish(cup, elapsed = 50) {
  const game = createGame(MISSIONS[cup.stage].id, cup.craftId);
  Object.assign(game, { status: 'won', elapsed, distance: game.mission.length, gates: 6, score: 6000 });
  return game;
}

function fieldFor(cup, times = [49, 53, 58]) {
  return RACERS.map((racer, i) => ({ ...racer, missionId: MISSIONS[cup.stage].id, craftId: cup.craftId, time: times[i], status: 'won', distance: MISSIONS[cup.stage].length }));
}

test('a cup locks its craft, starts at the first route and rejects unknown craft', () => {
  const cup = createCup('hauler');
  assert.equal(cup.stage, 0);
  assert.equal(cup.craftId, 'hauler');
  assert.equal(cup.status, 'racing');
  assert.deepEqual(cup.legs, []);
  assert.throws(() => createCup('unknown'), RangeError);
  assert.equal(advanceStage(cup), false);
  assert.equal(getTrophy(cup), null);
});

test('stage scoring awards race points once and keeps accumulated points while starting the next stage', () => {
  const cup = createCup('scout');
  const game = finish(cup);
  const field = fieldFor(cup);
  const leg = completeStage(cup, game, field);
  assert.equal(cup.status, 'intermission');
  assert.equal(leg.results.find(row => row.id === 'player').place, 2);
  assert.equal(leg.results.find(row => row.id === 'player').points, RACE_POINTS[1]);
  assert.equal(completeStage(cup, game, field), null);
  assert.equal(cup.legs.length, 1);
  const points = getStandings(cup).find(row => row.id === 'player').points;
  assert.equal(advanceStage(cup), true);
  assert.equal(cup.stage, 1);
  assert.equal(cup.status, 'racing');
  assert.equal(getStandings(cup).find(row => row.id === 'player').points, points);
  assert.equal(advanceStage(cup), false);
});

test('failure or the wrong mission, craft, or opponent field never advances the championship', () => {
  const cup = createCup('scout');
  const field = fieldFor(cup);
  const failed = finish(cup);
  failed.status = 'lost';
  assert.equal(completeStage(cup, failed, field), null);
  assert.equal(cup.legs.length, 0);
  const wrongMission = createGame('eclipse');
  wrongMission.status = 'won';
  assert.equal(completeStage(cup, wrongMission, field), null);
  const wrongCraft = createGame('tranquility', 'hauler');
  wrongCraft.status = 'won';
  assert.equal(completeStage(cup, wrongCraft, field), null);
  assert.equal(completeStage(cup, finish(cup), field.slice(1)), null);
  assert.equal(completeStage(cup, finish(cup), field.map(row => ({ ...row, missionId: 'eclipse' }))), null);
  assert.equal(cup.status, 'racing');
  assert.ok(completeStage(cup, finish(cup), field));
});

test('all ten stages finish the cup and award a trophy; a new cup resets only its own progress', () => {
  const cup = createCup('interceptor');
  for (let stage = 0; stage < MISSIONS.length; stage++) {
    const game = finish(cup, 40 + stage);
    completeStage(cup, game, fieldFor(cup));
    game.elapsed = 0;
    assert.equal(cup.legs[stage].results.find(row => row.id === 'player').time, 40 + stage);
    assert.equal(advanceStage(cup), stage < MISSIONS.length - 1);
  }
  assert.equal(cup.status, 'complete');
  assert.equal(cup.legs.length, MISSIONS.length);
  assert.equal(getStandings(cup)[0].id, 'player');
  assert.equal(getStandings(cup)[0].points, MISSIONS.length * 12);
  assert.equal(getTrophy(cup).tier, 'gold');
  const next = createCup(cup.craftId);
  assert.equal(next.legs.length, 0);
  assert.equal(cup.legs.length, MISSIONS.length);
});

test('equal finish times share their placing and points; equal championship scores use total time', () => {
  const cup = createCup('scout');
  completeStage(cup, finish(cup, 49), fieldFor(cup, [49, 53, 58]));
  const result = cup.legs[0].results;
  assert.equal(result.find(row => row.id === 'player').place, 1);
  assert.equal(result.find(row => row.id === RACERS[0].id).points, 12);
  assert.equal(result.find(row => row.id === RACERS[1].id).place, 3);
  assert.equal(getStandings(cup).find(row => row.id === 'player').place, 1);
  advanceStage(cup);
  completeStage(cup, finish(cup, 50), fieldFor(cup, [48, 60, 65]));
  advanceStage(cup);
  completeStage(cup, finish(cup, 46), fieldFor(cup, [50, 60, 65]));
  assert.equal(getStandings(cup)[0].id, 'player');
  assert.equal(getStandings(cup)[0].points, getStandings(cup)[1].points);
  assert.ok(getStandings(cup)[0].time < getStandings(cup)[1].time);
});

test('an opponent that fails delivery receives no points and cannot beat a successful delivery', () => {
  const cup = createCup('scout');
  const field = fieldFor(cup);
  field[0].status = 'lost';
  field[0].time = 10;
  const leg = completeStage(cup, finish(cup, 85), field);
  const failed = leg.results.find(row => row.id === field[0].id);
  assert.equal(failed.points, 0);
  assert.equal(failed.place, 4);
  assert.equal(leg.results.find(row => row.id === 'player').place, 3);
});

test('live classification keeps finished opponents ahead and freezes with simulation time', () => {
  const game = createGame();
  Object.assign(game, { status: 'running', elapsed: 5, distance: 90 });
  const samples = [0, 10].map(time => ({ time, distance: time * 20, lane: 0, height: 0, speed: 20, lateralSpeed: 0 }));
  const field = fieldFor(createCup('scout')).map((row, i) => ({ ...row, time: i === 0 ? 4 : 10, trace: { samples } }));
  const view = getRaceView(game, field);
  assert.equal(view.rows[0].id, field[0].id);
  assert.equal(view.rows[0].finished, true);
  assert.equal(view.place, 4);
  game.status = 'paused';
  assert.deepEqual(getRaceView(game, field), view);
  assert.ok(view.ghosts.every(ghost => ghost.pose.distance < game.mission.length));
});

test('computer competitors fly valid, deterministic, bounded runs for every planet and craft', () => {
  for (const mission of MISSIONS) for (const craft of CRAFTS) {
    const field = buildField(mission.id, craft.id);
    assert.equal(field.length, 3);
    assert.equal(new Set(field.map(row => row.id)).size, 3);
    for (const racer of field) {
      assert.equal(racer.status, 'won', `${mission.id}/${craft.id}/${racer.id}: ${racer.reason}`);
      assert.ok(racer.cargo >= mission.cargo);
      assert.equal(racer.gates, 6);
      assert.ok(racer.time > mission.length / craft.boostSpeed && racer.time < mission.duration);
      assert.ok(racer.trace.samples.length > 100 && racer.trace.samples.length < MAX_GHOST_SAMPLES);
      assert.equal(racer.trace.samples.at(-1).distance, mission.length);
    }
  }
  assert.deepEqual(buildField('tranquility', 'scout'), buildField('tranquility', 'scout'));
});

test('opponents choose distinct flight lines so their projections are identifiable at the start', () => {
  const field = buildField('tranquility', 'scout');
  const lanes = field.map(racer => sampleGhost(racer.trace, 3).lane.toFixed(1));
  assert.equal(new Set(lanes).size, 3);
});
