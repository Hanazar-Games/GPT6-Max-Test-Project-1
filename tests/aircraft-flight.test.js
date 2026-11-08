import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT, AIR_GATES, createAircraftFlight, updateAircraftFlight, toggleAircraftGear, toggleAircraftPause, crossesAirGate, runwayContact, islandHeight } from '../src/aircraft-flight.js';
import { AIRPORT_BUILDINGS } from '../src/airport.js';

function advance(flight, input, seconds, step = 1 / 60) {
  for (let time = 0; time < seconds - 1e-9; time += step) updateAircraftFlight(flight, input, Math.min(step, seconds - time));
}

test('both aircraft accelerate on the runway and need speed plus rotation to take off', () => {
  for (const aircraft of AIRCRAFT) {
    const flight = createAircraftFlight(aircraft.id);
    flight.status = 'running'; flight.throttle = 1;
    advance(flight, {}, 5);
    assert.equal(flight.onGround, true);
    assert.ok(flight.speed > 10);
    advance(flight, { pitch: 1 }, 30);
    assert.equal(flight.status, 'running');
    assert.equal(flight.onGround, false);
    assert.ok(flight.y > 100);
    assert.equal(toggleAircraftGear(flight), true);
    assert.equal(flight.gearDown, false);
  }
});

test('the fighter is faster and more agile than the airliner', () => {
  const flights = AIRCRAFT.map(aircraft => createAircraftFlight(aircraft.id, true));
  for (const flight of flights) { flight.throttle = 1; advance(flight, { roll: .6 }, 15); }
  assert.ok(flights[1].speed > flights[0].speed * 1.4);
  assert.ok(flights[1].roll > flights[0].roll);
  assert.ok(flights.every(flight => flight.x > 0 && flight.status === 'running'));
});

test('low airspeed loses lift, falls under gravity and cannot hover', () => {
  const flight = createAircraftFlight('a380', true);
  Object.assign(flight, { speed: 10, throttle: 0, y: 1000 });
  advance(flight, { pitch: 1 }, 3);
  assert.ok(flight.verticalSpeed < -10);
  assert.ok(flight.y < 980);
  assert.equal(flight.stalling, true);
});

test('safe runway touchdown needs gear, alignment, moderate bank, speed and descent', () => {
  const sample = { x: 0, z: 0, heading: 0, roll: .03, pitch: .05, speed: 80, verticalSpeed: -2, gearDown: true };
  assert.equal(runwayContact(sample, AIRCRAFT[0]), true);
  for (const change of [{ gearDown: false }, { x: 90 }, { z: -4000 }, { heading: .8 }, { roll: .5 }, { speed: 180 }, { verticalSpeed: -15 }, { pitch: -.3 }]) {
    assert.equal(runwayContact({ ...sample, ...change }, AIRCRAFT[0]), false);
  }
  assert.equal(runwayContact({ ...sample, heading: Math.PI }, AIRCRAFT[0]), true);
});

test('touchdown and rollout finish a flight, unsafe impact stays crashed', () => {
  const flight = createAircraftFlight('a380', true);
  Object.assign(flight, { x: 0, y: AIRCRAFT[0].gearHeight + .01, z: 0, verticalSpeed: -2, speed: 65, throttle: 0, gearDown: true, hasFlown: true });
  advance(flight, { brake: true }, 6);
  assert.equal(flight.status, 'completed');
  assert.equal(flight.onGround, true);
  const crashed = createAircraftFlight('su30', true);
  Object.assign(crashed, { y: 2.6, verticalSpeed: -20, gearDown: false });
  updateAircraftFlight(crashed, {}, .1);
  assert.equal(crashed.status, 'crashed');
  const snapshot = structuredClone(crashed);
  advance(crashed, { throttle: 1, pitch: 1 }, 5);
  assert.deepEqual(crashed, { ...snapshot, events: [] });
});

test('gear cannot retract on the ground and pause freezes all flight motion', () => {
  const flight = createAircraftFlight();
  assert.equal(toggleAircraftGear(flight), false);
  flight.status = 'running';
  toggleAircraftPause(flight);
  const snapshot = structuredClone(flight);
  advance(flight, { throttle: 1, pitch: 1 }, 4);
  assert.deepEqual(flight, { ...snapshot, events: [] });
  toggleAircraftPause(flight);
  assert.equal(flight.status, 'running');
  for (const dt of [0, -1, NaN, Infinity]) updateAircraftFlight(flight, { throttle: 1 }, dt);
  assert.deepEqual(flight, { ...snapshot, status: 'running', events: [] });
});

test('gate detection checks the swept crossing and rejects distant or parallel passes', () => {
  const gate = { x: 0, y: 300, z: -100, radius: 100, normal: [0, 0, -1] };
  assert.equal(crossesAirGate({ x: 10, y: 310, z: 0 }, { x: 10, y: 310, z: -200 }, gate), true);
  assert.equal(crossesAirGate({ x: 150, y: 310, z: 0 }, { x: 150, y: 310, z: -200 }, gate), false);
  assert.equal(crossesAirGate({ x: 0, y: 300, z: 0 }, { x: 100, y: 300, z: 0 }, gate), false);
});

test('flight integration stays finite and consistent across render frame sizes', () => {
  for (const aircraft of AIRCRAFT) {
    const flights = [1 / 30, 1 / 60, 1 / 120].map(step => {
      const flight = createAircraftFlight(aircraft.id, true);
      advance(flight, { pitch: .25, roll: .3 }, 12, step);
      return flight;
    });
    for (const flight of flights) {
      assert.ok(['x', 'y', 'z', 'speed', 'pitch', 'roll', 'heading', 'verticalSpeed'].every(key => Number.isFinite(flight[key])));
      assert.ok(Math.abs(flight.x - flights[0].x) < .001);
      assert.ok(Math.abs(flight.y - flights[0].y) < .001);
    }
  }
});

test('airport and city buildings collide, while flying above their roofs is clear', () => {
  for (const building of AIRPORT_BUILDINGS) {
    const flight = createAircraftFlight('su30', true);
    Object.assign(flight, { x: building.x, z: building.z, y: building.height / 2, speed: 30 });
    updateAircraftFlight(flight, {}, 1 / 120);
    assert.equal(flight.status, 'crashed');
    const clear = createAircraftFlight('su30', true);
    Object.assign(clear, { x: building.x, z: building.z, y: building.height + 50, speed: 80 });
    updateAircraftFlight(clear, {}, 1 / 120);
    assert.equal(clear.status, 'running');
  }
});

test('runway stays flat, every gate clears terrain and gate collection cannot repeat', () => {
  for (let z = -2800; z <= 1600; z += 50) assert.equal(islandHeight(0, z), 0);
  for (const gate of AIR_GATES) assert.ok(gate.y - islandHeight(gate.x, gate.z) > gate.radius);
  const flight = createAircraftFlight('su30', true);
  Object.assign(flight, { x: 0, y: 180, z: -1999, speed: 220 });
  updateAircraftFlight(flight, {}, 1 / 30);
  assert.equal(flight.gates, 1);
  Object.assign(flight, { z: -1999 });
  updateAircraftFlight(flight, {}, 1 / 30);
  assert.equal(flight.gates, 1);
});
