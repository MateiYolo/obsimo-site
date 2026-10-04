// Shopify côté serveur : vérification des webhooks, conversion d'une commande en vente, Admin API (import de
// l'historique, envoi du stock).
//
// Variables :
//   SHOPIFY_WEBHOOK_SECRET      clé de signature des webhooks (Paramètres → Notifications → Webhooks, en bas de page,
//                               ou le « client secret » de l'app si les webhooks sont créés par l'app)
//   SHOPIFY_ADMIN_TOKEN         jeton Admin API (shpat_…), facultatif : import de l'historique et envoi du stock
//     ou SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET  (app du Dev Dashboard, jeton obtenu à la volée)
//   VITE_SHOPIFY_DOMAIN / VITE_SHOPIFY_TOKEN       ceux du site (Storefront), pour retrouver le handle d'un produit

import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, q, feeFor, recordSale, setStatus } from './db.js';
import { byName } from './match.js';

const API = '2025-07';
const domain = () => process.env.SHOPIFY_SHOP_DOMAIN || process.env.VITE_SHOPIFY_DOMAIN;
const cents = (v) => Math.round(Number(v || 0) * 100);

export function verifyWebhook(rawBody, hmacHeader) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const given = Buffer.from(hmacHeader, 'base64');
  return given.length === digest.length && timingSafeEqual(given, digest);
}

// Statut d'une commande Shopify chez nous ; null = pas encore une vente (en attente de paiement).
export function statusOf(order) {
  if (order.cancelled_at || order.financial_status === 'voided') return 'cancelled';
  if (order.financial_status === 'refunded') return 'refunded';
  if (order.financial_status === 'partially_refunded') return 'partially_refunded';
  if (order.financial_status === 'paid') return 'paid';
  return null;
}

export function refundedCents(order) {
  return (order.refunds || [])
    .flatMap((r) => r.transactions || [])
    .filter((t) => t.kind === 'refund' && t.status !== 'failure' && t.status !== 'error')
    .reduce((s, t) => s + cents(t.amount), 0);
}

// Commande Shopify (format webhook / REST) → vente pour merch_record_sale. `findProduct(line)` donne l'id produit.
export async function orderToSale(order, findProduct, fees) {
  const lines = [];
  for (const li of order.line_items || []) {
    if (!li.quantity) continue;
    const discount = (li.discount_allocations || []).reduce((s, d) => s + cents(d.amount), 0);
    const product = await findProduct(li);
    lines.push({
      product_id: product?.id || null,
      label: li.title || li.name,
      qty: li.quantity,
      unit_price_cents: Math.round((cents(li.price) * li.quantity - discount) / li.quantity),
      external_ref: li.product_id ? String(li.product_id) : null,
    });
  }
  const total = cents(order.total_price);
  return {
    channel: 'shopify',
    external_id: String(order.id),
    occurred_at: order.processed_at || order.created_at,
    status: statusOf(order),
    payment_method: (order.payment_gateway_names || [])[0] || order.gateway || null,
    total_cents: total,
    shipping_cents: cents(order.total_shipping_price_set?.shop_money?.amount ?? order.shipping_lines?.[0]?.price),
    fees_cents: feeFor(fees, 'shopify', total),
    refunded_cents: refundedCents(order),
    note: order.name || null,
    raw: { name: order.name, financial_status: order.financial_status, gateway: order.payment_gateway_names },
    lines,
  };
}

// Handle d'un produit Shopify à partir de son id, par l'API Storefront du site (puis l'Admin API si configurée).
async function handleOf(productId) {
  const gid = `gid://shopify/Product/${productId}`;
  const sfToken = process.env.VITE_SHOPIFY_TOKEN;
  if (domain() && sfToken) {
    try {
      const res = await fetch(`https://${domain()}/api/${API}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': sfToken },
        body: JSON.stringify({ query: 'query($id: ID!) { product(id: $id) { handle } }', variables: { id: gid } }),
      });
      const handle = (await res.json())?.data?.product?.handle;
      if (handle) return handle;
    } catch {}
  }
  if (adminConfigured()) {
    try {
      const d = await admin('query($id: ID!) { product(id: $id) { handle } }', { id: gid });
      return d?.product?.handle || null;
    } catch {}
  }
  return null;
}

// Associe une ligne de commande à un produit : id Shopify déjà connu, sinon son handle (et l'id est retenu pour la
// prochaine fois), sinon son titre.
export function productFinder(products) {
  return async (li) => {
    const pid = li.product_id ? String(li.product_id) : null;
    if (pid) {
      const known = products.find((p) => p.shopify_product_ids.includes(pid));
      if (known) return known;
      const handle = await handleOf(pid);
      const byHandle = handle && products.find((p) => p.shopify_handles.includes(handle));
      if (byHandle) {
        byHandle.shopify_product_ids = [...byHandle.shopify_product_ids, pid];
        await q(db().from('merch_products').update({ shopify_product_ids: byHandle.shopify_product_ids }).eq('id', byHandle.id));
        return byHandle;
      }
    }
    return byName(products, li.title);
  };
}

// Enregistre une commande, ou met à jour son statut si elle est déjà là (remboursement, annulation).
// Sert au webhook et à l'import de l'historique. Renvoie ce qui a été fait.
export async function syncOrder(order, products, fees) {
  if (order.test) return 'test';
  const status = statusOf(order);
  const existing = await q(
    db().from('merch_sales').select('id, status, refunded_cents').eq('channel', 'shopify').eq('external_id', String(order.id)).maybeSingle(),
  );
  if (!existing) {
    if (!status) return 'pending';
    await recordSale(await orderToSale(order, productFinder(products), fees));
    return 'created';
  }
  const refunded = refundedCents(order);
  if (status && (status !== existing.status || refunded !== existing.refunded_cents)) {
    await setStatus(existing.id, status, refunded);
    return 'updated';
  }
  return 'unchanged';
}

/* ---------- Admin API (facultative) ---------- */

export const adminConfigured = () =>
  !!domain() && !!(process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET));

let cachedToken;
async function adminToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  if (cachedToken && cachedToken.exp > Date.now()) return cachedToken.value;
  // app du Dev Dashboard installée sur la boutique : jeton « client credentials », valable 24 h
  const res = await fetch(`https://${domain()}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) throw new Error(`Shopify : jeton Admin refusé (${res.status})`);
  cachedToken = { value: json.access_token, exp: Date.now() + ((json.expires_in || 86400) - 300) * 1000 };
  return cachedToken.value;
}

async function adminFetch(path, init = {}) {
  const res = await fetch(`https://${domain()}/admin/api/${API}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await adminToken(), ...init.headers },
  });
  if (!res.ok) throw new Error(`Shopify Admin ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function admin(query, variables = {}) {
  const res = await adminFetch('graphql.json', { method: 'POST', body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join(', '));
  return json.data;
}

// Toutes les commandes depuis une date (REST, même format que les webhooks), page par page.
export async function* ordersSince(sinceIso) {
  let path = `orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(sinceIso)}`;
  while (path) {
    const res = await adminFetch(path);
    yield* (await res.json()).orders || [];
    const next = /<[^>]*\/admin\/api\/[^/]+\/([^>]+)>;\s*rel="next"/.exec(res.headers.get('link') || '');
    path = next ? next[1] : null;
  }
}

// Envoie le stock de nos produits (hors packs) vers Shopify, au premier emplacement de la boutique.
// Produits à une seule variante : on prend celle du premier handle actif.
export async function pushStock(products, stock) {
  const loc = (await admin('{ locations(first: 1) { nodes { id name } } }')).locations.nodes[0];
  if (!loc) throw new Error('Shopify : aucun emplacement de stock');
  const quantities = [];
  const done = [];
  for (const p of products) {
    if (p.components?.length || !p.shopify_handles.length || !p.active) continue;
    let item = p.shopify_inventory_item_id;
    if (!item) {
      for (const handle of p.shopify_handles) {
        const d = await admin(
          'query($h: String!) { productByIdentifier(identifier: { handle: $h }) { status variants(first: 2) { nodes { inventoryItem { id tracked } } } } }',
          { h: handle },
        );
        const prod = d.productByIdentifier;
        if (prod?.status === 'ACTIVE' && prod.variants.nodes.length === 1 && prod.variants.nodes[0].inventoryItem.tracked) {
          item = prod.variants.nodes[0].inventoryItem.id;
          await q(db().from('merch_products').update({ shopify_inventory_item_id: item }).eq('id', p.id));
          break;
        }
      }
    }
    if (!item) continue;
    quantities.push({ inventoryItemId: item, locationId: loc.id, quantity: Math.max(0, stock[p.id] ?? 0) });
    done.push(p.name);
  }
  if (!quantities.length) return { location: loc.name, products: [] };
  const d = await admin(
    `mutation($input: InventorySetQuantitiesInput!) {
       inventorySetQuantities(input: $input) { userErrors { field message } }
     }`,
    { input: { name: 'available', reason: 'correction', ignoreCompareQuantity: true, quantities } },
  );
  const errs = d.inventorySetQuantities.userErrors;
  if (errs.length) throw new Error(`Shopify : ${errs.map((e) => e.message).join(', ')}`);
  return { location: loc.name, products: done };
}
