import { Stage } from './scene.js';
import { manager } from './models.js';
import { demoCatalog, placeholderPhotos } from './catalog.js';
import { shopifyEnabled, fetchProducts, checkout } from './shopify.js';
import { Cart } from './cart.js';
import { Player } from './audio.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const root = document.documentElement;
const money = (v, c = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);

let products = demoCatalog;
let stage, cart;
let current = -1; // product open in the detail page
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

  const list = $('#list');
  list.innerHTML = products
    .map((p, i) => `<div class="slot" role="button" tabindex="0" data-i="${i}" aria-label="${p.title}, ${p.kicker}"></div>`)
    .join('');
  list.insertAdjacentHTML('afterend', `<footer class="foot">Obsimo · ${new Date().getFullYear()}</footer>`);
  const slots = [...list.children];
  slots.forEach((el, i) => {
    attachRotate(el, () => i, () => openDetail(i));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(i); } });
  });

  stage = new Stage($('#gl'), products, slots);
  cart = new Cart(products);
  cart.onChange(renderCart);
  renderCart();

  body.classList.toggle('muted', player.muted);
  const fromHash = products.findIndex((p) => `#${p.handle}` === location.hash);
  if (fromHash >= 0) openDetail(fromHash, false);
  loop();
}

// ---------- render loop ----------
let wasPlaying = false;
let shown = -1;
function loop() {
  requestAnimationFrame(loop);
  const focus = current >= 0 ? current : stage.centred;
  if (focus !== shown && focus >= 0) {
    shown = focus;
    body.style.setProperty('--accent', products[focus].accent);
    player.play(products[focus]);
  }
  if (current < 0 && stage.active >= 0 && stage.detail < 0.01) stage.active = -1; // back in its slot
  stage.playing = player.playing;
  const lv = player.playing ? player.sample() : 0;
  if (player.playing || wasPlaying) $('#sound').style.setProperty('--lv', lv.toFixed(3));
  wasPlaying = player.playing;
  stage.frame();
}

// ---------- touch / mouse rotation ----------
// One finger or the mouse turns the object (horizontal = around its vertical axis, vertical = tilts it),
// two fingers twist it. On phones the slots use `touch-action: pan-y`: a vertical swipe scrolls the page as usual,
// a gesture that starts sideways turns the object instead.
function attachRotate(el, index, onTap) {
  const pts = new Map();
  let start = null, moved = false, lastT = 0, twistAngle = null;
  const angle = () => {
    const [a, b] = [...pts.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  el.addEventListener('pointerdown', (e) => {
    player.unlock();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.pointerType === 'mouse') try { el.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = false;
      lastT = start.t;
      stage.grab(index());
    }
    twistAngle = pts.size === 2 ? angle() : null;
    cursor.classList.add('grab');
  });
  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    lastT = now;
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) moved = true;
    if (!moved) return;
    if (pts.size === 2) {
      const a = angle();
      let d = a - twistAngle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      twistAngle = a;
      stage.rotate(index(), 0, 0, d, dt);
    } else {
      stage.rotate(index(), dx, dy, 0, dt);
    }
  });
  const end = (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    twistAngle = pts.size === 2 ? angle() : null;
    if (pts.size) return;
    stage.release(index());
    cursor.classList.remove('grab');
    const tap = e.type === 'pointerup' && !moved && performance.now() - start.t < 450;
    if (tap && onTap) onTap();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end); // the browser took over to scroll
}

// ---------- custom cursor (desktop) ----------
const cursor = $('#cursor');
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  cursor.style.setProperty('--x', `${e.clientX}px`);
  cursor.style.setProperty('--y', `${e.clientY}px`);
  const onSlot = !!e.target.closest?.('.slot') && current < 0;
  cursor.classList.toggle('on', onSlot || cursor.classList.contains('grab'));
});

// sound needs a gesture; iOS only counts some of them
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, () => player.unlock(), { passive: true });

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ($('#lightbox').classList.contains('open')) return closeLightbox();
  if ($('#cart').classList.contains('open')) return toggleCart(false);
  if (current >= 0) history.back();
});

$('#logo').onclick = (e) => {
  e.preventDefault();
  if (current >= 0) history.back();
  else scrollTo({ top: 0, behavior: 'smooth' });
};
document.querySelectorAll('.menu a').forEach((a) => {
  a.onclick = (e) => {
    e.preventDefault();
    if (a.classList.contains('soon')) toast(`${a.textContent} · bientôt`);
    else if (current >= 0) history.back();
    else scrollTo({ top: 0, behavior: 'smooth' });
  };
});

// ---------- detail page ----------
const scroller = $('#d-scroll');

function openDetail(i, push = true) {
  const p = products[i];
  current = i;
  $('#d-kicker').textContent = p.kicker;
  $('#d-title').textContent = p.title;
  $('#d-lead').textContent = p.blurb;
  $('#d-desc').textContent = p.description;
  $('#d-price').textContent = money(p.price, p.currency);
  $('#gallery').innerHTML = p.images
    .slice(0, 5)
    .map((src, j) => `<button data-i="${j}" aria-label="Photo ${j + 1}"><img src="${src}" alt="" loading="lazy" decoding="async"></button>`)
    .join('');
  $('#acc').innerHTML = p.details
    .map((d, j) => `<details${j === 0 ? ' open' : ''}><summary>${d.title}</summary><div class="acc-body">${d.body}</div></details>`)
    .join('');
  document.querySelectorAll('#detail .reveal').forEach((el, j) => el.style.setProperty('--i', j));

  scroller.scrollTop = 0;
  stage.detailScroll = 0;
  stage.active = i;
  stage.detailTarget = 1;
  root.classList.add('lock');
  body.classList.add('detail');
  cursor.classList.remove('on');
  $('#detail').setAttribute('aria-hidden', 'false');
  if (push) history.pushState({ detail: p.handle }, '', `#${p.handle}`);
}

function closeDetail() {
  current = -1;
  stage.detailTarget = 0;
  root.classList.remove('lock');
  body.classList.remove('detail');
  $('#detail').setAttribute('aria-hidden', 'true');
}

$('#back').onclick = () => (history.state?.detail ? history.back() : (closeDetail(), history.replaceState(null, '', location.pathname)));
addEventListener('popstate', () => {
  const i = products.findIndex((p) => `#${p.handle}` === location.hash);
  if (i >= 0) openDetail(i, false);
  else closeDetail();
});

scroller.addEventListener('scroll', () => { stage.detailScroll = stage.portrait ? scroller.scrollTop : 0; }, { passive: true });

// in the detail page the object can still be turned: hero area on phones, left column on desktop
attachRotate($('#d-hero'), () => current);
attachRotate($('#d-drag'), () => current);

function addToCart(btn) {
  const p = products[current];
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
$('#d-add').onclick = (e) => addToCart(e.currentTarget);

// ---------- gallery lightbox ----------
$('#gallery').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) openLightbox(+b.dataset.i);
});
const track = $('#lb-track');
function openLightbox(i) {
  track.innerHTML = products[current].images.map((src) => `<figure><img src="${src}" alt=""></figure>`).join('');
  $('#lightbox').classList.add('open');
  requestAnimationFrame(() => { track.scrollLeft = i * track.clientWidth; updateCount(); });
}
function updateCount() {
  $('#lb-count').textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1} / ${products[current].images.length}`;
}
track.addEventListener('scroll', updateCount, { passive: true });
const closeLightbox = () => $('#lightbox').classList.remove('open');
$('#lb-close').onclick = closeLightbox;
track.addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') closeLightbox(); });

// ---------- cart drawer ----------
function toggleCart(open) {
  $('#cart').classList.toggle('open', open);
  $('#cart').setAttribute('aria-hidden', String(!open));
  root.classList.toggle('lock', open || current >= 0);
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
