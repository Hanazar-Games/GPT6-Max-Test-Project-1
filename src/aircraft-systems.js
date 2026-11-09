import { aircraftEnvelope, aircraftAirflow } from './aircraft-envelope.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const axis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
const editable = flight => ['ready', 'running', 'paused'].includes(flight.status);
const radians = Math.PI / 180;
export const SYSTEM_DEFAULTS = Object.freeze({ trimAuthority: .2, trimRate: .08, apResponse: 1, bankLimit: 22, climbRate: 5, overrideThreshold: .2, displayBrightness: 1 });
export const SYSTEM_LIMITS = Object.freeze({ trimAuthority: [.05, .4], trimRate: [.01, .3], apResponse: [.25, 2], bankLimit: [5, 35], climbRate: [1, 15], overrideThreshold: [.05, .6], displayBrightness: [.2, 1.2] });

export function createAircraftSystems(settings) {
  return { engineOn: true, parkingBrake: false, trim: { pitch: 0, roll: 0, yaw: 0 }, settings: { ...SYSTEM_DEFAULTS, ...settings }, autopilot: { mode: 'off', heading: 0, altitude: 1000, reason: '' }, controls: { pitch: 0, roll: 0, yaw: 0, brake: false } };
}

export function setSystemSettings(flight, settings = {}) {
  for (const key in SYSTEM_DEFAULTS) {
    const value = settings[key] ?? flight.systems.settings[key];
    flight.systems.settings[key] = Number.isFinite(value) ? clamp(value, ...SYSTEM_LIMITS[key]) : SYSTEM_DEFAULTS[key];
  }
  return flight.systems.settings;
}

export function setAircraftTrim(flight, key, value) {
  if (!editable(flight) || !Object.hasOwn(flight.systems.trim, key) || !Number.isFinite(value)) return false;
  flight.systems.trim[key] = axis(value);return true;
}

export function toggleEngine(flight) {
  if (!editable(flight)) return false;
  flight.systems.engineOn = !flight.systems.engineOn;return true;
}

export function toggleParkingBrake(flight) {
  if (!editable(flight) || !flight.onGround || (!flight.systems.parkingBrake && flight.speed >= 1)) return false;
  flight.systems.parkingBrake = !flight.systems.parkingBrake;return true;
}

export function autopilotAvailability(flight) {
  const minimumSpeed = aircraftEnvelope(flight).stall * 1.15;
  const reason = !editable(flight) ? 'status' : flight.onGround ? 'ground' : flight.physics.mode !== 'assisted' ? 'mode' : !flight.systems.engineOn ? 'engine' : flight.speed < minimumSpeed ? 'stall' : Math.abs(flight.roll) > Math.PI / 3 || Math.abs(flight.pitch) > .45 ? 'attitude' : aircraftAirflow(flight).highAngle ? 'aoa' : '';
  return { reason, minimumSpeed };
}

export function setAutopilot(flight, mode) {
  if (!editable(flight) || !['off', 'level', 'hold'].includes(mode)) return false;
  const autopilot = flight.systems.autopilot;
  if (mode !== 'off' && autopilotAvailability(flight).reason) return false;
  if (mode !== 'off') { autopilot.heading = flight.heading;autopilot.altitude = flight.y; }
  autopilot.mode = mode;autopilot.reason = '';return true;
}

export function setAutopilotTarget(flight, key, value) {
  if (!editable(flight) || !Number.isFinite(value)) return false;
  if (key === 'heading') flight.systems.autopilot.heading = ((value % 360 + 360) % 360) * radians;
  else if (key === 'altitude') flight.systems.autopilot.altitude = Math.max(0, value);
  else return false;
  return true;
}

export function updateAircraftSystems(flight, input, dt, stall) {
  const { trim, settings, autopilot, controls } = flight.systems;
  trim.pitch = axis(trim.pitch + axis(input.trimPitch) * settings.trimRate * dt);
  for (const key in trim) controls[key] = axis(axis(input[key]) + trim[key] * settings.trimAuthority);
  controls.brake = !!input.brake || flight.systems.parkingBrake;
  if (autopilot.mode === 'off') return controls;
  const override = Number.isFinite(input.pilotOverride) ? Math.abs(axis(input.pilotOverride)) : Math.max(Math.abs(axis(input.pitch)), Math.abs(axis(input.roll)), Math.abs(axis(input.yaw)));
  const reason = flight.onGround ? 'ground' : flight.physics.mode !== 'assisted' ? 'mode' : !flight.systems.engineOn ? 'engine' : flight.speed < stall * 1.1 ? 'stall' : Math.abs(flight.roll) > Math.PI / 3 || Math.abs(flight.pitch) > .55 ? 'attitude' : aircraftAirflow(flight).highAngle ? 'aoa' : override >= settings.overrideThreshold ? 'manual' : '';
  if (reason) {
    autopilot.mode = 'off';autopilot.reason = reason;flight.events.push('ap-disconnect');return controls;
  }
  controls.roll = 0;
  if (autopilot.mode === 'hold') {
    const error = Math.atan2(Math.sin(autopilot.heading - flight.heading), Math.cos(autopilot.heading - flight.heading));
    const bank = clamp(error * 1.6 * settings.apResponse, -settings.bankLimit * radians, settings.bankLimit * radians);
    controls.roll = clamp(bank / flight.performance.bankLimit, -.9, .9);
    const vertical = clamp((autopilot.altitude - flight.y) * .04 * settings.apResponse, -settings.climbRate, settings.climbRate);
    const compensation = 9.81 * flight.physics.gravity * (1 - Math.cos(flight.roll)) / flight.performance.flightPath;
    const pitch = Math.asin(clamp((vertical + (vertical - flight.verticalSpeed) * .4 + compensation) / Math.max(1, flight.speed), -.2, .2));
    controls.pitch = clamp((pitch - .018) / flight.performance.pitchLimit, -.8, .8);
    controls.yaw = 0;
  }
  return controls;
}
