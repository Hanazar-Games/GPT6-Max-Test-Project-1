import * as THREE from 'three';
import { AIRPORTS, airportHeight } from './airport.js';

export const AVIATION_ENVIRONMENT_DEFAULTS = Object.freeze({ viewDistance: 100000, detailDistance: 4500, groundDetail: 'low' });
const segments = { low: [16, 8, 4], balanced: [24, 12, 6], high: [40, 20, 10] };
const sand = new THREE.Color('#bfbd8b'), grass = new THREE.Color('#598567'), rock = new THREE.Color('#6d8176');

function tileGeometry(x, z, count, edgeCount, airport) {
  const islandHeight = (x, z) => airportHeight(x, z, airport);
  const desert = new THREE.Color('#bd9863'), alpine = new THREE.Color('#72866d');
  const vertices = [], normals = [], colors = [], indices = [], size = 4000, step = size / count;
  function vertex(dx, dz) {
    if (Math.abs(Math.abs(dx) - size / 2) < 1e-6 || Math.abs(Math.abs(dz) - size / 2) < 1e-6) {
      dx = Math.round((dx + size / 2) / size * edgeCount) / edgeCount * size - size / 2;
      dz = Math.round((dz + size / 2) / size * edgeCount) / edgeCount * size - size / 2;
    }
    const height = islandHeight(x + dx, z + dz), relative = height - airport.elevation;
    const color = airport.biome === 'desert' ? desert : height < -.1 ? sand : relative > 120 ? rock : airport.biome === 'alpine' ? alpine : grass;
    const variation = .93 + .07 * Math.sin((x + dx) * .008 + (z + dz) * .006);
    const nx = (islandHeight(x + dx - 2, z + dz) - islandHeight(x + dx + 2, z + dz)) / 4;
    const nz = (islandHeight(x + dx, z + dz - 2) - islandHeight(x + dx, z + dz + 2)) / 4, length = Math.hypot(nx, 1, nz);
    const index = vertices.length / 3;
    vertices.push(dx, height, dz);normals.push(nx / length, 1 / length, nz / length);colors.push(color.r * variation, color.g * variation, color.b * variation);
    return index;
  }
  for (let row = 0; row <= count; row++) for (let column = 0; column <= count; column++) vertex(column / count * size - size / 2, row / count * size - size / 2);
  for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) {
    if (row > 0 && row < count - 1 && column > 0 && column < count - 1) {
      const a = row * (count + 1) + column, b = a + 1, c = a + count + 1;
      indices.push(a, c, b, b, c, c + 1);continue;
    }
    const left = column * step - size / 2, top = row * step - size / 2;
    const corners = [[left, top], [left + step, top], [left + step, top + step], [left, top + step]];
    const boundary = [row === 0, column === count - 1, row === count - 1, column === 0], outline = [];
    for (let edge = 0; edge < 4; edge++) {
      const a = corners[edge], b = corners[(edge + 1) % 4], divisions = boundary[edge] ? edgeCount / count : 1;
      for (let i = 0; i < divisions; i++) outline.push(vertex(a[0] + (b[0] - a[0]) * i / divisions, a[1] + (b[1] - a[1]) * i / divisions));
    }
    const center = vertex(left + step / 2, top + step / 2);
    for (let i = 0; i < outline.length; i++) indices.push(center, outline[(i + 1) % outline.length], outline[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));geometry.setIndex(indices);
  return geometry;
}

export function createAviationTerrain(detail = 'low', distance = 4500, airport = AIRPORTS[0]) {
  const root = new THREE.Group();root.name = 'island-terrain';
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85 });
  const resolution = segments[detail] ?? segments.low;
  for (let z = -12000; z <= 12000; z += 4000) for (let x = -10000; x <= 10000; x += 4000) {
    const lod = new THREE.LOD();lod.position.set(x, 0, z);
    resolution.forEach((count, level) => lod.addLevel(new THREE.Mesh(tileGeometry(x, z, count, resolution[0], airport), material), [0, distance, distance * 2.5][level], .12));
    root.add(lod);
  }
  return root;
}

export function setTerrainDetailDistance(terrain, distance) {
  for (const lod of terrain.children) for (let level = 1; level < lod.levels.length; level++) lod.levels[level].distance = distance * (level === 1 ? 1 : 2.5);
}
