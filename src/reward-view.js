import * as THREE from 'three';
import { POWERUPS, CHALLENGES } from './route-rewards.js';

export class RewardView {
  constructor(world) {
    this.world = world;
    const materials = Object.fromEntries(Object.entries(POWERUPS).map(([kind, item]) => [kind, new THREE.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: .8, metalness: .3, roughness: .3 })]));
    const ringGeometry = new THREE.TorusGeometry(3.5, .16, 6, 36);
    this.items = world.course.powerups.map(item => {
      const group = new THREE.Group(), material = materials[item.kind];
      world.mesh(new THREE.OctahedronGeometry(1.4), material, group);
      const halo = world.mesh(new THREE.TorusGeometry(2.1, .08, 6, 24), material, group);
      halo.rotation.x = Math.PI / 2;
      if (item.kind === 'repair') for (const size of [[1.5, .35, .25], [.35, 1.5, .25]]) world.box(size, world.materials.dark, group, [0, 0, 1.2]);
      if (item.kind === 'magnet') world.mesh(new THREE.TorusGeometry(.7, .18, 6, 16, Math.PI * 1.6), world.materials.dark, group, [0, 0, 1.1]);
      if (item.kind === 'shield') world.mesh(new THREE.ConeGeometry(.7, 1.3, 5), world.materials.dark, group, [0, 0, 1.1]);
      if (item.kind === 'battery') {
        world.box([1, 1.35, .25], world.materials.dark, group, [0, 0, 1.2]);
        world.box([.4, .25, .25], world.materials.dark, group, [0, .8, 1.2]);
        world.box([.65, .18, .15], material, group, [0, 0, 1.4]);
      }
      if (item.kind === 'overdrive') for (const y of [-.45, .35]) for (const side of [-1, 1]) {
        const arrow = world.box([.2, .85, .25], world.materials.dark, group, [side * .25, y, 1.2]);
        arrow.rotation.z = side * .65;
      }
      world.place(group, item.distance, item.lane, 2);
      return { item, group };
    });
    this.rings = world.course.challenges.map(item => {
      const group = new THREE.Group(), color = CHALLENGES[item.kind].color;
      const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 });
      const hoop = world.mesh(ringGeometry, material, group);
      hoop.scale.y = item.kind === 'jump' ? .5 : .72;
      world.place(group, item.distance, item.lane, item.kind === 'jump' ? 6.4 : 3.2);
      for (const side of [-1, 1]) {
        const arrow = world.box([.12, .9, .12], material, group, [side * .28, 0, 0]);
        arrow.rotation.z = side * Math.PI / 4;
        if (item.kind === 'speed') arrow.rotation.y = Math.PI / 2;
        if (item.kind === 'precision') {
          world.box([.1, 1.8, .1], material, group, [side * CHALLENGES.precision.width, -.5, 0]);
          world.box([.7, .1, .1], material, group, [side * 1.8, .4, 0]);
        }
      }
      return { item, group };
    });
    for (const [kind, material] of Object.entries(materials)) if (!world.course.powerups.some(item => item.kind === kind)) material.dispose();
    if (!this.rings.length) ringGeometry.dispose();
  }

  render(game) {
    for (const { item, group } of this.items) {
      group.visible = !game.powerupsTaken.has(item.id) && Math.abs(item.distance - game.distance) < 1000;
      if (group.visible) group.children[0].rotation.y = game.elapsed * 1.5;
    }
    for (const { item, group } of this.rings) group.visible = !game.challengesResolved.has(item.id) && Math.abs(item.distance - game.distance) < 1400;
  }
}
