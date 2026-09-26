import { Stage } from './scene.js';
import { manager } from './models.js';
import { demoCatalog, placeholderPhotos } from './catalog.js';
import { shopifyEnabled, fetchProducts, checkout } from './shopify.js';
import { Cart } from './cart.js';
import { Player } from './audio.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const money = (v, c = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);

let products = demoCatalog;
let stage, cart, index = 0;
const player = new Player();

// ---------- boot ----------
async function boot() {
  if (shopifyEnabled) {
    try {
      const live = await fetchProducts();
      if (live.length) products = live;
    } catch (e) {
      console.warn('Shopify indisponible, catalogue de démo utilisé', e);
    }
  }
  products.forEach((p) => { if (!p.images.length) p.images = placeholderPhotos(p); });

  // canvas labels need the web fonts
  await Promise.race([
    Promise.all([document.fonts.load('104px "Instrument Serif"'), document.fonts.load('italic 104px "Instrument Serif"'), document.fonts.load('30px "IBM Plex Mono"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  manager.onProgress = (_, done, total) => ($('#load-pct').textContent = Math.round((done / total) * 100));
  const ready = () => body.classList.add('ready');
  manager.onLoad = ready;
  setTimeout(ready, 7000);

  stage = new Stage($('#gl'), products);
  cart = new Cart(products);
  cart.onChange(renderCart);
  renderCart();

  $('#dots').innerHTML = products.map((p, i) => `<button aria-label="${p.title}" data-i="${i}"></button>`).join('');
  $('#dots').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) goTo(+b.dataset.i); });

  const fromHash = products.findIndex((p) => `#${p.handle}` === location.hash);
  index = Math.max(0, fromHash);
  stage.pos = target = index;
  showInfo(index, 1, true);
  if (fromHash >= 0) openDetail(false);

  body.classList.toggle('muted', player.muted);
  loop();
}

// ---------- render loop ----------
let wasPlaying = false;
function loop() {
  requestAnimationFrame(loop);
  carouselStep();
  stage.playing = player.playing;
  const lv = player.playing ? player.sample() : 0;
  if (player.playing || wasPlaying) $('#sound').style.setProperty('--lv', lv.toFixed(3));
  wasPlaying = player.playing;
  stage.frame();
}

// ---------- carousel physics ----------
let target = 0;
let dragging = false;
function carouselStep() {
  if (!dragging) {
    const k = 1 - Math.exp(-1 / 60 * 9);
    stage.pos += (target - stage.pos) * k;
    if (Math.abs(target - stage.pos) < 1e-4) stage.pos = target;
  }
  const i = Math.round(Math.min(products.length - 1, Math.max(0, stage.pos)));
  if (i !== index) {
    const dir = i > index ? 1 : -1;
    index = i;
    showInfo(i, dir);
  }
}

function goTo(i) {
  target = Math.max(0, Math.min(products.length - 1, i));
}

// ---------- product info ----------
function splitTitle(el, text, dir) {
  let n = 0;
  el.innerHTML = text
    .split(' ')
    .map((w) => `<span class="w">${[...w].map((c) => `<span class="c" style="--i:${n++}">${c}</span>`).join('')}</span>`)
    .join(' ');
  el.style.setProperty('--dir', dir);
}

let infoTimer;
function showInfo(i, dir, instant = false) {
  const p = products[i];
  body.style.setProperty('--accent', p.accent);
  document.querySelectorAll('#dots button').forEach((b, j) => b.classList.toggle('on', j === i));
  player.play(p);

  const title = $('#h-title');
  const swaps = [$('#h-kicker'), $('#h-blurb'), $('#h-price')];
  const apply = () => {
    const cur = products[index];
    splitTitle(title, cur.title, dir);
    title.classList.remove('out');
    title.classList.add('in');
    $('#h-kicker').textContent = cur.kicker;
    $('#h-blurb').textContent = cur.blurb;
    $('#h-price').textContent = money(cur.price, cur.currency);
    swaps.forEach((s) => s.classList.remove('out'));
  };
  clearTimeout(infoTimer);
  if (instant) return apply();
  title.style.setProperty('--dir', dir);
  title.classList.remove('in');
  title.classList.add('out');
  swaps.forEach((s) => s.classList.add('swap', 'out'));
  infoTimer = setTimeout(apply, 260);
}

// ---------- pointer: swipe, tap, tilt ----------
const gl = $('#gl');
let down = null;
let samples = [];

gl.addEventListener('pointerdown', (e) => {
  player.unlock();
  if (body.classList.contains('detail')) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now(), pos: stage.pos, moved: false };
  samples = [{ x: e.clientX, t: down.t }];
  gl.setPointerCapture(e.pointerId);
});

gl.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    stage.pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  }
  if (!down) return;
  const dx = e.clientX - down.x;
  if (!down.moved && Math.abs(dx) > 6) { down.moved = true; dragging = true; }
  if (!dragging) return;
  let p = down.pos - dx / stage.stepPx;
  const max = products.length - 1;
  if (p < 0) p = -rubber(-p); // resist past the ends
  if (p > max) p = max + rubber(p - max);
  stage.pos = p;
  samples.push({ x: e.clientX, t: performance.now() });
  if (samples.length > 6) samples.shift();
});

const rubber = (o) => 0.35 * (1 - 1 / (o * 2 + 1));

function endDrag(e) {
  if (!down) return;
  const wasDrag = down.moved;
  const tap = !wasDrag && performance.now() - down.t < 400;
  if (wasDrag) {
    const a = samples[0], b = samples[samples.length - 1];
    const v = (b.x - a.x) / Math.max(1, b.t - a.t); // px per ms
    const projected = stage.pos - (v * 180) / stage.stepPx; // flick carries on a little
    const from = Math.round(down.pos);
    goTo(Math.max(from - 1, Math.min(from + 1, Math.round(projected))));
  }
  dragging = false;
  down = null;
  if (tap && e.type === 'pointerup') {
    const hit = stage.pick(e.clientX, e.clientY);
    if (hit === index && Math.abs(stage.pos - index) < 0.3) openDetail();
    else if (hit >= 0) goTo(hit);
  }
}
gl.addEventListener('pointerup', endDrag);
gl.addEventListener('pointercancel', endDrag);
addEventListener('pointerdown', () => player.unlock(), { once: true });

// wheel / trackpad
let wheelAcc = 0, wheelLock = 0;
addEventListener('wheel', (e) => {
  if (body.classList.contains('detail') || $('#cart').classList.contains('open')) return;
  const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += d;
  if (Math.abs(wheelAcc) > 40) {
    goTo(Math.round(target) + Math.sign(wheelAcc));
    wheelAcc = 0;
    wheelLock = now + 520;
  }
}, { passive: true });

addEventListener('keydown', (e) => {
  if ($('#lightbox').classList.contains('open')) {
    if (e.key === 'Escape') closeLightbox();
    return;
  }
  if (e.key === 'Escape') {
    if ($('#cart').classList.contains('open')) return toggleCart(false);
    if (body.classList.contains('detail')) return history.back();
  }
  if (body.classList.contains('detail')) return;
  if (e.key === 'ArrowRight') goTo(Math.round(target) + 1);
  if (e.key === 'ArrowLeft') goTo(Math.round(target) - 1);
  if (e.key === 'Enter' && document.activeElement === document.body) openDetail();
});

$('#prev').onclick = () => goTo(Math.round(target) - 1);
$('#next').onclick = () => goTo(Math.round(target) + 1);
$('#h-more').onclick = () => openDetail();
$('#logo').onclick = (e) => {
  e.preventDefault();
  if (body.classList.contains('detail')) history.back();
  else goTo(0);
};

// ---------- add to cart ----------
function addToCart(btn) {
  const p = products[index];
  cart.add(p);
  const label = btn.querySelector('span');
  const old = label.textContent;
  btn.classList.add('done');
  label.textContent = 'Ajouté';
  btn.querySelector('b').textContent = '✓';
  const cb = $('#cart-btn');
  cb.classList.remove('bump');
  void cb.offsetWidth;
  cb.classList.add('bump');
  toast(`${p.title} ajouté au panier`);
  setTimeout(() => {
    btn.classList.remove('done');
    label.textContent = old;
    btn.querySelector('b').textContent = '+';
  }, 1400);
}
$('#h-add').onclick = (e) => { player.unlock(); addToCart(e.currentTarget); };
$('#d-add').onclick = (e) => addToCart(e.currentTarget);

// ---------- detail page ----------
const scroller = $('#d-scroll');

function openDetail(push = true) {
  const p = products[index];
  target = index;
  $('#d-kicker').textContent = p.kicker;
  $('#d-title').textContent = p.title;
  $('#d-lead').textContent = p.blurb;
  $('#d-desc').textContent = p.description;
  $('#d-price').textContent = money(p.price, p.currency);
  $('#gallery').innerHTML = p.images
    .slice(0, 5)
    .map((src, i) => `<button data-i="${i}" aria-label="Photo ${i + 1}"><img src="${src}" alt="" loading="lazy" decoding="async"></button>`)
    .join('');
  $('#acc').innerHTML = p.details
    .map((d, i) => `<details${i === 0 ? ' open' : ''}><summary>${d.title}</summary><div class="acc-body">${d.body}</div></details>`)
    .join('');
  document.querySelectorAll('#detail .reveal').forEach((el, i) => el.style.setProperty('--i', i));

  scroller.scrollTop = 0;
  stage.scrollPx = 0;
  stage.detailTarget = 1;
  body.classList.add('detail');
  $('#detail').setAttribute('aria-hidden', 'false');
  if (push) history.pushState({ detail: p.handle }, '', `#${p.handle}`);
}

function closeDetail() {
  stage.detailTarget = 0;
  body.classList.remove('detail');
  $('#detail').setAttribute('aria-hidden', 'true');
}

$('#back').onclick = () => (history.state?.detail ? history.back() : (closeDetail(), history.replaceState(null, '', location.pathname)));
addEventListener('popstate', () => {
  const i = products.findIndex((p) => `#${p.handle}` === location.hash);
  if (i >= 0) {
    goTo(i);
    stage.pos = i;
    index = i;
    showInfo(i, 1, true);
    openDetail(false);
  } else closeDetail();
});

scroller.addEventListener('scroll', () => { stage.scrollPx = stage.portrait ? scroller.scrollTop : 0; }, { passive: true });

// drag to turn the product in the detail page (hero area on phones, left column on desktop)
for (const el of [$('#d-hero'), $('#d-drag')]) {
  let last = null;
  el.addEventListener('pointerdown', (e) => { last = e.clientX; stage.dragging = true; if (e.pointerType === 'mouse') el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (last === null) return;
    stage.spinBy(e.clientX - last);
    last = e.clientX;
  });
  const up = () => { last = null; stage.dragging = false; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
$('#d-hero').style.touchAction = 'pan-y';

// ---------- gallery lightbox ----------
$('#gallery').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) openLightbox(+b.dataset.i);
});
const track = $('#lb-track');
function openLightbox(i) {
  const imgs = products[index].images;
  track.innerHTML = imgs.map((src) => `<figure><img src="${src}" alt=""></figure>`).join('');
  $('#lightbox').classList.add('open');
  requestAnimationFrame(() => { track.scrollLeft = i * track.clientWidth; updateCount(); });
}
function updateCount() {
  const n = products[index].images.length;
  $('#lb-count').textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1} / ${n}`;
}
track.addEventListener('scroll', updateCount, { passive: true });
const closeLightbox = () => $('#lightbox').classList.remove('open');
$('#lb-close').onclick = closeLightbox;
track.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') closeLightbox(); });

// ---------- cart drawer ----------
function toggleCart(open) {
  $('#cart').classList.toggle('open', open);
  $('#cart').setAttribute('aria-hidden', String(!open));
}
$('#cart-btn').onclick = () => toggleCart(true);
$('#cart-close').onclick = () => toggleCart(false);
$('#cart-scrim').onclick = () => toggleCart(false);

function renderCart() {
  $('#cart-count').textContent = cart.count;
  $('#cart-total').textContent = money(cart.total);
  $('#checkout').style.display = cart.count ? '' : 'none';
  $('#lines').innerHTML = cart.lines.length
    ? cart.lines
        .map((l) => {
          const p = cart.product(l.id);
          const thumb = p.model?.cover || p.images[0];
          return `<li>
            ${thumb ? `<img src="${thumb}" alt="">` : `<span class="sw" style="background:${p.accent}"></span>`}
            <div><div class="t">${p.title}</div><div class="k">${p.kicker}</div>
              <div class="qty"><button data-id="${l.id}" data-d="-1" aria-label="Retirer un">−</button><span>${l.qty}</span><button data-id="${l.id}" data-d="1" aria-label="Ajouter un">+</button></div>
            </div>
            <div class="lp">${money(p.price * l.qty, p.currency)}</div>
          </li>`;
        })
        .join('')
    : '<li class="empty">Ton panier est vide.</li>';
}
$('#lines').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  const l = cart.lines.find((x) => x.id === b.dataset.id);
  cart.set(l.id, l.qty + Number(b.dataset.d));
});

$('#checkout').onclick = async () => {
  if (!shopifyEnabled) return toast('Mode démo : le paiement sera branché sur Shopify');
  try {
    $('#checkout span').textContent = 'Redirection…';
    location.href = await checkout(cart.lines);
  } catch (err) {
    $('#checkout span').textContent = 'Commander';
    toast('Le paiement est indisponible, réessaie dans un instant');
    console.error(err);
  }
};

// ---------- sound ----------
$('#sound').onclick = () => player.toggleMute();
player.onChange((pl) => {
  body.classList.toggle('muted', pl.muted);
  $('#sound').setAttribute('aria-label', pl.muted ? 'Activer le son' : 'Couper le son');
});

// ---------- toast ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

boot();
