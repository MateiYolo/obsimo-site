-- Coûts réels des deux tirages de 500 vinyles, donnés par Obsimo le 3 nov. 2026, détaillés poste par poste
-- (onglet « Coûts » de la fiche rapide, merch_settings.costs). TTC, SDRM comprise.
--   8 Days in Sweden : 2 912 fabrication + 100 affiches + 570,92 SDRM = 3 582,92 € → 7,17 € le vinyle
--   Life Balance swirl : 2 800 fabrication + 770,79 SDRM + 214,96 étiquettes holographiques = 3 785,75 € → 7,57 € le vinyle
-- Les ventes déjà faites gardent leur coût de revient (figé sur chaque ligne). Le seuil du reversement au frère
-- (royalty_after_units) n'est pas touché. Sans effet sur l'ancien code : il ignore merch_settings.costs.

update public.merch_products set investment_cents = 358292, cost_cents = 717 where id = '8-days-in-sweden';
update public.merch_products set investment_cents = 378575, cost_cents = 757 where id = 'life-balance-swirl';

insert into public.merch_settings (key, value) values ('costs', '{}'::jsonb) on conflict (key) do nothing;
update public.merch_settings
   set value = value || jsonb_build_object(
     '8-days-in-sweden', jsonb_build_object('made', 500, 'items', jsonb_build_array(
       jsonb_build_object('label', 'Fabrication', 'amount_cents', 291200),
       jsonb_build_object('label', 'Affiches', 'amount_cents', 10000),
       jsonb_build_object('label', 'SDRM (Sacem)', 'amount_cents', 57092))),
     'life-balance-swirl', jsonb_build_object('made', 500, 'items', jsonb_build_array(
       jsonb_build_object('label', 'Fabrication', 'amount_cents', 280000),
       jsonb_build_object('label', 'SDRM (Sacem)', 'amount_cents', 77079),
       jsonb_build_object('label', 'Étiquettes holographiques', 'amount_cents', 21496))))
 where key = 'costs';
