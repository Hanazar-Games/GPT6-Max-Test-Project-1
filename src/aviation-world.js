import * as THREE from 'three';
import { AIR_GATES, AIRPORT_BUILDINGS, RUNWAY, islandHeight } from './aircraft-flight.js';
import { disposeAircraftObject, loadAircraftModel } from './aircraft-models.js';

const UP = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(), offset = new THREE.Vector3(), target = new THREE.Vector3();

export class AviationWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#b6dbe8');
    this.scene.fog = new THREE.Fog('#b6dbe8', 9000, 42000);
    this.camera = new THREE.PerspectiveCamera(57, 1, .6, 65000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#b6dbe8');
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute('aria-label', '海岛机场与飞机的三维画面');
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xdbf1ff, 0x747757, 2.5));
    const sunlight = new THREE.DirectionalLight(0xffe6bd, 3.3);
    sunlight.position.set(-6000, 10000, -8000); this.scene.add(sunlight);
    this.aircraftRoot = new THREE.Group(); this.scene.add(this.aircraftRoot);
    this.cameraMode = 0;
    this.quality = matchMedia('(any-pointer: coarse)').matches ? .75 : 1.25;
    this.buildEnvironment();
    this.resize();
  }

  mesh(geometry, color, position, scale = [1, 1, 1], materialOptions = {}) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: .85, ...materialOptions }));
    mesh.position.set(...position); mesh.scale.set(...scale); this.scene.add(mesh);
    return mesh;
  }

  boxes(color, transforms, materialOptions = {}) {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, ...materialOptions }), transforms.length);
    const dummy = new THREE.Object3D();
    transforms.forEach(([x, y, z, width, height, depth], index) => {
      dummy.position.set(x, y, z); dummy.scale.set(width, height, depth); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.computeBoundingSphere(); this.scene.add(mesh);
    return mesh;
  }

  buildEnvironment() {
    this.water = this.mesh(new THREE.PlaneGeometry(120000, 120000).rotateX(-Math.PI / 2), 0x368fbb, [0, -12, 0], [1, 1, 1], { roughness: .3, metalness: .25 });
    const terrain = new THREE.PlaneGeometry(24000, 28000, 140, 160).rotateX(-Math.PI / 2);
    const positions = terrain.attributes.position, colors = [];
    const sand = new THREE.Color('#bfbd8b'), grass = new THREE.Color('#598567'), rock = new THREE.Color('#6d8176');
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), z = positions.getZ(index), height = islandHeight(x, z);
      positions.setY(index, height);
      const color = height < -.1 ? sand : height > 120 ? rock : grass;
      const variation = .93 + .07 * Math.sin(x * .008 + z * .006);
      colors.push(color.r * variation, color.g * variation, color.b * variation);
    }
    terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrain.computeVertexNormals();
    this.mesh(terrain, 0xffffff, [0, 0, 0], [1, 1, 1], { vertexColors: true });
    this.boxes(0x6d7a72, [[0, .1, -600, 450, .15, 4800]]);
    this.boxes(0x303e49, [[0, .3, -600, RUNWAY.width, .3, 4400], [-170, .25, -550, 32, .25, 4000], [-340, .25, -150, 290, .25, 1300]]);
    const markings = [], lights = [], taxi = [];
    for (let z = -2700; z < 1520; z += 110) markings.push([0, .5, z, 2, .05, 44]);
    for (const x of [-48, 48]) markings.push([x, .5, -600, 1, .05, 4360]);
    for (const end of [-2680, 1480]) for (let x = -35; x <= 35; x += 10) markings.push([x, .51, end, 5, .05, 70]);
    for (let z = -2780; z < 1600; z += 90) for (const x of [-55, 55]) lights.push([x, .8, z, 1.6, 1.2, 1.6]);
    for (let z = -2700; z < 1500; z += 80) taxi.push([-170, .47, z, .7, .05, 24]);
    this.boxes(0xe4e9dd, markings); this.boxes(0x71d3ee, lights, { emissive: 0x3b9dc2, emissiveIntensity: .8 }); this.boxes(0xd8b05b, taxi);
    for (const [number, z, angle] of [['36', 1360, -Math.PI / 2], ['18', -2560, Math.PI / 2]]) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d'); context.fillStyle = '#e3e8dd'; context.font = 'bold 170px monospace'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(number, 128, 132);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(32, 42), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
      sign.position.set(0, .55, z); sign.rotation.set(-Math.PI / 2, 0, angle + Math.PI / 2); this.scene.add(sign);
    }
    this.boxes(0xb3bdba, [[-440, 23, -100, 220, 46, 680], [-340, 12, 310, 220, 24, 70], [400, 24, 600, 180, 48, 190], [400, 24, 900, 180, 48, 190]]);
    this.boxes(0x426c7a, [[-325, 26, -100, 2, 26, 650], [307, 22, 600, 2, 34, 145], [307, 22, 900, 2, 34, 145]], { metalness: .35, roughness: .25 });
    this.boxes(0xdad4bf, [[-240, 45, -700, 20, 90, 20]]);
    this.boxes(0x416b7d, [[-240, 93, -700, 42, 16, 42]], { metalness: .4, roughness: .2 });
    this.boxes(0xd1d4cc, [[-240, 104, -700, 48, 6, 48]]);
    const city = [], glass = [];
    for (const { x, z, height } of AIRPORT_BUILDINGS.slice(5)) {
      city.push([x, height / 2, z, 60, height, 70]);
      glass.push([x + 30.5, height * .55, z, 1, height * .65, 59]);
    }
    this.boxes(0xaabbb9, city); this.boxes(0x507d8d, glass, { metalness: .3, roughness: .25 });
    const trees = [], trunks = [];
    for (let i = 0; i < 230; i++) {
      const angle = i * 2.39996, radius = 1600 + i * 83 % 6000;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (Math.abs(x) < 650 || AIRPORT_BUILDINGS.some(building => Math.abs(x - building.x) < building.width / 2 + 25 && Math.abs(z - building.z) < building.depth / 2 + 25)) continue;
      const y = islandHeight(x, z); if (y < -1) continue;
      const height = 14 + i % 6 * 3; trunks.push([x, y + height * .3, z, 2, height * .6, 2]); trees.push([x, y + height * .8, z, height * .65, height * .85, height * .65]);
    }
    this.boxes(0x756b4c, trunks);
    const foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(.5, 1, 7), new THREE.MeshStandardMaterial({ color: 0x3b7057, roughness: 1 }), trees.length);
    const tree = new THREE.Object3D();
    trees.forEach(([x, y, z, width, height, depth], index) => { tree.position.set(x, y, z); tree.scale.set(width, height, depth); tree.updateMatrix(); foliage.setMatrixAt(index, tree.matrix); });
    foliage.computeBoundingSphere(); this.scene.add(foliage);
    const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), 110);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < clouds.count; i++) {
      const angle = i * 2.39996, radius = 4500 + (i * 137 % 18000);
      dummy.position.set(Math.cos(angle) * radius, 1700 + i % 7 * 290, Math.sin(angle) * radius);
      dummy.scale.set(300 + i % 4 * 100, 90 + i % 3 * 40, 200 + i % 5 * 80);
      dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.computeBoundingSphere(); this.scene.add(clouds);
    this.gateMeshes = AIR_GATES.map((gate, index) => {
      const mesh = this.mesh(new THREE.TorusGeometry(gate.radius, 5, 6, 56), index ? 0xe5cf91 : 0x57e4e3, [gate.x, gate.y, gate.z], [1, 1, 1], { emissive: index ? 0x463b16 : 0x146e72, emissiveIntensity: .5 });
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...gate.normal));
      return mesh;
    });
    this.shadow = this.mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), 0x1e3441, [0, .65, 0], [30, 1, 15], { transparent: true, opacity: .17, depthWrite: false });
    const beaconPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 160, 0)];
    this.beacon = new THREE.Line(new THREE.BufferGeometry().setFromPoints(beaconPoints), new THREE.LineBasicMaterial({ color: 0xa0f9ed, transparent: true, opacity: .65 }));
    this.beacon.position.z = 1100; this.scene.add(this.beacon);
  }

  async setAircraft(aircraft) {
    this.loadController?.abort();
    const controller = new AbortController(); this.loadController = controller;
    if (this.model) { disposeAircraftObject(this.model); this.model = null; }
    const model = await loadAircraftModel(aircraft, controller.signal);
    if (this.disposed || controller !== this.loadController) { disposeAircraftObject(model); return false; }
    this.model = model; this.aircraftRoot.add(model); this.resetCamera = true;
    return true;
  }

  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.resetCamera = true;
  }

  render(flight, dt) {
    const length = flight.aircraft.length;
    this.water.position.set(flight.x, -12, flight.z);
    this.aircraftRoot.position.set(flight.x, flight.y + (flight.onGround ? Math.max(0, Math.sin(flight.pitch)) * length * .12 : 0), flight.z);
    this.aircraftRoot.rotation.set(flight.pitch, -flight.heading, -flight.roll, 'YXZ');
    if (this.model) {
      this.model.visible = this.cameraMode !== 2 || flight.status === 'ready';
      for (const gear of this.model.userData.gear) gear.visible = flight.gearDown;
    }
    this.gateMeshes.forEach((mesh, index) => {
      mesh.visible = index >= flight.gates;
      const active = index === flight.gates;
      mesh.material.color.set(active ? 0x57e4e3 : 0xe5cf91);
      mesh.material.emissive.set(active ? 0x146e72 : 0x463b16);
    });
    const ground = islandHeight(flight.x, flight.z);
    this.shadow.position.set(flight.x, Math.max(-11.8, ground + .7), flight.z);
    this.shadow.scale.set(flight.aircraft.span * .48, 1, length * .35);
    this.shadow.rotation.y = -flight.heading;
    this.shadow.material.opacity = .18 * Math.max(0, 1 - (flight.y - ground) / 400);
    forward.set(Math.sin(flight.heading), 0, -Math.cos(flight.heading));
    target.copy(this.aircraftRoot.position).addScaledVector(forward, length * .12);
    if (flight.status === 'ready') offset.set(length * 1.4, length * .5, -length * 1.1);
    else if (this.cameraMode === 2) offset.copy(forward).multiplyScalar(length * .6).addScaledVector(UP, length * .1);
    else offset.set(length * (this.cameraMode ? .15 : .4), length * (this.cameraMode ? .24 : .52), length * (this.cameraMode ? 1.05 : 1.8)).applyAxisAngle(UP, -flight.heading);
    const desired = this.aircraftRoot.position.clone().add(offset);
    desired.y = Math.max(desired.y, Math.max(-12, islandHeight(desired.x, desired.z)) + 4);
    this.camera.position.lerp(desired, this.resetCamera || this.cameraMode === 2 ? 1 : 1 - Math.exp(-dt * 5));
    if (this.cameraMode === 2 && flight.status !== 'ready') {
      target.copy(this.camera.position).addScaledVector(forward, 150);
      target.y += Math.sin(flight.pitch) * 150;
    }
    this.camera.up.set(0, 1, 0); this.camera.lookAt(target);
    const fov = 55 + Math.min(18, flight.speed / flight.aircraft.maxSpeed * 18);
    if (Math.abs(this.camera.fov - fov) > .1) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    this.resetCamera = false;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true; this.loadController?.abort();
    disposeAircraftObject(this.scene);
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
