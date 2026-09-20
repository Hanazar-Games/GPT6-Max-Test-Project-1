import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { partitionLandscape } from '../src/landscape-chunks.js';
import { MISSIONS } from '../src/missions.js';
import { createGame } from '../src/game.js';
import { createRoute } from '../src/route.js';
import { World } from '../src/world.js';
import { makePlanetScenery } from '../src/planet-view.js';

const triangles = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);

test('landscape tiles preserve geometry attributes, transforms and instance colors with local bounds', () => {
  const scene = new THREE.Scene(), material = new THREE.MeshBasicMaterial();
  const terrain = new THREE.PlaneGeometry(12000, 12000, 120, 120).rotateX(-Math.PI / 2);
  const surface = new THREE.Mesh(terrain, material);
  surface.position.y = 37;
  scene.add(surface);
  const fleet = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 100);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  for (let i = 0; i < fleet.count; i++) {
    fleet.setMatrixAt(i, matrix.makeTranslation(i * 100, 10, 0));
    fleet.setColorAt(i, color.setHSL(i / 100, .5, .5));
  }
  scene.add(fleet);
  const count = scene.children.reduce((sum, mesh) => sum + triangles(mesh), 0);
  partitionLandscape(scene, terrain);
  assert.equal(scene.children.reduce((sum, mesh) => sum + triangles(mesh), 0), count);
  let instances = 0;
  for (const mesh of scene.children) {
    assert.ok(mesh.geometry === fleet.geometry || mesh.geometry.boundingSphere.radius < 1000);
    if (!mesh.isInstancedMesh) {
      assert.equal(mesh.position.y, 37);
      for (const attribute of ['position', 'normal', 'uv']) assert.equal(mesh.geometry.attributes[attribute], terrain.attributes[attribute]);
    } else for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      const original = matrix.elements[12] / 100;
      mesh.getColorAt(i, color);
      const expected = new THREE.Color(); fleet.getColorAt(original, expected);
      assert.equal(color.getHex(), expected.getHex());
      instances++;
    }
  }
  assert.equal(instances, 100);
});

test('the largest mountain route renders nearby tiles with a bounded visible triangle count and frees all resources', () => {
  const mission = MISSIONS.at(-1), game = createGame(mission.id);
  const world = Object.assign(Object.create(World.prototype), {
    mission, course: game.course, curve: createRoute(mission), scene: new THREE.Scene(), drones: [],
    materials: { dark: new THREE.MeshStandardMaterial(), metal: new THREE.MeshStandardMaterial(), glow: new THREE.MeshBasicMaterial(), cyan: new THREE.MeshBasicMaterial() },
    renderer: { renderLists: { dispose() {} } },
  });
  world.samples = world.curve.getSpacedPoints(Math.ceil(mission.length / 20));
  world.makeTerrain(); world.makeTrack(); world.makeRocks();
  let seed = 53;
  makePlanetScenery(world, () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const total = world.scene.children.filter(mesh => mesh.isMesh).reduce((sum, mesh) => sum + triangles(mesh), 0);
  partitionLandscape(world.scene, world.terrainGeometry);
  world.scene.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(90, 1.6, .2, 4000);
  for (const distance of [0, 30000, 120000, 210000]) {
    const frame = world.frame(distance);
    camera.position.copy(frame.point).addScaledVector(frame.tangent, -25).addScaledVector(frame.up, 12);
    camera.lookAt(frame.point.clone().addScaledVector(frame.tangent, 100));
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const visible = world.scene.children.filter(mesh => mesh.isMesh && frustum.intersectsObject(mesh)).reduce((sum, mesh) => sum + triangles(mesh), 0);
    assert.ok(visible < total * .25 && visible < 800000, `visible ${visible} / total ${total} at ${distance}`);
  }
  const resources = new Set([world.terrainGeometry]);
  world.scene.traverse(mesh => { if (mesh.geometry) resources.add(mesh.geometry); if (mesh.material) resources.add(mesh.material); });
  const disposed = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
  world.clearScene();
  assert.ok([...disposed.values()].every(count => count === 1));
});
