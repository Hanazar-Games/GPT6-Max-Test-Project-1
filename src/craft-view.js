import * as THREE from 'three';

export function makeCraftModel(materials) {
  const body = new THREE.Group();
  const flames = [];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#123c50', metalness: 0.7, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.08 });
  const add = (geometry, material, position, parent = body) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const box = (size, material, position, parent) => add(new THREE.BoxGeometry(...size), material, position, parent);
  const plate = (points, depth, material, y, parent = body) => {
    const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.1, bevelSegments: 2, steps: 1 });
    const mesh = add(geometry, material, [0, y, 0], parent);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };
  plate([[0, 5.1], [-1.15, 1.5], [-1.6, -2.6], [-0.8, -3.35], [0.8, -3.35], [1.6, -2.6], [1.15, 1.5]], 0.55, materials.dark, -0.32).name = 'keel';
  plate([[0, 4.9], [-0.85, 1.5], [-1.28, -2.3], [1.28, -2.3], [0.85, 1.5]], 0.3, materials.metal, 0.22).name = 'armored-hull';
  plate([[-0.2, 4.5], [-0.22, 1.7], [0.22, 1.7], [0.2, 4.5]], 0.025, materials.orange, 0.61);
  const cockpit = add(new THREE.SphereGeometry(1, 24, 16), glass, [0, 0.69, 0.55]);
  cockpit.name = 'cockpit';
  cockpit.scale.set(0.75, 0.61, 1.76);
  const canopyFrame = box([0.055, 0.045, 3], materials.metal, [0, 1.22, 0.45]);
  canopyFrame.rotation.x = -0.065;
  const variants = {};
  for (const id of ['scout', 'interceptor', 'hauler']) {
    variants[id] = new THREE.Group();
    variants[id].name = `variant-${id}`;
    body.add(variants[id]);
  }
  const engineGeometry = new THREE.CylinderGeometry(0.68, 0.55, 4.6, 12);
  engineGeometry.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const s = x => side * x;
    plate([[s(0.9), 1], [s(3.1), -0.7], [s(3.3), -2.6], [s(1), -2.2]], 0.14, materials.orange, -0.05);
    plate([[s(1), 2.7], [s(2.3), 1.3], [s(1.3), 1.2]], 0.09, materials.orange, 0.25, variants.scout);
    add(engineGeometry, materials.dark, [s(2.5), -0.05, -0.5]);
    box([0.65, 0.18, 3.6], materials.orange, [s(2.5), 0.55, -0.45]);
    box([0.11, 0.12, 2.7], materials.cyan, [s(3.13), -0.03, -0.4]);
    for (let i = 0; i < 5; i++) box([0.68, 0.08, 0.12], materials.metal, [s(2.5), 0.5, -1.1 - i * 0.25]);
    for (const z of [1.82, -2.83]) {
      add(new THREE.TorusGeometry(0.58, 0.12, 8, 20), materials.metal, [s(2.5), -0.05, z]);
      add(new THREE.CircleGeometry(0.46, 20), z < 0 ? materials.cyan : materials.dark, [s(2.5), -0.05, z + (z < 0 ? -0.02 : 0.02)]).rotation.y = z < 0 ? Math.PI : 0;
    }
    const flame = add(new THREE.ConeGeometry(0.42, 2.8, 16), new THREE.MeshBasicMaterial({ color: '#b0f5ff', transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false }), [s(2.5), -0.05, -4.3]);
    flame.rotation.x = -Math.PI / 2;
    flame.castShadow = false;
    flames.push(flame);
    const fin = box([0.12, 1.6, 2.1], materials.orange, [s(1.15), 1, -2], variants.interceptor);
    fin.rotation.z = side * -0.35;
    box([0.7, 0.9, 1.8], materials.dark, [s(1.25), 0.9, -1.6], variants.hauler);
    box([0.75, 0.13, 1.85], materials.orange, [s(1.25), 1.35, -1.6], variants.hauler);
    box([0.16, 0.16, 0.45], materials.glow, [s(1.65), 0.9, -2.25], variants.hauler);
    box([0.2, 0.08, 0.7], materials.cyan, [s(0.8), 0.61, 2.6]);
  }
  for (let i = 0; i < 5; i++) box([1.15, 0.08, 0.1], materials.dark, [0, 0.65, -1.65 - i * 0.18]);
  const reactor = add(new THREE.TorusGeometry(0.45, 0.08, 8, 20), materials.cyan, [0, 0.8, -2.4]);
  reactor.rotation.x = -Math.PI / 2;
  return { body, flames };
}

export function configureCraftModel(body, craft) {
  body.scale.set(...craft.scale);
  for (const id of ['scout', 'interceptor', 'hauler']) body.getObjectByName(`variant-${id}`).visible = craft.id === id;
}
