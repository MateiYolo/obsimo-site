// Shopify Storefront API client. Configure VITE_SHOPIFY_DOMAIN and VITE_SHOPIFY_TOKEN in .env.local
// (public Storefront token, safe to ship to the browser). Without them the demo catalogue is used.
//
// The 3D look of each product (model kind, textures, colours) comes from `visuals` in src/catalog.js, keyed by
// the Shopify handle, or failing that by its title (`lookFor`). Every Shopify image is a photo in the detail page.
// Optional metafields (namespace "custom"): preview_audio (URL, 30 s mp3), kicker (short line),
// details (JSON list of {title, body}).
//
// Texts come in the visitor's language (src/i18n.js) through @inContext: the English (or French) version of each
// product is its translation in Shopify (Translate & Adapt app), metafields included. Without a translation Shopify
// returns the store's default language.

import { lookFor } from './catalog.js';
import { lang } from './i18n.js';

const DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN;
const TOKEN = import.meta.env.VITE_SHOPIFY_TOKEN;
const API = '2025-07';

export const shopifyEnabled = !!(DOMAIN && TOKEN);

const LANG = lang.toUpperCase();

async function gql(query, variables = {}) {
  const res = await fetch(`https://${DOMAIN}/api/${API}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data;
}

const META = ['preview_audio', 'kicker', 'details']
  .map((k) => `{namespace: "custom", key: "${k}"}`)
  .join(', ');

const PRODUCTS = `
query Products @inContext(language: ${LANG}) {
  products(first: 50) {
    nodes {
      id handle title description productType tags
      # photos of the product page, resized by Shopify's CDN (the originals can be 4000 px: slow to download and decode)
      images(first: 12) { nodes { url(transform: { maxWidth: 1200, preferredContentType: WEBP }) altText } }
      variants(first: 1) { nodes { id availableForSale price { amount currencyCode } } }
      metafields(identifiers: [${META}]) { key value }
    }
  }
}`;

export async function fetchProducts() {
  // a language the store doesn't offer must not cost the whole catalogue: ask again without it
  const data = await gql(PRODUCTS).catch((e) => {
    console.warn(`Shopify : textes en ${LANG} indisponibles`, e);
    return gql(PRODUCTS.replace(/ @inContext\([^)]*\)/, ''));
  });
  return data.products.nodes.map(toProduct);
}

function toProduct(n) {
  const meta = Object.fromEntries((n.metafields || []).filter(Boolean).map((m) => [m.key, m.value]));
  const look = lookFor(n.handle, n.title);
  const v = n.variants.nodes[0];
  const [first, ...rest] = n.description.split(/(?<=[.!?])\s+/);

  let details = [];
  try { details = meta.details ? JSON.parse(meta.details) : []; } catch {}

  return {
    id: n.id,
    handle: n.handle,
    kind: look.kind || 'merch',
    title: n.title,
    kicker: meta.kicker || n.productType,
    blurb: first || '',
    description: rest.join(' ') || n.description,
    price: Number(v?.price.amount || 0),
    currency: v?.price.currencyCode || 'EUR',
    variantId: v?.id,
    available: v?.availableForSale !== false,
    accent: look.accent || '#d9d6cc',
    audio: meta.preview_audio || null,
    model: look.model || {},
    preorder: look.preorder || null,
    images: n.images.nodes.map((i) => i.url),
    details,
  };
}

// Creates a Shopify cart with the lines and returns the hosted checkout URL.
// The checkout opens in the visitor's language when the store offers it.
export async function checkout(lines) {
  const query = `mutation Cart($lines: [CartLineInput!]!) @inContext(language: ${LANG}) {
      cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } }
    }`;
  const vars = { lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.qty })) };
  const data = await gql(query, vars).catch(() => gql(query.replace(/ @inContext\([^)]*\)/, ''), vars));
  const r = data.cartCreate;
  if (r.userErrors.length) throw new Error(r.userErrors[0].message);
  return r.cart.checkoutUrl;
}
