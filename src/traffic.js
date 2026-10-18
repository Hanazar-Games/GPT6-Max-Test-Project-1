import { firstAtOrAfter } from './route-rewards.js';

export const TRAFFIC_SPEED = 24;
export const TRAFFIC_ROAD_HEIGHT = -.36;
export const TRAFFIC_TYPES = Object.freeze({
  car: Object.freeze({ name: '轿车', width: 2.2, length: 4.8, height: 1.8, damage: 18 }),
  van: Object.freeze({ name: '厢式车', width: 2.5, length: 6.4, height: 2.8, damage: 22 }),
  truck: Object.freeze({ name: '重型货车', width: 3, length: 10, height: 4.5, damage: 30 }),
  semi: Object.freeze({ name: '半挂卡车', width: 3, length: 19, height: 4.5, damage: 32 }),
});
export const DEFAULT_TRAFFIC_SETTINGS = Object.freeze({ density: 8, mix: Object.freeze({ car: 15, van: 15, truck: 30, semi: 40 }) });
const TYPES = Object.keys(TRAFFIC_TYPES);
const clamp = (value, fallback, maximum) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(maximum, Number(value))) : fallback;

function allocate(weights, total) {
  const sum = TYPES.reduce((sum, type) => sum + (weights[type] ?? 0), 0);
  const shares = TYPES.map(type => ({ type, exact: sum ? (weights[type] ?? 0) / sum * total : 0 }));
  const result = Object.fromEntries(shares.map(({ type, exact }) => [type, Math.floor(exact)]));
  let remaining = sum ? total - Object.values(result).reduce((sum, value) => sum + value, 0) : 0;
  shares.sort((a, b) => (b.exact % 1) - (a.exact % 1));
  for (const { type } of shares) if (remaining-- > 0) result[type]++;
  return result;
}

export function normalizeTrafficSettings(settings = {}) {
  const mix = settings.mix === undefined ? DEFAULT_TRAFFIC_SETTINGS.mix : settings.mix ?? {};
  return { density: Math.round(clamp(settings.density ?? 8, 8, 12)), mix: allocate(Object.fromEntries(TYPES.map(type => [type, clamp(mix[type] ?? 0, 0, 100)])), 100) };
}

export function setTrafficShare(settings, type, value) {
  const result = normalizeTrafficSettings(settings);
  if (!TYPES.includes(type)) return result;
  const share = Math.round(clamp(value, 0, 100));
  result.mix[type] = 0;
  if (Object.values(result.mix).some(Boolean)) {
    result.mix = allocate(result.mix, 100 - share);
    result.mix[type] = share;
  } else result.mix[type] = share ? 100 : 0;
  return result;
}

export const trafficAllowed = mission => !mission.special || mission.special === 'hazard';
export const trafficKey = ({ density, mix } = DEFAULT_TRAFFIC_SETTINGS) => density && (mix.car || mix.van || mix.truck || mix.semi) ? `${density}:${mix.car}:${mix.van}:${mix.truck}:${mix.semi}` : 'off';
export const trafficDistance = (vehicle, elapsed) => vehicle.distance + (elapsed - (vehicle.at ?? 0)) * TRAFFIC_SPEED;

export function makeTraffic(mission, settings) {
  const { density, mix } = normalizeTrafficSettings(settings);
  const count = Math.floor(mission.length * density / 1000);
  if (!trafficAllowed(mission) || !count || !Object.values(mix).some(Boolean)) return [];
  let seed = (mission.seed ^ 0x7a3f215b) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const fleet = Object.entries(allocate(mix, count)).flatMap(([type, count]) => Array(count).fill(type));
  for (let i = fleet.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [fleet[i], fleet[j]] = [fleet[j], fleet[i]]; }
  return fleet.map((type, id) => ({ ...TRAFFIC_TYPES[type], id, type, kind: 'traffic',
    radius: TRAFFIC_TYPES[type].width / 2, clearance: TRAFFIC_TYPES[type].height + TRAFFIC_ROAD_HEIGHT - 1.3,
    distance: (id + .5 + (random() - .5) * .3) * mission.length / count, lane: id % 2 ? 11 : -11, tint: Math.floor(random() * 6) }));
}

export function trafficNear(vehicles = [], elapsed, length, from, to) {
  if (!vehicles.length || from > to) return [];
  const travel = elapsed * TRAFFIC_SPEED, start = from - travel, end = to - travel, result = [];
  for (let lap = Math.floor(start / length); lap <= Math.floor(end / length); lap++) {
    const offset = lap * length;
    for (let i = firstAtOrAfter(vehicles, Math.max(0, start - offset)); i < vehicles.length && vehicles[i].distance <= end - offset; i++) {
      result.push({ ...vehicles[i], distance: vehicles[i].distance + offset + travel, at: elapsed });
    }
  }
  return result;
}
