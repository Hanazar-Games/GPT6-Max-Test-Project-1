import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIRPORTS, airportHeight } from '../src/airport.js';
import { AIRCRAFT, createAircraftFlight, updateAircraftFlight, runwayContact, toggleAircraftGear } from '../src/aircraft-flight.js';
import { createRunway } from '../src/runway-view.js';
import { createAirportLod } from '../src/airport-view.js';
import { createAviationTerrain } from '../src/aviation-terrain.js';
import { disposeAircraftObject } from '../src/aircraft-models.js';

test('three independent airport sites have supported runways, facilities and clear approaches', () => {
  assert.equal(AIRPORTS.length, 3);
  assert.equal(new Set(AIRPORTS.map(site => site.biome)).size, 3);
  for (const site of AIRPORTS) {
    assert.ok(Object.isFrozen(site));
    const runway = site.runway;
    assert.equal(runway.start - runway.end, runway.length);
    for (const [x, z] of [[-12000, 0], [12000, 0], [0, -14000], [0, 14000]]) assert.ok(airportHeight(x, z, site) <= -12, 'terrain must meet the sea before the tile boundary');
    for (let z = runway.end - 900; z <= runway.start + 900; z += 100) for (const x of [-runway.width / 2 - 15, 0, runway.width / 2 + 15]) assert.equal(airportHeight(x, z, site), site.elevation);
    for (const building of site.buildings) {
      assert.equal(airportHeight(building.x, building.z, site), site.elevation);
      assert.ok(Math.abs(building.x) - building.width / 2 > runway.width / 2 + 25);
    }
    for (const kind of ['terminal', 'tower', 'hangar', 'fuel', 'fire-station', 'cargo', 'radar', 'jetway', 'windsock']) assert.ok(site.buildings.some(building => building.kind === kind), `${site.id}: ${kind}`);
    for (const gate of site.gates) assert.ok(gate.y - airportHeight(gate.x, gate.z, site) >= 150);
    const surface = createRunway(site), airport = createAirportLod(site);
    surface.updateMatrixWorld(true);airport.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(surface.getObjectByName('runway-surface'));
    assert.equal(bounds.min.z, runway.end);assert.equal(bounds.max.z, runway.start);
    assert.equal(bounds.max.x - bounds.min.x, runway.width);
    assert.ok(Math.abs(bounds.max.y - site.elevation - .45) < .001);
    const parked = createAircraftFlight('r220', false, { airport: site.id });
    assert.ok(Math.abs(parked.y - parked.aircraft.gearHeight - bounds.max.y) < .001, 'tires must rest on the visible runway rather than sink below it');
    assert.ok(new THREE.Box3().setFromObject(airport).min.y >= site.elevation);
    disposeAircraftObject(surface);disposeAircraftObject(airport);
  }
});

test('each airport supports elevated starts, takeoff, landing and building collisions in both directions', () => {
  for (const airport of AIRPORTS) for (const runwayDirection of ['18', '36']) for (const aircraft of AIRCRAFT) {
    const ground = createAircraftFlight(aircraft.id, false, { airport: airport.id, runwayDirection });
    assert.equal(ground.airport, airport);assert.ok(Math.abs(ground.y - airport.elevation - airport.runway.surfaceHeight - ground.aircraft.gearHeight) < .001);
    ground.status = 'running';updateAircraftFlight(ground, {}, .1);
    assert.equal(ground.hasFlown, false);assert.equal(ground.status, 'running', 'an elevated runway is not a completed flight');
    ground.throttle = 1;
    for (let i = 0; i < 1800 && ground.onGround && ground.status === 'running'; i++) updateAircraftFlight(ground, { pitch: ground.speed >= ground.performance.takeoff ? .4 : 0 }, 1 / 60);
    assert.equal(ground.status, 'running');assert.equal(ground.onGround, false, airport.id);
    const landing = createAircraftFlight(aircraft.id, false, { airport: airport.id, runwayDirection });
    Object.assign(landing, { status: 'running', onGround: false, hasFlown: true, y: airport.elevation + landing.aircraft.gearHeight + .001, speed: aircraft.stall, verticalSpeed: -.5 });
    assert.equal(runwayContact(landing, landing.aircraft), true);
    updateAircraftFlight(landing, {}, .05);
    assert.equal(landing.onGround, true);assert.equal(landing.status, 'running');
    const building = airport.buildings.find(item => item.kind === 'terminal');
    const hit = createAircraftFlight('t6', true, { airport: airport.id });
    Object.assign(hit, { x: building.x, z: building.z, y: airport.elevation + 20, speed: 0 });
    updateAircraftFlight(hit, {}, 1 / 120);assert.equal(hit.status, 'crashed');
  }
});

test('terrain vertices match the selected airport collision surface', () => {
  for (const airport of AIRPORTS) {
    const terrain = createAviationTerrain('low', 4500, airport);
    for (const lod of terrain.children) for (const { object } of lod.levels) {
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(positions.getY(i) - airportHeight(positions.getX(i) + lod.position.x, positions.getZ(i) + lod.position.z, airport)) < .001);
    }
    disposeAircraftObject(terrain);
  }
});

test('landing gear moves progressively, freezes on pause and must lock before touchdown', () => {
  const flight = createAircraftFlight('r220', true);
  assert.equal(flight.gearPosition, 0);assert.equal(toggleAircraftGear(flight), true);
  updateAircraftFlight(flight, {}, .25);
  assert.ok(flight.gearPosition > 0 && flight.gearPosition < .1);
  const approach = { ...flight, x: 0, z: 0, pitch: 0, roll: 0, heading: 0, trackHeading: 0, speed: 60, verticalSpeed: -.5 };
  assert.equal(runwayContact(approach, flight.aircraft), false);
  assert.equal(runwayContact({ ...approach, gearPosition: 1 }, flight.aircraft), true);
  const position = flight.gearPosition;flight.status = 'paused';updateAircraftFlight(flight, {}, .25);assert.equal(flight.gearPosition, position);
  flight.status = 'running';flight.y = 3000;
  for (let i = 0; i < 32; i++) updateAircraftFlight(flight, {}, .25);
  assert.equal(flight.gearPosition, 1);
  assert.equal(toggleAircraftGear(flight), true);updateAircraftFlight(flight, {}, .25);
  assert.ok(flight.gearPosition < 1);
});
