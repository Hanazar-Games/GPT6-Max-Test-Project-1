import * as THREE from 'three';
import { batchMeshes } from './model-utils.js';
import { RUNWAY } from './airport.js';
import { autothrottleAvailability, reverseThrustAvailability } from './aircraft-systems.js';

export const COCKPIT_SWITCH_COLUMNS = 6;
export const COCKPIT_SWITCHES = Object.freeze([
  { action: 'engine', label: 'ENG' }, { action: 'parking', label: 'PARK' }, { action: 'reverse', label: 'REV' }, { action: 'autobrake', label: 'A/BRK' }, { action: 'go-around', label: 'TOGA' }, { action: 'trim-reset', label: 'TRIM 0' },
  { action: 'ap-level', label: 'AP LVL' }, { action: 'ap-hold', label: 'AP HOLD' }, { action: 'autothrottle', label: 'A/THR' }, { action: 'gear', label: 'GEAR' }, { action: 'flaps', label: 'FLAP' }, { action: 'speed-brake', label: 'BRK' },
]);
const switchColor = new THREE.Color();
export const cockpitWidth = aircraft => aircraft.cockpit === 'airliner' ? 4.2 : aircraft.cockpit === 'transport' ? 3.4 : 2.05;
export const cockpitSwitchSpacing = aircraft => Math.min(cockpitWidth(aircraft) * .62, 2) / COCKPIT_SWITCH_COLUMNS;

export function cockpitSeat(aircraft) {
  return aircraft.cockpit === 'airliner' ? [-1.15, 2.2, -aircraft.length * .36] : aircraft.cockpit === 'transport' ? [-.55, .8, -aircraft.length * .28] : [0, .55, -aircraft.length * .24];
}

export function cockpitInstruments(flight) {
  return { speed: Math.round(flight.speed * 3.6), altitude: Math.round(flight.y), heading: String((Math.round(flight.heading * 180 / Math.PI) % 360 + 360) % 360).padStart(3, '0'), vertical: flight.verticalSpeed.toFixed(1), throttle: Math.round(flight.throttle * 100), engine: Math.round(flight.engineOutput * flight.physics.thrust * 100), aoa: (flight.angleOfAttack * 180 / Math.PI).toFixed(1), load: flight.loadFactor.toFixed(1), flaps: flight.flaps, speedBrake: flight.speedBrake, reverse: flight.systems.reverse, speedHold: flight.systems.autothrottle.enabled, autoBrake: flight.systems.autoBrake.toUpperCase(), warning: flight.stalling ? 'STALL' : flight.gearDown ? 'GEAR DOWN' : 'GEAR UP' };
}

export function createAircraftCockpit(aircraft, texture = null, labelsTexture = null) {
  const root = new THREE.Group(), shell = new THREE.Group(); root.name = `${aircraft.id}-cockpit`; root.add(shell);
  const airliner = aircraft.cockpit === 'airliner' || aircraft.cockpit === 'transport', yoke = aircraft.cockpit !== 'fighter';
  const width = cockpitWidth(aircraft);
  const materials = {
    shell: new THREE.MeshStandardMaterial({ color: airliner ? 0x778084 : 0x314047, roughness: .8 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x172126, roughness: .9 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xa3ada9, metalness: .4, roughness: .4 }),
    seat: new THREE.MeshStandardMaterial({ color: airliner ? 0x3e5c6b : 0x526653, roughness: 1 }),
    amber: new THREE.MeshBasicMaterial({ color: 0xd9ad63 }),
  };
  const box = (parent, material, position, size) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materials[material]); mesh.position.set(...position); parent.add(mesh); return mesh;
  };
  function bar(from, to, radius = .035) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.sub(a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), materials.dark);
    mesh.position.copy(a).addScaledVector(delta, .5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); shell.add(mesh);
  }
  box(shell, 'shell', [0, -.78, -1.6], [width, .85, .36]);
  box(shell, 'dark', [0, -.32, -1.56], [width + .08, .1, .55]);
  box(shell, 'shell', [-width / 2, -.7, -.1], [.16, 1, 3.3]);
  box(shell, 'shell', [width / 2, -.7, -.1], [.16, 1, 3.3]);
  box(shell, 'dark', [0, -1.45, -.1], [width, .1, 3.3]);
  const frame = airliner ? [[-1.9, -.27, -1.58], [-1.55, 1.05, -1.15], [.6, 1.05, -1.45], [2.05, 1.05, -1.15], [2.1, -.27, -1.58]] : [[-.99, -.28, -1.5], [-.75, .65, -1.25], [0, 1.05, -1.1], [.75, .65, -1.25], [.99, -.28, -1.5]];
  if (airliner) for (const point of frame) point[0] *= width / 4.2;
  for (let i = 1; i < frame.length; i++) bar(frame[i - 1], frame[i], airliner ? .045 : .035);
  if (airliner) {
    bar([.6, -.27, -1.58], [.6, 1.05, -1.45], .04);
    box(shell, 'shell', [.7, 1.06, -.5], [1, .12, 1.1]);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 7; column++) box(shell, row === 1 ? 'amber' : 'dark', [.35 + column * .11, .988, -.85 + row * .23], [.05, .025, .09]);
    box(shell, 'shell', [width / 2 - 1.15, -1.1, -.3], [.5, .55, 1.3]);
    box(shell, 'seat', [width / 2 - .45, -.9, .3], [.75, .2, .8]);
    box(shell, 'seat', [width / 2 - .45, -.4, .7], [.75, .9, .16]);
  } else {
    box(shell, 'shell', [-.65, -1.08, -.15], [.35, .32, 1.2]);
    box(shell, 'shell', [.65, -1.08, -.15], [.35, .32, 1.2]);
    box(shell, 'seat', [0, -.75, .55], [.6, 1.1, .16]);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    box(shell, i % 3 ? 'trim' : 'amber', [side * width * .38, -.292, -1.43 + i * .025], [.045, .025, .012]);
  }
  batchMeshes(shell);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(airliner ? 3 : width * .92, .64), new THREE.MeshBasicMaterial({ map: texture, color: texture ? 0xffffff : 0x0d2730, toneMapped: false }));
  screen.name = 'live-flight-displays'; screen.position.set(0, -.7, -1.411); root.add(screen);
  const stick = new THREE.Group(); stick.position.set(0, -1.17, -1.05); root.add(stick);
  box(stick, 'dark', [0, .2, 0], [.055, .4, .055]);
  if (yoke) {
    box(stick, 'dark', [0, .4, 0], [.42, .055, .055]);
    for (const x of [-.21, .21]) box(stick, 'dark', [x, .47, 0], [.055, .18, .055]);
  } else box(stick, 'dark', [0, .44, -.02], [.09, .16, .13]);
  batchMeshes(stick);
  const throttles = Array.from({ length: aircraft.engines }, (_, index) => {
    const lever = new THREE.Group(); lever.position.set((airliner ? width / 2 - 1.32 : -.72) + index * .1, -1, -1.08); root.add(lever);
    box(lever, 'trim', [0, .12, 0], [.025, .24, .025]);
    box(lever, 'dark', [0, .24, 0], [.075, .065, .1]); batchMeshes(lever); return lever;
  });
  const gear = new THREE.Group(); gear.position.set(width * .4, -.91, -1.26); root.add(gear);
  box(gear, 'trim', [0, .05, 0], [.02, .12, .02]); box(gear, 'amber', [0, .12, 0], [.08, .055, .04]); batchMeshes(gear);
  const switches = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 }), COCKPIT_SWITCHES.length);
  const button = new THREE.Object3D(), spacing = cockpitSwitchSpacing(aircraft);
  const labels = new THREE.Group(), labelMaterial = labelsTexture ? new THREE.MeshBasicMaterial({ map: labelsTexture, toneMapped: false }) : null;
  COCKPIT_SWITCHES.forEach((control, index) => {
    button.position.set((index % COCKPIT_SWITCH_COLUMNS - (COCKPIT_SWITCH_COLUMNS - 1) / 2) * spacing - (airliner ? .16 : 0), -.23 - Math.floor(index / COCKPIT_SWITCH_COLUMNS) * .1, -1.25);button.scale.set(spacing * .72, .055, .04);button.updateMatrix();switches.setMatrixAt(index, button.matrix);
    switches.setColorAt(index, switchColor.set(0x29434c));
    if (labelMaterial) {
      const geometry = new THREE.PlaneGeometry(spacing * .68, .045), uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (index + uv.getX(i)) / switches.count);
      const label = new THREE.Mesh(geometry, labelMaterial);label.position.copy(button.position);label.position.z += .021;labels.add(label);
    }
  });
  switches.computeBoundingSphere();root.add(switches);batchMeshes(labels);root.add(labels);
  root.userData.controls = { stick, throttles, gear, switches, switchStates: [] };
  root.userData.display = screen;
  return root;
}

export function updateCockpitControls(root, flight, input = {}) {
  const { stick, throttles, gear, switches, switchStates } = root.userData.controls;
  stick.rotation.set((input.pitch || 0) * .22, 0, -(input.roll || 0) * .28);
  for (const lever of throttles) lever.rotation.x = .35 - flight.throttle * .8;
  gear.rotation.x = flight.gearDown ? .5 : -.5;
  const systems = flight.systems;
  let changed = false;
  for (let index = 0; index < COCKPIT_SWITCHES.length; index++) {
    const action = COCKPIT_SWITCHES[index].action;
    let active = false;
    switch (action) {
      case 'engine': active = systems.engineOn;break;
      case 'parking': active = systems.parkingBrake;break;
      case 'reverse': active = systems.reverse;break;
      case 'autobrake': active = systems.autoBrakeActive;break;
      case 'autothrottle': active = systems.autothrottle.enabled;break;
      case 'ap-level': active = systems.autopilot.mode === 'level';break;
      case 'ap-hold': active = systems.autopilot.mode === 'hold';break;
      case 'gear': active = flight.gearDown;break;
      case 'flaps': active = flight.flaps > 0;break;
      case 'speed-brake': active = flight.speedBrake;break;
      case 'trim-reset': active = Math.abs(systems.trim.pitch) + Math.abs(systems.trim.roll) + Math.abs(systems.trim.yaw) > .001;break;
    }
    const unavailable = action === 'reverse' ? reverseThrustAvailability(flight) : action === 'autothrottle' ? autothrottleAvailability(flight).reason : action === 'go-around' && !systems.engineOn;
    const color = active ? 0x4fd6ac : action === 'autobrake' && systems.autoBrake !== 'off' ? 0xd9ad63 : unavailable ? 0x59646b : 0x29434c;
    if (switchStates[index] !== color) { switchStates[index] = color;switches.setColorAt(index, switchColor.set(color));changed = true; }
  }
  if (changed) switches.instanceColor.needsUpdate = true;
  root.userData.display.material.color.setScalar(flight.systems.settings.displayBrightness);
}

export function drawCockpitDisplay(ctx, flight) {
  const data = cockpitInstruments(flight), airliner = flight.aircraft.cockpit === 'airliner' || flight.aircraft.cockpit === 'transport', engines = flight.aircraft.engines;
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#111c23'; ctx.fillRect(0, 0, width, height);
  const text = (value, x, y, size = 22, color = '#c8eee4') => { ctx.fillStyle = color; ctx.font = `${size}px monospace`; ctx.fillText(String(value), x, y); };
  const tiles = airliner ? 4 : 3, gap = 16, tile = (width - gap * (tiles + 1)) / tiles;
  for (let i = 0; i < tiles; i++) { ctx.fillStyle = '#050f15'; ctx.fillRect(gap + i * (tile + gap), 18, tile, height - 36); ctx.strokeStyle = '#3c545c'; ctx.strokeRect(gap + i * (tile + gap), 18, tile, height - 36); }
  const x = gap + tile / 2, y = height * .48;
  ctx.save(); ctx.beginPath(); ctx.rect(gap + 8, 65, tile - 16, height - 125); ctx.clip(); ctx.translate(x, y); ctx.rotate(-flight.roll); ctx.translate(0, flight.pitch * 140);
  ctx.fillStyle = '#37799d'; ctx.fillRect(-400, -400, 800, 400); ctx.fillStyle = '#74634d'; ctx.fillRect(-400, 0, 800, 400);
  ctx.strokeStyle = '#f2eccc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-400, 0); ctx.lineTo(400, 0); ctx.stroke();
  for (let pitch = -30; pitch <= 30; pitch += 10) if (pitch) { ctx.beginPath(); ctx.moveTo(-26, -pitch * 2); ctx.lineTo(26, -pitch * 2); ctx.stroke(); }
  ctx.restore(); text('— ◇ —', x - 46, y + 7, 23, '#ffdb86'); text('ATTITUDE', gap + 14, 47, 20); text(`HDG ${data.heading}`, gap + 14, height - 38, 23);
  const second = gap * 2 + tile;
  text('FLIGHT DATA', second + 14, 47, 20); text(`${data.speed}`, second + 14, 104, 42); text('KM/H', second + 14, 133, 18, '#7da6b4');
  text(`${data.altitude} M`, second + 14, 190, 30); text(`V/S ${data.vertical}`, second + 14, 232, 21);
  text(`AOA ${data.aoa}  G ${data.load}`, second + 14, 258, 18, flight.stalling ? '#ff805c' : '#96efb0');
  text(data.warning, second + 14, height - 39, 20, flight.stalling ? '#ff805c' : '#96efb0');
  const third = gap * 3 + tile * 2;
  text(airliner ? 'ENGINE / ECAM' : 'ENGINE / NAV', third + 14, 47, 20);
  text(`${data.reverse ? 'REV ' : ''}${data.engine}%`, third + 14, 103, data.reverse ? 30 : 40, data.reverse ? '#ffcf86' : '#c8eee4');
  for (let i = 0; i < engines; i++) {
    const barX = third + 18 + i * tile * .34 / engines, barWidth = Math.min(24, tile * .34 / engines - 4), output = Math.min(100, data.engine) * .96;
    ctx.fillStyle = '#163b3e'; ctx.fillRect(barX, 135, barWidth, 96); ctx.fillStyle = '#8bdeb3'; ctx.fillRect(barX, 231 - output, barWidth, output);
  }
  text(`FLAP ${data.flaps}  BRK ${data.speedBrake ? 'ON' : 'OFF'}`, third + 14, height - 65, 18, data.speedBrake ? '#ffcf86' : '#96efb0');
  text(`AP ${flight.systems.autopilot.mode.toUpperCase()} AT ${data.speedHold ? 'ON' : 'OFF'}`, third + 14, height - 39, 18);
  text(`A/BRK ${data.autoBrake}`, third + tile * .48, 217, 17, flight.systems.autoBrake !== 'off' ? '#ffcf86' : '#7da6b4');
  text(data.speedHold ? `SPD ${Math.round(flight.systems.autothrottle.target * 3.6)}` : `TRIM ${Math.round(flight.systems.trim.pitch * 100)}`, third + tile * .48, 181, 17);
  if (airliner) {
    const fourth = gap * 4 + tile * 3;
    text('NAV / ISLAND', fourth + 14, 47, 20); text(`HDG ${data.heading}`, fourth + 14, 102, 28);
    text(`HOME`, fourth + 14, 153, 18, '#7da6b4'); text(`${(Math.hypot(flight.x, flight.z - RUNWAY.center) / 1000).toFixed(1)} KM`, fourth + 14, 190, 27);
    text('RWY 18 / 36', fourth + 14, 235, 21); text(flight.onGround ? 'GROUND' : 'AIRBORNE', fourth + 14, height - 39, 20, '#96efb0');
  }
}
