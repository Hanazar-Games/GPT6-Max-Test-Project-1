export const KEY_ACTIONS = Object.freeze({
  KeyW: 'accelerate', ArrowUp: 'accelerate', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyF: 'jump', Space: 'boost',
});

export class FlightInput {
  constructor() { this.clear(); }

  held(action) { return [...this.sources.values()].includes(action); }

  toggleCruise() {
    this.cruise = !this.held('brake') && !this.cruise;
    return this.cruise;
  }

  press(source, action) {
    if (this.sources.has(source)) return;
    if (action === 'brake') this.cruise = false;
    if (action === 'jump' && !this.held(action)) this.jumpPresses.add(source);
    this.sources.set(source, action);
  }

  release(source, cancelled = false) {
    const action = this.sources.get(source);
    this.sources.delete(source);
    if (cancelled) this.jumpPresses.delete(source);
    if (action === 'boost' && !this.held(action)) this.boostReleased = true;
  }

  read() {
    const held = new Set(this.sources.values());
    const input = {
      accelerate: this.cruise || held.has('accelerate'), brake: held.has('brake'),
      boost: held.has('boost'), jump: held.has('jump'),
      steer: Number(held.has('right')) - Number(held.has('left')),
      jumpPressed: this.jumpPresses.size > 0, boostReleased: this.boostReleased,
    };
    this.jumpPresses.clear();
    this.boostReleased = false;
    return input;
  }

  clear() {
    this.cruise = false;
    this.sources = new Map();
    this.jumpPresses = new Set();
    this.boostReleased = false;
  }
}
