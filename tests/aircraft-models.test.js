import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AIRCRAFT } from '../src/aircraft-flight.js';
import { normalizeAircraftModel, disposeAircraftObject, loadAircraftModel } from '../src/aircraft-models.js';

async function asset(id) {
  const file = await readFile(new URL(`../assets/aircraft/${id}.glb`, import.meta.url));
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonSize = file.readUInt32LE(12), json = JSON.parse(file.subarray(20, 20 + jsonSize));
  return { file, json, jsonSize };
}

test('every GLB normalizes to aircraft dimensions with independent gear and propellers', async () => {
  for (const aircraft of AIRCRAFT) {
    const { file, json, jsonSize } = await asset(aircraft.id);
    assert.ok(!json.buffers.some(buffer => buffer.uri));
    json.materials = json.materials.map(() => ({ pbrMetallicRoughness: { baseColorFactor: [.7, .8, .9, 1] } }));
    const raw = Buffer.from(JSON.stringify(json)), size = Math.ceil(raw.length / 4) * 4;
    const binary = file.subarray(20 + jsonSize);
    const glb = Buffer.alloc(20 + size + binary.length, 0x20);
    file.copy(glb, 0, 0, 20); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(size, 12);
    raw.copy(glb, 20); binary.copy(glb, 20 + size);
    const { scene } = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
    const model = normalizeAircraftModel(scene, aircraft);
    const bounds = new THREE.Box3().setFromObject(model), dimensions = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(dimensions.z - aircraft.length) < .001);
    assert.ok(Math.abs(dimensions.x - aircraft.span) < 1);
    assert.ok(Math.abs(bounds.min.y + aircraft.gearHeight) < .001);
    assert.equal(model.userData.gear.length, 1);
    assert.equal(model.userData.propellers.length, aircraft.id === 't6' ? 1 : aircraft.id === 'c24' ? 2 : 0);
    model.userData.gear[0].visible = false;
    let visibleMeshes = 0; model.traverseVisible(object => { if (object.isMesh) visibleMeshes++; });
    assert.ok(visibleMeshes > 0);
    disposeAircraftObject(model);
  }
});

test('the four original fleet assets are compact, attributed and have distinct geometry', async () => {
  const meshes = new Set();
  for (const id of ['t6', 'b62', 'c24', 'd9']) {
    const { file, json } = await asset(id);
    assert.equal(json.nodes[0].extras.license, 'CC0-1.0');
    assert.ok(file.length < 100000);
    assert.ok(json.meshes.length < 18);
    meshes.add(file.toString('base64'));
  }
  assert.equal(meshes.size, 4);
});

test('A380 attribution survives and the fighter is an original self-contained asset', async () => {
  const a380 = await asset('a380'), fighter = await asset('su30');
  assert.match(a380.json.asset.extras.license, /CC-BY-4.0/);
  assert.match(a380.json.asset.extras.author, /zairiq/);
  assert.equal(fighter.json.nodes[0].extras.license, 'CC0-1.0');
  assert.ok(fighter.file.length < 200000);
});

test('unload disposes shared mesh resources and image bitmaps exactly once', () => {
  const counts = { geometry: 0, material: 0, texture: 0, bitmap: 0 };
  const geometry = new THREE.BoxGeometry(), texture = new THREE.Texture();
  texture.source.data = { close() { counts.bitmap++; } };
  const material = new THREE.MeshStandardMaterial({ map: texture });
  geometry.addEventListener('dispose', () => counts.geometry++);
  material.addEventListener('dispose', () => counts.material++);
  texture.addEventListener('dispose', () => counts.texture++);
  const scene = new THREE.Group(), root = new THREE.Group(); scene.add(root);
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  disposeAircraftObject(root);
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, bitmap: 1 });
  assert.equal(root.parent, null);
});

test('fighter exhaust backplates face outward and close both rear openings', async () => {
  const { file } = await asset('su30');
  const { scene } = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const engines = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.attributes.position, normals = object.geometry.attributes.normal;
    for (let index = 0; index < positions.count; index++) {
      if (Math.abs(positions.getZ(index) - 9.39) > .001 || Math.abs(positions.getX(index)) > 1.7) continue;
      assert.ok(normals.getZ(index) > .99, 'rear backplate must be visible from behind');
      engines.add(Math.sign(positions.getX(index)));
    }
  });
  assert.deepEqual([...engines].sort(), [-1, 1]);
  disposeAircraftObject(scene);
});

test('failed and cancelled model loads reject without installing an aircraft', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }));
  await assert.rejects(loadAircraftModel(AIRCRAFT[0]), /404/);
  globalThis.fetch.mock.mockImplementation(async () => new Response(new Uint8Array(8)));
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadAircraftModel(AIRCRAFT[0], controller.signal), error => error.name === 'AbortError');
});
