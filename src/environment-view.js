import * as THREE from 'three';
import { ENVIRONMENT, meteorState } from './environment.js';
import { batchMeshes } from './model-utils.js';

const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

export function meteorFootprint(world, meteor, inner = 0, outer = 1) {
  const geometry = new THREE.RingGeometry(inner, outer, 48);
  const coordinates = geometry.attributes.position.array.slice();
  geometry.userData.coordinates = coordinates;
  fitFootprint(geometry, world, meteor);
  return geometry;
}

function fitFootprint(geometry, world, meteor, scale = 1) {
  const positions = geometry.attributes.position;
  const coordinates = geometry.userData.coordinates;
  const radius = (meteor.radius + ENVIRONMENT.craftRadius) * scale;
  for (let index = 0; index < positions.count; index++) {
    const point = world.frame(meteor.distance + coordinates[index * 3 + 1] * radius, meteor.lane + coordinates[index * 3] * radius, 0.14).point;
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
}

export class EnvironmentView {
  constructor(world) {
    this.world = world;
    this.ribbons = new THREE.Group();
    const zoneSurface = glow('#bda6ff', 0.08);
    const zoneEdge = glow('#ceb8ff', 0.8);
    this.zoneSurface = zoneSurface;
    for (const zone of world.course.gravityZones) {
      this.ribbon(zone.start, zone.end, -14.8, 14.8, zoneSurface);
      for (const side of [-1, 1]) {
        this.ribbon(zone.start, zone.end, side * 14 - 0.12, side * 14 + 0.12, zoneEdge);
        for (const distance of [zone.start, zone.end]) {
          const marker = new THREE.Group();
          world.box([1.1, 0.4, 1.1], world.materials.dark, marker, [0, 0.2, 0]);
          world.box([0.2, 5, 0.2], zoneEdge, marker, [0, 2.6, 0]);
          const halo = world.mesh(new THREE.TorusGeometry(1, 0.055, 4, 24), zoneEdge, marker, [0, 4.5, 0]);
          halo.rotation.x = Math.PI / 2;
          world.place(marker, distance, side * 14);
        }
      }
      for (let distance = zone.start + 12; distance < zone.end; distance += 25) {
        for (const side of [-1, 1]) this.ribbon(distance, distance + 1.2, side * 11 - 0.8, side * 11 + 0.8, zoneEdge);
      }
    }
    world.scene.add(batchMeshes(this.ribbons));
    const meteorGeometry = new THREE.IcosahedronGeometry(1.4, 0);
    const tailGeometry = new THREE.ConeGeometry(0.8, 9, 6);
    this.meteors = world.course.meteors.map(meteor => {
      const group = new THREE.Group();
      const disc = world.mesh(meteorFootprint(world, meteor), glow('#ff754a', 0.15), world.scene);
      const ring = world.mesh(meteorFootprint(world, meteor, 0.978), glow('#ffb36e'), world.scene);
      const pulse = world.mesh(meteorFootprint(world, meteor, 0.978), glow('#ffddad'), world.scene);
      disc.renderOrder = 1;
      ring.renderOrder = pulse.renderOrder = 2;
      pulse.geometry.computeBoundingSphere();
      const rock = world.mesh(meteorGeometry, glow('#ffe4b0'), group);
      const tail = world.mesh(tailGeometry, glow('#ff8b50', 0.55), rock, [0, 4.8, 0]);
      tail.rotation.z = 0.13;
      world.place(group, meteor.distance, meteor.lane);
      return { meteor, group, disc, ring, pulse, rock };
    });
  }

  ribbon(start, end, left, right, material) {
    const world = this.world;
    const steps = Math.max(1, Math.ceil((end - start) / 5));
    const positions = new Float32Array((steps + 1) * 6);
    const indices = [];
    for (let index = 0; index <= steps; index++) {
      const distance = start + (end - start) * index / steps;
      world.frame(distance, left, 0.11).point.toArray(positions, index * 6);
      world.frame(distance, right, 0.11).point.toArray(positions, index * 6 + 3);
      if (index < steps) { const a = index * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    world.mesh(geometry, material, this.ribbons);
  }

  render(elapsed) {
    this.zoneSurface.opacity = 0.075 + Math.sin(elapsed * 1.5) * 0.02;
    for (const { meteor, disc, ring, pulse, rock } of this.meteors) {
      const state = meteorState(meteor, elapsed);
      const warning = state.phase === 'warning';
      const impact = state.phase === 'impact';
      const afterglow = state.phase === 'afterglow';
      ring.material.color.set(warning ? '#ff4b48' : impact ? '#ffd0a0' : '#536171');
      ring.material.opacity = warning ? 0.7 + Math.sin(elapsed * 14) * 0.25 : impact ? 1 : 0.25;
      disc.visible = warning || impact || afterglow;
      disc.material.opacity = warning ? 0.12 + state.progress * 0.12 : impact ? 0.5 * (1 - state.progress * 0.5) : 0.14 * (1 - state.progress);
      pulse.visible = warning || impact;
      if (pulse.visible) fitFootprint(pulse.geometry, this.world, meteor, warning ? Math.max(0.05, 1 - state.progress) : 0.2 + state.progress * 0.8);
      pulse.material.opacity = warning ? 0.9 : 1 - state.progress;
      rock.visible = warning && state.remaining <= 0.85;
      rock.position.y = 1 + 35 * Math.max(0, state.remaining) / 0.85;
      rock.rotation.y = elapsed * 3;
      rock.rotation.z = -0.12;
    }
  }
}
