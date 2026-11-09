import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { writeFile } from 'node:fs/promises';
import { AIRCRAFT } from '../src/aircraft-flight.js';
import { batchMeshes } from '../src/model-utils.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(buffer => { this.result = buffer;this.onloadend?.(); }); }
};

for (const id of ['r220', 'w350']) {
  const spec = AIRCRAFT.find(aircraft => aircraft.id === id), wide = id === 'w350';
  const L = spec.length, S = spec.span, radius = wide ? 2.85 : 1.85;
  const root = new THREE.Group(), body = new THREE.Group(), gear = new THREE.Group();
  root.name = `${spec.name} original airliner`;
  root.userData = { author: 'Lunar Courier project', license: 'CC0-1.0', description: spec.subtitle };
  gear.name = 'landing-gear';root.add(body, gear);
  const palette = { body: 0xe4ebec, accent: wide ? 0x506cac : 0x258c87, glass: 0x152e3b, steel: 0x84969f, dark: 0x17252c, red: 0xd45443, green: 0x5fbf95 };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) => [key, new THREE.MeshStandardMaterial({ color, roughness: key === 'glass' ? .2 : .55, metalness: key === 'steel' ? .7 : .18 })]));
  function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], parent = body) {
    geometry.deleteAttribute('uv');
    const mesh = new THREE.Mesh(geometry, materials[material]);mesh.position.set(...position);mesh.rotation.set(...rotation);parent.add(mesh);return mesh;
  }
  function hull(sections, material, x = 0, y = 0) {
    const vertices = [], indices = [], sides = 20;
    for (const [z, r, offset = 0] of sections) for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2;
      vertices.push(x + Math.cos(angle) * r, y + offset + Math.sin(angle) * r, z);
    }
    for (let ring = 0; ring < sections.length - 1; ring++) for (let side = 0; side < sides; side++) {
      const a = ring * sides + side, b = ring * sides + (side + 1) % sides;
      indices.push(a, b, b + sides, a, b + sides, a + sides);
    }
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));geometry.setIndex(indices);geometry.computeVertexNormals();
    return add(geometry, material);
  }
  function wing(points, y, material = 'body', thickness = .12, bend = 0) {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getY(i) + bend * Math.max(0, (Math.abs(positions.getX(i)) / S - .36) / .14) ** 2);
    geometry.computeVertexNormals();return add(geometry, material, [0, y, 0]);
  }
  hull([[-L / 2, .01], [-L * .465, radius * .4], [-L * .4, radius * .82], [-L * .3, radius], [L * .24, radius], [L * .38, radius * .68, radius * .12], [L * .48, radius * .2, radius * .32], [L / 2, .01, radius * .35]], 'body');
  for (const [start, end] of [[.42, .8], [.85, 1.5], [1.64, 2.29], [2.34, 2.72]]) {
    const vertices = [], indices = [], segments = 8;
    for (const z of [-L * .45, -L * .402]) for (let i = 0; i <= segments; i++) {
      const angle = start + (end - start) * i / segments, r = radius * (.4 + (z / L + .465) / .065 * .42) * 1.018;
      vertices.push(Math.cos(angle) * r, Math.sin(angle) * r, z);
    }
    for (let i = 0; i < segments; i++) indices.push(i, i + 1, i + segments + 2, i, i + segments + 2, i + segments + 1);
    const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));geometry.setIndex(indices);geometry.computeVertexNormals();add(geometry, 'glass');
  }
  for (const sign of [-1, 1]) {
    const wingPoints = [[sign * radius * .7, -L * .12], [sign * S * .38, L * .05], [sign * S / 2, L * .14], [sign * S / 2, L * .18], [sign * S * .38, L * .14], [sign * radius, L * .17]];
    wing(wingPoints, -radius * .25, 'body', radius * .075, wide ? 1.7 : 1.25);
    wing([[sign * S * .36, L * .06], [sign * S / 2, L * .14], [sign * S / 2, L * .18], [sign * S * .37, L * .14]], -radius * .25 + radius * .08, 'accent', .04, wide ? 1.7 : 1.25);
    wing([[sign * radius * .4, L * .33], [sign * S * .19, L * .42], [sign * S * .17, L * .47], [sign * radius * .5, L * .43]], radius * .4, 'body', .1);
    const engineX = sign * S * .205, engineY = -radius * .7, engineZ = -L * .015, engineR = radius * .61, engineLength = L * .12;
    add(new THREE.BoxGeometry(.18, radius * .65, engineLength * .6), 'steel', [engineX, -radius * .36, engineZ + .2]);
    hull([[engineZ - engineLength * .5, engineR * .9], [engineZ - engineLength * .35, engineR], [engineZ + engineLength * .35, engineR * .85], [engineZ + engineLength * .5, engineR * .65]], 'body', engineX, engineY);
    add(new THREE.TorusGeometry(engineR * .8, engineR * .1, 6, 24), 'steel', [engineX, engineY, engineZ - engineLength * .5]);
    add(new THREE.CircleGeometry(engineR * .78, 24), 'dark', [engineX, engineY, engineZ - engineLength * .5 + .025], [0, Math.PI, 0]);
    add(new THREE.CircleGeometry(engineR * .6, 20), 'dark', [engineX, engineY, engineZ + engineLength * .5]);
    add(new THREE.ConeGeometry(engineR * .22, .4, 12), 'steel', [engineX, engineY, engineZ - engineLength * .5], [-Math.PI / 2, 0, 0]);
    for (let blade = 0; blade < 10; blade++) {
      const angle = blade * Math.PI / 5;
      add(new THREE.BoxGeometry(engineR * .09, engineR * .55, .025), 'steel', [engineX - Math.sin(angle) * engineR * .45, engineY + Math.cos(angle) * engineR * .45, engineZ - engineLength * .5 + .01], [0, 0, angle + .25]);
    }
    const windows = wide ? 44 : 26;
    for (let i = 0; i < windows; i++) add(new THREE.PlaneGeometry(.27, .24), 'glass', [sign * (radius * .951 + .025), radius * .3, -L * .27 + i * L * .5 / (windows - 1)], [0, sign * Math.PI / 2, 0]);
    for (const z of [-L * .29, L * .21]) {
      add(new THREE.PlaneGeometry(.68, radius * .8), 'accent', [sign * (radius + .025), -.05, z], [0, sign * Math.PI / 2, 0]);
      add(new THREE.PlaneGeometry(.5, radius * .65), 'body', [sign * (radius + .028), -.05, z], [0, sign * Math.PI / 2, 0]);
    }
    add(new THREE.SphereGeometry(.09, 8, 6), sign < 0 ? 'red' : 'green', [sign * S * .498, -radius * .25 + (wide ? 1.7 : 1.25), L * .16]);
  }
  const finShape = new THREE.Shape([[0, 0], [L * .08, radius * 2.5], [L * .14, radius * 2.4], [L * .2, 0]].map(point => new THREE.Vector2(...point)));
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: .18, bevelEnabled: false });fin.rotateY(-Math.PI / 2);
  add(fin, 'accent', [.09, radius * .6, L * .27]);
  const tire = wide ? .65 : .46;
  for (const [x, z, axles] of [[0, -L * .32, 1], [-radius * 1.18, L * .1, wide ? 3 : 2], [radius * 1.18, L * .1, wide ? 3 : 2]]) {
    const bottom = -spec.gearHeight + tire, top = -radius * .35;
    add(new THREE.CylinderGeometry(.12, .12, top - bottom, 10), 'steel', [x, (top + bottom) / 2, z], [0, 0, 0], gear);
    for (let axle = 0; axle < axles; axle++) for (const side of [-1, 1]) {
      const position = [x + side * tire * .4, bottom, z + (axle - (axles - 1) / 2) * tire * 1.85];
      add(new THREE.CylinderGeometry(tire, tire, tire * .45, 12), 'dark', position, [0, 0, Math.PI / 2], gear);
      add(new THREE.CylinderGeometry(tire * .45, tire * .45, tire * .47, 10), 'steel', position, [0, 0, Math.PI / 2], gear);
    }
  }
  batchMeshes(body);batchMeshes(gear);
  const buffer = await new GLTFExporter().parseAsync(root, { binary: true });
  await writeFile(new URL(`../assets/aircraft/${id}.glb`, import.meta.url), Buffer.from(buffer));
  console.log(`Generated ${id}: ${buffer.byteLength} bytes`);
}
