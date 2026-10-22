export const KEY_ACTIONS = Object.freeze({
  KeyW: 'accelerate', ArrowUp: 'accelerate', KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyF: 'jump', Space: 'boost',
});

export const acceptsGameKey = event => !(event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented);

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
    this.steering.delete(source);
    if (cancelled) this.jumpPresses.delete(source);
    if (action === 'boost' && !this.held(action)) this.boostReleased = true;
  }

  setSteer(source, value) {
    this.steering.set(source, Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0);
  }

  read() {
    const held = new Set(this.sources.values());
    let steer = 0;
    for (const value of this.steering.values()) steer = value;
    const input = {
      accelerate: this.cruise || held.has('accelerate'), brake: held.has('brake'),
      boost: held.has('boost'), jump: held.has('jump'),
      steer: held.has('right') || held.has('left') ? Number(held.has('right')) - Number(held.has('left')) : steer,
      jumpPressed: this.jumpPresses.size > 0, boostReleased: this.boostReleased,
    };
    this.jumpPresses.clear();
    this.boostReleased = false;
    return input;
  }

  clear() {
    this.cruise = false;
    this.sources = new Map();
    this.steering = new Map();
    this.jumpPresses = new Set();
    this.boostReleased = false;
  }
}
