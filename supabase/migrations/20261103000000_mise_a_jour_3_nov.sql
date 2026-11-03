-- ⚠️ NE PLUS LANCER À LA MAIN : appliqué automatiquement par le serveur (api/_lib/patches.js) au premier chargement
-- du dashboard. Gardé pour mémoire.
-- Mise à jour du 3 nov. 2026, chiffres donnés par Obsimo. À appliquer UNE SEULE fois (relancé, il remettrait à
-- maintenant la date à partir de laquelle les ventes comptent pour le frère) (Supabase → SQL Editor), avant ou
-- après le déploiement : l'ancien code ignore ce qu'il ne connaît pas (merch_settings.costs, .synchros, .shares).
-- Les ventes déjà faites gardent leur coût de revient (figé sur chaque ligne).

/* ---------- Coûts réels, détaillés poste par poste (onglet « Coûts » de la fiche rapide) ---------- */
--   8 Days in Sweden   : 2 912 fabrication + 100 affiches + 570,92 SDRM = 3 582,92 € / 500 = 7,17 €
--   Life Balance swirl : 2 800 fabrication + 770,79 SDRM + 214,96 étiquettes holo = 3 785,75 € / 500 = 7,57 €
--   Sauce Piqu'hans    : 303,11 fabrication + 150 étiquettes = 453,11 € / 100 bouteilles = 4,53 €
update public.merch_products set investment_cents = 358292, cost_cents = 717 where id = '8-days-in-sweden';
update public.merch_products set investment_cents = 378575, cost_cents = 757 where id = 'life-balance-swirl';
update public.merch_products set investment_cents = 45311, cost_cents = 453 where id = 'sauce-piquhans';

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
       jsonb_build_object('label', 'Étiquettes holographiques', 'amount_cents', 21496))),
     'sauce-piquhans', jsonb_build_object('made', 100, 'items', jsonb_build_array(
       jsonb_build_object('label', 'Fabrication', 'amount_cents', 30311),
       jsonb_build_object('label', 'Étiquettes', 'amount_cents', 15000))))
 where key = 'costs';

/* ---------- Matei ---------- */
-- Ce qu'il a gagné avec les vinyles jusqu'à aujourd'hui : 202 € (suivi d'avant pas fiable, compté d'un bloc).
-- Les ventes comptent à nouveau une à une à partir de maintenant.
update public.merch_settings
   set value = value || jsonb_build_object('opening_cents', 20200, 'since', to_jsonb(now()))
 where key = 'royalty';

-- Sa part de la synchro Valorant : 50 €.
insert into public.merch_settings (key, value) values ('synchros', '[]'::jsonb) on conflict (key) do nothing;
update public.merch_settings
   set value = value || jsonb_build_array(jsonb_build_object(
     'id', gen_random_uuid()::text, 'date', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'),
     'label', 'Synchro Valorant', 'due_cents', 5000))
 where key = 'synchros' and not value @> '[{"label": "Synchro Valorant"}]';

-- À partir d'aujourd'hui : 1 € par sauce et 1 € par carte postale vinyle, dès la première vendue
-- (les ventes d'avant ne comptent pas : elles sont avant la date « since » ci-dessus).
update public.merch_products set royalty_cents = 100, royalty_after_units = 0 where id in ('sauce-piquhans', 'carte-postale');

/* ---------- Life Balance + : 490 vinyles vert transparent, sans frais, pas encore en vente ---------- */
-- Prix provisoire 25 € (à régler le jour de la mise en vente) ; 2 € pour Matei par vinyle, dès le premier.
insert into public.merch_products (id, name, category, price_cents, cost_cents, investment_cents, royalty_cents, royalty_after_units, sort)
values ('life-balance-plus', 'Vinyle Life Balance +', 'vinyle', 2500, 0, 0, 200, 0, 15)
on conflict (id) do nothing;
insert into public.merch_stock_movements (product_id, qty, reason, note)
select 'life-balance-plus', 490, 'initial', 'Édition vert transparent, sans frais'
 where not exists (select 1 from public.merch_stock_movements where product_id = 'life-balance-plus' and reason = 'initial');

/* ---------- 8 Days in Sweden : partage du tirage avec Téo et Tim ---------- */
-- Une fois le pressage remboursé, les vinyles restants se partagent : 30 % pour le label (le shop Obsimo), puis les
-- 70 % restants en trois (Obsimo, Téo, Tim). Le dashboard montre la part de chacun et note la remise.
insert into public.merch_settings (key, value)
values ('shares', '{"8-days-in-sweden": {"label_pct": 30, "partners": ["Téo", "Tim"]}}')
on conflict (key) do update set value = public.merch_settings.value || excluded.value;

