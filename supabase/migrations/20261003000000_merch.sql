-- Suivi des ventes de merch (dashboard /ventes). Tout est préfixé merch_ : la base Obsimo sert aussi à d'autres outils.
-- RLS activé sans aucune policy : seules les fonctions Vercel (clé secrète, qui ignore le RLS) lisent et écrivent.
-- Montants en centimes d'euro, quantités en unités.

create table public.merch_products (
  id text primary key,                                  -- slug stable, ex. life-balance
  name text not null,
  category text not null default 'merch',               -- vinyle, merch, sauce…
  price_cents integer,                                  -- prix de vente de référence (concert)
  cost_cents integer,                                   -- coût de revient unitaire, null = inconnu
  components jsonb not null default '[]',               -- pack : [{"product_id": "...", "qty": 1}], le stock est celui des composants
  shopify_handles text[] not null default '{}',
  shopify_product_ids text[] not null default '{}',     -- appris automatiquement à partir des handles
  shopify_inventory_item_id text,                       -- pour pousser le stock vers Shopify
  sumup_names text[] not null default '{}',             -- noms des articles dans la caisse SumUp
  active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.merch_sales (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('shopify', 'sumup', 'bandcamp', 'cash', 'other')),
  external_id text,                                     -- id de la commande / transaction, pour ne jamais importer deux fois
  occurred_at timestamptz not null default now(),
  status text not null default 'paid' check (status in ('paid', 'partially_refunded', 'refunded', 'cancelled')),
  payment_method text,                                  -- card, cash, paypal…
  total_cents integer not null default 0,               -- ce que le client a payé (frais de port compris)
  shipping_cents integer not null default 0,
  fees_cents integer not null default 0,                -- commissions (Shopify Payments, SumUp, Bandcamp…)
  refunded_cents integer not null default 0,
  event text,                                           -- concert (ville · lieu) pour les ventes en caisse
  note text,
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (channel, external_id)
);
create index merch_sales_occurred_at on public.merch_sales (occurred_at desc);

create table public.merch_sale_lines (
  id bigint generated always as identity primary key,
  sale_id uuid not null references public.merch_sales on delete cascade,
  product_id text references public.merch_products on update cascade,  -- null = article pas encore associé
  label text not null,                                  -- nom tel qu'il arrive de Shopify / SumUp
  qty integer not null check (qty > 0),
  unit_price_cents integer not null,                    -- après remises
  unit_cost_cents integer,                              -- coût de revient figé au moment de la vente
  external_ref text                                     -- id produit Shopify
);
create index merch_sale_lines_sale on public.merch_sale_lines (sale_id);
create index merch_sale_lines_product on public.merch_sale_lines (product_id);

create table public.merch_stock_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.merch_products on update cascade,
  qty integer not null,                                 -- négatif = sortie
  reason text not null check (reason in ('initial', 'restock', 'sale', 'refund', 'adjust', 'gift', 'loss')),
  sale_id uuid references public.merch_sales on delete cascade,
  sale_line_id bigint references public.merch_sale_lines on delete cascade,
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
create index merch_stock_movements_product on public.merch_stock_movements (product_id);
create index merch_stock_movements_sale on public.merch_stock_movements (sale_id);
create index merch_stock_movements_line on public.merch_stock_movements (sale_line_id);

create table public.merch_expenses (
  id bigint generated always as identity primary key,
  occurred_at date not null default current_date,
  label text not null,
  amount_cents integer not null,
  category text not null default 'autre',               -- transport, emballage, pub… (la fabrication est déjà dans le coût de revient)
  note text,
  created_at timestamptz not null default now()
);

create table public.merch_settings (
  key text primary key,
  value jsonb not null
);

alter table public.merch_products enable row level security;
alter table public.merch_sales enable row level security;
alter table public.merch_sale_lines enable row level security;
alter table public.merch_stock_movements enable row level security;
alter table public.merch_expenses enable row level security;
alter table public.merch_settings enable row level security;

create view public.merch_stock with (security_invoker = true) as
  select p.id as product_id, coalesce(sum(m.qty), 0)::integer as qty
  from public.merch_products p
  left join public.merch_stock_movements m on m.product_id = p.id
  group by p.id;

-- Même normalisation que norm() dans api/_lib/match.js : minuscules, espaces réduits.
create function public.merch_norm(t text) returns text
  language sql immutable set search_path = '' as
$$ select lower(regexp_replace(btrim(coalesce(t, '')), '\s+', ' ', 'g')) $$;

-- Coût de revient d'un produit : le sien, sinon la somme de ses composants (pack).
create function public.merch_unit_cost(pid text) returns integer
  language sql stable set search_path = '' as
$$
  select coalesce(p.cost_cents, (
    select sum((c->>'qty')::int * cp.cost_cents)::int
    from jsonb_array_elements(p.components) c
    join public.merch_products cp on cp.id = c->>'product_id'
    having count(*) = count(cp.cost_cents) and count(*) > 0
  ))
  from public.merch_products p where p.id = pid
$$;

-- Sorties de stock d'une ligne de vente (les composants pour un pack).
create function public.merch_line_movements(line_id bigint) returns void
  language plpgsql set search_path = '' as
$$
declare
  l public.merch_sale_lines;
  s public.merch_sales;
  comps jsonb;
begin
  select * into l from public.merch_sale_lines where id = line_id;
  if l.product_id is null then return; end if;
  select * into s from public.merch_sales where id = l.sale_id;
  select components into comps from public.merch_products where id = l.product_id;
  if jsonb_array_length(comps) > 0 then
    insert into public.merch_stock_movements (product_id, qty, reason, sale_id, sale_line_id, occurred_at)
    select c->>'product_id', -l.qty * (c->>'qty')::int, 'sale', s.id, l.id, s.occurred_at
    from jsonb_array_elements(comps) c;
  else
    insert into public.merch_stock_movements (product_id, qty, reason, sale_id, sale_line_id, occurred_at)
    values (l.product_id, -l.qty, 'sale', s.id, l.id, s.occurred_at);
  end if;
  if s.status in ('refunded', 'cancelled') then
    insert into public.merch_stock_movements (product_id, qty, reason, sale_id, sale_line_id, occurred_at)
    select product_id, -qty, 'refund', sale_id, sale_line_id, s.occurred_at
    from public.merch_stock_movements where sale_line_id = l.id and reason = 'sale';
  end if;
end
$$;

-- Enregistre une vente et ses lignes, et sort le stock, en une transaction.
-- Idempotent : une vente déjà importée (même canal + external_id) n'est pas recréée, son id est renvoyé.
-- p = {channel, external_id, occurred_at, status, payment_method, total_cents, shipping_cents, fees_cents,
--      refunded_cents, event, note, raw, lines: [{product_id, label, qty, unit_price_cents, external_ref}]}
create function public.merch_record_sale(p jsonb) returns uuid
  language plpgsql set search_path = '' as
$$
declare
  sid uuid;
  line jsonb;
  lid bigint;
begin
  insert into public.merch_sales (channel, external_id, occurred_at, status, payment_method, total_cents,
                                  shipping_cents, fees_cents, refunded_cents, event, note, raw)
  values (p->>'channel', p->>'external_id', coalesce((p->>'occurred_at')::timestamptz, now()),
          coalesce(p->>'status', 'paid'), p->>'payment_method', coalesce((p->>'total_cents')::int, 0),
          coalesce((p->>'shipping_cents')::int, 0), coalesce((p->>'fees_cents')::int, 0),
          coalesce((p->>'refunded_cents')::int, 0), p->>'event', p->>'note', p->'raw')
  on conflict (channel, external_id) do nothing
  returning id into sid;

  if sid is null then  -- déjà importée (même canal + external_id)
    select id into sid from public.merch_sales where channel = p->>'channel' and external_id = p->>'external_id';
    return sid;
  end if;

  for line in select * from jsonb_array_elements(coalesce(p->'lines', '[]')) loop
    insert into public.merch_sale_lines (sale_id, product_id, label, qty, unit_price_cents, unit_cost_cents, external_ref)
    values (sid, nullif(line->>'product_id', ''), line->>'label', (line->>'qty')::int,
            (line->>'unit_price_cents')::int, public.merch_unit_cost(nullif(line->>'product_id', '')),
            line->>'external_ref')
    returning id into lid;
    perform public.merch_line_movements(lid);
  end loop;
  return sid;
end
$$;

-- Change le statut d'une vente. Remboursée / annulée : le stock revient (une seule fois).
-- Un remboursement partiel ne touche pas au stock (on ne sait pas quel article est revenu).
create function public.merch_set_status(sid uuid, new_status text, refunded integer default null) returns void
  language plpgsql set search_path = '' as
$$
begin
  update public.merch_sales
     set status = new_status, refunded_cents = coalesce(refunded, refunded_cents)
   where id = sid;
  if new_status in ('refunded', 'cancelled')
     and not exists (select 1 from public.merch_stock_movements where sale_id = sid and reason = 'refund') then
    insert into public.merch_stock_movements (product_id, qty, reason, sale_id, sale_line_id, occurred_at)
    select product_id, -qty, 'refund', sale_id, sale_line_id, now()
    from public.merch_stock_movements where sale_id = sid and reason = 'sale';
  end if;
end
$$;

-- Associe un article à un produit (et à toutes les lignes qui portent le même nom), puis sort le stock correspondant.
-- Le nom est retenu dans sumup_names pour que les prochaines ventes s'associent toutes seules.
create function public.merch_assign_label(lbl text, pid text) returns integer
  language plpgsql set search_path = '' as
$$
declare
  lid bigint;
  n integer := 0;
begin
  update public.merch_products
     set sumup_names = array_append(sumup_names, btrim(lbl))
   where id = pid and not (public.merch_norm(lbl) = any (select public.merch_norm(x) from unnest(sumup_names) x));
  for lid in
    select id from public.merch_sale_lines
     where product_id is null and public.merch_norm(label) = public.merch_norm(lbl)
  loop
    update public.merch_sale_lines set product_id = pid, unit_cost_cents = public.merch_unit_cost(pid) where id = lid;
    perform public.merch_line_movements(lid);
    n := n + 1;
  end loop;
  return n;
end
$$;

revoke execute on function public.merch_norm(text), public.merch_unit_cost(text), public.merch_line_movements(bigint),
  public.merch_record_sale(jsonb), public.merch_set_status(uuid, text, integer), public.merch_assign_label(text, text)
  from public, anon, authenticated;
grant execute on function public.merch_norm(text), public.merch_unit_cost(text), public.merch_line_movements(bigint),
  public.merch_record_sale(jsonb), public.merch_set_status(uuid, text, integer), public.merch_assign_label(text, text)
  to service_role;
revoke all on public.merch_stock from anon, authenticated;

-- Frais par canal (pourcentage + fixe par vente), modifiables dans le dashboard. Estimations à vérifier.
insert into public.merch_settings (key, value) values
  ('fees', '{
    "shopify":  {"pct": 1.5,  "fixed_cents": 25, "label": "Shopify Payments (cartes UE)"},
    "sumup":    {"pct": 1.75, "fixed_cents": 0,  "label": "SumUp"},
    "bandcamp": {"pct": 15,   "fixed_cents": 0,  "label": "Bandcamp (hors frais de paiement)"},
    "cash":     {"pct": 0,    "fixed_cents": 0,  "label": "Espèces"},
    "other":    {"pct": 0,    "fixed_cents": 0,  "label": "Autre"}
  }');

insert into public.merch_products (id, name, category, price_cents, cost_cents, components, shopify_handles, sumup_names, sort) values
  ('life-balance', 'Vinyle Life Balance', 'vinyle', 2500, 1000, '[]',
    '{life-balance-swirl,transparent-green-vinyl-life-balance-limited-edition,life-balance-vinyl-33-transparent-green}', '{Vinyle}', 10),
  ('8-days-in-sweden', 'Vinyle 8 Days in Sweden', 'vinyle', 3200, null, '[]', '{8-days-in-sweden-marble}', '{}', 20),
  ('bundle-vinyles', 'Pack 8 Days in Sweden + Life Balance', 'vinyle', 5500, null,
    '[{"product_id": "8-days-in-sweden", "qty": 1}, {"product_id": "life-balance", "qty": 1}]',
    '{bundle-8-days-in-sweden-life-balance}', '{}', 30),
  ('sauce-piquhans', 'Sauce piquante Piqu''hans', 'sauce', 800, 350, '[]', '{hot-sauce-obsimo-x-piquhans-50ml}', '{Hot Sauce}', 40),
  ('carte-postale', 'Carte postale vinyle', 'merch', 1000, 200, '[]', '{carte-postale-vinyle}', '{Carte Postale}', 50),
  ('affiche', 'Affiche tournée', 'merch', 200, null, '[]', '{}', '{Affiche}', 60);
