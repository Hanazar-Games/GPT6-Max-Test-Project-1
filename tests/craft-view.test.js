import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { CRAFTS } from '../src/missions.js';
import { makeCraftModel, configureCraftModel } from '../src/craft-view.js';

test('canopy ribs follow the glass surface and intake backplates close their front openings', t => {
  const materials = Object.fromEntries(['metal', 'dark', 'orange', 'glow', 'cyan'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const { body } = makeCraftModel(materials);
  t.after(() => {
    const resources = new Set(Object.values(materials));
    body.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); resources.add(mesh.material); } });
    resources.forEach(resource => resource.dispose());
  });
  body.updateMatrixWorld(true);
  const dark = body.children[0].children.find(mesh => mesh.material === materials.dark);
  const ray = new THREE.Raycaster();
  for (const side of [-1, 1]) for (const [x, y] of [[0, 0], [.26, 0], [-.26, 0], [0, .26], [0, -.26]]) {
    ray.set(new THREE.Vector3(side * 1.28 + x, .43 + y, -1.4), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(dark)[0];
    assert.ok(hit && Math.abs(hit.point.z + 1.75) < 1e-5, 'intake opening must have a recessed, forward-facing backplate');
  }
  for (const z of [-.55, 1.35]) for (const angle of [Math.PI / 4, Math.PI / 2, Math.PI * .75]) {
    const radius = Math.sqrt(1 - ((z - .5) / 1.65) ** 2);
    const point = new THREE.Vector3(.7 * radius * Math.cos(angle), .64 + .64 * radius * Math.sin(angle), z);
    const normal = new THREE.Vector3(point.x / .7 ** 2, (point.y - .64) / .64 ** 2, (z - .5) / 1.65 ** 2).normalize();
    ray.set(point.clone().addScaledVector(normal, .15), normal.clone().negate());
    const hit = ray.intersectObject(dark)[0];
    assert.ok(hit && hit.distance > .04 && hit.distance < .16, 'canopy rib must sit against its glass cross section');
  }
});

test('detailed craft variants and ghost clones retain independent visible equipment', () => {
  const materials = Object.fromEntries(['metal', 'dark', 'orange', 'glow', 'cyan'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const { body, flames } = makeCraftModel(materials);
  const ghost = body.clone();
  assert.equal(flames.length, 2);
  for (const flame of flames) {
    flame.geometry.computeBoundingBox();
    assert.ok(Math.abs(flame.geometry.boundingBox.min.y) < 1e-6, 'exhaust must scale from its nozzle, without separating under boost');
  }
  assert.ok(body.getObjectByName('cockpit').material.isMeshPhysicalMaterial);
  const hull = body.getObjectByName('armored-hull');
  hull.geometry.computeBoundingBox();
  assert.ok(hull.geometry.boundingBox.getSize(new THREE.Vector3()).y > 7);
  const equipment = new Set();
  for (const craft of CRAFTS) {
    configureCraftModel(body, craft);
    configureCraftModel(ghost, CRAFTS[0]);
    assert.deepEqual(body.scale.toArray(), craft.scale);
    for (const option of CRAFTS) assert.equal(body.getObjectByName(`variant-${option.id}`).visible, option.id === craft.id);
    assert.equal(ghost.getObjectByName('variant-scout').visible, true);
    const signature = createHash('sha256');
    const variant = body.getObjectByName(`variant-${craft.id}`);
    assert.ok(variant.children.length > 0, `${craft.id}: missing modeled equipment`);
    variant.traverse(mesh => {
      if (mesh.isMesh) signature.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));
    });
    equipment.add(signature.digest('hex'));
    body.updateMatrixWorld(true);
    body.traverse(mesh => {
      if (mesh.isMesh) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
    });
    let visibleMeshes = 0;
    body.traverseVisible(mesh => { if (mesh.isMesh) visibleMeshes++; });
    assert.ok(visibleMeshes <= 22, `${craft.id}: craft details exceed the draw budget`);
  }
  assert.equal(equipment.size, CRAFTS.length, 'each craft needs distinct modeled equipment');
  const resources = new Set(Object.values(materials));
  body.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); resources.add(mesh.material); } });
  resources.forEach(resource => resource.dispose());
});
