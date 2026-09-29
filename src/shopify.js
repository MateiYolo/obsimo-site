// Shopify Storefront API client. Configure VITE_SHOPIFY_DOMAIN and VITE_SHOPIFY_TOKEN in .env.local
// (public Storefront token, safe to ship to the browser). Without them the demo catalogue is used.
//
// The 3D look of each product (model kind, textures, colours) comes from `visuals` in src/catalog.js, keyed by
// the Shopify handle, or failing that by its title (`lookFor`). Every Shopify image is a photo in the detail page.
// Optional metafields (namespace "custom"): preview_audio (URL, 30 s mp3), kicker (short line),
// details (JSON list of {title, body}).

import { lookFor } from './catalog.js';

const DOMAIN = import.meta.env.VITE_SHOPIFY_DOMAIN;
const TOKEN = import.meta.env.VITE_SHOPIFY_TOKEN;
const API = '2025-07';

export const shopifyEnabled = !!(DOMAIN && TOKEN);

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
query Products {
  products(first: 50) {
    nodes {
      id handle title description productType tags
      images(first: 12) { nodes { url altText } }
      variants(first: 1) { nodes { id availableForSale price { amount currencyCode } } }
      metafields(identifiers: [${META}]) { key value }
    }
  }
}`;

export async function fetchProducts() {
  const data = await gql(PRODUCTS);
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
export async function checkout(lines) {
  const data = await gql(
    `mutation Cart($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) { cart { checkoutUrl } userErrors { message } }
    }`,
    { lines: lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.qty })) }
  );
  const r = data.cartCreate;
  if (r.userErrors.length) throw new Error(r.userErrors[0].message);
  return r.cart.checkoutUrl;
}
