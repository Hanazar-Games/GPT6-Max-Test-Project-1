import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';

export function makeSpaceport(world) {
  const { dark, metal, cyan, orange } = world.materials;
  const base = new THREE.Group();
  base.name = 'launch-deck';
  const outline = new THREE.Shape([[-20, -12], [-16, -16], [16, -16], [20, -12], [20, 12], [16, 16], [-16, 16], [-20, 12]].map(p => new THREE.Vector2(...p)));
  const deck = world.mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.3, bevelSegments: 2 }), dark, base, [0, -1.05, 0]);
  deck.rotation.x = -Math.PI / 2;
  for (const x of [-18, 18]) {
    world.box([0.2, 0.1, 23], cyan, base, [x, 0.2, 0]);
    for (let i = 0; i < 7; i++) world.box([1.8, 0.13, 0.45], orange, base, [x, 0.17, -10 + i * 3.3]);
  }
  for (const radius of [7.2, 8]) {
    const ring = world.mesh(new THREE.TorusGeometry(radius, 0.045, 4, 64, Math.PI * 1.65), metal, base, [0, 0.17, 0]);
    ring.rotation.x = -Math.PI / 2;
  }
  for (const x of [-3, 3]) world.box([0.25, 0.08, 7], metal, base, [x, 0.16, 0]);
  world.box([6, 0.08, 0.25], metal, base, [0, 0.16, 0]);
  for (const x of [-15, 15]) world.box([1.3, 7, 24], dark, base, [x, -4, 0]);
  world.place(batchMeshes(base), 0);
  for (let i = 0; i < 3; i++) {
    const building = new THREE.Group();
    building.name = 'hangar-module';
    const distance = 8 + i * 23, frame = world.frame(distance, -38);
    const section = new THREE.Shape();
    section.moveTo(-6, 0); section.lineTo(-6, 3.5); section.quadraticCurveTo(-6, 7, 0, 7); section.quadraticCurveTo(6, 7, 6, 3.5); section.lineTo(6, 0); section.closePath();
    world.mesh(new THREE.ExtrudeGeometry(section, { depth: 14, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 2, curveSegments: 8 }), metal, building, [0, 0, -7]);
    world.box([15, 1, 17], dark, building, [0, -0.5, 0]);
    world.box([9.5, 4.7, 0.2], dark, building, [0, 2.5, -7.3]);
    for (let j = 0; j < 6; j++) world.box([9, 0.06, 0.1], metal, building, [0, 0.7 + j * 0.7, -7.45]);
    world.box([9, 0.18, 0.15], cyan, building, [0, 5.2, -7.4]);
    for (const x of [-5.6, 5.6]) {
      world.box([0.4, 4.8, 0.5], orange, building, [x, 2.5, -7.3]);
      let height = 7;
      for (const z of [-6, 6]) {
        const foot = frame.point.clone().addScaledVector(frame.right, -x).addScaledVector(frame.tangent, z);
        height = Math.max(height, (foot.y - world.groundInfo(foot.x, foot.z).y) / frame.up.y + 2);
      }
      world.box([1, height, 12], dark, building, [x, -0.5 - height / 2, 0]);
    }
    for (let j = 0; j < 3; j++) {
      const vent = world.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.4, 12), dark, building, [0, 7.2, -3 + j * 3]);
      vent.castShadow = true;
    }
    world.place(batchMeshes(building), distance, -38);
  }
  const tower = new THREE.Group();
  tower.name = 'control-tower';
  world.mesh(new THREE.CylinderGeometry(2.2, 4, 22, 8), metal, tower, [0, 5, 0]);
  world.mesh(new THREE.CylinderGeometry(5, 3, 3, 8), dark, tower, [0, 17, 0]);
  world.mesh(new THREE.CylinderGeometry(4.7, 4.7, 2.2, 8), cyan, tower, [0, 19, 0]);
  world.mesh(new THREE.CylinderGeometry(5.4, 5.4, 0.65, 8), metal, tower, [0, 20.5, 0]);
  world.box([0.3, 10, 0.3], dark, tower, [0, 24, 0]);
  world.mesh(new THREE.SphereGeometry(0.4, 12, 8), orange, tower, [0, 29, 0]);
  const dishMaterial = new THREE.MeshStandardMaterial({ color: '#9baebd', metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
  const dish = world.mesh(new THREE.SphereGeometry(4, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), dishMaterial, tower, [0, 24, 0]);
  dish.rotation.z = 2;
  world.place(batchMeshes(tower), 84, -42);
}
