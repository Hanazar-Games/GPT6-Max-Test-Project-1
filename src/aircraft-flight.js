import { AIRPORT_BUILDINGS, AIRPORT_BOUNDS, RUNWAY } from './airport.js';
import { Euler, Quaternion, Vector3 } from 'three';
import { createAircraftSystems, setSystemSettings, updateAircraftSystems } from './aircraft-systems.js';
import { bankLoad, aircraftAirflow } from './aircraft-envelope.js';
export { aircraftEnvelope } from './aircraft-envelope.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
const pose = new Quaternion(), rotation = new Quaternion(), angles = new Euler(0, 0, 0, 'YXZ');
const angular = new Vector3(), forward = new Vector3(), up = new Vector3(), right = new Vector3(), from = new Vector3();
const worldUp = new Vector3(0, 1, 0);
export const AIRCRAFT_PHYSICS_DEFAULTS = Object.freeze({ mode: 'assisted', pitchRate: 1, rollRate: 1, yawRate: 1, response: 1, stability: 1, gravity: 1, thrust: 1, engineResponse: 1, mass: 1, drag: 1, lift: 1, maxSpeed: 1, airBrake: 1, wheelBrake: 1, pitchLimit: 1, bankLimit: 1, flightPath: 1, stallAngle: 1, inducedDrag: 1, loadLimit: 1 });
export const AIRCRAFT_PHYSICS_LIMITS = Object.freeze({ pitchRate: [.2, 3], rollRate: [.2, 3], yawRate: [.2, 3], response: [.25, 3], stability: [0, 1], gravity: [.5, 1.5], thrust: [0, 3], engineResponse: [.25, 3], mass: [.5, 2], drag: [.25, 2], lift: [.5, 1.75], maxSpeed: [.5, 2], airBrake: [.25, 2], wheelBrake: [.5, 2], pitchLimit: [.4, 1.5], bankLimit: [.4, 1.25], flightPath: [.4, 1.8], stallAngle: [.6, 1.6], inducedDrag: [.25, 3], loadLimit: [.5, 1.5] });
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
    acceleration: aircraft.acceleration * physics.thrust / physics.mass, engineResponse: aircraft.engineResponse * physics.engineResponse, drag: aircraft.drag * physics.drag / physics.mass,
    stall: aircraft.stall * liftScale, takeoff: aircraft.takeoff * liftScale, landingSpeed: aircraft.landingSpeed * liftScale,
    maxSpeed: aircraft.maxSpeed * physics.maxSpeed, response: aircraft.response * physics.response / physics.mass,
    pitchLimit: aircraft.pitchLimit * physics.pitchLimit, bankLimit: aircraft.bankLimit * physics.bankLimit,
    flightPath: .8 * physics.flightPath / physics.mass, airBrake: 7 * physics.airBrake / physics.mass, wheelBrake: 18 * physics.wheelBrake / physics.mass,
    stallAngle: (aircraft.cockpit === 'fighter' ? .42 : aircraft.cockpit === 'light' ? .3 : .26) * physics.stallAngle,
    loadLimit: (aircraft.cockpit === 'fighter' ? 9 : aircraft.cockpit === 'light' ? 6 : aircraft.cockpit === 'airliner' ? 2.5 : 3.5) * physics.loadLimit,
  };
  return physics;
}

export const AIRCRAFT = Object.freeze([
  Object.freeze({ id: 'a380', engineType: 'jet', name: 'Airbus A380', subtitle: '新加坡航空 · 四发远程客机', role: '稳定巡航', configuration: '四发客机', cockpit: 'airliner', engines: 4, engineResponse: .65, reverseThrust: .35, turnDrag: 1.4, cruiseSpeed: 135, length: 72.7, span: 79.8, gearHeight: 8.2, takeoff: 78, stall: 65, flapLimit: 135, maxSpeed: 285, landingSpeed: 105, acceleration: 4.8, drag: .000045, pitchLimit: .38, bankLimit: .8, pitchRate: .22, rollRate: .48, response: 1.7, yawRate: .06, sinkLimit: 7 }),
  Object.freeze({ id: 'su30', engineType: 'fighter', name: 'Su-30', subtitle: '双发双座 · 原创低多边形模型', role: '高速机动', configuration: '双发战斗机', cockpit: 'fighter', engines: 2, engineResponse: 1.4, turnDrag: 1.8, cruiseSpeed: 220, length: 21.9, span: 14.7, gearHeight: 2.7, takeoff: 65, stall: 53, flapLimit: 165, maxSpeed: 650, landingSpeed: 135, acceleration: 16, drag: .000036, pitchLimit: .65, bankLimit: 1.18, pitchRate: .85, rollRate: 1.8, response: 2.9, yawRate: .16, sinkLimit: 10 }),
  Object.freeze({ id: 't6', engineType: 'propeller', name: '星雀 T-6', subtitle: '原创低翼教练机 · 轻巧慢飞', role: '入门练习', configuration: '单发螺旋桨', cockpit: 'light', engines: 1, engineResponse: 2.7, turnDrag: 1.1, cruiseSpeed: 52, length: 9.2, span: 11.8, gearHeight: 1.65, takeoff: 33, stall: 25, flapLimit: 55, maxSpeed: 105, landingSpeed: 48, acceleration: 3.9, drag: .0002, pitchLimit: .45, bankLimit: .9, pitchRate: .55, rollRate: 1.2, response: 2.8, yawRate: .2, sinkLimit: 5 }),
  Object.freeze({ id: 'b62', engineType: 'jet', name: '云帆 B-62', subtitle: '原创公务机 · 后置双发与翼梢小翼', role: '高速巡航', configuration: '双发公务机', cockpit: 'transport', engines: 2, engineResponse: 1.1, reverseThrust: .3, turnDrag: 1.5, cruiseSpeed: 140, length: 20.4, span: 21.1, gearHeight: 2.35, takeoff: 55, stall: 44, flapLimit: 110, maxSpeed: 285, landingSpeed: 82, acceleration: 8.5, drag: .00007, pitchLimit: .45, bankLimit: .95, pitchRate: .4, rollRate: .85, response: 2.2, yawRate: .1, sinkLimit: 6 }),
  Object.freeze({ id: 'c24', engineType: 'turboprop', name: '山海 C-24', subtitle: '原创运输机 · 高翼双涡桨与后货舱', role: '低空运输', configuration: '双发涡桨', cockpit: 'transport', engines: 2, engineResponse: 1.7, reverseThrust: .4, turnDrag: 1.6, cruiseSpeed: 90, length: 25.6, span: 29.2, gearHeight: 3.4, takeoff: 44, stall: 36, flapLimit: 85, maxSpeed: 175, landingSpeed: 70, acceleration: 6.2, drag: .0001, pitchLimit: .4, bankLimit: .8, pitchRate: .3, rollRate: .65, response: 1.9, yawRate: .09, sinkLimit: 6 }),
  Object.freeze({ id: 'd9', engineType: 'fighter', name: '岚影 D-9', subtitle: '原创三角翼战机 · 单发与前翼', role: '敏捷截击', configuration: '单发战斗机', cockpit: 'fighter', engines: 1, engineResponse: 1.8, turnDrag: 2.1, cruiseSpeed: 240, length: 15.6, span: 9.6, gearHeight: 2.2, takeoff: 62, stall: 50, flapLimit: 150, maxSpeed: 720, landingSpeed: 120, acceleration: 20, drag: .000035, pitchLimit: .7, bankLimit: 1.2, pitchRate: 1.05, rollRate: 2.1, response: 3.2, yawRate: .19, sinkLimit: 9 }),
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

export function createAircraftFlight(id = 'a380', airborne = false, { runwayDirection = '36', physics, systems } = {}) {
  const aircraft = AIRCRAFT.find(item => item.id === id) ?? AIRCRAFT[0];
  const south = runwayDirection === '18';
  const flight = {
    aircraft, status: airborne ? 'running' : 'ready', x: 0, y: airborne ? 420 : aircraft.gearHeight, z: airborne ? RUNWAY.center : south ? RUNWAY.end + 180 : RUNWAY.start - 180,
    heading: south ? Math.PI : 0, pitch: 0, roll: 0, speed: 0,
    verticalSpeed: 0, throttle: airborne ? .65 : 0, engineOutput: airborne ? .65 : 0, gearDown: !airborne, onGround: !airborne,
    flaps: 0, speedBrake: false, runwayDirection: south ? '18' : '36',
    hasFlown: airborne, stalling: false, elapsed: 0, distance: 0, gates: 0, events: [], reason: '',
    pitchRate: 0, rollRate: 0, yawRate: 0, angleOfAttack: 0, loadFactor: airborne ? 1 : 0,
    systems: createAircraftSystems(systems),
  };
  setAircraftPhysics(flight, physics);
  setSystemSettings(flight);
  if (airborne) flight.speed = Math.min(flight.performance.maxSpeed * .85, Math.max(aircraft.cruiseSpeed, flight.performance.stall * 1.4));
  flight.systems.autothrottle.target = Math.min(flight.performance.maxSpeed, Math.max(aircraft.cruiseSpeed, flight.performance.stall * 1.3));
  return flight;
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
  const baseStall = performance.stall * (1 - flight.flaps * .1), takeoff = performance.takeoff * (1 - flight.flaps * .07);
  let stall = baseStall * Math.sqrt(bankLoad(flight));
  const controls = updateAircraftSystems(flight, input, dt, stall);
  const throttleRate = Number.isFinite(input.throttleRate) ? clamp(input.throttleRate, .05, 1) : .3;
  flight.throttle = clamp(flight.throttle + axis(input.throttle) * dt * throttleRate, 0, 1);
  flight.engineOutput += ((flight.systems.engineOn ? flight.throttle : 0) - flight.engineOutput) * (1 - Math.exp(-performance.engineResponse * dt));
  const airflow = aircraftAirflow(flight);
  const authority = clamp((flight.speed / stall) ** 2, .03, 1) * (1 - airflow.separation * .25);
  const pitchInput = controls.pitch, rollInput = controls.roll, yawInput = controls.yaw;
  if (flight.onGround) {
    flight.pitch += (pitchInput * performance.pitchLimit - flight.pitch) * (1 - Math.exp(-performance.response * dt));
    flight.pitch = clamp(flight.pitch, -.02, .13); flight.roll = 0;
    flight.pitchRate = 0; flight.rollRate = 0; flight.yawRate = 0;
  } else {
    const maneuver = physics.mode === 'maneuver';
    const pitchLimit = aircraft.pitchRate * physics.pitchRate * authority;
    const rollLimit = aircraft.rollRate * physics.rollRate * authority;
    let pitchTarget = maneuver ? pitchInput * pitchLimit - (1 - Math.abs(pitchInput)) * flight.pitch * physics.stability : (pitchInput * performance.pitchLimit + .018 - flight.pitch) * aircraft.response * (pitchInput || flight.systems.autopilot.mode === 'hold' ? 1 : physics.stability);
    pitchTarget -= Math.sin(airflow.angle) * airflow.separation * aircraft.pitchRate * .12;
    const rollTarget = maneuver ? rollInput * rollLimit - (1 - Math.abs(rollInput)) * flight.roll * physics.stability : (rollInput * performance.bankLimit - flight.roll) * aircraft.response * 1.5 * (rollInput || flight.systems.autopilot.mode !== 'off' ? 1 : physics.stability);
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
  const load = bankLoad(flight);
  stall = baseStall * Math.sqrt(load);
  const flow = aircraftAirflow(flight), lift = Math.min(1, (flight.speed / stall) ** 2);
  const normal = clamp((gravity + flight.speed * performance.flightPath * Math.sin(flow.angle)) * lift * (1 - flow.separation * .85), -performance.loadLimit * gravity, performance.loadLimit * gravity);
  const aerodynamicLoad = Math.max(load, Math.abs(normal / gravity));
  const inducedDrag = flight.onGround ? 0 : aircraft.turnDrag * physics.inducedDrag * (
    .35 * (aerodynamicLoad ** 2 - 1) * Math.min(4, (baseStall / Math.max(flight.speed, 1)) ** 2)
    + 3 * flow.separation * Math.min(4, (flight.speed / baseStall) ** 2));
  const drag = performance.drag * (flight.gearDown ? 1.55 : 1) * (1 + flight.flaps * .35 + (flight.speedBrake ? .8 * physics.airBrake : 0)) * flight.speed ** 2 + inducedDrag;
  const braking = flight.onGround ? controls.wheelBrake * performance.wheelBrake : (controls.brake || flight.speedBrake ? performance.airBrake : 0);
  const verticalAcceleration = normal * Math.cos(flight.roll) * Math.cos(flight.pitch) - gravity;
  const pathSine = clamp((flight.verticalSpeed + verticalAcceleration * dt * .5) / Math.max(flight.speed, .01), -1, 1);
  const thrust = performance.acceleration * flight.engineOutput * (flight.systems.reverse ? -aircraft.reverseThrust * flight.systems.settings.reversePower : 1);
  const acceleration = thrust - drag - (flight.onGround ? .45 : gravity * pathSine) - braking;
  const ceiling = Math.max(performance.maxSpeed, flight.speed - Math.min(60, Math.max(0, flight.speed - performance.maxSpeed) * 2) * dt);
  const nextSpeed = flight.onGround && flight.systems.parkingBrake ? 0 : clamp(flight.speed + acceleration * dt, 0, ceiling);
  const speed = (flight.speed + nextSpeed) * .5;
  flight.speed = nextSpeed;
  if (flight.onGround) {
    flight.heading += (yawInput + rollInput * .75) * .2 * clamp(speed / 25, 0, 1) * dt;
    if (speed >= takeoff && flight.pitch > .045 && !controls.brake && !flight.speedBrake && !flight.systems.reverse) {
      flight.onGround = false;
      flight.verticalSpeed = Math.max(1, speed * Math.sin(flight.pitch) * .4);
      flight.events.push('takeoff');
    }
  }
  flight.heading = Math.atan2(Math.sin(flight.heading), Math.cos(flight.heading));
  const horizontalSpeed = Math.sqrt(Math.max(0, speed ** 2 - flight.verticalSpeed ** 2));
  flight.x += Math.sin(flight.heading) * horizontalSpeed * dt;
  flight.z -= Math.cos(flight.heading) * horizontalSpeed * dt;
  if (!flight.onGround) {
    flight.y += flight.verticalSpeed * dt + .5 * verticalAcceleration * dt ** 2;
    flight.verticalSpeed = clamp(flight.verticalSpeed + verticalAcceleration * dt, -flight.speed, flight.speed);
  }
  flight.angleOfAttack = aircraftAirflow(flight).angle;
  flight.loadFactor = flight.onGround ? 0 : normal / gravity;
  const surface = Math.max(-12, islandHeight(flight.x, flight.z));
  pose.setFromEuler(angles.set(flight.pitch, -flight.heading, -flight.roll));
  forward.set(0, 0, -1).applyQuaternion(pose); up.set(0, 1, 0).applyQuaternion(pose); right.set(1, 0, 0).applyQuaternion(pose);
  const sideways = aircraft.span * .42, lengthwise = aircraft.length * .35, depth = aircraft.gearHeight * .45;
  const extentY = Math.abs(right.y) * sideways + Math.abs(forward.y) * lengthwise + Math.abs(up.y) * depth;
  const contactHeight = surface + (flight.onGround ? aircraft.gearHeight : Math.max(flight.gearDown ? aircraft.gearHeight : depth, extentY));
  flight.stalling = !flight.onGround && (speed < stall || Math.abs(flight.angleOfAttack) > performance.stallAngle);
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
      flight.loadFactor = 0;flight.stalling = false;
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
  if (flight.status !== 'running' && flight.systems.autopilot.mode !== 'off') {
    flight.systems.autopilot.mode = 'off';flight.systems.autopilot.reason = 'status';
  }
  if (flight.status !== 'running') {
    flight.systems.autothrottle.enabled = false;flight.systems.autothrottle.reason = 'status';flight.systems.autoBrakeActive = false;
  }
}
