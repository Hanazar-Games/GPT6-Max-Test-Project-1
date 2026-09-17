import { createGame, startGame, updateGame, obstacleLane } from './game.js';
import { FlightRecorder } from './ghost.js';
import { meteorState, ENVIRONMENT } from './environment.js';

export const RACERS = Object.freeze([
  Object.freeze({ id: 'aurora', name: '迎光', color: '#8ee9f5', coast: 0, offset: -1.4, style: '持续推进' }),
  Object.freeze({ id: 'cobalt', name: '钴蓝', color: '#bda2ff', coast: 0.8, offset: 0, style: '稳健航行' }),
  Object.freeze({ id: 'ember', name: '余烬', color: '#ffe097', coast: 1.4, offset: 1.4, style: '谨慎入弯' }),
]);

export function pilotInput(game, racer) {
  let upcoming;
  for (const objects of [game.course.pickups, game.course.gates]) {
    let low = 0, high = objects.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (objects[middle].distance < game.distance - 2) low = middle + 1;
      else high = middle;
    }
    const object = objects[low];
    if (object && (!upcoming || object.distance < upcoming.distance)) upcoming = object;
  }
  const speed = Math.max(game.speed, game.craft.speed * 0.5);
  const gate = game.course.gates[game.gates];
  const gateApproach = gate && gate.distance - game.distance < speed * 1.1;
  if (gateApproach) upcoming = gate;
  const desired = (upcoming?.lane ?? 0) + racer.offset;
  const nearby = item => item.distance > game.distance - 4 && item.distance < game.distance + speed * 1.5 && (!gateApproach || item.distance < gate.distance - 6);
  const threats = game.course.obstacles.filter(nearby).map(item => {
    const arrival = Math.max(0, item.distance - game.distance) / speed;
    return { lane: obstacleLane(item, game.elapsed + arrival), radius: item.radius + 1.7, arrival };
  });
  for (const item of game.course.meteors.filter(nearby)) {
    const arrival = Math.max(0, item.distance - game.distance) / speed;
    const radius = item.radius + ENVIRONMENT.craftRadius + 1;
    if ([-radius / speed, 0, radius / speed].some(offset => meteorState(item, game.elapsed + arrival + offset).phase === 'impact')) {
      threats.push({ lane: item.lane, radius, arrival });
    }
  }
  const futureLane = (target, time) => game.lane + Math.max(-game.craft.handling * Math.max(0, time - 0.12), Math.min(game.craft.handling * Math.max(0, time - 0.12), target - game.lane));
  const cost = target => Math.abs(target - desired) + Math.abs(target - game.lane) * 0.25 + (gateApproach && Math.abs(target - gate.lane) > gate.width - 1 ? 2500 : 0) + threats.reduce((sum, threat) => sum + (Math.abs(target - threat.lane) < threat.radius ? 100 / Math.max(0.3, threat.arrival) : 0), 0);
  let target = desired;
  if (threats.length) for (const lane of [-11, -7, 0, 7, 11]) if (cost(lane) < cost(target)) target = lane;
  const jump = game.height === 0 && threats.some(threat => threat.arrival > 0.35 && threat.arrival < 0.65 && Math.abs(futureLane(target, threat.arrival) - threat.lane) < threat.radius);
  return { accelerate: game.elapsed % 8 < 8 - racer.coast, steer: Math.max(-1, Math.min(1, (target - game.lane) * 0.6)), jump };
}

export function buildField(missionId, craftId) {
  return Object.freeze(RACERS.map(racer => {
    const game = createGame(missionId, craftId);
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
