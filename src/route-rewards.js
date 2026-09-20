export const POWERUPS = Object.freeze({
  shield: { name: '护盾', color: '#89cfff', description: '12 秒内抵挡一次碰撞' },
  magnet: { name: '磁吸', color: '#ddabff', description: '8 秒内核心吸附范围至少 9 米' },
  repair: { name: '维修', color: '#99f2b0', description: '恢复 35 装甲与 30 能量' },
});

export const pickupRange = game => game.magnetTime > 0 ? Math.max(9, game.craft.pickupRange) : game.craft.pickupRange;

export function rewardCue(game) {
  const candidates = [
    ...game.course.powerups.filter(item => !game.powerupsTaken.has(item.id)).map(item => ({ ...item, kind: 'powerup', reward: item.kind })),
    ...game.course.challenges.filter(item => !game.challengesResolved.has(item.id)).map(item => ({ ...item, kind: 'challenge', reward: item.kind })),
  ].filter(item => item.distance >= game.distance && item.distance - game.distance <= Math.max(180, game.speed * 2));
  const next = candidates.sort((a, b) => a.distance - b.distance)[0];
  if (!next) return null;
  const offset = next.lane - game.lane;
  return { ...next, distance: Math.ceil(next.distance - game.distance), direction: Math.abs(offset) < 3 ? 'center' : offset < 0 ? 'left' : 'right' };
}

export function addRouteRewards(course, mission) {
  if (!mission.tour) return { ...course, powerups: [], challenges: [] };
  const powerups = [], challenges = [], blocks = mission.special ? 1 : Math.ceil(mission.length / 12000);
  const span = mission.length / blocks;
  for (let block = 0; block < blocks; block++) {
    const slots = [[.1, 'shield'], [.25, 'speed'], [.4, 'magnet'], [.62, 'jump'], [.74, 'repair']];
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
