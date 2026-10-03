// Accès à la base Supabase (tables merch_*), côté serveur uniquement : la clé secrète ignore le RLS,
// elle ne doit jamais arriver dans le navigateur.

import { createClient } from '@supabase/supabase-js';

let client;
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL et SUPABASE_SECRET_KEY manquent dans les variables d’environnement');
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

// Résultat d'une requête Supabase, ou exception avec le message de Postgres.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return data;
}

export const products = () => q(db().from('merch_products').select('*').order('sort'));

export async function setting(key) {
  const row = await q(db().from('merch_settings').select('value').eq('key', key).maybeSingle());
  return row?.value;
}

// Commission estimée d'une vente, d'après les réglages du canal (pourcentage + fixe).
export function feeFor(fees, channel, totalCents) {
  const f = fees?.[channel];
  if (!f || totalCents <= 0) return 0;
  return Math.round((totalCents * (Number(f.pct) || 0)) / 100 + (Number(f.fixed_cents) || 0));
}

export const recordSale = (sale) => q(db().rpc('merch_record_sale', { p: sale }));
export const setStatus = (sid, status, refunded = null) =>
  q(db().rpc('merch_set_status', { sid, new_status: status, refunded }));
