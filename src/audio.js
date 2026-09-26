// Music player for the 30 s previews. Browsers only allow sound after a user gesture, so `unlock()` is called on the
// first tap / click. Products with an `audio` URL play that file; vinyls without one get a generative placeholder
// loop so the idea can be felt before the real previews exist. Other products keep the current track playing.

export class Player {
  constructor() {
    this.ctx = null;
    this.current = null; // { key, stop(fadeSeconds) }
    this.muted = false;
    try { this.muted = localStorage.getItem('obsimo-muted') === '1'; } catch {}
    this.level = 0;
    this.listeners = new Set();
  }

  get playing() {
    return !!this.current && !this.muted && this.ctx?.state === 'running';
  }

  onChange(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => fn(this)); }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.master.connect(this.analyser).connect(this.ctx.destination);
      this.bins = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('obsimo-muted', this.muted ? '1' : '0'); } catch {}
    if (!this.ctx) this.unlock();
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.15);
    this.emit();
  }

  // Lowers (or restores) the product loop's volume while something else plays over it, e.g. the secret track.
  duck(on) {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : on ? 0.15 : 0.8, this.ctx.currentTime, 0.4);
  }

  // Called whenever the centred product changes.
  play(product) {
    const key = product.audio || (product.kind === 'vinyl' ? `gen-${product.audioSeed ?? 0}` : null);
    if (!key) return; // sauces etc. keep what is playing
    if (!this.ctx || this.ctx.state !== 'running') { this.pending = product; return; }
    if (this.current?.key === key) return;
    this.current?.stop(0.8);
    this.current = product.audio ? this.file(product.audio) : this.generative(product.audioSeed ?? 0);
    this.current.key = key;
    this.emit();
  }

  // 0..1 loudness, for small visual reactions
  sample() {
    if (!this.analyser) return 0;
    this.analyser.getByteFrequencyData(this.bins);
    let s = 0;
    for (let i = 2; i < 40; i++) s += this.bins[i];
    this.level += (s / (38 * 255) - this.level) * 0.3;
    return this.level;
  }

  file(url) {
    const ctx = this.ctx;
    const el = new Audio(url);
    el.crossOrigin = 'anonymous';
    el.loop = true;
    const src = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.master);
    el.play().catch(() => {});
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.25);
    return {
      stop(f) {
        g.gain.setTargetAtTime(0, ctx.currentTime, f / 3);
        setTimeout(() => { el.pause(); src.disconnect(); }, f * 1000 + 200);
      },
    };
  }

  // Slow ambient loop: detuned pad chords, a soft kick and brushed noise. Each seed picks another key and tempo.
  generative(seed) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);

    const roots = [[57, 60, 64, 67], [55, 58, 62, 65], [52, 55, 59, 62], [53, 57, 60, 64]];
    const prog = seed % 2 ? [3, 1, 2, 0] : [0, 2, 3, 1];
    const bpm = seed % 2 ? 78 : 86;
    const beat = 60 / bpm;
    const hz = (n) => 440 * 2 ** ((n - 69) / 12);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 500;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    const padBus = ctx.createGain();
    padBus.gain.value = 0.06;
    lp.connect(padBus).connect(out);

    const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    const nodes = [lfo];
    let next = ctx.currentTime + 0.05;
    let step = 0;
    let alive = true;

    const schedule = () => {
      if (!alive) return;
      while (next < ctx.currentTime + 0.4) {
        const bar = Math.floor(step / 8) % 4;
        if (step % 8 === 0) {
          // pad chord, one per bar
          for (const n of roots[prog[bar]]) {
            for (const det of [-7, 7]) {
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.type = 'sawtooth';
              o.frequency.value = hz(n - 12);
              o.detune.value = det;
              g.gain.setValueAtTime(0, next);
              g.gain.linearRampToValueAtTime(1, next + 1.2);
              g.gain.setTargetAtTime(0, next + beat * 4 - 0.4, 0.5);
              o.connect(g).connect(lp);
              o.start(next);
              o.stop(next + beat * 4 + 2);
            }
          }
          // bass
          const b = ctx.createOscillator();
          const bg = ctx.createGain();
          b.type = 'sine';
          b.frequency.value = hz(roots[prog[bar]][0] - 24);
          bg.gain.setValueAtTime(0.0001, next);
          bg.gain.exponentialRampToValueAtTime(0.22, next + 0.05);
          bg.gain.setTargetAtTime(0.0001, next + beat * 3, 0.3);
          b.connect(bg).connect(out);
          b.start(next);
          b.stop(next + beat * 4 + 1);
        }
        const half = step % 2 === 0;
        if (half && (step % 8 === 0 || step % 8 === 5 || step % 8 === 4)) {
          // soft kick
          const k = ctx.createOscillator();
          const kg = ctx.createGain();
          k.frequency.setValueAtTime(110, next);
          k.frequency.exponentialRampToValueAtTime(42, next + 0.12);
          kg.gain.setValueAtTime(0.35, next);
          kg.gain.exponentialRampToValueAtTime(0.001, next + 0.4);
          k.connect(kg).connect(out);
          k.start(next);
          k.stop(next + 0.45);
        }
        // brushed hats on the off-beats
        if (step % 2 === 1) {
          const s = ctx.createBufferSource();
          s.buffer = noise;
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = 6500;
          const hg = ctx.createGain();
          hg.gain.setValueAtTime(step % 4 === 3 ? 0.05 : 0.025, next);
          hg.gain.exponentialRampToValueAtTime(0.001, next + 0.09);
          s.connect(hp).connect(hg).connect(out);
          s.start(next);
          s.stop(next + 0.1);
        }
        next += beat / 2;
        step++;
      }
      timer = setTimeout(schedule, 100);
    };
    let timer = setTimeout(schedule, 0);

    return {
      stop(f) {
        out.gain.setTargetAtTime(0, ctx.currentTime, f / 3);
        setTimeout(() => {
          alive = false;
          clearTimeout(timer);
          nodes.forEach((n) => n.stop());
          out.disconnect();
        }, f * 1000 + 300);
      },
    };
  }
}
