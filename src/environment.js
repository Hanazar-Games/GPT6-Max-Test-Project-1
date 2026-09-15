export const ENVIRONMENT = Object.freeze({ gravity: 17, lowGravity: 8, warning: 2.6, blast: 1, damage: 22, clearance: 3.2, craftRadius: 1.1 });

export function makeEnvironment(mission) {
  const scale = mission.length / 1800;
  const gravityZones = [[520, 675], [1200, 1350]].slice(0, mission.difficulty ? 2 : 1)
    .map(([start, end], id) => ({ id, start: start * scale, end: end * scale }));
  const meteors = [[430, -6], [980, 6], [1390, 0], [670, -7]].slice(0, 2 + mission.difficulty)
    .map(([distance, lane], id) => ({ id, distance: distance * scale, lane, radius: 5, first: distance * scale / 38 + id * 0.3, period: 10 - mission.difficulty * 0.8 }))
    .sort((a, b) => a.distance - b.distance);
  return { gravityZones, meteors };
}

export function gravityAt(course, distance) {
  return course.gravityZones.some(zone => distance >= zone.start && distance < zone.end) ? ENVIRONMENT.lowGravity : ENVIRONMENT.gravity;
}

export function meteorState(meteor, elapsed) {
  const cycle = Math.floor((elapsed - meteor.first + 1e-8) / meteor.period);
  const impactAt = meteor.first + cycle * meteor.period;
  const age = Math.max(0, elapsed - impactAt);
  if (cycle >= 0 && age < ENVIRONMENT.blast - 1e-8) return { phase: 'impact', impactAt, remaining: ENVIRONMENT.blast - age, progress: age / ENVIRONMENT.blast };
  if (cycle >= 0 && age < ENVIRONMENT.blast + 1.2) return { phase: 'afterglow', impactAt, remaining: 0, progress: (age - ENVIRONMENT.blast) / 1.2 };
  const next = meteor.first + Math.max(0, cycle + 1) * meteor.period;
  const remaining = Math.max(0, next - elapsed);
  return { phase: remaining <= ENVIRONMENT.warning + 1e-8 ? 'warning' : 'idle', impactAt: next, remaining, progress: Math.max(0, 1 - remaining / ENVIRONMENT.warning) };
}

export function meteorContact(meteor, before, after) {
  const dt = after.elapsed - before.elapsed;
  if (dt <= 0) return null;
  const dx = after.distance - before.distance;
  const dy = after.lane - before.lane;
  const x = before.distance - meteor.distance;
  const y = before.lane - meteor.lane;
  const travel = dx * dx + dy * dy;
  const offset = x * x + y * y - (meteor.radius + ENVIRONMENT.craftRadius) ** 2;
  const dot = x * dx + y * dy;
  const discriminant = dot * dot - travel * offset;
  if (travel ? discriminant <= 0 : offset >= 0) return null;
  const entry = travel ? (-dot - Math.sqrt(discriminant)) / travel : 0;
  const exit = travel ? (-dot + Math.sqrt(discriminant)) / travel : 1;
  const firstCycle = Math.max(0, Math.floor((before.elapsed - meteor.first) / meteor.period));
  for (let cycle = firstCycle; meteor.first + cycle * meteor.period < after.elapsed; cycle++) {
    const start = meteor.first + cycle * meteor.period;
    const from = Math.max(0, entry, (start - before.elapsed) / dt);
    const to = Math.min(1, exit, (start + ENVIRONMENT.blast - before.elapsed) / dt);
    if (from >= to) continue;
    const t = after.height >= before.height ? from : to;
    return { height: before.height + (after.height - before.height) * t, elapsed: before.elapsed + dt * t };
  }
  return null;
}

export function getMeteorCue(game) {
  for (const meteor of game.course.meteors) {
    const distance = meteor.distance - game.distance;
    if (distance < -meteor.radius - ENVIRONMENT.craftRadius || distance > 140) continue;
    const state = meteorState(meteor, game.elapsed);
    const arrival = Math.max(0, distance) / Math.max(1, game.speed);
    if (!['warning', 'impact'].includes(state.phase) && (arrival > 6 || meteorState(meteor, game.elapsed + arrival).phase !== 'impact')) continue;
    let danger = false;
    if (Math.abs(game.lane - meteor.lane) < meteor.radius + ENVIRONMENT.craftRadius) {
      let before = { elapsed: game.elapsed, distance: game.distance, lane: game.lane, height: game.height };
      let verticalSpeed = game.verticalSpeed;
      const horizon = game.speed > 0 ? Math.min(6, Math.max(0, distance + meteor.radius + ENVIRONMENT.craftRadius) / game.speed) : ENVIRONMENT.warning + ENVIRONMENT.blast;
      for (let time = 0; time < horizon; time += 1 / 60) {
        const dt = Math.min(1 / 60, horizon - time);
        verticalSpeed = before.height > 0 || verticalSpeed > 0 ? verticalSpeed - gravityAt(game.course, before.distance) * dt : 0;
        const after = { ...before, elapsed: before.elapsed + dt, distance: before.distance + game.speed * dt, height: Math.max(0, before.height + verticalSpeed * dt) };
        const contact = meteorContact(meteor, before, after);
        if (contact && contact.height < ENVIRONMENT.clearance) { danger = true; break; }
        before = after;
      }
    }
    return { kind: 'meteor', distance: Math.max(0, Math.ceil(distance)), remaining: state.remaining, phase: state.phase,
      danger };
  }
  return null;
}
