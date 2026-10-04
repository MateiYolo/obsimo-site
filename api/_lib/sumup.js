// Import des ventes SumUp (caisse des concerts). La caisse ne prévient pas quand elle encaisse : on va chercher les
// transactions (tous les matins par le cron, ou bouton « Synchroniser SumUp » du dashboard).
//
// Variables : SUMUP_API_KEY (clé secrète sup_sk_…, Profil développeur SumUp), SUMUP_MERCHANT_CODE (facultatif,
// retrouvé tout seul), SUMUP_SINCE (date du premier import, 2025-01-01 par défaut).

import { db, q, feeFor, recordSale, setStatus, products as loadProducts, setting } from './db.js';
import { byName } from './match.js';
import { eventFinder } from './events.js';

const BASE = 'https://api.sumup.com';
const cents = (v) => Math.round(Number(v || 0) * 100);

export const sumupConfigured = () => !!process.env.SUMUP_API_KEY;

async function get(path) {
  const res = await fetch(path.startsWith('http') ? path : BASE + path, {
    headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}` },
  });
  if (!res.ok) throw new Error(`SumUp ${res.status} : ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

let merchant;
async function txBase() {
  merchant ||= process.env.SUMUP_MERCHANT_CODE || (await get('/v0.1/me')).merchant_profile?.merchant_code;
  return merchant ? `/v2.1/merchants/${merchant}/transactions` : '/v0.1/me/transactions';
}

// Statut chez nous ; null = à ignorer (échec, en attente, ou un remboursement, compté sur la vente d'origine).
export function statusOf(tx) {
  if (tx.type && tx.type !== 'PAYMENT') return null;
  switch (tx.status) {
    case 'SUCCESSFUL':
      return tx.refunded_amount > 0 ? (cents(tx.refunded_amount) >= cents(tx.amount) ? 'refunded' : 'partially_refunded') : 'paid';
    case 'REFUNDED':
      return 'refunded';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return null; // FAILED, PENDING
  }
}

// Transaction SumUp détaillée → vente pour merch_record_sale.
export function txToSale(tx, products, fees, event) {
  const total = cents(tx.amount);
  const items = (tx.products || []).filter((p) => Number(p.quantity) > 0);
  const lines = items.map((p) => {
    const qty = Number(p.quantity);
    const lineTotal = p.total_with_vat ?? p.total_price ?? (p.price_with_vat ?? p.price) * qty;
    return {
      product_id: byName(products, p.name)?.id || null,
      label: p.name || 'Article sans nom',
      qty,
      unit_price_cents: Math.round(cents(lineTotal) / qty),
    };
  });
  const tip = cents(tx.tip_amount);
  if (!lines.length) lines.push({ product_id: null, label: 'Montant saisi', qty: 1, unit_price_cents: total - tip });
  const status = statusOf(tx);
  return {
    channel: 'sumup',
    external_id: tx.id || tx.transaction_id,
    occurred_at: tx.timestamp,
    status,
    payment_method: tx.payment_type === 'CASH' ? 'cash' : 'card',
    total_cents: total,
    fees_cents: tx.payment_type === 'CASH' ? 0 : feeFor(fees, 'sumup', total),
    refunded_cents: status === 'refunded' ? total : cents(tx.refunded_amount),
    event,
    note: tx.transaction_code || null,
    raw: { code: tx.transaction_code, card: tx.card?.type, products: tx.products || null, tip: tx.tip_amount || 0 },
    lines,
  };
}

// Synchronise les transactions depuis la dernière vente SumUp connue (moins 3 jours, pour voir passer les
// remboursements), ou depuis SUMUP_SINCE au premier passage.
export async function syncSumup({ since } = {}) {
  const base = await txBase();
  const [products, fees] = await Promise.all([loadProducts(), setting('fees')]);
  const last = await q(
    db().from('merch_sales').select('occurred_at').eq('channel', 'sumup').order('occurred_at', { ascending: false }).limit(1),
  );
  const from = since
    ? new Date(since)
    : last[0]
      ? new Date(new Date(last[0].occurred_at).getTime() - 3 * 864e5)
      : new Date(process.env.SUMUP_SINCE || '2025-01-01');

  const known = new Map(
    (
      await q(db().from('merch_sales').select('id, external_id, status, refunded_cents').eq('channel', 'sumup').gte('occurred_at', from.toISOString()))
    ).map((s) => [s.external_id, s]),
  );
  const eventOf = await eventFinder();
  const out = { created: 0, updated: 0, skipped: 0, since: from.toISOString() };

  let url = `${base}/history?oldest_time=${encodeURIComponent(from.toISOString())}&order=ascending&limit=100`;
  for (let page = 0; url && page < 50; page++) {
    const res = await get(url);
    for (const item of res.items || []) {
      const status = statusOf(item);
      const id = item.id || item.transaction_id;
      const existing = known.get(id);
      if (existing) {
        const refunded = status === 'refunded' ? cents(item.amount) : cents(item.refunded_amount);
        if (status && status !== 'paid' && (status !== existing.status || refunded !== existing.refunded_cents)) {
          await setStatus(existing.id, status, refunded);
          out.updated++;
        }
        continue;
      }
      if (!status) {
        out.skipped++;
        continue;
      }
      const tx = await get(`${base}?id=${encodeURIComponent(id)}`); // le détail porte les articles
      await recordSale(txToSale({ ...item, ...tx }, products, fees, eventOf(item.timestamp)));
      out.created++;
    }
    const next = (res.links || []).find((l) => l.rel === 'next')?.href;
    url = next ? (next.startsWith('http') || next.startsWith('/') ? next : `${base}/history?${next.replace(/^\?/, '')}`) : null;
  }
  return out;
}
