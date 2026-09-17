import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';

export function makeLandmarks(world, random) {
  const { biome, color } = world.mission;
  const model = new THREE.Group();
  const polished = ['crystal', 'ice', 'prism', 'salt', 'solar', 'observatory'].includes(biome);
  const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#a6acae'), 0.35), roughness: polished ? 0.24 : 0.82, metalness: biome === 'industrial' ? 0.7 : polished ? 0.3 : 0.05, side: ['fungal', 'solar'].includes(biome) ? THREE.DoubleSide : THREE.FrontSide });
  if (['ridge', 'mesa', 'sandstone', 'dunes', 'volcanic'].includes(biome)) stone.color.setHSL(world.mission.ground, world.mission.saturation, biome === 'volcanic' ? 0.16 : 0.38);
  const dark = world.materials.dark;
  const light = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
  const add = (geometry, material, x = 0, y = 0, z = 0) => world.mesh(geometry, material, model, [x, y, z]);
  const box = (size, material, x, y, z = 0) => add(new THREE.BoxGeometry(...size), material, x, y, z);
  const pillar = (radius, height, material, x, y, z = 0, top = radius, sides = 12) => add(new THREE.CylinderGeometry(top, radius, height, sides), material, x, y, z);
  const ring = (radius, tube, material, y, arc = Math.PI * 2) => add(new THREE.TorusGeometry(radius, tube, 6, 48, arc), material, 0, y, 0);
  const rock = (size, material, x, y, z = 0) => { const mesh = add(new THREE.IcosahedronGeometry(1, 1), material, x, y, z); mesh.scale.set(...size); return mesh; };
  const branch = (points, radius, material) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 6, false), material);
  const foundation = (radius = 14) => pillar(radius, 3, dark, 0, 1.5, 0, radius * 0.9);
  if (biome === 'ridge') {
    for (let i = -1; i <= 1; i++) {
      const h = 38 - Math.abs(i) * 12;
      for (let j = 0; j < 5; j++) {
        const r = 10 - j * 1.7;
        const ledge = pillar(r, h / 5 + 2, stone, i * 12 + j * i * 0.5, h / 5 * (j + 0.5), i * 3, r * 0.76, 7);
        ledge.rotation.y = j * 0.14;
      }
      pillar(0.6, 5, dark, i * 14, h + 3, i * 3);
      add(new THREE.SphereGeometry(1, 8, 6), light, i * 14, h + 6, i * 3);
    }
  } else if (biome === 'crystal') {
    foundation(21);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4, r = i ? 12 : 0, h = 48 - i * 4;
      const x = Math.sin(angle) * r, z = Math.cos(angle) * r;
      pillar(4.5, h, stone, x, h / 2 + 2, z, 4.5, 6);
      add(new THREE.ConeGeometry(4.5, 12, 6), light, x, h + 8, z);
      pillar(4.7, 1.5, dark, x, h * 0.35, z, 4.7, 6);
    }
  } else if (biome === 'mesa') {
    foundation(19);
    for (let i = 0; i < 3; i++) for (let level = 0; level < 6; level++) {
      const width = 7 + Math.sin(level * 1.7 + i) * 2;
      const h = 5 + i;
      const layer = pillar(width, h, level === 4 ? light : stone, (i - 1) * 13, 3 + h * (level + 0.5), i % 2 * 7, width * 0.8, 9);
      layer.rotation.y = level * 0.2;
    }
  } else if (biome === 'ice') {
    foundation(18);
    for (let i = -2; i <= 2; i++) {
      const fin = add(new THREE.ConeGeometry(8, 60 - Math.abs(i) * 12, 3), stone, i * 7, 24 - Math.abs(i) * 4, 0);
      fin.rotation.set(0, i * 0.3, i * -0.19);
      branch([[i * 7 - 2, 2, 3], [i * 8, 17, 3], [i * 9, 32 - Math.abs(i) * 4, 0]], 0.3, light);
    }
  } else if (biome === 'forest' || biome === 'fungal') {
    pillar(4, 36, dark, 0, 18, 0, 2.2, 9);
    for (let i = 0; i < (biome === 'forest' ? 7 : 4); i++) {
      const a = i * 2.4, x = Math.sin(a) * 12, z = Math.cos(a) * 12, y = 20 + i * 3;
      branch([[0, 5, 0], [x * 0.35, y - 8, z * 0.35], [x, y, z]], 1.1, stone);
      if (biome === 'forest') {
        rock([11, 7, 9], i % 3 ? stone : light, x, y + 3, z);
      } else {
        const cap = add(new THREE.SphereGeometry(11, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone, x, y, z);
        cap.scale.y = 0.48;
        const rim = ring(10.5, 0.3, light, y); rim.position.set(x, y, z); rim.rotation.x = Math.PI / 2;
        for (let j = 0; j < 8; j++) {
          const angle = j * Math.PI / 4;
          branch([[x, y - 2, z], [x + Math.cos(angle) * 5, y - 1, z + Math.sin(angle) * 5], [x + Math.cos(angle) * 10, y, z + Math.sin(angle) * 10]], 0.15, light);
        }
      }
    }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; branch([[0, 8, 0], [Math.cos(a) * 5, 2, Math.sin(a) * 5], [Math.cos(a) * 11, 0, Math.sin(a) * 11]], 0.8, dark); }
  } else if (biome === 'volcanic') {
    foundation(20);
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4, r = Math.sqrt(i) * 4, h = 36 - i * 1.8;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      pillar(4, h, stone, x, h / 2, z, 3.8, 6);
      pillar(3.85, 0.6, light, x, h, z, 3.85, 6);
      for (let j = 1; j <= 3; j++) pillar(4.07, 0.35, dark, x, h * j / 4, z, 4.07, 6);
    }
  } else if (biome === 'sandstone' || biome === 'dunes' || biome === 'ruins') {
    foundation(22);
    const radius = biome === 'sandstone' ? 16 : 20;
    for (const x of [-radius, radius]) {
      for (let j = 0; j < 5; j++) {
        const block = box([7 + (j % 2), 4.8, 9], stone, x, 2.4 + j * 4.7);
        block.rotation.y = Math.sin(j) * 0.06;
      }
    }
    for (let i = 0; i < 11; i++) {
      const angle = (i + 0.5) / 11 * Math.PI;
      const arch = box([7, 6, 9], stone, Math.cos(angle) * radius, 24 + Math.sin(angle) * radius);
      arch.rotation.z = angle - Math.PI / 2;
    }
    if (biome === 'ruins') {
      ring(11, 0.45, light, 26);
      for (const x of [-radius, radius]) for (let j = 0; j < 4; j++) box([2.6, 0.4, 0.3], light, x, 5 + j * 5, -4.6);
    } else if (biome === 'dunes') {
      rock([10, 4, 8], stone, -15, 2, -9);
      for (let i = 0; i < 3; i++) pillar(0.5, 8 - i * 2, light, i * 3 - 3, 4, -8);
    } else {
      rock([9, 17, 7], stone, 10, 9, 11);
      for (let i = 0; i < 4; i++) box([7, 0.35, 0.25], light, -radius, 3 + i * 6, -4.6);
    }
  } else if (biome === 'ocean') {
    foundation(15);
    pillar(7, 26, stone, 0, 15, 0, 4);
    for (const y of [8, 18, 28]) { const r = ring(7, 0.65, dark, y); r.rotation.x = Math.PI / 2; }
    pillar(5, 5, light, 0, 32);
    pillar(8, 2, dark, 0, 35);
    add(new THREE.ConeGeometry(8, 6, 16), stone, 0, 39);
    for (const x of [-11, 11]) {
      pillar(0.5, 32, dark, x, 16);
      const sail = add(new THREE.SphereGeometry(8, 12, 8, 0, Math.PI), stone, x, 21);
      sail.scale.set(0.5, 1.8, 0.3);
    }
  } else if (biome === 'storm') {
    foundation(17);
    pillar(5, 40, dark, 0, 23, 0, 2);
    for (let i = 0; i < 6; i++) { const r = ring(12 - i, 1.4, stone, 9 + i * 6); r.rotation.x = Math.PI / 2; }
    add(new THREE.SphereGeometry(4, 16, 12), light, 0, 47);
    for (const side of [-1, 1]) branch([[0, 47, 0], [side * 12, 34, 0], [side * 7, 27, 0], [side * 17, 14, 0]], 0.3, light);
  } else if (biome === 'spires') {
    foundation(18);
    for (let i = -1; i <= 1; i++) {
      const h = 55 - Math.abs(i) * 16;
      pillar(5, h, dark, i * 11, h / 2, 0, 1, 5);
      add(new THREE.ConeGeometry(3, 13, 5), stone, i * 11, h + 4);
      box([0.45, h * 0.6, 0.45], light, i * 11, h * 0.47, -2.5);
    }
    ring(10, 0.6, stone, 29).rotation.y = Math.PI / 2;
  } else if (biome === 'coral') {
    foundation(16);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4, x = Math.sin(a) * 16, z = Math.cos(a) * 13, y = 24 + i * 3;
      branch([[0, 0, 0], [x * 0.3, 15, z * 0.4], [x, y, z]], 2.1, stone);
      for (const side of [-1, 1]) {
        branch([[x * 0.5, y - 10, z * 0.5], [x + side * 4, y, z], [x + side * 5, y + 7, z + 3]], 0.8, light);
        rock([3.5, 2, 3.5], stone, x + side * 5, y + 7, z + 3);
      }
    }
  } else if (biome === 'salt') {
    foundation(21);
    for (let i = 0; i < 7; i++) {
      const level = box([32 - i * 3.5, 5, 28 - i * 3], stone, 0, 4 + i * 5);
      level.rotation.y = i * 0.13;
      box([24 - i * 3, 0.35, 0.4], light, 0, 6.5 + i * 5, -13 + i * 1.5);
    }
    rock([8, 4, 6], stone, 19, 2, 9);
  } else if (biome === 'industrial') {
    foundation(18);
    for (const x of [-8, 8]) {
      pillar(4, 42, stone, x, 24);
      for (let i = 0; i < 5; i++) pillar(4.3, 1, dark, x, 7 + i * 8);
      pillar(3.5, 1.5, light, x, 45);
      branch([[x, 41, 0], [x, 48, 0], [0, 48, 0]], 1.2, dark);
    }
    for (let i = 0; i < 6; i++) box([25, 1, 12], stone, 0, 8 + i * 5);
    box([1, 44, 1], light, 0, 23, -7);
  } else if (biome === 'magnetic') {
    foundation(19);
    rock([11, 15, 10], stone, 0, 44).rotation.z = 0.45;
    for (let i = 0; i < 4; i++) { const mesh = ring(20 - i * 2, 0.45, light, 24 + i * 11); mesh.rotation.set(1.1, i * 0.6, i * 0.3); }
    for (let i = 0; i < 5; i++) { const a = i * 1.25; rock([3, 5, 3], stone, Math.cos(a) * 16, 27 + i * 5, Math.sin(a) * 16); }
  } else if (biome === 'stargate') {
    foundation(24);
    ring(25, 2.2, stone, 32);
    ring(22, 0.5, light, 32);
    ring(18, 0.35, light, 32).rotation.y = 0.8;
    for (let i = 0; i < 12; i++) {
      const angle = i / 12 * Math.PI * 2;
      const key = box([3, 5, 5], dark, Math.sin(angle) * 25, 32 + Math.cos(angle) * 25);
      key.rotation.z = -angle;
      const rune = box([1.3, 2.5, 0.25], light, Math.sin(angle) * 25, 32 + Math.cos(angle) * 25, -2.7);
      rune.rotation.z = -angle;
    }
  } else if (biome === 'aurora') {
    foundation(17);
    for (let i = -1; i <= 1; i++) {
      pillar(5, 42 - Math.abs(i) * 9, stone, i * 12, 20, 0, 1.5, 6);
      ring(7, 0.4, light, 33 - Math.abs(i) * 5).position.x = i * 12;
      box([0.5, 34, 0.5], light, i * 12, 20, -3);
    }
  } else if (biome === 'prism') {
    foundation(20);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      const shard = add(new THREE.OctahedronGeometry(1), i % 2 ? stone : light, Math.sin(a) * 13, 25 - i * 2, Math.cos(a) * 10);
      shard.scale.set(7, 28 - i * 2, 7);
      shard.rotation.z = (i - 2) * 0.13;
      const collar = ring(5, 0.6, dark, 20); collar.position.set(shard.position.x, 20, shard.position.z); collar.rotation.x = Math.PI / 2;
    }
    ring(20, 0.4, stone, 25).rotation.x = 0.8;
  } else if (biome === 'lotus') {
    foundation(17);
    pillar(3, 23, dark, 0, 12, 0, 1.5);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const petal = add(new THREE.SphereGeometry(1, 16, 10), stone, Math.cos(a) * 10, 28, Math.sin(a) * 10);
      petal.scale.set(5, 3, 15);
      petal.rotation.set(0.38, Math.PI / 2 - a, 0);
      branch([[0, 15, 0], [Math.cos(a) * 8, 23, Math.sin(a) * 8], [Math.cos(a) * 19, 32, Math.sin(a) * 19]], 0.35, light);
    }
    add(new THREE.SphereGeometry(5, 16, 12), light, 0, 30);
    for (let i = 0; i < 5; i++) { const a = i * 2.4; rock([6, 2, 9], stone, Math.sin(a) * 11, 3, Math.cos(a) * 11); }
  } else if (biome === 'solar') {
    foundation(19);
    pillar(3, 33, dark, 0, 19);
    const dish = add(new THREE.SphereGeometry(17, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 29);
    dish.scale.y = 0.3;
    dish.rotation.x = Math.PI;
    const rim = ring(17, 0.65, dark, 29); rim.rotation.x = Math.PI / 2;
    pillar(0.7, 16, light, 0, 40);
    add(new THREE.OctahedronGeometry(3), light, 0, 49);
    for (const side of [-1, 1]) {
      pillar(1.2, 15, dark, side * 19, 7.5);
      const panel = box([14, 0.7, 16], stone, side * 19, 15); panel.rotation.z = side * 0.25;
      panel.updateMatrix();
      for (let i = -2; i <= 2; i++) box([12, 0.1, 0.12], light, 0, 0.42, i * 3).applyMatrix4(panel.matrix);
    }
  } else if (biome === 'geyser') {
    foundation(22);
    for (let i = 0; i < 5; i++) {
      pillar(21 - i * 3, 4, stone, 0, 3 + i * 4, 0, 19 - i * 3, 16);
      const pool = ring(18 - i * 3, 0.55, light, 5 + i * 4); pool.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, r = i ? 3 : 0, h = 32 - i * 2;
      branch([[Math.sin(a) * r, 20, Math.cos(a) * r], [Math.sin(a) * 5, 20 + h, Math.cos(a) * 5], [Math.sin(a) * 12, 28 + h * 0.3, Math.cos(a) * 12]], 0.4, light);
      rock([2, 3, 2], light, Math.sin(a) * 12, 28 + h * 0.3, Math.cos(a) * 12);
    }
  } else if (biome === 'wind') {
    foundation(16);
    pillar(4, 48, stone, 0, 26, 0, 1.8);
    box([6, 4, 9], dark, 0, 50, 2);
    add(new THREE.SphereGeometry(2.8, 16, 12), light, 0, 50, -3.5);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.3;
      const blade = box([3, 24, 0.9], stone, Math.sin(a) * 14, 50 + Math.cos(a) * 14, -4);
      blade.rotation.z = -a;
      const strip = box([0.4, 18, 1], light, Math.sin(a) * 16, 50 + Math.cos(a) * 16, -4.2);
      strip.rotation.z = -a;
    }
    for (const y of [12, 24, 36]) { const collar = ring(3.5, 0.3, dark, y); collar.rotation.x = Math.PI / 2; }
  } else if (biome === 'observatory') {
    foundation(22);
    pillar(16, 12, dark, 0, 8, 0, 16, 24);
    add(new THREE.SphereGeometry(16, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 14);
    const aperture = box([4, 5, 17], dark, 0, 25, -7); aperture.rotation.x = -0.45;
    const telescope = pillar(2.2, 15, stone, 0, 31, -8); telescope.rotation.x = -0.6;
    for (let i = 0; i < 3; i++) {
      const orbit = ring(12 + i * 4, 0.5, i === 1 ? light : stone, 48);
      orbit.rotation.set(i * 0.6 + 0.4, i * 0.7, i * 0.2);
    }
    add(new THREE.OctahedronGeometry(4), light, 0, 48);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box([1.2, 4, 1.2], light, Math.sin(a) * 16, 8, Math.cos(a) * 16); }
  }
  if (biome === 'prism') {
    stone.vertexColors = light.vertexColors = true;
    model.children.forEach((mesh, index) => {
      if (mesh.material === dark) return;
      const tint = new THREE.Color().setHSL((index * 0.19 + 0.08) % 1, 0.7, 0.62);
      const colors = new Float32Array(mesh.geometry.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
      mesh.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    });
  }
  batchMeshes(model);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const clearance = (Math.hypot(size.x, size.z) / 2 + Math.hypot(center.x, center.z)) * 1.1 + 27;
  const placements = [], transform = new THREE.Object3D();
  for (let i = 0; i < 48; i++) {
    const position = world.frame((i + 0.3) / 48 * world.mission.length, (i % 2 ? -1 : 1) * (Math.max(76, clearance + 12) + random() * 55)).point;
    const ground = world.groundInfo(position.x, position.z);
    if (ground.distance < clearance) continue;
    transform.position.set(position.x, ground.y - 1, position.z);
    transform.rotation.set(0, random() * Math.PI * 2, 0);
    transform.scale.setScalar(0.85 + random() * 0.25);
    transform.updateMatrix();
    placements.push(transform.matrix.clone());
  }
  for (const part of model.children) {
    const instances = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    instances.name = `landmark-${biome}`;
    placements.forEach((placement, i) => instances.setMatrixAt(i, placement));
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = instances.receiveShadow = true;
    world.scene.add(instances);
  }
  if (biome === 'aurora') makeAurora(world);
}

function makeAurora(world) {
  const origin = world.frame(0);
  for (let band = 0; band < 3; band++) {
    const vertices = [], colors = [], indices = [];
    const tint = new THREE.Color(band === 1 ? '#bc92ff' : '#69ffc6');
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const base = origin.point.clone().addScaledVector(origin.tangent, 800 + band * 220 + Math.sin(t * 9) * 180).addScaledVector(origin.right, (t - 0.5) * 2400);
      base.y += 380 + Math.sin(t * 12 + band) * 90;
      for (const edge of [0, 1]) {
        vertices.push(base.x, base.y + edge * 220, base.z);
        tint.clone().multiplyScalar(edge ? 0 : Math.sin(t * Math.PI) * 0.8).toArray(colors, colors.length);
      }
      if (i < 64) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    world.mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, fog: false }), world.scene);
  }
}
