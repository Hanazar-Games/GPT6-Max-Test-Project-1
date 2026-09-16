import { composeBeat } from './music.js';

export class AudioEngine {
  constructor(createContext = () => new AudioContext()) {
    this.createContext = createContext;
    this.enabled = true;
    this.background = false;
    this.state = 'menu';
    this.volumes = { music: 0.45, sfx: 0.8 };
    this.voices = new Set();
    this.beat = 0;
    this.nextBeat = 0;
  }

  async unlock() {
    try {
      if (!this.context) {
        this.context = this.createContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled && !this.background ? 0.22 : 0;
        this.master.connect(this.context.destination);
        for (const bus of ['music', 'sfx']) {
          this[bus] = this.context.createGain();
          this[bus].gain.value = this.volumes[bus];
          this[bus].connect(this.master);
        }
        this.engine = this.context.createOscillator();
        this.engine.type = 'sawtooth';
        this.filter = this.context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 220;
        this.engineGain = this.context.createGain();
        this.engineGain.gain.value = 0;
        this.engine.connect(this.filter).connect(this.engineGain).connect(this.sfx);
        this.engine.start();
        this.noiseBuffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const noise = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
        this.ready = true;
      }
      await this.context.resume();
      return this.context.state === 'running';
    } catch {
      if (this.context && !this.ready) {
        this.context.close().catch(() => {});
        for (const key of ['context', 'engine', 'engineGain', 'filter', 'master', 'music', 'sfx']) this[key] = null;
      }
      return false;
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.stopVoices();
    this.mix();
    return this.enabled;
  }

  setVolume(bus, value) {
    if (!(bus in this.volumes) || !Number.isFinite(value)) return;
    this.volumes[bus] = Math.max(0, Math.min(1, value));
    if (!this.volumes[bus]) this.stopVoices(bus);
    if (this[bus]) this.target(this[bus].gain, this.volumes[bus]);
  }

  target(parameter, value, fade = 0.025) {
    const now = this.context.currentTime;
    parameter.cancelScheduledValues(now);
    parameter.setTargetAtTime(value, now, fade);
  }

  mix() {
    if (this.master) this.target(this.master.gain, this.enabled && !this.background ? 0.22 : 0, 0.01);
  }

  setBackground(background) {
    this.background = background;
    if (background) {
      this.stopVoices();
      if (this.engineGain) this.target(this.engineGain.gain, 0, 0.01);
    }
    this.mix();
  }

  setState(state) {
    if (state === this.state) return;
    this.state = state;
    this.stopVoices(state === 'running' ? 'music' : undefined);
    if (state !== 'running' && this.engineGain) this.target(this.engineGain.gain, 0, 0.01);
    if (state === 'countdown' || state === 'menu') this.beat = 0;
  }

  stopVoices(bus) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this.voices) {
      if (bus && voice.bus !== bus) continue;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.start > now ? 0 : voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + 0.02);
      voice.oscillator.stop(now + 0.025);
      this.voices.delete(voice);
    }
    if (!bus || bus === 'music') this.nextBeat = 0;
  }

  tone(frequency, duration = 0.15, offset = 0, type = 'sine', bus = 'sfx', volume = 0.3, kind = 'tone') {
    if (!this.context || this.context.state !== 'running' || !this.enabled || this.background || this.state === 'paused' || !this.volumes[bus] || this.voices.size >= 48) return;
    const start = this.context.currentTime + offset;
    const noise = kind === 'hat' || kind === 'snare';
    const oscillator = noise ? this.context.createBufferSource() : this.context.createOscillator();
    const gain = this.context.createGain();
    let filter;
    if (noise) {
      oscillator.buffer = this.noiseBuffer;
      oscillator.loop = true;
      filter = this.context.createBiquadFilter();
      filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
      filter.frequency.value = frequency;
      oscillator.connect(filter).connect(gain);
    } else {
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (kind === 'kick') oscillator.frequency.exponentialRampToValueAtTime(42, start + duration);
      oscillator.connect(gain);
    }
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + (kind === 'pad' ? 0.18 : kind === 'hat' || kind === 'kick' ? 0.004 : 0.01));
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    gain.connect(this[bus]);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    const voice = { oscillator, gain, bus, start };
    this.voices.add(voice);
    oscillator.onended = () => { oscillator.disconnect(); filter?.disconnect(); gain.disconnect(); this.voices.delete(voice); };
  }

  event(type) {
    if (type === 'pickup') { this.tone(780); this.tone(1170, 0.22, 0.08); }
    if (type === 'gate') [440, 660, 880].forEach((note, i) => this.tone(note, 0.25, i * 0.09));
    if (type === 'impact' || type === 'miss') { this.tone(75, 0.3, 0, 'triangle'); this.tone(48, 0.3, 0.06, 'sawtooth'); }
    if (type === 'launch') { this.tone(440); this.tone(880, 0.4, 0.12); }
    if (type === 'jump') { this.tone(180, 0.16, 0, 'triangle'); this.tone(540, 0.25, 0.08); }
    if (type === 'land') this.tone(65, 0.12, 0, 'triangle');
    if (type === 'pad') { this.tone(330, 0.15); this.tone(660, 0.2, 0.08); this.tone(990, 0.25, 0.16); }
    if (type === 'dodge') { this.tone(1040, 0.2); this.tone(1560, 0.3, 0.07); }
    if (type === 'meteor-warning') { this.tone(520, 0.11, 0, 'triangle'); this.tone(520, 0.11, 0.2, 'triangle'); }
    if (type === 'meteor-strike') { this.tone(42, 0.45, 0, 'sawtooth'); this.tone(68, 0.25, 0.04, 'triangle'); }
    if (type === 'low-gravity') { this.tone(220, 0.3); this.tone(330, 0.4, 0.1); }
    if (type === 'glide' || type === 'meteor-dodge') [660, 990, 1320].forEach((note, i) => this.tone(note, 0.25, i * 0.07));
    if (type === 'won') [440, 554, 660, 880].forEach((note, i) => this.tone(note, 0.5, i * 0.13));
    if (type === 'lost') { this.tone(220, 0.3); this.tone(146, 0.5, 0.2); }
  }

  update(game) {
    this.setState(game.status);
    const theme = game.mission?.music ?? { root: 45, bpm: 124 };
    if (this.themeRoot !== theme.root) {
      this.stopVoices('music');
      this.themeRoot = theme.root;
      this.beat = 0;
    }
    if (!this.engine || this.context.state !== 'running' || this.background) return;
    const now = this.context.currentTime;
    const intensity = Math.max(0, Math.min(1, game.speed / 240));
    this.target(this.engine.frequency, 35 + intensity * 190, 0.08);
    this.target(this.filter.frequency, 180 + intensity * 700, 0.1);
    this.target(this.engineGain.gain, game.status === 'running' ? 0.035 + intensity * 0.08 : 0, game.status === 'running' ? 0.1 : 0.01);
    if (!this.enabled || !this.volumes.music || !['menu', 'running'].includes(game.status)) return;
    if (this.nextBeat < now) this.nextBeat = now + 0.03;
    while (this.nextBeat < now + 0.2) {
      const offset = this.nextBeat - now;
      for (const note of composeBeat(this.beat, theme, intensity, game.status === 'menu')) {
        this.tone(note.frequency, note.duration, offset, note.type, 'music', note.volume, note.kind);
      }
      this.beat++;
      this.nextBeat += 60 / (theme.bpm * (game.status === 'menu' ? 1.25 : 2));
    }
  }
}
