import { coastingLane } from './flight-motion.js';

export const POWERUPS = Object.freeze({
  shield: { name: '护盾', color: '#89cfff', duration: 12, description: '12 秒内抵挡一次碰撞' },
  magnet: { name: '磁吸', color: '#ddabff', duration: 8, description: '8 秒内核心吸附范围至少 9 米' },
  repair: { name: '维修', color: '#99f2b0', description: '恢复 35 装甲与 30 能量' },
  battery: { name: '电池', color: '#ffe58b', description: '立即恢复 60 能量' },
  overdrive: { name: '超频', color: '#ffb184', duration: 5, description: '5 秒免费冲刺，制动优先；受损或漏门解除' },
});

export const CHALLENGES = Object.freeze({
  speed: { name: '极速环', color: '#ffe28c', width: 3.5, points: 200 },
  jump: { name: '跃升环', color: '#d4afff', width: 3.5, points: 350 },
  precision: { name: '精准环', color: '#8ffff1', width: 1.5, points: 450 },
});

export const pickupRange = game => game.magnetTime > 0 ? Math.max(9, game.craft.pickupRange) : game.craft.pickupRange;

export function getRewardProgress(game) {
  const supplies = game.course.powerups.filter(item => item.distance >= game.distance - 3 && !game.powerupsTaken.has(item.id));
  const challengesAhead = game.course.challenges.filter(item => item.distance >= game.distance && !game.challengesResolved.has(item.id)).length;
  return { powerupsAhead: supplies.length, nextPowerup: supplies[0] ?? null, challengesAhead };
}

export function getSpeedRingCue(game) {
  if (game.height >= 2.3) return { action: 'descend', text: '先回低空 · 高度需低于 2.3m' };
  const missing = game.craft.speed * .9 - game.speed;
  return missing > 0 ? { action: 'accelerate', text: `继续加速 · 还差 ${Math.ceil(missing * 3.6)} km/h` } : { action: 'ready', text: '速度达标 · 保持低空对准环心' };
}

export function rewardCue(game) {
  const limit = game.distance + Math.max(180, game.speed * 2);
  let next = null, kind;
  for (const [items, resolved, type] of [[game.course.powerups, game.powerupsTaken, 'powerup'], [game.course.challenges, game.challengesResolved, 'challenge']]) {
    for (let i = firstAtOrAfter(items, game.distance); i < items.length; i++) {
      const item = items[i];
      if (item.distance > limit || next && item.distance >= next.distance) break;
      if (!resolved.has(item.id)) { next = item; kind = type; break; }
    }
  }
  if (!next) return null;
  const distance = next.distance - game.distance;
  const projected = kind === 'challenge' && game.speed > 0 && distance <= Math.max(45, game.speed * .8);
  const offset = next.lane - (projected ? coastingLane(game, distance / game.speed) : game.lane);
  const width = kind === 'challenge' ? CHALLENGES[next.kind].width : 3;
  const aligned = Math.abs(offset) < width;
  return { ...next, kind, reward: next.kind, distance, offset, aligned, projected,
    direction: aligned ? 'center' : offset < 0 ? 'left' : 'right',
    drifting: projected && Math.abs(next.lane - game.lane) < width && !aligned };
}

export function addRouteRewards(course, mission) {
  if (!mission.tour) return { ...course, powerups: [], challenges: [] };
  const powerups = [], challenges = [], blocks = mission.special ? 1 : Math.ceil(mission.length / 12000);
  const span = mission.length / blocks;
  for (let block = 0; block < blocks; block++) {
    const slots = mission.advanced
      ? [[.08, 'shield'], [.19, 'speed'], [.3, 'battery'], [.41, 'magnet'], [.53, 'jump'], [.65, 'overdrive'], [.77, 'precision'], [.89, 'repair']]
      : [[.1, 'shield'], [.25, 'speed'], [.4, 'magnet'], [.62, 'jump'], [.74, 'repair']];
    for (const [fraction, kind] of slots) {
      let distance = (block + fraction) * span;
      while (course.gates.some(gate => Math.abs(gate.distance - distance) <= 230)) distance += 50;
      const list = POWERUPS[kind] ? powerups : challenges;
      list.push({ id: list.length, kind, distance, lane: mission.special === 'hazard' ? 0 : (list.length % 3 - 1) * 7 });
    }
  }
  const rewards = [...powerups, ...challenges];
  course.obstacles = course.obstacles.filter(item => rewards.every(reward => Math.abs(reward.distance - item.distance) > 150));
  course.meteors = course.meteors.filter(item => rewards.every(reward => Math.abs(reward.distance - item.distance) > 150));
  return { ...course, powerups, challenges };
}

export function firstAtOrAfter(items, distance) {
  let low = 0, high = items.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (items[middle].distance < distance) low = middle + 1;
    else high = middle;
  }
  return low;
}
