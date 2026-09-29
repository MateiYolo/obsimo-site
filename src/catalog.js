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
const PREORDER_8DIS = { release: '2026-12-03T00:00:00+01:00', goldenTicket: true };

// The record postcard: the printed front under a grooved film (it plays on a turntable, centre hole on the spindle),
// a plain postcard on the back with the holographic Obsimo sticker as its stamp.
const P = (f) => A(`postcard/${f}`);
const POSTCARD = {
  kind: 'postcard',
  accent: '#7fc4d8',
  model: { recto: P('recto.jpg'), sticker: P('sticker.webp') },
};

// Product texts owned by the site, in both languages: they replace Shopify's (whose copy exists in English only)
// field by field, so a field left out here keeps its Shopify value. The English is the text of the Shopify listing,
// the French its translation. Matched like the shop order: by handle, else by title (`localize` below).
// A description can hold line breaks (a list, paragraphs): the page keeps them.
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
  'life-balance-swirl': {
    fr: {
      title: 'Vinyle - LIFE BALANCE',
      blurb:
        "Vinyle swirl vert et blanc / LIFE BALANCE + (édition limitée). Édition spéciale du nouvel album d'Obsimo, LIFE BALANCE Extended, avec 12 titres.",
      description:
        'Pressé en Europe, en série limitée. Sorti sur mon propre label, OSR Records, avec une pochette et un design originaux signés par mon frère Matei.',
    },
    en: {
      title: 'Vinyl - LIFE BALANCE',
      blurb:
        'Green & White Swirl Vinyl / LIFE BALANCE + (Limited Edition). Special edition of Obsimo’s new album, LIFE BALANCE Extended, featuring 12 tracks.',
      description:
        'Pressed in Europe, limited. Released on my own label OSR Records, with original artwork and design by my brother Matei.',
    },
  },
  'hot-sauce-obsimo-x-piquhans-50ml': {
    fr: {
      title: "Sauce piquante - Obsimo x Piqu'Hans",
      blurb:
        "Sauce piquante - Obsimo x Piqu'Hans (50 ml). Une sauce piquante unique, née d'une amitié et créée avec La Sauce Piqu’Hans.",
      description:
        "Aux notes de curry vert, avec un piquant de 3/5, cette recette végane est la pause pimentée idéale à savourer en écoutant la musique électronique d'Obsimo. Une expérience gustative et sonore à partager.\nIngrédients : piment vert (jalapeño et piment oiseau), eau, vinaigre de cidre, citron vert, sucre de canne, oignon, galanga, citronnelle, feuille de kaffir, sel, gomme de xanthane naturelle.\n100 % naturelle et végane, faite avec amour à Nantes.",
    },
    en: {
      title: "Hot Sauce - Obsimo x Piqu'Hans",
      blurb:
        "Hot Sauce - Obsimo x Piqu'Hans (50ml). A unique hot sauce born from friendship, created in collaboration with La Sauce Piqu’Hans.",
      description:
        "With green curry notes and a 3/5 chili heat level, this vegan recipe is the perfect spicy break to enjoy while listening to Obsimo’s electronic music. A flavorful and sonic experience to share.\nIngredients: green chili (jalapeño and bird’s eye), water, apple cider vinegar, lime, cane sugar, onion, galangal, lemongrass, kaffir lime leaf, salt, natural xanthan gum.\n100% natural & vegan – Made with love in Nantes.",
    },
  },
  'bundle-8-days-in-sweden-life-balance': {
    fr: {
      title: 'Bundle 2 vinyles - Life Balance + 8 Days in Sweden',
      blurb:
        "Bundle 2 vinyles : Life Balance (swirl vert et blanc) + 8 Days in Sweden (marbre blanc). Life Balance : édition spéciale du nouvel album d'Obsimo, LIFE BALANCE Extended, avec 12 titres.",
      description:
        "Pressé en Europe, en série limitée. Sorti sur mon propre label, OSR Records, avec une pochette et un design originaux signés par mon frère Matei.\n\n8 Days in Sweden : Obsimo, Monoko et Inkko ont passé 8 jours dans une cabane en Suède, en plein cœur de l’hiver. Juste à côté du lac Vänern, le plus grand lac de Suède, entièrement gelé à -10 °C. Entre deux sessions, ils partaient marcher sur la glace, puis revenaient faire de la musique au coin du feu. Il en est sorti 10 morceaux de musique électronique. L'album s'appelle 8 Days in Sweden et sort en vinyle.",
    },
    en: {
      title: 'Bundle 2 vinyls - Life Balance + 8 days in Sweden',
      blurb:
        'Bundle 2 vinyls: Life Balance (Green & White Swirl) + 8 days in Sweden (Marble White). Life Balance: special edition of Obsimo’s new album, LIFE BALANCE Extended, featuring 12 tracks.',
      description:
        "Pressed in Europe, limited. Released on my own label OSR Records, with original artwork and design by my brother Matei.\n\n8 days in Sweden: Obsimo, Monoko and Inkko spent 8 days in a cabin in Sweden in the dead of winter. Right next to Lake Vänern, Sweden's largest lake, completely frozen over at -10°C. Between sessions they'd walk out onto the ice, come back, make music by the fireplace. 10 tracks of electronic music came out of it. The album is called 8 Days in Sweden, available on vinyl.",
    },
  },
  'carte-postale-vinyle': {
    fr: {
      title: 'Carte postale vinyle - Club Memories',
      blurb: 'Carte postale vinyle - CLUB MEMORIES (signée / édition limitée). Une carte postale qui se joue comme un vinyle.',
      description:
        "Chaque vinyle ne peut jouer qu'un seul morceau : à toi de choisir ton préféré (voir l'option).\n- Vinyle signé (indique ton nom à la commande)\n- Sticker offert\n- Fait main en France\n- Le son est un peu plus lo-fi que celui d'un disque classique\n- Carte postale format A5 (148 × 210 mm) avec 3 mm de fond perdu\n- « Blackout » est un morceau secret, introuvable en ligne : tu ne peux l'écouter qu'avec cette carte postale vinyle\n\nDesign par Matei Convard, photo par @nonante.six",
    },
    en: {
      title: 'Vinyl Postcard - Club Memories',
      blurb: 'Vinyl Postcard - CLUB MEMORIES (signed / limited edition). This is a vinyl postcard.',
      description:
        "Each vinyl can play only one track, it's up to you to choose your favorite track (check the option).\n- Vinyl signed (tell me your name when ordering)\n- Free sticker\n- Handmade in France\n- The sound tends to be a bit more lo-fi than normal records\n- A5 size postcard (148 x 210 mm | 5.8 x 8.3 inch) with a 3 mm bleed\n- \"Blackout\" is a secret song not available online, you can only listen to it with this vinyl postcard\n\nDesign by Matei Convard, photo by @nonante.six",
    },
  },
};

// Demo catalogue (used without Shopify): the same texts, no kicker nor details, like the live listings.
const text = (handle) => ({ kicker: '', details: [], ...COPY[handle][lang] });

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
