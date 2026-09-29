import { Stage } from './scene.js';
import { manager, prefetch } from './models.js';
import { demoCatalog, placeholderPhotos, sortProducts, dedupe, isLifeBalance } from './catalog.js';
import { shopifyEnabled, fetchProducts, checkout } from './shopify.js';
import { Cart } from './cart.js';
import { Player } from './audio.js';
import { fetchDates } from './tour.js';
import { TourTitle } from './tourTitle.js';
import { Gallery, Lightbox } from './gallery.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const root = document.documentElement;
const money = (v, c = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);

let products = demoCatalog;
let stage, cart;
let current = -1; // product open in the detail page
const player = new Player();

// ---------- loader ----------
// The counter eases toward the real progress instead of jumping file by file, and keeps creeping slowly while a step
// takes its time (never past the next few percent), so it never looks frozen. It only reaches 100 once the shop is
// ready, then the loader fades out.
const loadPct = $('#load-pct');
const loadBar = $('#load-bar');
let loadTarget = 0, loadShown = 0, loadDone = false;
const loadTo = (v) => (loadTarget = Math.max(loadTarget, Math.min(v, 99)));
function tickLoader() {
  if (loadDone) loadShown += Math.max((100 - loadShown) * 0.14, 0.8);
  else if (loadShown < loadTarget) loadShown += Math.max((loadTarget - loadShown) * 0.08, 0.2);
  else loadShown += (Math.min(99, loadTarget + 6) - loadShown) * 0.006;
  loadShown = Math.min(loadShown, loadDone ? 100 : 99);
  loadPct.textContent = Math.floor(loadShown);
  loadBar.style.transform = `scaleX(${loadShown / 100})`;
  if (loadShown < 100) return requestAnimationFrame(tickLoader);
  setTimeout(() => body.classList.add('ready'), 180); // let the 100 register before the fade
}
requestAnimationFrame(tickLoader);
addEventListener('load', () => loadTo(4)); // fonts and scripts in: something moves straight away

// ---------- boot ----------
async function boot() {
  if (shopifyEnabled) {
    try {
      const live = await fetchProducts();
      if (live.length) products = live;
      console.info(`Catalogue Shopify : ${live.map((p) => p.title).join(' · ')}`);
    } catch (e) {
      console.warn('Shopify indisponible, catalogue de démo utilisé', e);
    }
  }
  if (products === demoCatalog) console.info('Catalogue de démo (Shopify non configuré sur ce déploiement)');
  products = sortProducts(dedupe(products));
  products.forEach((p) => { if (!p.images.length) p.images = placeholderPhotos(p); });

  // files 0–80, then the GPU uploads and shader compile up to 99; 100 is only shown once everything is ready
  manager.onProgress = (_, done, total) => loadTo((done / total) * 80);
  // once the files are in (and applied to the materials by their load callbacks), compile every shader without
  // blocking the page, behind the loader; nothing is drawn before, so no half-textured variant gets compiled
  let started = false, loading = false;
  const ready = () => {
    if (started || !stage) return;
    started = true;
    setTimeout(() => stage.compile((f) => loadTo(80 + f * 19)).catch(() => {}).then(() => (loadDone = true)));
  };
  manager.onStart = () => (loading = true);
  manager.onLoad = () => {
    loading = false;
    ready();
  };
  prefetch(products); // the records' files download while the fonts load

  // canvas labels need the web fonts
  await Promise.race([
    Promise.all([document.fonts.load('500 72px "Space Grotesk"'), document.fonts.load('400 30px "Space Grotesk"')]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
  setTimeout(() => { if (stage) ready(); }, 7000);

  const list = $('#list');
  list.innerHTML = products
    .map((p, i) => `<div class="slot${isLifeBalance(p) ? ' lb' : ''}" role="button" tabindex="0" data-i="${i}" aria-label="${esc(p.title)}, ${esc(p.kicker)}"><h2 class="sr-only">${esc(p.title)}</h2><p class="sr-only">${esc(p.kicker)}. ${esc(p.blurb || '')}</p></div>`)
    .join('');
  $('#year').textContent = new Date().getFullYear();
  const slots = [...list.children];
  slots.forEach((el, i) => {
    attachRotate(el, () => i, () => openDetail(i));
    if (el.classList.contains('lb')) attachHands(el);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(i); } });
  });

  stage = new Stage($('#gl'), products, slots);
  if (!loading) setTimeout(ready); // every file already came in during the font wait
  cart = new Cart(products);
  cart.onChange(renderCart);
  renderCart();

  const fromHash = products.findIndex((p) => `#${p.handle}` === location.hash);
  if (fromHash >= 0) openDetail(fromHash, false);
  else if (location.hash === '#tour') openTour(false);
  fetchDates().then(eventsLd, () => {});
  loop();
}

// ---------- render loop ----------
let shown = -1;
function loop() {
  requestAnimationFrame(loop);
  if (current < 0 && stage.active >= 0 && stage.detail < 0.01) stage.active = -1; // back in its slot
  stage.playing = player.playing;
  // layout is read first (the slots), styles are written after: the other way round forces a layout every frame
  if (!tourOpen && body.classList.contains('ready')) stage.frame(); // hidden behind the loader / the tour page
  else stage.measure();
  const focus = current >= 0 ? current : stage.centred;
  if (focus !== shown && focus >= 0) {
    shown = focus;
    body.style.setProperty('--accent', products[focus].accent);
    player.play(products[focus]);
  }
}

// ---------- touch / mouse rotation ----------
// One finger or the mouse turns the object (horizontal = around its vertical axis, vertical = tilts it),
// two fingers twist it. On phones the slots use `touch-action: pan-y` and a finger gesture is sorted out on its
// first pixels: one that starts vertically is a scroll (the browser scrolls, the object is left alone), one that
// starts sideways turns the object, then freely in every direction.
function attachRotate(el, index, onTap) {
  const pts = new Map();
  let start = null, moved = false, lastT = 0, twistAngle = null;
  let mode = null; // null until decided, 'rotate' | 'scroll'
  const angle = () => {
    const [a, b] = [...pts.values()];
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const grab = () => {
    mode = 'rotate';
    stage.grab(index());
  };
  el.addEventListener('pointerdown', (e) => {
    player.unlock();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const mouse = e.pointerType === 'mouse';
    if (mouse) try { el.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 1) {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      moved = false;
      lastT = e.timeStamp;
      mode = null;
      if (mouse) grab();
    }
    if (pts.size === 2 && mode !== 'scroll') grab(); // two fingers: a twist
    twistAngle = pts.size === 2 ? angle() : null;
  });
  el.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    const dt = (e.timeStamp - lastT) / 1000; // event times: handlers can run late, in a batch, on a busy frame
    lastT = e.timeStamp;
    const tx = e.clientX - start.x, ty = e.clientY - start.y;
    if (!moved && Math.hypot(tx, ty) > 6) moved = true;
    if (!moved) return;
    if (!mode) {
      if (Math.abs(ty) >= Math.abs(tx)) mode = 'scroll';
      else grab();
    }
    if (mode !== 'rotate') return;
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
    if (mode === 'rotate') stage.release(index(), e.timeStamp - lastT > 90); // held still before letting go: no flick
    mode = null;
    const tap = e.type === 'pointerup' && !moved && performance.now() - start.t < 450;
    if (tap && onTap) onTap();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end); // the browser took over to scroll
}

// ---------- Life Balance: two more hands beside the mouse, like the three hands on its sleeve (desktop) ----------
const hands = $('#hands');
addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  hands.style.setProperty('--x', `${e.clientX}px`);
  hands.style.setProperty('--y', `${e.clientY}px`);
});
function attachHands(el) {
  const mouse = (e) => e.pointerType === 'mouse';
  el.addEventListener('pointerenter', (e) => mouse(e) && current < 0 && hands.classList.add('on'));
  el.addEventListener('pointerleave', () => hands.classList.remove('on', 'grab'));
  el.addEventListener('pointerdown', (e) => mouse(e) && hands.classList.add('grab'));
  for (const ev of ['pointerup', 'pointercancel']) el.addEventListener(ev, () => hands.classList.remove('grab'));
}

// sound needs a gesture; iOS only counts some of them
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) addEventListener(ev, () => player.unlock(), { passive: true });

addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (lightbox.isOpen) return closePhotos();
  if ($('#cart').classList.contains('open')) return toggleCart(false);
  if (current >= 0 || tourOpen) leaveOverlay();
});

$('#logo').onclick = (e) => {
  e.preventDefault();
  if (current >= 0 || tourOpen) leaveOverlay();
  else scrollTo({ top: 0, behavior: 'smooth' });
};
document.querySelectorAll('.menu a').forEach((a) => {
  a.onclick = (e) => {
    e.preventDefault();
    if (a.classList.contains('soon')) toast(`${a.textContent} · bientôt`);
    else if (a.dataset.view === 'tour') tourOpen ? tourScroller.scrollTo({ top: 0, behavior: 'smooth' }) : openTour();
    else if (current >= 0 || tourOpen) leaveOverlay();
    else scrollTo({ top: 0, behavior: 'smooth' });
  };
});

// back to the shop list: pop our own history entry, or clear the hash if the page was opened on it
function leaveOverlay() {
  if (history.state?.detail || history.state?.tour) return history.back();
  closeDetail();
  closeTour();
  history.replaceState(null, '', location.pathname);
}

// ---------- detail page ----------
const scroller = $('#d-scroll');

// photos: carousel in the page, full-screen viewer on a tap. Opening the viewer pushes a history entry so the phone's
// back button closes the photos and stays on the product.
const lightbox = new Lightbox($('#lightbox'), {
  requestClose: () => closePhotos(),
  onClose: (i) => gallery.show(i), // back on the page at the photo last seen
});
const gallery = new Gallery($('#gallery'), (i) => {
  lightbox.open(products[current].images, i, products[current].title);
  history.pushState({ ...history.state, photos: true }, '');
});
const closePhotos = () => (history.state?.photos ? history.back() : lightbox.hide());

function openDetail(i, push = true) {
  const p = products[i];
  current = i;
  $('#d-kicker').textContent = p.kicker;
  $('#d-title').textContent = p.title;
  $('#d-lead').textContent = p.blurb;
  $('#d-desc').textContent = p.description;
  $('#d-price').textContent = money(p.price, p.currency);
  showPreorder(p);
  gallery.set(p.images, p.title);
  $('#acc').innerHTML = p.details
    .map((d, j) => `<details${j === 0 ? ' open' : ''}><summary>${d.title}</summary><div class="acc-body">${d.body}</div></details>`)
    .join('');
  document.querySelectorAll('#detail .reveal').forEach((el, j) => el.style.setProperty('--i', j));

  scroller.scrollTop = 0;
  stage.detailScroll = 0;
  stage.active = i;
  stage.home(i);
  stage.detailTarget = 1;
  root.classList.add('lock');
  body.classList.add('detail');
  hands.classList.remove('on', 'grab');
  $('#detail').setAttribute('aria-hidden', 'false');
  if (push) history.pushState({ detail: p.handle }, '', `#${p.handle}`);
}

// ---------- pre-order: countdown to the release + golden ticket ----------
let preTimer = 0;
const isPreorder = (p) => !!p?.preorder && Date.now() < Date.parse(p.preorder.release);
const pad = (n) => String(n).padStart(2, '0');

function showPreorder(p) {
  clearInterval(preTimer);
  const box = $('#d-pre');
  const on = isPreorder(p);
  box.hidden = !on;
  $('#d-add span').textContent = on ? 'Précommander' : 'Ajouter au panier';
  if (!on) return;
  const release = Date.parse(p.preorder.release);
  const day = new Date(release).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const units = ['jours', 'heures', 'min', 'sec'];
  box.innerHTML = `
    <p class="kicker">Précommande · sortie le ${day}</p>
    <div class="count" role="timer" aria-live="off">${units.map((u) => `<div><b>00</b><span>${u}</span></div>`).join('')}</div>
    ${p.preorder.goldenTicket ? `
    <div class="ticket">
      <p class="t-head"><span class="t-star" aria-hidden="true">✦</span>Ticket d'or</p>
      <p>Un des vinyles précommandés cache un <b>test pressing</b> en plus. Seulement 5 exemplaires pressés, un seul glissé au hasard dans une précommande.</p>
    </div>` : ''}`;
  const cells = box.querySelectorAll('.count b');
  const tick = () => {
    const left = Math.max(0, release - Date.now());
    if (!left) return showPreorder(p); // released: back to a normal product
    const s = Math.floor(left / 1000);
    [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].forEach((v, j) => {
      cells[j].textContent = pad(v);
    });
  };
  tick();
  preTimer = setInterval(tick, 1000);
}

function closeDetail() {
  clearInterval(preTimer);
  current = -1;
  stage.detailTarget = 0;
  root.classList.remove('lock');
  body.classList.remove('detail');
  $('#detail').setAttribute('aria-hidden', 'true');
}

$('#back').onclick = () => (history.state?.detail ? history.back() : (closeDetail(), history.replaceState(null, '', location.pathname)));
addEventListener('popstate', () => {
  if (lightbox.isOpen && !history.state?.photos) return lightbox.hide();
  const i = products.findIndex((p) => `#${p.handle}` === location.hash);
  if (i >= 0) openDetail(i, false);
  else closeDetail();
  if (location.hash === '#tour') openTour(false);
  else closeTour();
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
  label.textContent = isPreorder(p) ? 'Précommandé' : 'Ajouté';
  btn.querySelector('b').textContent = '✓';
  const cb = $('#cart-btn');
  cb.classList.remove('bump');
  void cb.offsetWidth;
  cb.classList.add('bump');
  toast(`${p.title} ${isPreorder(p) ? 'précommandé' : 'ajouté au panier'}`);
  setTimeout(() => {
    btn.classList.remove('done');
    label.textContent = old;
    btn.querySelector('b').textContent = '+';
  }, 1400);
}
$('#d-add').onclick = (e) => addToCart(e.currentTarget);

// ---------- tour ----------
const tourScroller = $('#t-scroll');
let tourOpen = false;
let tourTitle;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

function setMenu(view) {
  document.querySelectorAll('.menu a[data-view]').forEach((a) => {
    const on = a.dataset.view === view;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

function openTour(push = true) {
  if (!tourOpen) {
    tourOpen = true;
    tourScroller.scrollTop = 0;
    root.classList.add('lock');
    body.classList.add('tour');
    $('#tour').setAttribute('aria-hidden', 'false');
    setMenu('tour');
    (tourTitle ??= new TourTitle($('#t-3d'))).start();
    renderTour();
  }
  if (push) history.pushState({ tour: true }, '', '#tour');
}

function closeTour() {
  if (!tourOpen) return;
  tourOpen = false;
  body.classList.remove('tour');
  root.classList.toggle('lock', current >= 0);
  $('#tour').setAttribute('aria-hidden', 'true');
  setMenu('shop');
  setTimeout(() => { if (!tourOpen) tourTitle?.stop(); }, 600); // after the fade out
}

// Upcoming dates as schema.org events, so Google can list them under the artist ("Obsimo concert")
function eventsLd(dates) {
  const now = new Date(new Date().toDateString());
  const events = dates.filter((d) => new Date(d.datetime) >= now).map((d) => ({
    '@type': 'MusicEvent',
    name: `Obsimo · ${d.city || d.venue}`,
    startDate: d.datetime,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: d.venue || d.city,
      address: { '@type': 'PostalAddress', addressLocality: d.city, addressCountry: d.country },
    },
    performer: { '@id': 'https://www.obsimo.com/#artist' },
    image: 'https://www.obsimo.com/og-image.jpg',
    url: d.url || 'https://www.obsimo.com/#tour',
    ...(d.tickets && {
      offers: { '@type': 'Offer', url: d.tickets, availability: `https://schema.org/${d.soldOut ? 'SoldOut' : 'InStock'}` },
    }),
  }));
  if (!events.length) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': events });
  document.head.append(el);
}

async function renderTour() {
  const list = $('#dates');
  if (!list.children.length) list.innerHTML = '<li class="t-empty">Chargement des dates…</li>';
  let dates;
  try {
    dates = await fetchDates();
  } catch (err) {
    console.error(err);
    list.innerHTML = '<li class="t-empty">Les dates sont indisponibles pour le moment.</li>';
    return;
  }
  const upcoming = dates
    .filter((d) => new Date(d.datetime) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  let year = new Date().getFullYear();
  list.innerHTML = upcoming.length
    ? upcoming
        .map((d, i) => {
          const at = new Date(d.datetime);
          const sep = at.getFullYear() !== year ? `<li class="t-year">${(year = at.getFullYear())}</li>` : '';
          const link = d.tickets || d.url;
          const row = `<time datetime="${esc(d.datetime)}">${dayFmt.format(at)} ${monthFmt.format(at).replace('.', '')}</time>
            <span class="city">${esc(d.city)}</span><span class="venue">${esc(d.venue)}</span>`;
          return `${sep}<li class="date${d.soldOut ? ' out' : ''}" style="--i:${Math.min(i, 12)}">${
            link && !d.soldOut ? `<a href="${esc(link)}" target="_blank" rel="noopener">${row}</a>` : `<div>${row}</div>`
          }</li>`;
        })
        .join('')
    : '<li class="t-empty">Pas de date annoncée pour le moment. Reviens bientôt.</li>';
}

// ---------- cart drawer ----------
function toggleCart(open) {
  $('#cart').classList.toggle('open', open);
  $('#cart').setAttribute('aria-hidden', String(!open));
  root.classList.toggle('lock', open || current >= 0 || tourOpen);
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
          const thumb = p.model?.cover || p.model?.recto || p.images[0];
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
