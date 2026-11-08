const common = { KeyA: ['roll', -1], KeyD: ['roll', 1], ArrowLeft: ['roll', -1], ArrowRight: ['roll', 1], KeyQ: ['yaw', -1], KeyE: ['yaw', 1], Space: ['brake', 1] };
const presets = {
  flight: { ...common, KeyW: ['throttle', 1], KeyS: ['throttle', -1], ArrowDown: ['pitch', 1], ArrowUp: ['pitch', -1] },
  wasd: { ...common, KeyW: ['pitch', 1], KeyS: ['pitch', -1], ArrowUp: ['throttle', 1], ArrowDown: ['throttle', -1] },
};
const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;

export function aircraftKeyBinding(code, preset = 'flight') {
  return (presets[preset] ?? presets.flight)[code];
}

export function aircraftInput(held, touch = {}, settings = {}) {
  const input = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: !!touch.brake };
  const axes = Object.fromEntries(['pitch', 'roll', 'yaw', 'throttle'].map(axis => [axis, [Math.min(0, clamp(touch[axis])), Math.max(0, clamp(touch[axis]))]]));
  for (const code of held) {
    const binding = aircraftKeyBinding(code, settings.preset);
    if (!binding) continue;
    const [axis, amount] = binding;
    if (axis === 'brake') input.brake = true;
    else { axes[axis][0] = Math.min(axes[axis][0], amount); axes[axis][1] = Math.max(axes[axis][1], amount); }
  }
  const sensitivity = Number.isFinite(settings.sensitivity) ? Math.max(.4, Math.min(1.5, settings.sensitivity)) : 1;
  for (const axis of Object.keys(axes)) input[axis] = clamp((axes[axis][0] + axes[axis][1]) * (axis === 'throttle' ? 1 : sensitivity));
  if (settings.invertPitch && input.pitch) input.pitch *= -1;
  return input;
}

export function aircraftControlHelp(settings = {}) {
  const wasd = settings.preset === 'wasd';
  return { pitch: settings.invertPitch ? wasd ? 'S / W' : '↑ / ↓' : wasd ? 'W / S' : '↓ / ↑', throttle: wasd ? '↑ / ↓' : 'W / S' };
}
