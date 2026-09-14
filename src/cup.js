import { MISSIONS, CRAFTS } from './missions.js';
import { RACERS } from './pilots.js';
import { sampleGhost } from './ghost.js';

export const RACE_POINTS = Object.freeze([12, 9, 6, 3]);
const PLAYER = Object.freeze({ id: 'player', name: '你', color: '#ff9a66' });
const milliseconds = time => Math.round(time * 1000);

function rank(rows, compare) {
  rows.sort(compare);
  for (let index = 0; index < rows.length; index++) rows[index].place = index && compare(rows[index], rows[index - 1]) === 0 ? rows[index - 1].place : index + 1;
  return rows;
}

export function createCup(craftId) {
  if (!CRAFTS.some(craft => craft.id === craftId)) throw new RangeError('Unknown championship craft');
  return { craftId, stage: 0, status: 'racing', legs: [] };
}

export function completeStage(cup, game, field) {
  if (Object.keys(game.upgrades).length) return null;
  const mission = MISSIONS[cup.stage];
  if (cup.status !== 'racing' || game.status !== 'won' || game.mission.id !== mission.id || game.craft.id !== cup.craftId || game.gates !== game.course.gates.length || game.distance !== mission.length || field.length !== RACERS.length || !RACERS.every(racer => field.filter(row => row.id === racer.id && row.missionId === mission.id && row.craftId === cup.craftId).length === 1)) return null;
  const rows = [{ ...PLAYER, status: game.status, time: game.elapsed }, ...field].map(row => ({ id: row.id, name: row.name, color: row.color, finished: row.status === 'won', time: milliseconds(row.status === 'won' ? row.time : mission.duration) / 1000 }));
  const results = rank(rows, (a, b) => Number(b.finished) - Number(a.finished) || (a.finished ? milliseconds(a.time) - milliseconds(b.time) : 0))
    .map(row => Object.freeze({ ...row, points: row.finished ? RACE_POINTS[row.place - 1] : 0 }));
  const leg = Object.freeze({ missionId: mission.id, results: Object.freeze(results) });
  cup.legs.push(leg);
  cup.status = cup.stage === MISSIONS.length - 1 ? 'complete' : 'intermission';
  return leg;
}

export function advanceStage(cup) {
  if (cup.status !== 'intermission') return false;
  cup.stage++;
  cup.status = 'racing';
  return true;
}

export function getStandings(cup) {
  const rows = [PLAYER, ...RACERS].map(racer => ({ id: racer.id, name: racer.name, color: racer.color, points: 0, time: 0, finishes: 0 }));
  for (const leg of cup.legs) for (const result of leg.results) {
    const row = rows.find(entrant => entrant.id === result.id);
    row.points += result.points;
    row.time = (milliseconds(row.time) + milliseconds(result.time)) / 1000;
    row.finishes += Number(result.finished);
  }
  return rank(rows, (a, b) => b.points - a.points || b.finishes - a.finishes || milliseconds(a.time) - milliseconds(b.time));
}

export function getTrophy(cup) {
  if (cup.status !== 'complete') return null;
  const { place } = getStandings(cup).find(row => row.id === 'player');
  return { place, ...[
    { tier: 'gold', name: '月环冠军', color: '#ffe097' },
    { tier: 'silver', name: '月环亚军', color: '#d4e5f0' },
    { tier: 'bronze', name: '月环季军', color: '#eeb38e' },
    { tier: 'finisher', name: '三站征服者', color: '#8ee9d1' },
  ][Math.min(place, 4) - 1] };
}

export function getRaceView(game, field) {
  const ghosts = [];
  const rows = [{ ...PLAYER, distance: game.distance, finished: game.status === 'won', time: game.elapsed }];
  for (const racer of field) {
    const ended = game.elapsed >= racer.time;
    const pose = ended ? null : sampleGhost(racer.trace, game.elapsed);
    if (pose) ghosts.push({ id: racer.id, name: racer.name, color: racer.color, pose });
    rows.push({ id: racer.id, name: racer.name, color: racer.color, distance: pose?.distance ?? racer.distance, finished: ended && racer.status === 'won', time: racer.time });
  }
  const ordered = rank(rows, (a, b) => Number(b.finished) - Number(a.finished) || (a.finished ? milliseconds(a.time) - milliseconds(b.time) : b.distance - a.distance));
  return { rows: ordered, place: ordered.find(row => row.id === 'player').place, ghosts };
}
