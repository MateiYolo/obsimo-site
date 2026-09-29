// Two languages: French when the browser's first language is French, English for everyone else.
// `?lang=fr` / `?lang=en` (or the switch in the footer) forces one and is remembered in this browser.
//
// Static text in index.html is marked with data-i18n (text), data-i18n-html (markup), data-i18n-aria (aria-label)
// or data-i18n-content (meta content); its French version stays in the HTML, so crawlers and a page without JS
// still read French. Everything else goes through t().

const KEY = 'obsimo-lang';
const LANGS = ['fr', 'en'];

function detect() {
  const forced = new URLSearchParams(location.search).get('lang');
  if (LANGS.includes(forced)) {
    try { localStorage.setItem(KEY, forced); } catch {}
    return forced;
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch {}
  const first = (navigator.languages?.[0] || navigator.language || '').toLowerCase();
  return first.startsWith('fr') ? 'fr' : 'en';
}

export const lang = detect();
export const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';

const STRINGS = {
  fr: {
    'meta.title': 'Obsimo · Site officiel · Vinyles, merch et concerts',
    'meta.description': "Site officiel d'Obsimo, artiste électro indépendant : vinyles (8 Days in Sweden, Life Balance), merch, sauce Obsimo × Piqu'hans et dates de concert.",
    'nav.sections': 'Rubriques',
    'nav.listen': 'Écouter Obsimo',
    'nav.cart': 'Panier',
    'h1': 'Obsimo · vinyles, merch et concerts',
    'lang.switch': 'English',
    'detail.back': '← Retour',
    'detail.add': 'Ajouter au panier',
    'detail.added': 'Ajouté',
    'detail.preorder': 'Précommander',
    'detail.preordered': 'Précommandé',
    'toast.added': (title) => `${title} ajouté au panier`,
    'toast.preordered': (title) => `${title} précommandé`,
    'toast.soon': (what) => `${what} · bientôt`,
    'gallery.label': 'Photos',
    'gallery.role': 'carrousel',
    'gallery.prev': 'Photo précédente',
    'gallery.next': 'Photo suivante',
    'gallery.zoom': (i, n) => `Agrandir la photo ${i} sur ${n}`,
    'gallery.photo': (i) => `Photo ${i}`,
    'gallery.alt': (title, i, n) => (n ? `${title} · photo ${i} sur ${n}` : `${title} · photo ${i}`),
    'pre.release': (day) => `Précommande · sortie le ${day}`,
    'pre.units': ['jours', 'heures', 'min', 'sec'],
    'pre.ticket': "Ticket d'or",
    'pre.ticketText': 'Un des vinyles précommandés cache un <b>test pressing</b> en plus. Seulement 5 exemplaires pressés, un seul glissé au hasard dans une précommande.',
    'tour.loading': 'Chargement des dates…',
    'tour.error': 'Les dates sont indisponibles pour le moment.',
    'tour.empty': 'Pas de date annoncée pour le moment. Reviens bientôt.',
    'tour.soldOut': 'Complet',
    'contact.intro': 'Artiste indépendant, je sors ma musique sur mon propre label, OSR&nbsp;Records.',
    'contact.listen': 'Écouter',
    'contact.copy': "Copier l'adresse email",
    'contact.copied': 'Email copié',
    'cart.title': 'Panier',
    'cart.close': 'Fermer',
    'cart.shipping': "Livraison calculée à l'étape suivante.",
    'cart.checkout': 'Commander',
    'cart.redirect': 'Redirection…',
    'cart.empty': 'Ton panier est vide.',
    'cart.less': 'Retirer un',
    'cart.more': 'Ajouter un',
    'cart.demo': 'Mode démo : le paiement sera branché sur Shopify',
    'cart.error': 'Le paiement est indisponible, réessaie dans un instant',
    'lightbox.close': 'Fermer',
    'mini.kicker': 'Morceau secret',
    'mini.title': 'Obsimo · Inédit',
    'mini.play': 'Lecture',
    'mini.pause': 'Pause',
    'mini.close': 'Fermer le lecteur',
    'secret.unlocked': 'Morceau secret débloqué',
    'sauce.label': 'SAUCE PIQUANTE',
  },
  en: {
    'meta.title': 'Obsimo · Official site · Vinyl, merch and live dates',
    'meta.description': "Official site of Obsimo, independent electronic artist: vinyl records (8 Days in Sweden, Life Balance), merch, the Obsimo × Piqu'hans hot sauce and live dates.",
    'nav.sections': 'Sections',
    'nav.listen': 'Listen to Obsimo',
    'nav.cart': 'Cart',
    'h1': 'Obsimo · vinyl, merch and live dates',
    'lang.switch': 'Français',
    'detail.back': '← Back',
    'detail.add': 'Add to cart',
    'detail.added': 'Added',
    'detail.preorder': 'Pre-order',
    'detail.preordered': 'Pre-ordered',
    'toast.added': (title) => `${title} added to cart`,
    'toast.preordered': (title) => `${title} pre-ordered`,
    'toast.soon': (what) => `${what} · coming soon`,
    'gallery.label': 'Photos',
    'gallery.role': 'carousel',
    'gallery.prev': 'Previous photo',
    'gallery.next': 'Next photo',
    'gallery.zoom': (i, n) => `Enlarge photo ${i} of ${n}`,
    'gallery.photo': (i) => `Photo ${i}`,
    'gallery.alt': (title, i, n) => (n ? `${title} · photo ${i} of ${n}` : `${title} · photo ${i}`),
    'pre.release': (day) => `Pre-order · out ${day}`,
    'pre.units': ['days', 'hours', 'min', 'sec'],
    'pre.ticket': 'Golden ticket',
    'pre.ticketText': 'One of the pre-ordered records hides an extra <b>test pressing</b>. Only 5 were pressed, and just one is slipped into a random pre-order.',
    'tour.loading': 'Loading dates…',
    'tour.error': 'Dates are unavailable right now.',
    'tour.empty': 'No dates announced yet. Check back soon.',
    'tour.soldOut': 'Sold out',
    'contact.intro': "I'm an independent artist, releasing my music on my own label, OSR&nbsp;Records.",
    'contact.listen': 'Listen',
    'contact.copy': 'Copy email address',
    'contact.copied': 'Email copied',
    'cart.title': 'Cart',
    'cart.close': 'Close',
    'cart.shipping': 'Shipping calculated at the next step.',
    'cart.checkout': 'Checkout',
    'cart.redirect': 'Redirecting…',
    'cart.empty': 'Your cart is empty.',
    'cart.less': 'Remove one',
    'cart.more': 'Add one',
    'cart.demo': 'Demo mode: payment will be connected to Shopify',
    'cart.error': 'Checkout is unavailable, try again in a moment',
    'lightbox.close': 'Close',
    'mini.kicker': 'Secret track',
    'mini.title': 'Obsimo · Unreleased',
    'mini.play': 'Play',
    'mini.pause': 'Pause',
    'mini.close': 'Close the player',
    'secret.unlocked': 'Secret track unlocked',
    'sauce.label': 'HOT SAUCE',
  },
};

// t('key') → string; t('key', ...args) calls the entry when it is a function
export function t(key, ...args) {
  const v = STRINGS[lang][key] ?? STRINGS.fr[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
}

// Translate the static markup of index.html
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  document.title = t('meta.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-i18n-content]')) el.setAttribute('content', t(el.dataset.i18nContent));
  for (const el of root.querySelectorAll('[data-i18n-roledesc]')) el.setAttribute('aria-roledescription', t(el.dataset.i18nRoledesc));
}

// Switch to the other language: remembered, then the page reloads (products, dates and the 3D labels are built once)
export function switchLang() {
  const next = lang === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem(KEY, next); } catch {}
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  if (url.href === location.href) location.reload();
  else location.replace(url);
}
