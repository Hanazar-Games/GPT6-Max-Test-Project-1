import * as THREE from 'three';

export function makeBridges(world) {
  if (!world.mission.bridges.length) return;
  const parts = { concrete: [], steel: [], cables: [], lights: [] };
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  const beam = (kind, a, b, width, depth = width) => {
    const direction = b.clone().sub(a), length = direction.length();
    if (length < .01) return;
    transform.position.copy(a).add(b).multiplyScalar(.5);
    transform.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
    transform.scale.set(width, length, depth);
    transform.updateMatrix();
    parts[kind].push(transform.matrix.clone());
  };
  const point = (distance, lane, height) => world.frame(distance, lane, height).point;
  const pier = (distance, lane, width, depth) => {
    const top = point(distance, lane, -4.8);
    const bottom = top.clone();
    bottom.y = Math.min(top.y - .1, world.groundInfo(top.x, top.z).y - 2);
    beam('concrete', bottom, top, width, depth);
    const foot = bottom.clone(); foot.y += 2;
    beam('concrete', bottom, foot, width + 4, depth + 4);
  };
  const path = (kind, start, end, lane, heightAt, width) => {
    const steps = Math.ceil((end - start) / 30);
    let previous = point(start, lane, heightAt(0));
    for (let i = 1; i <= steps; i++) {
      const next = point(start + (end - start) * i / steps, lane, heightAt(i / steps));
      beam(kind, previous, next, width);
      previous = next;
    }
  };
  for (const bridge of world.mission.bridges) {
    const { start, end, kind } = bridge, length = end - start;
    for (const side of [-1, 1]) path('steel', start, end, side * 14, () => -5, 1.8);
    for (let distance = start; distance <= end; distance += 60) {
      beam('steel', point(distance, -17, -4.8), point(distance, 17, -4.8), 1.2);
      for (const side of [-1, 1]) {
        beam('lights', point(distance, side * 19.5, 1.6), point(distance, side * 19.5, 3), .25);
        if (kind === 'viaduct') pier(distance, side * 12.8, 3.4, 5);
      }
    }
    if (kind === 'viaduct') continue;
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
        path('cables', start, end, side * 23, t => heightAt(start + length * t), .65);
        for (let distance = start + 30; distance < end; distance += 30) {
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
  for (const [kind, matrices] of Object.entries(parts)) {
    const mesh = new THREE.InstancedMesh(geometry, materials[kind], matrices.length);
    mesh.name = `bridge-${kind}`;
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = mesh.receiveShadow = kind !== 'lights';
    mesh.computeBoundingSphere();
    world.scene.add(mesh);
  }
}
