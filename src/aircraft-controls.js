const common = { KeyA: ['roll', -1], KeyD: ['roll', 1], ArrowLeft: ['roll', -1], ArrowRight: ['roll', 1], KeyQ: ['yaw', -1], KeyE: ['yaw', 1], Space: ['brake', 1] };
const presets = {
  flight: { ...common, KeyW: ['throttle', 1], KeyS: ['throttle', -1], ArrowDown: ['pitch', 1], ArrowUp: ['pitch', -1] },
  wasd: { ...common, KeyW: ['pitch', 1], KeyS: ['pitch', -1], ArrowUp: ['throttle', 1], ArrowDown: ['throttle', -1] },
};
const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const axisBits = { pitch: 1, roll: 2, yaw: 4, throttle: 8 };
export const AIRCRAFT_CONTROL_DEFAULTS = Object.freeze({ preset: 'flight', invertPitch: false, pitchSensitivity: 1, rollSensitivity: 1, yawSensitivity: 1, deadzone: .07, curve: 1, throttleRate: .3 });
const controlLimits = { pitchSensitivity: [.2, 2], rollSensitivity: [.2, 2], yawSensitivity: [.2, 2], deadzone: [0, .25], curve: [1, 3], throttleRate: [.05, 1] };
const throttleShortcuts = { Digit1: 0, Numpad1: 0, Digit2: .65, Numpad2: .65, Digit3: 1, Numpad3: 1 };
const settingValue = (settings, key) => Number.isFinite(settings[key]) ? Math.max(controlLimits[key][0], Math.min(controlLimits[key][1], settings[key])) : AIRCRAFT_CONTROL_DEFAULTS[key];

export function aircraftThrottleShortcut(code) {
  return throttleShortcuts[code];
}

export function aircraftKeyBinding(code, preset = 'flight') {
  return (presets[preset] ?? presets.flight)[code];
}

export function aircraftInput(held, touch = {}, settings = {}, input = {}) {
  let negative = 0, positive = 0;
  input.brake = !!touch.brake;
  for (const code of held) {
    const binding = aircraftKeyBinding(code, settings.preset);
    if (!binding) continue;
    const [axis, amount] = binding;
    if (axis === 'brake') input.brake = true;
    else if (amount < 0) negative |= axisBits[axis];
    else positive |= axisBits[axis];
  }
  const deadzone = settingValue(settings, 'deadzone'), curve = settingValue(settings, 'curve');
  for (const axis in axisBits) {
    let value = clamp(touch[axis]);
    const bit = axisBits[axis], sensitivity = axis === 'throttle' ? 1 : settingValue(settings, `${axis}Sensitivity`);
    if (axis !== 'throttle') value = Math.abs(value) <= deadzone ? 0 : Math.sign(value) * ((Math.abs(value) - deadzone) / (1 - deadzone)) ** curve;
    input[axis] = clamp(((negative & bit ? -1 : Math.min(0, value)) + (positive & bit ? 1 : Math.max(0, value))) * sensitivity);
  }
  input.throttleRate = settingValue(settings, 'throttleRate');
  if (settings.invertPitch && input.pitch) input.pitch *= -1;
  return input;
}

export function aircraftControlHelp(settings = {}) {
  const wasd = settings.preset === 'wasd';
  return { pitch: settings.invertPitch ? wasd ? 'S / W' : '↑ / ↓' : wasd ? 'W / S' : '↓ / ↑', throttle: wasd ? '↑ / ↓' : 'W / S' };
}
