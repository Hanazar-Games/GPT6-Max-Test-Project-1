import { makeEnvironment } from './environment.js';
import { makeSpecialCourse } from './special-courses.js';
import { makeBridgeSpans } from './bridges.js';
import { addRouteRewards } from './route-rewards.js';

const LAYOUTS = ['连环山脊', '环形天坑', '双峰回旋', '海岸长弯', '高原阶梯', '花瓣回湾', '锯齿群峰', '洲际连峰', '环陆群湾', '通天山桥', '峡湾悬廊', '星冠盘山', '叠湾天路', '云环叠岭', '双脊悬桥'];

function mountainRoad(index, family) {
  const count = 6 + index % 3;
  const peak = family >= 9 ? 1250 + index % 4 * 140 : 240 + index % 7 * 28;
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
    const samples = family >= 7 ? 180 : 40;
    for (let i = 0; i < samples; i++) {
      const a = i / samples * Math.PI * 2;
      const phase = index * 0.19;
      let radius, x, z;
      if (family === 1) radius = 420 + 125 * Math.cos(4 * a + phase);
      if (family === 2) radius = 400 + 150 * Math.cos(2 * a) + 65 * Math.cos(6 * a + phase);
      if (family === 3) radius = 410 + 135 * Math.sin(3 * a + phase) + 60 * Math.sin(a);
      if (family === 5) radius = 430 + 115 * Math.cos(5 * a + phase);
      if (family === 6) radius = 440 + 95 * Math.cos(7 * a + phase) + 50 * Math.sin(2 * a);
      if (family === 7) radius = 1300 + 260 * Math.cos(18 * a + phase) + 110 * Math.sin(3 * a);
      if (family === 8) radius = 1350 + 340 * Math.sin(12 * a + phase) + 140 * Math.cos(4 * a);
      if (family === 9) radius = 2500 + 500 * Math.cos(9 * a + phase) + 220 * Math.sin(3 * a);
      if (family === 10) radius = 2600 + 580 * Math.sin(8 * a + phase) + 260 * Math.cos(3 * a);
      if (family === 11) radius = 2000 + 430 * Math.cos(6 * a + phase) + 170 * Math.sin(3 * a);
      if (family === 12) radius = 2150 + 410 * Math.sin(5 * a + phase) + 180 * Math.cos(2 * a);
      if (family === 13) radius = 2100 + 320 * Math.cos(7 * a + phase) + 130 * Math.sin(2 * a);
      if (family === 14) radius = 2350 + 380 * Math.sin(6 * a + phase) + 170 * Math.cos(3 * a);
      if (family === 4) {
        radius = 1 + 0.17 * Math.cos(6 * a + phase);
        x = Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.65 * 450 * radius;
        z = Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.65 * 360 * radius;
      } else {
        x = Math.cos(a) * radius * (family === 3 ? 0.75 : family === 12 ? .85 : family === 14 ? 1.2 : 1);
        z = Math.sin(a) * radius * (family === 3 ? 1.4 : family === 12 ? 1.2 : family === 14 ? .85 : 1);
      }
      const climbs = family === 11 || family === 13 ? 3 : family === 12 || family === 14 ? 2 : family >= 7 ? 4 : family === 2 || family === 6 ? 2 : 1;
      const y = 30 + peak * (0.42 * (1 - Math.cos(a * climbs)) + 0.12 * (1 - Math.cos(a * 3)));
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
  ['singularity', '引力星', '星门终途', '多重星门矗立在暗色台阶高原，穿过引力边界继续远航。', 'stargate', '#89e9ff', '#070e23', '#1a304e', 0.61, 0.2, 14400, 2, 55],
  ['lotus', '莲雾星', '云莲回湾', '巨型莲瓣托起荧光花蕊，绕过五瓣山湾掠向青碧云海。', 'lotus', '#ffb6da', '#12322e', '#497a6e', 0.39, 0.32, 11200, 1, 56, 5],
  ['helios', '日冕星', '逐日环岭', '金色聚光镜追逐双日，穿越太阳能阵列旁的连续峰弯。', 'solar', '#ffe58a', '#362238', '#82614e', 0.085, 0.48, 13800, 2, 57, 6],
  ['vapor', '蒸汽星', '雾泉天脊', '青色热泉从阶状岩盆涌起，沿花瓣山脊交替爬升俯冲。', 'geyser', '#a2f0ec', '#16333f', '#507780', 0.5, 0.21, 12200, 1, 58, 5],
  ['zephyr', '长风星', '风翼群峰', '巨型三叶风塔沿峰顶列阵，在曲折长坡上释放全部推力。', 'wind', '#c4e9ff', '#203952', '#638494', 0.57, 0.2, 14200, 2, 59, 6],
  ['chronos', '时序星', '天文环山', '星象仪与天文穹顶守候山湾，绕过观星台继续远航。', 'observatory', '#ffd1a2', '#181832', '#514861', 0.7, 0.22, 14800, 2, 60, 5],
  ['bamboo', '青篁星', '万节云山', '穿越青玉竹塔与十八重山脊，沿洲际公路展开长途交付。', 'bamboo', '#b7f5b1', '#122e29', '#456b5a', 0.36, 0.36, 96000, 1, 34, 7],
  ['hive', '蜂巢星', '金巢群湾', '金色六边形巢柱沿山湾排列，在蜂巢群落之间高速巡航。', 'honeycomb', '#ffd27f', '#34202a', '#80604b', 0.09, 0.44, 99000, 1, 35, 8],
  ['orchard', '绯果星', '红冠远岭', '红冠异星果树点亮连绵高地，跨越漫长的起伏果林。', 'orchard', '#ff96ac', '#2d172e', '#715065', 0.88, 0.3, 102000, 1, 61, 7],
  ['signal', '回声星', '天线长岸', '抛物面天线向深空倾听，沿蓝色群湾追逐遥远的回声。', 'radar', '#8cd7ff', '#10283c', '#416581', 0.59, 0.32, 105000, 2, 62, 8],
  ['archive', '书卷星', '石页天梯', '层叠巨石书页横跨山脊，在古老星际档案之间连峰飞行。', 'archive', '#f1d4a4', '#292937', '#72716b', 0.12, 0.16, 108000, 1, 63, 7],
  ['reactor', '蓝核星', '聚变环陆', '蓝色反应堆与环形冷却架照亮长岸，穿越星球能源走廊。', 'reactor', '#8ff3ed', '#0b2832', '#365965', 0.52, 0.35, 111000, 2, 64, 8],
  ['fossil', '龙骨星', '巨骸山脊', '远古巨兽的弧形肋骨守望荒岭，在化石群间翻越长坡。', 'fossil', '#edc6ac', '#352630', '#7b675e', 0.065, 0.22, 114000, 2, 65, 7],
  ['sapphire', '蓝宝星', '宝冠千湾', '蓝宝石冠与金属基座沿千重山湾铺开，冷光引向远方。', 'sapphire', '#91b8ff', '#121a3d', '#3d507c', 0.64, 0.42, 117000, 2, 66, 8],
  ['terrace', '梯田星', '千阶天路', '青绿色梯台与水晶灌溉塔沿山展开，攀上大陆最高处。', 'terrace', '#c4ef8c', '#24352a', '#647852', 0.25, 0.32, 120000, 2, 67, 7],
  ['odyssey', '远航星', '航标天涯', '航海仪与高耸帆架标记群湾，完成跨越整片大陆的终站。', 'sails', '#e5b6ff', '#21142f', '#655273', 0.77, 0.25, 123000, 2, 68, 8],
  ['overdrive', '超频星', '无限加速环', '特殊航线 · 无障碍，全路宽加速带连续接力，按住油门享受免费极速。', 'accelerator', '#8cffe0', '#071f2c', '#285465', 0.5, 0.32, 96000, 0, 69, 8, 'boost'],
  ['apocalypse', '末日星', '余烬生还线', '特殊航线 · 密集碎岩与陨石封锁废土，跟随核心穿过交替的安全缺口。', 'wasteland', '#ffaf83', '#2c1017', '#743d37', 0.035, 0.35, 99000, 2, 33, 7, 'hazard'],
  ['earth', '地球', '绿野归航', '特殊航线 · 无障碍，蓝天白云下的绿意山路，穿过树林、草坡与花海。', 'earth', '#b7efac', '#8bc5df', '#b0cdb5', 0.29, 0.56, 102000, 0, 70, 8, 'garden'],
  ['meridian', '云脊星', '悬桥天脊', '超长山桥航线 · 翻越两千米云脊，驶过斜拉桥与峡谷高架，沿连峰天路归航。', 'viaduct', '#ffcc91', '#102b40', '#516d7c', 0.12, 0.23, 150000, 1, 71, 9],
  ['fjord', '霁峡星', '千湾悬索', '超长山桥航线 · 蓝色峡湾切开群峰，悬索桥跨过深谷，接入高低起伏的沿岸长弯。', 'fjord', '#91e9e5', '#123747', '#527d83', 0.47, 0.36, 168000, 1, 72, 10],
  ['badlands', '赭岳星', '赤壁天堑', '超长山桥航线 · 红褐峭壁与扶壁石塔层叠展开，高架桥连接漫长的山顶回旋。', 'buttress', '#ffb782', '#39252c', '#986b58', 0.055, 0.42, 186000, 2, 73, 9],
  ['icefall', '冰岚星', '冰川通天', '超长山桥航线 · 冰瀑尖峰和冷光桥塔守望深谷，从峡底爬升到银蓝色山巅。', 'icefall', '#b0e5ff', '#172d46', '#7a99af', 0.57, 0.18, 204000, 2, 74, 10],
  ['highland', '苍岭星', '云岭远廊', '超长山桥航线 · 绿色山岭间的中继林塔指向远方，连续桥梁串起整片高原。', 'relayforest', '#b8eeb2', '#173c37', '#668876', 0.34, 0.38, 222000, 1, 75, 9],
  ['summit', '天穹星', '万峰云桥', '超长山桥航线 · 240 公里跨越冠状群峰，悬索、斜拉与高架交替连接高山大陆。', 'crownridge', '#dabdff', '#241b3c', '#736584', 0.72, 0.25, 240000, 2, 76, 10],
  ['cascade', '云瀑星', '飞瀑穿峡', '20 km 探索线 · 冷光瀑帘与阶状水塔守望山湾，借助沿途道具穿过极速环与跃升环。', 'cascade', '#8ee9f5', '#153548', '#557d89', .51, .3, 20000, 1, 77, 5],
  ['regatta', '赤帆星', '风帆天路', '20 km 探索线 · 赤金翼帆沿峰顶排列，连续山弯与可选挑战环考验驾驶节奏。', 'regatta', '#ffc58a', '#36252d', '#8d6b5c', .07, .36, 20000, 2, 78, 6],
  ['lantern', '穹灯星', '光穹回廊', '20 km 探索线 · 巨型灯笼与光穹照亮长岸，拾取磁吸道具，挑战核心与技巧双连收。', 'lantern', '#f7b7de', '#281b3b', '#705b80', .78, .28, 20000, 1, 79, 3],
  ['marathon', '远岚星', '山海马拉松', '50 km 马拉松 · 跨越五段山桥与补给驿站，管理护盾、维修和磁吸，完成耐力交付。', 'waystation', '#cce99c', '#213c37', '#688875', .32, .32, 50000, 2, 80, 9],
  ['glasshaven', '琉璃星', '镜穹巡游', '24 km 入门拉力 · 玻璃穹顶与蓝色镜柱点亮花瓣山湾，在舒展长弯中熟悉道具与挑战环。', 'glassworks', '#a2eeff', '#163745', '#628b97', .52, .23, 24000, 0, 31, 5],
  ['bellspire', '鸣钟星', '钟塔回响', '32 km 山口拉力 · 巨型钟架守望锯齿峰群，沿连弯追逐金色极速环。', 'carillon', '#ffdb9e', '#312a3d', '#7f718b', .72, .23, 32000, 1, 32, 6],
  ['cloudreef', '云礁星', '浮礁长岸', '40 km 海岸拉力 · 层叠礁台与悬光浮珠沿长岸排列，连续上下坡串起补给与跃升挑战。', 'cloudreef', '#ffb6d6', '#263a51', '#7897aa', .57, .22, 40000, 1, 81, 3],
  ['astrolabe', '星仪星', '星冠天桥', '60 km 星冠盘山 · 六瓣峰湾环抱三重高岭，巨型星仪与跨谷桥指向山顶。', 'orrery', '#cdb7ff', '#221c3f', '#6b608e', .72, .3, 60000, 1, 82, 11],
  ['bluefen', '蓝泽星', '湿地悬廊', '72 km 叠湾天路 · 蓝绿色芦苇塔环绕双峰长湾，悬索与高架连接开阔高原。', 'reedbed', '#acecca', '#173e3c', '#5b8b7e', .42, .35, 72000, 1, 83, 12],
  ['emberforge', '铸火星', '炉心远征', '84 km 高山拉力 · 巨型熔炉与散热烟囱照亮星冠群峰，七座跨谷桥串起耐力交付。', 'forge', '#ffac81', '#3b202a', '#8d605d', .025, .35, 84000, 2, 84, 11],
  ['opalreach', '虹潮星', '虹潮环岭', '32 km 进阶拉力 · 贝壳光拱围绕七重云岭，收集电池与超频，练习精准穿环。', 'tidalglass', '#93efe6', '#163745', '#649296', .48, .3, 32000, 1, 85, 13, null, { advanced: true, mode: 'major', voice: 'triangle' }],
  ['orchidia', '兰庭星', '兰庭双脊', '56 km 花海山桥 · 巨型兰花与叶穹守护双峰，沿绿意悬桥完成花园拉力。', 'orchid', '#f6b6e0', '#203b38', '#73967c', .34, .42, 56000, 1, 86, 14, null, { advanced: true, mode: 'major' }],
  ['aqueduct', '澄渠星', '水镜长渠', '96 km 超长拉力 · 多层引水拱廊与水晶槽连接高岭，管理超频补给，挑战精准连锁。', 'aqueduct', '#9fd8ff', '#163248', '#627f98', .56, .27, 96000, 2, 87, 13, null, { advanced: true, voice: 'triangle' }],
  ['beacon', '烽航星', '灯塔远征', '128 km 灯塔马拉松 · 棱镜灯塔照亮双脊悬桥，沿漫长峰湾追逐终点信标。', 'beacons', '#ffd29b', '#2d2541', '#7b6c89', .72, .27, 128000, 2, 88, 14, null, { advanced: true }],
];

export const MISSIONS = Object.freeze(planets.map(([id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty, root, family, special, features = {}], index) => Object.freeze({
  id, planet, name, description, biome, color, sky, fog, ground, saturation, length, difficulty, special, advanced: !!features.advanced,
  number: String(index + 1).padStart(2, '0'), region: `${planet} · ${name}`, layout: LAYOUTS[family ?? index % 5], label: ({ boost: '全程加速', hazard: '障碍密集', garden: '无障碍观光' })[special] ?? ['入门', '进阶', '极限'][difficulty], variant: index,
  endurance: length >= 20000,
  tour: !!features.advanced || length >= 20000 && length < 90000,
  bridges: family >= 9 ? makeBridgeSpans(length, index) : Object.freeze([]),
  duration: length >= 20000 ? Math.ceil(length / 120) + 45 : 95 + difficulty * 10 + Math.floor(index / 3) * 5,
  cargo: length >= 150000 ? 42 + difficulty * 6 : length >= 90000 ? 24 + difficulty * 6 : length >= 20000 ? 18 + difficulty * 6 : 6 + difficulty * 2,
  par: Math.round(length / 180 + 7), gateWidth: 10.5 - difficulty, seed: 4517 + index * 4274,
  music: { root, bpm: special === 'garden' ? 112 : special === 'boost' ? 148 : 124 + index % 4 * 6, mode: features.mode ?? (special === 'garden' ? 'major' : 'minor'), voice: features.voice ?? 'sine' }, points: mountainRoad(index, family ?? index % 5),
})));

export const CRAFTS = Object.freeze([
  { id: 'scout', model: 'LC–07', name: '游隼', role: '均衡型', description: '双矢量涡轮与前掠翼，1296 km/h 灵活切弯。', speed: 170, boostSpeed: 360, handling: 40, hull: 100, recharge: 11, color: '#ed703a', scale: [1, 1, 1] },
  { id: 'interceptor', model: 'LC–09', name: '光矛', role: '竞速型', description: '细长机身、尾部稳定鳍，1512 km/h 极限冲刺。', speed: 200, boostSpeed: 420, handling: 38, hull: 80, recharge: 9, color: '#a281ef', scale: [0.85, 0.9, 1.2] },
  { id: 'hauler', model: 'LC–12', name: '磐石', role: '重装型', description: '装甲货舱、宽翼推进器，1188 km/h 重载疾驰。', speed: 155, boostSpeed: 330, handling: 36, hull: 140, recharge: 15, color: '#54bbae', scale: [1.14, 1.1, 0.95] },
  { id: 'viper', model: 'LC–14', name: '赤隼', role: '截击型', description: '分叉前翼与外置整流舱，1440 km/h 灵巧突进。', speed: 185, boostSpeed: 400, handling: 45, hull: 85, recharge: 10, color: '#ff6575', scale: [0.94, 0.9, 1.08] },
  { id: 'skimmer', model: 'LC–16', name: '雨燕', role: '弯道型', description: '四片矢量小翼与翼尖导流片，1332 km/h 精准切弯。', speed: 175, boostSpeed: 370, handling: 50, hull: 90, recharge: 12, color: '#8bdba1', scale: [0.9, 0.88, 0.98] },
  { id: 'manta', model: 'LC–18', name: '云鳐', role: '滑翔型', description: '一体三角翼与双翼脊，1404 km/h 稳定掠过山海。', speed: 190, boostSpeed: 390, handling: 42, hull: 105, recharge: 13, color: '#78c9ff', scale: [1.02, 0.85, 1] },
  { id: 'wraith', model: 'LC–21', name: '夜莺', role: '疾行型', description: '折线后掠翼与背部整流脊，1548 km/h 暗夜穿行。', speed: 205, boostSpeed: 430, handling: 39, hull: 85, recharge: 8, color: '#a99cff', scale: [0.95, 0.88, 1.12] },
  { id: 'bulwark', model: 'LC–24', name: '玄甲', role: '堡垒型', description: '双层侧盾与装甲背壳，1224 km/h 携重甲远征。', speed: 160, boostSpeed: 340, handling: 35, hull: 170, recharge: 14, color: '#d9b584', scale: [1.08, 1.05, 1] },
  { id: 'pulse', model: 'LC–27', name: '流萤', role: '续航型', description: '发光储能环与电容翼舱，1368 km/h 快速补充能量。', speed: 180, boostSpeed: 380, handling: 43, hull: 95, recharge: 19, color: '#7de9da', scale: [0.96, 1, 1.02] },
  { id: 'comet', model: 'LC–30', name: '彗星', role: '极速型', description: '双长矛翼与垂直稳定尾，1620 km/h 冲向速度极限。', speed: 215, boostSpeed: 450, handling: 37, hull: 75, recharge: 8, color: '#ffc46d', scale: [0.83, 0.9, 1.18] },
  { id: 'owl', model: 'LC–32', name: '雪鸮', role: '巡游型', description: '层叠羽翼与双肩整流片，1386 km/h 平稳穿越长路。', speed: 185, boostSpeed: 385, handling: 44, hull: 110, recharge: 16, color: '#c5e8f4', scale: [0.98, 0.95, 1.02] },
  { id: 'trident', model: 'LC–35', name: '三叉戟', role: '突进型', description: '三叉长鼻与外侧稳定架，1656 km/h 刺破山谷晨雾。', speed: 220, boostSpeed: 460, handling: 39, hull: 85, recharge: 10, color: '#ff9e79', scale: [0.86, 0.93, 1.12] },
  { id: 'dragonfly', model: 'LC–38', name: '蜻蜓', role: '灵巧型', description: '四片椭圆翼与翼尖灯，1393 km/h 灵敏横移避障。', speed: 182, boostSpeed: 387, handling: 54, hull: 85, recharge: 14, color: '#bce58c', scale: [0.92, 0.86, 0.97] },
  { id: 'nautilus', model: 'LC–40', name: '鹦鹉螺', role: '回充型', description: '同心电容背环与舱侧护板，1440 km/h 持久续航。', speed: 188, boostSpeed: 400, handling: 41, hull: 115, recharge: 21, color: '#8eebd8', scale: [1, 0.96, 1] },
  { id: 'blade', model: 'LC–43', name: '霜刃', role: '穿风型', description: '刀锋双翼与立式尾片，1602 km/h 高速切入长弯。', speed: 210, boostSpeed: 445, handling: 46, hull: 80, recharge: 9, color: '#95beff', scale: [0.88, 0.9, 1.1] },
  { id: 'whale', model: 'LC–46', name: '远鲸', role: '远行型', description: '双侧长舱与环抱支架，1332 km/h 兼顾装甲与充能。', speed: 175, boostSpeed: 370, handling: 37, hull: 155, recharge: 18, color: '#a8b5ed', scale: [1.06, 1, 1.03] },
  { id: 'paladin', model: 'LC–49', name: '圣盾', role: '护卫型', description: '楔形盾翼与背部装甲脊，1296 km/h 守护长途交付。', speed: 165, boostSpeed: 360, handling: 36, hull: 190, recharge: 15, color: '#ebce9a', scale: [1.08, 1.04, 0.98] },
  { id: 'specter', model: 'LC–52', name: '幽影', role: '掠袭型', description: '菱形折翼与双叉尾，1638 km/h 掠过夜色群峰。', speed: 218, boostSpeed: 455, handling: 42, hull: 90, recharge: 9, color: '#c29aeb', scale: [0.91, 0.88, 1.08] },
  { id: 'sunbird', model: 'LC–56', name: '金乌', role: '蓄能型', description: '分段太阳翼与尾部能量扇，1512 km/h 均衡长航。', speed: 200, boostSpeed: 420, handling: 43, hull: 100, recharge: 20, color: '#ffd06f', scale: [0.96, 0.93, 1] },
  { id: 'nova', model: 'LC–60', name: '新星', role: '超速型', description: '箭形侧翼与三棱背鳍，1728 km/h 驶向遥远新世界。', speed: 230, boostSpeed: 480, handling: 38, hull: 75, recharge: 8, color: '#ff99cb', scale: [0.86, 0.9, 1.16] },
  { id: 'kestrel', model: 'LC–63', name: '隼羽', role: '山路型', description: '双层折翼与外倾翼梢，1674 km/h 穿越连峰山桥。', speed: 215, boostSpeed: 465, handling: 49, hull: 85, recharge: 11, color: '#ffc08f', scale: [0.94, 0.94, 1.04] },
  { id: 'albatross', model: 'LC–66', name: '信天翁', role: '巡天型', description: '连体环翼与长肩支架，1494 km/h 从容掠过深谷。', speed: 205, boostSpeed: 415, handling: 42, hull: 125, recharge: 18, color: '#bde6ff', scale: [0.96, 0.9, 1.06] },
  { id: 'lynx', model: 'LC–69', name: '山猫', role: '矢量型', description: '四座涵道悬浮舱与短翼骨架，1422 km/h 灵巧横移。', speed: 185, boostSpeed: 395, handling: 52, hull: 105, recharge: 15, color: '#a4edbe', scale: [0.92, 0.95, 0.96] },
  { id: 'tortoise', model: 'LC–72', name: '山岳', role: '工程型', description: '履带状重甲浮筏与外露承力框，1260 km/h、210 装甲稳行远路。', speed: 170, boostSpeed: 350, handling: 36, hull: 210, recharge: 17, color: '#deb98b', scale: [1.04, 1.03, 1.02] },
  { id: 'arrow', model: 'LC–75', name: '穿云', role: '破风型', description: '分体前掠长翼与双竖尾，1710 km/h 掠过桥塔云层。', speed: 225, boostSpeed: 475, handling: 40, hull: 85, recharge: 12, color: '#bba5ff', scale: [0.9, 0.92, 1.13] },
  { id: 'atlas', model: 'LC–78', name: '驮星', role: '科考型', description: '双层科考货架与环形蓄能舱，1458 km/h、22/s 充能适合洲际长航。', speed: 195, boostSpeed: 405, handling: 40, hull: 160, recharge: 22, color: '#79daca', scale: [1.02, 1, 1.02] },
  { id: 'osprey', model: 'LC–81', name: '鱼鹰', role: '旋翼型', description: '双倾转涵道与桥式翼架，1584 km/h 稳定跨越山口。', speed: 202, boostSpeed: 440, handling: 47, hull: 105, recharge: 15, color: '#82d9ee', scale: [.94, .96, 1.03] },
  { id: 'hammerhead', model: 'LC–84', name: '锤鲨', role: '破障型', description: '横向锤形前舱与双层保险框，1368 km/h、200 装甲护航马拉松。', speed: 180, boostSpeed: 380, handling: 38, hull: 200, recharge: 18, color: '#e8b780', scale: [1.04, 1.03, .97] },
  { id: 'sailfish', model: 'LC–87', name: '旗鱼', role: '追风型', description: '高背帆鳍与分段剪翼，1692 km/h 抢占极速挑战环。', speed: 222, boostSpeed: 470, handling: 44, hull: 82, recharge: 10, color: '#d6a0f5', scale: [.9, .91, 1.1] },
  { id: 'firecrest', model: 'LC–90', name: '火冠', role: '补给型', description: '四枚球形储能舱与护环，1476 km/h 灵巧收集沿途补给。', speed: 192, boostSpeed: 410, handling: 48, hull: 98, recharge: 20, color: '#f4d68c', scale: [.96, .94, 1] },
  { id: 'bat', model: 'LC–93', name: '狐蝠', role: '巡弯型', description: '折线膜翼与外露翼骨，1566 km/h 灵巧切入连续山弯。', speed: 208, boostSpeed: 435, handling: 51, hull: 90, recharge: 12, color: '#c6abf2', scale: [.93, .91, 1.02] },
  { id: 'mantis', model: 'LC–96', name: '螳螂', role: '长矛型', description: '双折臂长矛与肩部关节，1685 km/h 追逐直道光环。', speed: 224, boostSpeed: 468, handling: 43, hull: 88, recharge: 10, color: '#b6df87', scale: [.9, .92, 1.05] },
  { id: 'petrel', model: 'LC–99', name: '海燕', role: '双翼型', description: '上下双层弧翼与翼间支柱，1490 km/h 平稳穿越峡谷。', speed: 198, boostSpeed: 414, handling: 46, hull: 120, recharge: 17, color: '#91d7f2', scale: [.95, .92, 1.02] },
  { id: 'rhino', model: 'LC–102', name: '犀甲', role: '护航型', description: '分段楔甲与前置防撞犀角，1296 km/h、205 装甲护航山桥。', speed: 174, boostSpeed: 360, handling: 37, hull: 205, recharge: 19, color: '#d9b899', scale: [1.02, 1, .98] },
  { id: 'hummingbird', model: 'LC–105', name: '蜂鸟', role: '轻旋型', description: '竖置双环与短矢量翼，1451 km/h、53 机动迅捷拾取道具。', speed: 190, boostSpeed: 403, handling: 53, hull: 84, recharge: 16, color: '#f4bcce', scale: [.9, .9, .98] },
  { id: 'medusa', model: 'LC–108', name: '水母', role: '电容型', description: '发光穹舱与弧形导能须，1447 km/h、21/s 充能适合长途。', speed: 193, boostSpeed: 402, handling: 44, hull: 130, recharge: 21, color: '#99e6d5', scale: [.98, .94, 1.01] },
  { id: 'crane', model: 'LC–111', name: '云鹤', role: '巡岭型', description: '上扬长翼与羽状导流片，1591 km/h 平稳飞越云岭。', speed: 212, boostSpeed: 442, handling: 46, hull: 115, recharge: 18, color: '#d7eaff', scale: [.96, .93, 1.04] },
  { id: 'scorpion', model: 'LC–114', name: '天蝎', role: '锐锋型', description: '双钳前翼与分段弯尾，1685 km/h 追逐精准光环。', speed: 225, boostSpeed: 468, handling: 40, hull: 90, recharge: 11, color: '#ffac8e', scale: [.92, .9, 1.06] },
  { id: 'beetle', model: 'LC–117', name: '金龟', role: '储备型', description: '双穹装甲与六足侧架，1354 km/h、22/s 充能守护耐力航程。', speed: 180, boostSpeed: 376, handling: 38, hull: 195, recharge: 22, color: '#e6d28a', scale: [1, .96, 1] },
  { id: 'butterfly', model: 'LC–120', name: '蝶翼', role: '精控型', description: '四瓣弧翼与发光翼脉，1469 km/h、56 机动灵巧对准环心。', speed: 196, boostSpeed: 408, handling: 56, hull: 90, recharge: 17, color: '#ccafff', scale: [.93, .9, 1] },
]);

export function makeCourse(mission) {
  return addRouteRewards(makeBaseCourse(mission), mission);
}

function makeBaseCourse(mission) {
  if (mission.special) return makeSpecialCourse(mission);
  if (mission.endurance) {
    const blocks = Math.ceil(mission.length / 12000);
    const blockLength = mission.length / blocks;
    const course = makeBaseCourse({ ...mission, endurance: false });
    for (const key of ['pickups', 'obstacles', 'pads', 'meteors', 'gravityZones']) course[key] = [];
    for (let block = 0; block < blocks; block++) {
      const segment = makeBaseCourse({ ...mission, endurance: false, length: blockLength, variant: mission.variant + block });
      const offset = block * blockLength;
      for (const key of ['pickups', 'obstacles', 'pads', 'meteors', 'gravityZones']) {
        for (const item of segment[key]) course[key].push(key === 'gravityZones'
          ? { ...item, id: course[key].length, start: item.start + offset, end: item.end + offset }
          : { ...item, id: course[key].length, distance: item.distance + offset, ...(key === 'meteors' ? { first: item.first + offset / 175 } : {}) });
      }
      course.obstacles.push({ id: course.obstacles.length, distance: offset + blockLength * 0.98, lane: block % 2 ? 9 : -9, radius: 2.8, kind: 'rock' });
    }
    return course;
  }
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
