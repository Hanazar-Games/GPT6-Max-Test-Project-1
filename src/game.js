import { MISSIONS, CRAFTS, makeCourse } from './missions.js';
import { upgradeLevels, upgradeCraft } from './upgrades.js';
import { ENVIRONMENT, gravityAt, meteorState, meteorContact, predictHeight, getMeteorCue } from './environment.js';

export const PHYSICS = Object.freeze({ width: 15, jumpCost: 18, jumpCooldown: 1.6, gravity: ENVIRONMENT.gravity });

export function createGame(missionId = 'tranquility', craftId = 'scout', levels = {}) {
  const mission = MISSIONS.find(item => item.id === missionId);
  const base = CRAFTS.find(item => item.id === craftId);
  if (!mission || !base) throw new RangeError('Unknown mission or craft');
  const upgrades = upgradeLevels(levels);
  const craft = upgradeCraft(base, upgrades);
  return {
    mission, craft, upgrades, course: makeCourse(mission),
    status: 'menu', previousStatus: 'running', countdown: 3,
    distance: 0, lane: 0, lateralSpeed: 0, speed: 0,
    time: mission.duration, hull: craft.hull, energy: 100, boosting: false, boostLocked: false,
    gates: 0, collected: new Set(), score: 0, immunity: 0,
    height: 0, verticalSpeed: 0, jumpCooldown: 0, jumpHeld: false,
    combo: 0, maxCombo: 0, perfectGates: 0, airDodges: 0, impacts: 0,
    missedPickups: new Set(), passedObstacles: new Set(), activatedPads: new Set(), padBoost: 0,
    meteorDodges: 0, glides: 0, resolvedMeteors: new Set(), pendingMeteorDodges: new Set(), clearedZones: new Set(), meteorWarnings: new Set(),
    reason: '', events: [], elapsed: 0,
  };
}

export function startGame(game) {
  Object.assign(game, createGame(game.mission.id, game.craft.id, game.upgrades), { status: 'countdown' });
}

export function togglePause(game) {
  game.events = [];
  if (game.status === 'paused') game.status = game.previousStatus;
  else if (game.status === 'running' || game.status === 'countdown') {
    game.previousStatus = game.status;
    game.status = 'paused';
    game.boosting = false;
  }
}

function impact(game, damage, source = 'obstacle') {
  if (game.immunity > 0) return;
  game.hull = Math.max(0, game.hull - damage);
  game.speed *= 0.45;
  game.padBoost = 0;
  game.combo = 0;
  game.impacts++;
  game.immunity = 1.2;
  game.events.push({ type: 'impact', source });
}

export function obstacleLane(obstacle, elapsed) {
  return obstacle.kind === 'drone' ? Math.sin(elapsed * obstacle.frequency + obstacle.phase) * 10 : obstacle.lane;
}

export function getFlightCue(game) {
  const hazard = game.course.obstacles.find(obstacle => {
    const distance = obstacle.distance - game.distance;
    if (game.speed < 3 || distance < 0 || distance > game.speed * 1.6) return false;
    const arrival = distance / game.speed;
    const height = predictHeight(game, arrival);
    return height < 2.5 && Math.abs(game.lane - obstacleLane(obstacle, game.elapsed + arrival)) < obstacle.radius + 1.6;
  });
  const meteor = getMeteorCue(game);
  if (meteor && (!hazard || meteor.danger && meteor.distance < hazard.distance - game.distance)) return meteor;
  if (hazard) return { kind: 'hazard', distance: Math.ceil(hazard.distance - game.distance), hazard: hazard.kind };
  const gate = game.course.gates[game.gates];
  if (!gate) return { kind: 'finish', distance: Math.ceil(game.mission.length - game.distance) };
  const offset = gate.lane - game.lane;
  return { kind: 'gate', direction: Math.abs(offset) < 2.5 ? 'center' : offset < 0 ? 'left' : 'right', aligned: Math.abs(offset) < gate.width, offset };
}

export function getDebrief(game) {
  const medals = [];
  if (game.status === 'won') {
    medals.push({ name: '使命必达', symbol: '◇' });
    if (game.impacts === 0) medals.push({ name: '无伤航行', symbol: '♧' });
    if (game.elapsed <= game.mission.par) medals.push({ name: '追光者', symbol: 'ϟ' });
    if (game.perfectGates >= 4) medals.push({ name: '精准领航', symbol: '◎' });
    if (game.collected.size >= Math.ceil(game.course.pickups.length * 0.8)) medals.push({ name: '满载而归', symbol: '✦' });
    if (game.airDodges >= 2) medals.push({ name: '低空舞者', symbol: '↟' });
    if (game.meteorDodges >= 1) medals.push({ name: '踏星而行', symbol: '☄' });
    if (game.glides >= 1) medals.push({ name: '引力旅人', symbol: '⌁' });
  }
  return { medals, rank: game.status !== 'won' ? '—' : medals.length >= 4 ? 'S' : medals.length >= 2 ? 'A' : 'B' };
}

export function updateGame(game, input, delta) {
  game.events = [];
  if (!['running', 'countdown'].includes(game.status)) return;
  const dt = Math.max(0, Math.min(delta, 0.1, game.status === 'running' ? game.time : Infinity));
  if (game.status === 'countdown') {
    game.countdown = Math.max(0, game.countdown - dt);
    if (game.countdown <= 0) {
      game.status = 'running';
      game.events.push({ type: 'launch' });
    }
    return;
  }

  const previous = { elapsed: game.elapsed, distance: game.distance, lane: game.lane, height: game.height };
  game.time = Math.max(0, game.time - dt);
  game.elapsed += dt;
  game.immunity = Math.max(0, game.immunity - dt);
  game.padBoost = Math.max(0, game.padBoost - dt);
  game.jumpCooldown = Math.max(0, game.jumpCooldown - dt);
  if (input.jump && !game.jumpHeld && game.height === 0 && game.jumpCooldown === 0 && game.energy >= PHYSICS.jumpCost) {
    game.verticalSpeed = 11;
    game.energy -= PHYSICS.jumpCost;
    game.jumpCooldown = PHYSICS.jumpCooldown;
    game.events.push({ type: 'jump' });
  }
  game.jumpHeld = !!input.jump;
  if (game.height > 0 || game.verticalSpeed > 0) {
    game.verticalSpeed -= gravityAt(game.course, game.distance) * dt;
    game.height = Math.max(0, game.height + game.verticalSpeed * dt);
    if (game.height === 0) { game.verticalSpeed = 0; game.events.push({ type: 'land' }); }
  }
  if (!input.boost) game.boostLocked = false;
  else if (game.energy <= 1) game.boostLocked = true;
  const manualBoost = !!input.boost && !input.brake && !game.boostLocked && game.energy > 1;
  game.boosting = !input.brake && (manualBoost || game.padBoost > 0);
  const targetSpeed = input.brake ? 0 : game.boosting ? game.craft.boostSpeed : input.accelerate ? game.craft.speed : 0;
  const acceleration = input.brake ? 40 : targetSpeed > game.speed ? (game.boosting ? 32 : 20) : 9;
  game.speed += Math.sign(targetSpeed - game.speed) * Math.min(Math.abs(targetSpeed - game.speed), acceleration * dt);
  game.energy = Math.max(0, Math.min(100, game.energy + (manualBoost ? -25 : game.craft.recharge) * dt));

  const steer = Math.max(-1, Math.min(1, input.steer || 0));
  game.lateralSpeed += (steer * (game.speed > 1 ? game.craft.handling : 6) - game.lateralSpeed) * Math.min(1, dt * 9);
  game.lane += game.lateralSpeed * dt;
  if (Math.abs(game.lane) > PHYSICS.width) {
    game.lane = Math.sign(game.lane) * PHYSICS.width;
    game.lateralSpeed = 0;
    impact(game, 8);
  }
  if (game.hull <= 0) { game.status = 'lost'; game.reason = 'hull'; return; }

  const before = game.distance;
  game.distance = Math.min(game.mission.length, game.distance + game.speed * dt);
  const crosses = (distance, margin = 0) => before <= distance + margin && game.distance >= distance - margin;

  for (const pickup of game.course.pickups) {
    if (!game.collected.has(pickup.id) && crosses(pickup.distance, 2) && Math.abs(game.lane - pickup.lane) < game.craft.pickupRange && game.height < 2.3) {
      game.collected.add(pickup.id);
      game.energy = Math.min(100, game.energy + 22);
      game.hull = Math.min(game.craft.hull, game.hull + 4);
      game.combo++;
      game.maxCombo = Math.max(game.maxCombo, game.combo);
      const points = 150 * Math.min(3, 1 + Math.floor((game.combo - 1) / 3) * 0.5);
      game.score += points;
      game.events.push({ type: 'pickup', points });
    } else if (!game.collected.has(pickup.id) && !game.missedPickups.has(pickup.id) && crosses(pickup.distance + 4)) {
      game.missedPickups.add(pickup.id);
      game.combo = 0;
    }
  }
  for (const obstacle of game.course.obstacles) {
    if (crosses(obstacle.distance, 3) && Math.abs(game.lane - obstacleLane(obstacle, game.elapsed)) < obstacle.radius + 1.1) {
      if (game.height < 2.5) {
        impact(game, obstacle.kind === 'drone' ? 28 : 24);
        game.passedObstacles.add(obstacle.id);
      }
      else if (crosses(obstacle.distance) && !game.passedObstacles.has(obstacle.id)) {
        game.passedObstacles.add(obstacle.id);
        game.airDodges++;
        game.score += 120;
        game.events.push({ type: 'dodge', points: 120 });
      }
    }
  }
  for (const pad of game.course.pads) {
    if (!input.brake && !game.activatedPads.has(pad.id) && crosses(pad.distance, 3) && Math.abs(game.lane - pad.lane) < 4 && game.height < 0.5) {
      game.activatedPads.add(pad.id);
      game.padBoost = 1.8;
      game.speed = Math.max(game.speed, game.craft.speed + 7);
      game.energy = Math.min(100, game.energy + 15);
      game.events.push({ type: 'pad' });
    }
  }

  for (const meteor of game.course.meteors) {
    const state = meteorState(meteor, game.elapsed);
    const warningKey = `${meteor.id}/${state.impactAt}`;
    if (state.phase === 'warning' && meteor.distance >= game.distance - 8 && meteor.distance < game.distance + 140 && !game.meteorWarnings.has(warningKey)) {
      game.meteorWarnings.add(warningKey);
      game.events.push({ type: 'meteor-warning' });
    }
    if (state.phase === 'impact' && previous.elapsed < state.impactAt && game.elapsed >= state.impactAt && Math.abs(meteor.distance - game.distance) < 140) {
      game.events.push({ type: 'meteor-strike', distance: meteor.distance, lane: meteor.lane });
    }
    const contact = meteorContact(meteor, previous, game);
    if (contact?.height < ENVIRONMENT.clearance) {
      impact(game, ENVIRONMENT.damage, 'meteor');
      game.resolvedMeteors.add(meteor.id);
      game.pendingMeteorDodges.delete(meteor.id);
    } else if (contact && !game.resolvedMeteors.has(meteor.id)) game.pendingMeteorDodges.add(meteor.id);
    const inside = Math.hypot(game.distance - meteor.distance, game.lane - meteor.lane) < meteor.radius + ENVIRONMENT.craftRadius;
    if (game.pendingMeteorDodges.has(meteor.id) && (!inside || state.phase !== 'impact')) {
      game.pendingMeteorDodges.delete(meteor.id);
      game.resolvedMeteors.add(meteor.id);
      game.meteorDodges++;
      game.score += 180;
      game.events.push({ type: 'meteor-dodge', points: 180 });
    }
  }
  for (const zone of game.course.gravityZones) {
    if (before < zone.start && game.distance >= zone.start) game.events.push({ type: 'low-gravity' });
    if (before < zone.end && game.distance >= zone.end && !game.clearedZones.has(zone.id)) {
      game.clearedZones.add(zone.id);
      const height = previous.height + (game.height - previous.height) * (zone.end - before) / (game.distance - before);
      if (height >= ENVIRONMENT.clearance) {
        game.glides++;
        game.score += 200;
        game.events.push({ type: 'glide', points: 200 });
      }
    }
  }

  const gate = game.course.gates[game.gates];
  if (gate && crosses(gate.distance)) {
    if (Math.abs(game.lane - gate.lane) < gate.width) {
      const perfect = Math.abs(game.lane - gate.lane) < 2.5 && game.speed >= game.craft.speed * 0.8;
      game.gates++;
      if (perfect) game.perfectGates++;
      game.score += perfect ? 500 : 300;
      game.events.push({ type: 'gate', number: game.gates, perfect });
    } else {
      game.distance = gate.distance - 35;
      game.lane = gate.lane;
      game.speed = 0;
      game.lateralSpeed = 0;
      game.height = 0;
      game.verticalSpeed = 0;
      game.padBoost = 0;
      game.combo = 0;
      for (const id of game.pendingMeteorDodges) game.resolvedMeteors.add(id);
      game.pendingMeteorDodges.clear();
      game.time = Math.max(0, game.time - 4);
      game.events.push({ type: 'miss' });
    }
  }

  if (game.hull <= 0 || game.time <= 0) {
    game.status = 'lost';
    game.reason = game.hull <= 0 ? 'hull' : 'time';
  } else if (game.distance >= game.mission.length) {
    game.status = game.gates === game.course.gates.length && game.collected.size >= game.mission.cargo ? 'won' : 'lost';
    game.reason = game.status === 'won' ? '' : game.collected.size < game.mission.cargo ? 'cargo' : 'gates';
    if (game.status === 'won') game.score += Math.round(game.time * 25 + game.hull / game.craft.hull * 1000);
  }
  if (game.status === 'won' || game.status === 'lost') game.boosting = false;
}
