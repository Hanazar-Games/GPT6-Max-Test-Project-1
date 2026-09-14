export const MAX_GHOST_SAMPLES = 2400;
const keyFor = game => `${game.mission.id}/${game.craft.id}`;
const poseFor = game => ({ time: game.elapsed, distance: game.distance, lane: game.lane, height: game.height, speed: game.speed, lateralSpeed: game.lateralSpeed });

export class FlightRecorder {
  constructor(game) {
    this.key = keyFor(game);
    this.previous = poseFor(game);
    this.samples = [this.previous];
    this.splits = [];
    this.valid = game.elapsed === 0 && game.distance === 0 && game.gates === 0;
    this.finished = false;
  }

  append(sample) {
    if (sample.time <= this.samples.at(-1).time) return;
    if (this.samples.length >= MAX_GHOST_SAMPLES) { this.valid = false; return; }
    this.samples.push(sample);
  }

  capture(game) {
    if (this.finished || !this.valid || keyFor(game) !== this.key || !['running', 'won', 'lost'].includes(game.status) || game.elapsed <= this.previous.time) return;
    const sample = poseFor(game);
    const cut = sample.distance < this.previous.distance || game.events.some(event => event.type === 'miss');
    const gate = game.gates > this.splits.length;
    this.finished = ['won', 'lost'].includes(game.status);
    if (cut) {
      this.append(this.previous);
      this.append({ ...sample, cut: true });
    } else if (sample.time - this.samples.at(-1).time >= 0.1 - 1e-6 || gate || this.finished) this.append(sample);
    if (gate) this.splits.push(game.elapsed);
    if (game.status === 'won') this.splits.push(game.elapsed);
    this.previous = sample;
  }

  finish(game) {
    this.capture(game);
    if (!this.valid || !this.finished || game.status !== 'won' || keyFor(game) !== this.key || this.splits.length !== game.course.gates.length + 1 || this.samples.at(-1).distance !== game.mission.length || this.samples.at(-1).time !== game.elapsed) return null;
    return Object.freeze({
      samples: Object.freeze(this.samples.map(sample => Object.freeze({ ...sample }))),
      splits: Object.freeze([...this.splits]),
    });
  }
}

export function sampleGhost(ghost, elapsed) {
  const samples = ghost?.samples;
  if (!samples?.length || elapsed > samples.at(-1).time) return null;
  let low = 0;
  let high = samples.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (samples[middle].time <= elapsed) low = middle;
    else high = middle - 1;
  }
  const a = samples[low];
  const b = samples[low + 1];
  if (!b || b.cut || elapsed <= a.time) return { ...a };
  const fraction = (elapsed - a.time) / (b.time - a.time);
  const pose = { time: elapsed };
  for (const field of ['distance', 'lane', 'height', 'speed', 'lateralSpeed']) pose[field] = a[field] + (b[field] - a[field]) * fraction;
  return pose;
}

export function compareSplit(splits, reference, index) {
  if (splits?.[index] === undefined || reference?.[index] === undefined) return null;
  return {
    total: splits[index] - reference[index],
    sector: (splits[index] - (splits[index - 1] ?? 0)) - (reference[index] - (reference[index - 1] ?? 0)),
  };
}

export function saveRecord(records, game, recorder) {
  const previous = records.get(keyFor(game));
  const ghost = Object.keys(game.upgrades).length ? null : recorder?.finish(game);
  const newBest = !!ghost && (!previous || game.elapsed < previous.time - 1e-6);
  const newScore = !!ghost && (!previous || game.score > previous.score);
  if (ghost && (newBest || newScore)) records.set(keyFor(game), {
    score: Math.max(previous?.score ?? 0, game.score),
    time: newBest ? game.elapsed : previous.time,
    ghost: newBest ? ghost : previous.ghost,
  });
  return { newBest, newScore, previousTime: previous?.time ?? null };
}
