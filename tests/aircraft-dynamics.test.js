import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRCRAFT, createAircraftFlight, updateAircraftFlight, aircraftEnvelope, setAircraftPhysics, toggleAircraftPause } from '../src/aircraft-flight.js';

function advance(flight, seconds, input = {}, step = 1 / 60) {
  for (let time = 0; time < seconds - 1e-9; time += step) updateAircraftFlight(flight, input, Math.min(step, seconds - time));
}

test('engines spool progressively in both directions and response tuning changes delivered thrust', () => {
  const flights = [.25, 3].map(engineResponse => {
    const flight = createAircraftFlight('su30', false, { physics: { engineResponse } });
    flight.status = 'running'; flight.throttle = 1; advance(flight, .5); return flight;
  });
  assert.ok(flights[0].engineOutput > 0 && flights[0].engineOutput < flights[1].engineOutput);
  assert.ok(flights[1].engineOutput < 1 && flights[1].speed > flights[0].speed);
  const flight = flights[1], previous = flight.engineOutput;
  flight.throttle = 0; updateAircraftFlight(flight, {}, 1 / 120);
  assert.ok(flight.engineOutput > 0 && flight.engineOutput < previous);
  flight.status = 'paused'; const snapshot = structuredClone(flight);
  advance(flight, 3); assert.deepEqual(flight, { ...snapshot, events: [] });
  setAircraftPhysics(flight, { engineResponse: 100 }); assert.equal(flight.physics.engineResponse, 3);
});

test('bank increases stall reference, consumes speed and recovers after levelling', () => {
  const flights = [0, Math.PI / 3].map(roll => {
    const flight = createAircraftFlight('su30', true, { physics: { mode: 'maneuver', stability: 0 } });
    Object.assign(flight, { y: 3000, speed: 65, throttle: 0, engineOutput: 0, roll }); return flight;
  });
  const level = aircraftEnvelope(flights[0]), banked = aircraftEnvelope(flights[1]);
  assert.ok(banked.stall > level.stall * 1.35);
  advance(flights[0], .5); advance(flights[1], .5);
  assert.equal(flights[0].stalling, false); assert.equal(flights[1].stalling, true);
  assert.ok(flights[1].speed < flights[0].speed - .2);
  flights[1].roll = 0;
  assert.ok(Math.abs(aircraftEnvelope(flights[1]).stall - level.stall) < .001);
  updateAircraftFlight(flights[1], {}, 1 / 120); assert.equal(flights[1].stalling, false);
});

test('spooling and turning remain consistent across frame rates and pause cannot advance the engine', () => {
  for (const id of ['a380', 't6', 'b62', 'c24', 'd9']) {
    const flights = [1 / 30, 1 / 60, 1 / 120].map(step => {
      const flight = createAircraftFlight(id, true);
      flight.y = 3000; flight.throttle = 1;
      advance(flight, 4, { roll: .3 }, step); return flight;
    });
    for (const flight of flights) {
      assert.equal(flight.status, 'running');
      for (const key of ['speed', 'y', 'heading', 'engineOutput']) assert.ok(Math.abs(flight[key] - flights[0][key]) < .001, `${id} ${key}`);
      toggleAircraftPause(flight); const output = flight.engineOutput;
      advance(flight, 2); assert.equal(flight.engineOutput, output);
    }
  }
});

test('the six aircraft have distinct propulsion, safe airborne starts and working custom settings', () => {
  assert.equal(AIRCRAFT.length, 6);
  assert.equal(new Set(AIRCRAFT.map(aircraft => aircraft.id)).size, 6);
  for (const aircraft of AIRCRAFT) {
    assert.ok(aircraft.engines >= 1 && aircraft.engineResponse > 0 && aircraft.turnDrag > 0);
    for (const physics of [{}, { mass: 2, lift: .5 }, { maxSpeed: .5 }, { thrust: 0 }]) {
      const flight = createAircraftFlight(aircraft.id, true, { physics });
      const envelope = aircraftEnvelope(flight);
      assert.ok(flight.speed <= envelope.maxSpeed);
      if (envelope.stall * 1.4 <= envelope.maxSpeed * .85) assert.ok(flight.speed >= envelope.stall * 1.4);
      advance(flight, .5);
      assert.equal(flight.status, 'running');
      assert.ok(Number.isFinite(flight.engineOutput));
    }
  }
});
