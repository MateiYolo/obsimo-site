-- À lancer AVANT 20261018000000_ventes_regles.sql. Une première version (PR #24, fermée) a été appliquée sur la base
-- le 18 oct. 2026 (migration « merch_payback ») : elle a ajouté batch_cost_cents, royalty_cents et royalty_after_units.
-- On les retire pour que ventes_regles crée les siennes (investment_cents…) telle qu'elle est écrite.
-- Ses changements de catalogue (coûts, prix, pack, affiche archivée, frais Bandcamp) sont refaits par ventes_regles ;
-- le canal wholesale qu'elle a ajouté est recréé à l'identique. Le réglage « royalty » est gardé.
alter table public.merch_products
  drop column if exists batch_cost_cents,
  drop column if exists royalty_cents,
  drop column if exists royalty_after_units;
