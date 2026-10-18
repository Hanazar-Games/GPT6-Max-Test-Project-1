import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFORMANCE_LEVELS, PERFORMANCE_PRESETS, World } from '../src/world.js';

test('performance presets expose a wider safe range and independent effects', () => {
  assert.deepEqual(PERFORMANCE_LEVELS, ['ultra', 'high', 'balanced', 'low', 'eco']);
  assert.equal(PERFORMANCE_PRESETS.ultra.pixelRatio, 2);
  assert.equal(PERFORMANCE_PRESETS.eco.pixelRatio, 0.6);
  assert.equal(PERFORMANCE_PRESETS.balanced.shadows, true);
  assert.equal(PERFORMANCE_PRESETS.balanced.bloom, false);

  const renderer = { shadowMap: {}, setPixelRatio(value) { this.pixelRatio = value; } };
  const world = Object.assign(Object.create(World.prototype), {
    renderer,
    bloom: {},
    performance: { ...PERFORMANCE_PRESETS.high },
    quality: 'high',
    resize() {},
  });
  world.setQuality('ultra');
  assert.equal(world.performance.pixelRatio, 2);
  assert.equal(world.bloom.enabled, true);
  assert.equal(world.renderer.shadowMap.enabled, true);
  world.setPerformanceOptions({ pixelRatio: 2.5, shadows: false, bloom: false });
  assert.equal(world.quality, 'custom');
  assert.equal(world.performance.pixelRatio, 2);
  assert.equal(world.renderer.shadowMap.enabled, false);
  assert.equal(world.bloom.enabled, false);
  world.setPerformanceOptions({ pixelRatio: 0.1 });
  assert.equal(world.performance.pixelRatio, 0.6);
});

test('quality changes resize only changed buffers and preserve the camera on effect toggles', t => {
  const globals = ['innerWidth', 'innerHeight', 'devicePixelRatio'];
  const previous = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
  t.after(() => globals.forEach((key, i) => {
    if (previous[i]) Object.defineProperty(globalThis, key, previous[i]);
    else delete globalThis[key];
  }));
  Object.assign(globalThis, { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 });
  let canvasWrites = 0, targetWrites = 0;
  const renderer = {
    ratio: 1.5, shadowMap: {},
    getPixelRatio() { return this.ratio; },
    setPixelRatio(value) { this.ratio = value; canvasWrites++; },
    setSize() { canvasWrites++; },
  };
  const composer = { setPixelRatio() { targetWrites++; }, setSize() { targetWrites++; } };
  const world = Object.assign(Object.create(World.prototype), {
    renderer, composer, bloom: {}, camera: { updateProjectionMatrix() {} },
    performance: { ...PERFORMANCE_PRESETS.high }, quality: 'high',
  });
  world.resize();
  canvasWrites = targetWrites = 0;
  world.cameraReady = true;
  world.setPerformanceOptions({ shadows: false, bloom: false });
  assert.equal(canvasWrites, 0, 'effect toggles must not reset the canvas');
  assert.equal(targetWrites, 0, 'effect toggles must not reallocate postprocessing targets');
  assert.equal(world.cameraReady, true, 'effect toggles must not snap the camera');
  world.setQuality('eco');
  assert.equal(canvasWrites, 1);
  assert.equal(targetWrites, 1);
  assert.equal(world.cameraReady, true);
  assert.equal(renderer.ratio, .6);
  canvasWrites = targetWrites = 0;
  world.setQuality('eco');
  world.resize();
  assert.equal(canvasWrites + targetWrites, 0, 'unchanged settings and viewport need no buffer writes');
  globalThis.innerWidth = 900;
  world.resize();
  assert.equal(canvasWrites, 1);
  assert.equal(targetWrites, 1);
  assert.equal(world.camera.aspect, 900 / 720);
  assert.equal(world.cameraReady, false);
  canvasWrites = targetWrites = 0;
  globalThis.devicePixelRatio = .5;
  world.resize();
  assert.equal(renderer.ratio, .5, 'moving between displays must refresh the device pixel ratio');
  assert.equal(canvasWrites, 1);
  assert.equal(targetWrites, 1);
});
