// Cart kept in the browser; the Shopify cart is only created at checkout, so browsing never waits on the network.

const KEY = 'obsimo-cart';

export class Cart {
  constructor(products) {
    this.byId = new Map(products.map((p) => [p.id, p]));
    this.lines = [];
    try {
      this.lines = JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => this.byId.has(l.id) && this.variant(l));
    } catch {}
    this.listeners = new Set();
  }

  onChange(fn) { this.listeners.add(fn); }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.lines)); } catch {}
    this.listeners.forEach((fn) => fn(this));
  }

  // one line per product and variant (a postcard with two different tracks makes two lines)
  add(p, qty = 1, variantId = p.variantId) {
    const l = this.lines.find((x) => x.id === p.id && x.variantId === variantId);
    if (l) l.qty += qty;
    else this.lines.push({ id: p.id, variantId, qty });
    this.save();
  }

  set(i, qty) {
    this.lines = this.lines.map((l, j) => (j === i ? { ...l, qty } : l)).filter((l) => l.qty > 0);
    this.save();
  }

  // the variant of a line ({ title, price } or the product itself when it has no options); null if it is gone
  variant(l) {
    const p = this.byId.get(l.id);
    if (!p?.variants?.length) return p;
    return p.variants.find((v) => v.id === l.variantId) || null;
  }

  get count() { return this.lines.reduce((s, l) => s + l.qty, 0); }
  get total() { return this.lines.reduce((s, l) => s + l.qty * this.variant(l).price, 0); }
  product(id) { return this.byId.get(id); }
}
