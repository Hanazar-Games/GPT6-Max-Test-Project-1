import { CatmullRomCurve3, Vector3, MathUtils } from 'three';

const UP = new Vector3(0, 1, 0);

export function createRoute(mission) {
  let points = mission.points.map(point => new Vector3(...point));
  for (let pass = 0; pass < 4; pass++) {
    points = points.flatMap((point, index) => [0.25, 0.75].map(weight => point.clone().lerp(points[(index + 1) % points.length], weight)));
  }
  const curve = new CatmullRomCurve3(points, true, 'centripetal');
  curve.arcLengthDivisions = 2400;
  const scale = mission.length / curve.getLength();
  curve.points.forEach(point => point.multiplyScalar(scale));
  curve.updateArcLengths();
  return curve;
}

export function routeFrame(curve, length, distance, lane = 0, height = 0) {
  const at = value => ((value / length) % 1 + 1) % 1;
  const t = at(distance);
  const point = curve.getPointAt(t);
  const tangent = curve.getTangentAt(t).normalize();
  const ahead = curve.getTangentAt(at(distance + 16));
  const behind = curve.getTangentAt(at(distance - 16));
  const bank = MathUtils.clamp((behind.z * ahead.x - behind.x * ahead.z) * 0.65, -0.16, 0.16);
  const right = new Vector3().crossVectors(tangent, UP).normalize().applyAxisAngle(tangent, bank);
  const up = new Vector3().crossVectors(right, tangent).normalize();
  point.addScaledVector(right, lane).addScaledVector(up, height);
  return { point, tangent, right, up, bank };
}

export function speedFov(speed) {
  return 62 + 38 * MathUtils.clamp(speed / 280, 0, 1) ** 0.75;
}
