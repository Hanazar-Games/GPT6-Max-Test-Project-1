const common = { KeyA: ['roll', -1], KeyD: ['roll', 1], ArrowLeft: ['roll', -1], ArrowRight: ['roll', 1], KeyQ: ['yaw', -1], KeyE: ['yaw', 1], Space: ['brake', 1] };
const presets = {
  flight: { ...common, KeyW: ['throttle', 1], KeyS: ['throttle', -1], ArrowDown: ['pitch', 1], ArrowUp: ['pitch', -1] },
  wasd: { ...common, KeyW: ['pitch', 1], KeyS: ['pitch', -1], ArrowUp: ['throttle', 1], ArrowDown: ['throttle', -1] },
};
const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
const axisBits = { pitch: 1, roll: 2, yaw: 4, throttle: 8 };

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
  const sensitivity = Number.isFinite(settings.sensitivity) ? Math.max(.4, Math.min(1.5, settings.sensitivity)) : 1;
  for (const axis in axisBits) {
    const value = clamp(touch[axis]), bit = axisBits[axis];
    input[axis] = clamp(((negative & bit ? -1 : Math.min(0, value)) + (positive & bit ? 1 : Math.max(0, value))) * (axis === 'throttle' ? 1 : sensitivity));
  }
  if (settings.invertPitch && input.pitch) input.pitch *= -1;
  return input;
}

export function aircraftControlHelp(settings = {}) {
  const wasd = settings.preset === 'wasd';
  return { pitch: settings.invertPitch ? wasd ? 'S / W' : '↑ / ↓' : wasd ? 'W / S' : '↓ / ↑', throttle: wasd ? '↑ / ↓' : 'W / S' };
}
