import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';

export function makeCraftModel(materials) {
  const body = new THREE.Group(), details = new THREE.Group(), flames = [];
  body.add(details);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#163d54', metalness: 0.35, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05 });
  const add = (geometry, material, position, parent = details) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (size, material, position, parent) => add(new THREE.BoxGeometry(...size), material, position, parent);
  const plate = (points, depth, material, y, parent = details) => {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 3, steps: 1 });
    const mesh = add(geometry, material, [0, y, 0], parent);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  const tube = (points, radius, material, parent = details) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 24, radius, 6, false), material, [0, 0, 0], parent);
  plate([[0, 5.3], [-1.1, 1.5], [-1.55, -2.5], [-0.8, -3.5], [0.8, -3.5], [1.55, -2.5], [1.1, 1.5]], 0.35, materials.dark, -0.35);
  const profile = new THREE.SplineCurve([[0.04, -3.5], [0.95, -3.2], [1.28, -1.8], [1, 1.6], [0.5, 3.9], [0.015, 5.2]].map(p => new THREE.Vector2(...p))).getPoints(48);
  const hull = add(new THREE.LatheGeometry(profile, 24), materials.metal, [0, 0.18, 0], body);
  hull.rotation.x = Math.PI / 2;
  hull.scale.z = 0.42;
  hull.name = 'armored-hull';
  plate([[-0.12, 4.85], [-0.23, 2.1], [0.23, 2.1], [0.12, 4.85]], 0.03, materials.orange, 0.48);
  const cockpit = add(new THREE.SphereGeometry(1, 32, 20), glass, [0, 0.64, 0.5], body);
  cockpit.name = 'cockpit';
  cockpit.scale.set(0.7, 0.64, 1.65);
  for (const z of [-0.55, 1.35]) {
    tube([[-0.58, 0.63, z], [-0.48, 0.98, z], [0, 1.16, z + 0.12], [0.48, 0.98, z], [0.58, 0.63, z]], 0.045, materials.dark);
  }
  tube([[0, 0.71, -1.14], [0, 1.3, 0.45], [0, 0.7, 2.12]], 0.035, materials.metal);
  const variants = {};
  for (const id of ['scout', 'interceptor', 'hauler']) {
    variants[id] = new THREE.Group();
    variants[id].name = `variant-${id}`;
    body.add(variants[id]);
  }
  const engineProfile = [[0.38, -2.6], [0.6, -2.35], [0.72, -1.6], [0.68, 1.4], [0.55, 2.15], [0.43, 2.2]].map(p => new THREE.Vector2(...p));
  const engineGeometry = new THREE.LatheGeometry(engineProfile, 24);
  engineGeometry.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const s = x => side * x;
    plate([[s(0.95), 1.4], [s(3.45), -0.55], [s(3.65), -2.8], [s(1), -2.25]], 0.12, materials.dark, -0.08);
    plate([[s(1.25), 0.9], [s(3.27), -0.8], [s(3.35), -2.5], [s(1.3), -2]], 0.08, materials.orange, 0.1);
    plate([[s(0.9), 2.7], [s(2.75), 1.35], [s(2.5), 0.9], [s(1.25), 1.5]], 0.08, materials.orange, 0.25, variants.scout);
    add(engineGeometry, materials.dark, [s(2.5), 0, -0.55]);
    plate([[s(2.15), 1.05], [s(2.85), 0.85], [s(2.88), -1.4], [s(2.12), -1.55]], 0.12, materials.orange, 0.57);
    for (const z of [1.62, -2.85, -3.07]) add(new THREE.TorusGeometry(z > 0 ? 0.51 : 0.42, 0.07, 8, 24), materials.metal, [s(2.5), 0, z]);
    add(new THREE.CircleGeometry(0.44, 24), materials.dark, [s(2.5), 0, 1.6]);
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * Math.PI * 2;
      const blade = box([0.095, 0.3, 0.035], materials.metal, [s(2.5) + Math.sin(angle) * 0.27, Math.cos(angle) * 0.27, 1.63]);
      blade.rotation.z = -angle + 0.35;
    }
    const core = add(new THREE.SphereGeometry(0.16, 12, 8), materials.metal, [s(2.5), 0, 1.72]);
    core.scale.z = 1.6;
    const nozzle = add(new THREE.CircleGeometry(0.3, 24), materials.cyan, [s(2.5), 0, -3.08]);
    nozzle.rotation.y = Math.PI;
    for (let i = 0; i < 6; i++) box([0.55, 0.065, 0.085], materials.metal, [s(2.5), 0.56, -1.65 - i * 0.17]);
    box([0.08, 0.07, 2.1], materials.cyan, [s(3.12), -0.02, -0.6]);
    const flameGeometry = new THREE.ConeGeometry(0.33, 2.8, 20, 8);
    flameGeometry.translate(0, 1.4, 0);
    const colors = [];
    for (let i = 0; i < flameGeometry.attributes.position.count; i++) {
      const fade = 1 - flameGeometry.attributes.position.getY(i) / 2.8;
      colors.push(fade * 0.3, fade * 0.7, fade);
    }
    flameGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const flame = add(flameGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }), [s(2.5), 0, -3.09], body);
    flame.rotation.x = -Math.PI / 2;
    flame.castShadow = false;
    flames.push(flame);
    const finShape = new THREE.Shape([[0.6, 0], [1.7, 1.4], [2.45, 1.7], [2.9, 0]].map(p => new THREE.Vector2(...p)));
    const finGeometry = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.045, bevelSegments: 2 });
    finGeometry.rotateY(Math.PI / 2);
    const fin = add(finGeometry, materials.orange, [s(1.15), 0.48, 0], variants.interceptor);
    fin.rotation.z = side * -0.24;
    box([0.24, 0.14, 2.3], materials.dark, [s(1.15), 0.5, -1.75], variants.interceptor);
    plate([[s(0.8), -0.7], [s(1.7), -1], [s(1.8), -2.7], [s(0.8), -2.8]], 0.75, materials.dark, 0.45, variants.hauler);
    for (let i = 0; i < 3; i++) box([0.94, 0.1, 0.13], materials.orange, [s(1.28), 1.3, -1.15 - i * 0.6], variants.hauler);
    box([0.18, 0.1, 0.4], materials.glow, [s(1.78), 0.9, -2.4], variants.hauler);
    box([0.12, 0.07, 0.7], materials.cyan, [s(0.75), 0.55, 2.4]);
  }
  for (let i = 0; i < 7; i++) box([1.1 - i * 0.055, 0.065, 0.07], materials.dark, [0, 0.76 - i * 0.023, -1.4 - i * 0.21]);
  const reactor = add(new THREE.TorusGeometry(0.32, 0.045, 8, 24), materials.cyan, [0, 0.64, -2.8]);
  reactor.rotation.x = -Math.PI / 2;
  batchMeshes(details);
  Object.values(variants).forEach(batchMeshes);
  return { body, flames };
}

export function configureCraftModel(body, craft) {
  body.scale.set(...craft.scale);
  for (const id of ['scout', 'interceptor', 'hauler']) body.getObjectByName(`variant-${id}`).visible = craft.id === id;
}
