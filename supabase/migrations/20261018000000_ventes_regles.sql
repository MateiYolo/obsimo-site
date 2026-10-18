-- Règles validées avec Obsimo le 18 oct. 2026 (voir README, « Règles de calcul ») : catalogue (deux Life Balance,
-- prix et coûts corrigés), canal Disquaire, reversement au frère, historique remis en ordre et stocks de départ.
-- À relire avant de l'appliquer : supabase/scripts/20261018_apercu.sql montre ce qui va bouger.

/* ---------- Schéma ---------- */

-- Disquaires (ventes en gros, ex. Hark) : sortent du stock, mais ne comptent ni pour le seuil ni pour le reversement.
alter table public.merch_sales drop constraint merch_sales_channel_check;
alter table public.merch_sales add constraint merch_sales_channel_check
  check (channel in ('shopify', 'sumup', 'bandcamp', 'cash', 'other', 'wholesale'));

alter table public.merch_products
  add column investment_cents integer,                  -- frais engagés (tirage, SDRM…) : les premières ventes les remboursent
  add column royalty_cents integer,                     -- reversé au frère par exemplaire vendu, null = rien
  add column royalty_after_units integer not null default 0,  -- … une fois ce nombre d'exemplaires vendus (seuil de rentabilité)
  add column replaced_by text references public.merch_products on update cascade,  -- même article chez Shopify / SumUp :
  add column replaced_at timestamptz;                   -- les ventes importées à partir de cette date vont sur replaced_by

-- Le produit d'une vente importée à une date donnée : suit les remplacements (vert transparent → swirl).
create function public.merch_resolve_product(pid text, ts timestamptz) returns text
  language plpgsql stable set search_path = '' as
$$
declare
  p public.merch_products;
begin
  for i in 1..10 loop
    select * into p from public.merch_products where id = pid;
    if p.replaced_by is null or p.replaced_at is null or ts < p.replaced_at then return pid; end if;
    pid := p.replaced_by;
  end loop;
  return pid;
end
$$;

-- Comme avant, mais les ventes importées (Shopify, SumUp) suivent les remplacements de produit ;
-- une vente saisie à la main garde le produit choisi.
create or replace function public.merch_record_sale(p jsonb) returns uuid
  language plpgsql set search_path = '' as
$$
declare
  sid uuid;
  ts timestamptz;
  line jsonb;
  pid text;
  lid bigint;
begin
  insert into public.merch_sales (channel, external_id, occurred_at, status, payment_method, total_cents,
                                  shipping_cents, fees_cents, refunded_cents, event, note, raw)
  values (p->>'channel', p->>'external_id', coalesce((p->>'occurred_at')::timestamptz, now()),
          coalesce(p->>'status', 'paid'), p->>'payment_method', coalesce((p->>'total_cents')::int, 0),
          coalesce((p->>'shipping_cents')::int, 0), coalesce((p->>'fees_cents')::int, 0),
          coalesce((p->>'refunded_cents')::int, 0), p->>'event', p->>'note', p->'raw')
  on conflict (channel, external_id) do nothing
  returning id, occurred_at into sid, ts;

  if sid is null then  -- déjà importée (même canal + external_id)
    select id into sid from public.merch_sales where channel = p->>'channel' and external_id = p->>'external_id';
    return sid;
  end if;

  for line in select * from jsonb_array_elements(coalesce(p->'lines', '[]')) loop
    pid := nullif(line->>'product_id', '');
    if p->>'channel' in ('shopify', 'sumup') then pid := public.merch_resolve_product(pid, ts); end if;
    insert into public.merch_sale_lines (sale_id, product_id, label, qty, unit_price_cents, unit_cost_cents, external_ref)
    values (sid, pid, line->>'label', (line->>'qty')::int, (line->>'unit_price_cents')::int,
            public.merch_unit_cost(pid), line->>'external_ref')
    returning id into lid;
    perform public.merch_line_movements(lid);
  end loop;
  return sid;
end
$$;

-- Comme avant, mais chaque ligne suit les remplacements de produit à la date de sa vente.
create or replace function public.merch_assign_label(lbl text, pid text) returns integer
  language plpgsql set search_path = '' as
$$
declare
  lid bigint;
  target text;
  n integer := 0;
begin
  update public.merch_products
     set sumup_names = array_append(sumup_names, btrim(lbl))
   where id = pid and not (public.merch_norm(lbl) = any (select public.merch_norm(x) from unnest(sumup_names) x));
  for lid in
    select id from public.merch_sale_lines
     where product_id is null and public.merch_norm(label) = public.merch_norm(lbl)
  loop
    select public.merch_resolve_product(pid, s.occurred_at) into target
      from public.merch_sale_lines l join public.merch_sales s on s.id = l.sale_id where l.id = lid;
    update public.merch_sale_lines set product_id = target, unit_cost_cents = public.merch_unit_cost(target) where id = lid;
    perform public.merch_line_movements(lid);
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke execute on function public.merch_resolve_product(text, timestamptz) from public, anon, authenticated;
grant execute on function public.merch_resolve_product(text, timestamptz) to service_role;

/* ---------- Catalogue ---------- */

-- Coûts de revient par exemplaire, SDRM comprise, TTC (validé : la TVA n'est pas récupérée) :
--   vert transparent  (2 078 + 200 stickers + 388,24 SDRM) / 300 = 8,89
--   swirl             (2 800 + 200 stickers + 770,79 SDRM) / 500 = 7,54
--   8 Days in Sweden  (2 912 + 115 poster   + 570,92 SDRM) / 500 = 7,20
-- Reversement : 2 € par vinyle une fois le tirage rentabilisé (seuil = coût du tirage / prix, arrondi à l'unité).
insert into public.merch_products (id, name, category, price_cents, cost_cents, investment_cents, royalty_cents, royalty_after_units, sort)
values ('life-balance-swirl', 'Vinyle Life Balance swirl', 'vinyle', 2500, 754, 377079, 200, 0, 10)
on conflict (id) do nothing;

-- L'ancien produit unique devient le vert transparent : ses lignes de vente et mouvements suivent (on update cascade).
-- Il garde les handles Shopify et le nom en caisse « Vinyle » : Shopify et SumUp ne font pas la différence, c'est la
-- date qui tranche (replaced_by). Épuisé, il n'est plus proposé à la saisie (sauf pour les disquaires).
update public.merch_products
   set id = 'life-balance-vert', name = 'Vinyle Life Balance vert transparent', price_cents = 2500, cost_cents = 889,
       investment_cents = 266624, royalty_cents = 200, royalty_after_units = 107,
       replaced_by = 'life-balance-swirl', replaced_at = '2026-09-07 00:00 Europe/Paris', active = false, sort = 12
 where id = 'life-balance';

update public.merch_products set price_cents = 3000, cost_cents = 720, investment_cents = 359792, royalty_cents = 200, royalty_after_units = 120
 where id = '8-days-in-sweden';

-- Le pack : 30 € pour 8 Days + 20 € pour Life Balance (swirl), share_cents ; coût et stock = ceux des composants.
update public.merch_products
   set price_cents = 5000, cost_cents = null,
       components = '[{"product_id": "8-days-in-sweden", "qty": 1, "share_cents": 3000}, {"product_id": "life-balance-swirl", "qty": 1, "share_cents": 2000}]'
 where id = 'bundle-vinyles';

update public.merch_products set price_cents = 800, cost_cents = 400, investment_cents = 40000 where id = 'sauce-piquhans';
update public.merch_products set price_cents = 1000, cost_cents = 200, investment_cents = 100000 where id = 'carte-postale';
update public.merch_products set active = false where id = 'affiche';

-- Bandcamp : prix majorés pour compenser la commission, qu'on ne compte donc pas. Disquaires : pas de commission.
update public.merch_settings
   set value = value
     || jsonb_build_object('bandcamp', coalesce(value->'bandcamp', '{}')
          || '{"pct": 0, "fixed_cents": 0, "label": "Bandcamp (commission compensée par les prix)"}')
     || '{"wholesale": {"pct": 0, "fixed_cents": 0, "label": "Disquaires"}}'
 where key = 'fees';

/* ---------- Historique ---------- */

-- Life Balance vendus à partir du 7 sept. 2026 : swirl.
update public.merch_sale_lines l set product_id = 'life-balance-swirl'
  from public.merch_sales s
 where s.id = l.sale_id and l.product_id = 'life-balance-vert' and s.occurred_at >= '2026-09-07 00:00 Europe/Paris';

-- Leurs sorties de stock (et retours), et le Life Balance des packs, qui est toujours un swirl.
update public.merch_stock_movements m set product_id = 'life-balance-swirl'
  from public.merch_sale_lines l
 where l.id = m.sale_line_id and m.product_id = 'life-balance-vert'
   and l.product_id in ('life-balance-swirl', 'bundle-vinyles');

-- Mouvements saisis à la main à partir du 7 sept. (réassort, inventaire, cadeau…) : swirl aussi.
update public.merch_stock_movements set product_id = 'life-balance-swirl'
 where sale_id is null and product_id = 'life-balance-vert' and occurred_at >= '2026-09-07 00:00 Europe/Paris';

-- Coûts figés sur les lignes : recalculés pour les produits dont le coût a été corrigé.
update public.merch_sale_lines set unit_cost_cents = public.merch_unit_cost(product_id)
 where product_id in ('life-balance-vert', 'life-balance-swirl', '8-days-in-sweden', 'bundle-vinyles', 'sauce-piquhans');

-- Stocks de départ, seulement pour un produit qui n'en a pas encore (ni réassort), datés au plus tard de son premier
-- mouvement. 8 Days in Sweden (500, fin nov. 2026) se saisit à la réception : d'ici là son stock est négatif
-- (précommandes à expédier), c'est voulu.
insert into public.merch_stock_movements (product_id, qty, reason, occurred_at, note)
select v.pid, v.qty, 'initial',
       least(v.since, coalesce((select min(m.occurred_at) from public.merch_stock_movements m where m.product_id = v.pid), v.since)),
       v.note
  from (values
    ('life-balance-vert', 300, timestamptz '2025-06-13 12:00 Europe/Paris', 'Tirage 2025 (date approximative)'),
    ('life-balance-swirl', 500, timestamptz '2026-09-07 00:00 Europe/Paris', 'Tirage swirl reçu'),
    ('sauce-piquhans', 100, now(), 'Stock de départ'),
    ('carte-postale', 500, now(), 'Stock de départ')
  ) v(pid, qty, since, note)
 where not exists (select 1 from public.merch_stock_movements m where m.product_id = v.pid and m.reason in ('initial', 'restock'));
