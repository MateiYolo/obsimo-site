// Calculs du dashboard : tout part des ventes (avec leurs lignes) renvoyées par /api/ventes.
// Montants en centimes. Les mois et les jours sont ceux de Paris.

export const TZ = 'Europe/Paris';

const monthFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
export const monthOf = (iso) => monthFmt.format(new Date(iso)).slice(0, 7); // AAAA-MM
export const dayOf = (iso) => dayFmt.format(new Date(iso)); // AAAA-MM-JJ
// la soirée d'un concert : une vente à 1 h du matin compte pour la veille
export const nightOf = (iso) => dayOf(new Date(new Date(iso).getTime() - 8 * 3600e3).toISOString());

// Les séries du graphique, dans l'ordre fixe des couleurs.
export const SERIES = [
  { key: 'shopify', label: 'Site', channels: ['shopify'] },
  { key: 'live', label: 'Concerts', channels: ['sumup', 'cash'] },
  { key: 'bandcamp', label: 'Bandcamp', channels: ['bandcamp'] },
  { key: 'other', label: 'Autre', channels: ['other'] },
];
// couleur de chaque série (variables du thème, voir index.css)
export const SERIES_COLOR = { shopify: 'var(--chart-1)', live: 'var(--chart-2)', bandcamp: 'var(--chart-3)', other: 'var(--chart-4)' };
export const seriesOf = (channel) => SERIES.find((s) => s.channels.includes(channel))?.key || 'other';

export const CHANNELS = {
  shopify: 'Site (Shopify)',
  sumup: 'Concert (SumUp)',
  cash: 'Concert (espèces)',
  bandcamp: 'Bandcamp',
  other: 'Autre',
};

const back = (s) => s.status === 'refunded' || s.status === 'cancelled'; // la marchandise est revenue

// Ce qu'une vente rapporte : CA (remboursements déduits), commissions, coût des produits sortis.
export function metrics(s) {
  const gone = !back(s);
  const lines = s.lines || [];
  return {
    revenue: s.status === 'cancelled' ? 0 : s.total_cents - s.refunded_cents,
    fees: s.status === 'cancelled' ? 0 : s.fees_cents,
    cogs: gone ? lines.reduce((t, l) => t + l.qty * (l.unit_cost_cents ?? 0), 0) : 0,
    items: gone ? lines.reduce((t, l) => t + l.qty, 0) : 0,
    unknownCost: gone ? lines.filter((l) => l.unit_cost_cents == null).reduce((t, l) => t + l.qty, 0) : 0,
  };
}

// Les périodes proposées : glissantes (24 h, 7 j), mois en cours, N derniers mois, une année 'AAAA', ou tout.
export const PRESETS = [
  ['24h', '24 dernières heures', '24 h'],
  ['7d', '7 derniers jours', '7 j'],
  ['mtd', 'Mois en cours', 'Ce mois'],
  ['6m', '6 derniers mois', '6 mois'],
  ['12m', '12 derniers mois', '12 mois'],
  ['all', 'Depuis le début', 'Tout'],
];

const hourFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
export const hourOf = (iso) => {
  const p = Object.fromEntries(hourFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}`; // AAAA-MM-JJTHH
};
const addDays = (day, n) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthSpan = (from, to) => {
  const out = [];
  for (let k = from, guard = 0; guard < 600; guard++, k = addMonths(k, 1)) {
    out.push(k);
    if (k >= to) break;
  }
  return out;
};
const lastDay = (month) => addDays(`${addMonths(month, 1)}-01`, -1).slice(8);

// Une période → ses tranches (heures, jours ou mois de Paris) et celles de la période d'avant, pour comparer.
// Le graphique a une colonne par tranche ; une vente est dans la période si sa tranche y est.
export function rangeOf(period, sales, now = new Date()) {
  const iso = now.toISOString();
  const day = dayOf(iso);
  const cur = monthOf(iso);
  if (period === '24h') {
    const hours = (from) => [...new Set(Array.from({ length: 24 }, (_, i) => hourOf(new Date(now.getTime() - (from + 23 - i) * 3600e3).toISOString())))];
    return { unit: 'hour', keys: hours(0), prev: hours(24) };
  }
  if (period === '7d') {
    const days = (from) => Array.from({ length: 7 }, (_, i) => addDays(day, i - 6 - from));
    return { unit: 'day', keys: days(0), prev: days(7) };
  }
  if (period === 'mtd') {
    const n = Number(day.slice(8));
    const before = addMonths(cur, -1);
    const upTo = Math.min(n, Number(lastDay(before)));
    return {
      unit: 'day',
      keys: Array.from({ length: n }, (_, i) => `${cur}-${String(i + 1).padStart(2, '0')}`),
      prev: Array.from({ length: upTo }, (_, i) => `${before}-${String(i + 1).padStart(2, '0')}`),
    };
  }
  let keys;
  if (period === 'all') {
    const first = sales.reduce((m, s) => (monthOf(s.occurred_at) < m ? monthOf(s.occurred_at) : m), cur);
    return { unit: 'month', keys: monthSpan(first, cur), prev: null };
  } else if (/^\d{4}$/.test(period)) keys = monthSpan(`${period}-01`, period === cur.slice(0, 4) ? cur : `${period}-12`);
  else keys = monthSpan(addMonths(cur, period === '6m' ? -5 : -11), cur);
  // la période précédente de même durée : les N mois qui précèdent
  return { unit: 'month', keys, prev: keys.map((k) => addMonths(k, -keys.length)) };
}

// Tranche d'une date (ISO ou AAAA-MM-JJ pour les dépenses, qui n'ont pas d'heure).
const keyOf = (unit, v) => {
  const s = String(v);
  if (s.length === 10) return unit === 'month' ? s.slice(0, 7) : unit === 'day' ? s : null;
  return unit === 'hour' ? hourOf(s) : unit === 'day' ? dayOf(s) : monthOf(s);
};

export function inRange(list, unit, keys, dateKey = 'occurred_at') {
  const set = new Set(keys);
  if (unit === 'hour') {
    // une dépense du jour compte pour les 24 dernières heures si son jour en fait partie
    const days = new Set(keys.map((k) => k.slice(0, 10)));
    return list.filter((x) => (String(x[dateKey]).length === 10 ? days.has(x[dateKey]) : set.has(hourOf(x[dateKey]))));
  }
  return list.filter((x) => set.has(keyOf(unit, x[dateKey])));
}

export function summary(sales, expenses) {
  const t = { revenue: 0, fees: 0, cogs: 0, items: 0, count: 0, unknownCost: 0 };
  for (const s of sales) {
    if (s.status === 'cancelled') continue;
    const m = metrics(s);
    for (const k of ['revenue', 'fees', 'cogs', 'items', 'unknownCost']) t[k] += m[k];
    t.count++;
  }
  t.margin = t.revenue - t.fees - t.cogs;
  t.expenses = expenses.reduce((a, e) => a + e.amount_cents, 0);
  t.result = t.margin - t.expenses;
  return t;
}

// CA par tranche (heure, jour ou mois), par série.
export function byBucket(sales, unit, keys) {
  const rows = keys.map((key) => ({ key, values: Object.fromEntries(SERIES.map((s) => [s.key, 0])), total: 0, items: 0 }));
  const idx = new Map(rows.map((r, i) => [r.key, i]));
  for (const s of sales) {
    const r = rows[idx.get(keyOf(unit, s.occurred_at))];
    if (!r) continue;
    const m = metrics(s);
    r.values[seriesOf(s.channel)] += m.revenue;
    r.total += m.revenue;
    r.items += m.items;
  }
  return rows;
}

// Par produit : quantités, CA des lignes, coût, marge brute. Les articles non associés gardent leur nom.
export function byProduct(sales, products) {
  const map = new Map();
  for (const s of sales) {
    if (back(s)) continue;
    for (const l of s.lines || []) {
      const key = l.product_id || `?${l.label}`;
      const p = products.find((x) => x.id === l.product_id);
      const r = map.get(key) || { key, product: p, name: p?.name || l.label, qty: 0, revenue: 0, cost: 0, unknownCost: 0, channels: {} };
      r.qty += l.qty;
      r.revenue += l.qty * l.unit_price_cents;
      r.cost += l.qty * (l.unit_cost_cents ?? 0);
      if (l.unit_cost_cents == null) r.unknownCost += l.qty;
      r.channels[seriesOf(s.channel)] = (r.channels[seriesOf(s.channel)] || 0) + l.qty;
      map.set(key, r);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

// Les soirées de concert : ventes en caisse regroupées par concert (ou par soir quand le concert est inconnu).
export function byNight(sales) {
  const map = new Map();
  for (const s of sales) {
    if (!['sumup', 'cash'].includes(s.channel) || s.status === 'cancelled') continue;
    const night = nightOf(s.occurred_at);
    const r = map.get(night) || { night, events: new Set(), ids: [], revenue: 0, items: 0, count: 0, cash: 0 };
    const m = metrics(s);
    if (s.event) r.events.add(s.event);
    r.ids.push(s.id);
    r.revenue += m.revenue;
    r.items += m.items;
    r.count++;
    if (s.channel === 'cash' || s.payment_method === 'cash') r.cash += m.revenue;
    map.set(night, r);
  }
  return [...map.values()].sort((a, b) => (a.night < b.night ? 1 : -1));
}

// Articles arrivés sans produit associé (nom inconnu dans la caisse ou sur Shopify).
export function unmapped(sales) {
  const map = new Map();
  for (const s of sales) {
    for (const l of s.lines || []) {
      if (l.product_id) continue;
      const k = l.label.trim().toLowerCase();
      const r = map.get(k) || { label: l.label, qty: 0, sales: 0 };
      r.qty += l.qty;
      r.sales++;
      map.set(k, r);
    }
  }
  return [...map.values()];
}

// Export comptable : une ligne par article vendu.
export function toCsv(sales, products) {
  const name = (id) => products.find((p) => p.id === id)?.name || '';
  const eur = (c) => (c / 100).toFixed(2).replace('.', ',');
  const rows = [['date', 'canal', 'référence', 'concert', 'statut', 'paiement', 'produit', 'article', 'quantité', 'prix unitaire', 'total ligne', 'coût unitaire', 'total vente', 'frais vente', 'remboursé']];
  for (const s of [...sales].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1))) {
    (s.lines || []).forEach((l, i) => {
      rows.push([
        new Date(s.occurred_at).toLocaleString('fr-FR', { timeZone: TZ }),
        CHANNELS[s.channel] || s.channel,
        s.note || s.external_id || '',
        s.event || '',
        s.status,
        s.payment_method || '',
        name(l.product_id),
        l.label,
        l.qty,
        eur(l.unit_price_cents),
        eur(l.qty * l.unit_price_cents),
        l.unit_cost_cents == null ? '' : eur(l.unit_cost_cents),
        i === 0 ? eur(s.total_cents) : '',
        i === 0 ? eur(s.fees_cents) : '',
        i === 0 ? eur(s.refunded_cents) : '',
      ]);
    });
  }
  return rows.map((r) => r.map((v) => (/[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(';')).join('\n');
}
