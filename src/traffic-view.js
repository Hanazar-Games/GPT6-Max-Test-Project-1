import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';
import { TRAFFIC_TYPES, TRAFFIC_ROAD_HEIGHT, trafficAllowed, trafficNear } from './traffic.js';

export function makeTrafficModel(type) {
  const spec = TRAFFIC_TYPES[type], group = new THREE.Group();
  const materials = {
    paint: new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: .35, roughness: .4 }),
    tire: new THREE.MeshStandardMaterial({ color: '#111820', roughness: .9 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9eaab3', metalness: .7, roughness: .35 }),
    glass: new THREE.MeshStandardMaterial({ color: '#163945', metalness: .5, roughness: .16 }),
    front: new THREE.MeshStandardMaterial({ color: '#f6efd2', emissive: '#fff3bd', emissiveIntensity: 1.2 }),
    rear: new THREE.MeshStandardMaterial({ color: '#ba3027', emissive: '#ff392b', emissiveIntensity: .9 }),
  };
  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, materials[material]); mesh.position.set(x, y, z); group.add(mesh); return mesh;
  };
  const box = (size, material, x, y, z) => add(new THREE.BoxGeometry(...size), material, x, y, z);
  const heavy = type === 'truck' || type === 'semi', width = spec.width, front = spec.length / 2;
  const wheelRadius = heavy ? .6 : .4;
  const axles = type === 'semi' ? [7.9, 2.9, 1.5, -5.6, -7.2, -8.5] : type === 'truck' ? [3.5, -2, -3.6] : type === 'van' ? [2.1, -2.1] : [1.55, -1.55];
  box([width * .78, .28, spec.length - .3], 'tire', 0, heavy ? .85 : .5, 0);
  for (const z of axles) for (const side of [-1, 1]) {
    const wheel = add(new THREE.CylinderGeometry(wheelRadius, wheelRadius, .28, 12), 'tire', side * (width / 2 - .12), wheelRadius, z);
    wheel.rotation.z = Math.PI / 2;
    const hub = add(new THREE.CylinderGeometry(wheelRadius * .48, wheelRadius * .48, .3, 10), 'metal', side * (width / 2 - .12), wheelRadius, z);
    hub.rotation.z = Math.PI / 2;
  }
  let cabFront = front, cabLength, cabTop;
  if (type === 'car') {
    box([width, .65, spec.length], 'paint', 0, .85, 0);
    box([width * .84, .75, 2.6], 'paint', 0, 1.425, -.15);
    cabLength = 2.6; cabFront = 1.15; cabTop = 1.8;
    box([width * .73, .5, .05], 'glass', 0, 1.48, cabFront + .03).rotation.x = -.18;
    box([width * .73, .45, .05], 'glass', 0, 1.48, -1.48).rotation.x = .18;
  } else {
    cabLength = heavy ? 3.6 : 2.1; cabTop = heavy ? 3.6 : 2.8;
    const floor = heavy ? .9 : .65;
    box([width, cabTop - floor, cabLength], 'paint', 0, (cabTop + floor) / 2, front - cabLength / 2);
    box([width * .83, heavy ? .9 : .65, .06], 'glass', 0, cabTop - .7, front + .035);
    const rear = -front + .15, end = front - cabLength - (type === 'semi' ? 1.1 : .12);
    const cargoHeight = spec.height - (heavy ? 1.35 : .8), cargoZ = (rear + end) / 2;
    box([width, cargoHeight, end - rear], 'paint', 0, spec.height - cargoHeight / 2, cargoZ);
    box([width + .04, .14, end - rear + .05], 'metal', 0, spec.height - cargoHeight, cargoZ);
    for (let z = rear + .7; z < end - .4; z += heavy ? 1.2 : 1.3) for (const side of [-1, 1]) {
      box([.035, cargoHeight - .12, .055], 'metal', side * (width / 2 + .02), spec.height - cargoHeight / 2, z);
    }
    for (const x of [-width * .25, width * .25]) box([.055, cargoHeight - .2, .055], 'metal', x, spec.height - cargoHeight / 2, rear - .025);
  }
  const cabZ = cabFront - cabLength / 2;
  for (const side of [-1, 1]) {
    box([.06, type === 'car' ? .43 : .7, cabLength * .65], 'glass', side * (width / 2 - (type === 'car' ? .17 : -.025)), cabTop - .6, cabZ);
    box([.18, .25, .26], 'metal', side * (width / 2 + .12), cabTop - .8, cabFront - .65);
    box([.32, .2, .08], 'front', side * width * .32, heavy ? 1.3 : .8, front + .045);
    box([.3, .18, .08], 'rear', side * width * .32, heavy ? 1.3 : .8, -front - .045);
  }
  for (const z of [-front, front]) box([width, .22, .12], 'metal', 0, heavy ? .95 : .55, z);
  if (heavy) {
    box([width * .64, .6, .09], 'tire', 0, 1.9, front + .055);
    for (const y of [1.7, 1.9, 2.1]) box([width * .6, .055, .1], 'metal', 0, y, front + .07);
    for (const side of [-1, 1]) box([.15, 1.5, .15], 'metal', side * (width / 2 - .15), 3.1, front - cabLength);
  }
  batchMeshes(group);
  for (const mesh of group.children) mesh.userData.paint = mesh.material === materials.paint;
  return group;
}

export class TrafficView {
  constructor(world, game) {
    this.world = world;
    this.root = new THREE.Group(); this.root.name = 'road-traffic'; world.scene.add(this.root);
    this.batches = [];
    this.transform = new THREE.Object3D(); this.sphere = new THREE.Sphere(); this.color = new THREE.Color();
    this.lastView = new THREE.Matrix4();
    this.palette = ['#e09242', '#e3e7df', '#60aeb6', '#cb5d52', '#8296ca', '#98ad70'];
    if (!trafficAllowed(game.mission)) return;
    for (const type of Object.keys(TRAFFIC_TYPES)) {
      const model = makeTrafficModel(type), meshes = [];
      for (const part of model.children) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, 24);
        mesh.name = `traffic-${type}-${meshes.length}`; mesh.count = 0;
        if (meshes.length) mesh.instanceMatrix = meshes[0].mesh.instanceMatrix;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = true;
        this.root.add(mesh); meshes.push({ mesh, paint: part.userData.paint });
      }
      this.batches.push({ type, meshes, tints: [] });
    }
  }

  render(game) {
    if (this.lastFleet === game.course.traffic && this.lastTime === game.elapsed && this.lastDistance === game.distance && (!this.world.viewProjection || this.lastView.equals(this.world.viewProjection))) return;
    this.lastFleet = game.course.traffic; this.lastTime = game.elapsed; this.lastDistance = game.distance;
    if (this.world.viewProjection) this.lastView.copy(this.world.viewProjection);
    const vehicles = trafficNear(game.course.traffic, game.elapsed, game.mission.length, game.distance - 60, game.distance + 1100);
    for (const { type, meshes, tints } of this.batches) {
      const transforms = meshes[0].mesh, paint = meshes.find(part => part.paint).mesh;
      let count = 0, colorsChanged = false;
      for (const vehicle of vehicles) {
        if (vehicle.type !== type) continue;
        const frame = this.world.frame(vehicle.distance, vehicle.lane, TRAFFIC_ROAD_HEIGHT);
        this.sphere.center.copy(frame.point).addScaledVector(frame.up, vehicle.height / 2);
        this.sphere.radius = Math.hypot(vehicle.width, vehicle.height, vehicle.length) / 2;
        if (this.world.viewFrustum && !this.world.viewFrustum.intersectsSphere(this.sphere)) continue;
        this.transform.position.copy(frame.point); this.world.orient(this.transform, frame); this.transform.updateMatrix();
        transforms.setMatrixAt(count, this.transform.matrix);
        if (tints[count] !== vehicle.tint) {
          paint.setColorAt(count, this.color.set(this.palette[vehicle.tint]));
          tints[count] = vehicle.tint;
          colorsChanged = true;
        }
        count++;
      }
      if (count) {
        transforms.instanceMatrix.clearUpdateRanges();
        transforms.instanceMatrix.addUpdateRange(0, count * 16);
        transforms.instanceMatrix.needsUpdate = true;
      }
      if (colorsChanged) {
        paint.instanceColor.setUsage(THREE.DynamicDrawUsage);
        paint.instanceColor.clearUpdateRanges();
        paint.instanceColor.addUpdateRange(0, count * 3);
        paint.instanceColor.needsUpdate = true;
      }
      for (const { mesh } of meshes) {
        mesh.count = count; mesh.visible = count > 0;
      }
    }
  }
}
