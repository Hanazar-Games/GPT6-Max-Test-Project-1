import { meteorState } from './environment.js';

export function createRadarProjection(samples, length) {
  const points = samples.map(point => [point.x, point.z]);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const scale = Math.min(320 / Math.max(1, maxX - minX), 165 / Math.max(1, maxZ - minZ));
  for (const point of points) {
    point[0] = 180 + (point[0] - (minX + maxX) / 2) * scale;
    point[1] = 99 + (point[1] - (minZ + maxZ) / 2) * scale;
  }
  return {
    at(distance) {
      const step = Math.max(0, Math.min(1, distance / length)) * (points.length - 1);
      const index = Math.floor(step), a = points[index], b = points[Math.min(index + 1, points.length - 1)];
      return [a[0] + (b[0] - a[0]) * (step - index), a[1] + (b[1] - a[1]) * (step - index)];
    },
  };
}

export class RouteRadar {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.background = canvas.ownerDocument.createElement('canvas');
    this.background.width = canvas.width;
    this.background.height = canvas.height;
  }

  strokeRoute(context, from, to, color, width) {
    context.beginPath();
    context.moveTo(...this.projection.at(from));
    for (let i = Math.floor(from / this.length * 600) + 1; i <= Math.floor(to / this.length * 600); i++) context.lineTo(...this.track[i]);
    context.lineTo(...this.projection.at(to));
    context.strokeStyle = color; context.lineWidth = width; context.stroke();
  }

  load(game, samples) {
    this.samples = samples;
    this.course = game.course;
    this.length = game.mission.length;
    this.projection = createRadarProjection(samples, this.length);
    this.track = Array.from({ length: 601 }, (_, index) => this.projection.at(this.length * index / 600));
    this.gates = game.course.gates.map(gate => this.projection.at(gate.distance));
    this.meteors = game.course.meteors.map(meteor => this.projection.at(meteor.distance));
    const context = this.background.getContext('2d');
    context.clearRect(0, 0, this.background.width, this.background.height);
    context.strokeStyle = '#ffffff0b'; context.lineWidth = 1;
    context.beginPath();
    for (let x = 0; x < 360; x += 30) { context.moveTo(x, 0); context.lineTo(x, 200); }
    for (let y = 10; y < 200; y += 30) { context.moveTo(0, y); context.lineTo(360, y); }
    context.stroke();
    this.strokeRoute(context, 0, this.length, '#63808d', 2);
    for (const zone of game.course.gravityZones) this.strokeRoute(context, zone.start, zone.end, '#bda6ff', 4);
    for (const [x, y] of this.meteors) {
      context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2);
      context.strokeStyle = '#a36d59'; context.lineWidth = 2; context.stroke();
    }
  }

  diamond([x, y], size, color) {
    const context = this.context;
    context.beginPath(); context.moveTo(x, y - size); context.lineTo(x + size, y);
    context.lineTo(x, y + size); context.lineTo(x - size, y); context.closePath();
    context.strokeStyle = color; context.lineWidth = 2; context.stroke();
  }

  draw(game, samples, projections = []) {
    if (!['running', 'countdown'].includes(game.status) || !this.canvas.getClientRects().length) return false;
    if (this.course !== game.course || this.samples !== samples) this.load(game, samples);
    const context = this.context, distance = Math.max(0, Math.min(this.length, game.distance));
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.drawImage(this.background, 0, 0);
    this.strokeRoute(context, 0, distance, '#ff945f', 3);
    this.gates.forEach(([x, y], index) => {
      context.fillStyle = index < game.gates ? '#8cf0ce' : '#ffac7d'; context.fillRect(x - 3, y - 3, 6, 6);
    });
    game.course.meteors.forEach((meteor, index) => {
      if (!['warning', 'impact'].includes(meteorState(meteor, game.elapsed).phase)) return;
      context.beginPath(); context.arc(...this.meteors[index], 6, 0, Math.PI * 2);
      context.strokeStyle = '#ff7759'; context.lineWidth = 2; context.stroke();
    });
    for (const projection of projections) this.diamond(this.projection.at(projection.pose.distance), 7, projection.color);
    this.diamond(this.gates[game.gates] ?? this.projection.at(this.length), 9, '#ffe5a0');
    const [x, y] = this.projection.at(distance);
    const before = this.projection.at(distance - 10), after = this.projection.at(distance + 10);
    const size = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
    const dx = (after[0] - before[0]) / size, dy = (after[1] - before[1]) / size;
    context.beginPath(); context.moveTo(x + dx * 8, y + dy * 8);
    context.lineTo(x - dx * 5 - dy * 5, y - dy * 5 + dx * 5);
    context.lineTo(x - dx * 5 + dy * 5, y - dy * 5 - dx * 5); context.closePath();
    context.fillStyle = '#fff'; context.fill();
    context.beginPath(); context.arc(x, y, 12, 0, Math.PI * 2);
    context.strokeStyle = '#ffffff55'; context.lineWidth = 1; context.stroke();
    this.canvas.setAttribute('aria-label', `${game.mission.name}航线雷达 · 已飞 ${Math.floor(distance / this.length * 100)}% · ${game.gates < this.gates.length ? `下一座导航门 ${game.gates + 1}` : '目标：返航基地'}；白色箭头为航向，亮色菱形为下一目标。`);
    return true;
  }
}
