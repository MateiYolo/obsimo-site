// Notifications de vente sur les téléphones (Web Push). Rien à configurer : la paire de clés VAPID est créée au
// premier abonnement et gardée en base (merch_settings.push_vapid, illisible hors du serveur), les abonnements dans
// merch_settings.push_subs. Sur iPhone, il faut iOS 16.4+ et l'appli ajoutée à l'écran d'accueil.

import webpush from 'web-push';
import { db, q, setting } from './db.js';

const SUBJECT = 'https://www.obsimo.com/ventes/';

export async function vapid() {
  let keys = await setting('push_vapid');
  if (!keys?.publicKey) {
    keys = webpush.generateVAPIDKeys();
    // ne remplace jamais une paire déjà enregistrée (deux premiers abonnements en même temps)
    await q(db().from('merch_settings').upsert({ key: 'push_vapid', value: keys }, { onConflict: 'key', ignoreDuplicates: true }));
    keys = await setting('push_vapid');
  }
  return keys;
}

export async function subscribe(sub, device, name) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('Abonnement invalide');
  const list = ((await setting('push_subs')) || []).filter((x) => x.sub.endpoint !== sub.endpoint && x.device !== device);
  list.push({ sub, device: String(device || ''), name: String(name || '').trim().slice(0, 40), at: new Date().toISOString() });
  await q(db().from('merch_settings').upsert({ key: 'push_subs', value: list }));
}

export async function unsubscribe(device, endpoint) {
  const list = ((await setting('push_subs')) || []).filter((x) => x.device !== device && x.sub.endpoint !== endpoint);
  await q(db().from('merch_settings').upsert({ key: 'push_subs', value: list }));
}

export async function subscribers() {
  return ((await setting('push_subs')) || []).map(({ device, name, at }) => ({ device, name, at }));
}

// Envoie à tous les téléphones abonnés, sauf `exceptDevice` (celui qui vient de saisir la vente) ; `only` : un seul. Ne lève jamais :
// une notification ratée ne doit pas faire échouer une vente. Les abonnements expirés sont retirés.
export async function notify(payload, { exceptDevice, only } = {}) {
  try {
    const list = (await setting('push_subs')) || [];
    const targets = list.filter((x) => (!exceptDevice || x.device !== exceptDevice) && (!only || x.device === only));
    if (!targets.length) return 0;
    const keys = await vapid();
    webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
    const dead = new Set();
    await Promise.all(
      targets.map((x) =>
        webpush.sendNotification(x.sub, JSON.stringify(payload), { TTL: 24 * 3600, urgency: 'normal' }).catch((e) => {
          if (e.statusCode === 404 || e.statusCode === 410) dead.add(x.sub.endpoint);
          else console.error('push', e.statusCode, e.body);
        }),
      ),
    );
    if (dead.size) await q(db().from('merch_settings').upsert({ key: 'push_subs', value: list.filter((x) => !dead.has(x.sub.endpoint)) }));
    return targets.length - dead.size;
  } catch (e) {
    console.error('push', e);
    return 0;
  }
}

const euros = (c) => `${(c / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })} €`;
const WHERE = { shopify: 'sur le site', sumup: 'en concert', cash: 'en espèces', bandcamp: 'sur Bandcamp', wholesale: 'à un disquaire', other: '' };

// « 💿 8 Days in Sweden × 2 · 60 € » pour une vente
export function saleMessage(sale) {
  const lines = sale.lines || [];
  const what = lines.map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ''}`).join(', ') || 'Vente';
  const where = WHERE[sale.channel] || '';
  return {
    title: `Vente ${where}`.trim() + ` · ${euros(sale.total_cents || 0)}`,
    body: what + (sale.note ? ` · ${sale.note}` : ''),
    tag: `sale-${sale.external_id || Date.now()}`,
    url: '/ventes/#/ventes',
  };
}
