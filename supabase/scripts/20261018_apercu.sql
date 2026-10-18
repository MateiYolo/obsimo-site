-- Aperçu, en lecture seule, de ce que changent les migrations du 18 oct. 2026 (20261018000000_ventes_regles.sql et
-- 20261018000100_bandcamp_import.sql). À lancer AVANT de les appliquer (SQL Editor de Supabase) et à relire.

-- 1. Lignes Life Balance : celles qui resteront « vert transparent » et celles qui passeront au swirl, par canal.
select case when s.occurred_at >= '2026-09-07 00:00 Europe/Paris' then 'life-balance-swirl' else 'life-balance-vert' end as devient,
       s.channel, count(*) as lignes, sum(l.qty) as exemplaires,
       min(s.occurred_at)::date as de, max(s.occurred_at)::date as a
  from public.merch_sale_lines l join public.merch_sales s on s.id = l.sale_id
 where l.product_id = 'life-balance'
 group by 1, 2 order by 1, 2;

-- 2. Packs vendus : leur Life Balance sortira du stock swirl.
select s.occurred_at::date, s.channel, s.status, l.qty, l.unit_price_cents, l.unit_cost_cents
  from public.merch_sale_lines l join public.merch_sales s on s.id = l.sale_id
 where l.product_id = 'bundle-vinyles'
 order by s.occurred_at;

-- 3. Coûts figés qui vont changer (coût par exemplaire, en centimes).
select l.product_id, l.unit_cost_cents as avant,
       case l.product_id
         when 'life-balance' then case when s.occurred_at >= '2026-09-07 00:00 Europe/Paris' then 754 else 889 end
         when '8-days-in-sweden' then 720
         when 'bundle-vinyles' then 1474
         when 'sauce-piquhans' then 400
       end as apres,
       count(*) as lignes, sum(l.qty) as exemplaires
  from public.merch_sale_lines l join public.merch_sales s on s.id = l.sale_id
 where l.product_id in ('life-balance', '8-days-in-sweden', 'bundle-vinyles', 'sauce-piquhans')
 group by 1, 2, 3 order by 1, 2;

-- 4. Mouvements de stock saisis à la main : ceux de Life Balance à partir du 7 sept. passeront au swirl ;
--    un stock de départ ou un réassort déjà saisi empêche d'en créer un nouveau pour ce produit.
select m.product_id, m.reason, m.qty, m.occurred_at, m.note
  from public.merch_stock_movements m
 where m.sale_id is null
 order by m.product_id, m.occurred_at;

-- 5. Stock actuel par produit (avant nettoyage).
select * from public.merch_stock order by product_id;

-- 6. Ventes Bandcamp déjà présentes (normalement aucune) : celles qui ont le même id de transaction ne seront pas réimportées.
select external_id, occurred_at, total_cents from public.merch_sales where channel = 'bandcamp' order by occurred_at;

-- 7. Lignes qui référencent l'affiche (elle est seulement archivée, pas supprimée).
select count(*) as lignes_affiche from public.merch_sale_lines where product_id = 'affiche';

-- 8. Articles encore sans produit (à associer depuis « À traiter »).
select label, count(*) as lignes, sum(qty) as exemplaires from public.merch_sale_lines where product_id is null group by label order by 2 desc;
