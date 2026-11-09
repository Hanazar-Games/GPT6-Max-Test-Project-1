import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AviationWorld, AVIATION_CAMERAS, AVIATION_VIEW_DEFAULTS } from '../src/aviation-world.js';
import { AIRCRAFT, createAircraftFlight } from '../src/aircraft-flight.js';
import { AviationRenderClock } from '../src/aviation-render-clock.js';
import { createAircraftCockpit } from '../src/aircraft-cockpit.js';
import { disposeAircraftObject } from '../src/aircraft-models.js';

function fixture(id = 'su30') {
  const flight = createAircraftFlight(id, true);
  Object.assign(flight, { status: 'running', x: 0, y: 2000, z: 0, pitch: 0, roll: 0, heading: 0 });
  const model = new THREE.Group(); model.userData.gear = []; model.userData.propellers = [];
  const world = Object.assign(Object.create(AviationWorld.prototype), {
    aircraftRoot: new THREE.Group(), model, water: new THREE.Object3D(), gateMeshes: [],
    camera: new THREE.PerspectiveCamera(57, 1, 8, 65000), cameraMode: 0,
    shadow: { position: new THREE.Vector3(), scale: new THREE.Vector3(), rotation: {}, material: {} },
    viewSettings: { ...AVIATION_VIEW_DEFAULTS }, lookTarget: 0, lookAngle: 0, resetCamera: true,
    renderer: { info: { reset() {} }, render() {} },
  });
  return { world, flight };
}

test('six distinct camera presets frame every aircraft outside its near clipping envelope', () => {
  assert.equal(AVIATION_CAMERAS.length, 6);
  for (const aircraft of AIRCRAFT) {
    const { world, flight } = fixture(aircraft.id), positions = [];
    for (const mode of [0, 1, 3, 4, 5]) {
      world.setCameraMode(mode); world.render(flight, 1 / 60);
      const relative = world.camera.position.clone().sub(world.aircraftRoot.position);
      assert.ok(relative.length() >= Math.hypot(aircraft.length, aircraft.span) / 2 + 10 - 1e-8);
      assert.ok(world.camera.quaternion.toArray().every(Number.isFinite));
      positions.push(relative);
    }
    assert.ok(positions[2].z < 0, 'nose view looks back toward the aircraft');
    assert.ok(positions[3].x < 0, 'left wing view is on the port side');
    assert.ok(positions[4].y > Math.abs(positions[4].z) * 3, 'overhead view is elevated');
    for (let a = 0; a < positions.length; a++) for (let b = a + 1; b < positions.length; b++) assert.ok(positions[a].distanceTo(positions[b]) > 1);
  }
});

test('locked direction follows translation while preserving its world bearing and upright horizon', () => {
  const { world, flight } = fixture(); flight.physics.mode = 'maneuver';
  world.render(flight, 1 / 60);
  assert.equal(world.toggleCameraLock(), true);
  const relative = world.camera.position.clone().sub(world.aircraftRoot.position);
  Object.assign(flight, { x: 400, y: 2100, z: -600, heading: 1.3, pitch: .8, roll: 2 });
  world.render(flight, 1 / 30);
  assert.ok(world.camera.position.clone().sub(world.aircraftRoot.position).distanceTo(relative) < 1e-7);
  assert.deepEqual(world.camera.up.toArray(), [0, 1, 0]);
  assert.equal(world.toggleCameraLock(), false);
  world.render(flight, 1 / 30);
  assert.ok(world.camera.position.clone().sub(world.aircraftRoot.position).distanceTo(relative) > 1);
  world.toggleCameraLock(); world.setCameraMode(4);
  assert.equal(world.cameraLocked, false, 'switching presets releases direction lock');
  world.setCameraMode(2); assert.equal(world.toggleCameraLock(), false, 'cockpit uses aircraft attitude');
});

test('locking immediately after a camera switch captures the newly selected preset', () => {
  for (const mode of [0, 3, 4, 5]) {
    const { world, flight } = fixture(), reference = fixture();
    world.setCameraMode(1); world.render(flight, 1 / 60);
    world.setCameraMode(mode); world.toggleCameraLock(); world.render(flight, 1 / 60);
    reference.world.setCameraMode(mode); reference.world.render(reference.flight, 1 / 60);
    assert.ok(world.camera.position.distanceTo(reference.world.camera.position) < 1e-8, `mode ${mode} must not lock the previous camera`);
  }
});

test('aviation resize only reallocates changed buffers and resolution alone preserves camera damping', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio');
  t.after(() => previous ? Object.defineProperty(globalThis, 'devicePixelRatio', previous) : delete globalThis.devicePixelRatio);
  globalThis.devicePixelRatio = 2;
  let writes = 0, projections = 0;
  const camera = () => ({ updateProjectionMatrix() { projections++; } });
  const world = Object.assign(Object.create(AviationWorld.prototype), {
    container: { clientWidth: 1280, clientHeight: 720 }, quality: 1.25, camera: camera(), cockpitCamera: camera(),
    renderer: { setDrawingBufferSize() { writes++; }, setPixelRatio() { writes++; }, setSize() { writes++; } },
  });
  world.resize(); assert.equal(writes, 1); assert.equal(projections, 2);
  world.resetCamera = false; world.resize(); assert.equal(writes, 1);
  world.quality = .5; world.resize(); assert.equal(writes, 2); assert.equal(projections, 2);
  assert.equal(world.resetCamera, false);
  globalThis.devicePixelRatio = 1; world.quality = 1.75; world.resize();
  world.quality = 2; world.resize(); assert.equal(writes, 3, 'equivalent effective pixel ratios need no buffer writes');
  world.container.clientWidth = 900; world.resize(); assert.equal(writes, 4);
  assert.equal(world.camera.aspect, 900 / 720); assert.equal(world.resetCamera, true);
});

test('distance, elevation, orbit and field of view affect real camera geometry', () => {
  const { world, flight } = fixture();
  Object.assign(world.viewSettings, { speedFov: false, exteriorFov: 80, chaseDistance: 3, chaseHeight: 2, orbitAngle: 90 });
  world.render(flight, 1 / 60);
  const relative = world.camera.position.clone().sub(world.aircraftRoot.position);
  assert.ok(relative.x > 0 && relative.z < 0, 'orbit rotates the preset around the aircraft');
  assert.ok(Math.abs(relative.y - flight.aircraft.length * .52 * 2 * 3) < 1e-8);
  assert.equal(world.camera.fov, 80);
  world.viewSettings.speedFov = true; world.viewSettings.speedFovAmount = 30;
  flight.speed = flight.performance.maxSpeed;
  world.render(flight, 1 / 60); assert.equal(world.camera.fov, 110);
  flight.y = 8; flight.roll = Math.PI; flight.physics.mode = 'maneuver';
  world.setCameraMode(5); world.render(flight, 1 / 60);
  assert.ok(world.camera.position.y >= 4);
});

test('render limiting keeps elapsed animation time and does not drift on mismatched refresh rates', () => {
  for (const refresh of [60, 120, 144]) for (const limit of [30, 45, 60, 90, 120, 0]) {
    const clock = new AviationRenderClock(); let frames = 0, elapsed = 0;
    for (let i = 0; i < refresh * 10; i++) {
      const dt = clock.tick(1 / refresh, limit);
      if (dt !== null) { frames++; elapsed += dt; }
    }
    assert.ok(Math.abs(frames - Math.min(limit || refresh, refresh) * 10) <= 1, `${refresh}Hz / ${limit} cap: ${frames}`);
    assert.ok(Math.abs(elapsed - 10) <= 1 / (limit || refresh) + 1e-8);
  }
  const clock = new AviationRenderClock();
  assert.equal(clock.tick(.01, 30), null);
  assert.equal(clock.tick(.01, 30, true), .02, 'input changes can force an immediate draw');
  clock.reset(); assert.equal(clock.tick(.01, 30), null, 'resume starts a fresh render interval');
});

test('cockpit display refreshes at the selected cadence and stays idle outside the cockpit', () => {
  for (const hz of [5, 10, 20]) {
    const { world, flight } = fixture(); let uploads = 0;
    world.cockpit = createAircraftCockpit(flight.aircraft);
    world.cockpitCamera = new THREE.PerspectiveCamera(68, 1, .06, 8);
    world.renderer.clearDepth = () => {};
    world.cockpitContext = new Proxy({ canvas: { width: 960, height: 320 } }, { get: (object, key) => object[key] ?? (() => {}) });
    world.cockpitTexture = { set needsUpdate(value) { if (value) uploads++; } };
    world.displayHz = hz; world.displayTime = 0;
    world.setCameraMode(2); world.render(flight, 0); uploads = 0;
    for (let i = 0; i < 600; i++) world.render(flight, 1 / 60);
    assert.equal(uploads, hz * 10, `${hz} Hz must not double-upload near floating point boundaries`);
    flight.status = 'paused'; flight.throttle = .3;
    const pausedUploads = uploads; world.render(flight, 0);
    assert.equal(uploads, pausedUploads + 1, 'a requested paused redraw must refresh changed instruments without waiting for animation time');
    world.setCameraMode(0); const before = uploads;
    for (let i = 0; i < 60; i++) world.render(flight, 1 / 60);
    assert.equal(uploads, before);
    world.setCameraMode(2); world.render(flight, 0); assert.equal(uploads, before + 1, 'reentering cockpit refreshes immediately');
    disposeAircraftObject(world.cockpit);
  }
});

test('follow response is independent of render rate and the selected response changes actual damping', () => {
  for (const response of [1, 5, 15]) for (const fps of [30, 60, 120]) {
    const { world, flight } = fixture();
    world.viewSettings.followResponse = response;
    world.render(flight, 0);
    const desired = world.camera.position.clone();
    world.camera.position.y += 1000;
    for (let i = 0; i < fps; i++) world.render(flight, 1 / fps);
    assert.ok(Math.abs(world.camera.position.y - desired.y - 1000 * Math.exp(-response)) < 1e-7);
  }
});
