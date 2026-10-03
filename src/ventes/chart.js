// CA par mois, en colonnes empilées par canal (SVG). Survol / toucher : détail du mois dans une bulle.

import { SERIES } from './calc.js';

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
export const monthLabel = (key, withYear) => {
  const [y, m] = key.split('-');
  return withYear ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
};

// Graduation « ronde » : 0, 100, 200… ou 0, 250, 500…
function niceMax(v) {
  if (v <= 0) return { max: 100, step: 25 };
  const raw = v / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * pow).find((s) => s >= raw);
  return { max: Math.ceil(v / step) * step, step };
}

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

// Colonne aux coins du haut arrondis (4 px), carrée sur la ligne de base.
function topRounded(x, y, w, h, r) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function renderChart(box, rows, fmt) {
  box.innerHTML = '';
  const W = Math.max(280, box.clientWidth);
  const H = 252;
  const pad = { t: 12, r: 4, b: 38, l: 52 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const { max, step } = niceMax(Math.max(...rows.map((r) => r.total)) / 100);
  const y = (c) => pad.t + ih - (c / 100 / max) * ih;
  const band = iw / rows.length;
  const bw = Math.min(24, band * 0.62);
  const multiYear = new Set(rows.map((r) => r.month.slice(0, 4))).size > 1;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': 'Chiffre d’affaires par mois et par canal' }, box);

  for (let v = 0; v <= max + 1e-9; v += step) {
    const yy = y(v * 100);
    el('line', { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, class: v === 0 ? 'axis' : 'grid' }, svg);
    const t = el('text', { x: pad.l - 8, y: yy + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    t.textContent = fmt(v * 100, true);
  }

  const labelEvery = Math.ceil(rows.length / Math.max(1, Math.floor(iw / 40)));
  rows.forEach((r, i) => {
    const cx = pad.l + band * i + band / 2;
    const x = cx - bw / 2;
    let base = 0;
    const segs = SERIES.map((s) => ({ s, v: r.values[s.key] })).filter((d) => d.v > 0);
    segs.forEach((d, j) => {
      const y0 = y(base);
      const y1 = y(base + d.v);
      const gap = j > 0 ? 2 : 0; // 2 px de fond entre deux segments
      const h = Math.max(0, y0 - y1 - gap);
      if (h > 0) {
        const attrs = { class: `seg s-${d.s.key}` };
        if (j === segs.length - 1) el('path', { ...attrs, d: topRounded(x, y1, bw, h, 4) }, svg);
        else el('rect', { ...attrs, x, y: y1, width: bw, height: h }, svg);
      }
      base += d.v;
    });
    if (i % labelEvery === 0) {
      const t = el('text', { x: cx, y: H - pad.b + 16, class: 'tick', 'text-anchor': 'middle' }, svg);
      t.textContent = monthLabel(r.month);
      // l'année sous le mois, au premier mois affiché et à chaque janvier
      if (multiYear && (i === 0 || r.month.endsWith('-01') || rows.slice(i - labelEvery + 1, i).some((x) => x.month.endsWith('-01')))) {
        const yr = el('text', { x: cx, y: H - pad.b + 30, class: 'tick', 'text-anchor': 'middle' }, svg);
        yr.textContent = r.month.slice(0, 4);
      }
    }
    // zone de survol : toute la colonne, plus large que la barre
    const hit = el('rect', { x: pad.l + band * i, y: pad.t, width: band, height: ih, class: 'hit', tabindex: 0 }, svg);
    hit.addEventListener('pointerenter', (e) => show(i, e));
    hit.addEventListener('pointermove', (e) => show(i, e));
    hit.addEventListener('focus', () => show(i));
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
  });

  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  box.appendChild(tip);
  let active = -1;

  function show(i, e) {
    const r = rows[i];
    if (active !== i) {
      active = i;
      svg.querySelectorAll('.hit').forEach((h, k) => h.classList.toggle('on', k === i));
      tip.innerHTML =
        `<b>${monthLabel(r.month, true)}</b>` +
        SERIES.filter((s) => r.values[s.key] > 0)
          .map((s) => `<div class="row"><i class="sw s-${s.key}"></i>${s.label}<span>${fmt(r.values[s.key])}</span></div>`)
          .join('') +
        `<div class="row total">Total<span>${fmt(r.total)}</span></div>` +
        `<div class="row muted">${r.items} article${r.items > 1 ? 's' : ''}</div>`;
      tip.hidden = false;
    }
    const cx = pad.l + band * i + band / 2;
    const tw = tip.offsetWidth;
    const left = Math.min(Math.max(0, cx - tw / 2), W - tw);
    tip.style.left = `${left}px`;
    const py = e ? e.clientY - box.getBoundingClientRect().top : y(r.total);
    tip.style.top = `${Math.max(0, py - tip.offsetHeight - 14)}px`;
  }
  function hide() {
    active = -1;
    tip.hidden = true;
    svg.querySelectorAll('.hit.on').forEach((h) => h.classList.remove('on'));
  }
}
