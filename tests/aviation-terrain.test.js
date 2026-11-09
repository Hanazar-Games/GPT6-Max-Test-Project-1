import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAviationTerrain, setTerrainDetailDistance } from '../src/aviation-terrain.js';
import { islandHeight } from '../src/aircraft-flight.js';
import { createAirport } from '../src/airport-view.js';
import { disposeAircraftObject } from '../src/aircraft-models.js';

test('terrain keeps a continuous island footprint while distant tiles use fewer triangles', () => {
  const terrain = createAviationTerrain(), camera = new THREE.PerspectiveCamera();
  terrain.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(terrain);
  assert.deepEqual([bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z], [-12000, 12000, -14000, 14000]);
  let nearTriangles = 0, farTriangles = 0;
  for (const lod of terrain.children) {
    assert.ok(lod.isLOD && lod.levels.length === 3);
    camera.position.copy(lod.position).add(new THREE.Vector3(0, 100, 0));camera.updateMatrixWorld();lod.update(camera);
    assert.equal(lod.getCurrentLevel(), 0);
    nearTriangles += lod.levels[0].object.geometry.index.count / 3;
    camera.position.y = 30000;camera.updateMatrixWorld();lod.update(camera);
    assert.equal(lod.getCurrentLevel(), 2);
    farTriangles += lod.levels[2].object.geometry.index.count / 3;
    const edges = [];
    for (const { object, hysteresis } of lod.levels) {
      assert.ok(hysteresis > 0, 'avoid oscillation at level boundaries');
      const position = object.geometry.attributes.position;
      const edge = new Map();
      for (let i = 0; i < position.count; i++) {
        const height = islandHeight(position.getX(i) + lod.position.x, position.getZ(i) + lod.position.z);
        const y = position.getY(i);
        assert.ok(Math.abs(y - height) < .001, 'every surface vertex matches terrain physics');
        if (Math.abs(position.getX(i)) === 2000 || Math.abs(position.getZ(i)) === 2000) edge.set(`${position.getX(i)},${position.getZ(i)}`, y);
      }
      edges.push(edge);
    }
    for (const edge of edges) assert.deepEqual(edge, edges[0], 'all detail levels share exactly the same edge to avoid cracks');
  }
  assert.ok(farTriangles < nearTriangles / 5);
  assert.ok(nearTriangles < 44800, 'default ground geometry stays below the original uniform terrain budget');
  disposeAircraftObject(terrain);
});

test('terrain thresholds change without rebuilding geometry and quality changes actual geometry', () => {
  const low = createAviationTerrain(), high = createAviationTerrain('high');
  const geometries = low.children.flatMap(lod => lod.levels.map(level => level.object.geometry));
  const distance = low.children[0].levels[1].distance;
  setTerrainDetailDistance(low, 9000);
  assert.equal(low.children[0].levels[1].distance, distance * 2);
  assert.deepEqual(low.children.flatMap(lod => lod.levels.map(level => level.object.geometry)), geometries);
  assert.ok(high.children[0].levels[0].object.geometry.index.count > geometries[0].index.count * 4);
  const camera = new THREE.PerspectiveCamera(), lod = low.children[0];low.updateMatrixWorld();
  camera.position.copy(lod.position).add(new THREE.Vector3(0, 9200, 0));camera.updateMatrixWorld();lod.update(camera);
  assert.equal(lod.getCurrentLevel(), 1);
  camera.position.y = 8800;camera.updateMatrixWorld();lod.update(camera);
  assert.equal(lod.getCurrentLevel(), 1, 'small camera motion around the threshold must not flicker');
  camera.position.y = 7000;camera.updateMatrixWorld();lod.update(camera);assert.equal(lod.getCurrentLevel(), 0);
  let materialDisposals = 0, geometryDisposals = 0;
  lod.levels[0].object.material.addEventListener('dispose', () => materialDisposals++);
  for (const geometry of geometries) geometry.addEventListener('dispose', () => geometryDisposals++);
  disposeAircraftObject(low);disposeAircraftObject(high);
  assert.equal(materialDisposals, 1);assert.equal(geometryDisposals, geometries.length);
});

test('airport low detail preserves the large building silhouette with less geometry', () => {
  const full = createAirport(), low = createAirport({ lowDetail: true });
  const triangles = root => { let count = 0;root.traverse(mesh => { if (mesh.isMesh) count += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1); });return count; };
  assert.ok(triangles(low) < triangles(full) / 3);
  assert.ok(new THREE.Box3().setFromObject(low).max.y >= 100, 'tower remains identifiable at a distance');
  disposeAircraftObject(full);disposeAircraftObject(low);
});

test('all ground presets share boundary vertices and normals between detail levels and neighboring tiles', () => {
  const boundary = (lod, level, axis, sign) => {
    const { position, normal } = lod.levels[level].object.geometry.attributes, result = new Map();
    for (let i = 0; i < position.count; i++) {
      if ((axis === 'x' ? position.getX(i) : position.getZ(i)) !== sign * 2000) continue;
      const coordinate = axis === 'x' ? position.getZ(i) : position.getX(i);
      result.set(coordinate, [position.getY(i), normal.getX(i), normal.getY(i), normal.getZ(i)]);
    }
    return result;
  };
  for (const detail of ['low', 'balanced', 'high']) {
    const terrain = createAviationTerrain(detail);
    for (const lod of terrain.children) for (const axis of ['x', 'z']) {
      const edge = boundary(lod, 0, axis, 1);
      for (const level of [1, 2]) assert.deepEqual(boundary(lod, level, axis, 1), edge, `${detail}: LOD edge`);
      const neighbor = terrain.children.find(tile => tile.position[axis] === lod.position[axis] + 4000 && tile.position[axis === 'x' ? 'z' : 'x'] === lod.position[axis === 'x' ? 'z' : 'x']);
      if (neighbor) assert.deepEqual(boundary(neighbor, 2, axis, -1), edge, `${detail}: neighboring edge`);
    }
    disposeAircraftObject(terrain);
  }
});
