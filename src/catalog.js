// Demo catalogue used until the Shopify Storefront API is configured (see .env.example).
// Every product has the same shape as what src/shopify.js returns, so the UI does not care where it comes from.
//
//   kind     'vinyl' | 'bundle' | 'sauce' | 'merch'  → which 3D model is built (bundle: several records)
//   model    textures / colours for that model
//   audio    URL of a 30 s preview (null = generative placeholder for vinyls, nothing for other products)
//   images   real photos shown in the detail page

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

export const demoCatalog = [
  {
    id: 'demo-8dis-marble',
    handle: '8-days-in-sweden-marble',
    kind: 'vinyl',
    title: '8 Days in Sweden',
    kicker: 'Vinyle 12" · Marbre blanc',
    blurb: 'Obsimo, Monoko, Inkko. Huit jours dans un lac gelé, enregistrés sur place.',
    description:
      "Un disque né d'un voyage de huit jours en Suède, entre lacs gelés et studio de fortune. Six titres enregistrés sur place avec Monoko et Inkko, pressés sur un vinyle marbre blanc unique : aucun exemplaire n'a les mêmes veines.",
    price: 32,
    currency: 'EUR',
    variantId: null,
    accent: '#d9d6cc',
    audio: null,
    audioSeed: 0,
    model: { ...SLEEVE_8DIS, disc: H('vinyl-marble.webp') },
    images: [A('insert-recto.jpg'), A('insert-verso.jpg'), A('cover-front.jpg'), A('cover-back.jpg')],
    details: [
      { title: 'Tracklist', body: 'A1 · Arrivée\nA2 · Glace noire\nA3 · 8 Days\nB1 · Monoko\nB2 · Inkko\nB3 · Retour' },
      { title: 'Le pressage', body: 'Vinyle 180 g marbre blanc, 33 tours. Pochette carton 350 g avec rond central découpé, poster A2 recto verso inclus. Édition limitée à 300 exemplaires.' },
      { title: 'Livraison', body: 'Expédié sous 3 jours ouvrés dans un carton renforcé. France 5 €, Europe 12 €, monde 18 €.' },
    ],
  },
  {
    id: 'demo-sauce-piquhans',
    handle: 'hot-sauce-obsimo-x-piquhans-50ml',
    kind: 'sauce',
    title: "Obsimo × La Sauce Piqu'hans",
    kicker: 'Sauce piquante · 50 ml',
    blurb: 'Piment vert, citronnelle et kaffir, aux notes de curry vert. Faite à Nantes avec amour.',
    description:
      "Née d'une amitié, cette sauce piquante aux notes de curry vert se savoure en écoutant la musique électronique d'Obsimo. Une pause piquante et sonore à partager. 100 % naturelle et végane.",
    price: 8,
    currency: 'EUR',
    variantId: null,
    ...PIQUHANS,
    audio: null,
    images: [],
    details: [
      { title: 'Ingrédients', body: 'Piment vert (jalapeño et oiseau), eau, vinaigre de cidre, citron vert, sucre de canne, oignon, galanga, citronnelle, feuille de kaffir, sel, gomme naturelle de xanthane.' },
      { title: 'Conservation', body: 'Au réfrigérateur après ouverture. À consommer de préférence avant la date inscrite sous la bouteille.' },
      { title: 'Livraison', body: 'Bouteille en verre calée dans un étui carton. Expédiée sous 3 jours ouvrés.' },
    ],
  },
  {
    id: 'demo-life-balance-swirl',
    handle: 'life-balance-swirl',
    kind: 'vinyl',
    title: 'Life Balance',
    kicker: 'Vinyle 12" · Swirl vert',
    blurb: 'Life Balance Extended : douze titres, avec Shuttle et Monoko, pressés sur un swirl vert et crème.',
    description:
      "La version longue de Life Balance : douze titres, dont BDXBXL avec Shuttle et I Fall avec Monoko. Pochette carton verte à fenêtre découpée sur le macaron, sticker holographique, et un vinyle swirl vert et crème : chaque exemplaire a ses propres taches.",
    price: 30,
    currency: 'EUR',
    variantId: null,
    accent: '#3dbb6c',
    audio: null,
    audioSeed: 1,
    model: { ...SLEEVE_LB, disc: L('disc.webp') },
    images: [L('photo-disc.webp'), L('photo-sleeve.webp')],
    details: [
      {
        title: 'Tracklist',
        body: "A1 · He Needs Me\nA2 · Love Balance\nA3 · U\nA4 · BDXBXL (ft Shuttle)\nA5 · Off Track\nA6 · It Won't Be Long\nB1 · Call Center\nB2 · Dreamer\nB3 · Stay In A Loop\nB4 · I Fall (ft Monoko)\nB5 · B4D MOOD\nB6 · I Don't Mind",
      },
      { title: 'Le pressage', body: 'Vinyle swirl vert et crème, 33 tours. Pochette carton avec fenêtre ronde découpée sur le macaron, sticker holographique. OSR Records.' },
      { title: 'Livraison', body: 'Expédié sous 3 jours ouvrés dans un carton renforcé. France 5 €, Europe 12 €, monde 18 €.' },
    ],
  },
  {
    id: 'demo-bundle-vinyls',
    handle: 'bundle-8-days-in-sweden-life-balance',
    kind: 'bundle',
    title: 'Bundle vinyles',
    kicker: '2 vinyles 12" · Swirl vert + Marbre blanc',
    blurb: 'Life Balance et 8 Days in Sweden, les deux pressages ensemble.',
    description: 'Le swirl vert et crème de Life Balance et le marbre blanc de 8 Days in Sweden, expédiés ensemble dans un seul carton renforcé.',
    price: 55,
    currency: 'EUR',
    variantId: null,
    accent: '#8fc9a0',
    audio: null,
    audioSeed: 1,
    model: { cover: SLEEVE_8DIS.cover, records: [{ ...SLEEVE_LB, disc: L('disc.webp') }, { ...SLEEVE_8DIS, disc: H('vinyl-marble.webp'), rest: 0 }] },
    images: [L('photo-sleeve.webp'), L('photo-disc.webp')],
    details: [
      { title: 'Contenu', body: 'Life Balance · vinyle swirl vert et crème, pochette à fenêtre\n8 Days in Sweden · vinyle marbre blanc, vernis sélectif' },
      { title: 'Livraison', body: 'Expédié sous 3 jours ouvrés dans un carton renforcé. France 5 €, Europe 12 €, monde 18 €.' },
    ],
  },
];

// 3D look of each Shopify product, keyed by its handle. The visuals live here on purpose, not in Shopify:
// Shopify gives title, texts, price, stock and photos; this table decides which model is built and how it looks.
// A product missing from the table is shown as a flat card with its first Shopify photo.
const lookOf = (handle) => {
  const { kind, accent, audioSeed, model } = demoCatalog.find((p) => p.handle === handle);
  return { kind, accent, audioSeed, model };
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
};

// When the Shopify handle isn't in the table above (a listing renamed, or created with another handle), the title
// decides: a bundle (or a listing naming both records) gets the two records, then any "8 Days in Sweden" or
// "Life Balance" listing gets its record.
const has8dis = (t) => /8\s*days\s*in\s*sweden/i.test(t);
const hasLb = (t) => /life\s*balance/i.test(t);
const byTitle = [
  [(t) => (has8dis(t) && hasLb(t)) || (/bundle|coffret|pack|lot de/i.test(t) && /vinyl|8\s*days|life\s*balance/i.test(t)), BUNDLE],
  [has8dis, lookOf('8-days-in-sweden-marble')],
  [hasLb, LIFE_BALANCE],
];
export const lookFor = (handle, title = '') => visuals[handle] || byTitle.find(([test]) => test(title))?.[1] || {};

// Order of the shop, whatever order Shopify returns: 8 Days in Sweden, Life Balance, the hot sauce, the bundle,
// the postcard, then anything else. Matched on the title so renamed handles keep their place.
const isBundle = (t) => /bundle|coffret|pack|lot de/i.test(t) || (has8dis(t) && hasLb(t));
const isCard = (t) => /carte|postcard|post card/i.test(t);
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

// Shopify has two Life Balance listings (the old "Life Balance Transparent Green" and the swirl): only the swirl is
// shown. Kept: the listing titled swirl, else the ones not titled transparent, else not the old handle, else the
// limited edition; never all of them dropped.
const isLbSingle = (t) => hasLb(t) && !isBundle(t) && !isCard(t);
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
