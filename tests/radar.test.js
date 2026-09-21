import test from 'node:test';
import assert from 'node:assert/strict';
import { createRadarProjection, RouteRadar } from '../src/radar.js';
import { MISSIONS } from '../src/missions.js';
import { createGame } from '../src/game.js';
import { createRoute } from '../src/route.js';

test('radar projection preserves route distance, aspect and endpoints without reading the source again', () => {
  let reads = 0;
  const samples = [{ x: -10, z: -20 }, { x: 10, z: 0 }, { x: -10, z: 20 }].map(point => ({ get x() { reads++; return point.x; }, get z() { reads++; return point.z; } }));
  const radar = createRadarProjection(samples, 100);
  const initialReads = reads;
  assert.deepEqual(radar.at(-1), radar.at(0));
  assert.deepEqual(radar.at(101), radar.at(100));
  assert.deepEqual(radar.at(25), [180, 57.75]);
  assert.deepEqual(radar.at(50), [221.25, 99]);
  assert.equal(reads, initialReads);
  const vertical = createRadarProjection([{ x: 0, z: 0 }, { x: 0, z: 10 }], 10);
  assert.deepEqual(vertical.at(5), [180, 99]);
});

test('every route fits the radar and projected positions agree with the actual 3D road', () => {
  for (const mission of MISSIONS) {
    const curve = createRoute(mission);
    const samples = curve.getSpacedPoints(Math.max(600, Math.ceil(mission.length / 20)));
    const radar = createRadarProjection(samples, mission.length);
    const xs = samples.map(p => p.x), zs = samples.map(p => p.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const scale = Math.min(320 / (maxX - minX), 165 / (maxZ - minZ));
    for (let i = 0; i <= 137; i++) {
      const distance = mission.length * i / 137, [x, y] = radar.at(distance), point = curve.getPointAt(i / 137);
      assert.ok(x >= 19.99 && x <= 340.01 && y >= 16.49 && y <= 181.51, mission.id);
      assert.ok(Math.hypot(x - (180 + (point.x - (minX + maxX) / 2) * scale), y - (99 + (point.z - (minZ + maxZ) / 2) * scale)) < .1, mission.id);
    }
    for (let i = 0; i < 600; i++) {
      const a = radar.at(mission.length * i / 600), b = radar.at(mission.length * (i + 1) / 600);
      const middle = radar.at(mission.length * (i + .5) / 600);
      assert.ok(Math.hypot(middle[0] - (a[0] + b[0]) / 2, middle[1] - (a[1] + b[1]) / 2) < .5, `${mission.id}: road outline`);
    }
  }
});

function canvas() {
  const calls = [];
  const context = Object.fromEntries(['clearRect', 'drawImage', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'arc', 'fillRect', 'closePath'].map(method => [method, (...args) => calls.push([method, ...args])]));
  return { width: 360, height: 200, calls, getContext: () => context, getClientRects: () => [{}], setAttribute(name, value) { this[name] = value; }, ownerDocument: { createElement: () => canvas() } };
}

test('radar skips hidden and paused canvases and only rebuilds its map when the course changes', () => {
  const target = canvas(), radar = new RouteRadar(target), game = createGame('cascade');
  game.status = 'running';
  const samples = [{ x: 0, z: 0 }, { x: 10, z: 20 }, { x: 0, z: 0 }];
  target.getClientRects = () => [];
  assert.equal(radar.draw(game, samples), false);
  assert.equal(target.calls.length, 0);
  target.getClientRects = () => [{}];
  assert.equal(radar.draw(game, samples), true);
  const projection = radar.projection;
  const initialDrawing = [...target.calls];
  assert.match(target['aria-label'], /已飞 0% · 下一座导航门 1/);
  game.distance = game.mission.length * .8;
  radar.draw(game, samples);
  assert.equal(radar.projection, projection);
  game.distance = 0;
  target.calls.length = 0;
  radar.draw(game, samples);
  assert.deepEqual(target.calls, initialDrawing);
  game.status = 'paused';
  assert.equal(radar.draw(game, samples), false);
  assert.deepEqual(target.calls, initialDrawing);
  game.status = 'countdown'; game.course = { ...game.course };
  radar.draw(game, samples);
  assert.notEqual(radar.projection, projection);
  const reloaded = radar.projection;
  radar.draw(game, [...samples]);
  assert.notEqual(radar.projection, reloaded);
  game.gates = game.course.gates.length;
  radar.draw(game, samples);
  assert.match(target['aria-label'], /目标：返航基地/);
});
