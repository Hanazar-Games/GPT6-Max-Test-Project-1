import { AIRPORT_BUILDINGS, AIRPORT_BOUNDS, RUNWAY } from './airport.js';
import { Euler, Quaternion, Vector3 } from 'three';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
const pose = new Quaternion(), rotation = new Quaternion(), angles = new Euler(0, 0, 0, 'YXZ');
const angular = new Vector3(), forward = new Vector3(), up = new Vector3(), right = new Vector3(), from = new Vector3();
const worldUp = new Vector3(0, 1, 0);
export const AIRCRAFT_PHYSICS_DEFAULTS = Object.freeze({ mode: 'assisted', pitchRate: 1, rollRate: 1, yawRate: 1, response: 1, stability: 1, gravity: 1, thrust: 1, mass: 1, drag: 1, lift: 1, maxSpeed: 1, airBrake: 1, wheelBrake: 1, pitchLimit: 1, bankLimit: 1, flightPath: 1 });
export const AIRCRAFT_PHYSICS_LIMITS = Object.freeze({ pitchRate: [.2, 3], rollRate: [.2, 3], yawRate: [.2, 3], response: [.25, 3], stability: [0, 1], gravity: [.5, 1.5], thrust: [0, 3], mass: [.5, 2], drag: [.25, 2], lift: [.5, 1.75], maxSpeed: [.5, 2], airBrake: [.25, 2], wheelBrake: [.5, 2], pitchLimit: [.4, 1.5], bankLimit: [.4, 1.25], flightPath: [.4, 1.8] });
export const AIRCRAFT_PRESETS = Object.freeze([
  { id: 'standard', name: '恢复标准', physics: {} },
  { id: 'agile', name: '灵活机动', physics: { mode: 'maneuver', pitchRate: 1.65, rollRate: 1.8, yawRate: 1.3, response: 1.5, stability: .12, thrust: 1.1, mass: .85, flightPath: 1.25 } },
  { id: 'power', name: '极速动力', physics: { thrust: 2.2, maxSpeed: 1.4, drag: .75, flightPath: 1.1 } },
  { id: 'cruise', name: '轻松巡航', physics: { thrust: .85, drag: .6, lift: 1.25, response: .8 } },
].map(preset => Object.freeze({ ...preset, physics: Object.freeze({ ...AIRCRAFT_PHYSICS_DEFAULTS, ...preset.physics }) })));

export function setAircraftPhysics(flight, settings = {}) {
  const physics = { ...AIRCRAFT_PHYSICS_DEFAULTS, ...flight.physics, ...settings };
  physics.mode = physics.mode === 'maneuver' ? 'maneuver' : 'assisted';
  for (const key of Object.keys(AIRCRAFT_PHYSICS_LIMITS)) {
    const [low, high] = AIRCRAFT_PHYSICS_LIMITS[key];
    physics[key] = Number.isFinite(physics[key]) ? clamp(physics[key], low, high) : AIRCRAFT_PHYSICS_DEFAULTS[key];
  }
  flight.physics = physics;
  const aircraft = flight.aircraft, liftScale = Math.sqrt(physics.mass * physics.gravity / physics.lift);
  flight.performance = {
    acceleration: aircraft.acceleration * physics.thrust / physics.mass, drag: aircraft.drag * physics.drag / physics.mass,
    stall: aircraft.stall * liftScale, takeoff: aircraft.takeoff * liftScale, landingSpeed: aircraft.landingSpeed * liftScale,
    maxSpeed: aircraft.maxSpeed * physics.maxSpeed, response: aircraft.response * physics.response / physics.mass,
    pitchLimit: aircraft.pitchLimit * physics.pitchLimit, bankLimit: aircraft.bankLimit * physics.bankLimit,
    flightPath: .8 * physics.flightPath / physics.mass, airBrake: 7 * physics.airBrake / physics.mass, wheelBrake: 18 * physics.wheelBrake / physics.mass,
  };
  return physics;
}

export const AIRCRAFT = Object.freeze([
  Object.freeze({ id: 'a380', name: 'Airbus A380', subtitle: '新加坡航空 · 四发远程客机', role: '稳定巡航', length: 72.7, span: 79.8, gearHeight: 8.2, takeoff: 78, stall: 65, flapLimit: 135, maxSpeed: 285, landingSpeed: 105, acceleration: 4.8, drag: .000045, pitchLimit: .38, bankLimit: .8, pitchRate: .22, rollRate: .48, response: 1.7, yawRate: .06, sinkLimit: 7 }),
  Object.freeze({ id: 'su30', name: 'Su-30', subtitle: '双发双座 · 原创低多边形模型', role: '高速机动', length: 21.9, span: 14.7, gearHeight: 2.7, takeoff: 65, stall: 53, flapLimit: 165, maxSpeed: 650, landingSpeed: 135, acceleration: 16, drag: .000036, pitchLimit: .65, bankLimit: 1.18, pitchRate: .85, rollRate: 1.8, response: 2.9, yawRate: .16, sinkLimit: 10 }),
]);

const gatePositions = [[0, 180, -2000], [0, 420, -4600], [2600, 650, -6600], [5600, 650, -3400], [3200, 420, 3600], [0, 180, 3000]];
export const AIR_GATES = Object.freeze(gatePositions.map(([x, y, z], index) => {
  const previous = gatePositions[index - 1] ?? [0, 0, 1000];
  const direction = [x - previous[0], y - previous[1], z - previous[2]];
  const length = Math.hypot(...direction);
  return Object.freeze({ x, y, z, radius: 155, normal: Object.freeze(direction.map(value => value / length)) });
}));

export function islandHeight(x, z) {
  const island = 1 - (x / 8500) ** 2 - (z / 11000) ** 2;
  const coast = clamp(island * 18, -32, 0);
  const hills = Math.max(0, Math.abs(x) - 1500) / 6500;
  const north = clamp((-z - 3000) / 2500, 0, 1);
  return coast + Math.max(0, island) * hills * north * (700 + 450 * Math.sin(x * .0011) * Math.cos(z * .0008));
}

export function createAircraftFlight(id = 'a380', airborne = false, { runwayDirection = '36', physics } = {}) {
  const aircraft = AIRCRAFT.find(item => item.id === id) ?? AIRCRAFT[0];
  const south = runwayDirection === '18';
  const flight = {
    aircraft, status: airborne ? 'running' : 'ready', x: 0, y: airborne ? 420 : aircraft.gearHeight, z: airborne ? RUNWAY.center : south ? RUNWAY.end + 180 : RUNWAY.start - 180,
    heading: south ? Math.PI : 0, pitch: 0, roll: 0, speed: airborne ? (aircraft.id === 'su30' ? 220 : 135) : 0,
    verticalSpeed: 0, throttle: airborne ? .65 : 0, gearDown: !airborne, onGround: !airborne,
    flaps: 0, speedBrake: false, runwayDirection: south ? '18' : '36',
    hasFlown: airborne, stalling: false, elapsed: 0, distance: 0, gates: 0, events: [], reason: '',
    pitchRate: 0, rollRate: 0, yawRate: 0,
  };
  setAircraftPhysics(flight, physics);
  return flight;
}

export function aircraftEnvelope(flight) {
  const performance = flight.performance;
  return { stall: performance.stall * (1 - flight.flaps * .1), takeoff: performance.takeoff * (1 - flight.flaps * .07), landing: performance.landingSpeed, maxSpeed: performance.maxSpeed };
}

export function setAircraftFlaps(flight, level) {
  if (!['ready', 'running', 'paused'].includes(flight.status) || !Number.isInteger(level) || level < 0 || level > 2 || (level > 0 && flight.speed > flight.aircraft.flapLimit)) return false;
  flight.flaps = level;
  return true;
}

export function toggleAircraftSpeedBrake(flight) {
  if (!['running', 'paused'].includes(flight.status)) return false;
  flight.speedBrake = !flight.speedBrake;
  return true;
}

export function toggleAircraftGear(flight) {
  if (!['running', 'paused'].includes(flight.status) || flight.onGround) return false;
  flight.gearDown = !flight.gearDown;
  return true;
}

export function toggleAircraftPause(flight) {
  if (flight.status === 'running') flight.status = 'paused';
  else if (flight.status === 'paused') flight.status = 'running';
}

export function runwayContact(flight, aircraft) {
  const alignment = Math.abs(Math.sin(flight.heading));
  const extentY = Math.abs(Math.sin(flight.roll) * Math.cos(flight.pitch)) * aircraft.span * .42 + Math.abs(Math.sin(flight.pitch)) * aircraft.length * .35 + Math.abs(Math.cos(flight.roll) * Math.cos(flight.pitch)) * aircraft.gearHeight * .45;
  return flight.gearDown && Math.abs(flight.x) < RUNWAY.width / 2 - aircraft.span * .12
    && flight.z > RUNWAY.end && flight.z < RUNWAY.start && alignment < .28
    && Math.abs(flight.roll) < .2 && flight.pitch > -.12 && flight.pitch < .3
    && flight.speed <= flight.performance.landingSpeed && flight.verticalSpeed >= -aircraft.sinkLimit && extentY <= aircraft.gearHeight + .2;
}

export function crossesAirGate(from, to, gate) {
  const before = (from.x - gate.x) * gate.normal[0] + (from.y - gate.y) * gate.normal[1] + (from.z - gate.z) * gate.normal[2];
  const after = (to.x - gate.x) * gate.normal[0] + (to.y - gate.y) * gate.normal[1] + (to.z - gate.z) * gate.normal[2];
  if (before === after || before * after > 0) return false;
  const fraction = before / (before - after);
  if (fraction < 0 || fraction > 1) return false;
  return Math.hypot(from.x + (to.x - from.x) * fraction - gate.x, from.y + (to.y - from.y) * fraction - gate.y, from.z + (to.z - from.z) * fraction - gate.z) < gate.radius - 12;
}

function crash(flight, reason) {
  flight.status = 'crashed';
  flight.reason = reason;
  flight.events.push('crash');
}

function stepFlight(flight, input, dt) {
  const aircraft = flight.aircraft, physics = flight.physics, performance = flight.performance, gravity = 9.81 * physics.gravity;
  from.set(flight.x, flight.y, flight.z);
  flight.elapsed += dt;
  if (flight.flaps && flight.speed > aircraft.flapLimit + 5) { flight.flaps = 0; flight.events.push('flaps-limit'); }
  const stall = performance.stall * (1 - flight.flaps * .1), takeoff = performance.takeoff * (1 - flight.flaps * .07);
  flight.throttle = clamp(flight.throttle + axis(input.throttle) * dt * .3, 0, 1);
  const authority = clamp((flight.speed / stall) ** 2, .03, 1);
  const pitchInput = axis(input.pitch), rollInput = axis(input.roll), yawInput = axis(input.yaw);
  if (flight.onGround) {
    flight.pitch += (pitchInput * performance.pitchLimit - flight.pitch) * (1 - Math.exp(-performance.response * dt));
    flight.pitch = clamp(flight.pitch, -.02, .13); flight.roll = 0;
    flight.pitchRate = 0; flight.rollRate = 0; flight.yawRate = 0;
  } else {
    const maneuver = physics.mode === 'maneuver';
    const pitchLimit = aircraft.pitchRate * physics.pitchRate * authority;
    const rollLimit = aircraft.rollRate * physics.rollRate * authority;
    const pitchTarget = maneuver ? pitchInput * pitchLimit - (1 - Math.abs(pitchInput)) * flight.pitch * physics.stability : (pitchInput * performance.pitchLimit + .018 - flight.pitch) * aircraft.response * (pitchInput ? 1 : physics.stability);
    const rollTarget = maneuver ? rollInput * rollLimit - (1 - Math.abs(rollInput)) * flight.roll * physics.stability : (rollInput * performance.bankLimit - flight.roll) * aircraft.response * 1.5 * (rollInput ? 1 : physics.stability);
    const response = 1 - Math.exp(-performance.response * 3 * dt);
    flight.pitchRate += (clamp(pitchTarget, -pitchLimit, pitchLimit) - flight.pitchRate) * response;
    flight.rollRate += (clamp(rollTarget, -rollLimit, rollLimit) - flight.rollRate) * response;
    flight.yawRate += (yawInput * aircraft.yawRate * physics.yawRate * authority - flight.yawRate) * response;
    pose.setFromEuler(angles.set(flight.pitch, -flight.heading, -flight.roll));
    angular.set(flight.pitchRate, -flight.yawRate, -flight.rollRate);
    const rate = angular.length();
    if (rate > 1e-10) pose.multiply(rotation.setFromAxisAngle(angular.multiplyScalar(1 / rate), rate * dt));
    const turn = gravity * Math.sin(flight.roll) / (Math.max(.35, Math.abs(Math.cos(flight.roll))) * Math.max(flight.speed, 35)) * authority;
    pose.premultiply(rotation.setFromAxisAngle(worldUp, -turn * dt)).normalize();
    angles.setFromQuaternion(pose);
    flight.pitch = angles.x; flight.heading = -angles.y; flight.roll = -angles.z;
  }
  const drag = performance.drag * (flight.gearDown ? 1.55 : 1) * (1 + flight.flaps * .35 + (flight.speedBrake ? .8 * physics.airBrake : 0)) * flight.speed ** 2;
  const braking = flight.onGround ? (input.brake ? performance.wheelBrake : 0) : (input.brake || flight.speedBrake ? performance.airBrake : 0);
  const acceleration = performance.acceleration * flight.throttle - drag - (flight.onGround ? .45 : gravity * Math.sin(flight.pitch)) - braking;
  const ceiling = Math.max(performance.maxSpeed, flight.speed - Math.min(60, Math.max(0, flight.speed - performance.maxSpeed) * 2) * dt);
  const nextSpeed = clamp(flight.speed + acceleration * dt, 0, ceiling);
  const speed = (flight.speed + nextSpeed) * .5;
  flight.speed = nextSpeed;
  if (flight.onGround) {
    flight.heading += (axis(input.yaw) + axis(input.roll) * .75) * .2 * clamp(speed / 25, 0, 1) * dt;
    if (speed >= takeoff && flight.pitch > .045 && !input.brake && !flight.speedBrake) {
      flight.onGround = false;
      flight.verticalSpeed = Math.max(1, speed * Math.sin(flight.pitch) * .4);
      flight.events.push('takeoff');
    }
  }
  flight.heading = Math.atan2(Math.sin(flight.heading), Math.cos(flight.heading));
  const horizontalSpeed = speed * Math.cos(flight.pitch);
  flight.x += Math.sin(flight.heading) * horizontalSpeed * dt;
  flight.z -= Math.cos(flight.heading) * horizontalSpeed * dt;
  if (!flight.onGround) {
    const lift = Math.min(1, (speed / stall) ** 2);
    const verticalAcceleration = (speed * Math.sin(flight.pitch) - flight.verticalSpeed) * performance.flightPath * lift - gravity * (1 - lift * Math.cos(flight.roll) * Math.cos(flight.pitch));
    flight.y += flight.verticalSpeed * dt + .5 * verticalAcceleration * dt ** 2;
    flight.verticalSpeed += verticalAcceleration * dt;
  }
  const surface = Math.max(-12, islandHeight(flight.x, flight.z));
  pose.setFromEuler(angles.set(flight.pitch, -flight.heading, -flight.roll));
  forward.set(0, 0, -1).applyQuaternion(pose); up.set(0, 1, 0).applyQuaternion(pose); right.set(1, 0, 0).applyQuaternion(pose);
  const sideways = aircraft.span * .42, lengthwise = aircraft.length * .35, depth = aircraft.gearHeight * .45;
  const extentY = Math.abs(right.y) * sideways + Math.abs(forward.y) * lengthwise + Math.abs(up.y) * depth;
  const contactHeight = surface + (flight.onGround ? aircraft.gearHeight : Math.max(flight.gearDown ? aircraft.gearHeight : depth, extentY));
  flight.stalling = !flight.onGround && speed < stall;
  if (flight.y > aircraft.gearHeight + 20) flight.hasFlown = true;
  if (Math.abs(flight.x) < AIRPORT_BOUNDS.x && Math.abs(flight.z) < AIRPORT_BOUNDS.z) {
    const extentX = Math.abs(right.x) * sideways + Math.abs(forward.x) * lengthwise + Math.abs(up.x) * depth;
    const extentZ = Math.abs(right.z) * sideways + Math.abs(forward.z) * lengthwise + Math.abs(up.z) * depth;
    for (const building of AIRPORT_BUILDINGS) {
      if (flight.y - extentY < building.height && flight.y + extentY > building.base && Math.abs(flight.x - building.x) < building.width / 2 + extentX && Math.abs(flight.z - building.z) < building.depth / 2 + extentZ) {
        crash(flight, '碰到机场建筑或城市。拉起机头，保持足够净空。');
        return;
      }
    }
  }
  if (flight.y <= contactHeight) {
    flight.y = contactHeight;
    if (!flight.onGround) {
      if (!runwayContact(flight, aircraft)) {
        crash(flight, surface < -1 ? '飞机触水。保持高度后再进近跑道。' : !flight.gearDown ? '起落架未放下。进近时按 G 放轮。' : '着地过重或偏离跑道。降低下降率、速度并摆正机翼。');
        return;
      }
      flight.events.push('touchdown');
      flight.onGround = true;
      flight.verticalSpeed = 0;
    }
    if ((Math.abs(flight.x) > RUNWAY.width / 2 || flight.z < RUNWAY.end || flight.z > RUNWAY.start) && speed > 30) {
      crash(flight, '冲出跑道。保持中线，及时制动或重新起飞。');
      return;
    }
  }
  flight.distance += Math.hypot(flight.x - from.x, flight.y - from.y, flight.z - from.z);
  if (AIR_GATES[flight.gates] && crossesAirGate(from, flight, AIR_GATES[flight.gates])) {
    flight.gates++;
    flight.events.push('gate');
  }
  if (flight.hasFlown && flight.onGround && flight.speed < 2 && flight.throttle < .15 && runwayContact(flight, aircraft)) {
    flight.status = 'completed';
    flight.events.push('completed');
  }
}

export function updateAircraftFlight(flight, input = {}, dt) {
  flight.events.length = 0;
  if (flight.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  let remaining = Math.min(dt, .25);
  while (remaining > 1e-10 && flight.status === 'running') {
    const step = Math.min(remaining, 1 / 120);
    stepFlight(flight, input, step);
    remaining -= step;
  }
}
