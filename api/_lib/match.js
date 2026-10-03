// Retrouve le produit d'une ligne de vente à partir de son nom (caisse SumUp, titre Shopify).
// Même normalisation que merch_norm() en base : minuscules, espaces réduits.

export const norm = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// Les noms reconnus d'un produit : son nom et ses alias (sumup_names, qui servent aussi aux titres Shopify).
export function byName(products, label) {
  const n = norm(label);
  if (!n) return null;
  return products.find((p) => norm(p.name) === n || p.sumup_names.some((x) => norm(x) === n)) || null;
}
