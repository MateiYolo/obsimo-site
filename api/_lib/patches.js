// Mises à jour des données appliquées par le serveur lui-même, une seule fois chacune, au premier chargement du
// dashboard qui suit le déploiement. Plus besoin de lancer un fichier SQL à la main dans Supabase pour ce genre de
// correction (chiffres, noms, stocks). Chaque patch « réserve » sa ligne merch_settings `patch:<id>` avant de
// s'appliquer : deux chargements en même temps ne l'appliquent jamais deux fois.
// Les fichiers supabase/migrations/20261103… décrivent les mêmes changements ; ils ne sont plus à lancer.

import { db, q, setting } from './db.js';

const set = (key, value) => q(db().from('merch_settings').upsert({ key, value }));
const update = (id, patch) => q(db().from('merch_products').update(patch).eq('id', id));
const exists = async (id) => !!(await q(db().from('merch_products').select('id').eq('id', id).maybeSingle()));
async function stockOf(id) {
  const row = await q(db().from('merch_stock').select('qty').eq('product_id', id).maybeSingle());
  return row?.qty ?? 0;
}

const PATCHES = [
  {
    // Mise à jour du 3 nov. 2026 (= supabase/migrations/20261103000000_mise_a_jour_3_nov.sql). Déjà faite si le
    // partage de 8 Days existe (le fichier SQL a pu être lancé à la main) : on n'y touche pas, surtout pas à la date
    // à partir de laquelle les ventes comptent pour le frère.
    id: '2026-11-03-mise-a-jour',
    async run() {
      if (await setting('shares')) return 'déjà appliquée';
      await update('8-days-in-sweden', { investment_cents: 358292, cost_cents: 717 });
      await update('life-balance-swirl', { investment_cents: 378575, cost_cents: 757 });
      await update('sauce-piquhans', { investment_cents: 45311, cost_cents: 453 });
      const costs = (await setting('costs')) || {};
      Object.assign(costs, {
        '8-days-in-sweden': { made: 500, items: [{ label: 'Fabrication', amount_cents: 291200 }, { label: 'Affiches', amount_cents: 10000 }, { label: 'SDRM (Sacem)', amount_cents: 57092 }] },
        'life-balance-swirl': { made: 500, items: [{ label: 'Fabrication', amount_cents: 280000 }, { label: 'SDRM (Sacem)', amount_cents: 77079 }, { label: 'Étiquettes holographiques', amount_cents: 21496 }] },
        'sauce-piquhans': { made: 100, items: [{ label: 'Fabrication', amount_cents: 30311 }, { label: 'Étiquettes', amount_cents: 15000 }] },
      });
      await set('costs', costs);
      // Matei : 202 € gagnés avant le suivi, les ventes comptent une à une à partir de maintenant
      await set('royalty', { ...((await setting('royalty')) || {}), name: 'Matei', opening_cents: 20200, since: new Date().toISOString() });
      const synchros = (await setting('synchros')) || [];
      if (!synchros.some((x) => x.label === 'Synchro Valorant'))
        await set('synchros', [...synchros, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), label: 'Synchro Valorant', due_cents: 5000 }]);
      for (const id of ['sauce-piquhans', 'carte-postale']) await update(id, { royalty_cents: 100, royalty_after_units: 0 });
      // Life Balance + : 490 vinyles vert transparent, sans frais, 2 € pour Matei
      if (!(await exists('life-balance-plus'))) {
        await q(
          db().from('merch_products').insert({
            id: 'life-balance-plus', name: 'Vinyle / Life Balance + (transparent édition 2)', category: 'vinyle',
            price_cents: 2500, cost_cents: 0, investment_cents: 0, royalty_cents: 200, royalty_after_units: 0, sort: 15,
          }),
        );
        await q(db().from('merch_stock_movements').insert({ product_id: 'life-balance-plus', qty: 490, reason: 'initial', note: 'Édition vert transparent, sans frais' }));
      }
      await set('shares', { '8-days-in-sweden': { label_pct: 30, partners: ['Téo', 'Tim'] } });
      return 'appliquée';
    },
  },
  {
    // Noms des produits au même format : « Type / Nom » (= supabase/migrations/20261103000100_noms_produits.sql)
    id: '2026-11-03-noms',
    async run() {
      const names = {
        '8-days-in-sweden': 'Vinyle / 8 Days in Sweden',
        'life-balance-swirl': 'Vinyle / Life Balance (swirl)',
        'life-balance-plus': 'Vinyle / Life Balance + (transparent édition 2)',
        'life-balance-vert': 'Vinyle / Life Balance (transparent édition 1)',
        'bundle-vinyles': 'Pack / 8 Days in Sweden + Life Balance',
        'sauce-piquhans': "Hot sauce / Piqu'hans",
        'carte-postale': 'Carte postale / Vinyle',
        affiche: 'Affiche / Tournée',
      };
      for (const [id, name] of Object.entries(names)) await update(id, { name });
      return 'appliquée';
    },
  },
  {
    // Cartes postales vinyle (3 nov. 2026) : vieux tirage mal suivi. 1 000 € de fabrication pour 400 cartes, environ
    // 300 vendues à 10 € (donc remboursé), 100 en stock. Les ventes d'avant le suivi sont comptées d'un bloc
    // (costs.prior : ce qui manque aux ventes enregistrées pour arriver à 300). Matei : rien sur le passé, 1 € par
    // carte à partir du 3 nov. (patch du 3 nov.).
    id: '2026-11-03-cartes-postales',
    async run() {
      const id = 'carte-postale';
      if (!(await exists(id))) return 'produit absent';
      const lines = await q(db().from('merch_sale_lines').select('qty, unit_price_cents, sale:merch_sales(status)').eq('product_id', id));
      let units = 0;
      let revenue = 0;
      for (const l of lines) if (!['refunded', 'cancelled'].includes(l.sale?.status)) (units += l.qty), (revenue += l.qty * l.unit_price_cents);
      const prior = { units: Math.max(0, 300 - units), revenue_cents: Math.max(0, 300000 - revenue) };
      const costs = (await setting('costs')) || {};
      costs[id] = { made: 400, items: [{ label: 'Fabrication', amount_cents: 100000 }], prior };
      await set('costs', costs);
      await update(id, { price_cents: 1000, investment_cents: 100000, cost_cents: 250 });
      const diff = 100 - (await stockOf(id));
      if (diff) await q(db().from('merch_stock_movements').insert({ product_id: id, qty: diff, reason: 'adjust', note: 'Inventaire : 100 restantes' }));
      return 'appliquée';
    },
  },
];

// À appeler avant de lire les données. Rapide quand tout est déjà fait (une seule requête).
export async function applyPatches() {
  const done = new Set((await q(db().from('merch_settings').select('key').like('key', 'patch:%'))).map((r) => r.key.slice(6)));
  for (const p of PATCHES) {
    if (done.has(p.id)) continue;
    // réservation : si un autre chargement l'a déjà prise, l'insertion échoue et on passe
    const { error } = await db().from('merch_settings').insert({ key: `patch:${p.id}`, value: { at: new Date().toISOString(), status: 'en cours' } });
    if (error) continue;
    try {
      const status = await p.run();
      await set(`patch:${p.id}`, { at: new Date().toISOString(), status });
    } catch (e) {
      // raté : on libère la réservation pour réessayer au prochain chargement
      console.error('patch', p.id, e);
      await db().from('merch_settings').delete().eq('key', `patch:${p.id}`);
    }
  }
}
