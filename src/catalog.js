// Demo catalogue used until the Shopify Storefront API is configured (see .env.example).
// Every product has the same shape as what src/shopify.js returns, so the UI does not care where it comes from.
//
//   kind     'vinyl' | 'bundle' | 'sauce' | 'merch'  → which 3D model is built (bundle: several records)
//   model    textures / colours for that model
//   audio    URL of a 30 s preview (null = no music)
//   images   real photos shown in the detail page

import { lang } from './i18n.js';

const A = (f) => `${import.meta.env.BASE_URL}assets/${f}`;
// high-resolution artwork for the 3D record (shared with the mockup generator)
const H = (f) => A(`hifi/${f}`);
const SLEEVE_8DIS = {
  cover: H('cover-front.jpg'),
  back: H('cover-back.jpg'),
  varnishFront: H('varnish-front.png'),
  varnishBack: H('varnish-back.png'),
  label: H('label-a.webp'),
  labelB: H('label-b.webp'),
};

// Life Balance: green board sleeve with a die-cut window onto the label, a tall holographic sticker down the left side
// (black ink on foil, like the sauce label), green/cream swirl pressing. Side A (hands) shows through the window.
const L = (f) => A(`life-balance/${f}`);
const SLEEVE_LB = {
  cover: L('cover-front.jpg'),
  back: L('cover-back.jpg'),
  label: L('label-a.webp'),
  labelB: L('label-b.webp'),
  dieCut: true,
  rest: 0, // record fully in: the window shows the whole label
  // cm on the 31.4 cm front face, measured on the product photo
  sticker: { art: L('sticker.webp'), x: -12.49, y: 0, h: 29.4 },
};

// La Sauce Piqu'hans: green sauce, gold screw cap, label printed in black on a holographic sticker
const PIQUHANS = {
  kind: 'sauce',
  accent: '#9aa33a',
  model: { art: A('sauce/piquhans-label.webp'), holo: true, liquid: '#3a3f0e', cap: '#d2bb82', capMetal: true },
};

// 8 Days in Sweden (and the bundle that holds it) is sold as a pre-order until its release (midnight, Paris time):
// the detail page shows a countdown and the golden ticket (one of the 5 test pressings slipped into a random
// pre-ordered copy).
const LB_TRACKS =
  "A1 · He Needs Me\nA2 · Love Balance\nA3 · U\nA4 · BDXBXL (ft Shuttle)\nA5 · Off Track\nA6 · It Won't Be Long\nB1 · Call Center\nB2 · Dreamer\nB3 · Stay In A Loop\nB4 · I Fall (ft Monoko)\nB5 · B4D MOOD\nB6 · I Don't Mind";

const PREORDER_8DIS = { release: '2026-12-03T00:00:00+01:00', goldenTicket: true };

// The record postcard: the printed front under a grooved film (it plays on a turntable, centre hole on the spindle),
// a plain postcard on the back with the holographic Obsimo sticker as its stamp.
const P = (f) => A(`postcard/${f}`);
const POSTCARD = {
  kind: 'postcard',
  accent: '#7fc4d8',
  model: { recto: P('recto.jpg'), sticker: P('sticker.webp') },
};

// Product texts owned by the site, in both languages: they replace Shopify's (whose copy exists in one language
// only) field by field, so a field left out here (details, kicker…) keeps its Shopify value. The English is the text
// of the Shopify listing, the French its translation. Matched like the shop order: by handle, else by title.
export const COPY = {
  '8-days-in-sweden-marble': {
    fr: {
      title: 'Vinyle - 8 Days in Sweden',
      blurb:
        'Vinyle marbre blanc / 8 Days in Sweden (édition limitée). Obsimo, Monoko et Inkko ont passé 8 jours dans une cabane en Suède, en plein cœur de l’hiver.',
      description:
        "Juste à côté du lac Vänern, le plus grand lac de Suède, entièrement gelé à -10 °C. Entre deux sessions, ils partaient marcher sur la glace, puis revenaient faire de la musique au coin du feu. Il en est sorti 10 morceaux de musique électronique. L'album s'appelle 8 Days in Sweden et sort en vinyle. Les expéditions commenceront fin novembre 2026 ! L'album sort le 3 décembre.",
    },
    en: {
      title: 'Vinyl - 8 days in Sweden',
      blurb:
        'White Marble Vinyl / 8 days in Sweden (Limited Edition). Obsimo, Monoko and Inkko spent 8 days in a cabin in Sweden in the dead of winter.',
      description:
        "Right next to Lake Vänern, Sweden's largest lake, completely frozen over at -10°C. Between sessions they'd walk out onto the ice, come back, make music by the fireplace. 10 tracks of electronic music came out of it. The album is called 8 Days in Sweden, available on vinyl. Shipping will start from late November 2026! The album will be released on December 3.",
    },
  },
};

// Texts of the demo catalogue (used without Shopify), in both languages (the shop shows the one picked in
// src/i18n.js).
const TEXT = {
  '8-days-in-sweden-marble': {
    fr: { kicker: 'Vinyle 12" · Marbre blanc', ...COPY['8-days-in-sweden-marble'].fr, details: [] },
    en: { kicker: '12" vinyl · White marble', ...COPY['8-days-in-sweden-marble'].en, details: [] },
  },
  'hot-sauce-obsimo-x-piquhans-50ml': {
    fr: {
      title: "Obsimo × La Sauce Piqu'hans",
      kicker: 'Sauce piquante · 50 ml',
      blurb: 'Piment vert, citronnelle et kaffir, aux notes de curry vert. Faite à Nantes avec amour.',
      description:
        "Née d'une amitié, cette sauce piquante aux notes de curry vert se savoure en écoutant la musique électronique d'Obsimo. Une pause piquante et sonore à partager. 100 % naturelle et végane.",
      details: [
        { title: 'Ingrédients', body: 'Piment vert (jalapeño et oiseau), eau, vinaigre de cidre, citron vert, sucre de canne, oignon, galanga, citronnelle, feuille de kaffir, sel, gomme naturelle de xanthane.' },
        { title: 'Conservation', body: 'Au réfrigérateur après ouverture. À consommer de préférence avant la date inscrite sous la bouteille.' },
        { title: 'Livraison', body: 'Bouteille en verre calée dans un étui carton. Expédiée sous 3 jours ouvrés.' },
      ],
    },
    en: {
      title: "Obsimo × La Sauce Piqu'hans",
      kicker: 'Hot sauce · 50 ml',
      blurb: 'Green chilli, lemongrass and kaffir lime, with green curry notes. Made in Nantes with love.',
      description:
        "Born from a friendship, this hot sauce with green curry notes is best enjoyed while listening to Obsimo's electronic music. A spicy, sonic break to share. 100% natural and vegan.",
      details: [
        { title: 'Ingredients', body: "Green chilli (jalapeño and bird's eye), water, cider vinegar, lime, cane sugar, onion, galangal, lemongrass, kaffir lime leaf, salt, natural xanthan gum." },
        { title: 'Storage', body: 'Keep refrigerated after opening. Best before the date printed under the bottle.' },
        { title: 'Shipping', body: 'Glass bottle wedged in a cardboard case. Ships within 3 working days.' },
      ],
    },
  },
  'life-balance-swirl': {
    fr: {
      title: 'Life Balance',
      kicker: 'Vinyle 12" · Swirl vert',
      blurb: 'Life Balance Extended : douze titres, avec Shuttle et Monoko, pressés sur un swirl vert et crème.',
      description:
        'La version longue de Life Balance : douze titres, dont BDXBXL avec Shuttle et I Fall avec Monoko. Pochette carton verte à fenêtre découpée sur le macaron, sticker holographique, et un vinyle swirl vert et crème : chaque exemplaire a ses propres taches.',
      details: [
        { title: 'Tracklist', body: LB_TRACKS },
        { title: 'Le pressage', body: 'Vinyle swirl vert et crème, 33 tours. Pochette carton avec fenêtre ronde découpée sur le macaron, sticker holographique. OSR Records.' },
        SHIPPING_RECORD.fr,
      ],
    },
    en: {
      title: 'Life Balance',
      kicker: '12" vinyl · Green swirl',
      blurb: 'Life Balance Extended: twelve tracks, featuring Shuttle and Monoko, pressed on a green and cream swirl.',
      description:
        'The extended version of Life Balance: twelve tracks, including BDXBXL with Shuttle and I Fall with Monoko. Green board sleeve with a die-cut window onto the label, holographic sticker, and a green and cream swirl vinyl: every copy has its own pattern.',
      details: [
        { title: 'Tracklist', body: LB_TRACKS },
        { title: 'The pressing', body: 'Green and cream swirl vinyl, 33 rpm. Board sleeve with a round die-cut window onto the label, holographic sticker. OSR Records.' },
        SHIPPING_RECORD.en,
      ],
    },
  },
  'bundle-8-days-in-sweden-life-balance': {
    fr: {
      title: 'Bundle vinyles',
      kicker: '2 vinyles 12" · Swirl vert + Marbre blanc',
      blurb: 'Life Balance et 8 Days in Sweden, les deux pressages ensemble.',
      description: 'Le swirl vert et crème de Life Balance et le marbre blanc de 8 Days in Sweden, expédiés ensemble dans un seul carton renforcé.',
      details: [
        { title: 'Contenu', body: 'Life Balance · vinyle swirl vert et crème, pochette à fenêtre\n8 Days in Sweden · vinyle marbre blanc, vernis sélectif' },
        SHIPPING_RECORD.fr,
      ],
    },
    en: {
      title: 'Vinyl bundle',
      kicker: '2 × 12" vinyl · Green swirl + White marble',
      blurb: 'Life Balance and 8 Days in Sweden, both pressings together.',
      description: "Life Balance's green and cream swirl and 8 Days in Sweden's white marble, shipped together in a single reinforced box.",
      details: [
        { title: 'Contents', body: 'Life Balance · green and cream swirl vinyl, window sleeve\n8 Days in Sweden · white marble vinyl, spot varnish' },
        SHIPPING_RECORD.en,
      ],
    },
  },
  'carte-postale-vinyle': {
    fr: {
      title: 'Carte postale vinyle',
      kicker: 'Carte postale · se joue sur platine',
      blurb: 'Une carte postale gravée comme un disque : pose-la sur la platine, le trou central sur l’axe.',
      description:
        'Au recto, le visuel sous un film transparent gravé de sillons : elle se joue comme un vinyle. Au dos, une vraie carte postale à écrire et à envoyer, avec le sticker holographique Obsimo en guise de timbre.',
      details: [
        { title: 'La carte', body: 'Recto imprimé sous film gravé, lisible en 33 tours. Verso carte postale avec sticker holographique.' },
        { title: 'Livraison', body: 'Expédiée à plat sous enveloppe rigide, sous 3 jours ouvrés.' },
      ],
    },
    en: {
      title: 'Vinyl postcard',
      kicker: 'Postcard · plays on a turntable',
      blurb: 'A postcard cut like a record: put it on the turntable, centre hole on the spindle.',
      description:
        'On the front, the artwork under a clear film cut with grooves: it plays like a vinyl record. On the back, a real postcard to write and send, with the holographic Obsimo sticker as its stamp.',
      details: [
        { title: 'The card', body: 'Front printed under a grooved film, plays at 33 rpm. Postcard back with a holographic sticker.' },
        { title: 'Shipping', body: 'Shipped flat in a rigid envelope, within 3 working days.' },
      ],
    },
  },
};
const text = (handle) => TEXT[handle][lang];

export const demoCatalog = [
  {
    id: 'demo-8dis-marble',
    handle: '8-days-in-sweden-marble',
    kind: 'vinyl',
    ...text('8-days-in-sweden-marble'),
    price: 32,
    currency: 'EUR',
    variantId: null,
    accent: '#d9d6cc',
    audio: null,
    model: { ...SLEEVE_8DIS, disc: H('vinyl-marble.webp') },
    preorder: PREORDER_8DIS,
    images: [A('insert-recto.jpg'), A('insert-verso.jpg'), A('cover-front.jpg'), A('cover-back.jpg')],
  },
  {
    id: 'demo-sauce-piquhans',
    handle: 'hot-sauce-obsimo-x-piquhans-50ml',
    kind: 'sauce',
    ...text('hot-sauce-obsimo-x-piquhans-50ml'),
    price: 8,
    currency: 'EUR',
    variantId: null,
    ...PIQUHANS,
    audio: null,
    images: [],
  },
  {
    id: 'demo-life-balance-swirl',
    handle: 'life-balance-swirl',
    kind: 'vinyl',
    ...text('life-balance-swirl'),
    price: 30,
    currency: 'EUR',
    variantId: null,
    accent: '#3dbb6c',
    audio: null,
    model: { ...SLEEVE_LB, disc: L('disc.webp') },
    images: [L('photo-disc.webp'), L('photo-sleeve.webp')],
  },
  {
    id: 'demo-bundle-vinyls',
    handle: 'bundle-8-days-in-sweden-life-balance',
    kind: 'bundle',
    ...text('bundle-8-days-in-sweden-life-balance'),
    price: 55,
    currency: 'EUR',
    variantId: null,
    accent: '#8fc9a0',
    audio: null,
    model: { cover: SLEEVE_8DIS.cover, records: [{ ...SLEEVE_LB, disc: L('disc.webp') }, { ...SLEEVE_8DIS, disc: H('vinyl-marble.webp'), rest: 0 }] },
    preorder: PREORDER_8DIS, // ships with 8 Days in Sweden, so it is a pre-order too
    images: [L('photo-sleeve.webp'), L('photo-disc.webp')],
  },
  {
    id: 'demo-postcard',
    handle: 'carte-postale-vinyle',
    ...text('carte-postale-vinyle'),
    price: 10,
    currency: 'EUR',
    variantId: null,
    ...POSTCARD,
    audio: null,
    images: [P('photo-verso.webp')],
  },
];

// 3D look of each Shopify product, keyed by its handle. The visuals live here on purpose, not in Shopify:
// Shopify gives title, texts, price, stock and photos; this table decides which model is built and how it looks.
// A product missing from the table is shown as a flat card with its first Shopify photo.
const lookOf = (handle) => {
  const { kind, accent, model, preorder } = demoCatalog.find((p) => p.handle === handle);
  return { kind, accent, model, preorder };
};
const LIFE_BALANCE = lookOf('life-balance-swirl');
const BUNDLE = lookOf('bundle-8-days-in-sweden-life-balance');

export const visuals = {
  // the two Life Balance listings on Shopify are the same green/cream swirl pressing
  'transparent-green-vinyl-life-balance-limited-edition': LIFE_BALANCE,
  'life-balance-vinyl-33-transparent-green': LIFE_BALANCE,
  'hot-sauce-obsimo-x-piquhans-50ml': PIQUHANS,
  '8-days-in-sweden-marble': lookOf('8-days-in-sweden-marble'),
  'bundle-8-days-in-sweden-life-balance': BUNDLE,
  'carte-postale-vinyle': POSTCARD,
};

// When the Shopify handle isn't in the table above (a listing renamed, or created with another handle), the title
// decides: a postcard gets the postcard (even one named after a record), a bundle (or a listing naming both records)
// gets the two records, then any "8 Days in Sweden" or "Life Balance" listing gets its record.
const has8dis = (t) => /8\s*days\s*in\s*sweden/i.test(t);
const hasLb = (t) => /life\s*balance/i.test(t);
const byTitle = [
  [(t) => /carte\s*postale|post\s*-?\s*card/i.test(t), POSTCARD],
  [(t) => (has8dis(t) && hasLb(t)) || (/bundle|coffret|pack|lot de/i.test(t) && /vinyl|8\s*days|life\s*balance/i.test(t)), BUNDLE],
  [has8dis, lookOf('8-days-in-sweden-marble')],
  [hasLb, LIFE_BALANCE],
];
export const lookFor = (handle, title = '') => visuals[handle] || byTitle.find(([test]) => test(title))?.[1] || {};

// Order of the shop, whatever order Shopify returns: 8 Days in Sweden, Life Balance, the hot sauce, the bundle,
// the postcard, then anything else. Matched on the title so renamed handles keep their place.
const isBundle = (t) => /bundle|coffret|pack|lot de/i.test(t) || (has8dis(t) && hasLb(t));
const isCard = (t) => /carte|post\s*-?\s*card|\bcards?\b/i.test(t);
const ORDER = [
  (t) => has8dis(t) && !isBundle(t) && !isCard(t),
  (t) => hasLb(t) && !isBundle(t) && !isCard(t),
  (t) => /sauce|piqu/i.test(t),
  isBundle,
  isCard,
];
const rank = (p) => {
  const i = ORDER.findIndex((test) => test(p.title));
  return i < 0 ? ORDER.length : i;
};
export const sortProducts = (list) => [...list].sort((a, b) => rank(a) - rank(b));

// The site's own texts (COPY) over a Shopify product, in the visitor's language. Same matching as the order above:
// the handle, else the title (8 Days in Sweden, Life Balance, the hot sauce, the bundle, the postcard).
const COPY_KEYS = ['8-days-in-sweden-marble', 'life-balance-swirl', 'hot-sauce-obsimo-x-piquhans-50ml', 'bundle-8-days-in-sweden-life-balance', 'carte-postale-vinyle'];
export const localize = (p) => ({ ...p, ...(COPY[p.handle] || COPY[COPY_KEYS[rank(p)]])?.[lang] });

// Shopify has two Life Balance listings (the old "Life Balance Transparent Green" and the swirl): only the swirl is
// shown. Kept: the listing titled swirl, else the ones not titled transparent, else not the old handle, else the
// limited edition; never all of them dropped.
const isLbSingle = (t) => hasLb(t) && !isBundle(t) && !isCard(t);
export const isLifeBalance = (p) => isLbSingle(p.title);
const LB_KEEP = [
  (p) => /swirl/i.test(p.title),
  (p) => !/transparent/i.test(p.title),
  (p) => p.handle !== 'life-balance-vinyl-33-transparent-green',
  (p) => /limited|limit[ée]e/i.test(p.title),
];
export function dedupe(list) {
  const lb = list.filter((p) => isLbSingle(p.title));
  if (lb.length < 2) return list;
  const keep = LB_KEEP.map((test) => lb.filter(test)).find((l) => l.length) || [lb[0]];
  return list.filter((p) => !isLbSingle(p.title) || keep.includes(p));
}

// Placeholder "photos" for products that have none yet: moody gradients drawn on a canvas.
export function placeholderPhotos(p, n = 3) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 750;
    const g = c.getContext('2d');
    g.fillStyle = '#121212';
    g.fillRect(0, 0, c.width, c.height);
    const gr = g.createRadialGradient(300 + (i - 1) * 120, 330 + i * 40, 20, 300, 375, 460);
    gr.addColorStop(0, p.accent);
    gr.addColorStop(1, '#0d0d0d');
    g.globalAlpha = 0.75;
    g.fillStyle = gr;
    g.fillRect(0, 0, c.width, c.height);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '500 22px "Space Grotesk", sans-serif';
    g.fillText(`photo ${i + 1}`, 32, 710);
    out.push(c.toDataURL('image/jpeg', 0.8));
  }
  return out;
}
