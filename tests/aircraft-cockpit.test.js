import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AIRCRAFT, createAircraftFlight } from '../src/aircraft-flight.js';
import { createAircraftCockpit, updateCockpitControls, cockpitInstruments, cockpitSeat } from '../src/aircraft-cockpit.js';
import { disposeAircraftObject } from '../src/aircraft-models.js';
import { AviationWorld } from '../src/aviation-world.js';

test('each cockpit has a clear forward window, distinct controls and a seat inside its aircraft', () => {
  for (const aircraft of AIRCRAFT) {
    const cockpit = createAircraftCockpit(aircraft);
    cockpit.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 0, -1), .01, 5);
    assert.equal(ray.intersectObject(cockpit, true).length, 0, 'forward eye line must remain unobstructed');
    assert.ok(cockpit.userData.controls.stick);
    assert.equal(cockpit.userData.controls.throttles.length, aircraft.id === 'a380' ? 4 : 2);
    assert.ok(cockpitSeat(aircraft).every(Number.isFinite));
    assert.ok(Math.abs(cockpitSeat(aircraft)[2]) < aircraft.length / 2);
    const meshes = []; cockpit.traverse(object => { if (object.isMesh) meshes.push(object); });
    assert.ok(meshes.length < 22, 'cockpit geometry must be batched');
    disposeAircraftObject(cockpit);
  }
});

test('cockpit controls reflect the aircraft and release independently from throttle', () => {
  const flight = createAircraftFlight('a380', true), cockpit = createAircraftCockpit(flight.aircraft);
  flight.throttle = .9; flight.gearDown = true;
  updateCockpitControls(cockpit, flight, { pitch: .5, roll: -.7 });
  const controls = cockpit.userData.controls;
  assert.ok(controls.stick.rotation.x > 0); assert.ok(controls.stick.rotation.z > 0);
  assert.ok(controls.throttles.every(lever => lever.rotation.x < 0));
  const angle = controls.throttles[0].rotation.x;
  updateCockpitControls(cockpit, flight, {});
  assert.ok(Math.abs(controls.stick.rotation.x) < 1e-9); assert.ok(Math.abs(controls.stick.rotation.z) < 1e-9);
  assert.equal(controls.throttles[0].rotation.x, angle);
  disposeAircraftObject(cockpit);
});

test('instruments wrap headings and use the same units and warnings as the flight HUD', () => {
  const flight = createAircraftFlight('su30', true);
  Object.assign(flight, { heading: -Math.PI / 2, speed: 200, y: 750, verticalSpeed: -4, stalling: true, gearDown: true, throttle: .7 });
  const data = cockpitInstruments(flight);
  assert.equal(data.speed, 720); assert.equal(data.altitude, 750); assert.equal(data.heading, '270');
  assert.equal(data.vertical, '-4.0'); assert.equal(data.throttle, 70); assert.equal(data.warning, 'STALL');
});

test('cockpit camera follows the aircraft attitude and side looking preserves its bank', () => {
  const flight = createAircraftFlight('su30', true);
  Object.assign(flight, { x: 800, y: 900, z: -1200, heading: 1.2, pitch: .2, roll: .6 });
  const model = new THREE.Group(); model.userData.gear = [];
  const cockpit = createAircraftCockpit(flight.aircraft);
  const passes = [];
  const world = Object.assign(Object.create(AviationWorld.prototype), {
    water: new THREE.Object3D(), aircraftRoot: new THREE.Group(), model, cockpit,
    scene: new THREE.Scene(), cockpitScene: new THREE.Scene(), cockpitCamera: new THREE.PerspectiveCamera(68, 1, .06, 8),
    camera: new THREE.PerspectiveCamera(68, 1, 8, 65000), gateMeshes: [], cameraMode: 2,
    shadow: new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()),
    displayTime: -100, resetCamera: false, lookTarget: 0, lookAngle: 0,
    renderer: { info: { reset() {} }, autoClear: true, clearDepth() {}, render(scene, camera) { passes.push({ scene, near: camera.near, far: camera.far }); } },
  });
  world.render(flight, 1 / 60);
  const expected = new THREE.Vector3(...cockpitSeat(flight.aircraft)).applyQuaternion(world.aircraftRoot.quaternion).add(world.aircraftRoot.position);
  assert.ok(world.camera.position.distanceTo(expected) < 1e-8);
  const local = world.aircraftRoot.quaternion.clone().invert().multiply(world.camera.quaternion);
  assert.ok(local.angleTo(new THREE.Quaternion().setFromEuler(new THREE.Euler(-.08, 0, 0, 'YXZ'))) < 1e-7);
  assert.equal(model.visible, false); assert.equal(cockpit.visible, true);
  assert.deepEqual(passes.map(pass => [pass.near, pass.far]), [[8, 65000], [.06, 8]], 'interior and distant terrain need separate depth ranges');
  assert.equal(world.renderer.autoClear, true);
  world.render(flight, 1, {}, .95);
  assert.ok(world.lookAngle > .9);
  world.setCameraMode(0); world.render(flight, 1 / 60);
  assert.equal(model.visible, true); assert.equal(cockpit.visible, false); assert.equal(world.camera.near, 8);
  assert.equal(world.lookTarget, 0);
  disposeAircraftObject(cockpit); disposeAircraftObject(world.shadow);
});

test('cockpit unload releases its shared materials, geometry and display texture once', () => {
  const texture = new THREE.Texture(), cockpit = createAircraftCockpit(AIRCRAFT[0], texture), counts = new Map();
  const resources = new Set([texture]);
  cockpit.traverse(object => { if (object.isMesh) { resources.add(object.geometry); resources.add(object.material); } });
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, (counts.get(resource) ?? 0) + 1));
  disposeAircraftObject(cockpit);
  assert.equal(counts.size, resources.size); assert.ok([...counts.values()].every(count => count === 1));
});
