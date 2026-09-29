// Music player for the 30 s previews. Browsers only allow sound after a user gesture, so `unlock()` is called on the
// first tap / click. Products with an `audio` URL play that file; the others keep the current track playing.

export class Player {
  constructor() {
    this.ctx = null;
    this.current = null; // { key, stop(fadeSeconds) }
  }

  get playing() {
    return !!this.current && !this.current.el.paused && this.ctx?.state === 'running';
  }

  // stop whatever is playing (the mini player's close button)
  stop() {
    this.current?.stop(0.4);
    this.current = null;
    this.changed?.();
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }

  // Called whenever the centred product changes.
  play(product) {
    const key = product.audio;
    if (!key) return; // products without a preview keep what is playing
    if (!this.ctx || this.ctx.state !== 'running') { this.pending = product; return; }
    if (this.current?.key === key) return;
    this.current?.stop(0.8);
    this.current = this.file(key, product.loop ?? true);
    this.current.key = key;
    this.changed?.();
  }

  file(url, loop) {
    const ctx = this.ctx;
    const el = new Audio(url);
    el.crossOrigin = 'anonymous';
    el.loop = loop;
    const src = ctx.createMediaElementSource(el);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.master);
    el.play().catch(() => {});
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.25);
    return {
      el,
      stop(f) {
        g.gain.setTargetAtTime(0, ctx.currentTime, f / 3);
        setTimeout(() => { el.pause(); src.disconnect(); }, f * 1000 + 200);
      },
    };
  }
}
