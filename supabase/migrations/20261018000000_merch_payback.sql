-- Remboursement des tirages et reversement au frère (dashboard /ventes, écran d'accueil).
-- Les premières ventes d'un produit paient sa fabrication (batch_cost_cents) ; ensuite c'est du bonus.
-- Montants TTC, en centimes. Validé par Obsimo le 18 oct. 2026.

alter table public.merch_products
  add column batch_cost_cents integer,                  -- coût total du tirage à rembourser ; 0 = déjà financé ; null = pas suivi
  add column royalty_cents integer not null default 0,  -- reversé au frère par unité vendue…
  add column royalty_after_units integer not null default 0; -- …une fois ce nombre d'unités vendues

-- Ventes aux disquaires (prix de gros) : sortent du stock, mais ne remboursent pas le tirage et ne donnent pas droit au reversement.
alter table public.merch_sales drop constraint merch_sales_channel_check;
alter table public.merch_sales add constraint merch_sales_channel_check
  check (channel in ('shopify', 'sumup', 'bandcamp', 'cash', 'wholesale', 'other'));

-- Catalogue validé. Coûts SDRM comprise :
--   Life Balance vert transparent : 2 078 + 200 (stickers) + 388,24 (SDRM) = 2 666,24 → 8,89 / ex, frère dès le 108e
--   Life Balance swirl : 2 800 + 200 + 770,79 = 3 770,79 → 7,54 / ex, tirage financé par le 1er, frère dès le 1er
--   8 Days in Sweden : 2 912 + 115 (poster) + 570,92 = 3 597,92 → 7,20 / ex, frère dès le 121e
update public.merch_products set name = 'Vinyle Life Balance (vert transparent)', cost_cents = 889, batch_cost_cents = 266624,
  royalty_cents = 200, royalty_after_units = 107 where id = 'life-balance';
update public.merch_products set cost_cents = 754, batch_cost_cents = 0,
  royalty_cents = 200, royalty_after_units = 0 where id = 'life-balance-swirl';
update public.merch_products set price_cents = 3000, cost_cents = 720, batch_cost_cents = 359792,
  royalty_cents = 200, royalty_after_units = 120 where id = '8-days-in-sweden';
-- pack à 50 € : 30 € pour 8 Days, 20 € pour Life Balance (swirl)
update public.merch_products set price_cents = 5000, cost_cents = null, components =
  '[{"product_id": "8-days-in-sweden", "qty": 1, "revenue_cents": 3000}, {"product_id": "life-balance-swirl", "qty": 1, "revenue_cents": 2000}]'
  where id = 'bundle-vinyles';
update public.merch_products set cost_cents = 400, batch_cost_cents = 40000 where id = 'sauce-piquhans';
update public.merch_products set cost_cents = 200, batch_cost_cents = 100000 where id = 'carte-postale';
update public.merch_products set active = false where id = 'affiche';

-- Bandcamp : prix majorés pour compenser la commission, les ventes sont saisies au prix du site sans commission.
update public.merch_settings set value = jsonb_set(value, '{bandcamp}', '{"pct": 0, "fixed_cents": 0, "label": "Bandcamp (compensé par les prix)"}')
  || '{"wholesale": {"pct": 0, "fixed_cents": 0, "label": "Disquaire"}}'
  where key = 'fees';
