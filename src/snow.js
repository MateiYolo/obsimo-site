// Snow over the shop during the Christmas sale (src/promo.js): two fixed canvases, most flakes behind the 3D objects,
// a few large soft ones in front of them for depth. Flakes drift with a slow sway and react a little to scrolling.
// Off with prefers-reduced-motion, paused when the tab is hidden, gone at the end of the sale.

import { promoOn } from './promo.js';

export function snow() {
  if (!promoOn() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layers = [
    { el: make('snow-back'), n: 90, size: [0.6, 2.2], speed: [14, 38], alpha: [0.25, 0.7], blur: 0 },
    { el: make('snow-front'), n: 9, size: [3, 6], speed: [45, 70], alpha: [0.12, 0.3], blur: 1 },
  ];
  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = innerWidth; h = Math.max(innerHeight, document.documentElement.clientHeight);
    for (const l of layers) {
      l.el.width = w * dpr; l.el.height = h * dpr;
      l.ctx = l.el.getContext('2d');
      l.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };
  resize();
  addEventListener('resize', resize);
  const rnd = ([a, b]) => a + Math.random() * (b - a);
  const flake = (l, top) => ({ x: Math.random() * w, y: top ? -10 : Math.random() * h, r: rnd(l.size), v: rnd(l.speed), a: rnd(l.alpha), ph: Math.random() * 6.3, sw: 8 + Math.random() * 22 });
  for (const l of layers) {
    l.n = Math.round(l.n * Math.min(1, w / 1000 + 0.35)); // fewer on a phone
    l.flakes = Array.from({ length: l.n }, () => flake(l));
  }

  // scrolling pushes the flakes a little the other way, as if the camera moved through them
  let lastY = scrollY, push = 0;
  addEventListener('scroll', () => { push += (scrollY - lastY) * 0.25; lastY = scrollY; }, { passive: true });

  let last = performance.now(), t = 0;
  const frame = (now) => {
    if (!promoOn()) return layers.forEach((l) => l.el.remove());
    requestAnimationFrame(frame);
    if (document.hidden) return (last = now);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    const shift = push; push *= Math.exp(-dt * 6);
    for (const [i, l] of layers.entries()) {
      const g = l.ctx;
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#fff';
      for (const f of l.flakes) {
        f.y += f.v * dt - shift * (i ? 0.25 : 0.08) * (f.v / 40);
        const x = f.x + Math.sin(t * 0.6 + f.ph) * f.sw;
        if (f.y > h + 10) Object.assign(f, flake(l, true));
        if (f.y < -12) f.y = h + 8;
        g.globalAlpha = f.a;
        g.beginPath();
        g.arc(x, f.y, f.r, 0, 6.2832);
        g.fill();
      }
    }
  };
  requestAnimationFrame(frame);
}

function make(id) {
  const c = document.createElement('canvas');
  c.id = id;
  c.setAttribute('aria-hidden', 'true');
  document.getElementById('glow').after(c); // above the glow, below the 3D canvas (back) or the list (front, z-index)
  return c;
}
