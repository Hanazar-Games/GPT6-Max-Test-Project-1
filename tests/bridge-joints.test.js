import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MISSIONS } from '../src/missions.js';
import { World } from '../src/world.js';
import { createRoute } from '../src/route.js';
import { makeBridges } from '../src/bridge-view.js';

function makeWorld(t, mission, terrain = false) {
  const world = Object.assign(Object.create(World.prototype), {
    mission, curve: createRoute(mission), scene: new THREE.Scene(), renderer: { renderLists: { dispose() {} } },
    materials: { dark: new THREE.MeshStandardMaterial() },
  });
  if (terrain) {
    world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
    world.makeTerrain();
  } else world.groundInfo = () => ({ y: -2000 });
  t.after(() => { world.clearScene(); world.materials.dark.dispose(); });
  return world;
}

function segments(mesh, width) {
  const result = [], matrix = new THREE.Matrix4(), scale = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    scale.setFromMatrixScale(matrix);
    if (width !== undefined && Math.abs(scale.x - width) > .001) continue;
    result.push([new THREE.Vector3(0, -.5, 0).applyMatrix4(matrix), new THREE.Vector3(0, .5, 0).applyMatrix4(matrix)]);
  }
  return result;
}

test('every bridge terminates with a transverse deck beam even when its length is not divisible by sixty', t => {
  const source = MISSIONS.find(mission => mission.id === 'meridian');
  for (const kind of ['viaduct', 'cable', 'suspension']) for (const length of [1400, 1600]) {
    const span = { start: 1800, end: 1800 + length, kind }, world = makeWorld(t, { ...source, bridges: [span] });
    makeBridges(world);
    const mesh = world.scene.getObjectByName(`bridge-${kind === 'viaduct' ? 'concrete' : 'steel'}`);
    const beams = segments(mesh);
    for (const distance of [span.start, span.end]) {
      const a = world.frame(distance, -17, -4.8).point, b = world.frame(distance, 17, -4.8).point;
      assert.ok(beams.some(([start, end]) => start.distanceTo(a) < .02 && end.distanceTo(b) < .02), `${kind}/${length}: missing deck beam at ${distance}`);
    }
  }
});

test('bridge foundations follow the road heading and embed their complete footprint in rendered terrain', t => {
  let foundations = 0;
  const matrix = new THREE.Matrix4(), scale = new THREE.Vector3(), position = new THREE.Vector3();
  for (const source of MISSIONS.filter(mission => mission.bridges.length)) {
    const world = makeWorld(t, source, true);
    makeBridges(world);
    const mesh = world.scene.getObjectByName('bridge-concrete');
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix); scale.setFromMatrixScale(matrix);
      if (Math.abs(scale.y - 2) > .001 || scale.x < 7) continue;
      foundations++;
      position.setFromMatrixPosition(matrix);
      const sample = world.groundSampler(position.x, position.z), frame = world.frame(sample.progress * source.length);
      const widthAxis = new THREE.Vector3().setFromMatrixColumn(matrix, 0).normalize();
      const roadWidth = new THREE.Vector3(-frame.tangent.z, 0, frame.tangent.x).normalize();
      assert.ok(Math.abs(widthAxis.dot(roadWidth)) > .999, `${source.id}: foundation is twisted across the road`);
      for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) {
        const bottom = new THREE.Vector3(x, -.5, z).applyMatrix4(matrix);
        assert.ok(bottom.y <= world.groundInfo(bottom.x, bottom.z).y - 1.9, `${source.id}: floating foundation corner`);
      }
    }
    world.clearScene();
  }
  assert.ok(foundations > 2500, 'inspect every generated bridge foundation');
});

test('suspension cables meet every hanger and pass through the exact tower attachment points', t => {
  const source = MISSIONS.find(mission => mission.bridges.some(span => span.kind === 'suspension' && span.end - span.start === 1400));
  const span = source.bridges.find(span => span.kind === 'suspension' && span.end - span.start === 1400);
  const world = makeWorld(t, { ...source, bridges: [span] });
  makeBridges(world);
  const mesh = world.scene.getObjectByName('bridge-cables');
  const main = segments(mesh, .65).flat(), hangers = segments(mesh, .22);
  assert.ok(hangers.length > 80);
  for (const [, end] of hangers) assert.ok(main.some(point => point.distanceTo(end) < .02), 'hanger must meet a main-cable joint');
  for (const t of [.2, .8]) for (const side of [-1, 1]) {
    const head = world.frame(span.start + (span.end - span.start) * t, side * 23, 75).point;
    assert.ok(main.some(point => point.distanceTo(head) < .02), 'main cable must pass through the tower attachment');
  }
  assert.equal(mesh.geometry.type, 'CylinderGeometry');
  assert.ok(mesh.geometry.index.count / 3 <= 32, 'round cable sections must stay within the triangle budget');
});

test('ordinary road supports embed their entire base on city and mountain slopes', t => {
  const matrix = new THREE.Matrix4();
  for (const id of ['copper', 'marathon', 'summit']) {
    const world = makeWorld(t, MISSIONS.find(mission => mission.id === id), true);
    world.makeTrack();
    const piers = world.scene.getObjectByName('road-piers');
    for (let i = 0; i < piers.count; i++) {
      piers.getMatrixAt(i, matrix);
      for (const x of [-.5, 0, .5]) for (const z of [-.5, 0, .5]) {
        const base = new THREE.Vector3(x, -.5, z).applyMatrix4(matrix);
        assert.ok(base.y <= world.groundInfo(base.x, base.z).y - 1.9, `${id}: floating road support`);
      }
    }
    world.clearScene();
  }
});
