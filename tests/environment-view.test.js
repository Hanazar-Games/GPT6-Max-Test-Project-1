import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/world.js';
import { MISSIONS, makeCourse } from '../src/missions.js';
import { meteorFootprint, EnvironmentView } from '../src/environment-view.js';
import { ENVIRONMENT, meteorState } from '../src/environment.js';
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
        assert.ok(actual.distanceTo(expected) < Math.max(0.0001, expected.length() * 1e-7));
      }
      geometry.dispose();
    }
  }
});

test('offscreen meteors skip footprint work and immediately show the current phase when visible again', () => {
  const mission = MISSIONS.find(item => item.id === 'summit');
  const course = makeCourse(mission);
  course.gravityZones = [];
  const world = Object.assign(Object.create(World.prototype), {
    mission, course, curve: createRoute(mission), scene: new THREE.Scene(),
    materials: {}, renderer: { renderLists: { dispose() {} } },
  });
  const view = new EnvironmentView(world);
  const camera = new THREE.PerspectiveCamera(90, 1.6, .2, 4000);
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  const aim = point => {
    camera.position.copy(point).add(new THREE.Vector3(0, 15, -30));
    camera.lookAt(point); camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  };
  let frames = 0;
  world.frame = (...args) => { frames++; return World.prototype.frame.call(world, ...args); };
  aim(new THREE.Vector3(1e7, 0, 0));
  view.render(600, frustum);
  assert.equal(frames, 0, 'invisible meteor animations must not sample the route');
  for (const entry of [...view.meteors, view.meteors[0]]) {
    const { meteor, group, disc, ring, pulse, rock, bounds } = entry;
    for (const mesh of [disc, ring]) {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) assert.ok(bounds.containsPoint(new THREE.Vector3().fromBufferAttribute(positions, i)));
    }
    aim(group.position);
    for (const elapsed of [meteor.first - 1, meteor.first + .3, meteor.first + 1.4, meteor.first + 3, meteor.first - .4]) {
      view.render(elapsed, frustum);
      const state = meteorState(meteor, elapsed);
      assert.equal(ring.visible, true);
      assert.equal(pulse.visible, ['warning', 'impact'].includes(state.phase));
      assert.equal(disc.visible, ['warning', 'impact', 'afterglow'].includes(state.phase));
      assert.equal(rock.visible, state.phase === 'warning' && state.remaining <= .85);
      if (rock.visible) {
        const sphere = new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
        assert.ok(bounds.center.distanceTo(sphere.center) + sphere.radius < bounds.radius, 'culling bounds must contain the falling rock and tail');
      }
      if (pulse.visible) {
        const scale = state.phase === 'warning' ? Math.max(.05, 1 - state.progress) : .2 + state.progress * .8;
        const coordinates = pulse.geometry.userData.coordinates, positions = pulse.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const radius = (meteor.radius + ENVIRONMENT.craftRadius) * scale;
          const expected = world.frame(meteor.distance + coordinates[i * 3 + 1] * radius, meteor.lane + coordinates[i * 3] * radius, .14).point;
          const actual = new THREE.Vector3().fromBufferAttribute(positions, i);
          assert.ok(actual.distanceTo(expected) < .02);
          assert.ok(bounds.containsPoint(actual));
        }
      }
    }
    aim(new THREE.Vector3(1e7, 0, 0));
    frames = 0;
    view.render(600, frustum);
    assert.equal(frames, 0);
  }
  world.clearScene();
});
