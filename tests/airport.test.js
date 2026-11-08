import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIRPORT_BUILDINGS, RUNWAY, TAXIWAYS } from '../src/airport.js';
import { createAirport } from '../src/airport-view.js';
import { createRunway } from '../src/runway-view.js';
import { createAircraftFlight, updateAircraftFlight } from '../src/aircraft-flight.js';
import { disposeAircraftObject } from '../src/aircraft-models.js';

test('airport structures leave the runway, parallel taxiway and approach clear', () => {
  for (const building of AIRPORT_BUILDINGS) {
    assert.ok(Math.abs(building.x) - building.width / 2 > RUNWAY.width / 2 + 25);
    assert.ok(building.base >= 0 && building.height > building.base);
    if (building.kind === 'jetway') assert.ok(building.x + building.width / 2 < -212);
  }
  assert.ok(TAXIWAYS.some(taxiway => taxiway.x === -170));
  assert.ok(TAXIWAYS.some(taxiway => taxiway.x === -85));
});

test('airport modeling is batched, has named facilities and disposes resources once', () => {
  const airport = createAirport(), resources = new Set();
  assert.ok(airport.getObjectByName('airport-architecture'));
  assert.ok(airport.getObjectByName('airport-pavement'));
  for (const mesh of airport.getObjectByName('airport-pavement').children) {
    assert.equal(mesh.material.polygonOffset, true);
    assert.ok(mesh.material.polygonOffsetFactor < 0, 'distant pavement must not fight terrain depth');
  }
  let meshes = 0;
  airport.traverse(object => {
    if (!object.isMesh) return;
    meshes++; resources.add(object.geometry); resources.add(object.material);
    assert.ok(object.geometry.attributes.position.array.every(Number.isFinite));
    const positions = object.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      if (positions.getY(index) > 1) assert.ok(Math.abs(positions.getX(index)) > RUNWAY.width / 2 + 25, 'modeled geometry must leave the runway clear');
    }
  });
  assert.ok(meshes <= 20, `airport uses ${meshes} draw batches`);
  const disposed = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  disposeAircraftObject(airport);
  assert.equal(disposed.size, resources.size);
  assert.ok([...disposed.values()].every(count => count === 1));
});

test('elevated jetways collide at cabin height and permit flight above', () => {
  for (const building of AIRPORT_BUILDINGS.filter(item => item.kind === 'jetway')) {
    const hit = createAircraftFlight('su30', true);
    Object.assign(hit, { x: building.x, z: building.z, y: (building.base + building.height) / 2, speed: 0 });
    updateAircraftFlight(hit, {}, 1 / 120);
    assert.equal(hit.status, 'crashed');
    const above = createAircraftFlight('su30', true);
    Object.assign(above, { x: building.x, z: building.z, y: 200 });
    updateAircraftFlight(above, {}, 1 / 120);
    assert.equal(above.status, 'running');
  }
});

test('runway uses shared dimensions, batched markings, approach and taxiway lights', () => {
  assert.equal(RUNWAY.length, 4000); assert.equal(RUNWAY.width, 60); assert.equal(RUNWAY.shoulder, 15);
  assert.equal(RUNWAY.start - RUNWAY.end, RUNWAY.length);
  assert.equal(RUNWAY.center, (RUNWAY.start + RUNWAY.end) / 2);
  const runway = createRunway(); runway.updateMatrixWorld(true);
  const surface = runway.getObjectByName('runway-surface');
  assert.ok(surface);
  const bounds = new THREE.Box3().setFromObject(surface);
  assert.equal(bounds.min.z, RUNWAY.end); assert.equal(bounds.max.z, RUNWAY.start);
  assert.equal(bounds.max.x - bounds.min.x, RUNWAY.width);
  for (const name of ['runway-markings', 'runway-shoulders', 'runway-approach-lights', 'runway-edge-lights', 'taxiway-edge-lights']) assert.ok(runway.getObjectByName(name), name);
  let meshes = 0;
  runway.traverse(object => { if (object.isMesh) { meshes++; assert.ok(object.geometry.attributes.position.array.every(Number.isFinite)); } });
  assert.ok(meshes <= 12, `runway needs ${meshes} batches`);
  const resources = new Set(), disposed = new Map();
  runway.traverse(object => { if (object.isMesh) { resources.add(object.geometry); resources.add(object.material); } });
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, (disposed.get(resource) ?? 0) + 1));
  disposeAircraftObject(runway);
  assert.equal(disposed.size, resources.size); assert.ok([...disposed.values()].every(count => count === 1));
});
