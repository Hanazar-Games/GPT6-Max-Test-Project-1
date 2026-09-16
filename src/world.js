import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { obstacleLane } from './game.js';
import { EnvironmentView } from './environment-view.js';
import { createRoute, routeFrame, speedFov } from './route.js';
import { makeCraftModel, configureCraftModel } from './craft-view.js';
import { makeMountainRoad, makePlanetScenery } from './planet-view.js';
import { makeReflectionMap, makeSurfaceTexture, terrainElevation } from './surface-view.js';
import { makeSpaceport } from './base-view.js';
import { batchMeshes } from './model-utils.js';

let seed = 4517;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

export class World {
  constructor(container, game) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label', '星球盘山公路三维游戏场景');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.2, 4000);
    this.clock = 0;
    this.quality = 'high';
    this.lastStatus = 'menu';
    this.cameraReady = false;
    this.shake = 0;
    this.loadMission(game);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.38, 0.45, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  clearScene() {
    const resources = new Set();
    if (this.scene.environment) resources.add(this.scene.environment);
    this.scene.environment = null;
    this.terrainGeometry = null;
    this.scene.traverse(object => {
      if (object.geometry) resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
        resources.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      }
      if (object.isLight || object.isInstancedMesh) object.dispose?.();
    });
    resources.forEach(resource => resource.dispose());
    this.scene.clear();
    this.renderer.renderLists.dispose();
  }

  loadMission(game) {
    this.clearScene();
    this.mission = game.mission;
    this.course = game.course;
    seed = this.mission.seed;
    this.clock = 0;
    this.cameraReady = false;
    this.pickups = [];
    this.gates = [];
    this.drones = [];
    this.pads = [];
    this.scene.background = new THREE.Color(this.mission.sky);
    this.scene.fog = new THREE.FogExp2(this.mission.fog, 0.0008);
    this.curve = createRoute(this.mission);
    this.samples = this.curve.getSpacedPoints(600);
    this.materials = {
      metal: new THREE.MeshStandardMaterial({ color: '#b5bec5', metalness: 0.65, roughness: 0.32 }),
      dark: new THREE.MeshStandardMaterial({ color: '#182936', metalness: 0.6, roughness: 0.5 }),
      orange: new THREE.MeshPhysicalMaterial({ color: '#ed703a', metalness: 0.35, roughness: 0.32, clearcoat: 0.65 }),
      glow: new THREE.MeshStandardMaterial({ color: '#ff985c', emissive: '#ff672d', emissiveIntensity: 3 }),
      cyan: new THREE.MeshStandardMaterial({ color: '#a1e9f0', emissive: '#67d7ef', emissiveIntensity: 2 }),
    };
    this.makeLights();
    this.makeSky();
    this.makeTerrain();
    this.makeTrack();
    this.makeRocks();
    makePlanetScenery(this, random);
    this.makeGates();
    this.makePickups();
    this.makePads();
    this.environment = new EnvironmentView(this);
    this.makeBase();
    this.makeCraft();
    this.makeGhosts();
    this.setCraft(game.craft);
    this.makeDust();
    this.makeSpeedLines();
    this.makeEffects();
  }

  frame(distance, lane = 0, height = 0) {
    return routeFrame(this.curve, this.mission.length, distance, lane, height);
  }

  orient(object, frame) {
    object.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(frame.right.clone().negate(), frame.up, frame.tangent));
  }

  place(object, distance, lane = 0, height = 0) {
    const frame = this.frame(distance, lane, height);
    object.position.copy(frame.point);
    this.orient(object, frame);
    this.scene.add(object);
    return object;
  }

  mesh(geometry, material, parent, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    if (parent) parent.add(mesh);
    return mesh;
  }

  box(size, material, parent, position) {
    return this.mesh(new THREE.BoxGeometry(...size), material, parent, position);
  }

  makeLights() {
    this.scene.environment = makeReflectionMap(this.mission.color);
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new THREE.HemisphereLight(new THREE.Color(this.mission.color).lerp(new THREE.Color('#e3f0ff'), 0.65), this.mission.fog, 2.6));
    const sun = new THREE.DirectionalLight(this.mission.difficulty === 2 ? '#ffd8a4' : '#fff0d8', 3.4);
    sun.position.set(-100, 220, 140);
    this.scene.add(sun);
    this.followLight = new THREE.DirectionalLight('#d5ebff', 2);
    this.followLight.castShadow = true;
    this.followLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.followLight.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 150 });
    this.followLight.shadow.bias = -0.001;
    this.scene.add(this.followLight, this.followLight.target);
  }

  makeSky() {
    const stars = new Float32Array(1800 * 3);
    for (let i = 0; i < stars.length; i += 3) {
      const angle = random() * Math.PI * 2;
      const altitude = random() * 0.95 + 0.05;
      const radius = 1100 + random() * 700;
      stars[i] = Math.cos(angle) * radius * Math.sqrt(1 - altitude * altitude);
      stars[i + 1] = altitude * radius;
      stars[i + 2] = Math.sin(angle) * radius * Math.sqrt(1 - altitude * altitude);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d5edff', size: 1.2, sizeAttenuation: true, fog: false })));

    const planet = this.mesh(new THREE.SphereGeometry(95, 48, 32), new THREE.ShaderMaterial({
      uniforms: { sea: { value: new THREE.Color(this.mission.fog) }, landColor: { value: new THREE.Color().setHSL(this.mission.ground, this.mission.saturation + 0.15, 0.38) }, cloudColor: { value: new THREE.Color(this.mission.color).lerp(new THREE.Color('#ffffff'), 0.8) } },
      vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
        void main() { vNormal = normalize(normalMatrix * normal); vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 sea; uniform vec3 landColor; uniform vec3 cloudColor; varying vec3 vNormal; varying vec3 vPosition;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p) { return noise(p) * 0.55 + noise(p * 2.07) * 0.27 + noise(p * 4.13) * 0.13 + noise(p * 8.27) * 0.05; }
        void main() { vec3 p = vPosition * 0.047;
          float land = smoothstep(0.47, 0.55, fbm(p));
          vec3 color = mix(sea, landColor, land);
          float cloud = smoothstep(0.47, 0.68, fbm(p * 2.7 + vec3(12.0, 7.0, 3.0)));
          color = mix(color, cloudColor, cloud * 0.9);
          float light = max(dot(normalize(vNormal), normalize(vec3(-0.7, 0.5, 0.7))), 0.04);
          float rim = pow(1.0 - max(vNormal.z, 0.0), 3.0);
          gl_FragColor = vec4(color * light + vec3(0.12, 0.46, 0.65) * rim * 0.55, 1.0); }`,
    }), this.scene);
    const origin = this.frame(0);
    planet.position.copy(origin.point).addScaledVector(origin.tangent, 850).addScaledVector(origin.right, 330);
    planet.position.y += 340;
    planet.rotation.z = 0.25;
    const atmosphere = this.mesh(new THREE.SphereGeometry(99, 40, 24), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n; void main() { n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 n; void main() { float a = pow(1.0 - abs(n.z), 3.0); gl_FragColor = vec4(0.2, 0.6, 0.9, a * 0.4); }',
    }), this.scene);
    atmosphere.position.copy(planet.position);
    if (['sandstone', 'spires', 'storm'].includes(this.mission.biome)) {
      const rings = this.mesh(new THREE.RingGeometry(125, 186, 96), new THREE.MeshBasicMaterial({ color: this.mission.color, side: THREE.DoubleSide, transparent: true, opacity: 0.4, depthWrite: false, fog: false }), this.scene);
      rings.position.copy(planet.position);
      rings.rotation.set(1.2, 0.3, 0.4);
    }
  }

  groundInfo(x, z) {
    let nearest = Infinity;
    let y = 0;
    let low = Infinity;
    for (let i = 0; i < this.samples.length - 1; i++) {
      const p = this.samples[i], q = this.samples[i + 1];
      const dx = q.x - p.x, dz = q.z - p.z;
      const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (z - p.z) * dz) / (dx * dx + dz * dz)));
      const d = (p.x + dx * t - x) ** 2 + (p.z + dz * t - z) ** 2;
      const level = p.y + (q.y - p.y) * t;
      if (d < nearest) { nearest = d; y = level; }
      if (d < 42 * 42) low = Math.min(low, level);
    }
    const distance = Math.sqrt(nearest);
    const blend = THREE.MathUtils.smoothstep(distance, 36, 145);
    const wave = Math.sin(x * 0.01 + Math.cos(z * 0.013) * 2) * Math.cos(z * 0.016) * 35;
    const peaks = Math.max(0, Math.sin(x * 0.009 - z * 0.007)) ** 3 * 160;
    const surface = this.terrainGeometry ? terrainElevation(this.terrainGeometry, x, z) : null;
    return { y: surface ?? Math.min(y, low) - 7 + blend * (wave + peaks - 24), distance };
  }

  makeTerrain() {
    this.routeBounds = new THREE.Box3().setFromPoints(this.samples);
    const bounds = this.routeBounds.clone().expandByScalar(400);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const geometry = new THREE.PlaneGeometry(size.x, size.z, 200, 200);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(center.x, 0, center.z);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, this.groundInfo(positions.getX(i), positions.getZ(i)).y);
    }
    geometry.computeVertexNormals();
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const color = new THREE.Color();
    const pale = ['ice', 'salt', 'aurora'].includes(this.mission.biome);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const strata = Math.sin(y * 0.12 + Math.sin(x * 0.009) + Math.cos(z * 0.012)) * 0.025;
      const slope = 1 - Math.abs(geometry.attributes.normal.getY(i));
      color.setHSL(this.mission.ground + strata * 0.3, this.mission.saturation * (1 - slope * 0.35), (pale ? 0.56 : this.mission.biome === 'dunes' ? 0.4 : 0.25) + strata - slope * 0.07);
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const texture = makeSurfaceTexture();
    texture.repeat.set(size.x / 30, size.z / 30);
    const terrain = this.mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: texture, roughness: pale ? 0.65 : 0.95, metalness: 0.02 }), this.scene);
    terrain.name = 'planet-terrain';
    terrain.receiveShadow = true;
    geometry.computeBoundingBox();
    this.terrainGeometry = geometry;
  }

  makeTrack() {
    makeMountainRoad(this);
  }

  makeRocks() {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(this.mission.ground, this.mission.saturation * 0.6, 0.34), flatShading: true });
    const rocks = new THREE.InstancedMesh(geometry, material, 390);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 390; i++) {
      const size = 0.6 + random() ** 2 * 13;
      let p;
      let ground;
      for (let attempt = 0; attempt < 20; attempt++) {
        p = this.frame(random() * this.mission.length, (random() < 0.5 ? -1 : 1) * (24 + size * 2 + random() * 130)).point;
        ground = this.groundInfo(p.x, p.z);
        if (ground.distance > 22 + size * 2) break;
      }
      if (ground.distance <= 22 + size * 2) {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        rocks.setMatrixAt(i, dummy.matrix);
        continue;
      }
      dummy.position.set(p.x, ground.y + size * 0.2, p.z);
      dummy.rotation.set(random() * 3, random() * 6, random() * 2);
      dummy.scale.set(size * (1 + random()), size, size * (1 + random()));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(rocks);
    for (const obstacle of this.course.obstacles) {
      if (obstacle.kind === 'drone') {
        const drone = new THREE.Group();
        this.box([3.6, 1.2, 2.5], this.materials.dark, drone, [0, 2, 0]).castShadow = true;
        this.box([3.1, 0.3, 0.15], this.materials.glow, drone, [0, 2.1, -1.3]);
        for (const side of [-1, 1]) {
          const fan = this.mesh(new THREE.TorusGeometry(1.1, 0.16, 6, 16), this.materials.metal, drone, [side * 2.4, 2, 0]);
          fan.rotation.x = Math.PI / 2;
          this.box([1.5, 0.1, 0.12], this.materials.cyan, drone, [side * 2.4, 2, 0]);
        }
        this.place(drone, obstacle.distance, obstacleLane(obstacle, 0));
        this.drones.push({ group: drone, obstacle });
        continue;
      }
      const rock = new THREE.Group();
      const body = this.mesh(new THREE.IcosahedronGeometry(obstacle.radius, 0), material, rock, [0, 1.3, 0]);
      body.rotation.set(0.2, obstacle.id, 0.3);
      body.scale.set(1, 0.9, 1.05);
      body.castShadow = true;
      const hazard = this.mesh(new THREE.TorusGeometry(3.6, 0.07, 4, 28), this.materials.glow, rock, [0, 0, 0]);
      hazard.rotation.x = Math.PI / 2;
      this.place(rock, obstacle.distance, obstacle.lane);
    }
  }

  makeGates() {
    for (const gate of this.course.gates) {
      const group = new THREE.Group();
      const light = this.materials.glow.clone();
      for (const side of [-1, 1]) {
        this.box([2, 13, 2.5], this.materials.dark, group, [side * 12, 5.9, 0]).castShadow = true;
        this.box([0.35, 10.5, 0.45], light, group, [side * 10.9, 5.8, -1.2]);
        this.box([4, 0.8, 4], this.materials.metal, group, [side * 12, 0, 0]);
      }
      this.box([26, 1.4, 2.5], this.materials.dark, group, [0, 12.1, 0]).castShadow = true;
      this.box([22, 0.3, 0.5], light, group, [0, 11.3, -1.1]);
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#152431'; ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = '#ffb581'; ctx.font = 'bold 38px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`SECTOR 0${gate.id + 1}`, 128, 46);
      const sign = this.mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide }), group, [0, 13, -1.3]);
      sign.rotation.y = Math.PI;
      group.scale.x = (gate.width + 1.5) / 12;
      batchMeshes(group);
      this.place(group, gate.distance, gate.lane);
      this.gates.push({ group, light });
    }
  }

  makePickups() {
    for (const pickup of this.course.pickups) {
      const group = new THREE.Group();
      const core = this.mesh(new THREE.OctahedronGeometry(1.25), this.materials.cyan, group, [0, 2.6, 0]);
      const ring = this.mesh(new THREE.TorusGeometry(2, 0.04, 4, 32), this.materials.cyan, group, [0, 2.6, 0]);
      ring.rotation.x = 0.4;
      const base = this.mesh(new THREE.RingGeometry(1.2, 2.1, 24), new THREE.MeshBasicMaterial({ color: '#67dcef', transparent: true, opacity: 0.25, side: THREE.DoubleSide }), group, [0, 0.03, 0]);
      base.rotation.x = -Math.PI / 2;
      this.place(group, pickup.distance, pickup.lane);
      this.pickups.push({ group, core, ring });
    }
  }

  makePads() {
    for (const pad of this.course.pads) {
      const group = new THREE.Group();
      const light = new THREE.MeshBasicMaterial({ color: '#78ecae' });
      this.box([8, 0.12, 10], this.materials.dark, group, [0, -0.08, 0]);
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          const arrow = this.box([0.24, 0.06, 2.4], light, group, [side * 0.9, 0.04, -3 + i * 2.6]);
          arrow.rotation.y = side * -0.8;
        }
      }
      for (const side of [-1, 1]) this.box([0.18, 0.08, 10], light, group, [side * 3.7, 0.04, 0]);
      this.place(group, pad.distance, pad.lane);
      this.pads.push({ group, light, id: pad.id });
    }
  }

  makeBase() {
    makeSpaceport(this);
  }

  makeCraft() {
    this.craft = new THREE.Group();
    const model = makeCraftModel(this.materials);
    this.craftBody = model.body;
    this.flames = model.flames;
    this.craft.add(this.craftBody);
    this.magnetRing = this.mesh(new THREE.TorusGeometry(1, 0.012, 4, 48), new THREE.MeshBasicMaterial({ color: '#94ebc6', transparent: true, opacity: 0.35, depthWrite: false }), this.craft, [0, -0.5, 0]);
    this.magnetRing.rotation.x = Math.PI / 2;
    this.magnetRing.visible = false;
    this.engineLight = new THREE.PointLight('#67dafb', 15, 12, 2);
    this.engineLight.position.set(0, 0, -1.5);
    this.craft.add(this.engineLight);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 64;
    const ctx = shadowCanvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    this.shadow = this.mesh(new THREE.PlaneGeometry(11, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }), this.scene);
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.craft);
  }

  setCraft(craft) {
    this.materials.orange.color.set(craft.color);
    configureCraftModel(this.craftBody, craft);
    for (const ghost of this.ghosts) {
      configureCraftModel(ghost.body, craft);
    }
  }

  makeGhosts() {
    const ringGeometry = new THREE.TorusGeometry(4.1, 0.045, 4, 40);
    this.ghosts = Array.from({ length: 3 }, () => {
      const group = new THREE.Group();
      const body = this.craftBody.clone();
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false });
      body.traverse(object => {
        if (!object.isMesh) return;
        object.material = material;
        object.castShadow = false;
        object.receiveShadow = false;
      });
      group.add(body);
      const ring = this.mesh(ringGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false }), group, [0, 0.7, 0]);
      ring.rotation.x = Math.PI / 2;
      group.visible = false;
      this.scene.add(group);
      return { group, body, material, ring };
    });
  }

  makeEffects() {
    this.sparks = [];
    this.effectPositions = new Float32Array(72 * 3);
    this.effectPositions.fill(10000);
    this.effectColors = new Float32Array(72 * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.effectPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.effectColors, 3));
    this.effects = new THREE.Points(geometry, new THREE.PointsMaterial({ vertexColors: true, size: 0.3, transparent: true, opacity: 0.9, depthWrite: false }));
    this.effects.frustumCulled = false;
    this.scene.add(this.effects);
  }

  event(event, game) {
    if (event.type === 'impact') this.shake = 0.65;
    if (!['pickup', 'impact', 'jump', 'gate', 'dodge', 'meteor-strike', 'meteor-dodge', 'glide'].includes(event.type)) return;
    const strike = event.type === 'meteor-strike';
    const color = new THREE.Color(event.type === 'impact' || strike ? '#ff925e' : event.type === 'glide' ? '#c6acff' : event.type === 'gate' ? '#8cf2bd' : '#89e8ff');
    const origin = strike ? this.frame(event.distance, event.lane, 0.5).point : this.frame(game.distance, game.lane, 2 + game.height).point;
    for (let i = 0; i < (strike ? 28 : 12); i++) {
      if (this.sparks.length >= 72) this.sparks.shift();
      this.sparks.push({ position: origin.clone(), velocity: new THREE.Vector3((random() - 0.5) * 12, random() * 6, (random() - 0.5) * 12), life: 0.65, color });
    }
  }

  makeDust() {
    const geometry = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(180 * 3);
    for (let i = 0; i < this.dustPositions.length; i++) this.dustPositions[i] = (random() - 0.5) * 80;
    geometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#d5edf2', size: 0.12, transparent: true, opacity: 0.4, depthWrite: false }));
    this.scene.add(this.dust);
  }

  makeSpeedLines() {
    this.speedParticles = Array.from({ length: 48 }, () => ({ angle: random() * Math.PI * 2, radius: 8 + random() * 15, z: -10 - random() * 110 }));
    this.speedVertices = new Float32Array(48 * 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.speedVertices, 3));
    this.speedLines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#bbeaff', transparent: true, opacity: 0, depthWrite: false }));
    this.speedLines.frustumCulled = false;
    this.scene.add(this.speedLines);
  }

  setQuality(quality) {
    this.quality = quality;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 1.5 : 0.75));
    this.renderer.shadowMap.enabled = quality === 'high';
    this.bloom.enabled = quality === 'high';
    this.resize();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(innerWidth, innerHeight);
  }

  render(game, dt, projections = []) {
    const animated = ['menu', 'running', 'countdown'].includes(game.status);
    if (animated) this.clock += dt;
    const motionTime = game.status === 'menu' ? this.clock : game.elapsed;
    this.environment.render(game.status === 'menu' ? 0 : game.elapsed);
    const menu = game.status === 'menu';
    const frame = this.frame(game.distance, game.lane, 1.9 + game.height);
    const { point, tangent, right } = frame;
    this.craft.position.copy(point);
    this.orient(this.craft, frame);
    this.craftBody.position.y = Math.sin(this.clock * 3.5) * 0.13;
    this.magnetRing.visible = game.craft.pickupRange > 3.7 && game.height < 2.3;
    this.magnetRing.scale.setScalar(game.craft.pickupRange);
    this.magnetRing.material.opacity = 0.25 + Math.sin(this.clock * 2) * 0.08;
    this.craftBody.rotation.z = THREE.MathUtils.lerp(this.craftBody.rotation.z, game.lateralSpeed * 0.009, Math.min(1, dt * 7));
    this.craftBody.rotation.x = -game.speed * 0.0004 + game.verticalSpeed * 0.013;
    this.craft.visible = game.immunity <= 0 || Math.sin(this.clock * 35) > -0.6;
    for (let index = 0; index < this.ghosts.length; index++) {
      const ghost = this.ghosts[index];
      const projection = projections[index];
      ghost.group.visible = !!projection && ['running', 'countdown', 'paused'].includes(game.status);
      if (!ghost.group.visible) continue;
      const { pose, color } = projection;
      const ghostFrame = this.frame(pose.distance, pose.lane, 1.9 + pose.height);
      ghost.group.position.copy(ghostFrame.point);
      this.orient(ghost.group, ghostFrame);
      ghost.body.rotation.z = pose.lateralSpeed * 0.009;
      ghost.body.rotation.x = -pose.speed * 0.0004;
      ghost.material.color.set(color);
      ghost.ring.material.color.set(color);
      const separation = ghost.group.position.distanceTo(point);
      ghost.material.opacity = THREE.MathUtils.lerp(0.09, 0.32, Math.min(1, separation / 10));
      ghost.ring.material.opacity = THREE.MathUtils.lerp(0.1, 0.7, Math.min(1, separation / 12));
    }
    const groundFrame = this.frame(game.distance, game.lane, -0.25);
    this.shadow.position.copy(groundFrame.point);
    this.orient(this.shadow, groundFrame);
    this.shadow.rotateX(-Math.PI / 2);
    this.shadow.scale.setScalar(1 + game.height * 0.08);
    this.shadow.material.opacity = 1 - game.height * 0.1;
    for (const flame of this.flames) {
      const power = 0.35 + game.speed * 0.009 + (game.boosting ? 0.6 : 0);
      flame.scale.set(1, power * (0.9 + Math.sin(this.clock * 47) * 0.1), 1);
    }
    this.engineLight.intensity = game.boosting ? 35 : 12;
    for (const drone of this.drones) {
      const frame = this.frame(drone.obstacle.distance, obstacleLane(drone.obstacle, motionTime));
      drone.group.position.copy(frame.point);
      this.orient(drone.group, frame);
      drone.group.rotateZ(Math.cos(motionTime * drone.obstacle.frequency + drone.obstacle.phase) * -0.12);
    }
    for (const pad of this.pads) pad.light.color.set(game.activatedPads.has(pad.id) ? '#3b6353' : '#78ecae');
    if (animated) {
      this.sparks = this.sparks.filter(spark => (spark.life -= dt) > 0);
      this.effectPositions.fill(10000);
      this.sparks.forEach((spark, index) => {
        spark.velocity.y -= dt * 5;
        spark.position.addScaledVector(spark.velocity, dt);
        spark.position.toArray(this.effectPositions, index * 3);
        spark.color.toArray(this.effectColors, index * 3);
      });
      this.effects.geometry.attributes.position.needsUpdate = true;
      this.effects.geometry.attributes.color.needsUpdate = true;
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const pickup = this.pickups[i];
      pickup.group.visible = !game.collected.has(i);
      pickup.core.rotation.y = this.clock * 1.1 + i;
      pickup.core.position.y = 2.6 + Math.sin(this.clock * 2 + i) * 0.35;
      pickup.ring.rotation.y = -this.clock * 0.65;
    }
    this.gates.forEach(({ light }, i) => {
      light.emissive.set(i < game.gates ? '#43d9ad' : '#ff672d');
      light.color.set(i < game.gates ? '#8affe0' : '#ff985c');
    });

    const desired = point.clone();
    const look = point.clone();
    if (menu) {
      desired.addScaledVector(tangent, -20).addScaledVector(right, -12);
      desired.y += 9;
      desired.addScaledVector(right, Math.sin(this.clock * 0.09) * 1.5);
      look.addScaledVector(tangent, 12).addScaledVector(right, -8);
      look.y += 3;
    } else {
      desired.copy(this.frame(game.distance - 19 - game.speed * 0.018, game.lane, 2 + game.height).point);
      desired.addScaledVector(right, -game.lateralSpeed * 0.07);
      desired.y += 7;
      look.copy(this.frame(game.distance + 32 + game.speed * 0.065, game.lane * 0.6, 3).point);
    }
    if (this.lastStatus === 'menu' && !menu) this.cameraReady = false;
    this.lastStatus = game.status;
    const fov = menu ? 58 : speedFov(game.speed);
    if (!this.cameraReady) { this.camera.position.copy(desired); this.camera.fov = fov; this.cameraReady = true; }
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * (menu ? 6 : 16 + game.speed * 0.1)));
    this.shake = Math.max(0, this.shake - dt * 2);
    this.camera.position.x += Math.sin(this.clock * 90) * this.shake * 0.25;
    this.camera.position.y += Math.cos(this.clock * 73) * this.shake * 0.2;
    this.camera.lookAt(look);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, animated ? 1 - Math.exp(-dt * 4) : 0);
    this.camera.updateProjectionMatrix();
    const intensity = THREE.MathUtils.clamp((game.speed - 100) / 320, 0, 1);
    this.speedLines.visible = game.status === 'running' && intensity > 0;
    this.speedLines.position.copy(this.camera.position);
    this.speedLines.quaternion.copy(this.camera.quaternion);
    this.speedLines.material.opacity = intensity * 0.28;
    if (this.speedLines.visible) {
      this.speedParticles.forEach((particle, index) => {
        particle.z += game.speed * dt;
        if (particle.z > -4) particle.z -= 116;
        const x = Math.cos(particle.angle) * particle.radius, y = Math.sin(particle.angle) * particle.radius;
        this.speedVertices.set([x, y, particle.z, x, y, particle.z - 1 - intensity * 6], index * 6);
      });
      this.speedLines.geometry.attributes.position.needsUpdate = true;
    }
    this.followLight.position.copy(point).add(new THREE.Vector3(-25, 55, 20));
    this.followLight.target.position.copy(point);
    this.dust.position.copy(point);
    this.dust.material.opacity = game.boosting ? 0.7 : game.speed / game.craft.speed * 0.25;
    this.dust.rotation.y = this.clock * 0.015;
    if (this.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}
