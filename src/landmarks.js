import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';

export function makeLandmarks(world, random) {
  const { biome, color } = world.mission;
  const model = new THREE.Group();
  const polished = ['crystal', 'ice', 'prism', 'salt', 'solar', 'observatory', 'glassworks', 'orrery'].includes(biome);
  const stone = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#a6acae'), 0.35), roughness: polished ? 0.24 : 0.82, metalness: biome === 'industrial' ? 0.7 : polished ? 0.3 : 0.05, side: ['fungal', 'solar'].includes(biome) ? THREE.DoubleSide : THREE.FrontSide });
  if (['ridge', 'mesa', 'sandstone', 'dunes', 'volcanic'].includes(biome)) stone.color.setHSL(world.mission.ground, world.mission.saturation, biome === 'volcanic' ? 0.16 : 0.38);
  const dark = biome === 'earth' ? new THREE.MeshStandardMaterial({ color: '#725134', roughness: 1 }) : world.materials.dark;
  const light = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 });
  if (biome === 'earth') { stone.color.set('#45863d'); light.color.set('#9bc85c'); light.emissiveIntensity = 0; }
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
  } else if (biome === 'bamboo') {
    foundation(19);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, x = Math.sin(a) * 12, z = Math.cos(a) * 12;
      for (let j = 0; j < 6 - i % 2; j++) {
        pillar(2.2, 7, stone, x, 7 + j * 7.5, z, 2);
        pillar(2.6, 0.7, light, x, 10.5 + j * 7.5, z);
      }
      branch([[x, 29, z], [x + 7, 34, z + 2], [x + 12, 36, z + 5]], 0.45, dark);
      rock([8, 1.2, 3], stone, x + 8, 35, z + 3).rotation.z = 0.3;
    }
  } else if (biome === 'honeycomb') {
    foundation(23);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI / 3, x = i === 6 ? 0 : Math.cos(a) * 14, z = i === 6 ? 0 : Math.sin(a) * 14;
      const height = i === 6 ? 45 : 24 + i % 3 * 6;
      pillar(7.5, height, stone, x, height / 2 + 3, z, 7.5, 6);
      pillar(6.2, 1, light, x, height + 3.5, z, 6.2, 6);
      for (let j = 0; j < 3; j++) pillar(7.7, 0.8, dark, x, 8 + j * 7, z, 7.7, 6);
    }
  } else if (biome === 'orchard') {
    foundation(17);
    pillar(3, 24, dark, 0, 14, 0, 1.8);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, x = Math.sin(a) * 12, z = Math.cos(a) * 12, y = 26 + i * 2;
      branch([[0, 14, 0], [x / 2, y - 4, z / 2], [x, y, z]], 1.1, dark);
      rock([10, 6, 9], stone, x, y + 4, z);
      for (let j = -1; j <= 1; j++) add(new THREE.SphereGeometry(1.8, 10, 8), light, x + j * 4, y - 2, z - 3);
    }
  } else if (biome === 'radar') {
    foundation(19);
    pillar(4, 28, dark, 0, 16, 0, 2);
    const dish = add(new THREE.SphereGeometry(18, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 30);
    dish.scale.y = 0.3;
    const rim = ring(18, 0.6, dark, 30); rim.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) branch([[side * 16, 30, 0], [side * 8, 40, 0], [0, 47, 0]], 0.4, light);
    add(new THREE.SphereGeometry(2, 12, 8), light, 0, 47);
    box([14, 7, 9], stone, 14, 6, 7);
  } else if (biome === 'archive') {
    foundation(20);
    for (let i = 0; i < 8; i++) {
      const slab = box([28 - i, 3, 21], stone, 0, 6 + i * 4.2); slab.rotation.y = (i - 3) * 0.11;
      box([20 - i, 0.45, 0.5], light, 0, 6 + i * 4.2, -11);
    }
    for (const x of [-18, 18]) pillar(2, 42, dark, x, 23, 0, 1.4, 8);
  } else if (biome === 'reactor') {
    foundation(22);
    pillar(7, 35, light, 0, 22, 0, 7, 20);
    for (let i = 0; i < 5; i++) {
      const collar = ring(11, 1.6, stone, 8 + i * 8); collar.rotation.x = Math.PI / 2;
      for (const x of [-13, 13]) box([2, 7, 2], dark, x, 8 + i * 8);
    }
    for (const side of [-1, 1]) branch([[side * 13, 6, 0], [side * 20, 6, 8], [side * 20, 24, 8]], 1.3, stone);
  } else if (biome === 'fossil') {
    foundation(23);
    branch([[-18, 5, -10], [0, 8, 0], [18, 9, 10]], 2.2, dark);
    for (let i = 0; i < 5; i++) for (const side of [-1, 1]) {
      const z = (i - 2) * 7, h = 40 - Math.abs(i - 2) * 5;
      branch([[0, 5, z], [side * 17, 15, z], [side * 18, h, z], [side * 5, h + 8, z]], 1.5, stone);
      add(new THREE.OctahedronGeometry(1.5), light, side * 5, h + 8, z);
    }
  } else if (biome === 'sapphire') {
    foundation(21);
    pillar(11, 15, dark, 0, 10, 0, 9, 8);
    const jewel = add(new THREE.OctahedronGeometry(1), stone, 0, 35); jewel.scale.set(13, 23, 13);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      pillar(1.6, 33, light, Math.sin(a) * 15, 20, Math.cos(a) * 15, 0.5, 6);
    }
    const crown = ring(16, 1, dark, 20); crown.rotation.x = Math.PI / 2;
  } else if (biome === 'terrace') {
    foundation(24);
    for (let i = 0; i < 5; i++) {
      const r = 24 - i * 4;
      pillar(r, 5, stone, 0, 5 + i * 6, 0, r, 16);
      const pool = ring(r - 1, 0.55, light, 7.6 + i * 6); pool.rotation.x = Math.PI / 2;
    }
    pillar(2, 22, dark, 0, 41, 0, 1);
    add(new THREE.OctahedronGeometry(4), light, 0, 53);
  } else if (biome === 'accelerator') {
    foundation(21);
    for (const side of [-1, 1]) {
      pillar(3, 42, dark, side * 16, 24);
      box([1.2, 36, 1.2], light, side * 16, 24, -3.1);
      for (let i = 0; i < 3; i++) {
        const blade = box([5, 2, 14], stone, side * 13, 13 + i * 11); blade.rotation.z = side * -0.45;
      }
    }
    for (let i = 0; i < 3; i++) { const coil = ring(14 - i * 2, 0.8, light, 28); coil.rotation.y = i * 0.4; }
    add(new THREE.OctahedronGeometry(5), stone, 0, 28);
  } else if (biome === 'wasteland') {
    foundation(22);
    stone.color.set('#655454');
    for (let i = 0; i < 4; i++) {
      const h = 26 + i * 7, x = (i - 1.5) * 11;
      const tower = box([8, h, 10], stone, x, h / 2 + 3, i % 2 * 10); tower.rotation.z = (i - 2) * 0.065;
      for (let j = 0; j < 5; j++) box([0.45, 2.8, 0.3], j % 3 ? dark : light, x - 2, 8 + j * 6, i % 2 * 10 - 5.1);
      const beam = box([1, 18, 1], dark, x + 1, h + 5, i % 2 * 10); beam.rotation.z = 0.3;
    }
    for (let i = 0; i < 5; i++) rock([5, 3, 7], i % 2 ? stone : dark, (i - 2) * 9, 3, -12);
    branch([[-19, 4, -9], [-6, 8, -8], [4, 4, -8], [17, 6, -10]], 0.45, light);
  } else if (biome === 'earth') {
    for (let i = 0; i < 4; i++) {
      const x = (i % 2 - 0.5) * 23, z = (Math.floor(i / 2) - 0.5) * 19, height = 22 + i * 3;
      pillar(1.5, height, dark, x, height / 2, z, 0.9, 8);
      for (let j = 0; j < 4; j++) {
        const a = j * 2.4;
        branch([[x, height * 0.6, z], [x + Math.cos(a) * 4, height, z + Math.sin(a) * 4]], 0.45, dark);
        rock([9, 6, 8], j % 2 ? stone : light, x + Math.cos(a) * 5, height + j * 1.2, z + Math.sin(a) * 5);
      }
    }
    for (let i = 0; i < 6; i++) rock([5, 2.5, 4], light, Math.sin(i * 2.4) * 20, 2, Math.cos(i * 2.4) * 20);
  } else if (biome === 'sails') {
    foundation(21);
    for (const side of [-1, 1]) {
      pillar(1.6, 57, dark, side * 14, 30);
      for (let i = 0; i < 3; i++) {
        const sail = add(new THREE.ConeGeometry(11 - i, 16, 3), stone, side * 9, 14 + i * 16);
        sail.scale.z = 0.17; sail.rotation.z = side * 0.2;
        box([0.4, 13, 0.5], light, side * 14, 14 + i * 16, -1);
      }
    }
    ring(9, 0.7, light, 28);
    ring(12, 0.9, stone, 28).rotation.y = 0.65;
  } else if (biome === 'viaduct') {
    foundation(23);
    for (const side of [-1, 1]) {
      box([5, 64, 7], stone, side * 15, 34);
      box([.6, 56, .8], light, side * 15, 35, -3.8);
      for (let i = 0; i < 4; i++) {
        const brace = box([2, 24, 2], dark, side * 7, 12 + i * 14);
        brace.rotation.z = side * -.65;
      }
    }
    box([39, 4, 12], stone, 0, 66);
    box([33, 1, 10], light, 0, 69);
    pillar(1, 15, dark, 0, 77);
  } else if (biome === 'fjord') {
    foundation(24);
    for (let i = 0; i < 3; i++) {
      const y = 17 + i * 15, radius = 20 - i * 4;
      ring(radius, 2.4, stone, y, Math.PI);
      for (const side of [-1, 1]) pillar(2, y, dark, side * radius, y / 2);
      ring(radius - 3, .45, light, y, Math.PI);
    }
    pillar(3, 48, stone, 0, 24);
    add(new THREE.OctahedronGeometry(4), light, 0, 58);
  } else if (biome === 'buttress') {
    foundation(25);
    for (let i = -2; i <= 2; i++) {
      const height = 62 - Math.abs(i) * 14;
      for (let level = 0; level < 5; level++) {
        box([8 - level * .6, height / 5, 18 - level * 2], stone, i * 9, 3 + (level + .5) * height / 5);
        box([8 - level * .6, .6, 18 - level * 2], dark, i * 9, 3 + level * height / 5);
      }
      box([.8, height * .75, .4], light, i * 9, height / 2, -9.3);
    }
  } else if (biome === 'icefall') {
    foundation(22);
    for (let i = -2; i <= 2; i++) {
      const height = 57 - Math.abs(i) * 8;
      const blade = box([6, height, 11], stone, i * 8, height / 2 + 3, Math.abs(i) * 3);
      blade.rotation.z = i * -.1;
      branch([[i * 8, 4, -6], [i * 9, height * .5, -5], [i * 10, height + 4, -4]], .7, light);
      rock([5, 4, 6], dark, i * 9, 4, -7);
    }
    ring(13, 1, light, 39).rotation.y = Math.PI / 2;
  } else if (biome === 'relayforest') {
    foundation(20);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 16, height = 49 - Math.abs(i - 1) * 12;
      pillar(2.7, height, dark, x, height / 2, 0, 1.5);
      for (let j = 0; j < 3; j++) {
        const crown = add(new THREE.ConeGeometry(12 - j * 3, 14, 8), stone, x, height - 16 + j * 9);
        crown.rotation.y = i + j * .3;
      }
      const halo = ring(8, .55, light, height + 2); halo.position.x = x; halo.rotation.x = Math.PI / 2;
      pillar(.45, 9, light, x, height + 10);
    }
  } else if (biome === 'crownridge') {
    foundation(25);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, x = Math.cos(angle) * 17, z = Math.sin(angle) * 17;
      pillar(4, 35 + i % 2 * 12, stone, x, 20, z, 1.2, 5);
      branch([[x, 34, z], [x * .7, 48, z * .7], [0, 58, 0]], .8, light);
    }
    for (const y of [14, 30]) { const rim = ring(18, 2, dark, y); rim.rotation.x = Math.PI / 2; }
    add(new THREE.OctahedronGeometry(5), light, 0, 60);
  }
  if (biome === 'cascade') {
    foundation(23);
    for (const side of [-1, 1]) {
      pillar(6, 52, stone, side * 17, 27, 0, 4, 7);
      for (let i = 0; i < 5; i++) box([1.1, 39 - i * 3, .5], light, side * (5 + i * 2.5), 24, 1);
    }
    for (const y of [5, 21, 46]) box([41, 3, 13], stone, 0, y);
  } else if (biome === 'regatta') {
    foundation(21);
    for (let i = -1; i <= 1; i++) {
      pillar(1.2, 51 - Math.abs(i) * 8, dark, i * 14, 27);
      const sail = add(new THREE.ConeGeometry(12, 32, 3), stone, i * 11, 30);
      sail.scale.z = .18; sail.rotation.z = i * -.18;
      box([.4, 26, .5], light, i * 14 + 1.5, 29, -1);
    }
    box([43, 2.2, 12], stone, 0, 9);
  } else if (biome === 'lantern') {
    foundation(19);
    pillar(3, 50, dark, 0, 26);
    for (let i = 0; i < 3; i++) {
      const y = 18 + i * 14, r = 13 - i * 2;
      pillar(r, 9, light, 0, y, 0, r, 8);
      for (const h of [-5, 5]) pillar(r + 1, 1.3, stone, 0, y + h, 0, r + 1, 8);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; box([.6, 10, .6], dark, Math.cos(a) * r, y, Math.sin(a) * r); }
    }
  } else if (biome === 'waystation') {
    foundation(25);
    for (const x of [-16, 16]) {
      box([5, 45, 8], stone, x, 24);
      box([1, 36, .5], light, x, 25, -4.2);
    }
    box([42, 5, 17], stone, 0, 47);
    for (const y of [16, 30]) box([25, 2, 11], dark, 0, y);
    ring(9, 1.1, light, 34);
    pillar(1, 15, dark, 0, 57);
    add(new THREE.OctahedronGeometry(3), light, 0, 66);
  } else if (biome === 'glassworks') {
    foundation(23);
    const dome = add(new THREE.SphereGeometry(19, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone, 0, 15);
    dome.scale.y = 1.2;
    for (const x of [-16, 16]) {
      pillar(2, 30, dark, x, 17);
      pillar(1, 24, light, x, 18, 1);
    }
    for (const y of [8, 15]) { const rim = ring(20, .8, light, y); rim.rotation.x = Math.PI / 2; }
    pillar(3, 12, stone, 0, 39, 0, 0, 6);
  } else if (biome === 'carillon') {
    foundation(23);
    for (const x of [-18, 18]) box([4, 51, 7], stone, x, 27);
    for (const y of [21, 48]) box([42, 3, 7], dark, 0, y);
    for (let i = -1; i <= 1; i++) {
      const y = 31 + Math.abs(i) * 7;
      pillar(.7, 48 - y, dark, i * 11, (48 + y) / 2);
      pillar(6, 10, stone, i * 11, y - 4, 0, 2.5);
      add(new THREE.SphereGeometry(1.3, 8, 6), light, i * 11, y - 10);
    }
    box([38, 1, 1], light, 0, 52);
  } else if (biome === 'cloudreef') {
    foundation(22);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 13, y = 18 + (i % 2) * 18;
      pillar(1.4, y, dark, x, y / 2, 0);
      rock([12, 4.5, 9], stone, x, y);
      const pearl = add(new THREE.SphereGeometry(4.2, 12, 8), light, x, y + 9);
      pearl.scale.y = 1.25;
      for (const side of [-1, 1]) branch([[x, y + 1, 0], [x + side * 7, y + 7, 0], [x + side * 5, y + 12, 0]], .7, dark);
    }
  } else if (biome === 'orrery') {
    foundation(23);
    pillar(4, 24, stone, 0, 14, 0, 7);
    for (let i = 0; i < 3; i++) {
      const orbit = ring(15 + i * 3, .7, i === 1 ? light : dark, 39);
      orbit.rotation.set(i * .7 + .3, i * .8, .3);
    }
    add(new THREE.IcosahedronGeometry(6, 1), light, 0, 39);
    for (const x of [-18, 18]) add(new THREE.SphereGeometry(3.5, 12, 8), stone, x, 40, 3);
  } else if (biome === 'reedbed') {
    foundation(21);
    for (let i = -2; i <= 2; i++) {
      const x = i * 7, h = 40 + (2 - Math.abs(i)) * 8;
      branch([[x, 2, 0], [x + i * 1.2, h * .6, 0], [x + i * 2, h, 2]], 1.3, dark);
      const bud = add(new THREE.CapsuleGeometry(2.6, 9, 6, 10), light, x + i * 2, h, 2);
      bud.rotation.z = i * -.08;
      for (const side of [-1, 1]) {
        const leaf = add(new THREE.ConeGeometry(4, 20, 5), stone, x + side * 5, h * .4);
        leaf.rotation.z = side * -.6; leaf.scale.z = .2;
      }
    }
  } else if (biome === 'forge') {
    foundation(25);
    pillar(15, 22, stone, 0, 15, 0, 11, 8);
    for (const y of [7, 18, 26]) { const rim = ring(15 - (y > 18 ? 4 : 0), 1.2, dark, y); rim.rotation.x = Math.PI / 2; }
    for (const x of [-17, 17]) {
      pillar(4, 53, stone, x, 29, 0, 3, 8);
      pillar(4.2, 2, light, x, 54, 0, 4.2, 8);
      branch([[x, 34, 0], [x * .5, 32, 0], [0, 26, 0]], 2, dark);
    }
    for (let i = -2; i <= 2; i++) box([1.2, 10, 1], light, i * 3, 14, -13.5);
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
  const clearance = ((size.x + size.z) / 2 + Math.hypot(center.x, center.z)) * 1.1 + 27;
  const placements = [], transform = new THREE.Object3D();
  const count = Math.max(48, Math.ceil(world.mission.length / 350));
  for (let i = 0; i < count; i++) {
    const position = world.frame((i + 0.3) / count * world.mission.length, (i % 2 ? -1 : 1) * (Math.max(76, clearance + 12) + random() * 55)).point;
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
