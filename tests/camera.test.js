import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoute, routeFrame, menuCameraPose } from '../src/route.js';
import { makeCraftModel, configureCraftModel } from '../src/craft-view.js';
import { CRAFTS, MISSIONS } from '../src/missions.js';

test('menu framing keeps every craft inside portrait, tablet and desktop viewports', () => {
  const materials = Object.fromEntries(['metal', 'dark', 'orange', 'cyan', 'glow'].map(key => [key, new THREE.MeshStandardMaterial()]));
  const { body } = makeCraftModel(materials);
  const ship = new THREE.Group();
  ship.add(body);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.2, 4000), vertex = new THREE.Vector3();
  for (const mission of MISSIONS) {
    const frame = routeFrame(createRoute(mission), mission.length, 0, 0, 1.9);
    ship.position.copy(frame.point);
    ship.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right.clone().negate(), frame.up, frame.tangent));
    for (const craft of CRAFTS) for (const aspect of [320 / 568, 390 / 844, 768 / 1024, 800 / 600, 1.6, 2.2]) for (const clock of [0, Math.PI / 0.18, Math.PI * 3 / 0.18]) {
      configureCraftModel(body, craft);
      body.position.y = Math.sin(clock * 3.5) * 0.13;
      ship.updateMatrixWorld(true);
      const { position, target } = menuCameraPose(frame, aspect, clock);
      camera.aspect = aspect;
      camera.position.copy(position);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      body.traverseVisible(mesh => {
        if (!mesh.isMesh) return;
        const positions = mesh.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          vertex.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(camera);
          assert.ok(Math.abs(vertex.x) < 0.98 && Math.abs(vertex.y) < 0.98, `${mission.id}/${craft.id} is clipped at aspect ${aspect}`);
        }
      });
    }
  }
  const resources = new Set(Object.values(materials));
  body.traverse(mesh => { if (mesh.isMesh) { resources.add(mesh.geometry); resources.add(mesh.material); } });
  resources.forEach(resource => resource.dispose());
});
