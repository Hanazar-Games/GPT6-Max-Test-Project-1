export const STEERING_RESPONSE = 12;
export const ROAD_HALF_WIDTH = 15;

export const DRIVING_FIELDS = Object.freeze({
  turnRadius: { label: '转弯半径系数', min: .4, max: 2.5, step: .01, unit: '×', help: '越小起弯越紧、响应越快；越大变线弧线越平缓。' },
  steeringPower: { label: '横移幅度', min: .4, max: 1.6, step: .01, unit: '×', help: '控制持续转向时的最大横移速度，越大越容易跨车道。' },
  releaseGrip: { label: '松手抓地', min: 4, max: 24, step: .25, unit: '/s', help: '越大松手后收漂越快；越小保留更多侧滑惯性。' },
  countersteer: { label: '反打力度', min: 1, max: 3, step: .05, unit: '×', help: '反向转向时更快消除原来的侧滑，不增加持续横移速度。' },
  brakeGrip: { label: '制动抓地', min: 1, max: 4, step: .05, unit: '×', help: '越大按住制动时收漂越快；制动期间仍可转向。' },
  highSpeedStability: { label: '高速稳定', min: 0, max: .6, step: .01, unit: '%', help: '最高可收小的横移幅度；随前进速度渐进生效，减少高速过量转向。' },
  inputCurve: { label: '小幅转向曲线', min: 1, max: 2.5, step: .05, unit: '×', help: '越大滑动中心越细腻；满幅滑动与键盘左右键保持完整转向。' },
});

export const DRIVING_PRESETS = Object.freeze({
  balanced: { label: '均衡 · 易于控漂', settings: Object.freeze({ turnRadius: 1, steeringPower: 1, releaseGrip: 14, countersteer: 1.8, brakeGrip: 2.5, highSpeedStability: .2, inputCurve: 1.25 }) },
  precision: { label: '精准 · 快速收漂', settings: Object.freeze({ turnRadius: .8, steeringPower: .85, releaseGrip: 20, countersteer: 2.2, brakeGrip: 3, highSpeedStability: .35, inputCurve: 1.5 }) },
  drift: { label: '漂移 · 保留惯性', settings: Object.freeze({ turnRadius: 1.2, steeringPower: 1.1, releaseGrip: 6, countersteer: 2.2, brakeGrip: 3.2, highSpeedStability: .1, inputCurve: 1.2 }) },
});
const drivingKeys = Object.keys(DRIVING_FIELDS);
const drivingSignatures = new WeakMap();

export function normalizeDrivingSettings(settings = {}) {
  const normalized = Object.freeze(Object.fromEntries(drivingKeys.map(key => {
    const { min, max, step } = DRIVING_FIELDS[key];
    const value = Number.isFinite(settings?.[key]) ? settings[key] : DRIVING_PRESETS.balanced.settings[key];
    return [key, Number((Math.round((Math.max(min, Math.min(max, value)) - min) / step) * step + min).toFixed(2))];
  })));
  drivingSignatures.set(normalized, Object.values(normalized).join(':'));
  return normalized;
}

export const drivingKey = settings => drivingSignatures.get(settings) ?? drivingKey(normalizeDrivingSettings(settings));
export const steeringResponse = game => STEERING_RESPONSE / game.drivingSettings.turnRadius;

function integrate(game, target, response, dt) {
  const change = -Math.expm1(-response * dt), initial = game.lateralSpeed;
  game.lane += target * dt + (initial - target) * change / response;
  game.lateralSpeed += (target - initial) * change;
}

export function advanceLateral(game, input, dt) {
  if (!(dt > 0)) return;
  const settings = game.drivingSettings;
  const steer = Number.isFinite(input.steer) ? Math.max(-1, Math.min(1, input.steer)) : 0;
  const speed = Math.max(0, game.speed);
  const stability = settings.highSpeedStability * Math.min(1, speed / game.craft.boostSpeed) ** 2;
  const limit = (6 + (game.craft.handling - 6) * Math.min(1, speed / 20)) * settings.steeringPower * (1 - stability);
  const target = Math.sign(steer) * Math.abs(steer) ** settings.inputCurve * limit * (input.brake ? .65 : 1);
  const response = (steer ? steeringResponse(game) : settings.releaseGrip) * (input.brake ? settings.brakeGrip : 1);
  if (target * game.lateralSpeed < 0) {
    const catchResponse = response * settings.countersteer;
    const crossing = Math.log1p(-game.lateralSpeed / target) / catchResponse;
    const catchTime = Math.min(dt, crossing);
    integrate(game, target, catchResponse, catchTime);
    if (crossing >= dt) return;
    game.lateralSpeed = 0;
    dt -= catchTime;
  }
  integrate(game, target, response, dt);
}

export function coastingLane(game, seconds) {
  const frames = Math.max(0, seconds) * 60;
  const whole = Math.floor(frames), response = game.drivingSettings.releaseGrip;
  const decay = Math.exp(-response * whole / 60);
  // Crossings interpolate between fixed simulation steps, including road-edge clamps.
  const lane = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, game.lane + game.lateralSpeed / response * (1 - decay)));
  const next = Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, lane + game.lateralSpeed * decay / response * -Math.expm1(-response / 60)));
  return lane + (next - lane) * (frames - whole);
}
