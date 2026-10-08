import * as THREE from 'three';
import { foundationLevel } from './model-utils.js';

export function makeBridges(world) {
  if (!world.mission.bridges.length) return;
  const parts = { concrete: [], steel: [], cables: [], lights: [] };
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const beam = (kind, a, b, width, depth = width, yaw) => {
    const direction = b.clone().sub(a), length = direction.length();
    if (length < .01) return;
    transform.position.copy(a).add(b).multiplyScalar(.5);
    if (yaw === undefined) transform.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    else transform.quaternion.setFromAxisAngle(up, yaw);
    transform.scale.set(width, length, depth);
    transform.updateMatrix();
    parts[kind].push(transform.matrix.clone());
  };
  const frames = new Map();
  const frameAt = distance => {
    let frame = frames.get(distance);
    if (!frame) { frame = world.frame(distance); frames.set(distance, frame); }
    return frame;
  };
  const point = (distance, lane, height) => {
    const frame = frameAt(distance);
    return frame.point.clone().addScaledVector(frame.right, lane).addScaledVector(frame.up, height);
  };
  const pier = (distance, lane, width, depth) => {
    const top = point(distance, lane, -4.8);
    const bottom = top.clone();
    const { tangent } = frameAt(distance), yaw = Math.atan2(tangent.x, tangent.z);
    bottom.y = Math.min(top.y - .1, foundationLevel(world, top, width + 4, depth + 4, yaw));
    beam('concrete', bottom, top, width, depth, yaw);
    const foot = bottom.clone(); foot.y += 2;
    beam('concrete', bottom, foot, width + 4, depth + 4, yaw);
  };
  const path = (kind, start, end, lane, heightAt, width, joints) => {
    const steps = Math.ceil((end - start) / 30), stations = joints ?? Array.from({ length: steps + 1 }, (_, i) => start + (end - start) * i / steps);
    let previous = point(start, lane, heightAt(0));
    for (let i = 1; i < stations.length; i++) {
      const next = point(stations[i], lane, heightAt((stations[i] - start) / (end - start)));
      beam(kind, previous, next, width);
      previous = next;
    }
  };
  for (const bridge of world.mission.bridges) {
    const { start, end, kind } = bridge, length = end - start;
    for (const side of [-1, 1]) path('steel', start, end, side * 14, () => -5, 1.8);
    const intervals = Math.ceil(length / 60);
    for (let i = 0; i <= intervals; i++) {
      const distance = start + length * i / intervals;
      const deckMaterial = kind === 'viaduct' ? 'concrete' : 'steel';
      beam(deckMaterial, point(distance, -17, -4.8), point(distance, 17, -4.8), kind === 'viaduct' ? 1.45 : 1.2, kind === 'viaduct' ? 2.4 : 1.2);
      for (const side of [-1, 1]) {
        beam('lights', point(distance, side * 19.5, 1.6), point(distance, side * 19.5, 3), .25);
        if (kind === 'viaduct') {
          pier(distance, side * 12.8, 3.4, 5);
          beam('concrete', point(distance, side * 12.8, -5.1), point(distance, side * 16.6, -8.8), .95, 1.5);
          beam('lights', point(distance, side * 18.1, -3.8), point(distance, side * 18.1, -2.5), .22);
        }
      }
      if (kind === 'viaduct' && i < intervals) {
        for (const side of [-1, 1]) {
          const next = start + length * (i + 1) / intervals;
          const lowerDistance = (distance + next) / 2;
          const lower = point(lowerDistance, side * 12.8, -12.5);
          beam('concrete', point(distance, side * 12.8, -5.1), lower, 1.15, 1.8);
          beam('concrete', lower, point(next, side * 12.8, -5.1), 1.15, 1.8);
        }
      }
    }
    if (kind === 'viaduct') {
      for (const side of [-1, 1]) {
        path('concrete', start, end, side * 17.2, () => -5.15, 2.2);
        path('steel', start, end, side * 11.8, () => -8.4, 1.2);
      }
      continue;
    }
    const towers = [.2, .8].map(t => start + length * t);
    for (const distance of towers) {
      for (const side of [-1, 1]) {
        pier(distance, side * 23, 5, 7);
        beam('steel', point(distance, side * 23, -5), point(distance, side * 23, 78), 3.2, 4);
        beam('lights', point(distance, side * 23, 35), point(distance, side * 23, 76), .4);
      }
      beam('steel', point(distance, -23, 68), point(distance, 23, 68), 2.8, 4);
    }
    for (const side of [-1, 1]) {
      if (kind === 'cable') {
        const anchors = new Set();
        for (const tower of towers) for (const direction of [-1, 1]) for (let i = 1; i <= 6; i++) {
          const anchor = Math.max(start, Math.min(end, tower + direction * length * i / 22));
          anchors.add(anchor);
          path('cables', Math.min(anchor, tower), Math.max(anchor, tower), side * 23, t => 2 + 73 * (anchor < tower ? t : 1 - t), .32);
        }
        for (const anchor of anchors) beam('steel', point(anchor, side * 17, -4), point(anchor, side * 23, 2), .8);
      } else {
        const heightAt = distance => distance < towers[0] ? 3 + 72 * (distance - start) / (towers[0] - start)
          : distance > towers[1] ? 3 + 72 * (end - distance) / (end - towers[1])
            : 14 + 61 * ((distance - (start + end) / 2) / (length * .3)) ** 2;
        const hangers = Array.from({ length: Math.ceil(length / 30) - 1 }, (_, i) => start + (i + 1) * 30);
        const joints = [...new Set([start, end, ...towers, ...hangers])].sort((a, b) => a - b);
        path('cables', start, end, side * 23, t => heightAt(start + length * t), .65, joints);
        for (const distance of hangers) {
          beam('cables', point(distance, side * 23, 1.8), point(distance, side * 23, heightAt(distance)), .22);
          beam('steel', point(distance, side * 17, -4), point(distance, side * 23, 1.8), .6);
        }
      }
    }
  }
  const materials = {
    concrete: new THREE.MeshStandardMaterial({ color: '#91a1a8', roughness: .88 }),
    steel: new THREE.MeshStandardMaterial({ color: world.mission.color, roughness: .42, metalness: .65 }),
    cables: new THREE.MeshStandardMaterial({ color: '#c0d2dc', roughness: .5, metalness: .7 }),
    lights: new THREE.MeshStandardMaterial({ color: world.mission.color, emissive: world.mission.color, emissiveIntensity: 1.8 }),
  };
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const cableGeometry = new THREE.CylinderGeometry(.5, .5, 1, 8);
  if (!parts.cables.length) cableGeometry.dispose();
  for (const [kind, matrices] of Object.entries(parts)) {
    if (!matrices.length) { materials[kind].dispose(); continue; }
    const mesh = new THREE.InstancedMesh(kind === 'cables' ? cableGeometry : geometry, materials[kind], matrices.length);
    mesh.name = `bridge-${kind}`;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = kind !== 'lights';
    mesh.computeBoundingSphere();
    world.scene.add(mesh);
  }
}
