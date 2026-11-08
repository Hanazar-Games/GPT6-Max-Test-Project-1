export const RUNWAY = Object.freeze({ width: 100, start: 1600, end: -2800 });
export const TAXIWAYS = Object.freeze([
  { x: -170, z: -550, width: 32, depth: 4000 },
  ...[1300, -1400, -2500].map(z => ({ x: -85, z, width: 170, depth: 30 })),
  { x: 160, z: 1250, width: 320, depth: 30 },
].map(Object.freeze));
export const AIRPORT_BUILDINGS = Object.freeze([
  { kind: 'terminal', x: -440, z: -100, width: 220, depth: 680, height: 49 },
  { kind: 'terminal-wing', x: -340, z: 310, width: 220, depth: 70, height: 27 },
  ...[600, 900].map(z => ({ kind: 'hangar', x: 400, z, width: 180, depth: 190, height: 51 })),
  { kind: 'tower', x: -240, z: -700, width: 48, depth: 48, height: 113 },
  ...[-360, -150, 60, 270].flatMap(z => [
    { kind: 'jetway', x: -277, z, width: 94, depth: 9, base: 7, height: 13 },
    { kind: 'jetway', x: -224, z, width: 12, depth: 18, base: 4, height: 15 },
  ]),
  { kind: 'depot', x: -700, z: -650, width: 200, depth: 120, height: 24 },
  { kind: 'fuel', x: 580, z: 1200, width: 120, depth: 120, height: 20 },
  ...Array.from({ length: 70 }, (_, index) => ({ kind: 'city', x: -1300 - index % 10 * 110, z: 700 + Math.floor(index / 10) * 150, width: 60, depth: 70, height: 35 + index * 37 % 105 })),
].map(building => Object.freeze({ base: 0, ...building })));
export const AIRPORT_BOUNDS = Object.freeze(AIRPORT_BUILDINGS.reduce((bounds, building) => ({
  x: Math.max(bounds.x, Math.abs(building.x) + building.width / 2 + 100),
  z: Math.max(bounds.z, Math.abs(building.z) + building.depth / 2 + 100),
}), { x: 0, z: 0 }));
