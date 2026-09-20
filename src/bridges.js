export const BRIDGE_NAMES = Object.freeze({ cable: '斜拉桥', suspension: '悬索桥', viaduct: '峡谷高架桥' });

export function makeBridgeSpans(length, variant) {
  const count = Math.ceil(length / 12000);
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const start = index ? (index + .15) * length / count : 1800;
    return Object.freeze({ id: index, start, end: start + 1200 + (index + variant) % 4 * 200,
      kind: ['cable', 'suspension', 'viaduct'][(index + variant) % 3], depth: 140 + (index + variant) % 4 * 35 });
  }));
}

export function bridgeAt(mission, distance) {
  return mission.bridges?.find(bridge => distance >= bridge.start && distance < bridge.end);
}

export function bridgeDepth(mission, distance) {
  const bridge = bridgeAt(mission, distance);
  if (!bridge) return 0;
  const t = Math.min(1, (distance - bridge.start) / 300, (bridge.end - distance) / 300);
  return bridge.depth * t * t * (3 - 2 * t);
}
