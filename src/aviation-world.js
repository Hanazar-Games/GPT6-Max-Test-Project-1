import * as THREE from 'three';
import { AIR_GATES, islandHeight } from './aircraft-flight.js';
import { AIRPORT_BUILDINGS, RUNWAY } from './airport.js';
import { createAirport } from './airport-view.js';
import { createRunway } from './runway-view.js';
import { cockpitSeat, createAircraftCockpit, updateCockpitControls, drawCockpitDisplay } from './aircraft-cockpit.js';
import { disposeAircraftObject, loadAircraftModel } from './aircraft-models.js';

const UP = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3(), offset = new THREE.Vector3(), target = new THREE.Vector3();
const cockpitLook = new THREE.Quaternion(), lookRotation = new THREE.Euler(0, 0, 0, 'YXZ');

export class AviationWorld {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#b6dbe8');
    this.scene.fog = new THREE.Fog('#b6dbe8', 9000, 42000);
    this.camera = new THREE.PerspectiveCamera(57, 1, 8, 65000);
    this.cockpitCamera = new THREE.PerspectiveCamera(68, 1, .06, 8);
    this.cockpitScene = new THREE.Scene();
    this.cockpitScene.add(new THREE.HemisphereLight(0xdbefff, 0x7b8070, 3));
    const cabinLight = new THREE.DirectionalLight(0xffe6c6, 2);
    cabinLight.position.set(-1, 2, 1); this.cockpitScene.add(cabinLight);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#b6dbe8');
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute('aria-label', '海岛机场与飞机的三维画面');
    container.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xdbf1ff, 0x747757, 2.5));
    const sunlight = new THREE.DirectionalLight(0xffe6bd, 3.3);
    sunlight.position.set(-6000, 10000, -8000); this.scene.add(sunlight);
    this.aircraftRoot = new THREE.Group(); this.scene.add(this.aircraftRoot);
    this.cameraMode = 0;
    this.viewSettings = { cockpitFov: 68, chaseDistance: 1, speedFov: true };
    this.lookTarget = 0; this.lookAngle = 0;
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
    this.boxes(0x6d7a72, [[0, .1, RUNWAY.center, 450, .15, RUNWAY.length + 400]]);
    this.scene.add(createRunway(), createAirport());
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
    this.beacon.position.z = RUNWAY.start - 180; this.scene.add(this.beacon);
  }

  async setAircraft(aircraft) {
    this.loadController?.abort();
    const controller = new AbortController(); this.loadController = controller;
    if (this.model) { disposeAircraftObject(this.model); this.model = null; }
    if (this.cockpit) { disposeAircraftObject(this.cockpit); this.cockpit = null; }
    const model = await loadAircraftModel(aircraft, controller.signal);
    if (this.disposed || controller !== this.loadController) { disposeAircraftObject(model); return false; }
    this.model = model; this.aircraftRoot.add(model); this.resetCamera = true;
    this.cockpitCanvas = document.createElement('canvas'); this.cockpitCanvas.width = aircraft.id === 'a380' ? 1536 : 960; this.cockpitCanvas.height = 320;
    this.cockpitContext = this.cockpitCanvas.getContext('2d');
    this.cockpitTexture = new THREE.CanvasTexture(this.cockpitCanvas); this.cockpitTexture.colorSpace = THREE.SRGBColorSpace;
    this.cockpit = createAircraftCockpit(aircraft, this.cockpitTexture); this.cockpit.visible = false; this.cockpitScene.add(this.cockpit);
    this.displayTime = 1; this.lookAngle = 0; this.lookTarget = 0;
    return true;
  }

  setCameraMode(mode) {
    this.cameraMode = mode; this.resetCamera = true; this.lookTarget = 0; this.lookAngle = 0;
  }

  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.quality));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.cockpitCamera.aspect = width / height; this.cockpitCamera.updateProjectionMatrix();
    this.resetCamera = true;
  }

  render(flight, dt, input = {}, look = null) {
    const length = flight.aircraft.length;
    const view = this.viewSettings;
    const inside = this.cameraMode === 2 && flight.status !== 'ready';
    this.water.position.set(flight.x, -12, flight.z);
    this.aircraftRoot.position.set(flight.x, flight.y + (flight.onGround ? Math.max(0, Math.sin(flight.pitch)) * length * .12 : 0), flight.z);
    this.aircraftRoot.rotation.set(flight.pitch, -flight.heading, -flight.roll, 'YXZ');
    if (this.model) {
      this.model.visible = !inside;
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
    else offset.set(length * (this.cameraMode ? .15 : .4), length * (this.cameraMode ? .24 : .52), length * (this.cameraMode ? 1.05 : 1.8)).multiplyScalar(view.chaseDistance).clampLength(Math.hypot(length, flight.aircraft.span) / 2 + this.camera.near + 2, Infinity).applyAxisAngle(UP, -flight.heading);
    if (this.cockpit) this.cockpit.visible = inside;
    if (inside && this.cockpit) {
      offset.set(...cockpitSeat(flight.aircraft)).applyQuaternion(this.aircraftRoot.quaternion);
      this.cockpit.position.copy(this.aircraftRoot.position).add(offset); this.cockpit.quaternion.copy(this.aircraftRoot.quaternion);
      this.camera.position.copy(this.cockpit.position);
      this.lookAngle += ((look ?? this.lookTarget) - this.lookAngle) * (this.resetCamera ? 1 : 1 - Math.exp(-dt * 9));
      cockpitLook.setFromEuler(lookRotation.set(-.08, this.lookAngle, 0));
      this.camera.quaternion.copy(this.aircraftRoot.quaternion).multiply(cockpitLook);
      updateCockpitControls(this.cockpit, flight, input);
      this.displayTime += dt;
      if (this.displayTime >= .1 || this.resetCamera) { drawCockpitDisplay(this.cockpitContext, flight); this.cockpitTexture.needsUpdate = true; this.displayTime = 0; }
    } else {
      const desired = offset.add(this.aircraftRoot.position);
      desired.y = Math.max(desired.y, Math.max(-12, islandHeight(desired.x, desired.z)) + 4);
      this.camera.position.lerp(desired, this.resetCamera ? 1 : 1 - Math.exp(-dt * 5));
      this.camera.up.set(0, 1, 0); this.camera.lookAt(target);
    }
    const fov = inside ? view.cockpitFov : 55 + (view.speedFov ? Math.min(18, flight.speed / flight.aircraft.maxSpeed * 18) : 0);
    if (Math.abs(this.camera.fov - fov) > .1) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    if (inside && Math.abs(this.cockpitCamera.fov - fov) > .1) { this.cockpitCamera.fov = fov; this.cockpitCamera.updateProjectionMatrix(); }
    this.resetCamera = false;
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    if (inside && this.cockpit) {
      this.cockpitCamera.position.copy(this.camera.position); this.cockpitCamera.quaternion.copy(this.camera.quaternion);
      this.renderer.autoClear = false; this.renderer.clearDepth();
      this.renderer.render(this.cockpitScene, this.cockpitCamera); this.renderer.autoClear = true;
    }
  }

  dispose() {
    this.disposed = true; this.loadController?.abort();
    disposeAircraftObject(this.scene);
    disposeAircraftObject(this.cockpitScene);
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
