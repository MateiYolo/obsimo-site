-- Le swirl a son propre compteur : ses frais (2 800 + 200 stickers + 770,79 SDRM = 3 770,79 €) sont à rembourser par
-- ses propres ventes. Corrige ventes_regles, qui le comptait comme déjà financé (0 €). Le reversement au frère sur le
-- swirl reste dû dès le 1er vendu (royalty_after_units = 0). Déjà appliqué sur la base Obsimo le 18 oct. 2026.
update public.merch_products set investment_cents = 377079 where id = 'life-balance-swirl';
