import { createGame, startGame, updateGame, obstacleLane, isJumpReady } from './game.js';
import { FlightRecorder } from './ghost.js';
import { meteorState, ENVIRONMENT } from './environment.js';
import { firstAtOrAfter } from './route-rewards.js';
import { TRAFFIC_SPEED, trafficNear, trafficPose } from './traffic.js';
import { steeringResponse } from './flight-motion.js';
import { verticalAt } from './vertical-motion.js';

export const RACERS = Object.freeze([
  Object.freeze({ id: 'aurora', name: '迎光', color: '#8ee9f5', coast: 0, offset: -1.4, style: '持续推进' }),
  Object.freeze({ id: 'cobalt', name: '钴蓝', color: '#bda2ff', coast: 0.8, offset: 0, style: '稳健航行' }),
  Object.freeze({ id: 'ember', name: '余烬', color: '#ffe097', coast: 1.4, offset: 1.4, style: '谨慎入弯' }),
]);

export function pilotInput(game, racer) {
  let upcoming;
  for (const objects of [game.course.pickups, game.course.gates]) {
    const object = objects[firstAtOrAfter(objects, game.distance - 2)];
    if (object && (!upcoming || object.distance < upcoming.distance)) upcoming = object;
  }
  const speed = Math.max(game.speed, game.craft.speed * 0.5);
  const travelSpeed = Math.max(1, game.speed);
  const gate = game.course.gates[game.gates];
  const gateApproach = gate && gate.distance - game.distance < speed * 1.1;
  if (gateApproach) upcoming = gate;
  const desired = (upcoming?.lane ?? 0) + racer.offset;
  const nearby = item => item.distance > game.distance - 4 && item.distance < game.distance + speed * 1.5 && (!gateApproach || item.distance < gate.distance - 6);
  const local = items => items.slice(firstAtOrAfter(items, game.distance - 4), firstAtOrAfter(items, game.distance + speed * 1.5));
  const threats = local(game.course.obstacles).filter(nearby).map(item => {
    const arrival = Math.max(0, item.distance - game.distance) / travelSpeed;
    return { lane: obstacleLane(item, game.elapsed + arrival), radius: item.radius + 1.7, arrival, clearance: 2.5 };
  });
  for (const vehicle of trafficNear(game.course.traffic, game.elapsed, game.mission.length, game.distance - 4, game.distance + speed * 1.5).filter(nearby)) {
    if (upcoming && vehicle.distance - vehicle.length / 2 > upcoming.distance + speed * .15) continue;
    const arrival = Math.max(0, vehicle.distance - game.distance - vehicle.length / 2 - 3) / Math.max(1, travelSpeed - TRAFFIC_SPEED);
    const pose = trafficPose(vehicle, game.elapsed + arrival);
    threats.push({ lane: pose.lane, radius: vehicle.radius + 1.7 + Math.abs(pose.slope) * vehicle.length / 2, arrival, clearance: vehicle.clearance });
  }
  for (const item of local(game.course.meteors).filter(nearby)) {
    const arrival = Math.max(0, item.distance - game.distance) / travelSpeed;
    const radius = item.radius + ENVIRONMENT.craftRadius + 1;
    if ([-radius / speed, 0, radius / speed].some(offset => meteorState(item, game.elapsed + arrival + offset).phase === 'impact')) {
      threats.push({ lane: item.lane, radius, arrival, clearance: ENVIRONMENT.clearance });
    }
  }
  const response = steeringResponse(game), settings = game.drivingSettings;
  const limit = game.craft.handling * settings.steeringPower * (1 - settings.highSpeedStability * Math.min(1, game.speed / game.craft.boostSpeed) ** 2);
  const futureLane = (target, time) => {
    const catchTime = -Math.expm1(-response * time) / response;
    const reach = limit * (time - catchTime);
    return game.lane + game.lateralSpeed * catchTime + Math.max(-reach, Math.min(reach, target - game.lane));
  };
  const heightAt = time => verticalAt(game.course, game, game.distance + game.speed * time, time).height;
  for (const threat of threats) threat.low = heightAt(threat.arrival) < threat.clearance;
  const danger = (target, threat) => threat.low && Math.abs(futureLane(target, threat.arrival) - threat.lane) < threat.radius;
  const cost = target => Math.abs(target - desired) + Math.abs(target - game.lane) * 0.25 + (gateApproach && Math.abs(target - gate.lane) > gate.width - 1 ? 2500 : 0) + threats.reduce((sum, threat) => sum + (threat.low ? ((Math.abs(target - threat.lane) < threat.radius ? 100 : 0) + (danger(target, threat) ? 15 : 0)) / Math.max(0.3, threat.arrival) : 0), 0);
  let target = desired;
  if (threats.length) for (const lane of [-11, -7, 0, 7, 11]) if (cost(lane) < cost(target)) target = lane;
  const jump = isJumpReady(game) && threats.some(threat => threat.arrival > .35 && threat.arrival < .65 && danger(target, threat));
  const brake = !jump && game.speed > 60 && threats.some(threat => threat.arrival < .45 && danger(target, threat));
  const steer = Math.max(-1, Math.min(1, (target - game.lane - game.lateralSpeed / response) * .6));
  return { accelerate: game.elapsed % 8 < 8 - racer.coast, steer: Math.sign(steer) * Math.abs(steer) ** (1 / game.drivingSettings.inputCurve), jump, brake };
}

export function buildField(missionId, craftId, trafficSettings, drivingSettings) {
  return Object.freeze(RACERS.map(racer => {
    const game = createGame(missionId, craftId, {}, trafficSettings, drivingSettings);
    startGame(game);
    const recorder = new FlightRecorder(game);
    for (let step = 0; step < (game.mission.duration + 4) * 60 && ['countdown', 'running'].includes(game.status); step++) {
      updateGame(game, pilotInput(game, racer), 1 / 60);
      recorder.capture(game);
    }
    const trace = recorder.finish(game) ?? Object.freeze({ samples: Object.freeze(recorder.samples), splits: Object.freeze(recorder.splits) });
    return Object.freeze({ ...racer, missionId, craftId, trace, status: game.status, time: game.elapsed, distance: game.distance, cargo: game.collected.size, gates: game.gates, reason: game.reason });
  }));
}
