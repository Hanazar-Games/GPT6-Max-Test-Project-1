import { makeEnvironment } from './environment.js';

function mountainRoad(index) {
  const count = 6 + index % 3;
  const peak = 220 + index * 18;
  const points = [[0, 20, 510]];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    points.push([210 + (i % 2 ? -70 : 130) + Math.sin(i + index) * 24, 25 + peak * t, 400 - t * 800]);
  }
  points.push([0, peak + 35, -520]);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    points.push([-220 - (i % 2 ? -70 : 130) + Math.cos(i + index) * 30, 25 + peak * (1 - t), -400 + t * 800]);
  }
  const angle = index * 0.43;
  return points.map(([x, y, z]) => {
    x *= 1 + index % 4 * 0.07;
    z *= 1 + index % 2 * 0.12;
    return [x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)];
  });
}
const planets = [
  ['tranquility', '霁蓝星', '宁静天路', '沿灰蓝山脊爬升，在云海上方完成第一次高速交付。', 'ridge', '#ff9a66', '#091c30', '#29435b', 0.58, 0.16, 5000, 0, 45],
  ['eclipse', '紫晶星', '永夜晶谷', '紫晶石林包围连环发卡弯，冷光航标通往山顶观测站。', 'crystal', '#c4a4ff', '#160d2b', '#342544', 0.74, 0.34, 5400, 1, 42],
  ['frontier', '赤砂星', '曙光赤岭', '穿过铁锈色台地与层叠峡壁，在红色沙海上追逐曙光。', 'mesa', '#ffb36b', '#331b20', '#6c4539', 0.055, 0.5, 5800, 2, 40],
  ['glacier', '霜镜星', '极光冰脊', '冰蓝尖峰、银白路肩与冷色天幕，沿冰川连续上攀。', 'ice', '#8be7ff', '#0c2438', '#3b6474', 0.53, 0.22, 5200, 1, 47],
  ['verdant', '翡翠星', '苍翠云阶', '穿行发光的异星林冠，俯瞰深谷与青绿色山海。', 'forest', '#a5edaf', '#092826', '#30574c', 0.37, 0.4, 5600, 1, 48],
  ['obsidian', '黑曜星', '熔火回廊', '玄武岩针峰与熔岩裂谷，橙红光轨勾勒险峻回头弯。', 'volcanic', '#ff846d', '#210c15', '#49232b', 0.98, 0.25, 6200, 2, 38],
  ['amber', '琥珀星', '金沙环峰', '巨大的行星环横过天空，金色岩柱守着蜿蜒山路。', 'sandstone', '#ffe0a0', '#2d2630', '#716050', 0.105, 0.42, 5900, 1, 43],
  ['tidal', '潮汐星', '深蓝悬岸', '从海崖起飞，绕过蓝色礁柱，在海面之上盘旋攀升。', 'ocean', '#7fe5d5', '#0a283b', '#245667', 0.49, 0.32, 6400, 2, 41],
  ['storm', '雷鸣星', '风暴之眼', '青紫风暴笼罩浮光针塔，长坡与密集弯道考验节奏。', 'storm', '#aab8ff', '#161e3a', '#394867', 0.64, 0.24, 6700, 2, 46],
  ['umbra', '永夜星', '星渊绝顶', '最后一座暗色山脉。沿星光公路冲上最高峰，再俯冲归航。', 'spires', '#f0bfff', '#0c0b21', '#262442', 0.72, 0.2, 7200, 2, 39],
];

export const MISSIONS = Object.freeze(planets.map(([id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty, root], index) => Object.freeze({
  id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty,
  number: String(index + 1).padStart(2, '0'), region: `${planet} · ${name}`, label: ['开阔山路', '连续发卡弯', '极限山脊'][difficulty],
  duration: 95 + difficulty * 10 + Math.floor(index / 3) * 5, cargo: 6 + difficulty * 2,
  par: Math.round(length / 113 + 7), gateWidth: 10.5 - difficulty, seed: 4517 + index * 4274,
  music: { root, bpm: 124 + index % 4 * 6 }, points: mountainRoad(index),
})));

export const CRAFTS = Object.freeze([
  { id: 'scout', model: 'LC–07', name: '游隼', role: '均衡型', description: '双矢量涡轮与前掠翼，灵活切入连续山弯。', speed: 110, boostSpeed: 210, handling: 32, hull: 100, recharge: 11, color: '#ed703a', scale: [1, 1, 1] },
  { id: 'interceptor', model: 'LC–09', name: '光矛', role: '竞速型', description: '细长机身、尾部稳定鳍，864 km/h 极限冲刺。', speed: 132, boostSpeed: 240, handling: 30, hull: 80, recharge: 9, color: '#a281ef', scale: [0.85, 0.9, 1.2] },
  { id: 'hauler', model: 'LC–12', name: '磐石', role: '重装型', description: '装甲货舱、宽翼推进器，重载也能高速穿山。', speed: 100, boostSpeed: 185, handling: 28, hull: 140, recharge: 15, color: '#54bbae', scale: [1.14, 1.1, 0.95] },
]);

export function makeCourse(mission) {
  const scale = mission.length / 1800;
  const gates = [270, 560, 850, 1140, 1430, 1720].map((distance, id) => ({ id, distance: distance * scale, lane: mission.difficulty ? (id % 3 - 1) * (mission.difficulty + 3) : 0, width: mission.gateWidth }));
  const basePickups = [90, 160, 220, 345, 410, 490, 640, 705, 785, 935, 1000, 1080, 1220, 1290, 1370, 1510, 1580, 1650];
  const positions = mission.difficulty ? Array.from({ length: 24 }, (_, i) => (Math.floor(i / 4) + [0.18, 0.36, 0.57, 0.76][i % 4]) * mission.length / 6) : basePickups.map(distance => distance * scale);
  const lanes = mission.difficulty ? [0, -7, 7, 0, -7, 0, 7, 0] : [0, 0, -8, 8, 0, -8, 0, 8, 0, -8, 0, 8, 0, -8, 0, 8, 0, 0];
  const pickups = positions.map((distance, id) => ({ id, distance, lane: lanes[id % lanes.length] }));
  const obstacles = [195, 380, 455, 610, 750, 900, 1050, 1190, 1330, 1480, 1620].map((distance, id) => ({ id, distance: distance * scale, lane: [8, -7, 7, 0, -8, 8, -8, 0, 8, -8, 7][id], radius: 2.8, kind: 'rock' }));
  if (mission.difficulty) {
    for (let i = 0; i < 4 + mission.difficulty; i++) obstacles.push({ id: obstacles.length, distance: (i + 0.52) * mission.length / 6, lane: 0, radius: 2.3, kind: 'drone', phase: i * 1.7, frequency: 0.6 + mission.difficulty * 0.15 });
  }
  if (mission.difficulty === 2) {
    for (let i = 0; i < 5; i++) obstacles.push({ id: obstacles.length, distance: (i + 0.92) * mission.length / 6, lane: i % 2 ? -9 : 9, radius: 2.4, kind: 'rock' });
  }
  obstacles.sort((a, b) => a.distance - b.distance);
  const pads = [115, 520, 1100, 1550].map((distance, id) => ({ id, distance: distance * scale, lane: [0, 7, -7, 0][id] }));
  return { gates, pickups, obstacles, pads, ...makeEnvironment(mission) };
}
