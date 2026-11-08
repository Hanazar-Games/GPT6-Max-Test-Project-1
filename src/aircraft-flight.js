const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;

export const AIRCRAFT = Object.freeze([
  Object.freeze({ id: 'a380', name: 'Airbus A380', subtitle: '新加坡航空 · 四发远程客机', role: '稳定巡航', length: 72.7, span: 79.8, gearHeight: 8.2, takeoff: 78, stall: 65, maxSpeed: 285, landingSpeed: 105, acceleration: 4.8, drag: .000045, pitchLimit: .38, bankLimit: .8, response: 1.7, yawRate: .06, sinkLimit: 7 }),
  Object.freeze({ id: 'su30', name: 'Su-30', subtitle: '双发双座 · 原创低多边形模型', role: '高速机动', length: 21.9, span: 14.7, gearHeight: 2.7, takeoff: 65, stall: 53, maxSpeed: 650, landingSpeed: 135, acceleration: 16, drag: .000036, pitchLimit: .65, bankLimit: 1.18, response: 2.9, yawRate: .16, sinkLimit: 10 }),
]);

export const RUNWAY = Object.freeze({ width: 100, start: 1600, end: -2800 });
export const AIRPORT_BUILDINGS = Object.freeze([
  { x: -440, z: -100, width: 220, depth: 680, height: 46 },
  { x: -340, z: 310, width: 220, depth: 70, height: 24 },
  { x: 400, z: 600, width: 180, depth: 190, height: 48 },
  { x: 400, z: 900, width: 180, depth: 190, height: 48 },
  { x: -240, z: -700, width: 48, depth: 48, height: 107 },
  ...Array.from({ length: 70 }, (_, index) => ({ x: -1300 - index % 10 * 110, z: 700 + Math.floor(index / 10) * 150, width: 60, depth: 70, height: 35 + index * 37 % 105 })),
].map(Object.freeze));
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

export function createAircraftFlight(id = 'a380', airborne = false) {
  const aircraft = AIRCRAFT.find(item => item.id === id) ?? AIRCRAFT[0];
  return {
    aircraft, status: airborne ? 'running' : 'ready', x: 0, y: airborne ? 420 : aircraft.gearHeight, z: airborne ? -400 : 1100,
    heading: 0, pitch: 0, roll: 0, speed: airborne ? (id === 'su30' ? 220 : 135) : 0,
    verticalSpeed: 0, throttle: airborne ? .65 : 0, gearDown: !airborne, onGround: !airborne,
    hasFlown: airborne, stalling: false, elapsed: 0, distance: 0, gates: 0, events: [], reason: '',
  };
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
  return flight.gearDown && Math.abs(flight.x) < RUNWAY.width / 2 - aircraft.span * .12
    && flight.z > RUNWAY.end && flight.z < RUNWAY.start && alignment < .28
    && Math.abs(flight.roll) < .2 && flight.pitch > -.12 && flight.pitch < .3
    && flight.speed <= aircraft.landingSpeed && flight.verticalSpeed >= -aircraft.sinkLimit;
}

export function crossesAirGate(from, to, gate) {
  const dot = point => (point.x - gate.x) * gate.normal[0] + (point.y - gate.y) * gate.normal[1] + (point.z - gate.z) * gate.normal[2];
  const before = dot(from), after = dot(to);
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
  const aircraft = flight.aircraft;
  const from = { x: flight.x, y: flight.y, z: flight.z };
  flight.elapsed += dt;
  flight.throttle = clamp(flight.throttle + axis(input.throttle) * dt * .3, 0, 1);
  const pitchTarget = axis(input.pitch) * aircraft.pitchLimit + (flight.onGround ? 0 : .018);
  flight.pitch += (pitchTarget - flight.pitch) * (1 - Math.exp(-aircraft.response * dt));
  flight.roll += ((flight.onGround ? 0 : axis(input.roll) * aircraft.bankLimit) - flight.roll) * (1 - Math.exp(-aircraft.response * 1.5 * dt));
  if (flight.onGround) flight.pitch = clamp(flight.pitch, -.02, .13);
  const drag = aircraft.drag * (flight.gearDown ? 1.55 : 1) * flight.speed ** 2;
  const acceleration = aircraft.acceleration * flight.throttle - drag - (flight.onGround ? .45 : 9.81 * Math.sin(flight.pitch)) - (input.brake ? flight.onGround ? 18 : 7 : 0);
  const nextSpeed = clamp(flight.speed + acceleration * dt, 0, aircraft.maxSpeed);
  const speed = (flight.speed + nextSpeed) * .5;
  flight.speed = nextSpeed;
  if (flight.onGround) {
    flight.heading += (axis(input.yaw) + axis(input.roll) * .75) * .2 * clamp(speed / 25, 0, 1) * dt;
    if (speed >= aircraft.takeoff && flight.pitch > .045 && !input.brake) {
      flight.onGround = false;
      flight.verticalSpeed = Math.max(1, speed * Math.sin(flight.pitch) * .4);
      flight.events.push('takeoff');
    }
  } else {
    const authority = clamp(speed / aircraft.stall, .05, 1);
    flight.heading += (9.81 * Math.tan(flight.roll) / Math.max(speed, 35) + axis(input.yaw) * aircraft.yawRate * authority) * dt;
  }
  flight.heading = Math.atan2(Math.sin(flight.heading), Math.cos(flight.heading));
  const horizontalSpeed = speed * Math.cos(flight.pitch);
  flight.x += Math.sin(flight.heading) * horizontalSpeed * dt;
  flight.z -= Math.cos(flight.heading) * horizontalSpeed * dt;
  if (!flight.onGround) {
    const lift = Math.min(1, (speed / aircraft.stall) ** 2) * Math.max(0, Math.cos(flight.roll));
    const verticalAcceleration = (speed * Math.sin(flight.pitch) - flight.verticalSpeed) * .8 * lift - 9.81 * (1 - lift);
    flight.y += flight.verticalSpeed * dt + .5 * verticalAcceleration * dt ** 2;
    flight.verticalSpeed += verticalAcceleration * dt;
  }
  const surface = Math.max(-12, islandHeight(flight.x, flight.z));
  const contactHeight = surface + Math.max(aircraft.gearHeight, Math.abs(Math.sin(flight.roll)) * aircraft.span * .42);
  flight.stalling = !flight.onGround && speed < aircraft.stall;
  if (flight.y > aircraft.gearHeight + 20) flight.hasFlown = true;
  if (Math.abs(flight.x) < 3000 && Math.abs(flight.z) < 2400) {
    const sideways = aircraft.span * .35, lengthwise = aircraft.length * .35;
    const extentX = Math.abs(Math.cos(flight.heading)) * sideways + Math.abs(Math.sin(flight.heading)) * lengthwise;
    const extentZ = Math.abs(Math.cos(flight.heading)) * lengthwise + Math.abs(Math.sin(flight.heading)) * sideways;
    if (AIRPORT_BUILDINGS.some(building => flight.y - aircraft.gearHeight * .5 < building.height && Math.abs(flight.x - building.x) < building.width / 2 + extentX && Math.abs(flight.z - building.z) < building.depth / 2 + extentZ)) {
      crash(flight, '碰到机场建筑或城市。拉起机头，保持足够净空。');
      return;
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
  flight.events = [];
  if (flight.status !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
  let remaining = Math.min(dt, .25);
  while (remaining > 1e-10 && flight.status === 'running') {
    const step = Math.min(remaining, 1 / 120);
    stepFlight(flight, input, step);
    remaining -= step;
  }
}
