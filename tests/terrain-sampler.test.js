import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroundSampler } from '../src/terrain-sampler.js';

test('terrain search matches every road segment, including distant queries and overlapping heights', () => {
  const points = Array.from({ length: 601 }, (_, i) => ({ x: Math.sin(i * 0.09) * 3200, y: Math.cos(i * 0.017) * 400, z: i * 22 }));
  points[300] = { ...points[299] };
  const sample = createGroundSampler(points);
  for (let i = 0; i < 500; i++) {
    const x = Math.sin(i * 0.27) * 6000, z = i * 30 - 1000;
    let nearest = Infinity, level = 0, low = Infinity;
    for (let j = 1; j < points.length; j++) {
      const a = points[j - 1], b = points[j], dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      const distance = (a.x + dx * t - x) ** 2 + (a.z + dz * t - z) ** 2;
      const y = a.y + (b.y - a.y) * t;
      if (distance < nearest) { nearest = distance; level = y; }
      if (distance < 42 ** 2) low = Math.min(low, y);
    }
    const actual = sample(x, z);
    assert.ok(Math.abs(actual.distance - Math.sqrt(nearest)) < 1e-7);
    assert.ok(Math.abs(actual.y - Math.min(level, low)) < 1e-7);
  }
});
