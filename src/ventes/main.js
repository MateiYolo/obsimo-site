// Dashboard des ventes de merch : obsimo.com/ventes/ (mot de passe, voir api/ventes.js).
// Vue d'ensemble (CA, marge, graphique par mois, par produit, concerts), ventes, stock, produits et réglages.

import './ventes.css';
import { SERIES, CHANNELS, TZ, metrics, monthsOf, inMonths, summary, byMonth, byProduct, byNight, unmapped, toCsv, monthOf } from './calc.js';
import { renderChart, monthLabel } from './chart.js';

const app = document.getElementById('app');
const state = { data: null, tab: 'overview', period: '12m', table: false, channel: 'all', open: new Set() };
try {
  Object.assign(state, JSON.parse(localStorage.getItem('ventes-ui') || '{}'), { open: new Set() });
} catch {}
const remember = () => {
  try {
    localStorage.setItem('ventes-ui', JSON.stringify({ tab: state.tab, period: state.period, table: state.table, channel: state.channel }));
  } catch {}
};

/* ---------- utilitaires ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const euro0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmt = (c, round) => (round || c % 100 === 0 ? euro0 : euro).format(c / 100);
const num = new Intl.NumberFormat('fr-FR');
const dateTime = (iso) => new Date(iso).toLocaleString('fr-FR', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateLong = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const toCents = (v) => (String(v ?? '').trim() === '' ? null : Math.round(parseFloat(String(v).replace(',', '.')) * 100));
const fromCents = (c) => (c == null ? '' : (c / 100).toFixed(2).replace(/\.00$/, '').replace('.', ','));
const localInput = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const STATUS = { paid: 'Payée', partially_refunded: 'Remb. partiel', refunded: 'Remboursée', cancelled: 'Annulée' };
const MOVES = { initial: 'Stock de départ', restock: 'Réassort', adjust: 'Inventaire', gift: 'Cadeau', loss: 'Perte / casse', sale: 'Vente', refund: 'Retour' };

async function api(action, body) {
  const res = await fetch(`/api/ventes${action ? `?a=${action}` : ''}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const json = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
  if (res.status === 401 && action !== 'login') {
    state.data = null;
    renderLogin();
    throw new Error('Session expirée');
  }
  if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`);
  return json;
}

function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = `toast${bad ? ' bad' : ''}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

// exécute une action, recharge les données, affiche le résultat
async function run(fn, done) {
  try {
    const out = await fn();
    await load();
    if (done) toast(typeof done === 'function' ? done(out) : done);
    return out;
  } catch (e) {
    toast(e.message, true);
    throw e;
  }
}

async function load() {
  state.data = await api();
  render();
}

/* ---------- connexion ---------- */

function renderLogin(error) {
  app.innerHTML = `
    <form class="login" id="login">
      <div class="brand">Obsimo<span>Ventes</span></div>
      <input type="password" name="password" placeholder="Mot de passe" autocomplete="current-password" required autofocus />
      <button class="btn primary" type="submit">Entrer</button>
      ${error ? `<p class="err">${esc(error)}</p>` : ''}
    </form>`;
  app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      await api('login', { password: e.target.password.value });
      await load();
    } catch (err) {
      renderLogin(err.message);
    }
  });
}

/* ---------- squelette ---------- */

const TABS = [
  ['overview', 'Vue d’ensemble'],
  ['sales', 'Ventes'],
  ['stock', 'Stock'],
  ['settings', 'Produits & réglages'],
];

function periodOptions() {
  const years = new Set(state.data.sales.map((s) => monthOf(s.occurred_at).slice(0, 4)));
  years.add(String(new Date().getFullYear()));
  const opts = [['12m', '12 derniers mois'], ...[...years].sort().reverse().map((y) => [y, y]), ['all', 'Depuis le début']];
  return opts.map(([v, l]) => `<option value="${v}" ${state.period === v ? 'selected' : ''}>${l}</option>`).join('');
}

function render() {
  const d = state.data;
  const scrollY = window.scrollY;
  app.innerHTML = `
    <header class="top">
      <div class="brand">Obsimo<span>Ventes</span></div>
      <div class="actions">
        <button class="btn primary" data-act="new-sale">+ Vente</button>
        ${d.integrations.sumup ? '<button class="btn" data-act="sync-sumup" title="Importer les dernières ventes SumUp">Sync SumUp</button>' : ''}
        <button class="btn ghost" data-act="logout" title="Se déconnecter">Sortir</button>
      </div>
    </header>
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${state.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
    <main>${{ overview, sales: salesView, stock: stockView, settings: settingsView }[state.tab]()}</main>`;
  if (state.tab === 'overview' && !state.table) drawChart();
  window.scrollTo(0, scrollY);
}

function drawChart() {
  const box = app.querySelector('#chart');
  if (!box) return;
  const months = monthsOf(state.period, state.data.sales);
  renderChart(box, byMonth(inMonths(state.data.sales, months), months), fmt);
}

/* ---------- vue d'ensemble ---------- */

function overview() {
  const d = state.data;
  const months = monthsOf(state.period, d.sales);
  const sales = inMonths(d.sales, months);
  const expenses = inMonths(d.expenses, months);
  const t = summary(sales, expenses);
  const rows = byMonth(sales, months);
  const products = byProduct(sales, d.products);
  const nights = byNight(sales);
  const todo = unmapped(d.sales);
  const lowStock = d.products.filter((p) => p.active && !p.components.length && p.stock <= 5 && d.sales.some((s) => s.lines.some((l) => l.product_id === p.id)));
  const marginPct = t.revenue ? Math.round(((t.revenue - t.fees - t.cogs) / t.revenue) * 100) : 0;

  return `
    <div class="bar">
      <select data-period>${periodOptions()}</select>
      <button class="btn ghost" data-act="csv">Export CSV</button>
    </div>

    ${todo.length ? `
      <section class="card warn">
        <h3>⚠ Articles à associer à un produit</h3>
        <p class="muted">Ces noms viennent de la caisse SumUp ou de Shopify et ne correspondent à aucun produit : leurs ventes comptent dans le CA, mais pas dans le stock ni dans la marge. Une fois associé, le nom est retenu pour les prochaines ventes.</p>
        ${todo.map((u) => `
          <form class="assign" data-assign="${esc(u.label)}">
            <span><b>${esc(u.label)}</b> <span class="muted">· ${u.qty} vendu${u.qty > 1 ? 's' : ''}</span></span>
            <select name="product_id" required><option value="">Associer à…</option>${d.products.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
            <button class="btn">OK</button>
          </form>`).join('')}
      </section>` : ''}

    <section class="kpis">
      <div class="kpi"><span>Chiffre d’affaires</span><b>${fmt(t.revenue, true)}</b><small>${num.format(t.count)} vente${t.count > 1 ? 's' : ''} · ${num.format(t.items)} article${t.items > 1 ? 's' : ''}</small></div>
      <div class="kpi"><span>Marge sur ventes</span><b>${fmt(t.margin, true)}</b><small>${marginPct} % du CA · frais ${fmt(t.fees, true)} · fabrication ${fmt(t.cogs, true)}</small></div>
      <div class="kpi"><span>Résultat</span><b class="${t.result < 0 ? 'neg' : ''}">${fmt(t.result, true)}</b><small>après ${fmt(t.expenses, true)} de dépenses</small></div>
      <div class="kpi"><span>Stock (valeur)</span><b>${fmt(d.products.reduce((a, p) => a + (p.components.length ? 0 : Math.max(0, p.stock) * (p.cost_cents || 0)), 0), true)}</b><small>${num.format(d.products.reduce((a, p) => a + (p.components.length ? 0 : Math.max(0, p.stock)), 0))} articles au prix de revient</small></div>
    </section>
    ${t.unknownCost ? `<p class="note">${t.unknownCost} article${t.unknownCost > 1 ? 's' : ''} vendu${t.unknownCost > 1 ? 's' : ''} sans coût de revient (marge surestimée) : renseigne-le dans Produits & réglages.</p>` : ''}
    ${lowStock.length ? `<p class="note">Stock bas : ${lowStock.map((p) => `<b>${esc(p.name)}</b> (${p.stock})`).join(', ')}</p>` : ''}

    <section class="card">
      <div class="card-head">
        <h3>Chiffre d’affaires par mois</h3>
        <button class="btn ghost small" data-act="toggle-table">${state.table ? 'Graphique' : 'Tableau'}</button>
      </div>
      <div class="legend">${SERIES.map((s) => `<span><i class="sw s-${s.key}"></i>${s.label}</span>`).join('')}</div>
      ${state.table ? monthTable(rows) : '<div class="chart" id="chart"></div>'}
    </section>

    <section class="card">
      <h3>Par produit</h3>
      ${products.length ? `
      <div class="scroll"><table class="wide">
        <thead><tr><th>Produit</th><th class="r">Vendus</th><th class="r">Site</th><th class="r">Concerts</th><th class="r">CA</th><th class="r">Coût</th><th class="r">Marge brute</th><th class="r">Stock</th></tr></thead>
        <tbody>${products.map((r) => `
          <tr>
            <td>${esc(r.name)}${r.product ? '' : ' <span class="tag warn">à associer</span>'}</td>
            <td class="r">${r.qty}</td>
            <td class="r muted">${r.channels.shopify || ''}</td>
            <td class="r muted">${r.channels.live || ''}</td>
            <td class="r">${fmt(r.revenue)}</td>
            <td class="r muted">${r.unknownCost === r.qty ? '?' : fmt(r.cost)}</td>
            <td class="r">${r.unknownCost === r.qty ? '?' : fmt(r.revenue - r.cost)}</td>
            <td class="r">${r.product && !r.product.components.length ? r.product.stock : ''}</td>
          </tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">CA des articles (hors frais de port) ; marge brute = CA − coût de revient, avant commissions.</p>` : '<p class="muted">Aucune vente sur la période.</p>'}
    </section>

    <section class="card">
      <h3>Concerts</h3>
      ${nights.length ? `
      <div class="scroll"><table>
        <thead><tr><th>Soir</th><th>Concert</th><th class="r">Ventes</th><th class="r">Articles</th><th class="r">CA</th></tr></thead>
        <tbody>${nights.map((n) => `
          <tr>
            <td>${dateLong(n.night)}</td>
            <td>${n.events.size ? esc([...n.events].join(', ')) : '<span class="muted">—</span>'}</td>
            <td class="r">${n.count}</td>
            <td class="r">${n.items}</td>
            <td class="r">${fmt(n.revenue)}${n.cash ? `<br><small class="muted">dont ${fmt(n.cash)} espèces</small>` : ''}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">Aucune vente en concert sur la période.</p>'}
    </section>

    <section class="card">
      <div class="card-head">
        <h3>Dépenses</h3>
        <button class="btn small" data-act="new-expense">+ Dépense</button>
      </div>
      <p class="muted small">Ce qui n’est pas déjà dans le coût de revient des produits : envois, emballages, stand, pub…</p>
      ${expenses.length ? `<table><tbody>${expenses.map((e) => `
        <tr>
          <td class="nowrap">${new Date(e.occurred_at).toLocaleDateString('fr-FR')}</td>
          <td>${esc(e.label)} <span class="muted">· ${esc(e.category)}</span></td>
          <td class="r">${fmt(e.amount_cents)}</td>
          <td class="r"><button class="link" data-act="del-expense" data-id="${e.id}">Supprimer</button></td>
        </tr>`).join('')}</tbody></table>` : '<p class="muted">Aucune dépense sur la période.</p>'}
    </section>`;
}

function monthTable(rows) {
  return `<div class="scroll"><table>
    <thead><tr><th>Mois</th>${SERIES.map((s) => `<th class="r">${s.label}</th>`).join('')}<th class="r">Total</th><th class="r">Articles</th></tr></thead>
    <tbody>${[...rows].reverse().map((r) => `
      <tr><td>${monthLabel(r.month, true)}</td>${SERIES.map((s) => `<td class="r">${r.values[s.key] ? fmt(r.values[s.key]) : '<span class="muted">—</span>'}</td>`).join('')}<td class="r"><b>${fmt(r.total)}</b></td><td class="r">${r.items}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ---------- ventes ---------- */

function salesView() {
  const d = state.data;
  const months = monthsOf(state.period, d.sales);
  const list = inMonths(d.sales, months).filter((s) => state.channel === 'all' || s.channel === state.channel);
  const name = (l) => d.products.find((p) => p.id === l.product_id)?.name || l.label;
  return `
    <div class="bar">
      <select data-period>${periodOptions()}</select>
      <select data-channel>
        <option value="all">Tous les canaux</option>
        ${Object.entries(CHANNELS).map(([k, l]) => `<option value="${k}" ${state.channel === k ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <button class="btn ghost" data-act="csv">Export CSV</button>
    </div>
    <section class="card flush">
      ${list.length ? list.map((s) => {
        const m = metrics(s);
        const open = state.open.has(s.id);
        return `
        <div class="sale ${s.status !== 'paid' ? 'dim' : ''}">
          <button class="sale-row" data-toggle="${s.id}">
            <span class="when">${dateTime(s.occurred_at)}<small>${CHANNELS[s.channel]}${s.event ? ` · ${esc(s.event)}` : ''}${s.note ? ` · ${esc(s.note)}` : ''}</small></span>
            <span class="what">${s.lines.map((l) => `${l.qty > 1 ? `${l.qty} × ` : ''}${esc(name(l))}${l.product_id ? '' : ' <span class="tag warn">?</span>'}`).join(', ')}</span>
            <span class="amt">${fmt(m.revenue)}${s.status !== 'paid' ? `<small class="tag">${STATUS[s.status]}</small>` : ''}</span>
          </button>
          ${open ? `
          <div class="sale-detail">
            <table><tbody>
              ${s.lines.map((l) => `<tr><td>${l.qty} × ${esc(name(l))}${l.product_id && name(l) !== l.label ? ` <span class="muted">(${esc(l.label)})</span>` : ''}</td><td class="r">${fmt(l.unit_price_cents)}</td><td class="r muted">${l.unit_cost_cents == null ? 'coût ?' : `coût ${fmt(l.unit_cost_cents)}`}</td></tr>`).join('')}
              ${s.shipping_cents ? `<tr><td>Frais de port payés par le client</td><td class="r">${fmt(s.shipping_cents)}</td><td></td></tr>` : ''}
              <tr><td>Total payé</td><td class="r">${fmt(s.total_cents)}</td><td></td></tr>
              <tr><td>Commission${s.payment_method ? ` <span class="muted">(${esc(s.payment_method)})</span>` : ''}</td><td class="r">− ${fmt(s.fees_cents)}</td><td></td></tr>
              ${s.refunded_cents ? `<tr><td>Remboursé</td><td class="r">− ${fmt(s.refunded_cents)}</td><td></td></tr>` : ''}
              <tr><td><b>Marge</b></td><td class="r"><b>${fmt(m.revenue - m.fees - m.cogs)}</b></td><td></td></tr>
            </tbody></table>
            <div class="row-actions">
              <button class="btn small" data-act="edit-sale" data-id="${s.id}">Concert / note</button>
              ${s.status === 'paid' || s.status === 'partially_refunded' ? `<button class="btn small" data-act="refund" data-id="${s.id}">Remboursée</button>` : ''}
              <button class="btn small danger" data-act="del-sale" data-id="${s.id}">Supprimer</button>
            </div>
          </div>` : ''}
        </div>`;
      }).join('') : '<p class="muted pad">Aucune vente.</p>'}
    </section>`;
}

/* ---------- stock ---------- */

function stockView() {
  const d = state.data;
  const physical = d.products.filter((p) => !p.components.length);
  return `
    <section class="card flush">
      ${physical.map((p) => `
        <div class="stock ${p.active ? '' : 'dim'}">
          <div>
            <b>${esc(p.name)}</b>
            <small class="muted">${p.cost_cents != null ? `coût ${fmt(p.cost_cents)}` : 'coût inconnu'}${p.price_cents != null ? ` · vendu ${fmt(p.price_cents)}` : ''}</small>
          </div>
          <span class="qty ${p.stock <= 0 ? 'neg' : p.stock <= 5 ? 'low' : ''}">${p.stock}</span>
          <div class="row-actions">
            <button class="btn small" data-act="move" data-id="${esc(p.id)}" data-reason="restock">+ Réassort</button>
            <button class="btn small" data-act="move" data-id="${esc(p.id)}" data-reason="adjust">Inventaire</button>
            <button class="btn small ghost" data-act="move" data-id="${esc(p.id)}" data-reason="gift">Cadeau / perte</button>
          </div>
        </div>`).join('')}
    </section>
    ${d.products.some((p) => p.components.length) ? `<p class="muted small">Les packs n’ont pas de stock à eux : chaque pack vendu sort ses vinyles.</p>` : ''}
    ${d.integrations.shopifyAdmin ? `<p><button class="btn" data-act="push-stock">Envoyer ce stock à Shopify</button> <span class="muted small">remplace le stock « disponible » des produits du site par celui-ci</span></p>` : ''}

    <section class="card">
      <h3>Mouvements hors ventes</h3>
      ${d.movements.length ? `<table><tbody>${d.movements.map((m) => `
        <tr>
          <td class="nowrap">${new Date(m.occurred_at).toLocaleDateString('fr-FR')}</td>
          <td>${esc(d.products.find((p) => p.id === m.product_id)?.name || m.product_id)}<br><small class="muted">${MOVES[m.reason]}${m.note ? ` · ${esc(m.note)}` : ''}</small></td>
          <td class="r ${m.qty < 0 ? 'neg' : ''}">${m.qty > 0 ? '+' : ''}${m.qty}</td>
          <td class="r"><button class="link" data-act="del-move" data-id="${m.id}">Annuler</button></td>
        </tr>`).join('')}</tbody></table>` : '<p class="muted">Aucun mouvement. Commence par un inventaire de chaque produit (ce qu’il vous reste aujourd’hui).</p>'}
    </section>`;
}

/* ---------- produits & réglages ---------- */

function settingsView() {
  const d = state.data;
  const i = d.integrations;
  const ok = (b) => (b ? '<span class="tag ok">✓ branché</span>' : '<span class="tag">pas encore</span>');
  return `
    <section class="card">
      <div class="card-head"><h3>Produits</h3><button class="btn small" data-act="edit-product">+ Produit</button></div>
      <p class="muted small">« Noms en caisse » : les noms exacts des articles dans SumUp (et les titres Shopify inconnus), pour associer les ventes automatiquement.</p>
      <div class="scroll"><table class="wide">
        <thead><tr><th>Produit</th><th class="r">Prix</th><th class="r">Coût</th><th>Noms en caisse</th><th></th></tr></thead>
        <tbody>${d.products.map((p) => `
          <tr class="${p.active ? '' : 'dim'}">
            <td>${esc(p.name)}${p.components.length ? ' <span class="tag">pack</span>' : ''}<br><small class="muted">${esc(p.shopify_handles.join(', ') || 'pas sur le site')}</small></td>
            <td class="r">${p.price_cents != null ? fmt(p.price_cents) : '—'}</td>
            <td class="r">${p.cost_cents != null ? fmt(p.cost_cents) : p.components.length ? '<span class="muted">composants</span>' : '<span class="tag warn">?</span>'}</td>
            <td>${esc(p.sumup_names.join(', ')) || '<span class="muted">—</span>'}</td>
            <td class="r"><button class="link" data-act="edit-product" data-id="${esc(p.id)}">Modifier</button></td>
          </tr>`).join('')}</tbody>
      </table></div>
    </section>

    <section class="card">
      <h3>Commissions par canal</h3>
      <p class="muted small">Estimées sur chaque vente (pourcentage du total + fixe). Modifiables vente par vente.</p>
      <form id="fees" class="fees">
        ${Object.entries(d.fees || {}).map(([k, f]) => `
          <label><span>${esc(f.label || CHANNELS[k] || k)}</span>
            <input name="${k}.pct" inputmode="decimal" value="${String(f.pct).replace('.', ',')}" /> %
            <input name="${k}.fixed" inputmode="decimal" value="${fromCents(f.fixed_cents) || '0'}" /> €
          </label>`).join('')}
        <button class="btn">Enregistrer</button>
      </form>
    </section>

    <section class="card">
      <h3>Connexions</h3>
      <div class="integ">
        <div><b>Shopify · ventes du site en direct</b> ${ok(i.shopifyWebhook)}<small class="muted">webhook « Paiement de commande » + « Mise à jour de commande » vers /api/webhooks/shopify</small></div>
        <div><b>Shopify · historique et stock</b> ${ok(i.shopifyAdmin)}
          ${i.shopifyAdmin ? `<form class="inline" id="sync-shopify"><input type="date" name="since" value="2024-01-01" /><button class="btn small">Importer les commandes depuis</button></form>` : '<small class="muted">accès Admin API (SHOPIFY_ADMIN_TOKEN ou client id / secret)</small>'}</div>
        <div><b>SumUp · caisse des concerts</b> ${ok(i.sumup)}
          ${i.sumup ? `<form class="inline" id="sync-sumup-since"><input type="date" name="since" /><button class="btn small">Réimporter depuis</button></form><small class="muted">import automatique tous les matins</small>` : '<small class="muted">clé API SumUp (SUMUP_API_KEY)</small>'}</div>
      </div>
    </section>`;
}

/* ---------- formulaires (dialog) ---------- */

function dialog(title, body, onSubmit, submitLabel = 'Enregistrer') {
  const dlg = document.createElement('dialog');
  dlg.innerHTML = `
    <form method="dialog" class="dlg">
      <header><h3>${title}</h3><button type="button" class="link" data-close>Fermer</button></header>
      <div class="dlg-body">${body}</div>
      <footer><button class="btn primary" type="submit">${submitLabel}</button></footer>
    </form>`;
  document.body.appendChild(dlg);
  const form = dlg.querySelector('form');
  dlg.querySelector('[data-close]').onclick = () => dlg.close();
  dlg.addEventListener('close', () => dlg.remove());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await onSubmit(form);
      dlg.close();
    } catch {
      btn.disabled = false;
    }
  });
  dlg.showModal();
  return dlg;
}

function newSale() {
  const d = state.data;
  const products = d.products.filter((p) => p.active);
  const dlg = dialog(
    'Nouvelle vente',
    `
    <label>Canal
      <select name="channel">
        <option value="cash">Concert (espèces)</option>
        <option value="bandcamp">Bandcamp</option>
        <option value="other">Autre</option>
      </select>
    </label>
    <label>Date <input type="datetime-local" name="occurred_at" value="${localInput()}" required /></label>
    <div class="lines">
      ${products.map((p) => `
        <div class="line">
          <span>${esc(p.name)}</span>
          <input type="number" name="qty.${esc(p.id)}" min="0" step="1" value="0" inputmode="numeric" aria-label="Quantité ${esc(p.name)}" />
          <span class="x">×</span>
          <input name="price.${esc(p.id)}" inputmode="decimal" value="${fromCents(p.price_cents)}" aria-label="Prix ${esc(p.name)}" /> €
        </div>`).join('')}
    </div>
    <div class="grid2">
      <label>Frais de port payés <input name="shipping" inputmode="decimal" placeholder="0" /></label>
      <label>Commission <input name="fees" inputmode="decimal" placeholder="auto" /></label>
    </div>
    <label>Concert <input name="event" placeholder="ex. Lyon · La Marquise" /></label>
    <label>Note <input name="note" placeholder="facultatif" /></label>
    <p class="total" data-total></p>`,
    async (form) => {
      const f = new FormData(form);
      const lines = products
        .map((p) => ({ product_id: p.id, qty: Number(f.get(`qty.${p.id}`)) || 0, unit_price_cents: toCents(f.get(`price.${p.id}`)) ?? 0 }))
        .filter((l) => l.qty > 0);
      if (!lines.length) {
        toast('Indique au moins une quantité', true);
        throw new Error();
      }
      const channel = f.get('channel');
      await run(
        () =>
          api('sale', {
            channel,
            payment_method: channel === 'cash' ? 'cash' : null,
            occurred_at: new Date(f.get('occurred_at')).toISOString(),
            shipping_cents: toCents(f.get('shipping')) || 0,
            fees_cents: toCents(f.get('fees')),
            event: f.get('event'),
            note: f.get('note'),
            lines,
          }),
        'Vente enregistrée',
      );
    },
  );
  const update = () => {
    const f = new FormData(dlg.querySelector('form'));
    const total = products.reduce((t, p) => t + (Number(f.get(`qty.${p.id}`)) || 0) * (toCents(f.get(`price.${p.id}`)) || 0), 0) + (toCents(f.get('shipping')) || 0);
    dlg.querySelector('[data-total]').textContent = total ? `Total : ${fmt(total)}` : '';
  };
  dlg.addEventListener('input', update);
}

function moveDialog(productId, reason) {
  const p = state.data.products.find((x) => x.id === productId);
  const titles = { restock: 'Réassort', adjust: 'Inventaire', gift: 'Cadeau / perte' };
  dialog(
    `${titles[reason]} · ${esc(p.name)}`,
    `
    ${reason === 'gift' ? `<label>Motif <select name="reason"><option value="gift">Cadeau (promo, invités…)</option><option value="loss">Perte / casse</option></select></label>` : ''}
    <label>${reason === 'adjust' ? `Combien il en reste vraiment ? <small class="muted">(le dashboard en compte ${p.stock})</small>` : 'Quantité'}
      <input type="number" name="qty" min="${reason === 'adjust' ? 0 : 1}" step="1" required inputmode="numeric" autofocus />
    </label>
    <label>Date <input type="datetime-local" name="occurred_at" value="${localInput()}" required /></label>
    <label>Note <input name="note" placeholder="${reason === 'restock' ? 'ex. repressage, livraison Piqu’hans' : 'facultatif'}" /></label>`,
    async (form) => {
      const f = new FormData(form);
      const qty = Number(f.get('qty'));
      if (reason === 'adjust' && qty === p.stock) {
        toast('Le stock est déjà juste');
        return;
      }
      await run(
        () =>
          api('movement', {
            product_id: productId,
            // le tout premier inventaire d'un produit est son stock de départ
            reason: f.get('reason') || (reason === 'adjust' && !state.data.movements.some((m) => m.product_id === productId) ? 'initial' : reason),
            qty,
            absolute: reason === 'adjust',
            occurred_at: new Date(f.get('occurred_at')).toISOString(),
            note: f.get('note'),
          }),
        'Stock mis à jour',
      );
    },
  );
}

function productDialog(id) {
  const d = state.data;
  const p = d.products.find((x) => x.id === id) || { name: '', category: 'merch', price_cents: null, cost_cents: null, sumup_names: [], shopify_handles: [], components: [], active: true };
  const isNew = !id;
  dialog(
    isNew ? 'Nouveau produit' : esc(p.name),
    `
    <label>Nom <input name="name" value="${esc(p.name)}" required /></label>
    <div class="grid2">
      <label>Prix de vente (€) <input name="price" inputmode="decimal" value="${fromCents(p.price_cents)}" /></label>
      <label>Coût de revient (€) <input name="cost" inputmode="decimal" value="${fromCents(p.cost_cents)}" placeholder="${p.components.length ? 'somme des composants' : 'inconnu'}" /></label>
    </div>
    <label>Catégorie
      <select name="category">${['vinyle', 'merch', 'sauce', 'textile', 'autre'].map((c) => `<option ${p.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </label>
    <label>Noms en caisse SumUp <small class="muted">(séparés par des virgules, exactement comme dans la caisse)</small>
      <input name="sumup_names" value="${esc(p.sumup_names.join(', '))}" placeholder="ex. Vinyle, T-shirt M" />
    </label>
    <label>Handles Shopify <small class="muted">(fin de l’URL du produit sur le site)</small>
      <input name="shopify_handles" value="${esc(p.shopify_handles.join(', '))}" />
    </label>
    <label class="check"><input type="checkbox" name="active" ${p.active ? 'checked' : ''} /> Produit actif (proposé dans la saisie et le stock)</label>
    ${p.components.length ? `<p class="muted small">Pack : ${p.components.map((c) => `${c.qty} × ${esc(d.products.find((x) => x.id === c.product_id)?.name || c.product_id)}`).join(' + ')}</p>` : ''}`,
    async (form) => {
      const f = new FormData(form);
      const list = (k) => String(f.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
      await run(
        () =>
          api('product', {
            id,
            isNew,
            name: f.get('name'),
            category: f.get('category'),
            price_cents: toCents(f.get('price')),
            cost_cents: toCents(f.get('cost')),
            sumup_names: list('sumup_names'),
            shopify_handles: list('shopify_handles'),
            components: p.components,
            active: f.get('active') === 'on',
          }),
        'Produit enregistré',
      );
    },
  );
}

function expenseDialog() {
  dialog(
    'Nouvelle dépense',
    `
    <label>Libellé <input name="label" required placeholder="ex. Enveloppes vinyles, Colissimo" /></label>
    <div class="grid2">
      <label>Montant (€) <input name="amount" inputmode="decimal" required /></label>
      <label>Date <input type="date" name="occurred_at" value="${new Date().toISOString().slice(0, 10)}" required /></label>
    </div>
    <label>Catégorie
      <select name="category">${['envois', 'emballage', 'stand', 'pub', 'fabrication', 'autre'].map((c) => `<option>${c}</option>`).join('')}</select>
    </label>
    <p class="muted small">La fabrication des produits vendus est déjà comptée par leur coût de revient : ne la mets ici que pour un produit hors catalogue.</p>`,
    async (form) => {
      const f = new FormData(form);
      await run(
        () => api('expense', { label: f.get('label'), amount_cents: toCents(f.get('amount')), occurred_at: f.get('occurred_at'), category: f.get('category') }),
        'Dépense enregistrée',
      );
    },
  );
}

function editSaleDialog(id) {
  const s = state.data.sales.find((x) => x.id === id);
  dialog(
    'Vente',
    `
    <label>Concert <input name="event" value="${esc(s.event || '')}" placeholder="ex. Lyon · La Marquise" /></label>
    <label>Note <input name="note" value="${esc(s.note || '')}" /></label>
    <label>Commission (€) <input name="fees" inputmode="decimal" value="${fromCents(s.fees_cents)}" /></label>`,
    async (form) => {
      const f = new FormData(form);
      await run(() => api('sale-update', { id, event: f.get('event'), note: f.get('note'), fees_cents: toCents(f.get('fees')) || 0 }), 'Vente modifiée');
    },
  );
}

function refundDialog(id) {
  const s = state.data.sales.find((x) => x.id === id);
  dialog(
    'Remboursement',
    `
    <label>Montant remboursé (€) <input name="amount" inputmode="decimal" value="${fromCents(s.total_cents)}" required /></label>
    <p class="muted small">Remboursement total : la vente sort du CA et les articles reviennent dans le stock. Partiel : seul le montant est déduit.</p>`,
    async (form) => {
      const amount = toCents(new FormData(form).get('amount'));
      const status = amount >= s.total_cents ? 'refunded' : 'partially_refunded';
      await run(() => api('sale-status', { id, status, refunded_cents: amount }), 'Remboursement enregistré');
    },
  );
}

function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- événements ---------- */

app.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    remember();
    render();
    window.scrollTo(0, 0);
    return;
  }
  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    const id = toggle.dataset.toggle;
    state.open.has(id) ? state.open.delete(id) : state.open.add(id);
    render();
    return;
  }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;
  const d = state.data;
  switch (act) {
    case 'new-sale':
      return newSale();
    case 'new-expense':
      return expenseDialog();
    case 'edit-product':
      return productDialog(id);
    case 'edit-sale':
      return editSaleDialog(id);
    case 'refund':
      return refundDialog(id);
    case 'move':
      return moveDialog(id, btn.dataset.reason);
    case 'toggle-table':
      state.table = !state.table;
      remember();
      return render();
    case 'csv': {
      const months = monthsOf(state.period, d.sales);
      return download(`obsimo-ventes-${state.period}.csv`, toCsv(inMonths(d.sales, months), d.products));
    }
    case 'logout':
      await api('logout', {});
      state.data = null;
      return renderLogin();
    case 'sync-sumup':
      btn.disabled = true;
      btn.textContent = 'Import…';
      return run(() => api('sync-sumup', {}), (o) => `SumUp : ${o.created} nouvelle${o.created > 1 ? 's' : ''} vente${o.created > 1 ? 's' : ''}${o.updated ? `, ${o.updated} mise${o.updated > 1 ? 's' : ''} à jour` : ''}`).catch(() => render());
    case 'push-stock':
      if (!confirm('Remplacer le stock disponible sur Shopify par celui du dashboard ?')) return;
      return run(() => api('push-stock', {}), (o) => (o.products.length ? `Stock envoyé (${o.location}) : ${o.products.join(', ')}` : 'Aucun produit Shopify à mettre à jour'));
    case 'del-sale':
      if (!confirm('Supprimer cette vente ? Ses articles reviennent dans le stock.')) return;
      return run(() => api('sale-delete', { id }), 'Vente supprimée');
    case 'del-move':
      if (!confirm('Annuler ce mouvement de stock ?')) return;
      return run(() => api('movement-delete', { id: Number(id) }), 'Mouvement annulé');
    case 'del-expense':
      if (!confirm('Supprimer cette dépense ?')) return;
      return run(() => api('expense-delete', { id: Number(id) }), 'Dépense supprimée');
  }
});

app.addEventListener('change', (e) => {
  if (e.target.matches('[data-period]')) {
    state.period = e.target.value;
    remember();
    render();
  } else if (e.target.matches('[data-channel]')) {
    state.channel = e.target.value;
    remember();
    render();
  }
});

app.addEventListener('submit', async (e) => {
  const form = e.target;
  if (form.dataset.assign !== undefined) {
    e.preventDefault();
    const label = form.dataset.assign;
    const product_id = form.product_id.value;
    return run(() => api('assign', { label, product_id }), (o) => `« ${label} » associé (${o.lines} ligne${o.lines > 1 ? 's' : ''})`);
  }
  if (form.id === 'fees') {
    e.preventDefault();
    const f = new FormData(form);
    const fees = structuredClone(state.data.fees);
    for (const k of Object.keys(fees)) {
      fees[k].pct = parseFloat(String(f.get(`${k}.pct`)).replace(',', '.')) || 0;
      fees[k].fixed_cents = toCents(f.get(`${k}.fixed`)) || 0;
    }
    return run(() => api('fees', { fees }), 'Commissions enregistrées (pour les prochaines ventes)');
  }
  if (form.id === 'sync-shopify') {
    e.preventDefault();
    form.querySelector('button').disabled = true;
    return run(() => api('sync-shopify', { since: form.since.value }), (o) => `Shopify : ${o.created} commande${o.created > 1 ? 's' : ''} importée${o.created > 1 ? 's' : ''}, ${o.updated} mise${o.updated > 1 ? 's' : ''} à jour`).catch(() => render());
  }
  if (form.id === 'sync-sumup-since') {
    e.preventDefault();
    if (!form.since.value) return toast('Choisis une date', true);
    form.querySelector('button').disabled = true;
    return run(() => api('sync-sumup', { since: form.since.value }), (o) => `SumUp : ${o.created} nouvelle${o.created > 1 ? 's' : ''} vente${o.created > 1 ? 's' : ''}`).catch(() => render());
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.data && state.tab === 'overview' && !state.table && drawChart(), 150);
});

/* ---------- démarrage ---------- */

app.innerHTML = '<p class="loading">…</p>';
load().catch((e) => {
  if (e.message !== 'Session expirée') renderLogin(e.message);
});
