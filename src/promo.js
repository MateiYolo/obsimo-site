// Christmas sale: a banner over the shop with a countdown to the real end of the sale, and in the product page of
// a discounted product a short "ends in …" line under the price. Everything disappears by itself once `end` is past.
//
// The prices themselves live in Shopify: the sale price is the product's price, the original price its "Compare-at
// price" (Prix avant réduction). The site shows a product as discounted when Shopify gives a compare-at price above
// its price. French law (art. L112-1-1 Code de la consommation): the crossed-out price must be the lowest price of the
// 30 days before the sale. At the end of the sale, set the prices back in Shopify: the site does not change them.

import { t, locale } from './i18n.js';

export const PROMO = {
  start: '2026-11-22T00:00:00+01:00',
  end: '2026-12-15T23:59:59+01:00',
  // the banner opens this product (the Christmas bundle), found by its look in src/catalog.js
  kind: 'gift',
};

const pad = (n) => String(n).padStart(2, '0');
export const promoOn = (now = Date.now()) => now >= Date.parse(PROMO.start) && now < Date.parse(PROMO.end);
export const discounted = (p) => promoOn() && p.compareAt > p.price;

// "12 j 04 h 10 min" (with seconds in the last day)
export function left(now = Date.now()) {
  const s = Math.max(0, Math.floor((Date.parse(PROMO.end) - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60;
  const u = t('promo.units');
  return d ? `${d} ${u[0]} ${pad(h)} ${u[1]} ${pad(m)} ${u[2]}` : `${pad(h)} ${u[1]} ${pad(m)} ${u[2]} ${pad(s % 60)} ${u[3]}`;
}

export const endDay = () => new Date(Date.parse(PROMO.end)).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

// Banner over the shop list. `open()` opens the bundle (or nothing if it is not in the shop).
export function mountBanner(el, open) {
  if (!promoOn()) return el.remove();
  el.hidden = false;
  el.innerHTML = `
    <span class="pr-k">${t('promo.kicker')}</span>
    <span class="pr-t">${t('promo.title')}</span>
    <span class="pr-c" role="timer" aria-live="off"><i>${t('promo.ends')}</i> <b></b></span>`;
  if (open) el.onclick = open;
  else el.classList.add('static');
  const b = el.querySelector('b');
  const tick = () => {
    if (!promoOn()) {
      clearInterval(timer);
      return el.remove();
    }
    b.textContent = left();
  };
  const timer = setInterval(tick, 1000);
  tick();
}
