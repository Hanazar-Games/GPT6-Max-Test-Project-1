import { firstAtOrAfter } from './route-rewards.js';

const BLEND = 140, BUFFER = 15;

export function createTrafficPaths(obstacles, length) {
  const groups = [];
  for (const rock of obstacles.filter(obstacle => obstacle.kind === 'rock')) {
    const group = groups.at(-1);
    if (group && rock.distance - group.end < 120) {
      group.end = rock.distance;
      group.rocks.push(rock);
    } else groups.push({ start: rock.distance, end: rock.distance, rocks: [rock] });
  }
  return new Map([-11, 11].map(homeLane => {
    const points = [], side = Math.sign(homeLane);
    if (!groups.length) return [homeLane, { points, length }];
    const zones = groups.map(group => {
      const lane = [homeLane, side * 14, side * 6, 0, -side * 6, -side * 14, -homeLane].find(lane => group.rocks.every(rock => Math.abs(lane - rock.lane) >= rock.radius + 1.9));
      if (lane === undefined) throw new RangeError('No passable traffic lane');
      return { start: group.start - BUFFER, end: group.end + BUFFER, lane };
    });
    const add = (distance, lane) => {
      if (points.at(-1)?.distance !== distance) points.push({ distance, lane });
    };
    let previous;
    for (const lap of [-1, 0, 1]) for (const zone of zones) {
      const start = zone.start + lap * length, end = zone.end + lap * length;
      if (previous && start - previous.end >= BLEND * 2) {
        add(previous.end + BLEND, homeLane);
        add(start - BLEND, homeLane);
      }
      add(start, zone.lane);
      add(end, zone.lane);
      previous = { end };
    }
    return [homeLane, { points, length }];
  }));
}

export function sampleTrafficPath(path, distance, homeLane) {
  if (!path?.points.length) return { lane: homeLane, slope: 0 };
  const at = (distance % path.length + path.length) % path.length;
  const index = firstAtOrAfter(path.points, at);
  const before = path.points[index - 1], after = path.points[index];
  const span = after.distance - before.distance, t = (at - before.distance) / span;
  const change = after.lane - before.lane;
  return { lane: before.lane + change * t ** 3 * (10 - 15 * t + 6 * t ** 2), slope: change * 30 * t ** 2 * (1 - t) ** 2 / span };
}
