// Cart kept in the browser; the Shopify cart is only created at checkout, so browsing never waits on the network.

const KEY = 'obsimo-cart';

export class Cart {
  constructor(products) {
    this.byId = new Map(products.map((p) => [p.id, p]));
    this.lines = [];
    try {
      this.lines = JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => this.byId.has(l.id));
    } catch {}
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.lines)); } catch {}
    this.listeners.forEach((fn) => fn(this));
  }

  add(p, qty = 1) {
    const l = this.lines.find((x) => x.id === p.id);
    if (l) l.qty += qty;
    else this.lines.push({ id: p.id, variantId: p.variantId, qty });
    this.save();
  }

  set(id, qty) {
    this.lines = this.lines
      .map((l) => (l.id === id ? { ...l, qty } : l))
      .filter((l) => l.qty > 0);
    this.save();
  }

  get count() { return this.lines.reduce((s, l) => s + l.qty, 0); }
  get total() { return this.lines.reduce((s, l) => s + l.qty * this.byId.get(l.id).price, 0); }
  product(id) { return this.byId.get(id); }
}
