import { makeEnvironment } from './environment.js';

const LAYOUTS = ['连环山脊', '环形天坑', '双峰回旋', '海岸长弯', '高原阶梯'];

function mountainRoad(index) {
  const count = 6 + index % 3;
  const peak = 240 + index % 7 * 28;
  const family = index % LAYOUTS.length;
  const points = [];
  if (family === 0) {
    points.push([0, 20, 510]);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      points.push([210 + (i % 2 ? -70 : 130) + Math.sin(i + index) * 24, 25 + peak * t, 400 - t * 800]);
    }
    points.push([0, peak + 35, -520]);
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      points.push([-220 - (i % 2 ? -70 : 130) + Math.cos(i + index) * 30, 25 + peak * (1 - t), -400 + t * 800]);
    }
  } else {
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * Math.PI * 2;
      const phase = index * 0.19;
      let radius, x, z;
      if (family === 1) radius = 420 + 125 * Math.cos(4 * a + phase);
      if (family === 2) radius = 400 + 150 * Math.cos(2 * a) + 65 * Math.cos(6 * a + phase);
      if (family === 3) radius = 410 + 135 * Math.sin(3 * a + phase) + 60 * Math.sin(a);
      if (family === 4) {
        radius = 1 + 0.17 * Math.cos(6 * a + phase);
        x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.65 * 450 * radius;
        z = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.65 * 360 * radius;
      } else {
        x = Math.cos(a) * radius * (family === 3 ? 0.75 : 1);
        z = Math.sin(a) * radius * (family === 3 ? 1.4 : 1);
      }
      const y = 30 + peak * (0.42 * (1 - Math.cos(a * (family === 2 ? 2 : 1))) + 0.12 * (1 - Math.cos(a * 3)));
      points.push([x, y, z]);
    }
  }
  const angle = index * 0.43;
  return points.map(([x, y, z]) => {
    x *= 1 + index % 4 * 0.07;
    z *= 1 + index % 2 * 0.12;
    return [x * Math.cos(angle) - z * Math.sin(angle), y, x * Math.sin(angle) + z * Math.cos(angle)];
  });
}
const planets = [
  ['tranquility', '霁蓝星', '宁静天路', '沿灰蓝山脊爬升，在云海上方完成第一次高速交付。', 'ridge', '#ff9a66', '#091c30', '#29435b', 0.58, 0.16, 7000, 0, 45],
  ['eclipse', '紫晶星', '永夜晶谷', '紫晶石林围绕巨大天坑，沿环形山壁攀升归航。', 'crystal', '#c4a4ff', '#160d2b', '#342544', 0.74, 0.34, 7600, 1, 42],
  ['frontier', '赤砂星', '曙光赤岭', '翻越赤色双峰与层叠峡壁，在红色沙海上追逐曙光。', 'mesa', '#ffb36b', '#331b20', '#6c4539', 0.055, 0.5, 8200, 2, 40],
  ['glacier', '霜镜星', '极光冰脊', '冰蓝尖峰、银白路肩与冷色天幕，沿冰川连续上攀。', 'ice', '#8be7ff', '#0c2438', '#3b6474', 0.53, 0.22, 7400, 1, 47],
  ['verdant', '翡翠星', '苍翠云阶', '穿行异星林冠，沿高原阶梯俯瞰青绿色山海。', 'forest', '#a5edaf', '#092826', '#30574c', 0.37, 0.4, 8000, 1, 48],
  ['obsidian', '黑曜星', '熔火回廊', '玄武岩针峰与熔岩裂谷，橙红光轨勾勒险峻回头弯。', 'volcanic', '#ff846d', '#210c15', '#49232b', 0.98, 0.25, 8800, 2, 38],
  ['amber', '琥珀星', '金沙环峰', '巨大的行星环横过天空，金色岩柱守着蜿蜒山路。', 'sandstone', '#ffe0a0', '#2d2630', '#716050', 0.105, 0.42, 8400, 1, 43],
  ['tidal', '潮汐星', '深蓝悬岸', '从海崖起飞，绕过蓝色礁柱，在海面之上盘旋攀升。', 'ocean', '#7fe5d5', '#0a283b', '#245667', 0.49, 0.32, 9200, 2, 41],
  ['storm', '雷鸣星', '风暴之眼', '青紫天幕笼罩浮光针塔，长坡与连续弯道考验节奏。', 'storm', '#aab8ff', '#161e3a', '#394867', 0.64, 0.24, 9600, 2, 46],
  ['umbra', '永夜星', '星渊绝顶', '沿暗色高原的星光公路冲上山顶，再俯冲归航。', 'spires', '#f0bfff', '#0c0b21', '#262442', 0.72, 0.2, 10400, 2, 39],
  ['aurora', '极昼星', '极昼光廊', '翠绿极光悬在冰原上，穿过光幕下的连环山弯。', 'aurora', '#9bffe0', '#092d37', '#376577', 0.49, 0.18, 8200, 0, 36],
  ['dune', '流沙星', '沙海涡环', '金色沙丘包围环形盆地，石拱引向起伏的沙海长坡。', 'dunes', '#ffd18a', '#3e2430', '#8e6550', 0.09, 0.52, 9600, 1, 37],
  ['mycelium', '菌光星', '荧菌森径', '巨型发光菌伞照亮双峰林径，紫色穹盖掠过路肩。', 'fungal', '#ed9bff', '#160d31', '#453060', 0.77, 0.38, 8900, 1, 44],
  ['coral', '珊瑚星', '珊海曲岸', '粉色珊瑚树立在碧海上，沿狭长海岸连续切弯。', 'coral', '#ffa7bc', '#122c42', '#3a6670', 0.46, 0.3, 10800, 2, 49],
  ['salt', '盐晶星', '白盐天阶', '白色盐晶阶柱围住银灰高原，宽阔台地适合极速冲刺。', 'salt', '#e7f5ff', '#303749', '#858e9b', 0.58, 0.07, 9400, 1, 50],
  ['relic', '遗迹星', '巨环古道', '巨石拱门与残柱守望山谷，盘绕古老遗迹寻找归途。', 'ruins', '#eac39a', '#182529', '#515d57', 0.14, 0.19, 11800, 2, 51],
  ['magnetar', '磁暴星', '磁悬回廊', '磁环托起悬浮岩块，环绕青蓝天坑高速攀升。', 'magnetic', '#79ceff', '#10152f', '#344368', 0.64, 0.34, 10600, 2, 52],
  ['copper', '铜锈星', '赤铜工区', '铜色散热塔与信标沿双峰排列，飞越废弃星际工区。', 'industrial', '#ffac7c', '#302322', '#65534a', 0.045, 0.42, 12600, 2, 53],
  ['prism', '棱镜星', '虹晶绝壁', '彩色棱晶沿悬崖生长，在长弯与下坡间掠过虹光。', 'prism', '#bfb6ff', '#211936', '#60546e', 0.73, 0.25, 13200, 2, 54],
  ['singularity', '引力星', '星门终途', '多重星门矗立在暗色台阶高原，完成星图的最终航程。', 'stargate', '#89e9ff', '#070e23', '#1a304e', 0.61, 0.2, 14400, 2, 55],
];

export const MISSIONS = Object.freeze(planets.map(([id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty, root], index) => Object.freeze({
  id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty,
  number: String(index + 1).padStart(2, '0'), region: `${planet} · ${name}`, layout: LAYOUTS[index % LAYOUTS.length], label: ['入门', '进阶', '极限'][difficulty], variant: index,
  duration: 95 + difficulty * 10 + Math.floor(index / 3) * 5, cargo: 6 + difficulty * 2,
  par: Math.round(length / 180 + 7), gateWidth: 10.5 - difficulty, seed: 4517 + index * 4274,
  music: { root, bpm: 124 + index % 4 * 6 }, points: mountainRoad(index),
})));

export const CRAFTS = Object.freeze([
  { id: 'scout', model: 'LC–07', name: '游隼', role: '均衡型', description: '双矢量涡轮与前掠翼，1296 km/h 灵活切弯。', speed: 170, boostSpeed: 360, handling: 40, hull: 100, recharge: 11, color: '#ed703a', scale: [1, 1, 1] },
  { id: 'interceptor', model: 'LC–09', name: '光矛', role: '竞速型', description: '细长机身、尾部稳定鳍，1512 km/h 极限冲刺。', speed: 200, boostSpeed: 420, handling: 38, hull: 80, recharge: 9, color: '#a281ef', scale: [0.85, 0.9, 1.2] },
  { id: 'hauler', model: 'LC–12', name: '磐石', role: '重装型', description: '装甲货舱、宽翼推进器，1188 km/h 重载疾驰。', speed: 155, boostSpeed: 330, handling: 36, hull: 140, recharge: 15, color: '#54bbae', scale: [1.14, 1.1, 0.95] },
]);

export function makeCourse(mission) {
  const scale = mission.length / 1800;
  const phase = mission.variant;
  const gates = [270, 560, 850, 1140, 1430, 1720].map((distance, id) => ({ id, distance: distance * scale, lane: mission.difficulty ? ((id + phase) % 3 - 1) * (mission.difficulty + 3) : 0, width: mission.gateWidth }));
  const basePickups = [90, 160, 220, 345, 410, 490, 640, 705, 785, 935, 1000, 1080, 1220, 1290, 1370, 1510, 1580, 1650];
  const positions = mission.difficulty ? Array.from({ length: 24 }, (_, i) => (Math.floor(i / 4) + [0.18, 0.36, 0.57, 0.76][i % 4]) * mission.length / 6) : basePickups.map(distance => distance * scale);
  const lanes = mission.difficulty ? [0, -7, 7, 0, -7, 0, 7, 0] : [0, 0, -8, 8, 0, -8, 0, 8, 0, -8, 0, 8, 0, -8, 0, 8, 0, 0];
  const pickups = positions.map((distance, id) => ({ id, distance, lane: lanes[(id + phase) % lanes.length] }));
  const obstacles = [195, 380, 455, 610, 750, 900, 1050, 1190, 1330, 1480, 1620].map((distance, id) => ({ id, distance: distance * scale, lane: [8, -7, 7, 0, -8, 8, -8, 0, 8, -8, 7][(id + phase) % 11], radius: 2.8, kind: 'rock' }));
  if (mission.difficulty) {
    for (let i = 0; i < 4 + mission.difficulty; i++) obstacles.push({ id: obstacles.length, distance: (i + 0.52) * mission.length / 6, lane: 0, radius: 2.3, kind: 'drone', phase: i * 1.7 + phase * 0.5, frequency: 0.6 + mission.difficulty * 0.15 });
  }
  if (mission.difficulty === 2) {
    for (let i = 0; i < 5; i++) obstacles.push({ id: obstacles.length, distance: (i + 0.92) * mission.length / 6, lane: i % 2 ? -9 : 9, radius: 2.4, kind: 'rock' });
  }
  obstacles.sort((a, b) => a.distance - b.distance);
  const pads = [115, 520, 1100, 1550].map((distance, id) => ({ id, distance: distance * scale, lane: [0, 7, -7, 0][(id + phase) % 4] }));
  return { gates, pickups, obstacles, pads, ...makeEnvironment(mission) };
}
