// API du dashboard /ventes. Une seule fonction, l'action dans ?a=… ; tout est réservé aux personnes connectées
// (mot de passe DASHBOARD_PASSWORD), sauf la connexion elle-même.

import { checkPassword, sessionCookie, logoutCookie, isLoggedIn } from './_lib/auth.js';
import { db, q, products as loadProducts, setting, feeFor, recordSale, setStatus } from './_lib/db.js';
import { adminConfigured, ordersSince, syncOrder, pushStock } from './_lib/shopify.js';
import { sumupConfigured, syncSumup } from './_lib/sumup.js';

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });

const CHANNELS = ['shopify', 'sumup', 'bandcamp', 'cash', 'other'];
const MOVES = ['initial', 'restock', 'adjust', 'gift', 'loss'];
const int = (v) => (v === '' || v === null || v === undefined ? null : Math.round(Number(v)));

async function stockMap() {
  const rows = await q(db().from('merch_stock').select('*'));
  return Object.fromEntries(rows.map((r) => [r.product_id, r.qty]));
}

const actions = {
  // tout ce que le dashboard affiche, en un appel (quelques milliers de lignes au plus)
  async data() {
    const [products, stock, sales, movements, expenses, fees] = await Promise.all([
      loadProducts(),
      stockMap(),
      q(
        db()
          .from('merch_sales')
          .select('id, channel, external_id, occurred_at, status, payment_method, total_cents, shipping_cents, fees_cents, refunded_cents, event, note, lines:merch_sale_lines(id, product_id, label, qty, unit_price_cents, unit_cost_cents)')
          .order('occurred_at', { ascending: false })
          .limit(5000),
      ),
      q(db().from('merch_stock_movements').select('id, product_id, qty, reason, occurred_at, note').is('sale_id', null).order('occurred_at', { ascending: false }).limit(500)),
      q(db().from('merch_expenses').select('*').order('occurred_at', { ascending: false })),
      setting('fees'),
    ]);
    return {
      products: products.map((p) => ({ ...p, stock: stock[p.id] ?? 0 })),
      sales,
      movements,
      expenses,
      fees,
      integrations: {
        shopifyWebhook: !!process.env.SHOPIFY_WEBHOOK_SECRET,
        shopifyAdmin: adminConfigured(),
        sumup: sumupConfigured(),
      },
    };
  },

  // vente saisie à la main (Bandcamp, espèces, correction)
  async sale(b) {
    const channel = CHANNELS.includes(b.channel) ? b.channel : 'other';
    const lines = (b.lines || [])
      .map((l) => ({ product_id: l.product_id || null, label: String(l.label || ''), qty: int(l.qty), unit_price_cents: int(l.unit_price_cents) }))
      .filter((l) => l.qty > 0 && l.unit_price_cents !== null && (l.product_id || l.label));
    if (!lines.length) throw new Error('Aucun article');
    const products = await loadProducts();
    for (const l of lines) l.label ||= products.find((p) => p.id === l.product_id)?.name || 'Article';
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price_cents, 0);
    const total = int(b.total_cents) ?? subtotal + (int(b.shipping_cents) || 0);
    const fees = int(b.fees_cents) ?? feeFor(await setting('fees'), channel, total);
    const id = await recordSale({
      channel,
      external_id: null,
      occurred_at: b.occurred_at || new Date().toISOString(),
      payment_method: b.payment_method || null,
      total_cents: total,
      shipping_cents: int(b.shipping_cents) || 0,
      fees_cents: fees,
      event: b.event || null,
      note: b.note || null,
      lines,
    });
    return { id };
  },

  async 'sale-status'(b) {
    if (!['refunded', 'cancelled', 'partially_refunded'].includes(b.status)) throw new Error('Statut inconnu');
    await setStatus(b.id, b.status, int(b.refunded_cents));
    return { ok: true };
  },

  async 'sale-update'(b) {
    const patch = {};
    if ('event' in b) patch.event = b.event || null;
    if ('note' in b) patch.note = b.note || null;
    if ('fees_cents' in b) patch.fees_cents = int(b.fees_cents) || 0;
    await q(db().from('merch_sales').update(patch).eq('id', b.id));
    return { ok: true };
  },

  // renomme le concert d'une soirée : toutes ses ventes en caisse prennent le même nom
  async 'night-rename'(b) {
    const ids = (b.ids || []).filter(Boolean);
    if (!ids.length) throw new Error('Aucune vente');
    await q(db().from('merch_sales').update({ event: String(b.event || '').trim() || null }).in('id', ids).in('channel', ['sumup', 'cash']));
    return { ok: true };
  },

  // supprime une vente et ses mouvements de stock (erreur de saisie) ; une vente importée reviendrait au prochain import
  async 'sale-delete'(b) {
    await q(db().from('merch_sales').delete().eq('id', b.id));
    return { ok: true };
  },

  // mouvement de stock hors vente : stock de départ, réassort, inventaire, cadeau, casse
  async movement(b) {
    if (!MOVES.includes(b.reason)) throw new Error('Motif inconnu');
    let qty = int(b.qty);
    if (b.absolute) qty -= (await stockMap())[b.product_id] ?? 0; // inventaire : « il en reste N », on enregistre l'écart
    else if (['gift', 'loss'].includes(b.reason)) qty = -Math.abs(qty);
    else if (b.reason === 'restock') qty = Math.abs(qty);
    if (!qty) throw new Error('Quantité nulle');
    await q(
      db().from('merch_stock_movements').insert({ product_id: b.product_id, qty, reason: b.reason, note: b.note || null, occurred_at: b.occurred_at || new Date().toISOString() }),
    );
    return { ok: true };
  },

  async 'movement-delete'(b) {
    await q(db().from('merch_stock_movements').delete().eq('id', b.id).is('sale_id', null));
    return { ok: true };
  },

  async product(b) {
    const row = {
      name: String(b.name || '').trim(),
      category: b.category || 'merch',
      price_cents: int(b.price_cents),
      cost_cents: int(b.cost_cents),
      sumup_names: (b.sumup_names || []).map((s) => String(s).trim()).filter(Boolean),
      shopify_handles: (b.shopify_handles || []).map((s) => String(s).trim()).filter(Boolean),
      components: b.components || [],
      active: b.active !== false,
    };
    if (!row.name) throw new Error('Nom manquant');
    if (b.isNew) {
      const id = String(b.id || row.name)
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      await q(db().from('merch_products').insert({ ...row, id, sort: int(b.sort) ?? 100 }));
      return { id };
    }
    await q(db().from('merch_products').update(row).eq('id', b.id));
    return { id: b.id };
  },

  // associe un article inconnu (nom SumUp / Shopify) à un produit, pour toutes ses ventes passées et futures
  async assign(b) {
    const n = await q(db().rpc('merch_assign_label', { lbl: b.label, pid: b.product_id }));
    return { lines: n };
  },

  async expense(b) {
    const row = { occurred_at: b.occurred_at, label: String(b.label || '').trim(), amount_cents: int(b.amount_cents), category: b.category || 'autre', note: b.note || null };
    if (!row.label || !row.amount_cents) throw new Error('Libellé et montant requis');
    await q(db().from('merch_expenses').insert(row));
    return { ok: true };
  },

  async 'expense-delete'(b) {
    await q(db().from('merch_expenses').delete().eq('id', b.id));
    return { ok: true };
  },

  async fees(b) {
    await q(db().from('merch_settings').upsert({ key: 'fees', value: b.fees }));
    return { ok: true };
  },

  async 'sync-sumup'(b) {
    if (!sumupConfigured()) throw new Error('SUMUP_API_KEY n’est pas configurée');
    return syncSumup({ since: b.since });
  },

  // import de l'historique Shopify (les nouvelles commandes arrivent par le webhook)
  async 'sync-shopify'(b) {
    if (!adminConfigured()) throw new Error('Accès Admin Shopify non configuré');
    const [products, fees] = await Promise.all([loadProducts(), setting('fees')]);
    const out = { created: 0, updated: 0, unchanged: 0, pending: 0, test: 0 };
    for await (const order of ordersSince(b.since || '2024-01-01')) out[await syncOrder(order, products, fees)]++;
    return out;
  },

  async 'push-stock'() {
    if (!adminConfigured()) throw new Error('Accès Admin Shopify non configuré');
    return pushStock(await loadProducts(), await stockMap());
  },
};

export async function POST(request) {
  const action = new URL(request.url).searchParams.get('a');
  const body = await request.json().catch(() => ({}));

  if (action === 'login') {
    try {
      if (!checkPassword(body.password || '')) {
        await new Promise((r) => setTimeout(r, 800)); // freine les essais en série
        return json({ error: 'Mot de passe incorrect' }, 401);
      }
    } catch (e) {
      return json({ error: e.message }, 500);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie() });
  }
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': logoutCookie() });
  if (!isLoggedIn(request)) return json({ error: 'Non connecté' }, 401);

  const fn = actions[action];
  if (!fn || action === 'data') return json({ error: 'Action inconnue' }, 404);
  try {
    return json(await fn(body));
  } catch (e) {
    console.error(action, e);
    return json({ error: e.message }, 400);
  }
}

export async function GET(request) {
  if (!isLoggedIn(request)) return json({ error: 'Non connecté' }, 401);
  try {
    return json(await actions.data());
  } catch (e) {
    console.error('data', e);
    return json({ error: e.message }, 500);
  }
}
