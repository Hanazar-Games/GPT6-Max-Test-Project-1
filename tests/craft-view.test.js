import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CRAFTS } from '../src/missions.js';
import { makeCraftModel, configureCraftModel } from '../src/craft-view.js';

test('detailed craft variants and ghost clones retain independent visible equipment', () => {
  const materials = Object.fromEntries(['metal', 'dark', 'orange', 'glow', 'cyan'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const { body, flames } = makeCraftModel(materials);
  const ghost = body.clone();
  assert.equal(flames.length, 2);
  assert.ok(body.getObjectByName('cockpit').material.isMeshPhysicalMaterial);
  const hull = body.getObjectByName('armored-hull');
  hull.geometry.computeBoundingBox();
  assert.ok(hull.geometry.boundingBox.getSize(new THREE.Vector3()).y > 7);
  for (const craft of CRAFTS) {
    configureCraftModel(body, craft);
    configureCraftModel(ghost, CRAFTS[0]);
    assert.deepEqual(body.scale.toArray(), craft.scale);
    for (const option of CRAFTS) assert.equal(body.getObjectByName(`variant-${option.id}`).visible, option.id === craft.id);
    assert.equal(ghost.getObjectByName('variant-scout').visible, true);
    body.updateMatrixWorld(true);
    body.traverse(mesh => {
      if (mesh.isMesh) assert.ok(mesh.matrixWorld.elements.every(Number.isFinite));
    });
  }
  const resources = new Set(Object.values(materials));
  body.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); resources.add(mesh.material); } });
  resources.forEach(resource => resource.dispose());
});
