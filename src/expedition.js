import { MISSIONS, CRAFTS } from './missions.js';
import { UPGRADES, upgradeLevels } from './upgrades.js';

export function createExpedition(craftId) {
  if (!CRAFTS.some(craft => craft.id === craftId)) throw new RangeError('Unknown expedition craft');
  return { craftId, stage: 0, status: 'flying', supply: 0, upgrades: upgradeLevels(), legs: [] };
}

export function getContracts(game) {
  const final = game.mission.difficulty === 2;
  return [
    { id: 'cargo', name: '额外补给', target: game.mission.cargo + (final ? 4 : 3), progress: game.collected.size, hint: '多收集蓝色核心' },
    { id: 'precision', name: '精准领航', target: final ? 5 : 4, progress: game.perfectGates, hint: '高速穿过门中央' },
    game.mission.difficulty === 1
      ? { id: 'dodge', name: '低空侦察', target: 1, progress: game.airDodges, hint: '按 F 跃过一处障碍' }
      : { id: 'pads', name: '能源勘探', target: 2, progress: game.activatedPads.size, hint: '驶过两条绿色加速带' },
  ].map(item => ({ ...item, reward: 2, done: item.progress >= item.target }));
}

export function settleExpedition(run, game) {
  const mission = MISSIONS[run.stage];
  if (run.status !== 'flying' || game.status !== 'won' || game.mission.id !== mission.id || game.craft.id !== run.craftId || game.distance !== mission.length || game.gates !== game.course.gates.length || game.collected.size < mission.cargo || UPGRADES.some(item => (run.upgrades[item.id] ?? 0) !== (game.upgrades[item.id] ?? 0))) return null;
  const contracts = Object.freeze(getContracts(game).map(Object.freeze));
  const earned = 2 + contracts.reduce((sum, item) => sum + (item.done ? item.reward : 0), 0);
  const leg = Object.freeze({ missionId: mission.id, contracts, earned, time: game.elapsed, score: game.score });
  run.legs.push(leg);
  run.supply += earned;
  run.status = run.stage === MISSIONS.length - 1 ? 'complete' : 'resupply';
  return leg;
}

export function buyUpgrade(run, id) {
  const upgrade = UPGRADES.find(item => item.id === id);
  if (run.status !== 'resupply' || !upgrade || run.supply < upgrade.cost || (run.upgrades[id] ?? 0) >= upgrade.max) return false;
  run.upgrades = upgradeLevels({ ...run.upgrades, [id]: (run.upgrades[id] ?? 0) + 1 });
  run.supply -= upgrade.cost;
  return true;
}

export function advanceExpedition(run) {
  if (run.status !== 'resupply') return false;
  run.stage++;
  run.status = 'flying';
  return true;
}
