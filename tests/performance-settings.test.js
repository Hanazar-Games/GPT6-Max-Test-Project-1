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
