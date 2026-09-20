import { MISSIONS, CRAFTS } from './missions.js';
import { upgradeCraft } from './upgrades.js';

const fastestSpeed = Math.max(...CRAFTS.map(craft => upgradeCraft(craft, { engine: 2 }).boostSpeed));
export const minimumDriveMinutes = mission => Math.floor(mission.length / fastestSpeed / 60);
export const minimumDriveLabel = mission => minimumDriveMinutes(mission) ? `≥${minimumDriveMinutes(mission)} 分钟` : `≥${Math.floor(mission.length / fastestSpeed)} 秒`;

export const MISSION_CATEGORIES = [
  { id: 'all', label: '全部', matches: () => true },
  { id: 'short', label: '短途', matches: mission => !mission.endurance },
  { id: 'long', label: '长途', matches: mission => mission.endurance },
  { id: 'tour', label: '道具挑战', matches: mission => mission.tour },
  { id: 'bridges', label: '山桥长线', matches: mission => mission.bridges.length > 0 },
  { id: 'clear', label: '无障碍', matches: mission => ['boost', 'garden'].includes(mission.special) },
  { id: 'hazard', label: '障碍密集', matches: mission => mission.special === 'hazard' },
];

const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/(\d+(?:\.\d+)?)\s*(?:km|公里|千米)/g, (_, distance) => `${Number(distance)}km`);
const terms = query => normalize(query).split(/\s+/).filter(Boolean);
const matches = (text, queryTerms) => queryTerms.every(term => normalize(text).includes(term));

export function filterMissions(query = '', category = 'all') {
  const queryTerms = terms(query);
  const distances = queryTerms.filter(term => /^\d+(?:\.\d+)?km$/.test(term));
  const words = queryTerms.filter(term => !distances.includes(term));
  const group = MISSION_CATEGORIES.find(item => item.id === category);
  return MISSIONS.filter(mission => group.matches(mission) && distances.every(term => Number(term.slice(0, -2)) * 1000 === mission.length) && matches(
    `${mission.planet} ${mission.name} ${mission.layout} ${mission.label} ${mission.description} ${mission.tour ? '道具挑战' : ''} ${mission.endurance ? `长途 ${minimumDriveLabel(mission).replace(/\s/g, '')}` : '短途'}`, words,
  ));
}

export function filterCrafts(query = '', sort = 'catalogue') {
  const queryTerms = terms(query);
  const result = CRAFTS.filter(craft => matches(`${craft.model} ${craft.name} ${craft.role} ${craft.description}`, queryTerms));
  return sort === 'catalogue' ? result : result.sort((a, b) => b[sort] - a[sort]);
}
