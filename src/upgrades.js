export const UPGRADES = Object.freeze([
  { id: 'engine', name: '矢量引擎', symbol: 'ϟ', cost: 3, description: '每级巡航 +4 m/s · 冲刺 +6 m/s' },
  { id: 'reactor', name: '回流电容', symbol: '↻', cost: 2, description: '每级每秒充能 +5 · 更快重启冲刺' },
  { id: 'armor', name: '复合装甲', symbol: '◇', cost: 2, description: '每级装甲上限 +30 · 提高容错' },
  { id: 'magnet', name: '牵引磁场', symbol: '◎', cost: 3, description: '每级核心吸附半径 +1.2 m · 高空无效' },
].map(item => Object.freeze({ ...item, max: 2 })));

export function upgradeLevels(levels = {}) {
  for (const [id, level] of Object.entries(levels)) {
    const upgrade = UPGRADES.find(item => item.id === id);
    if (!upgrade || !Number.isInteger(level) || level < 0 || level > upgrade.max) throw new RangeError('Invalid craft upgrade');
  }
  return Object.freeze(Object.fromEntries(Object.entries(levels).filter(([, level]) => level > 0)));
}

export function upgradeCraft(craft, levels = {}) {
  const { engine = 0, reactor = 0, armor = 0, magnet = 0 } = upgradeLevels(levels);
  return { ...craft, speed: craft.speed + engine * 4, boostSpeed: craft.boostSpeed + engine * 6,
    recharge: craft.recharge + reactor * 5, hull: craft.hull + armor * 30, pickupRange: 3.7 + magnet * 1.2 };
}
