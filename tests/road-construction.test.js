import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';

function road(mission) {
  let frames = 0;
  const world = Object.assign(Object.create(World.prototype), {
    mission: { ...mission, bridges: [] }, curve: createRoute(mission), scene: new THREE.Scene(),
    materials: { dark: new THREE.MeshStandardMaterial() }, renderer: { renderLists: { dispose() {} } },
    groundInfo: () => ({ y: -1000 }),
    frame(...args) { frames++; return World.prototype.frame.apply(this, args); },
  });
  world.makeTrack();
  return { world, frames };
}

test('road construction samples the route in proportion to length rather than the number of strips', () => {
  for (const id of ['tranquility', 'overdrive', 'summit']) {
    const mission = MISSIONS.find(mission => mission.id === id), { world, frames } = road(mission);
    try {
      assert.ok(frames < Math.max(1000, Math.ceil(mission.length / 8)) * 3, `${id}: ${frames} route samples`);
    } finally { world.clearScene(); world.materials.dark.dispose(); }
  }
});

test('every road retains its banked cross-sections, texture coordinates, winding and roadside instances', () => {
  const expected = new THREE.Vector3(), actual = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const mission of MISSIONS) {
    const { world } = road(mission);
    try {
      const strips = [[-17, 17, -.38, 0]];
      if (mission.special === 'boost') strips.push([-16, 16, -.29, 0], [-10, -10.45, -.25, 0], [10, 10.45, -.25, 0]);
      for (const side of [-1, 1]) strips.push([side * 17, side * 17, -.38, -4], [side * 12.8, side * 12.8, -1.2, -2.4], [side * 16.6, side * 17, -.28, 0], [side * 18.2, side * 18.2, .65, .5], [side * 18.2, side * 18.2, 1.16, .08]);
      const steps = Math.max(1000, Math.ceil(mission.length / 8));
      const samples = [0, 1, Math.floor(steps / 3), Math.floor(steps / 2), steps - 1, steps];
      strips.forEach(([left, right, height, depth], strip) => {
        const mesh = world.scene.children[strip], geometry = mesh.geometry;
        assert.equal(geometry.attributes.position.count, (steps + 1) * 2);
        assert.equal(geometry.index.count, steps * 6);
        assert.equal(mesh.receiveShadow, true);
        for (const i of samples) {
          const distance = i / steps * mission.length;
          for (const side of [0, 1]) {
            expected.copy(World.prototype.frame.call(world, distance, side ? right : left, height + (side ? depth : 0)).point);
            expected.set(Math.fround(expected.x), Math.fround(expected.y), Math.fround(expected.z));
            actual.fromBufferAttribute(geometry.attributes.position, i * 2 + side);
            assert.ok(actual.equals(expected), `${mission.id}/${strip}/${i}: changed road profile`);
            assert.equal(geometry.attributes.uv.getX(i * 2 + side), Math.fround(side ? Math.max(1, Math.abs(right - left) / 8) : 0));
            assert.equal(geometry.attributes.uv.getY(i * 2 + side), Math.fround(distance / 8));
          }
          if (i < steps) assert.deepEqual(Array.from(geometry.index.array.slice(i * 6, i * 6 + 6)), [i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3]);
        }
        assert.ok(geometry.attributes.normal.array.every(Number.isFinite));
      });
      const [markers, posts, curbs] = world.scene.children.slice(strips.length);
      for (const i of [0, Math.floor(markers.count / 2), markers.count - 1]) for (const side of [-1, 0, 1]) {
        const distance = i / markers.count * mission.length;
        const frame = World.prototype.frame.call(world, distance, side * 18.2, side ? .35 : -.25);
        const index = side ? i * 2 + (side > 0 ? 1 : 0) : i;
        (side ? posts : markers).getMatrixAt(index, matrix);
        actual.setFromMatrixPosition(matrix);
        assert.ok(actual.distanceTo(frame.point) < .01);
        const orientation = new THREE.Matrix4().makeBasis(frame.right.clone().negate(), frame.up, frame.tangent);
        assert.ok([0, 1, 2, 4, 5, 6, 8, 9, 10].every(j => Math.abs(matrix.elements[j] - orientation.elements[j]) < 1e-6));
        if (side) {
          curbs.getMatrixAt(index, matrix);
          actual.setFromMatrixPosition(matrix);
          assert.ok(actual.distanceTo(World.prototype.frame.call(world, distance, side * 16.1, -.24).point) < .01);
        }
      }
    } finally { world.clearScene(); world.materials.dark.dispose(); }
  }
});
