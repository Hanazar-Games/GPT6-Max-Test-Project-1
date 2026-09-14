import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { obstacleLane } from './game.js';
import { EnvironmentView } from './environment-view.js';

const UP = new THREE.Vector3(0, 1, 0);
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
    this.renderer.domElement.setAttribute('aria-label', '月球峡谷三维游戏场景');
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.2, 2600);
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
    this.scene.fog = new THREE.FogExp2(this.mission.fog, 0.0016 + this.mission.difficulty * 0.0003);
    this.curve = new THREE.CatmullRomCurve3(this.mission.points.map(point => new THREE.Vector3(...point)), true, 'catmullrom', 0.35);
    this.samples = this.curve.getSpacedPoints(360);
    this.materials = {
      metal: new THREE.MeshStandardMaterial({ color: '#b5bec5', metalness: 0.55, roughness: 0.42, flatShading: true }),
      dark: new THREE.MeshStandardMaterial({ color: '#182936', metalness: 0.6, roughness: 0.5 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ed703a', metalness: 0.3, roughness: 0.42 }),
      glow: new THREE.MeshStandardMaterial({ color: '#ff985c', emissive: '#ff672d', emissiveIntensity: 3 }),
      cyan: new THREE.MeshStandardMaterial({ color: '#a1e9f0', emissive: '#67d7ef', emissiveIntensity: 2 }),
    };
    this.makeLights();
    this.makeSky();
    this.makeTerrain();
    this.makeTrack();
    this.makeRocks();
    this.makeGates();
    this.makePickups();
    this.makePads();
    this.environment = new EnvironmentView(this);
    this.makeBase();
    this.makeCraft();
    this.makeGhosts();
    this.setCraft(game.craft);
    this.makeDust();
    this.makeEffects();
  }

  frame(distance, lane = 0, height = 0) {
    const t = ((distance / this.mission.length) % 1 + 1) % 1;
    const point = this.curve.getPointAt(t);
    const tangent = this.curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, UP).normalize();
    point.addScaledVector(right, lane);
    point.y += height;
    return { point, tangent, right };
  }

  place(object, distance, lane = 0, height = 0) {
    const { point, tangent } = this.frame(distance, lane, height);
    object.position.copy(point);
    object.rotation.y = Math.atan2(tangent.x, tangent.z);
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
    this.scene.add(new THREE.HemisphereLight(this.mission.difficulty === 1 ? '#cfc3f4' : '#c5def3', this.mission.fog, 2.6));
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

    const planet = this.mesh(new THREE.SphereGeometry(70, 64, 48), new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vNormal; varying vec3 vPosition;
        void main() { vNormal = normalize(normalMatrix * normal); vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vNormal; varying vec3 vPosition;
        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float fbm(vec3 p) { return noise(p) * 0.55 + noise(p * 2.07) * 0.27 + noise(p * 4.13) * 0.13 + noise(p * 8.27) * 0.05; }
        void main() { vec3 p = vPosition * 0.047;
          float land = smoothstep(0.47, 0.55, fbm(p));
          vec3 color = mix(vec3(0.035, 0.19, 0.3), vec3(0.24, 0.4, 0.34), land);
          float cloud = smoothstep(0.47, 0.68, fbm(p * 2.7 + vec3(12.0, 7.0, 3.0)));
          color = mix(color, vec3(0.77, 0.87, 0.88), cloud * 0.9);
          float light = max(dot(normalize(vNormal), normalize(vec3(-0.7, 0.5, 0.7))), 0.04);
          float rim = pow(1.0 - max(vNormal.z, 0.0), 3.0);
          gl_FragColor = vec4(color * light + vec3(0.12, 0.46, 0.65) * rim * 0.55, 1.0); }`,
    }), this.scene);
    const origin = this.frame(0);
    planet.position.copy(origin.point).addScaledVector(origin.tangent, 520).addScaledVector(origin.right, 215);
    planet.position.y += 135;
    planet.rotation.z = 0.25;
    const atmosphere = this.mesh(new THREE.SphereGeometry(73, 48, 32), new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 n; void main() { n = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 n; void main() { float a = pow(1.0 - abs(n.z), 3.0); gl_FragColor = vec4(0.2, 0.6, 0.9, a * 0.4); }',
    }), this.scene);
    atmosphere.position.copy(planet.position);
  }

  groundInfo(x, z) {
    let nearest = Infinity;
    let y = 0;
    for (const p of this.samples) {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d < nearest) { nearest = d; y = p.y; }
    }
    const distance = Math.sqrt(nearest);
    const blend = THREE.MathUtils.smoothstep(distance, 24, 100);
    const wave = Math.sin(x * 0.018 + Math.cos(z * 0.017) * 2) * Math.cos(z * 0.023) * 18;
    const detail = Math.sin(x * 0.08) * Math.cos(z * 0.064) * 4;
    const peaks = Math.max(0, Math.sin(x * 0.013 - z * 0.009)) ** 3 * 48;
    return { y: y - 0.7 + blend * (wave + detail + peaks + 9), distance };
  }

  makeTerrain() {
    let geometry = new THREE.PlaneGeometry(1500, 1500, 180, 180);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, this.groundInfo(positions.getX(i), positions.getZ(i)).y);
    }
    geometry = geometry.toNonIndexed();
    geometry.computeVertexNormals();
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    const color = new THREE.Color();
    for (let i = 0; i < colors.length; i += 9) {
      color.setHSL(this.mission.ground + random() * 0.025, 0.10 + random() * 0.08, 0.24 + random() * 0.09);
      for (let j = 0; j < 3; j++) color.toArray(colors, i + j * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const terrain = this.mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), this.scene);
    terrain.receiveShadow = true;
  }

  makeTrack() {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= 600; i++) {
      for (const lane of [-17, 17]) {
        const { point } = this.frame(i / 600 * this.mission.length, lane, -0.38);
        positions.push(...point.toArray());
      }
      if (i < 600) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const track = this.mesh(geometry, new THREE.MeshLambertMaterial({ color: '#3a4852', side: THREE.DoubleSide }), this.scene);
    track.receiveShadow = true;

    for (const lane of [-17.4, 17.4]) {
      const points = Array.from({ length: 401 }, (_, i) => this.frame(i / 400 * this.mission.length, lane, -0.22).point);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: '#83a0ae', transparent: true, opacity: 0.45 }));
      this.scene.add(line);
    }
    const markerGeometry = new THREE.BoxGeometry(0.22, 0.12, 2.1);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: '#9bdce5', emissive: '#5294aa', emissiveIntensity: 0.7 });
    const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 240);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 120; i++) {
      for (let side = 0; side < 2; side++) {
        const { point, tangent } = this.frame(i * this.mission.length / 120, side ? 16.3 : -16.3, -0.1);
        dummy.position.copy(point);
        dummy.rotation.y = Math.atan2(tangent.x, tangent.z);
        dummy.updateMatrix();
        markers.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    this.scene.add(markers);
    for (let i = 0; i < 55; i++) {
      const marker = new THREE.Group();
      this.box([0.2, 1.6, 0.2], this.materials.dark, marker, [0, 0.5, 0]);
      this.box([0.4, 0.25, 0.4], i % 5 === 0 ? this.materials.glow : this.materials.cyan, marker, [0, 1.35, 0]);
      this.place(marker, i / 55 * this.mission.length, i % 2 ? 19 : -19);
    }
  }

  makeRocks() {
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({ color: '#62717a', flatShading: true });
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
        p.set(620, 0, (random() - 0.5) * 800);
        ground = this.groundInfo(p.x, p.z);
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
    const base = new THREE.Group();
    this.box([40, 0.8, 32], this.materials.dark, base, [0, -0.6, 0]);
    for (const x of [-19, 19]) this.box([0.4, 0.12, 30], this.materials.glow, base, [x, 0, 0]);
    this.place(base, 0);
    for (let i = 0; i < 3; i++) {
      const building = new THREE.Group();
      this.box([10, 5, 13], this.materials.metal, building, [0, 2, 0]);
      this.box([10.2, 0.4, 13.2], this.materials.dark, building, [0, 4.7, 0]);
      this.box([8, 0.6, 0.1], this.materials.cyan, building, [0, 3.2, -6.6]);
      this.place(building, 7 + i * 18, -37);
    }
    const tower = new THREE.Group();
    this.box([1, 27, 1], this.materials.metal, tower, [0, 12, 0]);
    this.box([4, 1, 4], this.materials.dark, tower, [0, 24, 0]);
    this.mesh(new THREE.SphereGeometry(0.55, 12, 8), this.materials.glow, tower, [0, 26, 0]);
    const dish = this.mesh(new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), this.materials.metal, tower, [0, 22, 0]);
    dish.rotation.z = 0.8;
    this.place(tower, 45, -40);
  }

  makeCraft() {
    this.craft = new THREE.Group();
    this.craftBody = new THREE.Group();
    this.craft.add(this.craftBody);
    this.magnetRing = this.mesh(new THREE.TorusGeometry(1, 0.012, 4, 48), new THREE.MeshBasicMaterial({ color: '#94ebc6', transparent: true, opacity: 0.35, depthWrite: false }), this.craft, [0, -0.5, 0]);
    this.magnetRing.rotation.x = Math.PI / 2;
    this.magnetRing.visible = false;
    const shape = new THREE.Shape();
    shape.moveTo(0, 4); shape.lineTo(-1.4, 0.4); shape.lineTo(-1.35, -2.4);
    shape.lineTo(1.35, -2.4); shape.lineTo(1.4, 0.4); shape.closePath();
    const hull = this.mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.18, bevelSegments: 1, steps: 1 }), this.materials.metal, this.craftBody);
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.7;
    hull.castShadow = true;
    const cockpit = this.mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#12344c', metalness: 0.85, roughness: 0.14 }), this.craftBody, [0, 0.7, 0.25]);
    cockpit.scale.set(0.85, 0.7, 1.65);
    this.box([0.18, 0.04, 2.5], this.materials.orange, this.craftBody, [0, 0.74, 2.5]);
    this.flames = [];
    for (const side of [-1, 1]) {
      const pod = this.box([0.95, 0.7, 4.6], this.materials.orange, this.craftBody, [side * 2.35, 0, -0.6]);
      pod.castShadow = true;
      this.box([1.6, 0.18, 1.4], this.materials.dark, this.craftBody, [side * 1.4, 0.1, -0.5]);
      this.box([0.7, 0.5, 0.45], this.materials.dark, this.craftBody, [side * 2.35, 0, -2.9]);
      this.box([0.8, 0.12, 2.5], this.materials.cyan, this.craftBody, [side * 2.35, -0.42, -0.6]);
      const flame = this.mesh(new THREE.ConeGeometry(0.3, 2.4, 10), new THREE.MeshBasicMaterial({ color: '#8bedff', transparent: true, opacity: 0.85 }), this.craftBody, [side * 2.35, 0, -4]);
      flame.rotation.x = -Math.PI / 2;
      this.flames.push(flame);
      this.box([0.5, 0.18, 0.25], this.materials.cyan, this.craftBody, [side * 2.35, 0.1, 1.75]);
    }
    this.engineLight = new THREE.PointLight('#67dafb', 15, 12, 2);
    this.engineLight.position.set(0, 0, -1.5);
    this.craft.add(this.engineLight);
    this.cargoRack = new THREE.Group();
    this.cargoRack.name = 'cargo-rack';
    for (const side of [-1, 1]) {
      this.box([0.8, 1.1, 2.2], this.materials.dark, this.cargoRack, [side * 1.2, 0.85, -1.4]);
      this.box([0.83, 0.12, 2.23], this.materials.orange, this.cargoRack, [side * 1.2, 1.25, -1.4]);
    }
    this.craftBody.add(this.cargoRack);
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
    this.craftBody.scale.set(...craft.scale);
    this.cargoRack.visible = craft.id === 'hauler';
    for (const ghost of this.ghosts) {
      ghost.body.scale.set(...craft.scale);
      ghost.body.getObjectByName('cargo-rack').visible = craft.id === 'hauler';
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
    const { point, tangent, right } = this.frame(game.distance, game.lane, 1.9 + game.height);
    this.craft.position.copy(point);
    this.craft.rotation.y = Math.atan2(tangent.x, tangent.z);
    this.craftBody.position.y = Math.sin(this.clock * 3.5) * 0.13;
    this.magnetRing.visible = game.craft.pickupRange > 3.7 && game.height < 2.3;
    this.magnetRing.scale.setScalar(game.craft.pickupRange);
    this.magnetRing.material.opacity = 0.25 + Math.sin(this.clock * 2) * 0.08;
    this.craftBody.rotation.z = THREE.MathUtils.lerp(this.craftBody.rotation.z, game.lateralSpeed * 0.018, Math.min(1, dt * 7));
    this.craftBody.rotation.x = -game.speed * 0.0015 + game.verticalSpeed * 0.013;
    this.craft.visible = game.immunity <= 0 || Math.sin(this.clock * 35) > -0.6;
    for (let index = 0; index < this.ghosts.length; index++) {
      const ghost = this.ghosts[index];
      const projection = projections[index];
      ghost.group.visible = !!projection && ['running', 'countdown', 'paused'].includes(game.status);
      if (!ghost.group.visible) continue;
      const { pose, color } = projection;
      const ghostFrame = this.frame(pose.distance, pose.lane, 1.9 + pose.height);
      ghost.group.position.copy(ghostFrame.point);
      ghost.group.rotation.y = Math.atan2(ghostFrame.tangent.x, ghostFrame.tangent.z);
      ghost.body.rotation.z = pose.lateralSpeed * 0.018;
      ghost.body.rotation.x = -pose.speed * 0.0015;
      ghost.material.color.set(color);
      ghost.ring.material.color.set(color);
      const separation = ghost.group.position.distanceTo(point);
      ghost.material.opacity = THREE.MathUtils.lerp(0.09, 0.32, Math.min(1, separation / 10));
      ghost.ring.material.opacity = THREE.MathUtils.lerp(0.1, 0.7, Math.min(1, separation / 12));
    }
    this.shadow.position.copy(point); this.shadow.position.y -= 2.1 + game.height;
    this.shadow.scale.setScalar(1 + game.height * 0.08);
    this.shadow.material.opacity = 1 - game.height * 0.1;
    this.shadow.rotation.z = -this.craft.rotation.y;
    for (const flame of this.flames) {
      const power = game.boosting ? 2.8 : 0.3 + game.speed * 0.021;
      flame.scale.set(1, power * (0.9 + Math.sin(this.clock * 47) * 0.1), 1);
      flame.position.z = -3 - 1.2 * power;
    }
    this.engineLight.intensity = game.boosting ? 35 : 12;
    for (const drone of this.drones) {
      const frame = this.frame(drone.obstacle.distance, obstacleLane(drone.obstacle, motionTime));
      drone.group.position.copy(frame.point);
      drone.group.rotation.z = Math.cos(motionTime * drone.obstacle.frequency + drone.obstacle.phase) * -0.12;
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
      look.addScaledVector(tangent, 34).addScaledVector(right, -5);
      look.y += 5.5;
    } else {
      desired.addScaledVector(tangent, game.boosting ? -18.5 : -15.5);
      desired.addScaledVector(right, -game.lateralSpeed * 0.07);
      desired.y += 7;
      look.copy(this.frame(game.distance + 28, game.lane * 0.6, 3).point);
    }
    if (this.lastStatus === 'menu' && !menu) this.cameraReady = false;
    this.lastStatus = game.status;
    if (!this.cameraReady) { this.camera.position.copy(desired); this.cameraReady = true; }
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 6));
    this.shake = Math.max(0, this.shake - dt * 2);
    this.camera.position.x += Math.sin(this.clock * 90) * this.shake * 0.25;
    this.camera.position.y += Math.cos(this.clock * 73) * this.shake * 0.2;
    this.camera.lookAt(look);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, menu ? 58 : game.boosting ? 72 : 62, Math.min(1, dt * 3));
    this.camera.updateProjectionMatrix();
    this.followLight.position.copy(point).add(new THREE.Vector3(-25, 55, 20));
    this.followLight.target.position.copy(point);
    this.dust.position.copy(point);
    this.dust.material.opacity = game.boosting ? 0.7 : game.speed / game.craft.speed * 0.25;
    this.dust.rotation.y = this.clock * 0.015;
    if (this.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}
