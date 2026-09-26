// Shopify Storefront API client. Configure VITE_SHOPIFY_DOMAIN and VITE_SHOPIFY_TOKEN in .env.local
// (public Storefront token, safe to ship to the browser). Without them the demo catalogue is used.
//
// Conventions in the Shopify admin, so the 3D models know what to show:
//   - product type or tag "vinyle"/"vinyl" → vinyl, "sauce" → hot sauce, anything else → flat card
//   - image alt text "cover", "back", "disc" (top-down PNG with transparency) or "label" → used by the 3D model;
//     every other image is a photo in the detail page
//   - metafields (namespace "custom"): preview_audio (URL, 30 s mp3), accent (hex colour), kicker (short line),
//     details (JSON list of {title, body}), liquid / label / ink / heat (sauce look)

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

const META = ['preview_audio', 'accent', 'kicker', 'details', 'liquid', 'label', 'ink', 'heat']
  .map((k) => `{namespace: "custom", key: "${k}"}`)
  .join(', ');

const PRODUCTS = `
query Products {
  products(first: 50, sortKey: MANUAL) {
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
  const type = `${n.productType} ${n.tags.join(' ')}`.toLowerCase();
  const kind = /vinyl|vinyle|\blp\b/.test(type) ? 'vinyl' : /sauce/.test(type) ? 'sauce' : 'merch';
  const imgs = n.images.nodes;
  const byAlt = (a) => imgs.find((i) => (i.altText || '').toLowerCase() === a)?.url;
  const modelAlts = ['cover', 'back', 'disc', 'label'];
  const photos = imgs.filter((i) => !modelAlts.includes((i.altText || '').toLowerCase())).map((i) => i.url);
  const v = n.variants.nodes[0];
  const [first, ...rest] = n.description.split(/(?<=[.!?])\s+/);

  let details = [];
  try { details = meta.details ? JSON.parse(meta.details) : []; } catch {}

  return {
    id: n.id,
    handle: n.handle,
    kind,
    title: n.title,
    kicker: meta.kicker || n.productType,
    blurb: first || '',
    description: rest.join(' ') || n.description,
    price: Number(v?.price.amount || 0),
    currency: v?.price.currencyCode || 'EUR',
    variantId: v?.id,
    available: v?.availableForSale !== false,
    accent: meta.accent || (kind === 'sauce' ? '#b5401f' : '#d9d6cc'),
    audio: meta.preview_audio || null,
    audioSeed: 0,
    model:
      kind === 'vinyl'
        ? { cover: byAlt('cover') || imgs[0]?.url, back: byAlt('back'), disc: byAlt('disc'), label: byAlt('label'), discColor: '#0b0b0b' }
        : kind === 'sauce'
          ? { liquid: meta.liquid || '#8f1d0c', label: meta.label || '#171411', ink: meta.ink || '#efe7da', heat: Number(meta.heat || 3), cap: '#141414' }
          : {},
    images: photos,
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
