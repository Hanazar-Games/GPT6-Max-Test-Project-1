import * as THREE from 'three';
import { AIRPORT_BUILDINGS, TAXIWAYS } from './airport.js';
import { batchMeshes } from './model-utils.js';

export function createAirport() {
  const root = new THREE.Group(); root.name = 'island-airport';
  const architecture = new THREE.Group(), pavement = new THREE.Group();
  architecture.name = 'airport-architecture'; pavement.name = 'airport-pavement'; root.add(architecture, pavement);
  const materials = Object.fromEntries(Object.entries({ concrete: 0xc1c8c2, roof: 0xe2e0cb, metal: 0x647b83, glass: 0x355d70, dark: 0x263a45, yellow: 0xe1bd63, white: 0xf1ecdc, asphalt: 0x404f58, line: 0xceb161 }).map(([name, color]) => [name, new THREE.MeshStandardMaterial({ color, roughness: name === 'glass' ? .25 : .8, metalness: name === 'glass' ? .35 : .05 })]));
  const surfaceMaterials = {};
  function box(group, material, x, y, z, width, height, depth) {
    let paint = materials[material];
    if (group === pavement) {
      if (!surfaceMaterials[material]) { const surface = paint.clone(); surface.polygonOffset = true; surface.polygonOffsetFactor = surface.polygonOffsetUnits = material === 'asphalt' ? -1 : -3; surfaceMaterials[material] = surface; }
      paint = surfaceMaterials[material];
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), paint);
    mesh.position.set(x, y, z); group.add(mesh); return mesh;
  }
  function cylinder(material, x, y, z, radius, height, sides = 16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, sides), materials[material]);
    mesh.position.set(x, y, z); architecture.add(mesh); return mesh;
  }
  box(pavement, 'asphalt', -325, .23, -100, 310, .22, 1300);
  box(pavement, 'asphalt', 330, .23, 850, 370, .22, 900);
  box(pavement, 'asphalt', -610, .2, -100, 30, .2, 1150);
  box(pavement, 'asphalt', -790, .2, -100, 280, .2, 700);
  for (const taxiway of TAXIWAYS) {
    box(pavement, 'asphalt', taxiway.x, .29, taxiway.z, taxiway.width, .22, taxiway.depth);
    const horizontal = taxiway.width > taxiway.depth, length = horizontal ? taxiway.width : taxiway.depth;
    for (let d = -length / 2 + 10; d < length / 2; d += 26) box(pavement, 'line', taxiway.x + (horizontal ? d : 0), .45, taxiway.z + (horizontal ? 0 : d), horizontal ? 14 : .65, .03, horizontal ? .65 : 14);
  }
  for (const building of AIRPORT_BUILDINGS) {
    const { kind, x, z, width, depth, height, base } = building;
    if (kind === 'tower') {
      box(architecture, 'concrete', x, 43, z, 20, 86, 20);
      box(architecture, 'dark', x, 87, z, 36, 3, 36);
      box(architecture, 'glass', x, 95, z, 42, 13, 42);
      box(architecture, 'roof', x, 104, z, 48, 5, 48);
      cylinder('metal', x, 110, z, .6, 6, 8);
    } else if (kind === 'jetway') {
      box(architecture, 'metal', x, (height + base) / 2, z, width, height - base, depth);
      box(architecture, 'glass', x, (height + base) / 2 + .4, z - depth / 2 - .03, width - 1, (height - base) * .5, .1);
      box(architecture, 'dark', x, base / 2, z, 1.5, base, 2);
      box(architecture, 'roof', x, height + .15, z, width, .3, depth);
    } else if (kind === 'fuel') {
      for (const dx of [-28, 28]) for (const dz of [-28, 28]) {
        cylinder('white', x + dx, 8, z + dz, 19, 16);
        cylinder('metal', x + dx, 16.4, z + dz, 19.5, .8);
        box(architecture, 'yellow', x + dx, 9, z + dz - 19.1, 12, 2, .3);
      }
    } else {
      box(architecture, kind === 'hangar' ? 'metal' : 'concrete', x, (height - 3) / 2, z, width, height - 3, depth);
      box(architecture, 'roof', x, height - 1.5, z, width, 3, depth);
      if (kind === 'terminal' || kind === 'terminal-wing') {
        box(architecture, 'glass', x + width / 2 + .1, height * .54, z, .2, height * .55, depth - 12);
        for (let dz = -depth / 2 + 12; dz < depth / 2; dz += 25) box(architecture, 'white', x + width / 2 + .3, height * .54, z + dz, .6, height * .57, .9);
        box(architecture, 'white', x + width / 2 + .6, height * .4, z, 1.2, 1, depth - 8);
        for (let dz = -depth / 2 + 30; dz < depth / 2; dz += 65) box(architecture, 'glass', x, height + .15, z + dz, width * .7, .3, 12);
      } else if (kind === 'hangar') {
        box(architecture, 'dark', x - width / 2 - .15, 21, z, .3, 38, depth - 22);
        for (let dz = -70; dz <= 70; dz += 23.3) box(architecture, 'metal', x - width / 2 - .4, 21, z + dz, .6, 38, 1.2);
        box(architecture, 'glass', x - width / 2 - .6, 33, z, .3, 6, depth - 25);
      } else if (kind === 'city') box(architecture, 'glass', x + width / 2 + .1, height * .55, z, .2, height * .65, depth - 11);
    }
  }
  for (const z of [-360, -150, 60, 270]) {
    for (let d = 0; d < 80; d += 12) box(pavement, 'line', -205 - d, .48, z + 65, 7, .04, 1);
    box(pavement, 'white', -264, .49, z + 40, 70, .04, .7);
    box(pavement, 'white', -264, .49, z + 90, 70, .04, .7);
    for (const dx of [-298, -229]) box(pavement, 'white', dx, .49, z + 65, .7, .04, 50);
    cylinder('metal', -320, 16, z + 90, .45, 32, 8);
    box(architecture, 'white', -320, 32, z + 90, 8, 1.5, 2);
  }
  for (let z = -380; z < 200; z += 34) for (const x of [-880, -820, -740]) {
    box(pavement, 'white', x, .34, z, 12, .04, .6);
    box(architecture, 'dark', x, 1, z + 15, 4.4, 2, 8);
    box(architecture, 'glass', x, 2.3, z + 15, 4, .8, 3.5);
  }
  for (const group of [architecture, pavement]) batchMeshes(group);
  return root;
}
