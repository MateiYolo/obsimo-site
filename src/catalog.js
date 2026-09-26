// Demo catalogue used until the Shopify Storefront API is configured (see .env.example).
// Every product has the same shape as what src/shopify.js returns, so the UI does not care where it comes from.
//
//   kind     'vinyl' | 'sauce' | 'merch'  → which 3D model is built
//   model    textures / colours for that model
//   audio    URL of a 30 s preview (null = generative placeholder for vinyls, nothing for other products)
//   images   real photos shown in the detail page

const A = (f) => `${import.meta.env.BASE_URL}assets/${f}`;

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
    model: {
      cover: A('cover-front.jpg'),
      back: A('cover-back.jpg'),
      disc: A('vinyl-marble.png'),
      edge: '#eceae4',
    },
    images: [A('insert-recto.jpg'), A('insert-verso.jpg'), A('cover-front.jpg'), A('cover-back.jpg')],
    details: [
      { title: 'Tracklist', body: 'A1 · Arrivée\nA2 · Glace noire\nA3 · 8 Days\nB1 · Monoko\nB2 · Inkko\nB3 · Retour' },
      { title: 'Le pressage', body: 'Vinyle 180 g marbre blanc, 33 tours. Pochette carton 350 g avec rond central découpé, poster A2 recto verso inclus. Édition limitée à 300 exemplaires.' },
      { title: 'Livraison', body: 'Expédié sous 3 jours ouvrés dans un carton renforcé. France 5 €, Europe 12 €, monde 18 €.' },
    ],
  },
  {
    id: 'demo-sauce-feu',
    handle: 'sauce-feu-de-camp',
    kind: 'sauce',
    title: 'Feu de camp',
    kicker: 'Sauce piquante · 150 ml',
    blurb: 'Piment chipotle fumé, ail rôti et une pointe d\'érable. Chaleur 3/5.',
    description:
      'Une sauce douce-amère, fumée au bois de hêtre, pensée pour les longues soirées. Chipotle, ail rôti, vinaigre de cidre et sirop d\'érable. Parfaite sur des œufs, un burger ou juste une tranche de pain grillé.',
    price: 12,
    currency: 'EUR',
    variantId: null,
    accent: '#b5401f',
    audio: null,
    model: { liquid: '#8f1d0c', label: '#171411', ink: '#efe7da', heat: 3, cap: '#141414' },
    images: [],
    details: [
      { title: 'Ingrédients', body: 'Piment chipotle, vinaigre de cidre, ail rôti, oignon, sirop d\'érable, sel, épices.' },
      { title: 'Conservation', body: 'Au frais après ouverture, à consommer dans les 3 mois.' },
      { title: 'Livraison', body: 'Bouteille en verre calée dans un étui carton. Expédiée sous 3 jours ouvrés.' },
    ],
  },
  {
    id: 'demo-8dis-black',
    handle: '8-days-in-sweden-black',
    kind: 'vinyl',
    title: '8 Days in Sweden',
    kicker: 'Vinyle 12" · Noir classique',
    blurb: 'La même session, en noir 140 g. Pour celles et ceux qui écoutent plus qu\'ils ne regardent.',
    description:
      "L'édition standard du disque : vinyle noir 140 g, même pochette, même poster. Six titres enregistrés pendant huit jours en Suède avec Monoko et Inkko.",
    price: 26,
    currency: 'EUR',
    variantId: null,
    accent: '#6f7a86',
    audio: null,
    audioSeed: 1,
    model: {
      cover: A('cover-front.jpg'),
      back: A('cover-back.jpg'),
      label: A('label-a.png'),
      discColor: '#0b0b0b',
      edge: '#eceae4',
    },
    images: [A('insert-verso.jpg'), A('insert-recto.jpg'), A('cover-back.jpg')],
    details: [
      { title: 'Tracklist', body: 'A1 · Arrivée\nA2 · Glace noire\nA3 · 8 Days\nB1 · Monoko\nB2 · Inkko\nB3 · Retour' },
      { title: 'Le pressage', body: 'Vinyle noir 140 g, 33 tours. Pochette carton avec rond central découpé, poster A2 inclus.' },
      { title: 'Livraison', body: 'Expédié sous 3 jours ouvrés dans un carton renforcé. France 5 €, Europe 12 €, monde 18 €.' },
    ],
  },
  {
    id: 'demo-sauce-glace',
    handle: 'sauce-lac-gele',
    kind: 'sauce',
    title: 'Lac gelé',
    kicker: 'Sauce piquante · 150 ml',
    blurb: 'Habanero, citron vert et gingembre. Froide au nez, brûlante ensuite. Chaleur 5/5.',
    description:
      'La plus sauvage de la gamme. Habanero frais, citron vert, gingembre et une touche d\'aneth en clin d\'œil à la Suède. Quelques gouttes suffisent.',
    price: 13,
    currency: 'EUR',
    variantId: null,
    accent: '#c99a1a',
    audio: null,
    model: { liquid: '#d98a06', label: '#e9e5dc', ink: '#161514', heat: 5, cap: '#e9e5dc' },
    images: [],
    details: [
      { title: 'Ingrédients', body: 'Habanero, vinaigre blanc, citron vert, gingembre, carotte, aneth, sel.' },
      { title: 'Conservation', body: 'Au frais après ouverture, à consommer dans les 3 mois.' },
      { title: 'Livraison', body: 'Bouteille en verre calée dans un étui carton. Expédiée sous 3 jours ouvrés.' },
    ],
  },
];

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
    g.font = '500 22px "IBM Plex Mono", monospace';
    g.fillText(`photo ${i + 1}`, 32, 710);
    out.push(c.toDataURL('image/jpeg', 0.8));
  }
  return out;
}
