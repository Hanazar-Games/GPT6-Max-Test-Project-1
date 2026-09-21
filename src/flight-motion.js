export const STEERING_RESPONSE = 9;
export const ROAD_HALF_WIDTH = 15;

export function coastingLane(game, seconds) {
  const frames = Math.max(0, seconds) * 60;
  const whole = Math.floor(frames), decay = 1 - STEERING_RESPONSE / 60;
  // Sum neutral steering decay and interpolate the final partial frame.
  const drift = game.lateralSpeed / 60 * decay * ((1 - decay ** whole) / (1 - decay) + (frames - whole) * decay ** whole);
  return Math.max(-ROAD_HALF_WIDTH, Math.min(ROAD_HALF_WIDTH, game.lane + drift));
}
