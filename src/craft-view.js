import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';
import { CRAFTS } from './missions.js';

export function makeCraftModel(materials) {
  const body = new THREE.Group(), details = new THREE.Group(), flames = [];
  body.add(details);
  const glass = new THREE.MeshPhysicalMaterial({ color: '#163d54', metalness: 0.35, roughness: 0.09, clearcoat: 1, clearcoatRoughness: 0.05 });
  const capacitor = new THREE.MeshStandardMaterial({ color: '#428d8d', emissive: '#62e6d4', emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.3 });
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
  for (const { id } of CRAFTS) {
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
    plate([[s(1.05), 2.2], [s(2.85), 4.4], [s(3.15), 3.8], [s(2.65), -0.9], [s(1.2), -1.6]], 0.16, materials.orange, 0.05, variants.viper);
    const pod = add(new THREE.CapsuleGeometry(0.32, 1.8, 6, 12), materials.metal, [s(3.05), 0.12, 1.1], variants.viper);
    pod.rotation.x = Math.PI / 2;
    for (const z of [2.2, -1.8]) {
      plate([[s(1), z + 0.8], [s(3.9), z + 0.45], [s(4.1), z - 0.25], [s(1.1), z - 0.3]], 0.09, materials.orange, 0.35, variants.skimmer);
      box([0.12, 0.65, 0.7], materials.metal, [s(3.85), 0.7, z], variants.skimmer);
    }
    plate([[s(0.75), 3.3], [s(4.65), -1.8], [s(4.25), -3.15], [s(0.9), -2.7]], 0.16, materials.orange, -0.1, variants.manta);
    tube([[s(1.1), 0.3, 2.6], [s(2.8), 0.4, -0.5], [s(4.15), 0.25, -2.5]], 0.075, materials.cyan, variants.manta);
    plate([[s(1), 1.7], [s(4.35), -2.5], [s(3.2), -3.6], [s(2.1), -2.8], [s(1), -3.35]], 0.14, materials.dark, 0.32, variants.wraith);
    plate([[s(1.4), 0.6], [s(3.95), -2.45], [s(3.3), -2.7]], 0.04, materials.orange, 0.55, variants.wraith);
    tube([[s(0.4), 0.8, -0.8], [s(0.6), 1.5, -2], [s(0.4), 0.7, -3.3]], 0.13, materials.metal, variants.wraith);
    plate([[s(1.3), 1.8], [s(3.6), 1.2], [s(3.8), -2.5], [s(3.2), -3.3], [s(1.2), -2.8]], 0.5, materials.dark, 0.75, variants.bulwark);
    plate([[s(1.65), 1.25], [s(3.25), 0.9], [s(3.35), -2.4], [s(1.6), -2.5]], 0.13, materials.orange, 1.34, variants.bulwark);
    for (let i = 0; i < 4; i++) box([1.5, 0.1, 0.18], materials.metal, [s(2.5), 1.6, 0.45 - i * 0.7], variants.bulwark);
    plate([[s(1.1), 1.1], [s(3.8), 0.1], [s(3.8), -2.5], [s(1.1), -2.3]], 0.2, materials.orange, 0.3, variants.pulse);
    for (let i = 0; i < 3; i++) {
      const cell = add(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 12), capacitor, [s(3.3), 0.6, -0.2 - i * 0.65], variants.pulse);
      cell.rotation.z = Math.PI / 2;
    }
    plate([[s(1.1), 0.6], [s(3.2), 5.1], [s(3.5), 4.7], [s(3.2), -3.4], [s(1.2), -2.4]], 0.12, materials.orange, 0.17, variants.comet);
    tube([[s(3.22), 0.42, 4.45], [s(3.13), 0.42, 1], [s(3), 0.42, -2.5]], 0.05, materials.cyan, variants.comet);
    for (let i = 0; i < 3; i++) {
      const z = 1.8 - i * 1.25;
      plate([[s(1.1), z], [s(4.25 - i * 0.25), z - 1.35], [s(3.95 - i * 0.25), z - 1.9], [s(1.1), z - 0.8]], 0.12, i === 1 ? materials.metal : materials.orange, 0.25 + i * 0.13, variants.owl);
    }
    plate([[s(0.9), 3.1], [s(2.3), 5.2], [s(2.7), 4.9], [s(2.8), -2.6], [s(1.1), -2]], 0.15, materials.orange, 0.3, variants.trident);
    tube([[s(3.6), 0.2, 3.1], [s(3.9), 0.2, -0.4], [s(3.2), 0.2, -2.9]], 0.12, materials.metal, variants.trident);
    for (const z of [1.8, -1.4]) {
      const wing = add(new THREE.SphereGeometry(1, 16, 8), materials.orange, [s(2.7), 0.45, z], variants.dragonfly);
      wing.scale.set(1.65, 0.1, 0.8); wing.rotation.y = side * 0.3;
      box([0.15, 0.12, 0.7], capacitor, [s(4.1), 0.55, z], variants.dragonfly);
    }
    plate([[s(1.05), 1.3], [s(3.7), 0.3], [s(3.55), -2.75], [s(1.2), -2.8]], 0.28, materials.orange, 0.55, variants.nautilus);
    box([0.14, 0.15, 2.3], materials.metal, [s(3.4), 0.98, -1.1], variants.nautilus);
    plate([[s(1.05), 2.7], [s(4.35), -3.2], [s(3.8), -3.4], [s(1.2), -0.8]], 0.1, materials.metal, 0.4, variants.blade);
    plate([[s(1.45), 1.1], [s(3.95), -3], [s(3.55), -2.8]], 0.07, materials.orange, 0.59, variants.blade);
    const cargo = add(new THREE.CapsuleGeometry(0.58, 3.6, 6, 12), materials.orange, [s(3.35), 0.45, -0.2], variants.whale);
    cargo.rotation.x = Math.PI / 2;
    for (const z of [-1.7, 1.3]) {
      const hoop = add(new THREE.TorusGeometry(0.64, 0.09, 6, 16), materials.metal, [s(3.35), 0.45, z], variants.whale);
      hoop.scale.y = 1.05;
    }
    box([0.14, 0.15, 2.5], capacitor, [s(3.35), 1.1, -0.2], variants.whale);
    plate([[s(1.2), 2], [s(3.75), 0.9], [s(3.75), -2.1], [s(2.5), -3.6], [s(1.1), -2.4]], 0.72, materials.dark, 0.55, variants.paladin);
    plate([[s(1.6), 1.2], [s(3.35), 0.6], [s(3.35), -1.8], [s(2.5), -2.9], [s(1.6), -2.1]], 0.2, materials.orange, 1.4, variants.paladin);
    box([0.18, 0.08, 2.9], materials.metal, [s(2.45), 1.7, -0.9], variants.paladin);
    plate([[s(1.05), 2.5], [s(4.3), -0.5], [s(2.4), -3.9], [s(0.9), -1.9]], 0.13, materials.dark, 0.38, variants.specter);
    plate([[s(1.3), 2], [s(4), -0.5], [s(3.65), -0.8], [s(1.3), 1.2]], 0.05, materials.orange, 0.61, variants.specter);
    tube([[s(1.25), 0.6, -1.2], [s(2), 1.4, -2.4], [s(2.4), 0.7, -3.7]], 0.12, materials.metal, variants.specter);
    for (let i = 0; i < 3; i++) {
      const x = s(2 + i * 0.75), z = 0.1 - i * 0.4;
      box([0.68, 0.14, 3.2], materials.orange, [x, 0.5, z], variants.sunbird);
      for (let row = 0; row < 5; row++) box([0.5, 0.035, 0.43], materials.dark, [x, 0.6, z + 1.15 - row * 0.55], variants.sunbird);
    }
    plate([[s(0.95), 1.7], [s(3.6), 4.75], [s(3.15), -2.3], [s(1.4), -3.4]], 0.1, materials.orange, 0.22, variants.nova);
    tube([[s(3.48), 0.43, 4.1], [s(3.1), 0.43, 0], [s(2.5), 0.43, -2.5]], 0.055, materials.cyan, variants.nova);
    box([0.12, 0.07, 0.7], materials.cyan, [s(0.75), 0.55, 2.4]);
    for (const level of [0, 1]) {
      plate([[s(1.05), 2.2 - level], [s(4.1), .4 - level], [s(3.6), -1.5 - level], [s(1.15), -.6 - level]], .1, materials.orange, .25 + level * .6, variants.kestrel);
      const tip = box([.12, .9, 1.1], materials.metal, [s(3.7), .65 + level * .6, -.2 - level], variants.kestrel);
      tip.rotation.z = -side * .4;
    }
    tube([[s(1.1), .3, 2.8], [s(4.5), .5, 1.5], [s(4.4), .5, -2.6], [s(1.1), .3, -3]], .25, materials.orange, variants.albatross);
    plate([[s(1), .8], [s(4.5), .1], [s(4.4), -.5], [s(1.2), -.7]], .12, materials.metal, .3, variants.albatross);
    for (const z of [2, -2]) {
      box([2.2, .22, .3], materials.metal, [s(2.6), .35, z], variants.lynx);
      const duct = add(new THREE.TorusGeometry(.8, .22, 8, 24), materials.orange, [s(3.8), .35, z], variants.lynx);
      duct.rotation.x = Math.PI / 2;
      const lift = add(new THREE.TorusGeometry(.55, .08, 6, 20), materials.cyan, [s(3.8), .4, z], variants.lynx);
      lift.rotation.x = Math.PI / 2;
      box([1.3, .1, .14], materials.dark, [s(3.8), .35, z], variants.lynx);
      box([.14, .1, 1.3], materials.dark, [s(3.8), .35, z], variants.lynx);
    }
    plate([[s(2), 3], [s(4), 2.2], [s(4), -3.2], [s(2), -3.4]], .85, materials.dark, .1, variants.tortoise);
    for (let i = 0; i < 7; i++) {
      box([1.8, .17, .42], materials.orange, [s(3.05), 1.1, 2.1 - i * .75], variants.tortoise);
      box([.12, .7, .22], materials.metal, [s(4), .75, 2.1 - i * .75], variants.tortoise);
    }
    tube([[s(1.2), .5, 1.8], [s(2), 1.8, 1.2], [s(2.2), 1.8, -2.3], [s(1.3), .6, -3]], .14, materials.metal, variants.tortoise);
    plate([[s(.85), .8], [s(3.2), 4.6], [s(3.85), 4.2], [s(2.8), -2.8], [s(1.2), -3.3]], .12, materials.orange, .36, variants.arrow);
    plate([[s(2.9), 3.7], [s(3.5), 4.2], [s(3.05), .1]], .04, materials.cyan, .59, variants.arrow);
    const tail = box([.12, 1.8, 1.6], materials.metal, [s(1.4), 1.2, -2.8], variants.arrow);
    tail.rotation.z = side * -.22;
    for (const y of [.4, 1.05]) {
      box([1.5, .46, 3.6], materials.orange, [s(3.35), y, -.4], variants.atlas);
      for (const z of [-1.8, 1]) box([1.7, .08, .2], materials.dark, [s(3.35), y + .3, z], variants.atlas);
    }
    const cell = add(new THREE.TorusGeometry(.65, .13, 8, 24), capacitor, [s(3.35), 1.65, -.4], variants.atlas);
    cell.rotation.x = Math.PI / 2;
    box([2.7, .2, .45], materials.metal, [s(2.9), .55, .5], variants.osprey);
    const rotor = add(new THREE.TorusGeometry(1.15, .25, 8, 28), materials.orange, [s(4), .6, .5], variants.osprey);
    rotor.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const vane = box([1.8, .1, .18], materials.metal, [s(4), .6, .5], variants.osprey);
      vane.rotation.y = i * Math.PI / 3;
    }
    box([3.2, .7, 1.4], materials.orange, [s(2), .7, 3.1], variants.hammerhead);
    tube([[s(.8), 1.2, 4], [s(3.9), 1.2, 4], [s(4.1), .4, 2.4], [s(2), .1, 1.5]], .18, materials.metal, variants.hammerhead);
    for (let i = 0; i < 3; i++) plate([[s(1.1), 1.6 - i], [s(4 - i * .3), -.7 - i], [s(3.4 - i * .3), -1.4 - i], [s(1.2), -.1 - i]], .09, materials.orange, .3, variants.sailfish);
    const sail = plate([[0, -3], [.12, -3], [.12, 1.3], [0, 1.3]], 1.6, materials.orange, .5, variants.sailfish);
    sail.rotation.z = side * .16;
    for (const z of [-1.7, 1.1]) {
      add(new THREE.SphereGeometry(.72, 12, 10), capacitor, [s(3.5), .5, z], variants.firecrest);
      const collar = add(new THREE.TorusGeometry(.9, .12, 6, 24), materials.orange, [s(3.5), .5, z], variants.firecrest);
      collar.rotation.x = Math.PI / 2;
      box([2, .2, .3], materials.metal, [s(2.8), .2, z], variants.firecrest);
    }
    plate([[s(1), 2], [s(4.9), .4], [s(4.5), -2.6], [s(3.6), -1.8], [s(2.6), -3.1], [s(1.1), -2.2]], .09, materials.orange, .45, variants.bat);
    for (const [x, z] of [[4.8, .4], [4.4, -2.5], [2.6, -3]]) tube([[s(1), .62, 1.7], [s(2.5), .7, .1], [s(x), .6, z]], .07, materials.metal, variants.bat);
    tube([[s(1.4), .45, -2], [s(3.4), .7, -.4], [s(3.5), .9, 2.7], [s(2.4), .7, 5.1]], .22, materials.orange, variants.mantis);
    for (const z of [-.4, 2.7]) add(new THREE.SphereGeometry(.38, 10, 8), materials.metal, [s(3.5), .8, z], variants.mantis);
    plate([[s(2.6), 2.5], [s(2.4), 5.2], [s(1.95), 3.9]], .14, materials.dark, .65, variants.mantis);
    for (const y of [.25, 1.35]) plate([[s(1.1), 1.3], [s(4.35), .3], [s(4.05), -1.45], [s(1.2), -.4]], .09, materials.orange, y, variants.petrel);
    for (const x of [2.2, 3.9]) box([.13, 1.15, .18], materials.metal, [s(x), .85, -.2], variants.petrel);
    for (let i = 0; i < 3; i++) {
      const z = 1.7 - i * 1.65;
      plate([[s(1.2), z + .65], [s(3.65), z + .35], [s(3.8), z - .6], [s(1.3), z - .65]], .38, materials.orange, .65 + i * .12, variants.rhino);
      box([1.8, .13, .2], materials.metal, [s(2.5), 1.17 + i * .12, z], variants.rhino);
    }
    const fan = add(new THREE.TorusGeometry(1.2, .18, 8, 28), materials.orange, [s(3.4), .7, -.2], variants.hummingbird);
    fan.rotation.y = side * .28;
    for (let i = 0; i < 4; i++) {
      const blade = box([2.05, .12, .12], materials.metal, [s(3.4), .7, -.2], variants.hummingbird);
      blade.rotation.z = i * Math.PI / 4;
    }
    box([2.2, .2, .6], materials.dark, [s(2.5), .35, -.1], variants.hummingbird);
    const dome = add(new THREE.SphereGeometry(1.1, 16, 10), capacitor, [s(3.25), .85, -.5], variants.medusa);
    dome.scale.set(1, .62, 1.35);
    const rim = add(new THREE.TorusGeometry(1.1, .09, 6, 28), materials.orange, [s(3.25), .75, -.5], variants.medusa);
    rim.rotation.x = Math.PI / 2; rim.scale.y = 1.35;
    for (let i = 0; i < 3; i++) tube([[s(2.7 + i * .5), .7, -.8], [s(3.2 + i * .4), .4, -2.7], [s(2.4 + i * .55), .1, -4.1]], .065, capacitor, variants.medusa);
  }
  const horn = add(new THREE.ConeGeometry(.42, 1.65, 6), materials.metal, [0, 1, 3.3], variants.rhino);
  horn.rotation.x = .65;
  const medusaCore = add(new THREE.SphereGeometry(.75, 16, 10), capacitor, [0, 1.15, -2], variants.medusa);
  medusaCore.scale.set(1, .7, 1.2);
  const pulseRing = add(new THREE.TorusGeometry(1.18, 0.17, 10, 40), materials.metal, [0, 0.9, -1.8], variants.pulse);
  pulseRing.rotation.x = -Math.PI / 2;
  const pulseCore = add(new THREE.TorusGeometry(0.95, 0.07, 8, 40), capacitor, [0, 0.95, -1.8], variants.pulse);
  pulseCore.rotation.x = -Math.PI / 2;
  plate([[-0.8, -0.9], [-1, -2.8], [0, -3.7], [1, -2.8], [0.8, -0.9]], 0.35, materials.orange, 0.9, variants.bulwark);
  const tail = new THREE.Shape([[0, 0], [1.4, 2.2], [2.4, 2.5], [3.4, 0]].map(p => new THREE.Vector2(...p)));
  const tailGeometry = new THREE.ExtrudeGeometry(tail, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
  tailGeometry.rotateY(Math.PI / 2);
  add(tailGeometry, materials.metal, [-0.07, 0.55, -0.3], variants.comet);
  for (let i = 0; i < 3; i++) {
    const shell = add(new THREE.TorusGeometry(1.1 - i * 0.24, 0.12, 8, 32), i === 1 ? capacitor : materials.metal, [0, 0.85 + i * 0.23, -1.7], variants.nautilus);
    shell.rotation.x = Math.PI / 2;
  }
  for (const [id, height, width] of [['blade', 1.9, 0.13], ['nova', 2.2, 0.28], ['paladin', 1.3, 0.55]]) {
    const spine = add(new THREE.ConeGeometry(width, height, 3), materials.orange, [0, 0.6 + height / 2, -2], variants[id]);
    spine.scale.z = 4;
  }
  for (let i = -2; i <= 2; i++) {
    const vane = box([0.18, 0.15, 1.6], materials.metal, [i * 0.27, 0.82, -2.9], variants.sunbird);
    vane.rotation.y = i * 0.16;
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
  for (const { id } of CRAFTS) body.getObjectByName(`variant-${id}`).visible = craft.id === id;
}
