import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, updateGame } from '../src/game.js';
import { CRAFTS, MISSIONS } from '../src/missions.js';
import { UPGRADES, upgradeCraft } from '../src/upgrades.js';
import { createExpedition, getContracts, settleExpedition, buyUpgrade, advanceExpedition } from '../src/expedition.js';
import { pilotInput, buildField } from '../src/pilots.js';
import { createCup, completeStage } from '../src/cup.js';
import { FlightRecorder, saveRecord } from '../src/ghost.js';

function finished(run) {
  const game = createGame(MISSIONS[run.stage].id, run.craftId, run.upgrades);
  Object.assign(game, { status: 'won', distance: game.mission.length, gates: 6, elapsed: 60 });
  game.collected = new Set(game.course.pickups.slice(0, game.mission.cargo).map(item => item.id));
  return game;
}

test('upgrades change a private craft without mutating catalogs or caller configuration', () => {
  const original = structuredClone(CRAFTS);
  const levels = { engine: 1, reactor: 2, armor: 1, magnet: 2 };
  const game = createGame('eclipse', 'scout', levels);
  levels.engine = 2;
  assert.equal(game.craft.speed, 40);
  assert.equal(game.craft.boostSpeed, 63);
  assert.equal(game.craft.recharge, 21);
  assert.equal(game.craft.hull, 130);
  assert.equal(game.craft.pickupRange, 6.1);
  assert.equal(game.upgrades.engine, 1);
  assert.deepEqual(CRAFTS, original);
  assert.equal(createGame().craft.speed, 36);
});

test('invalid upgrade configurations are rejected', () => {
  for (const levels of [{ engine: -1 }, { reactor: 3 }, { armor: 0.5 }, { magnet: NaN }, { unknown: 1 }]) {
    assert.throws(() => createGame('tranquility', 'scout', levels), RangeError);
  }
});

test('retry restores the upgraded build and resets flight objectives', () => {
  const game = createGame('eclipse', 'hauler', { engine: 2, armor: 2 });
  Object.assign(game, { hull: 1, energy: 2, perfectGates: 4, airDodges: 2 });
  game.activatedPads.add(1);
  game.collected.add(1);
  startGame(game);
  assert.equal(game.craft.speed, 40);
  assert.equal(game.hull, 200);
  assert.equal(game.energy, 100);
  assert.equal(game.perfectGates, 0);
  assert.equal(game.airDodges, 0);
  assert.equal(game.collected.size + game.activatedPads.size, 0);
});

test('magnet collects a wider lane but cannot collect from high altitude', () => {
  for (const [levels, height, expected] of [[{}, 0, 0], [{ magnet: 1 }, 0, 1], [{ magnet: 2 }, 3, 0]]) {
    const game = createGame('tranquility', 'scout', levels);
    startGame(game);
    const core = game.course.pickups[0];
    Object.assign(game, { status: 'running', distance: core.distance - 0.1, lane: core.lane + 4.5, speed: 30, height });
    updateGame(game, { accelerate: true }, 1 / 60);
    assert.equal(game.collected.size, expected);
  }
});

test('engine and reactor upgrades affect actual fixed-step driving', () => {
  const base = createGame();
  const upgraded = createGame('tranquility', 'scout', { engine: 2, reactor: 2 });
  for (const game of [base, upgraded]) {
    Object.assign(game, { status: 'running', energy: 0 });
    for (let step = 0; step < 120; step++) updateGame(game, { accelerate: true }, 1 / 60);
  }
  assert.ok(upgraded.speed > base.speed);
  assert.ok(upgraded.distance > base.distance);
  assert.ok(upgraded.energy > base.energy + 19);
});

test('contracts reflect real run stats and vary across the three stages', () => {
  const signatures = new Set();
  for (const mission of MISSIONS) {
    const game = createGame(mission.id);
    const contracts = getContracts(game);
    assert.equal(contracts.length, 3);
    assert.ok(contracts.every(item => !item.done && item.progress === 0));
    const cargo = contracts.find(item => item.id === 'cargo');
    assert.ok(cargo.target > mission.cargo && cargo.target <= game.course.pickups.length);
    signatures.add(contracts.map(item => `${item.id}/${item.target}`).join(','));
    game.collected = new Set(game.course.pickups.map(item => item.id));
    game.perfectGates = 6;
    game.airDodges = 2;
    game.activatedPads = new Set(game.course.pads.map(item => item.id));
    assert.ok(getContracts(game).every(item => item.done));
  }
  assert.equal(signatures.size, 3);
});

test('successful delivery guarantees supply even without optional contracts', () => {
  const run = createExpedition('scout');
  const leg = settleExpedition(run, finished(run));
  assert.equal(leg.earned, 2);
  assert.equal(run.supply, 2);
  assert.equal(run.status, 'resupply');
  assert.equal(run.legs.length, 1);
  assert.equal(run.stage, 0);
});

test('completed contracts are paid once, and the receipt survives retry mutations', () => {
  const run = createExpedition('scout');
  const game = finished(run);
  game.collected = new Set(game.course.pickups.map(item => item.id));
  game.perfectGates = 6;
  game.activatedPads = new Set([0, 1]);
  const leg = settleExpedition(run, game);
  assert.equal(leg.earned, 8);
  assert.equal(settleExpedition(run, game), null);
  assert.equal(run.supply, 8);
  startGame(game);
  assert.ok(leg.contracts.every(item => item.done));
  assert.ok(Object.isFrozen(leg) && Object.isFrozen(leg.contracts[0]));
});

test('failed, mismatched, out-of-order and wrong-build runs cannot settle', () => {
  const run = createExpedition('scout');
  const baseline = structuredClone(run);
  for (const game of [
    { ...finished(run), status: 'lost' },
    { ...finished(run), mission: MISSIONS[1] },
    { ...finished(run), craft: CRAFTS[1] },
    { ...finished(run), upgrades: { engine: 1 } },
  ]) assert.equal(settleExpedition(run, game), null);
  assert.deepEqual(run, baseline);
  assert.equal(advanceExpedition(run), false);
  assert.equal(buyUpgrade(run, 'armor'), false);
});

test('purchases require resupply, enforce funds and caps, and do not advance automatically', () => {
  const run = createExpedition('scout');
  settleExpedition(run, finished(run));
  const before = structuredClone(run);
  assert.equal(buyUpgrade(run, 'engine'), false);
  assert.equal(buyUpgrade(run, 'invalid'), false);
  assert.deepEqual(run, before);
  assert.equal(buyUpgrade(run, 'armor'), true);
  assert.equal(run.supply, 0);
  assert.equal(run.upgrades.armor, 1);
  assert.equal(buyUpgrade(run, 'armor'), false);
  assert.equal(run.stage, 0);
  assert.equal(advanceExpedition(run), true);
  assert.equal(buyUpgrade(run, 'armor'), false);
  const game = finished(run);
  game.perfectGates = 6;
  settleExpedition(run, game);
  assert.equal(buyUpgrade(run, 'armor'), true);
  assert.equal(run.upgrades.armor, 2);
  assert.equal(buyUpgrade(run, 'armor'), false);
  assert.equal(run.supply, 2);
});

test('three stages complete once, preserve earnings, and new expeditions start empty', () => {
  const run = createExpedition('interceptor');
  for (let stage = 0; stage < 3; stage++) {
    assert.equal(run.stage, stage);
    const game = finished(run);
    assert.ok(settleExpedition(run, game));
    assert.equal(settleExpedition(run, game), null);
    assert.equal(advanceExpedition(run), stage < 2);
  }
  assert.equal(run.status, 'complete');
  assert.equal(run.supply, 6);
  assert.equal(run.legs.reduce((sum, leg) => sum + leg.earned, 0), 6);
  assert.equal(buyUpgrade(run, 'reactor'), false);
  const fresh = createExpedition('interceptor');
  assert.equal(fresh.supply, 0);
  assert.equal(fresh.legs.length, 0);
  assert.deepEqual(fresh.upgrades, {});
  assert.throws(() => createExpedition('invalid'), RangeError);
});

test('every craft can finish all stages with each fully upgraded subsystem', () => {
  for (const craft of CRAFTS) for (const upgrade of [...UPGRADES, { id: 'all' }]) {
    const levels = upgrade.id === 'all' ? Object.fromEntries(UPGRADES.map(item => [item.id, 2])) : { [upgrade.id]: 2 };
    for (const mission of MISSIONS) {
      const game = createGame(mission.id, craft.id, levels);
      assert.equal(game.craft.hull, upgradeCraft(craft, levels).hull);
      startGame(game);
      for (let step = 0; step < 9000 && ['countdown', 'running'].includes(game.status); step++) {
        updateGame(game, pilotInput(game, { coast: 0, offset: 0 }), 1 / 60);
      }
      assert.equal(game.status, 'won', `${craft.id}/${upgrade.id}/${mission.id}: ${game.reason}`);
    }
  }
});

test('upgraded successful flights cannot set standard ghosts or championship points', () => {
  const game = createGame('tranquility', 'scout', { engine: 1 });
  startGame(game);
  const recorder = new FlightRecorder(game);
  for (let step = 0; step < 9000 && ['countdown', 'running'].includes(game.status); step++) {
    updateGame(game, pilotInput(game, { coast: 0, offset: 0 }), 1 / 60);
    recorder.capture(game);
  }
  assert.equal(game.status, 'won');
  const records = new Map();
  assert.equal(saveRecord(records, game, recorder).newBest, false);
  assert.equal(records.size, 0);
  const cup = createCup('scout');
  assert.equal(completeStage(cup, game, buildField('tranquility', 'scout')), null);
  assert.equal(cup.legs.length, 0);
});
