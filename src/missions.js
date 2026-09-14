import { makeEnvironment } from './environment.js';

export const MISSIONS = Object.freeze([
  { id: 'tranquility', number: '01', name: '宁静海速递', region: '宁静海 · 第七运输区', label: '入门航线', description: '熟悉悬浮引擎，沿蓝色航标把能量送回宁静港。', length: 1800, duration: 90, cargo: 6, par: 49, difficulty: 0, gateWidth: 10.5, seed: 4517, color: '#ff9a66', sky: '#07121e', fog: '#172e40', ground: 0.59,
    points: [[0, 1, 215], [110, 2, 200], [195, 5, 120], [215, 9, 10], [165, 6, -100], [85, 2, -190], [-40, 1, -205], [-170, 3, -120], [-205, 6, 20], [-125, 2, 150]] },
  { id: 'eclipse', number: '02', name: '永夜峡谷', region: '月背 · 永夜观测站', label: '进阶航线', description: '深入紫色夜幕，跃过巡逻机，穿越错位的导航门。', length: 2100, duration: 100, cargo: 9, par: 58, difficulty: 1, gateWidth: 9, seed: 8791, color: '#bfa0ff', sky: '#0d0c20', fog: '#28223f', ground: 0.68,
    points: [[0, 2, 215], [105, 7, 200], [220, 18, 145], [145, 27, 30], [230, 12, -90], [100, 6, -210], [-70, 13, -230], [-220, 23, -95], [-130, 16, 10], [-190, 6, 145]] },
  { id: 'frontier', number: '03', name: '曙光前线', region: '风暴洋 · 曙光中继站', label: '专家航线', description: '在带电月尘中疾驰。更多巡逻机，更窄的门，更高的回报。', length: 2300, duration: 105, cargo: 10, par: 64, difficulty: 2, gateWidth: 8, seed: 12271, color: '#ffc66f', sky: '#1b1214', fog: '#4a3631', ground: 0.07,
    points: [[0, 3, 215], [120, 4, 210], [235, 14, 145], [180, 7, 30], [250, 18, -70], [130, 26, -225], [-35, 18, -175], [-225, 8, -155], [-230, 15, 35], [-115, 7, 165]] },
]);

export const CRAFTS = Object.freeze([
  { id: 'scout', model: 'LC–07', name: '游隼', role: '均衡型', description: '轻巧、灵活，适合第一次月面飞行。', speed: 36, boostSpeed: 57, handling: 16, hull: 100, recharge: 11, color: '#ed703a', scale: [1, 1, 1] },
  { id: 'interceptor', model: 'LC–09', name: '光矛', role: '竞速型', description: '更高极速，用精准驾驶交换极限速度。', speed: 43, boostSpeed: 69, handling: 14, hull: 80, recharge: 9, color: '#a281ef', scale: [0.85, 0.9, 1.2] },
  { id: 'hauler', model: 'LC–12', name: '磐石', role: '重装型', description: '厚重装甲与快速充能，容得下更多失误。', speed: 32, boostSpeed: 51, handling: 13, hull: 140, recharge: 15, color: '#54bbae', scale: [1.14, 1.1, 0.95] },
]);

export function makeCourse(mission) {
  const scale = mission.length / 1800;
  const gates = [270, 560, 850, 1140, 1430, 1720].map((distance, id) => ({ id, distance: distance * scale, lane: mission.difficulty ? (id % 3 - 1) * (mission.difficulty + 3) : 0, width: mission.gateWidth }));
  const basePickups = [90, 160, 220, 345, 410, 490, 640, 705, 785, 935, 1000, 1080, 1220, 1290, 1370, 1510, 1580, 1650];
  const positions = mission.difficulty ? Array.from({ length: 24 }, (_, i) => (Math.floor(i / 4) + [0.18, 0.36, 0.57, 0.76][i % 4]) * mission.length / 6) : basePickups;
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
