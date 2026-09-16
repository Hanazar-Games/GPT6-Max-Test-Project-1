import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { MISSIONS, makeCourse } from '../src/missions.js';
import { meteorFootprint } from '../src/environment-view.js';
import { ENVIRONMENT } from '../src/environment.js';
import { createRoute } from '../src/route.js';

test('meteor footprint follows the collision coordinates on every curved and sloped route', () => {
  for (const mission of MISSIONS) {
    const world = { mission, curve: createRoute(mission), frame: World.prototype.frame };
    for (const meteor of makeCourse(mission).meteors) {
      const geometry = meteorFootprint(world, meteor, 0.978);
      const radius = meteor.radius + ENVIRONMENT.craftRadius;
      for (let index = 49; index < 98; index++) {
        const angle = (index - 49) / 48 * Math.PI * 2;
        const expected = world.frame(meteor.distance + Math.sin(angle) * radius, meteor.lane + Math.cos(angle) * radius, 0.14).point;
        const actual = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, index);
        assert.ok(actual.distanceTo(expected) < 0.0001);
      }
      geometry.dispose();
    }
  }
});
