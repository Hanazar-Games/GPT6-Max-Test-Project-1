import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, getDeliveryStatus, getFlightCue } from '../src/game.js';
import { MISSIONS } from '../src/missions.js';

function flight() {
  const game = createGame('earth', 'nova');
  Object.assign(game, { status: 'running', speed: 300, distance: 100 });
  game.course.gates = [{ id: 0, distance: 1200, lane: 0, width: 9 }];
  game.course.pickups = [{ id: 0, distance: 400, lane: -8 }, { id: 1, distance: 800, lane: 8 }];
  return game;
}

test('delivery status counts only uncollected cores ahead or inside the contact window', () => {
  const game = flight();
  game.course.pickups = [
    { id: 0, distance: 98, lane: 0 }, { id: 1, distance: 98.1, lane: 0 },
    { id: 2, distance: 300, lane: 0 }, { id: 3, distance: 200, lane: 0 },
  ];
  game.collected.add(2);
  const status = getDeliveryStatus(game);
  assert.equal(status.needed, game.mission.cargo - 1);
  assert.equal(status.remaining, 2);
  assert.equal(status.next.id, 1);
  assert.equal(status.shortfall, status.needed - 2);
});

test('gate rewinds restore missed cores to the remaining supply without duplicating collected cores', () => {
  const game = flight();
  game.distance = 405;
  game.missedPickups.add(0);
  assert.equal(getDeliveryStatus(game).remaining, 1);
  game.distance = 380;
  assert.equal(getDeliveryStatus(game).remaining, 2);
  game.collected.add(0);
  assert.equal(getDeliveryStatus(game).remaining, 1);
  assert.equal(getDeliveryStatus(game).next.id, 1);
});

test('core guidance follows the next pickup until it is collected and respects magnetic upgrades', () => {
  const game = flight();
  let cue = getFlightCue(game);
  assert.equal(cue.kind, 'cargo');
  assert.equal(cue.direction, 'left');
  assert.equal(cue.distance, 300);
  game.lane = -8;
  assert.equal(getFlightCue(game).direction, 'center');
  game.collected.add(0);
  game.distance = 300;
  assert.equal(getFlightCue(game).direction, 'right');
  game.lane = 3;
  game.craft = { ...game.craft, pickupRange: 6 };
  assert.equal(getFlightCue(game).direction, 'center');
});

test('hazards and imminent gates take priority over core collection guidance', () => {
  const game = flight();
  game.course.obstacles = [{ id: 0, distance: 300, lane: 0, radius: 2.8, kind: 'rock' }];
  assert.equal(getFlightCue(game).kind, 'hazard');
  game.course.obstacles = [];
  game.course.meteors = [{ id: 0, distance: 250, lane: 0, radius: 5, first: 0.4, period: 8 }];
  assert.equal(getFlightCue(game).kind, 'meteor');
  game.course.meteors = [];
  game.course.gates[0].distance = 500;
  game.distance = 280;
  assert.equal(getFlightCue(game).kind, 'gate');
  game.course.gates[0].distance = 250;
  game.distance = 100;
  assert.equal(getFlightCue(game).kind, 'gate');
});

test('loaded craft keep gate guidance and exhausted routes report zero available cores', () => {
  const game = flight();
  for (let id = 0; id < game.mission.cargo; id++) game.collected.add(id);
  assert.equal(getDeliveryStatus(game).needed, 0);
  assert.equal(getDeliveryStatus(game).shortfall, 0);
  assert.equal(getFlightCue(game).kind, 'gate');
  const short = createGame('tranquility');
  short.distance = short.course.gates.at(-1).distance + 1;
  short.gates = 6;
  const status = getDeliveryStatus(short);
  assert.equal(status.remaining, 0);
  assert.equal(status.next, null);
  assert.equal(status.shortfall, short.mission.cargo);
  assert.equal(getFlightCue(short).kind, 'finish');
});

test('fresh missions have enough forward supply, and delivery guidance does not mutate the flight', () => {
  for (const mission of MISSIONS) {
    const game = createGame(mission.id);
    const before = structuredClone(game);
    const status = getDeliveryStatus(game);
    assert.equal(status.shortfall, 0, mission.id);
    assert.equal(status.remaining, game.course.pickups.length, mission.id);
    getFlightCue(game);
    assert.deepEqual(game, before);
  }
});
